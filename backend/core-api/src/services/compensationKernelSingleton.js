import { createCompensationKernel } from '../../dist/compensation/index.js';
import { PayoutTxHashRegistry } from '../../dist/compensation/services/payoutTxRegistry.js';
import { createCompensationPayoutExecutor } from './compensationPayoutExecutor.js';
import { loadCompensationState, saveCompensationState } from '../utils/compensationStateStore.js';
import { getValidatedPayoutWeiPerUsdt } from '../utils/payoutRateConfig.js';

let kernel = null;

/**
 * @param {{ signerService: object | null, logger: object }} deps
 */
export async function initCompensationKernel(deps) {
  if (kernel) return kernel;
  const { signerService, logger } = deps;

  try {
    getValidatedPayoutWeiPerUsdt();
  } catch (e) {
    logger?.warn?.('comp_payout_rate_invalid_at_boot', {
      message: e?.message,
      meta: e?.meta,
    });
  }

  let persisted;
  try {
    persisted = await loadCompensationState();
  } catch (e) {
    logger?.error?.('compensation_state_load_failed', { message: e?.message });
    throw e;
  }

  const payoutTxRegistry = new PayoutTxHashRegistry(persisted?.payouts?.records ?? []);

  const innerExecute =
    signerService && String(process.env.COMP_PAYOUT_WEI_PER_USDT || '').trim()
      ? createCompensationPayoutExecutor({ signerService, logger })
      : async (p) => {
          logger?.warn?.('compensation_payout_no_chain', {
            payoutId: p.id,
            hint: 'Set signer + COMP_PAYOUT_WEI_PER_USDT for real payouts',
          });
          return { externalRef: `noop:${p.id}` };
        };

  let kernelRef = null;

  const onExecutePayout = async (p, ctx) => {
    const out = await innerExecute(p, ctx);
    const ref = String(out?.externalRef || '');
    const isTxHash = ref.startsWith('0x') && ref.length >= 66;
    if (isTxHash && kernelRef?.facade) {
      try {
        await kernelRef.facade.recordPayoutSettled({
          userId: p.userId,
          amount: p.amount,
          source: p.source,
          txHash: ref,
          payoutId: p.id,
        });
      } catch (e) {
        logger?.error?.('compensation_payout_ledger_settle_failed', {
          message: e?.message,
          payoutId: p.id,
          txHash: ref,
          severity: 'critical_reconcile',
        });
      }
    }
    return out;
  };

  kernelRef = createCompensationKernel({
    onExecutePayout,
    payoutTxRegistry,
    persistedState: persisted,
    onPersistCompensationState: async (s) => {
      await saveCompensationState(s);
    },
    audit: (event, meta) => logger?.info?.(event, meta),
  });
  kernel = kernelRef;
  return kernel;
}

export function getCompensationKernel() {
  return kernel;
}
