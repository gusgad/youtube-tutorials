import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import { appRouter } from './routers';

async function main() {
  const app = express();

  // For testing purposes, wait-on requests '/'
  app.get('/', (_req, res) => res.send('Order Service is running!'));

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter
    }),
  );
  app.listen(3000);
}

void main();