/**
 * Parse provider card tokens (e.g. rank-only "K", "8") for neon card face display.
 * Suits are synthetic for UI when not present (baccarat relay often sends rank only).
 */

const RED_SUITS = ['♥', '♦'];
const BLACK_SUITS = ['♠', '♣'];

/**
 * @param {unknown} raw
 * @param {number} slotIndex — stable suit/color alternation
 * @returns {{ displayRank: string, suit: string, isRed: boolean, raw: string }}
 */
export function parseBaccaratCardToken(raw, slotIndex = 0) {
  const s = raw == null ? '' : String(raw).trim();
  if (!s) {
    return { displayRank: '?', suit: '♠', isRed: false, raw: '' };
  }

  const upper = s.toUpperCase();
  let displayRank = s;
  let suit = '';
  let isRed = false;

  const suitMatch = /([♥♦♠♣HDSC])$/u.exec(s) || /\b(H|D|S|C)\b/i.exec(s);
  if (suitMatch) {
    const sym = suitMatch[1];
    if (sym === '♥' || sym === '♦' || sym === 'H' || sym === 'D') {
      suit = sym === 'H' || sym === 'D' ? (sym === 'H' ? '♥' : '♦') : sym;
      isRed = true;
    } else {
      suit = sym === 'S' ? '♠' : sym === 'C' ? '♣' : sym;
      isRed = false;
    }
    displayRank = s.replace(/[♥♦♠♣HDSC]|\b(H|D|S|C)\b/gi, '').trim();
  }

  if (!displayRank) displayRank = s;

  const rankNorm = displayRank.replace(/^10$/i, '10').replace(/^T$/i, '10');
  if (/^(A|2|3|4|5|6|7|8|9|10|J|Q|K)$/i.test(rankNorm)) {
    displayRank = rankNorm.length === 2 && rankNorm.toUpperCase() === '10' ? '10' : rankNorm.toUpperCase().replace('T', '10');
  }

  if (!suit) {
    const si = Math.abs(Number(slotIndex) || 0) % 4;
    const useRed = si % 2 === 0;
    suit = useRed ? RED_SUITS[si % 2] : BLACK_SUITS[si % 2];
    isRed = useRed;
  }

  return { displayRank, suit, isRed, raw: s };
}
