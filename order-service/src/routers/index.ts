import { t } from '../trpc';
import { getOrderById, getOrderByUserId, getAllOrders } from './order';
import { getReceiptByOrderId, addReceiptByOrderId } from './receipt';

const router = t.router;

export const appRouter = router({
  // order procedures
  order: router({
    getOrderById,
    getOrderByUserId,
    getAllOrders
  }),
  // receipt procedures
  receipt: router({
    getReceiptByOrderId,
    addReceiptByOrderId
  })
});

export type AppRouter = typeof appRouter;