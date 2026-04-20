import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

const bus = new EventEmitter();

bus.on('task.started', (payload) => {
  console.log(`[${new Date().toISOString()}] EVENT task.started | task_id=${payload.task_id} | prompt="${payload.prompt}"`);
});

bus.on('task.completed', (payload) => {
  console.log(`[${new Date().toISOString()}] EVENT task.completed | task_id=${payload.task_id} | tools_called=${JSON.stringify(payload.tools_called)}`);
});

bus.on('task.failed', (payload) => {
  console.log(`[${new Date().toISOString()}] EVENT task.failed | task_id=${payload.task_id} | error="${payload.error}"`);
});

export function publish(type, data) {
  bus.emit(type, { ...data, timestamp: new Date().toISOString() });
}

/** Generate a unique task id */
export function newTaskId() {
  return randomUUID();
}

