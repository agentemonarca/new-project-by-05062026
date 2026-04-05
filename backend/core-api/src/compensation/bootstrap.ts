import { loadCompensationRules } from './config/compensation.js';
import { createCompensationFacade } from './facade/compensationFacade.js';
import type { PersistedCompensationStateV1 } from './domain/persistence.js';
import { PayoutService } from './services/payout.service.js';
import type { PayoutTxHashRegistry } from './services/payoutTxRegistry.js';

export type CompensationKernel = {
  facade: ReturnType<typeof createCompensationFacade>;
  rules: ReturnType<typeof loadCompensationRules>;
};

/**
 * Wire rules, whitelist, optional payout execution hook, and durable state restore.
 */
export function createCompensationKernel(options?: {
  onExecutePayout?: import('./services/payout.service.js').PayoutExecuteFn;
  persistedState?: PersistedCompensationStateV1 | null;
  onPersistCompensationState?: (s: PersistedCompensationStateV1) => Promise<void>;
  audit?: (event: string, meta: Record<string, unknown>) => void;
  payoutTxRegistry?: PayoutTxHashRegistry;
}): CompensationKernel {
  const rules = loadCompensationRules();
  const wl = new Set(
    String(process.env.COMP_WHITELIST || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const payoutInit =
    options?.persistedState?.payouts?.records && options.persistedState.payouts.records.length
      ? { records: options.persistedState.payouts.records }
      : undefined;

  const box: { facade?: ReturnType<typeof createCompensationFacade> } = {};

  const payout = new PayoutService(
    {
      isWhitelisted: (uid) => wl.has(String(uid).toLowerCase()),
      onExecute: options?.onExecutePayout,
      txRegistry: options?.payoutTxRegistry,
      onAfterPayoutRecordChange: async () => {
        const f = box.facade;
        if (f && options?.onPersistCompensationState) {
          await options.onPersistCompensationState(f.exportState());
        }
      },
    },
    payoutInit,
  );

  const facade = createCompensationFacade(rules, payout, {
    persisted: options?.persistedState ?? undefined,
    onPersistState: options?.onPersistCompensationState,
    audit: options?.audit,
  });
  box.facade = facade;
  return { facade, rules };
}
