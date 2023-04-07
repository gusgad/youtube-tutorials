import { t } from '../trpc';
import { z } from 'zod';
import users from '../db/users';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const publicProcedure = t.procedure;

export const orderServiceClient = createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/trpc',
      }),
    ],
    transformer: undefined
});

export const getUserById = publicProcedure
    .input(z.number())
    .query(async ({ input }) => {
        const orders = await orderServiceClient.order.getOrderByUserId.query(input);

        return { user: users.filter(user => user.id === input)[0], orders };
    });

export const getAllUsers = publicProcedure
    .query(() => {
        return users;
    });