import express from 'express';

const app = express();
const PORT = 3001;

const orders = [
  { id: 1, item: 'Laptop', quantity: 1, total: 1299.99, status: 'shipped' },
  { id: 2, item: 'Headphones', quantity: 2, total: 159.98, status: 'processing' },
  { id: 3, item: 'Keyboard', quantity: 1, total: 89.99, status: 'delivered' },
  { id: 4, item: 'Monitor', quantity: 1, total: 449.00, status: 'shipped' },
];

app.get('/orders', (_req, res) => {
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`Orders service listening on port ${PORT}`);
});

export default app;
