import { useCallback, useMemo } from 'react';
import { useP2PConfigStore } from '../store/p2pConfigStore.js';
import { useGenesisDashboardStore } from '@/ui-genesis/stores/genesisDashboardStore.js';
import { getDevMockBearer } from '@/ui-genesis/api/genesisConfig.js';

/**
 * @typedef {'buy'|'sell'} P2PSide
 */

/**
 * @param {number} n
 */
function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : NaN;
}

export function useP2PValidation() {
  const config = useP2PConfigStore((s) => s.config);
  const wallet = useGenesisDashboardStore((s) => s.wallet);
  const sessionAuth = useGenesisDashboardStore((s) => s.sessionAuth);
  const authTok = useGenesisDashboardStore((s) => s.authToken);

  const effectiveUser = useMemo(() => {
    const sessionOk = Boolean(sessionAuth || authTok || getDevMockBearer());
    return {
      hasProfile: sessionOk,
      hasMining: Boolean(wallet?.miningActive),
    };
  }, [sessionAuth, authTok, wallet?.miningActive]);

  const validatePrice = useCallback(
    (price) => {
      const p = num(price);
      if (!Number.isFinite(p)) return { ok: false, message: 'Precio no válido' };
      const { minPrice, maxPrice } = config.price ?? {};
      const lo = Number(minPrice) ?? 22;
      const hi = Number(maxPrice) ?? 25;
      if (p < lo || p > hi) {
        return { ok: false, message: `El precio debe estar entre $${lo} y $${hi}` };
      }
      return { ok: true, message: '' };
    },
    [config.price],
  );

  const validateAmount = useCallback(
    (amount) => {
      const a = num(amount);
      if (!Number.isFinite(a) || a <= 0) return { ok: false, message: 'Cantidad AIG no válida' };
      const { minOrderAmount, maxOrderAmount } = config.order ?? {};
      const lo = Number(minOrderAmount) ?? 10;
      const hi = Number(maxOrderAmount) ?? 100_000;
      if (a < lo) return { ok: false, message: `Mínimo ${lo} AIG` };
      if (a > hi) return { ok: false, message: `Máximo ${hi} AIG` };
      return { ok: true, message: '' };
    },
    [config.order],
  );

  const validateUser = useCallback(
    (side) => {
      const rules = config.rules ?? {};
      if (rules.requireProfile && !effectiveUser.hasProfile) {
        return { ok: false, message: 'Inicia sesión en Genesis para operar en P2P' };
      }
      if (side === 'sell' && rules.requireMiningToSell && !effectiveUser.hasMining) {
        return {
          ok: false,
          message: 'Minería activa requerida en tu wallet para publicar ventas P2P.',
        };
      }
      return { ok: true, message: '' };
    },
    [config.rules, effectiveUser.hasMining, effectiveUser.hasProfile],
  );

  /** Límites de frecuencia/volumen los aplica el servidor. */
  const validateLimits = useCallback(() => ({ ok: true, message: '' }), []);

  const ownedOpenCount = 0;

  return useMemo(
    () => ({
      validatePrice,
      validateAmount,
      validateUser,
      validateLimits,
      ownedOpenCount,
    }),
    [validatePrice, validateAmount, validateUser, validateLimits, ownedOpenCount],
  );
}
