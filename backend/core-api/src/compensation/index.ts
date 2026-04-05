export { loadCompensationRules, COMPENSATION_RULES_SNAPSHOT } from './config/compensation.js';
export type { CompensationRules } from './config/compensation.js';
export { createCompensationKernel } from './bootstrap.js';
export type { CompensationKernel } from './bootstrap.js';
export { createCompensationRouter } from './http/createCompensationRouter.js';
export { allocateAmountAcrossProducts, applyAllocationsToProducts } from './engines/productAllocator.js';
export { CompensationFacade } from './facade/compensationFacade.js';
export type { PurchaseInput } from './facade/compensationFacade.js';
