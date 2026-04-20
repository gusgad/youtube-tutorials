import express from 'express';

const app = express();
const PORT = 3002;

const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'customer' },
  { id: 3, name: 'Carol Lee', email: 'carol@example.com', role: 'customer' },
];

app.get('/users', (_req, res) => {
  res.json(users);
});

app.listen(PORT, () => {
  console.log(`Users service listening on port ${PORT}`);
});

export default app;
