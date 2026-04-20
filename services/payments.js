import express from 'express';

const app = express();
const PORT = 3003;

app.use(express.json());

app.post('/payments', (req, res) => {
  const { amount, currency = 'USD', from, to } = req.body;
  res.status(201).json({
    confirmation_id: `PAY-${Date.now()}`,
    amount,
    currency,
    from,
    to,
    status: 'confirmed',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Payments service listening on port ${PORT}`);
});

export default app;
