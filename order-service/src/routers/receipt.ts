import { t } from '../trpc';
import { z } from 'zod';
import orders from '../db/orders';

const publicProcedure = t.procedure;

export const getReceiptByOrderId = publicProcedure
    .input(z.number())
    .query(({ input }) => {
        return orders.filter(order => order.id === input).map(order => order.receiptUrl);
    });

export const addReceiptByOrderId = publicProcedure
    .input(z.object({ id: z.number(), receiptUrl: z.string() }))
    .mutation(({ input }) => {
        const newOrders = orders.map(order => {
            if (order.id === input.id) {
                order.receiptUrl = input.receiptUrl;
            }

            return order;
        });

        return newOrders;
    });