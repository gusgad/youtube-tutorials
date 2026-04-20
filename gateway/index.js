// API Gateway — single entry point (port 3000).

import express from 'express';
import { randomUUID } from 'node:crypto';
import { processAIRequest } from '../ai-gateway/index.js';
import { newTaskId } from '../events/bus.js';

import '../services/orders.js';
import '../services/users.js';
import '../services/payments.js';

const app = express();
const PORT = 3000;

app.use(express.json());

const tasks = new Map();

const rateLimitWindow = 60_000;
const rateLimitMax = 30;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  let entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + rateLimitWindow };
    hits.set(ip, entry);
  }
  entry.count++;
  if (entry.count > rateLimitMax) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }
  next();
}

app.use(rateLimit);

function authCheck(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <token>' });
  }
  next();
}

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] GATEWAY ${req.method} ${req.url}`);
  next();
});

// ── Direct path ──

app.get('/orders', authCheck, async (_req, res) => {
  try {
    const response = await fetch('http://localhost:3001/orders');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Orders service unavailable', details: err.message });
  }
});

app.get('/users', authCheck, async (_req, res) => {
  try {
    const response = await fetch('http://localhost:3002/users');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Users service unavailable', details: err.message });
  }
});

app.post('/payments', authCheck, async (req, res) => {
  try {
    const response = await fetch('http://localhost:3003/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Payments service unavailable', details: err.message });
  }
});

// ── AI path ──

app.post('/agent/query', authCheck, (req, res) => {
  const { prompt, context, session_id } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing required field: prompt' });
  }

  const task_id = newTaskId();
  const sid = session_id ?? randomUUID();

  tasks.set(task_id, { status: 'processing', result: null });

  res.status(202).json({ task_id, status: 'accepted' });

  processAIRequest({ task_id, session_id: sid, prompt, context })
    .then((result) => {
      tasks.set(task_id, { status: 'completed', result });
    })
    .catch((err) => {
      tasks.set(task_id, { status: 'failed', error: err.message });
    });
});

app.get('/tasks/:task_id', authCheck, (req, res) => {
  const task = tasks.get(req.params.task_id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ task_id: req.params.task_id, ...task });
});

app.listen(PORT, () => {
  console.log(`\nAPI Gateway listening on port ${PORT}`);
  console.log(`Mode: ${process.env.ANTHROPIC_API_KEY ? 'Anthropic Claude' : 'Mock (no ANTHROPIC_API_KEY set)'}\n`);
  console.log('Direct routes:');
  console.log('  GET  /orders');
  console.log('  GET  /users');
  console.log('  POST /payments');
  console.log('\nAI route:');
  console.log('  POST /agent/query  →  AI Gateway → Agent → Tool Layer → Microservices');
  console.log('  GET  /tasks/:id    →  Poll for async result\n');
});
