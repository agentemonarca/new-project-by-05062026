import { Router } from 'express';

export function depositRoutes({ depositController }) {
  const router = Router();

  router.post('/verify-deposit', depositController.verifyDeposit);

  return router;
}

