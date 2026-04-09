let _userInteracted = false;
let _listenersInstalled = false;

function mark() {
  _userInteracted = true;
}

export function ensureUserGestureTrackingInstalled() {
  if (typeof window === 'undefined') return;
  if (_listenersInstalled) return;
  _listenersInstalled = true;
  window.addEventListener('pointerdown', mark, { capture: true, passive: true });
  window.addEventListener('keydown', mark, { capture: true, passive: true });
  window.addEventListener('touchstart', mark, { capture: true, passive: true });
}

export function hasUserInteracted() {
  return _userInteracted;
}

