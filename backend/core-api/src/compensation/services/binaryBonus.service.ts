import { randomUUID } from 'node:crypto';
import type { CompensationRules } from '../config/compensation.js';
import type { BinaryNode, BinarySide, UserId, VolumePoint } from '../domain/types.js';

function monthKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Binary tree + monthly left/right volume (legacy repartirPuntos + claimMonthUserPoints).
 */
export class BinaryBonusService {
  private readonly nodes = new Map<UserId, BinaryNode>();
  private readonly volumePoints: VolumePoint[] = [];

  constructor(private readonly rules: CompensationRules) {}

  /** Seed first user as root (legacy: father = self). */
  ensureRoot(userId: UserId): void {
    if (this.nodes.has(userId)) return;
    this.nodes.set(userId, {
      userId,
      fatherId: null,
      sideFromFather: null,
      childrenLeft: null,
      childrenRight: null,
      depth: 0,
    });
  }

  getNode(userId: UserId): BinaryNode | undefined {
    return this.nodes.get(userId);
  }

  /**
   * Place `newUserId` under sponsor's leg; spill along extreme left or right until free slot (legacy addBinary).
   */
  placeUser(newUserId: UserId, sponsorId: UserId, side: BinarySide): void {
    if (this.nodes.size === 0) {
      this.nodes.set(newUserId, {
        userId: newUserId,
        fatherId: newUserId,
        sideFromFather: null,
        childrenLeft: null,
        childrenRight: null,
        depth: 0,
      });
      return;
    }

    const sponsor = this.nodes.get(sponsorId);
    if (!sponsor) {
      this.ensureRoot(sponsorId);
    }

    const father = this.nodes.get(sponsorId)!;
    const leg: 'childrenLeft' | 'childrenRight' = side === 1 ? 'childrenLeft' : 'childrenRight';

    if (father[leg] === null || father[leg] === undefined) {
      this.attachChild(father.userId, newUserId, side);
      return;
    }

    let cursor = this.nodes.get(father[leg] as string)!;
    const walk: 'childrenLeft' | 'childrenRight' = side === 1 ? 'childrenLeft' : 'childrenRight';
    while (cursor[walk] != null) {
      cursor = this.nodes.get(cursor[walk] as string)!;
    }
    this.attachChild(cursor.userId, newUserId, side);
  }

  private attachChild(fatherId: UserId, childId: UserId, side: BinarySide): void {
    const father = this.nodes.get(fatherId);
    if (!father) return;
    const leg = side === 1 ? 'childrenLeft' : 'childrenRight';
    if (father[leg] != null) throw new Error('binary_slot_occupied');
    father[leg] = childId;
    this.nodes.set(childId, {
      userId: childId,
      fatherId,
      sideFromFather: side,
      childrenLeft: null,
      childrenRight: null,
      depth: father.depth + 1,
    });
    this.nodes.set(fatherId, { ...father });
  }

  /**
   * Walk up `depth` steps: for each upline with both children, add volume to left or right points (legacy repartirPuntos).
   */
  distributeVolumeFromPurchase(buyerId: UserId, volume: number, nowMs: number): void {
    const mk = monthKeyFromMs(nowMs);
    let current: BinaryNode | undefined = this.nodes.get(buyerId);
    if (!current) return;
    const steps = current.depth;

    for (let i = 0; i < steps; i++) {
      const fid = current.fatherId;
      if (fid == null) break;
      const father: BinaryNode | undefined = this.nodes.get(fid);
      if (!father || father.userId === buyerId) break;

      if (father.childrenLeft != null && father.childrenRight != null) {
        const userCheckLeft = father.childrenLeft === current.userId;
        const leg: BinarySide = userCheckLeft ? 1 : 2;
        this.addPoint(father.userId, leg, volume, mk, nowMs);
      }
      current = father;
    }
  }

  private addPoint(userId: UserId, leg: BinarySide, volume: number, monthKey: string, nowMs: number): void {
    this.volumePoints.push({
      id: randomUUID(),
      userId,
      leg,
      points: volume,
      remaind: volume,
      monthKey,
      createdAtMs: nowMs,
    });
  }

  /** Whether user can claim binary (both legs filled). */
  canClaimBinary(userId: UserId): boolean {
    const n = this.nodes.get(userId);
    if (!n) return false;
    return n.childrenLeft != null && n.childrenRight != null;
  }

  /**
   * Weaker-leg monthly payout: 11% * min(remaind left, remaind right) logic from legacy:
   * - if left > right: reward = rightSum * binaryBonus (consume right)
   * - if right > left: reward = leftSum * binaryBonus
   * - if tie: reward = leftSum * binaryBonus (all remaind cleared)
   */
  computeMonthlyBinaryReward(userId: UserId, monthKey: string): { reward: number; case: 'left' | 'right' | 'tie' } {
    const leftRows = this.volumePoints.filter((p) => p.userId === userId && p.monthKey === monthKey && p.leg === 1);
    const rightRows = this.volumePoints.filter((p) => p.userId === userId && p.monthKey === monthKey && p.leg === 2);

    let totalLeft = 0;
    let totalRight = 0;
    for (const r of leftRows) totalLeft += r.remaind;
    for (const r of rightRows) totalRight += r.remaind;

    const bb = this.rules.binaryBonus;
    if (totalLeft > totalRight) {
      return { reward: Math.round(totalRight * bb * 1e8) / 1e8, case: 'left' };
    }
    if (totalRight > totalLeft) {
      return { reward: Math.round(totalLeft * bb * 1e8) / 1e8, case: 'right' };
    }
    return { reward: Math.round(totalLeft * bb * 1e8) / 1e8, case: 'tie' };
  }

  clearMonthRemaindersAfterPayout(userId: UserId, monthKey: string, kind: 'left' | 'right' | 'tie'): void {
    const rows = this.volumePoints.filter((p) => p.userId === userId && p.monthKey === monthKey);
    for (const p of rows) {
      if (kind === 'tie') {
        p.remaind = 0;
        continue;
      }
      if (kind === 'left' && p.leg === 2) p.remaind = 0;
      if (kind === 'right' && p.leg === 1) p.remaind = 0;
    }
  }

  /** Discount weaker leg remainder from stronger side rows (legacy discountPoints simplified). */
  discountStrongerLeg(userId: string, monthKey: string, kind: 'left' | 'right'): void {
    const weakerLeg = kind === 'left' ? 2 : 1;
    const strongerLeg = kind === 'left' ? 1 : 2;

    let weaker = 0;
    for (const p of this.volumePoints) {
      if (p.userId === userId && p.monthKey === monthKey && p.leg === weakerLeg) weaker += p.remaind;
    }

    let toConsume = weaker;
    const strongRows = this.volumePoints.filter(
      (p) => p.userId === userId && p.monthKey === monthKey && p.leg === strongerLeg,
    );
    for (const row of strongRows) {
      if (toConsume <= 0) break;
      if (row.remaind <= toConsume) {
        toConsume -= row.remaind;
        row.remaind = 0;
      } else {
        row.remaind -= toConsume;
        toConsume = 0;
      }
    }
  }

  snapshotNetwork(userId: UserId): { node: BinaryNode | undefined; leftMonth: number; rightMonth: number } {
    const mk = monthKeyFromMs(Date.now());
    const n = this.nodes.get(userId);
    let left = 0;
    let right = 0;
    for (const p of this.volumePoints) {
      if (p.userId !== userId || p.monthKey !== mk) continue;
      if (p.leg === 1) left += p.remaind;
      else right += p.remaind;
    }
    return { node: n, leftMonth: left, rightMonth: right };
  }

  exportSnapshot(): { nodes: BinaryNode[]; volumePoints: VolumePoint[] } {
    return {
      nodes: [...this.nodes.values()].map((n) => ({ ...n })),
      volumePoints: this.volumePoints.map((p) => ({ ...p })),
    };
  }

  hydrateSnapshot(snapshot: { nodes: BinaryNode[]; volumePoints: VolumePoint[] }): void {
    this.nodes.clear();
    this.volumePoints.length = 0;
    for (const n of snapshot.nodes ?? []) {
      this.nodes.set(n.userId, { ...n });
    }
    for (const p of snapshot.volumePoints ?? []) {
      this.volumePoints.push({ ...p });
    }
  }
}
