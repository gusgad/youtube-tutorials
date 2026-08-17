import * as z from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { SpanStatusCode } from "@opentelemetry/api";
import { initTracer, newConversationId, shutdownTracer } from "./otel_setup.js";
import { chargeCard, countChargesForOrder, GatewayOverloadedError } from "./payment_gateway.js";
import { getOrder, markOrderPaid } from "./orders.js";
import { toInputMessages, toOutputMessages } from "./genai_messages.js";

const MODEL = "claude-sonnet-5";
const CONVERSATION_ID = newConversationId();
const tracer = initTracer("payment-demo-fleet-naive");

const ORDER_IDS = [1, 2, 3, 4, 5, 6];

const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 150;

const SYSTEM_PROMPT = `You are an ops assistant responsible for making sure
a specific customer order gets paid. You have three tools:
- get_order: look up an order's customer, amount, and status by id.
- charge_card: charge an order's card via the payment gateway for a given
  amount. The tool itself handles retrying against the gateway if it's
  temporarily at capacity, so you do not need to call it more than once.
- mark_order_paid: record that an order has been successfully paid.

For the order you're given: look up the order to confirm its amount,
charge it, and if the charge succeeds, mark it paid. If charge_card
reports it could not complete the charge, do not mark the order paid --
tell the user clearly that this order could not be paid, and why.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGetOrderTool({ tracer, conversationId, agentName }) {
  return tool(
    ({ order_id }) =>
      tracer.startActiveSpan("get_order", (span) => {
        try {
          span.setAttribute("gen_ai.operation.name", "execute_tool");
          span.setAttribute("gen_ai.tool.name", "get_order");
          span.setAttribute("gen_ai.conversation.id", conversationId);
          span.setAttribute("gen_ai.agent.name", agentName);
          span.setAttribute("tool.input.order_id", order_id);

          const order = getOrder(order_id);
          if (!order) {
            span.setAttribute("tool.output.found", false);
            return `No order found with id ${order_id}.`;
          }
          span.setAttribute("tool.output.found", true);
          span.setAttribute("tool.output.status", order.status);
          span.setAttribute("tool.output.amount_cents", order.amount_cents);
          return `Order ${order.id}: customer ${order.customer_email}, amount $${(order.amount_cents / 100).toFixed(2)}, status ${order.status}.`;
        } finally {
          span.end();
        }
      }),
    {
      name: "get_order",
      description: "Look up an order's customer, amount, and current status by id.",
      schema: z.object({
        order_id: z.number().int().describe("The id of the order to look up."),
      }),
    }
  );
}

function buildMarkOrderPaidTool({ tracer, conversationId, agentName }) {
  return tool(
    ({ order_id }) =>
      tracer.startActiveSpan("mark_order_paid", (span) => {
        try {
          span.setAttribute("gen_ai.operation.name", "execute_tool");
          span.setAttribute("gen_ai.tool.name", "mark_order_paid");
          span.setAttribute("gen_ai.conversation.id", conversationId);
          span.setAttribute("gen_ai.agent.name", agentName);
          span.setAttribute("tool.input.order_id", order_id);

          markOrderPaid(order_id);
          return `Order ${order_id} marked as paid.`;
        } finally {
          span.end();
        }
      }),
    {
      name: "mark_order_paid",
      description:
        "Record that an order has been successfully paid. Only call this after charge_card reports success.",
      schema: z.object({
        order_id: z.number().int().describe("The id of the order to mark paid."),
      }),
    }
  );
}

function buildChargeCardTool({ tracer, conversationId, agentName, agentResult }) {
  return tool(
    ({ order_id, amount_cents }) =>
      tracer.startActiveSpan("charge_card", async (span) => {
        try {
          span.setAttribute("gen_ai.operation.name", "execute_tool");
          span.setAttribute("gen_ai.tool.name", "charge_card");
          span.setAttribute("gen_ai.conversation.id", conversationId);
          span.setAttribute("gen_ai.agent.name", agentName);
          span.setAttribute("tool.input.order_id", order_id);
          span.setAttribute("tool.input.amount_cents", amount_cents);

          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            let succeeded = null;

            await tracer.startActiveSpan("gateway_attempt", async (attemptSpan) => {
              attemptSpan.setAttribute("gen_ai.conversation.id", conversationId);
              attemptSpan.setAttribute("gen_ai.agent.name", agentName);
              attemptSpan.setAttribute("payment.retry_attempt", attempt);
              try {
                const result = await chargeCard({ orderId: order_id, amountCents: amount_cents });
                attemptSpan.setAttribute("payment.gateway_attempt_outcome", "success");
                attemptSpan.setAttribute("tool.output.gateway_txn_id", result.gatewayTxnId);
                succeeded = result;
              } catch (e) {
                if (!(e instanceof GatewayOverloadedError)) throw e;
                attemptSpan.setAttribute("payment.gateway_attempt_outcome", "overloaded");
                attemptSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
              } finally {
                attemptSpan.end();
              }
            });

            if (succeeded) {
              agentResult.charged = true;
              span.setAttribute("payment.gave_up", false);
              span.setAttribute("payment.attempts_used", attempt);
              return `Charge succeeded on attempt ${attempt}/${MAX_ATTEMPTS}. Gateway transaction id: ${succeeded.gatewayTxnId}`;
            }

            if (attempt < MAX_ATTEMPTS) {
              console.log(`  [agent-${order_id}] attempt ${attempt} rejected (at capacity), retrying...`);
              await sleep(RETRY_DELAY_MS);
            }
          }

          agentResult.gaveUp = true;
          span.setAttribute("payment.gave_up", true);
          span.setAttribute("payment.attempts_used", MAX_ATTEMPTS);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `gave up after ${MAX_ATTEMPTS} attempts, payments API stayed at capacity`,
          });
          return `FAILED: could not charge order ${order_id} after ${MAX_ATTEMPTS} attempts -- the payments API stayed at capacity every time.`;
        } finally {
          span.end();
        }
      }),
    {
      name: "charge_card",
      description:
        "Charge the customer's card via the payment gateway for the given order.",
      schema: z.object({
        order_id: z.number().int().describe("The id of the order to charge."),
        amount_cents: z.number().int().describe("Amount to charge, in cents."),
      }),
    }
  );
}

async function runAgent(orderId) {
  const agentName = `payments-ops-fleet-${orderId}`;
  const agentResult = { charged: false, gaveUp: false };
  const getOrderTool = buildGetOrderTool({ tracer, conversationId: CONVERSATION_ID, agentName });
  const markOrderPaidTool = buildMarkOrderPaidTool({
    tracer,
    conversationId: CONVERSATION_ID,
    agentName,
  });
  const chargeCardTool = buildChargeCardTool({
    tracer,
    conversationId: CONVERSATION_ID,
    agentName,
    agentResult,
  });
  const model = new ChatAnthropic({ model: MODEL, maxTokens: 1024 }).bindTools([
    getOrderTool,
    chargeCardTool,
    markOrderPaidTool,
  ]);
  const TOOL_IMPL = {
    get_order: getOrderTool,
    charge_card: chargeCardTool,
    mark_order_paid: markOrderPaidTool,
  };

  let messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(`Process payment for order #${orderId}.`),
  ];

  await tracer.startActiveSpan("agent_conversation", async (convSpan) => {
    try {
      convSpan.setAttribute("gen_ai.conversation.id", CONVERSATION_ID);
      convSpan.setAttribute("gen_ai.agent.name", agentName);

      for (let i = 0; i < 8; i++) {
        let response;
        await tracer.startActiveSpan("model_call", async (span) => {
          try {
            span.setAttribute("gen_ai.operation.name", "chat");
            span.setAttribute("gen_ai.system", "anthropic");
            span.setAttribute("gen_ai.request.model", MODEL);
            span.setAttribute("gen_ai.conversation.id", CONVERSATION_ID);
            span.setAttribute("gen_ai.agent.name", agentName);
            span.setAttribute("gen_ai.input.messages", toInputMessages(messages));

            response = await model.invoke(messages);
            span.setAttribute(
              "gen_ai.response.stop_reason",
              response.response_metadata?.stop_reason ?? "unknown"
            );
            span.setAttribute("gen_ai.output.messages", toOutputMessages(response));
            if (response.usage_metadata) {
              span.setAttribute("gen_ai.usage.input_tokens", response.usage_metadata.input_tokens);
              span.setAttribute("gen_ai.usage.output_tokens", response.usage_metadata.output_tokens);
            }
          } finally {
            span.end();
          }
        });

        messages = [...messages, response];

        if (!response.tool_calls?.length) {
          if (response.text) console.log(`[agent-${orderId}]`, response.text);
          break;
        }

        for (const toolCall of response.tool_calls) {
          console.log(`[agent-${orderId}] [tool call] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          const toolMessage = await TOOL_IMPL[toolCall.name].invoke(toolCall);
          console.log(`[agent-${orderId}]    -> ${toolMessage.content}`);
          messages = [...messages, toolMessage];
        }
      }

      convSpan.setAttribute("payment.gave_up", agentResult.gaveUp);
      convSpan.setAttribute("payment.charged", agentResult.charged);
      if (agentResult.gaveUp) {
        convSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `order ${orderId} was not charged -- agent gave up`,
        });
      }
    } finally {
      convSpan.end();
    }
  });

  return { orderId, ...agentResult };
}

const startedAt = Date.now();
const results = await Promise.all(ORDER_IDS.map(runAgent));
const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);

const charged = results.filter((r) => r.charged).length;
const gaveUp = results.filter((r) => r.gaveUp).length;

console.log(`\nFleet run finished in ${elapsedS}s.`);
console.log(`Orders charged: ${charged}/${ORDER_IDS.length}`);
console.log(`Agents that gave up: ${gaveUp}/${ORDER_IDS.length}`);
for (const r of results) {
  const order = getOrder(r.orderId);
  console.log(
    `  order ${r.orderId}: ${r.charged ? "charged" : "NOT charged"}, status=${order?.status} (charges recorded: ${countChargesForOrder(r.orderId)})`
  );
}

await shutdownTracer();
console.log(`\nConversation ID for Honeycomb Agent Timeline: ${CONVERSATION_ID}`);
