import * as ethers from 'ethers';

function badRequest(res, reason) {
  return res.status(400).json({ success: false, reason });
}

export function createAuthController({ logger, authService }) {
  return {
    /**
     * POST /api/auth/request-message
     * Returns: { success: true, message }
     */
    async requestMessage(_req, res) {
      const body = _req?.body || {};
      const addressRaw = body?.address;
      let address;
      try {
        address = ethers.getAddress(String(addressRaw || ''));
      } catch {
        return badRequest(res, 'INVALID_ADDRESS');
      }
      const message = authService.buildChallengeMessage(address);
      logger.info('auth request-message', { address });
      return res.json({ success: true, message });
    },

    /**
     * POST /api/auth/verify-signature
     * Body: { address, signature, message }
     * Returns: { success: true, token, address }
     */
    async verifySignature(req, res) {
      const body = req?.body || {};
      const addressRaw = body?.address;
      const signature = body?.signature;
      const message = body?.message;

      let address;
      try {
        address = ethers.getAddress(String(addressRaw || ''));
      } catch {
        return badRequest(res, 'INVALID_ADDRESS');
      }
      if (!signature || !message) return badRequest(res, 'MISSING_FIELDS');

      try {
        const out = authService.verifySignature({ address, signature, message });
        return res.json({ success: true, token: out.token, address: out.address });
      } catch (e) {
        logger.warn('auth verify-signature failed', { address, reason: e?.message, code: e?.code });
        if (e?.code === 'NONCE_MISMATCH') {
          return res.status(401).json({ success: false, reason: 'NONCE_MISMATCH' });
        }
        return res.status(401).json({ success: false, reason: 'INVALID_SIGNATURE' });
      }
    },
  };
}

