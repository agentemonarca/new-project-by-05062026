import { Router } from 'express';

export function withdrawRoutes({ withdrawalController }) {
  const router = Router();

  router.post('/request-withdraw', withdrawalController.requestWithdraw);

  return router;
}

