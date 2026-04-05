import * as ethers from 'ethers';
import crypto from 'node:crypto';

function nowMs() {
  return Date.now();
}

export function createAuthService({ logger }) {
  const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
  // address(lowercase checksum) -> nonce
  const nonces = new Map();
  // token -> { address, verifiedAt }
  const sessions = new Map();

  const normalizeAddrKey = (address) => ethers.getAddress(String(address || '')).toLowerCase();

  const extractNonce = (message) => {
    const msg = String(message || '');
    if (!msg.includes('Nonce:')) return null;
    const m = msg.match(/Nonce:\s*([0-9a-f]{32})/i);
    return m ? String(m[1]).toLowerCase() : null;
  };

  return {
    buildChallengeMessage(address) {
      const addrKey = normalizeAddrKey(address);
      const nonce = crypto.randomBytes(16).toString('hex');
      nonces.set(addrKey, nonce);
      logger.info('Auth nonce issued', { address: addrKey });
      return `Sign this message to authenticate with G-Pulse.\n\nNonce: ${nonce}`;
    },

    verifySignature({ address, signature, message }) {
      const addr = ethers.getAddress(String(address || ''));
      const addrKey = addr.toLowerCase();
      const sig = String(signature || '');
      const msg = String(message || '');

      // Strict message format + nonce check (one-time use)
      const nonceInMsg = extractNonce(msg);
      const stored = nonces.get(addrKey) || null;
      if (!nonceInMsg || !stored || nonceInMsg !== stored) {
        const err = new Error('Nonce mismatch');
        err.code = 'NONCE_MISMATCH';
        throw err;
      }

      const recovered = ethers.verifyMessage(msg, sig);
      const recoveredAddr = ethers.getAddress(recovered);
      if (recoveredAddr !== addr) {
        const err = new Error('Signature verification failed');
        err.code = 'SIGNATURE_INVALID';
        throw err;
      }

      // One-time nonce: delete after successful verification.
      nonces.delete(addrKey);

      const token = crypto.randomUUID();
      sessions.set(token, { address: addr, verifiedAt: nowMs() });
      logger.info('Wallet session verified', { address: addr, token });
      return { token, address: addr };
    },

    getSession(token) {
      const t = String(token || '');
      if (!t) return null;
      const s = sessions.get(t) || null;
      if (!s) return null;
      const age = nowMs() - (Number(s.verifiedAt) || 0);
      if (age > SESSION_TTL_MS) {
        sessions.delete(t);
        return null;
      }
      return s;
    },
  };
}

