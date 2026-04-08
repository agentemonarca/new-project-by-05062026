import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  Activity, BarChart2, Clock, Lock, Wallet, Sun, Moon,
  Settings, Server, Database, Crosshair, Target, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { getApiBaseUrl } from '@/ui-genesis/api/genesisConfig.js';
import {
  getExternalSignalsSocketUrl,
  isExternalSignalsBffEnabled,
  isExternalSignalsEnabled,
  resolveExternalSignalsApiKey,
} from '@/ui-genesis/lib/externalSignalsConfig.js';
import {
  normalizeNewResultPayload,
  normalizeNewSignalPayload,
} from '@/ui-genesis/lib/externalSignalsTypes.js';
import SignalIntelPanel from './SignalIntelPanel.jsx';
import { normalizeCycle } from '@/utils/signalNormalizer';
import { describeSocketEvent, engineStateLabel } from '@/utils/socketEventDescriptor.js';

const getCardValue = (val) => {
  if (['10', 'J', 'Q', 'K'].includes(val)) return 0;
  if (val === 'A') return 1;
  return parseInt(val, 10) || 0;
};

function parseBaccaratCardToken(token) {
  const str = String(token ?? '').trim();
  if (!str) return null;
  const suitMatch = str.match(/[♠♥♦♣]$/u);
  const suit = suitMatch ? suitMatch[0] : '♠';
  const val = suitMatch ? str.slice(0, -1).trim() : str;
  const isRed = suit === '♥' || suit === '♦';
  return { val, suit, isRed, value: getCardValue(val) };
}

function mergeResultPayload(rawPayload) {
  const parsed =
    typeof rawPayload === 'string' ? tryParseJson(rawPayload) ?? rawPayload : rawPayload;
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const inner =
    parsed.data != null && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
      ? parsed.data
      : {};
  const deep =
    inner.data != null && typeof inner.data === 'object' && !Array.isArray(inner.data)
      ? inner.data
      : {};
  return { ...parsed, ...inner, ...deep };
}

function resultMatchesActive(ac, pick) {
  if (!ac || ac.status != null) return false;

  if (ac.correlationKey && pick.correlationKey && ac.correlationKey !== pick.correlationKey) {
    return false;
  }
  if (ac.providerSignalId && pick.providerSignalId && ac.providerSignalId !== pick.providerSignalId) {
    return false;
  }
  if (ac.correlationKey && pick.correlationKey && ac.correlationKey === pick.correlationKey) {
    return true;
  }
  if (ac.providerSignalId && pick.providerSignalId && ac.providerSignalId === pick.providerSignalId) {
    return true;
  }

  const mesa = String(pick.mesa || '');
  const round = String(pick.round ?? pick.roundId ?? '');
  const acMesa = String(ac.mesa || '');
  const acRound = String(ac.round ?? ac.signalPayload?.round ?? ac.signalPayload?.roundId ?? '');
  if (mesa && acMesa === mesa && round && acRound === round) return true;
  if (mesa && acMesa === mesa && !round) return true;

  // Ciclo único abierto: pick ya alineado a mesa/round del ciclo en ingestResult.
  return true;
}

function tryParseJson(payload) {
  if (typeof payload !== 'string') return payload;
  const t = payload.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function winnerToLetter(winner) {
  if (winner == null || winner === '') return null;
  const u = String(winner).toUpperCase();
  if (u.includes('BANK')) return 'B';
  if (u.includes('PLAY')) return 'P';
  if (u.includes('TIE') || u.includes('EMPATE')) return 'T';
  return null;
}

function forecastTokenToLetter(x) {
  const s = String(x ?? '').toUpperCase();
  if (s.startsWith('BANK') || s === 'B') return 'B';
  if (s.startsWith('PLAY') || s === 'P') return 'P';
  const c = s.slice(0, 1);
  return c === 'B' || c === 'P' ? c : '—';
}

export default function GenesisOraclePanel() {
  const bff = isExternalSignalsBffEnabled();
  const direct = isExternalSignalsEnabled();
  const transportOk = bff || direct;

  const [engineState, setEngineState] = useState('IDLE');
  const [activeCycle, setActiveCycle] = useState(null);
  const [isCooldown, setIsCooldown] = useState(false);
  const [patternLine, setPatternLine] = useState('—');
  const [resultFlash, setResultFlash] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  const activeCycleRef = useRef(null);
  const isCooldownRef = useRef(false);
  const cooldownTimerRef = useRef(null);
  const engineTimersRef = useRef([]);
  const patternHistoryRef = useRef([]);
  const rawLogEndRef = useRef(null);
  const socketRef = useRef(null);
  const resultSafetyTimeoutRef = useRef(null);

  const clearResultSafetyTimeout = useCallback(() => {
    if (resultSafetyTimeoutRef.current != null) {
      clearTimeout(resultSafetyTimeoutRef.current);
      resultSafetyTimeoutRef.current = null;
    }
  }, []);

  const clearEngineTimers = useCallback(() => {
    engineTimersRef.current.forEach(clearTimeout);
    engineTimersRef.current = [];
  }, []);

  const pushEngineTimer = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    engineTimersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    activeCycleRef.current = activeCycle;
  }, [activeCycle]);
  useEffect(() => {
    isCooldownRef.current = isCooldown;
  }, [isCooldown]);

  useEffect(() => {
    rawLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCycle?.rawEvents, activeCycle?.id, engineState]);

  const addLog = useCallback((msg, type = 'info') => {
    console.log(`[GenesisOraclePanel/${type}]`, msg);
  }, []);

  useEffect(() => {
    console.log('ACTIVE CYCLE:', activeCycle);
    console.log('NORMALIZED:', normalizeCycle(activeCycle || {}));
  }, [activeCycle]);

  useEffect(() => {
    if (!activeCycle?.startedAt) return undefined;
    const id = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeCycle?.startedAt, activeCycle?.id]);

  const ingestResult = useCallback(
    (rawPayload, wireEvent = null) => {
      const merged = mergeResultPayload(rawPayload);
      const rRaw = normalizeNewResultPayload(merged);
      const ac = activeCycleRef.current;
      if (!ac || ac.status != null) {
        console.warn('[NEW_RESULT] ignorada · sin sesión activa o ciclo ya cerrado', {
          hasCycle: Boolean(ac),
          status: ac?.status,
        });
        addLog('NEW_RESULT ignorada (sin sesión activa)', 'warn');
        return;
      }

      const cycleMesa = String(ac.mesa || '');
      const cycleRound = String(ac.round ?? ac.signalPayload?.round ?? ac.signalPayload?.roundId ?? '');

      console.log('MATCH CHECK:', {
        signalMesa: ac.mesa,
        resultMesa: rRaw.mesa,
        signalRound: ac.round,
        resultRound: rRaw.round,
        cycleMesaAligned: cycleMesa,
        cycleRoundAligned: cycleRound,
        correlationKeySignal: ac.correlationKey,
        correlationKeyResult: rRaw.correlationKey,
      });

      const r = {
        ...rRaw,
        mesa: cycleMesa,
        round: cycleRound,
        correlationKey:
          ac.correlationKey != null && String(ac.correlationKey).trim() !== ''
            ? ac.correlationKey
            : rRaw.correlationKey,
        providerSignalId:
          ac.providerSignalId != null && String(ac.providerSignalId).trim() !== ''
            ? ac.providerSignalId
            : rRaw.providerSignalId,
      };

      if (!resultMatchesActive(ac, r)) {
        console.warn('[NEW_RESULT] ignorada · correlación', {
          cycleMesa: ac.mesa,
          cycleRound: ac.round,
          pickMesa: r.mesa,
          pickRound: r.round,
        });
        addLog('NEW_RESULT ignorada (correlación)', 'warn');
        return;
      }

      clearResultSafetyTimeout();
      clearEngineTimers();

      const resultWire =
        wireEvent != null && typeof wireEvent === 'object'
          ? wireEvent
          : { type: 'NEW_RESULT', data: merged };
      const prevRaw = Array.isArray(ac.rawEvents) ? ac.rawEvents : [];
      const nextRawEvents = [...prevRaw, resultWire];

      const settledAt = Date.now();
      let win = r.winStatus;
      const ganadorRaw =
        merged.ganador ??
        (merged.scoreDetail && typeof merged.scoreDetail === 'object' ? merged.scoreDetail.ganador : null) ??
        merged.resultado ??
        merged.result;
      if (!win && win !== false && ganadorRaw != null && ac.signal) {
        const g = String(ganadorRaw).toUpperCase();
        const bet = String(ac.signal).toUpperCase();
        if (g.includes('UNKNOWN')) win = false;
        else if (g.includes('TIE') || g.includes('EMPATE')) win = false;
        else if (g.includes('PLAYER') && bet.includes('PLAYER')) win = true;
        else if (g.includes('BANK') && bet.includes('BANK')) win = true;
        else if (g.includes('PLAYER') || g.includes('BANK')) win = false;
      }
      const status = win ? 'WIN' : 'LOSS';

      const completed = {
        id: ac.id,
        mesa: ac.mesa,
        round: ac.round,
        signal: ac.signal,
        martingale: ac.martingale,
        status,
        startedAt: ac.startedAt,
        result: win,
        settledAt,
        correlationKey: ac.correlationKey,
        providerSignalId: ac.providerSignalId,
        rawSignal: ac.rawSignal,
        signalPayload: ac.signalPayload,
        rawEvents: nextRawEvents,
      };

      setActiveCycle(completed);
      console.log('✅ CICLO CERRADO');

      const side = String(ac.signalPayload?.recommendation || ac.signal || '')
        .toUpperCase()
        .includes('BANK')
        ? 'BANKER'
        : 'PLAYER';
      patternHistoryRef.current = [...patternHistoryRef.current, side].slice(-16);
      setPatternLine(patternHistoryRef.current.slice(-3).join(' → ') || '—');

      addLog(`NEW_RESULT ${status} mesa=${ac.mesa} win=${win}`, 'info');

      pushEngineTimer(() => {
        setEngineState('RESULT_RECEIVED');
        setResultFlash(status);
      }, 0);
      pushEngineTimer(() => setEngineState('RESULT_PROCESSED'), 260);
      pushEngineTimer(() => {
        setEngineState('COOLDOWN');
        setIsCooldown(true);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          clearResultSafetyTimeout();
          setActiveCycle(null);
          setIsCooldown(false);
          setEngineState('IDLE');
          setResultFlash(null);
          cooldownTimerRef.current = null;
        }, 4000);
      }, 520);
      pushEngineTimer(() => setResultFlash(null), 880);
    },
    [addLog, clearEngineTimers, clearResultSafetyTimeout, pushEngineTimer],
  );

  const ingestSignal = useCallback(
    (rawPayload) => {
      if (activeCycleRef.current != null) {
        addLog('NEW_SIGNAL ignorada (sesión activa)', 'warn');
        return;
      }
      if (isCooldownRef.current) {
        addLog('NEW_SIGNAL ignorada (cooldown)', 'warn');
        return;
      }
      const payload =
        typeof rawPayload === 'string' ? tryParseJson(rawPayload) ?? rawPayload : rawPayload;
      console.log('PAYLOAD RECEIVED:', payload);
      const data = payload?.data || payload;
      const dataObj = data != null && typeof data === 'object' && !Array.isArray(data) ? data : {};
      const mergedForNorm =
        payload != null && typeof payload === 'object' && !Array.isArray(payload)
          ? { ...payload, ...dataObj }
          : dataObj;
      const n = normalizeNewSignalPayload(mergedForNorm);
      const key = n.correlationKey;
      const startedAtRaw = dataObj.timestamp || Date.now();
      const startedAt =
        typeof startedAtRaw === 'number' && Number.isFinite(startedAtRaw)
          ? startedAtRaw
          : (() => {
              const p = Date.parse(String(startedAtRaw));
              return Number.isFinite(p) ? p : Date.now();
            })();
      const partial = {
        id: Date.now(),
        mesa: dataObj.mesa || 'UNKNOWN',
        round: dataObj.round || dataObj.roundId || '—',
        signal: dataObj.recommendation || '—',
        martingale: dataObj.martingale || 0,
        status: null,
        result: null,
        startedAt,
        correlationKey: key,
        providerSignalId: n.providerSignalId,
        rawSignal: n.raw,
        rawEvents: [payload],
        signalPayload: { ...dataObj, round: dataObj.round || dataObj.roundId },
      };
      clearResultSafetyTimeout();
      clearEngineTimers();
      setActiveCycle(partial);
      setEngineState('SIGNAL_DETECTED');
      const steps = [
        ['SIGNAL_VALIDATING', 380],
        ['SIGNAL_ACTIVE', 760],
        ['BETTING_WINDOW', 1140],
        ['DEALING', 1520],
      ];
      steps.forEach(([st, ms]) => {
        pushEngineTimer(() => setEngineState(st), ms);
      });
      addLog(`NEW_SIGNAL mesa=${partial.mesa} round=${partial.round} ${partial.signal}`, 'info');

      resultSafetyTimeoutRef.current = setTimeout(() => {
        resultSafetyTimeoutRef.current = null;
        const cur = activeCycleRef.current;
        if (cur && cur.status == null) {
          console.log('⚠️ FORZANDO CIERRE POR TIMEOUT (15s sin NEW_RESULT)');
          const synthetic = {
            type: 'NEW_RESULT',
            data: {
              mesa: cur.mesa,
              round: cur.round,
              data: {
                results: {
                  mesa_info: {
                    ganador: 'UNKNOWN',
                    puntaje_player: 0,
                    puntaje_banker: 0,
                    cartas_player: [],
                    cartas_banker: [],
                  },
                },
              },
            },
          };
          ingestResult(synthetic, synthetic);
        }
      }, 15_000);
    },
    [addLog, clearEngineTimers, clearResultSafetyTimeout, ingestResult, pushEngineTimer],
  );

  const processEvent = useCallback(
    (payload) => {
      const root = tryParseJson(payload) ?? payload;
      if (root == null || typeof root !== 'object') return;

      const p = root;
      console.log('📡 EVENT RECEIVED:', p);
      const d =
        p.data != null && typeof p.data === 'object' && !Array.isArray(p.data)
          ? p.data
          : {};
      const typeStr = String(p.type ?? d.type ?? '').trim().toUpperCase();

      if (typeStr === 'NEW_SIGNAL') {
        ingestSignal(p);
        return;
      }
      if (typeStr === 'NEW_RESULT') {
        console.log('🔥 NEW_RESULT DETECTED:', p);
        ingestResult(p);
        return;
      }

      const arrays = [p.signals, p.items, p.updates, p.rows, Array.isArray(p.data) ? p.data : null].filter(
        Boolean,
      );
      for (const arr of arrays) {
        if (Array.isArray(arr)) {
          for (const item of arr) processEvent(item);
        }
      }

      const flat = { ...d, ...p };
      if (
        flat.prediction != null ||
        flat.recommendation != null ||
        flat.signal != null ||
        flat.side != null
      ) {
        ingestSignal(flat);
      }
      if (Object.prototype.hasOwnProperty.call(flat, 'winStatus')) {
        ingestResult(flat);
      }
    },
    [ingestSignal, ingestResult],
  );

  useEffect(() => {
    if (!transportOk) {
      setSocketConnected(false);
      return undefined;
    }

    let socket = null;

    if (bff) {
      const base = getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!base) {
        setSocketConnected(false);
        return undefined;
      }
      socket = io(`${base}/admin-signals`, {
        path: '/socket.io',
        transports: ['websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20_000,
      });
    } else if (direct) {
      const apiKey = resolveExternalSignalsApiKey();
      if (!apiKey) {
        setSocketConnected(false);
        return undefined;
      }
      socket = io(getExternalSignalsSocketUrl(), {
        transports: ['websocket'],
        auth: { apiKey },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20_000,
      });
    } else {
      return undefined;
    }

    socketRef.current = socket;

    const onConnect = () => {
      setSocketConnected(true);
      addLog(bff ? 'SOCKET /admin-signals conectado' : 'SOCKET proveedor conectado', 'emit');
    };
    const onDisconnect = () => {
      setSocketConnected(false);
      addLog('SOCKET desconectado', 'warn');
    };

    const onDashboard = (payload) => {
      processEvent(payload);
    };

    const onNewSignal = (payload) => {
      processEvent(payload);
    };
    const onNewResult = (payload) => {
      processEvent(payload);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('dashboardUpdate', onDashboard);
    socket.on('NEW_SIGNAL', onNewSignal);
    socket.on('NEW_RESULT', onNewResult);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('dashboardUpdate', onDashboard);
      socket.off('NEW_SIGNAL', onNewSignal);
      socket.off('NEW_RESULT', onNewResult);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [bff, direct, transportOk, addLog, processEvent, ingestSignal, ingestResult]);

  useEffect(
    () => () => {
      clearEngineTimers();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    },
    [clearEngineTimers],
  );

  const cycleNorm = useMemo(() => normalizeCycle(activeCycle || {}), [activeCycle]);

  const mesaLive =
    activeCycle?.signalPayload?.mesa ?? cycleNorm.mesa ?? '—';
  const roundLive =
    activeCycle?.signalPayload?.round ??
    activeCycle?.signalPayload?.roundId ??
    activeCycle?.round ??
    cycleNorm.roundSignal ??
    '—';
  const patternNameLive =
    activeCycle?.signalPayload?.patternName ??
    activeCycle?.signalPayload?.nombre_algoritmo ??
    cycleNorm.algorithm;

  const forecastLetters = useMemo(() => {
    const payload = activeCycle?.signalPayload;
    const fromSp = Array.isArray(payload?.forecast) ? payload.forecast : null;
    const raw =
      fromSp && fromSp.length
        ? fromSp
        : Array.isArray(cycleNorm.forecast) && cycleNorm.forecast.length
          ? cycleNorm.forecast
          : [];
    if (!raw.length) return ['—'];
    return raw.map((x) => forecastTokenToLetter(x));
  }, [activeCycle?.signalPayload, cycleNorm.forecast]);

  const currentShot = useMemo(() => {
    const raw = Number(
      activeCycle?.martingaleStep ??
        activeCycle?.martingale ??
        activeCycle?.signalPayload?.martingale ??
        NaN,
    );
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(5, Math.floor(raw));
  }, [activeCycle]);

  const cycleStatus = useMemo(() => {
    if (!activeCycle) return 'IDLE';
    if (activeCycle.status == null) return 'AWAITING';
    if (activeCycle.status === 'WIN') return 'WIN';
    return 'LOSS';
  }, [activeCycle]);

  const winnerLetter = useMemo(() => winnerToLetter(cycleNorm.winner), [cycleNorm.winner]);

  const cycleElapsedSec = useMemo(() => {
    if (!activeCycle?.startedAt) return 0;
    return Math.floor((Date.now() - activeCycle.startedAt) / 1000);
  }, [activeCycle?.startedAt, activeCycle?.id, clockTick]);

  const forecastAtShot = forecastLetters[currentShot] ?? '—';
  const ruleHint =
    winnerLetter &&
    (forecastAtShot === 'P' || forecastAtShot === 'B') &&
    cycleNorm.winner != null
      ? winnerLetter === forecastAtShot
        ? `Regla: WIN si coincide forecast (tiro ${currentShot + 1})`
        : currentShot >= 5
          ? 'Regla: LOSS — 6 tiros'
          : 'Regla: avanza tiro (martingala)'
      : null;

  const rawEventsList = Array.isArray(activeCycle?.rawEvents) ? activeCycle.rawEvents : [];

  const getStatusColor = () => {
    if (engineState === 'IDLE') return 'text-green-500 bg-green-500/10 border-green-500/30';
    if (engineState === 'COOLDOWN') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    if (cycleStatus === 'WIN') return 'text-green-400 bg-green-500/20 border-green-400';
    if (cycleStatus === 'LOSS') return 'text-red-500 bg-red-500/10 border-red-500/50';
    return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  };

  const resetEngine = () => {
    clearEngineTimers();
    clearResultSafetyTimeout();
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setActiveCycle(null);
    setIsCooldown(false);
    setPatternLine('—');
    patternHistoryRef.current = [];
    setResultFlash(null);
    setEngineState('IDLE');
    addLog('RESET · estado local limpiado', 'warn');
  };

  return (
    <div className="genesis-oracle-signals-root min-h-screen bg-[#05050A] text-[#8C9BB4] font-mono flex flex-col selection:bg-blue-500/30">

      <nav className="flex items-center justify-between border-b border-[#1A1F35] bg-[#0A0D18] px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-blue-500/30 flex items-center justify-center bg-blue-900/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-[#E2E8F0] tracking-[0.2em] text-sm font-bold">GENESIS ORACLE</h1>
            <p className="text-[10px] text-blue-400/60 tracking-wider">SYS_ID: 7X89_CORE</p>
          </div>
        </div>

        <div className="flex space-x-2 bg-[#0E1224] p-1 rounded-md border border-[#1A1F35]">
          <button type="button" className="flex items-center gap-2 px-4 py-1.5 bg-[#171C33] rounded text-blue-400 text-xs font-semibold shadow-[0_0_8px_rgba(59,130,246,0.15)]">
            <Activity className="w-3.5 h-3.5" /> DASHBOARD
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#171C33]/50 rounded text-xs transition-colors">
            <BarChart2 className="w-3.5 h-3.5" /> ANALYTICS
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#171C33]/50 rounded text-xs transition-colors">
            <Clock className="w-3.5 h-3.5" /> HISTORY
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#171C33]/50 rounded text-xs transition-colors">
            <Lock className="w-3.5 h-3.5" /> ACCESS
          </button>
          <button type="button" className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#171C33]/50 rounded text-xs transition-colors">
            <Wallet className="w-3.5 h-3.5" /> WALLET
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Sun className="w-4 h-4 text-[#8C9BB4] cursor-pointer hover:text-white" />
          <Moon className="w-4 h-4 text-[#8C9BB4] cursor-pointer hover:text-white" />
          <div className="flex items-center gap-2 bg-[#0E1224] px-4 py-1.5 rounded-md border border-[#1A1F35]">
            <span className="text-[10px]">SELECT TOTAL</span>
            <span className="text-[#E2E8F0] font-bold text-sm">$1000.00</span>
            <Wallet className="w-3.5 h-3.5 ml-2 text-blue-400" />
          </div>
          <Settings className="w-5 h-5 text-[#8C9BB4] cursor-pointer hover:text-white" />
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden h-[calc(100vh-64px)] min-h-0">

        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="bg-[#0A0D18] border border-[#1A1F35] rounded-xl p-3 shrink-0 flex justify-between items-center text-xs">
            <span className="flex items-center gap-2 font-bold">
              <Activity className="w-4 h-4 text-blue-500" /> LIVE MONITOR
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border ${
                transportOk && socketConnected
                  ? 'text-green-500 bg-green-500/10 border-green-500/20 animate-pulse'
                  : 'text-pink-500 bg-pink-500/10 border-pink-500/20'
              }`}
            >
              {transportOk ? (socketConnected ? 'ENLACE ACTIVO' : 'CONECTANDO…') : 'SIN TRANSPORTE'}
            </span>
          </div>

          <div className="bg-[#0A0D18] border border-[#1A1F35] rounded-xl flex-1 flex flex-col overflow-hidden min-h-0 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="p-3 border-b border-[#1A1F35] bg-[#0E1224] shrink-0">
              <h3 className="text-[11px] text-[#E2E8F0] font-bold flex items-center gap-2 tracking-widest">
                <Target className="w-3.5 h-3.5 text-pink-500" /> SESIÓN ACTIVA
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#080B15] text-[10px]">
              {!activeCycle ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
                  <Clock className="w-6 h-6" />
                  <p className="text-center tracking-widest">SIN CICLO · rawEvents vacío</p>
                </div>
              ) : (
                <>
                  <p className="text-white font-bold">{String(activeCycle.signalPayload?.recommendation || activeCycle.signal || '—')}</p>
                  <p className="text-gray-400">Mesa: {mesaLive}</p>
                  <p className="text-gray-400">Ronda: {roundLive}</p>
                  <p className="text-gray-400">Martingala (motor): {String(activeCycle.martingale ?? activeCycle.signalPayload?.martingale ?? '—')}</p>
                  <p className="text-gray-400">Estado ciclo: {activeCycle.status == null ? 'ABIERTO' : activeCycle.status}</p>
                  <p className="text-gray-500 pt-2 border-t border-[#1A1F35]">Hist. patrón: {patternLine}</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-[#0A0D18] border border-[#1A1F35] rounded-xl p-3 shrink-0">
            <button
              type="button"
              onClick={resetEngine}
              className="w-full text-xs py-2.5 rounded border border-[#1D243F] hover:bg-[#1D243F]/50 transition-colors font-bold tracking-widest"
            >
              RESET ENGINE
            </button>
          </div>
        </div>

        <div className="col-span-6 bg-[#05050a] border border-[#1A1F35] rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div
            className="oracle-console flex-1 min-h-0 overflow-y-auto p-4 text-sm text-[#cbd5e1]"
            data-result-flash={resultFlash ?? ''}
          >
            {activeCycle ? (
              <div className="mb-4 rounded-lg border border-[#1A1F35] bg-[#0A0D18]/90 p-3">
                <div className="flex justify-between items-start gap-2 border-b border-[#1A1F35] pb-2 mb-3">
                  <div>
                    <h2 className="text-white font-bold tracking-widest uppercase text-sm flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-blue-400" /> {mesaLive}
                    </h2>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase">
                      RONDA: <span className="text-white font-bold">{roundLive}</span>
                      {' · '}
                      PATRÓN: <span className="text-pink-400">{patternNameLive}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`px-2 py-1 rounded text-[9px] font-bold tracking-widest border uppercase flex items-center gap-1 ${getStatusColor()}`}>
                      {cycleStatus === 'WIN' && <ShieldCheck className="w-3 h-3" />}
                      {cycleStatus === 'LOSS' && <ShieldAlert className="w-3 h-3" />}
                      {cycleStatus === 'WIN' ? 'CICLO GANADO' : cycleStatus === 'LOSS' ? 'CICLO PERDIDO' : engineState}
                    </div>
                    <div className="text-[10px] font-mono text-gray-400">
                      TIEMPO: <span className="text-white font-bold">{cycleElapsedSec}s</span>
                    </div>
                  </div>
                </div>

                <div className="panel !mb-2">
                  <h3>SEÑAL</h3>
                  <p>Mesa: {mesaLive}</p>
                  <p>Ronda: {roundLive}</p>
                  <p>Forecast (payload / normalizado):</p>
                  <div className="flex gap-2 flex-wrap">
                    {forecastLetters.map((f, i) => (
                      <span key={i} className="text-white">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="panel !mb-2">
                  <h3>EJECUCIÓN</h3>
                  <p>Tiro actual: {currentShot + 1}</p>
                  <p>Tiempo transcurrido: {cycleElapsedSec}s</p>
                  <p className="text-[10px] text-[#64748b] mt-1">
                    Regla vista: coincide forecast en tiro → WIN; tope 6 tiros → LOSS (motor cierra con NEW_RESULT).
                  </p>
                  {ruleHint ? <p className="text-[10px] text-amber-200/90 mt-1">{ruleHint}</p> : null}
                </div>

                <p className="text-[10px] text-[#64748b] mb-1 uppercase tracking-wider">Secuencia (MG)</p>
                <div className="flex gap-3 flex-wrap mb-3">
                  {forecastLetters.map((f, i) => {
                    let cls = 'box';
                    if (i === currentShot && cycleStatus === 'AWAITING') cls += ' active';
                    else if (cycleStatus === 'WIN' && i === currentShot) cls += ' win';
                    else if (cycleStatus === 'LOSS' && i <= currentShot) cls += ' loss';
                    else if (i < currentShot) cls += ' done';
                    return (
                      <div key={i} className={cls}>
                        {f}
                      </div>
                    );
                  })}
                </div>

                <div className="panel !mb-0">
                  <h3>RESULTADO (normalizeCycle)</h3>
                  <div className="flex flex-wrap gap-4 justify-between">
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase">Player</p>
                      <div className="flex gap-1 mt-1">
                        {(cycleNorm.playerCards || []).slice(0, 3).map((t, i) => {
                          const c = parseBaccaratCardToken(String(t));
                          return c ? (
                            <div
                              key={i}
                              className="oracle-console-card bg-white rounded flex flex-col items-center justify-center text-black shadow-sm"
                            >
                              <span className={`text-xs font-bold ${c.isRed ? 'text-red-600' : 'text-black'}`}>{c.val}</span>
                              <span className={`text-sm ${c.isRed ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                      <p className="mt-1 text-white font-mono">Puntos: {cycleNorm.playerScore ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-red-400 uppercase">Banker</p>
                      <div className="flex gap-1 mt-1">
                        {(cycleNorm.bankerCards || []).slice(0, 3).map((t, i) => {
                          const c = parseBaccaratCardToken(String(t));
                          return c ? (
                            <div
                              key={i}
                              className="oracle-console-card bg-white rounded flex flex-col items-center justify-center text-black shadow-sm"
                            >
                              <span className={`text-xs font-bold ${c.isRed ? 'text-red-600' : 'text-black'}`}>{c.val}</span>
                              <span className={`text-sm ${c.isRed ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                      <p className="mt-1 text-white font-mono">Puntos: {cycleNorm.bankerScore ?? '—'}</p>
                    </div>
                  </div>
                  <p className="mt-2">
                    GANADOR:{' '}
                    {cycleNorm.winner === 'PLAYER' || winnerLetter === 'P'
                      ? 'PLAYER'
                      : cycleNorm.winner === 'BANKER' || winnerLetter === 'B'
                        ? 'BANKER'
                        : cycleNorm.winner === 'TIE' || winnerLetter === 'T'
                          ? 'TIE'
                          : '—'}
                  </p>
                </div>

                {cycleStatus === 'WIN' ? (
                  <div className="text-green-400 mt-3 font-semibold">✔ WIN en tiro {currentShot + 1}</div>
                ) : null}
                {cycleStatus === 'LOSS' ? (
                  <div className="text-red-500 mt-3 font-semibold">✖ LOSS — 6 tiros</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#1A1F35] p-8 text-center text-gray-500">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs tracking-widest uppercase font-bold text-gray-400">Esperando nueva señal…</p>
                <p className="text-[10px] mt-1">Socket + NEW_SIGNAL → activeCycle</p>
              </div>
            )}

            {engineState === 'COOLDOWN' ? (
              <div className="text-yellow-400 mt-3 text-sm font-semibold">Esperando nueva señal...</div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[#1A1F35] bg-[#0A0D18]/90 px-4 py-2 text-[9px] text-[#64748b] flex justify-between">
            <span>
              MOTOR · {engineStateLabel(engineState)}{' '}
              <span className="text-[#475569]">({engineState})</span>
            </span>
            <span>{transportOk ? 'transport OK' : 'sin transporte'}</span>
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <SignalIntelPanel activeCycle={activeCycle} engineState={engineState} />

          <div className="bg-[#0A0D18] border border-blue-500/20 rounded-xl flex-1 flex flex-col overflow-hidden min-h-0 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
            <div className="p-3 border-b border-[#1A1F35] flex justify-between items-center bg-[#0E1224] shrink-0">
              <h3 className="text-[10px] text-blue-400 font-bold flex items-center gap-2">
                <Server className="w-3 h-3" /> NARRADOR · rawEvents
              </h3>
              <div className={`w-2 h-2 rounded-full ${engineState === 'IDLE' ? 'bg-green-500' : 'bg-pink-500 animate-pulse'}`} />
            </div>

            <div className="flex-1 min-h-0 p-3 overflow-y-auto font-mono text-[9px] leading-relaxed space-y-2 bg-[#05050A]">
              {rawEventsList.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2 text-center px-2">
                  <Database className="w-6 h-6" />
                  <span className="tracking-widest uppercase font-bold">SIN EVENTOS</span>
                  <span>NEW_SIGNAL / NEW_RESULT aparecen aquí</span>
                </div>
              )}

              {rawEventsList.map((ev, i) => {
                const { kind, displayName, processPhase } = describeSocketEvent(ev);
                const t = kind || 'EVENT';
                const body = ev?.payload ?? ev?.data ?? ev;
                const short =
                  typeof body === 'object' && body !== null
                    ? JSON.stringify(body).slice(0, 360)
                    : String(body ?? '').slice(0, 360);
                return (
                  <div
                    key={i}
                    className={`border-l-2 pl-2 py-1 ${
                      t === 'NEW_SIGNAL'
                        ? 'border-cyan-500 text-cyan-200'
                        : t === 'NEW_RESULT'
                          ? 'border-amber-500 text-amber-100'
                          : 'border-slate-600 text-[#8C9BB4]'
                    }`}
                  >
                    <div className="font-bold text-[10px]">{displayName}</div>
                    <div className="text-[8px] uppercase tracking-wide text-[#64748b] mb-0.5">
                      {processPhase} · <span className="font-mono text-[#94a3b8]">{t}</span>
                    </div>
                    <div className="break-all opacity-90">{short}</div>
                  </div>
                );
              })}

              {['RESULT_RECEIVED', 'RESULT_PROCESSED', 'COOLDOWN'].includes(engineState) && (
                <div className="border-l-2 border-pink-500 pl-2 py-1 text-pink-300 font-bold">
                  MOTOR · {engineStateLabel(engineState)}{' '}
                  <span className="font-mono text-pink-200/80 text-[9px]">({engineState})</span>
                </div>
              )}

              <div ref={rawLogEndRef} />
            </div>

            <div className="p-2 border-t border-[#1A1F35] bg-[#0E1224] text-[9px] shrink-0">
              <span>
                FLUJO:{' '}
                <span className="text-white font-bold">{engineStateLabel(engineState)}</span>{' '}
                <span className="text-[#475569] font-mono">({engineState})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-in forwards;
        }
        .oracle-console .panel {
          padding: 10px;
          border: 1px solid #222;
          margin-bottom: 12px;
        }
        .oracle-console .panel h3 {
          font-size: 11px;
          letter-spacing: 0.08em;
          color: #94a3b8;
          margin: 0 0 8px 0;
          text-transform: uppercase;
        }
        .oracle-console .panel p {
          margin: 4px 0;
        }
        .oracle-console-note {
          font-size: 11px;
          color: #94a3b8;
          margin: 0 0 6px 0 !important;
        }
        .oracle-console .box {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #333;
          font-weight: 700;
          font-size: 14px;
          color: #e2e8f0;
        }
        .oracle-console .box.active {
          background: #facc15;
          color: #0a0a0a;
          box-shadow: 0 0 16px rgba(250, 204, 21, 0.65);
        }
        .oracle-console-card {
          width: 36px;
          min-height: 48px;
          padding: 4px 2px;
        }
        .oracle-console .box.win {
          background: #22c55e;
          color: #0a0a0a;
        }
        .oracle-console .box.loss {
          background: #ef4444;
          color: #fff;
        }
        .oracle-console .box.done {
          opacity: 0.3;
        }
        .engine-status {
          text-align: center;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .engine-status.BETTING_WINDOW {
          box-shadow: 0 0 20px rgba(0,150,255,0.6);
        }
        .engine-status.DEALING {
          box-shadow: 0 0 25px rgba(255,200,0,0.8);
        }
        .engine-status.RESULT_RECEIVED {
          box-shadow: 0 0 25px rgba(0,255,120,0.8);
        }
        .cards-wrapper {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
          gap: 12px;
        }
        .cards-wrapper .side.player { flex: 1; }
        .cards-wrapper .side.banker { flex: 1; text-align: right; }
        .cards-wrapper .side.banker .cards { justify-content: flex-end; }
        .cards {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cards.dealing .card {
          animation: dealCard 0.4s ease forwards;
        }
        @keyframes dealCard {
          from {
            transform: scale(0.8) translateY(-10px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        .card {
          padding: 10px;
          background: #111;
          border-radius: 6px;
          color: #e2e8f0;
          font-size: 10px;
          font-family: ui-monospace, monospace;
        }
        .score {
          margin-top: 5px;
          font-size: 10px;
          color: #8c9bb4;
        }
        .winner {
          border: 2px solid #00ff88;
          border-radius: 8px;
          padding: 8px;
        }
        .result-block {
          margin-top: 15px;
          text-align: center;
          transition: background 0.35s ease, box-shadow 0.35s ease;
        }
        .result-block.PLAYER {
          background: rgba(0, 120, 255, 0.2);
          box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
        }
        .result-block.BANKER {
          background: rgba(255, 0, 0, 0.2);
          box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.4);
        }
        .result-block.TIE {
          background: rgba(234, 179, 8, 0.18);
          box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.35);
        }
        .intel-panel {
          font-size: 12px;
        }
        .countdown {
          text-align: center;
          font-size: 20px;
          margin: 10px 0;
          color: #38bdf8;
          font-weight: bold;
          font-family: ui-monospace, monospace;
        }
        .signal-meta .side.PLAYER { color: #38bdf8; font-weight: bold; }
        .signal-meta .side.BANKER { color: #f87171; font-weight: bold; }
        .phase-bar {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
        }
        .phase-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #333;
          transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .phase-dot.active {
          background: #00d4ff;
          box-shadow: 0 0 10px #00d4ff;
          transform: scale(1.05);
        }
        .genesis-oracle-signals-root * {
          transition: all 0.2s ease;
        }
        .genesis-oracle-signals-root .card {
          transition: none;
        }
        .debug-box {
          font-family: ui-monospace, monospace;
        }
      ` }} />
    </div>
  );
}
