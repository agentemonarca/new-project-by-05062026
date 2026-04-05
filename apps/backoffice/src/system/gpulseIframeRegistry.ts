/**
 * Holds the active G-Pulse iframe contentWindow so control events can be delivered
 * even when the relay component is mounted outside GPulseWrapper.
 */

let gpulseContentWindow: Window | null = null;

export function setGpulseIframeTarget(win: Window | null): void {
  gpulseContentWindow = win;
}

export function getGpulseIframeTarget(): Window | null {
  return gpulseContentWindow;
}
