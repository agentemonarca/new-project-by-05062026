/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GENESIS_URL: string;
  readonly VITE_GPULSE_URL: string;
  readonly VITE_API_GATEWAY_URL: string;
  readonly VITE_CORE_API_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
