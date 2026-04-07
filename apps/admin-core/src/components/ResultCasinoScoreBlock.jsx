import { normSide } from '../utils/signalFormatter.js';

/**
 * @param {string[] | null | undefined} cards
 */
function cardsBracket(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  return `[${cards.join(', ')}]`;
}

/**
 * @param {{ puntaje_player: string | null, puntaje_banker: string | null, cartas_player: string[] | null, cartas_banker: string[] | null, ganador: string | null } | null | undefined} sd
 */
function hasNumericScores(sd) {
  if (!sd) return false;
  const pp = sd.puntaje_player != null && String(sd.puntaje_player).trim() !== '';
  const pb = sd.puntaje_banker != null && String(sd.puntaje_banker).trim() !== '';
  return pp || pb;
}

/** @param {string | null | undefined} side */
function winnerEmoji(side) {
  const n = normSide(side);
  if (n === 'PLAYER') return '🔵';
  if (n === 'BANKER') return '🔴';
  if (n === 'TIE') return '🤝';
  return '';
}

/**
 * Bloque estilo mesa: manos PLAYER/BANKER y ganador.
 * Si no hay puntajes numéricos, solo etiquetas PLAYER / BANKER (sin flecha).
 *
 * @param {{
 *   scoreDetail: { puntaje_player: string | null, puntaje_banker: string | null, cartas_player: string[] | null, cartas_banker: string[] | null, ganador: string | null } | null | undefined,
 *   ganador?: string | null,
 *   className?: string,
 *   compact?: boolean
 * }} props
 */
export default function ResultCasinoScoreBlock({ scoreDetail, ganador: ganadorProp, className = '', compact = false }) {
  const sd = scoreDetail && typeof scoreDetail === 'object' ? scoreDetail : null;
  const ganador = normSide(ganadorProp ?? sd?.ganador ?? '—');
  const showScores = hasNumericScores(sd);

  const pCards = cardsBracket(sd?.cartas_player);
  const bCards = cardsBracket(sd?.cartas_banker);
  const pScore = sd?.puntaje_player != null && String(sd.puntaje_player).trim() !== '' ? String(sd.puntaje_player) : null;
  const bScore = sd?.puntaje_banker != null && String(sd.puntaje_banker).trim() !== '' ? String(sd.puntaje_banker) : null;

  const handLine = (cardsStr, score) => {
    if (cardsStr && showScores && score != null) return `${cardsStr} → ${score}`;
    if (cardsStr) return cardsStr;
    if (showScores && score != null) return `→ ${score}`;
    return null;
  };

  const playerLine = handLine(pCards, pScore);
  const bankerLine = handLine(bCards, bScore);

  const textMain = compact ? 'text-[9px]' : 'text-[10px]';
  const textLabel = compact ? 'text-[8px]' : 'text-[9px]';
  const textWinner = compact ? 'text-[10px]' : 'text-[11px]';

  return (
    <div className={`rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1.5 font-mono ${textMain} text-slate-200 ${className}`}>
      <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
        <div>
          <p className={`${textLabel} font-bold uppercase tracking-wider text-sky-400/90`}>Player</p>
          {playerLine ? (
            <p className="mt-0.5 text-slate-100">{playerLine}</p>
          ) : (
            <p className={`mt-0.5 ${showScores ? 'text-slate-500' : 'text-slate-400'}`}>PLAYER</p>
          )}
        </div>
        <div>
          <p className={`${textLabel} font-bold uppercase tracking-wider text-rose-400/90`}>Banker</p>
          {bankerLine ? (
            <p className="mt-0.5 text-slate-100">{bankerLine}</p>
          ) : (
            <p className={`mt-0.5 ${showScores ? 'text-slate-500' : 'text-slate-400'}`}>BANKER</p>
          )}
        </div>
      </div>
      <div className={`mt-1.5 border-t border-white/[0.06] pt-1.5 ${textWinner} font-bold uppercase tracking-wide`}>
        <span className="text-slate-500">Ganador · </span>
        <span
          className={
            ganador === 'PLAYER' ? 'text-sky-300' : ganador === 'BANKER' ? 'text-rose-300' : ganador === 'TIE' ? 'text-amber-200' : 'text-slate-300'
          }
        >
          {ganador !== '—' ? ganador : '—'}
        </span>
        {ganador !== '—' ? <span className="ml-1">{winnerEmoji(ganador)}</span> : null}
      </div>
    </div>
  );
}
