import { Router } from 'express';

export function authRoutes({ authController }) {
  const router = Router();

  router.post('/auth/request-message', authController.requestMessage);
  router.post('/auth/verify-signature', authController.verifySignature);

  return router;
}

