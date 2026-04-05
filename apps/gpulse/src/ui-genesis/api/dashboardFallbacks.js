/** Shapes returned when API calls fail — keeps UI rendering without null deref. */
export const FALLBACK_WALLET = {
  _fallback: true,
  depositBalanceWei: '0',
  directClaimableUsdt: 0,
  ledgerNetUsdt: 0,
  sourceOfTruth: 'unavailable',
  byCategory: {},
};

export const FALLBACK_EARNINGS = {
  _fallback: true,
  entries: [],
};

export const FALLBACK_NETWORK = {
  _fallback: true,
  leftMonth: 0,
  rightMonth: 0,
};
