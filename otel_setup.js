/**
 * Shared OpenTelemetry bootstrap for the demo agents.
 *
 * Exports spans straight to Honeycomb over OTLP/HTTP using the
 * gen_ai.* semantic conventions so Agent Timeline can reconstruct the
 * conversation: which content the agent read, which tool calls followed,
 * and in what order.
 *
 * Env vars required:
 *   HONEYCOMB_API_KEY  -- your Honeycomb ingest key
 *   HONEYCOMB_DATASET  -- dataset name, e.g. "confused-deputy-demo"
 */
import crypto from "node:crypto";
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

let _provider;

export function initTracer(serviceName) {
  const apiKey = process.env.HONEYCOMB_API_KEY;
  if (!apiKey) throw new Error("HONEYCOMB_API_KEY is not set");
  const dataset = process.env.HONEYCOMB_DATASET || "confused-deputy-demo";

  const exporter = new OTLPTraceExporter({
    url: "https://api.honeycomb.io/v1/traces",
    headers: {
      "x-honeycomb-team": apiKey,
      "x-honeycomb-dataset": dataset,
    },
  });

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ "service.name": serviceName }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();
  _provider = provider;

  return trace.getTracer(serviceName);
}

// This is the id you paste into Agent Timeline.
export function newConversationId() {
  return crypto.randomUUID();
}

// BatchSpanProcessor buffers spans and flushes on a timer -- without this,
// a short-lived script like these demo agents can exit before its spans
// ever leave the process. Every agent script must call this before exiting.
export async function shutdownTracer() {
  if (_provider) {
    await _provider.shutdown();
  }
}
