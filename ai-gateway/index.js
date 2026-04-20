// AI Gateway — token budget, request logging, provider routing.

import { publish } from '../events/bus.js';

const TOKEN_LIMIT = parseInt(process.env.TOKEN_LIMIT ?? '4000', 10);
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:4000';
const MODEL = process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4-20250514' : 'mock';

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export async function processAIRequest(payload) {
  const { task_id, prompt, session_id, context } = payload;
  const estimatedTokens = estimateTokens(prompt + (context ?? ''));

  console.log(
    `[${new Date().toISOString()}] AI-GATEWAY | task_id=${task_id} | model=${MODEL} | est_tokens=${estimatedTokens}`
  );

  if (estimatedTokens > TOKEN_LIMIT) {
    const err = new Error(
      `Token budget exceeded: estimated ${estimatedTokens} tokens, limit is ${TOKEN_LIMIT}`
    );
    err.status = 413;
    throw err;
  }

  publish('task.started', { task_id, session_id, prompt });

  const response = await fetch(`${AGENT_SERVICE_URL}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id, session_id, prompt, context }),
  });

  if (!response.ok) {
    const error = await response.text();
    publish('task.failed', { task_id, session_id, error });
    throw new Error(`Agent service error: ${error}`);
  }

  const result = await response.json();
  publish('task.completed', { task_id, session_id, answer: result.answer, tools_called: result.tools_called });

  return result;
}