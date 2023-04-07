import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './routers';

export const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:4000/trpc',
    }),
  ],
  transformer: undefined
});

async function main() {
  const userWithId = await client.user.getUserById.query(55);

  const allUsers = await client.user.getAllUsers.query();
}

void main();