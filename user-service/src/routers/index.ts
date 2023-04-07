import { t } from '../trpc';
import { getUserById, getAllUsers } from './user';

const router = t.router;

export const appRouter = router({
  // user procedures
  user: router({
    getUserById,
    getAllUsers
  }),
});

export type AppRouter = typeof appRouter;