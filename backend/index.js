const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from frontend build in production
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendBuildPath));

const PRODUCTS = [
  {
    id: 'p1',
    name: 'Minimal Leather Bag',
    description: 'Handmade leather bag, perfect for everyday carry.',
    price: 12900, // cents
    image: 'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?q=80&w=1363&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 'p2',
    name: 'Canvas Sneakers',
    description: 'Lightweight canvas sneakers with comfortable sole.',
    price: 7900,
    image: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?q=80&w=1365&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 'p3',
    name: 'Ceramic Mug',
    description: 'Handcrafted ceramic mug with minimalist glaze.',
    price: 2400,
    image: 'https://images.unsplash.com/photo-1495100497150-fe209c585f50?q=80&w=2342&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 'p4',
    name: 'Wooden Watch',
    description: 'Eco-friendly wooden watch with leather band.',
    price: 9900,
    image: 'https://images.unsplash.com/photo-1592865717988-5bece8d2e225?q=80&w=2148&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 'p5',
    name: 'Linen Throw Pillow',
    description: 'Soft linen pillow in natural cream color.',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1691256676366-370303d55b61?q=80&w=1760&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 'p6',
    name: 'Wool Beanie',
    description: 'Warm merino wool beanie, perfect for winter.',
    price: 3900,
    image: 'https://images.unsplash.com/photo-1606453860825-29443dab3893?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  }
];

app.get('/api/products', (req, res) => {
  res.json(PRODUCTS);
});

app.post('/api/checkout', async (req, res) => {
  const { cart, payment } = req.body;
  // Basic validation
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty' });
  }

  // Calculate total
  const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);

  // Mock payment processing delay
  await new Promise((r) => setTimeout(r, 500));

  // Always succeed in this mock
  res.json({ success: true, message: 'Payment successful', total });
});

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;

// Only start the server if this is the main module
if (require.main === module) {
  app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`Backend running on port ${PORT} (${env})`);
  });
}

// Export app for testing
module.exports = app;
