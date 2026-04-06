import { useCallback, useMemo } from 'react';
import { useP2PConfigStore } from '../store/p2pConfigStore.js';
import { useP2POrdersStore } from '../store/p2pOrdersStore.js';

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
  const mockUser = useP2POrdersStore((s) => s.mockUser);
  const orders = useP2POrdersStore((s) => s.orders);
  const usage = useP2POrdersStore((s) => s.usage);

  const ownedOpenCount = useMemo(
    () => orders.filter((o) => o.status === 'open' && o.owned).length,
    [orders],
  );

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
      if (rules.requireProfile && !mockUser.hasProfile) {
        return { ok: false, message: 'Completa tu perfil para operar en P2P' };
      }
      if (side === 'sell' && rules.requireMiningToSell && !mockUser.hasMining) {
        return { ok: false, message: 'Se requiere minería activa para publicar ventas' };
      }
      return { ok: true, message: '' };
    },
    [config.rules, mockUser.hasProfile, mockUser.hasMining],
  );

  const validateLimits = useCallback(
    (side, amountAig) => {
      const a = num(amountAig);
      if (!Number.isFinite(a) || a <= 0) return { ok: false, message: 'Cantidad no válida' };

      const { maxOrdersPerUser, maxDailyOrders, maxWeeklyOrders, maxMonthlyOrders } = config.limits ?? {};
      const { maxBuyPerDay, maxSellPerDay } = config.volume ?? {};

      if (ownedOpenCount >= (Number(maxOrdersPerUser) ?? 10)) {
        return {
          ok: false,
          message: `Límite de órdenes activas (${maxOrdersPerUser}) alcanzado`,
        };
      }
      if (usage.dailyCount >= (Number(maxDailyOrders) ?? 5)) {
        return { ok: false, message: `Límite diario de órdenes (${maxDailyOrders}) alcanzado` };
      }
      if (usage.weeklyCount >= (Number(maxWeeklyOrders) ?? 20)) {
        return { ok: false, message: `Límite semanal de órdenes (${maxWeeklyOrders}) alcanzado` };
      }
      if (usage.monthlyCount >= (Number(maxMonthlyOrders) ?? 60)) {
        return { ok: false, message: `Límite mensual de órdenes (${maxMonthlyOrders}) alcanzado` };
      }

      if (side === 'buy') {
        const cap = Number(maxBuyPerDay) ?? 50_000;
        if (usage.buyDayAig + a > cap) {
          return { ok: false, message: `Volumen compra diario superaría ${cap} AIG` };
        }
      } else {
        const cap = Number(maxSellPerDay) ?? 50_000;
        if (usage.sellDayAig + a > cap) {
          return { ok: false, message: `Volumen venta diario superaría ${cap} AIG` };
        }
      }

      return { ok: true, message: '' };
    },
    [config.limits, config.volume, ownedOpenCount, usage],
  );

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
