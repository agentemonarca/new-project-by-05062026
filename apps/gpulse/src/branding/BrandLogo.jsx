import React, { memo, useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BRAND } from './brand.js';

/** @type {Record<string, string>} */
const SIZE_MAP = {
  xs: 'h-7 w-7 min-h-[1.75rem] min-w-[1.75rem]',
  sm: 'h-8 w-8 min-h-8 min-w-8',
  md: 'h-9 w-9 min-h-9 min-w-9',
  lg: 'h-14 w-14 min-h-14 min-w-14',
  xl: 'h-16 w-16 min-h-16 min-w-16',
  /** Premium / hero surfaces (onboarding, splash) */
  hero: 'h-28 w-28 min-h-[7rem] min-w-[7rem] sm:h-32 sm:w-32 sm:min-h-32 sm:min-w-32',
};

/**
 * Product mark with img fallback (broken asset → Sparkles).
 *
 * @param {{
 *   size?: 'xs'|'sm'|'md'|'lg'|'xl'|'hero',
 *   framed?: boolean,
 *   className?: string,
 *   imgClassName?: string,
 *   alt?: string,
 * }} props
 */
function BrandLogoInner({
  size = 'md',
  framed = true,
  className = '',
  imgClassName = '',
  alt,
}) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const dim = SIZE_MAP[size] ?? SIZE_MAP.md;
  const resolvedAlt = alt ?? BRAND.icon.alt;

  if (failed) {
    return (
      <span
        className={`${framed ? BRAND.shell.iconFrame : ''} ${dim} ${className}`.trim()}
        aria-hidden={resolvedAlt === ''}
        title={BRAND.name}
      >
        <Sparkles className="m-auto h-[45%] w-[45%]" strokeWidth={2} />
      </span>
    );
  }

  const img = (
    <img
      src={BRAND.icon.src}
      alt={resolvedAlt}
      width={256}
      height={256}
      decoding="async"
      loading="lazy"
      onError={onError}
      className={`object-contain ${framed ? 'h-full w-full' : dim} ${imgClassName}`.trim()}
    />
  );

  if (!framed) {
    return (
      <span className={`inline-flex ${className}`.trim()} title={BRAND.name}>
        {img}
      </span>
    );
  }

  return (
    <span className={`${BRAND.shell.iconFrame} ${dim} overflow-hidden p-0.5 ${className}`.trim()} title={BRAND.name}>
      {img}
    </span>
  );
}

export const BrandLogo = memo(BrandLogoInner);
BrandLogo.displayName = 'BrandLogo';

/**
 * Icon + name (top bar, sidebar header).
 *
 * @param {{
 *   size?: 'xs'|'sm'|'md'|'lg'|'xl',
 *   showTagline?: boolean,
 *   className?: string,
 *   nameClassName?: string,
 *   taglineClassName?: string,
 * }} props
 */
export function BrandLockupText({
  showTagline = false,
  className = '',
  nameClassName = 'font-display text-base font-semibold tracking-tight text-white',
  taglineClassName = 'mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/90',
}) {
  return (
    <div className={className}>
      <p className={nameClassName}>{BRAND.name}</p>
      {showTagline ? <p className={taglineClassName}>{BRAND.tagline}</p> : null}
    </div>
  );
}
