/**
 * @deprecated Use `src/modules/onboarding/aigRef.js` (`aig_ref`). Re-exports for legacy imports.
 */
export {
  AIG_REF_KEY as INVITE_REF_STORAGE_KEY,
  getAigRef as getStoredInviteRef,
  setAigRef as setStoredInviteRef,
  formatAigRefDisplay as formatInviteDisplayName,
} from '../../modules/onboarding/aigRef.js';
