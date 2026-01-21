const request = require('supertest');
const app = require('./index');

describe('API Endpoints', () => {
  describe('GET /api/products', () => {
    test('should return all products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(6);
    });

    test('should return products with correct structure', async () => {
      const res = await request(app).get('/api/products');
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('description');
      expect(res.body[0]).toHaveProperty('price');
      expect(res.body[0]).toHaveProperty('image');
    });

    test('should contain expected product names', async () => {
      const res = await request(app).get('/api/products');
      const names = res.body.map(p => p.name);
      expect(names).toContain('Minimal Leather Bag');
      expect(names).toContain('Canvas Sneakers');
      expect(names).toContain('Ceramic Mug');
    });
  });

  describe('POST /api/checkout', () => {
    test('should successfully process checkout with valid cart', async () => {
      const cart = [
        { id: 'p1', name: 'Test Item', price: 5000, qty: 2 }
      ];
      const payment = {
        name: 'John Doe',
        email: 'john@example.com',
        address: '123 Main St'
      };

      const res = await request(app)
        .post('/api/checkout')
        .send({ cart, payment });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Payment successful');
    });

    test('should calculate correct total', async () => {
      const cart = [
        { id: 'p1', name: 'Item 1', price: 1000, qty: 2 },
        { id: 'p2', name: 'Item 2', price: 1500, qty: 1 }
      ];
      const payment = { name: 'John Doe' };

      const res = await request(app)
        .post('/api/checkout')
        .send({ cart, payment });

      // 1000*2 + 1500*1 = 3500
      expect(res.body.total).toBe(3500);
    });

    test('should reject empty cart', async () => {
      const cart = [];
      const payment = { name: 'John Doe' };

      const res = await request(app)
        .post('/api/checkout')
        .send({ cart, payment });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Cart is empty');
    });

    test('should reject missing cart', async () => {
      const payment = { name: 'John Doe' };

      const res = await request(app)
        .post('/api/checkout')
        .send({ payment });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should handle multiple items with different quantities', async () => {
      const cart = [
        { id: 'p1', name: 'Item 1', price: 2000, qty: 3 },
        { id: 'p2', name: 'Item 2', price: 1000, qty: 2 },
        { id: 'p3', name: 'Item 3', price: 500, qty: 4 }
      ];
      const payment = { name: 'Jane Doe' };

      const res = await request(app)
        .post('/api/checkout')
        .send({ cart, payment });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 2000*3 + 1000*2 + 500*4 = 6000 + 2000 + 2000 = 10000
      expect(res.body.total).toBe(10000);
    });
  });
});
