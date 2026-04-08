import { BrowserProvider } from 'ethers';
import { isWeb3MockMode } from './web3Mode.js';
import { getInjectedEthereum } from './ethereumProvider.js';

export async function connectWallet() {
  if (isWeb3MockMode()) {
    throw new Error('NO_INJECTED_WALLET');
  }
  const eth = getInjectedEthereum();
  if (!eth) throw new Error('NO_INJECTED_WALLET');

  const provider = new BrowserProvider(eth);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}
