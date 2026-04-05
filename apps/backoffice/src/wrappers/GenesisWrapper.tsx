import { getEnv } from '@/config/env';

/**
 * Embeds legacy Génesis without modifying its code. Target must allow framing (CORS / X-Frame-Options).
 */
export default function GenesisWrapper() {
  const { genesisOrigin } = getEnv();
  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-[#070b14]">
      <iframe
        title="Génesis Legacy"
        src={genesisOrigin}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write; payment"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
      />
    </div>
  );
}
