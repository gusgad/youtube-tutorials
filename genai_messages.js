/**
 * Maps LangChain.js message objects to the shape OpenTelemetry's GenAI
 * semantic conventions define for gen_ai.input.messages /
 * gen_ai.output.messages, so Agent Timeline can render actual message
 * content instead of just "a model call happened here."
 *
 * Schema: https://github.com/open-telemetry/semantic-conventions-genai
 * (status: Development, not yet Stable, as of 2026 -- this is the shape
 * Honeycomb's Agent Timeline reads today). Span attributes can't hold
 * nested objects in the OTel JS API, so both attributes are recorded as
 * JSON strings, which the spec explicitly allows.
 */

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text")
      .map((block) => block.text)
      .join("");
  }
  return "";
}

function messageToGenAI(message) {
  const type = message._getType ? message._getType() : message.type;

  if (type === "tool") {
    return {
      role: "tool",
      parts: [
        {
          type: "tool_call_response",
          id: message.tool_call_id,
          response: extractText(message.content),
        },
      ],
    };
  }

  if (type === "ai") {
    const parts = [];
    const text = extractText(message.content);
    if (text) parts.push({ type: "text", content: text });
    for (const toolCall of message.tool_calls ?? []) {
      parts.push({
        type: "tool_call",
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.args,
      });
    }
    return { role: "assistant", parts };
  }

  const role = type === "human" ? "user" : type === "system" ? "system" : type;
  return { role, parts: [{ type: "text", content: extractText(message.content) }] };
}

const FINISH_REASON_MAP = {
  end_turn: "stop",
  tool_use: "tool_calls",
  max_tokens: "length",
  stop_sequence: "stop",
};

export function toInputMessages(messages) {
  return JSON.stringify(messages.map(messageToGenAI));
}

export function toOutputMessages(response) {
  const { parts } = messageToGenAI(response);
  const rawStopReason = response.response_metadata?.stop_reason;
  const finishReason = FINISH_REASON_MAP[rawStopReason] ?? rawStopReason ?? "stop";
  return JSON.stringify([{ role: "assistant", parts, finish_reason: finishReason }]);
}
