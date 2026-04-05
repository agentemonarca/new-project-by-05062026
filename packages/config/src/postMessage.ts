/**
 * Cross-origin messages between Backoffice and embedded G-Pulse.
 */

export const MESSAGE_SOURCE_BACKOFFICE = 'ai-genesis-backoffice' as const;
export const MESSAGE_SOURCE_GPULSE = 'ai-genesis-gpulse' as const;

export const MessageType = {
  AUTH_SYNC: 'AUTH_SYNC',
  PING: 'PING',
  PONG: 'PONG',
  /** Backoffice → G-Pulse control plane (engine / strategy / safety). */
  CONTROL: 'CONTROL',
} as const;

export type MessageTypeName = (typeof MessageType)[keyof typeof MessageType];
