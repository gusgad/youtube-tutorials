My E-commerce (Minimal)

This repo contains a small e-commerce demo with:

- `backend/` - Node.js + Express API (port 4000)
- `frontend/` - Vite + React frontend (dev server port 5173)
- Playwright E2E tests (configured to run both servers automatically)

Quick start

1. Install dependencies for root, backend, and frontend:

```bash
# in repo root
npm install
# then
cd backend && npm install
cd ../frontend && npm install
```

2. Run E2E tests (Playwright will start both servers automatically):

```bash
npx playwright test
```

3. Or run dev servers manually:

```bash
# start backend
cd backend && npm start
# in another terminal, start frontend
cd frontend && npm run dev
```

Frontend runs at http://localhost:5173, backend API at http://localhost:4000.
