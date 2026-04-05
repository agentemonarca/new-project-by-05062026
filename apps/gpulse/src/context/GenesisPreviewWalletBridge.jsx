import { createContext } from 'react';

/**
 * Mirrors {@link WalletContext} values for descendants when a lazy chunk resolves
 * `WalletContext` to a different module instance than the root `WalletProvider`.
 * Parent (GenesisDesignPreview) sets this from its successful `useWallet()` result.
 */
export const GenesisPreviewWalletBridgeContext = createContext(null);
