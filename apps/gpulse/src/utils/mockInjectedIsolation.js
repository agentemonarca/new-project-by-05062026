import { isWeb3MockMode } from './web3Mode.js';

/** Optional chaining–friendly surface for Tron-shaped globals */
function createTronSafeSurface() {
  const handler = {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'valueOf') return () => createTronSafeSurface();
      if (prop === Symbol.iterator) return undefined;
      return createTronSafeSurface();
    },
    apply() {
      return Promise.resolve(undefined);
    },
    construct() {
      return createTronSafeSurface();
    },
  };
  return new Proxy(
    function () {},
    /** @type {ProxyHandler<typeof Function.prototype>} */ (handler),
  );
}

const TRON_WINDOW_KEYS = ['tronLink', 'tronWeb', 'tron'];

function installTronGlobals(win) {
  if (import.meta.env?.VITE_DISABLE_TRON_SHIELD === '1') return;
  const safe = createTronSafeSurface();
  for (const key of TRON_WINDOW_KEYS) {
    try {
      try {
        Reflect.deleteProperty(win, key);
      } catch {
        /* ignore */
      }
      Object.defineProperty(win, key, {
        configurable: true,
        enumerable: true,
        get() {
          return safe;
        },
        set() {},
      });
    } catch {
      /* ignore */
    }
  }
}

function installEthereumUndefined(win) {
  if (import.meta.env?.VITE_MOCK_ALLOW_INJECTED_ETHEREUM === '1') return;
  try {
    Reflect.deleteProperty(win, 'ethereum');
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(win, 'ethereum', {
      configurable: true,
      enumerable: true,
      get() {
        return undefined;
      },
      set() {},
    });
  } catch {
    /* ignore */
  }
}

/**
 * Mock mode: neutralize injected Tron globals; optionally hide `window.ethereum`
 * (see VITE_MOCK_ALLOW_INJECTED_ETHEREUM) so the app does not touch real providers.
 */
export function installMockInjectedProviderIsolation() {
  if (typeof window === 'undefined') return;
  if (import.meta.env?.VITE_DISABLE_MOCK_INJECTED_ISOLATION === '1') return;
  if (!isWeb3MockMode()) return;
  installTronGlobals(window);
  installEthereumUndefined(window);
}

/** @deprecated Use {@link installMockInjectedProviderIsolation} */
export function installTronLinkMockShield() {
  installMockInjectedProviderIsolation();
}
