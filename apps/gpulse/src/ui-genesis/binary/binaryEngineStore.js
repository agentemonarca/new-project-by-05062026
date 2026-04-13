import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyBinaryFlash,
  binaryBonusFromMatch,
  binaryMatchVolume,
  consumeMatchedVolume,
} from './binaryEngine.js';
import { nextOpaqueId } from '../../utils/gpulseRngPolicy.js';

const MAX_HISTORY = 400;

/**
 * @typedef {{ type: 'BINARY_MATCH' | 'BINARY_CONSUMPTION' | 'BINARY_FLASH', ts: number, payload: Record<string, unknown> }} BinaryHistoryEvent
 */

function monthKeyUtc(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function appendHistory(prev, entry) {
  const next = [entry, ...(prev || [])];
  return next.slice(0, MAX_HISTORY);
}

/**
 * Ingest API legs: first snapshot replaces; later calls add only positive deltas per leg.
 * @param {{ leftPoints: number, rightPoints: number, lastApiLeft: number | null, lastApiRight: number | null }} s
 * @param {number} apiLeft
 * @param {number} apiRight
 */
function ingestApiSnapshot(s, apiLeft, apiRight) {
  const aL = Math.max(0, Number(apiLeft) || 0);
  const aR = Math.max(0, Number(apiRight) || 0);
  if (s.lastApiLeft == null || s.lastApiRight == null) {
    return {
      ...s,
      leftPoints: aL,
      rightPoints: aR,
      lastApiLeft: aL,
      lastApiRight: aR,
    };
  }
  const dL = Math.max(0, aL - s.lastApiLeft);
  const dR = Math.max(0, aR - s.lastApiRight);
  return {
    ...s,
    leftPoints: Math.max(0, s.leftPoints + dL),
    rightPoints: Math.max(0, s.rightPoints + dR),
    lastApiLeft: aL,
    lastApiRight: aR,
  };
}

export const useBinaryEngineStore = create(
  persist(
    (set, get) => ({
      leftPoints: 0,
      rightPoints: 0,
      lastApiLeft: null,
      lastApiRight: null,
      /** YYYY-MM (UTC) last time user/session saw the engine; month change ⇒ one flash */
      lastOpenedMonthUtc: null,

      /** @type {BinaryHistoryEvent[]} */
      eventHistory: [],

      /** Sync legs from network API (full replace + snapshot). */
      resetLegsFromApi(apiLeft, apiRight) {
        const aL = Math.max(0, Number(apiLeft) || 0);
        const aR = Math.max(0, Number(apiRight) || 0);
        set({
          leftPoints: aL,
          rightPoints: aR,
          lastApiLeft: aL,
          lastApiRight: aR,
        });
      },

      ingestApiUpdate(apiLeft, apiRight) {
        set((s) => ingestApiSnapshot(s, apiLeft, apiRight));
      },

      /** After local match, align API snapshot so unchanged server totals don’t re-add volume. */
      alignApiSnapshotToLegs() {
        set((s) => ({
          ...s,
          lastApiLeft: s.leftPoints,
          lastApiRight: s.rightPoints,
        }));
      },

      clearHistory() {
        set({ eventHistory: [] });
      },

      executeMatch() {
        const s = get();
        const ts = Date.now();
        const nonce = nextOpaqueId('bn').slice(-12);
        const leftBefore = s.leftPoints;
        const rightBefore = s.rightPoints;
        const match = binaryMatchVolume(leftBefore, rightBefore);
        if (match <= 0) return { ok: false, match: 0 };

        const earnings = binaryBonusFromMatch(match);
        const consumed = consumeMatchedVolume(leftBefore, rightBefore, match);

        const matchEvent = {
          type: 'BINARY_MATCH',
          ts,
          payload: {
            matchedVolume: match,
            earnings,
            leftBefore,
            rightBefore,
            nonce,
          },
        };
        const consumptionEvent = {
          type: 'BINARY_CONSUMPTION',
          ts: ts + 1,
          payload: {
            leftBefore,
            rightBefore,
            matchVolume: consumed.matched,
            leftAfter: consumed.left,
            rightAfter: consumed.right,
            nonce,
          },
        };

        set((prev) => ({
          ...prev,
          leftPoints: consumed.left,
          rightPoints: consumed.right,
          lastApiLeft: consumed.left,
          lastApiRight: consumed.right,
          eventHistory: appendHistory(appendHistory(prev.eventHistory, matchEvent), consumptionEvent),
        }));

        return { ok: true, match, earnings, leftAfter: consumed.left, rightAfter: consumed.right };
      },

      applyMonthlyFlashNow() {
        const s = get();
        const ts = Date.now();
        const nonce = nextOpaqueId('bn').slice(-12);
        const out = applyBinaryFlash(s.leftPoints, s.rightPoints);
        const flashEvent = {
          type: 'BINARY_FLASH',
          ts,
          payload: {
            leftBefore: out.leftBefore,
            rightBefore: out.rightBefore,
            leftAfter: out.leftAfter,
            rightAfter: out.rightAfter,
            lostLeft: out.lostLeft,
            lostRight: out.lostRight,
            nonce,
          },
        };
        set((prev) => ({
          ...prev,
          leftPoints: out.leftAfter,
          rightPoints: out.rightAfter,
          lastApiLeft: out.leftAfter,
          lastApiRight: out.rightAfter,
          eventHistory: appendHistory(prev.eventHistory, flashEvent),
        }));
        return out;
      },

      /**
       * When UTC calendar month changes since last open, apply flash once (end-of-month rule).
       */
      tickMonthFlashIfNeeded() {
        const m = monthKeyUtc();
        const last = get().lastOpenedMonthUtc;
        if (last == null) {
          set({ lastOpenedMonthUtc: m });
          return { applied: false };
        }
        if (last === m) return { applied: false };
        get().applyMonthlyFlashNow();
        set({ lastOpenedMonthUtc: m });
        return { applied: true };
      },

      /** Manual / QA: halve legs and pin month cursor so tick won’t double-fire. */
      applyFlashForDemo() {
        get().applyMonthlyFlashNow();
        set({ lastOpenedMonthUtc: monthKeyUtc() });
      },

      /**
       * Credit binary legs with purchase volume (100% of USDT equivalent on weaker side).
       * @param {number} usdtEquivalent
       * @param {{ product?: string }} [meta]
       */
      applyPurchaseBinaryVolume(usdtEquivalent, meta = {}) {
        const pts = Math.max(0, Number(usdtEquivalent) || 0);
        if (pts <= 0) return { ok: false, pts: 0 };
        const ts = Date.now();
        const nonce = nextOpaqueId('bn').slice(-12);
        set((prev) => {
          const left = prev.leftPoints;
          const right = prev.rightPoints;
          const useLeft = left <= right;
          const nextL = useLeft ? left + pts : left;
          const nextR = useLeft ? right : right + pts;
          const evt = {
            type: 'BINARY_PURCHASE_VOLUME',
            ts,
            payload: {
              points: pts,
              leg: useLeft ? 'left' : 'right',
              leftBefore: left,
              rightBefore: right,
              leftAfter: nextL,
              rightAfter: nextR,
              product: meta.product ?? null,
              source: meta.source ?? 'activation',
              purchaseId: meta.purchaseId ?? null,
              marketplaceStakingRule: Boolean(meta.marketplaceStakingRule),
              productLabel: meta.productLabel ?? null,
              totalAigValueBasis: meta.totalAigValueBasis != null ? Number(meta.totalAigValueBasis) : null,
              nonce,
            },
          };
          return {
            ...prev,
            leftPoints: nextL,
            rightPoints: nextR,
            lastApiLeft: nextL,
            lastApiRight: nextR,
            eventHistory: appendHistory(prev.eventHistory, evt),
          };
        });
        return { ok: true, pts };
      },
    }),
    {
      name: 'genesis-binary-engine-v1',
      partialize: (s) => ({
        leftPoints: s.leftPoints,
        rightPoints: s.rightPoints,
        lastApiLeft: s.lastApiLeft,
        lastApiRight: s.lastApiRight,
        lastOpenedMonthUtc: s.lastOpenedMonthUtc,
        eventHistory: s.eventHistory,
      }),
    },
  ),
);
