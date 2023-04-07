import { t } from '../trpc';
import { z } from 'zod';
import orders from '../db/orders';

const publicProcedure = t.procedure;

export const getOrderById = publicProcedure
    .input(z.number())
    .query(({ input }) => {
        return orders.filter(order => order.id === input);
    });

export const getOrderByUserId = publicProcedure
    .input(z.number())
    .query(({ input }) => {
        const userOrders = orders.filter(order => order.userId === input);
        console.log(userOrders)
        return userOrders;
    });

export const getAllOrders = publicProcedure
    .query(() => {
        return orders;
    });