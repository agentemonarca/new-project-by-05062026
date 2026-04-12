import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Eye, Trophy, Target as TargetIcon, Wallet, Server, Circle, Fingerprint, 
  Cpu, Zap, Tv, ShieldCheck, Activity, BrainCircuit, Sparkles, Crown, 
  Repeat, Bot, Shield, Loader2, AlertOctagon, ArrowUpRight, 
  Lock, Unlock, Compass, CheckCircle2, Monitor, Settings2, 
  BarChart3, Gauge, Radio, Waves, AlertTriangle, Binary, Layers,
  Sun, Moon, Volume2, VolumeX, ChevronDown, ChevronUp, Hash, XCircle, FileText, TrendingUp, DollarSign, Power,
  MessageSquareQuote, Lightbulb, ArrowLeft, History, QrCode, Copy, ArrowDownToLine, ArrowUpFromLine, Menu, LayoutDashboard,
  Globe, Grid3X3,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { BrowserProvider, formatEther, getAddress, parseEther } from 'ethers';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, query, limit, addDoc,
  serverTimestamp, getDoc, setLogLevel
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import AIThinkingLayer from './components/AIThinkingLayer.jsx';
import EngineDebugPanel from './components/EngineDebugPanel.jsx';
import GpulseMembershipView from './components/GpulseMembershipView.jsx';
import TransactionFlowModal, { TX_FLOW_STATE } from './components/web3/TransactionFlowModal.jsx';
import WalletConnectButton from './components/web3/WalletConnectButton.jsx';
import { BoundTrustPulse } from './components/system/TrustPulse.jsx';
import WalletTxTimeline from './components/wallet/WalletTxTimeline.jsx';
import GpulseSyncHUD from './components/GpulseSyncHUD.jsx';
import GpulseSyncToggle from './components/GpulseSyncToggle.jsx';
import CoreButton from './components/CoreButton.jsx';
import GpulseVoiceAssistant from './components/GpulseVoiceAssistant.jsx';
import GpulseSystemCoreIndicator from './components/system/GpulseSystemCoreIndicator.jsx';
import GpulseControlPanelSystemFrame from './components/system/GpulseControlPanelSystemFrame.jsx';
import { GpulseSystemCoreProvider } from './context/GpulseSystemCoreContext.jsx';
import { GpulseProvider } from './context/GpulseContext.jsx';
import GpulseSystemHealthSync from './components/system/GpulseSystemHealthSync.jsx';
import GpulseSystemModeSync from './components/system/GpulseSystemModeSync.jsx';
import GpulseFeedbackSync from './components/system/GpulseFeedbackSync.jsx';
import SystemIntelligencePanel from './components/system/SystemIntelligencePanel.jsx';
import GpulseSocketSync from './components/system/GpulseSocketSync.jsx';
import { usePremiumStatus } from './hooks/usePremiumStatus.js';
import { useSystemActions } from './hooks/useSystemActions.js';
import { useQueueStats } from './hooks/useQueueStats.js';
import { useSynchronization } from './hooks/useSynchronization.js';
import { runDiagnostics } from './domain/diagnostics/index.js';
import { executeAIFlow } from './domain/orchestrator/executeAIFlow.js';
import { connectWallet as connectInjectedWallet } from './utils/connectWallet.js';
import { getInjectedEthereum } from './utils/ethereumProvider.js';
import { isWeb3MockMode } from './utils/web3Mode.js';
import {
  applyIaRealStakeDebit,
  applyIaRealWinCredit,
  multiPairRequiredPerLeg,
  canExecuteMultiPair,
  multiOperationalPerLeg,
  multiExcessAig,
  multiExcessUsdt,
  multiMaxUsable,
  multiMaxReachableStep,
  normalizeDualBalances,
} from './domain/wallet/index.js';
import {
  PHASES,
  analysisStepSchedule,
  detectionDelayMs,
  resultDelayMs,
  restartDelayMs,
  shouldTriggerSequence,
  generatePattern,
  pickMesa,
  pickRonda,
  computeBetForStep,
  computeTotalLoss,
  computeWinAt,
  isWinningStep,
  canExecuteShot,
  nextPhasePlan,
} from './domain/engine/index.js';
import { runAction } from './domain/actions/executor.js';
import {
  sumStatTotals,
  mergeLedgerHistory,
  asLedgerRows,
  computeDailyPnL24hFromLedger,
  computeSessionDerivedCounts,
  computeTotals,
  computeTodayPnL24h,
  computeWinRatePct,
  computeStreaks,
  computeWalletSplit,
} from './domain/ledger/index.js';
import { computeGPulse } from './core/gpulse/gpulseEngine.js';
import { unlockAudio, subscribeAudioUnlock, getAudioUnlockEpoch, isAudioUnlocked } from './utils/audioUnlock.js';
import { useExternalSignals } from './ui-genesis/hooks/useExternalSignals.js';
import { useExternalSignalsStore } from './ui-genesis/stores/externalSignalsStore.js';
import { createIdleIaRealVisualState, iaRealStatusToPresentationFase } from './utils/iaRealEngineModel.js';
import { extractVectorForecastFromActiveRow, forecastStepIndexFromProviderRow } from './utils/iaRealEngineUi.js';
import { ProviderRelayStatusStrip } from './components/ProviderRelayStatusStrip.jsx';
import { IaRealExecutionLayer } from './components/iaReal/IaRealExecutionLayer.jsx';
import { logIaRealEngineInput } from './utils/iaRealFullFlowLog.js';

// --- CONFIGURACIÓN DE SISTEMA ---
/** Plan de usuario para reglas de voz G_Pulse (alinear con Access / backend cuando exista). */
const GPULSE_VOICE_USER_PLAN = 'OPERATOR';

/** When true, {@link resolveUiDefaultMode} always starts in IA Real. To hide the «Simular» button use `VITE_GPULSE_HIDE_SIM_MODE=1` (not this flag). */
const GPULSE_FORCE_IA_REAL = String(import.meta.env.VITE_GPULSE_FORCE_IA_REAL ?? '0').trim() === '1';
/**
 * IA Real: no local phase scheduler / martingale loop — only `externalSignalsStore` NEW_SIGNAL / NEW_RESULT.
 * Set VITE_GPULSE_REAL_PROVIDER_EXECUTION=0 to restore legacy local engine (dev).
 */
const GPULSE_REAL_PROVIDER_EXECUTION = String(import.meta.env.VITE_GPULSE_REAL_PROVIDER_EXECUTION ?? '1').trim() === '1';

/** IA Real: UI-only hold after NEW_RESULT before clearing overlay (ms). */
const IA_REAL_RESULT_DISPLAY_MS = Math.max(
  0,
  Number(String(import.meta.env.VITE_IA_REAL_RESULT_DISPLAY_MS ?? '2500').trim()) || 2500,
);

const MODOS = { VISOR: 'VISOR', SIMULACION: 'SIMULACION', IA_REAL: 'IA_REAL' };
const FASES = PHASES;

/** `VITE_GPULSE_DEFAULT_MODE`: IA_REAL | SIMULACION | VISOR (default IA_REAL — no arrancar en demo local). */
function resolveUiDefaultMode() {
  if (GPULSE_FORCE_IA_REAL) return MODOS.IA_REAL;
  const raw = String(import.meta.env.VITE_GPULSE_DEFAULT_MODE || 'IA_REAL').trim().toUpperCase();
  if (raw === 'SIMULACION' || raw === 'SIMULATION' || raw === 'DEMO') return MODOS.SIMULACION;
  if (raw === 'VISOR' || raw === 'VIEWER') return MODOS.VISOR;
  if (raw === 'IA_REAL' || raw === 'REAL') return MODOS.IA_REAL;
  return MODOS.IA_REAL;
}

/** Dice-roll / cognitive ticks: fixed tempo, never scaled by Go Pulse */
const COGNITIVE_ROLL_TICK_MS = 125;

const BACCARAT_TABLES = [
  "Prestige Gold", "VIP Sapphire", "Speed Baccarat A", "Grand Throne", 
  "Lotus Lounge", "Imperial Court", "Royal Diamond", "Speed Baccarat B",
  "Dragon Tiger Hall", "Mystic Baccarat"
];

const COLORS = { player: '#00EDFF', banker: '#FF1B8D', tie: '#4ade80', special: '#8A2BE2', loss: '#ef4444' };

const WALLET_MODE = { AIG: 'AIG', MULTI: 'MULTI' };
/** Core wallet keys for global IA selection (maps to WALLET_MODE: aig→AIG, dual→MULTI) */
const WALLET_KEY = { AIG: 'aig', DUAL: 'dual' };
const WALLET_VIEWS = { MAIN: 'main', DEPOSIT: 'deposit', WITHDRAW: 'withdraw', HISTORY: 'history' };
/** Alineado con `VITE_WEB3_MODE`: `real` → pagos/deposit on-chain; default `mock`. */
const WEB3_MODE =
  String(import.meta.env.VITE_WEB3_MODE ?? 'mock').trim().toLowerCase() === 'real' ? 'REAL' : 'MOCK';

const MOCK_TX_STATUS = {
  PENDING: 'PENDING',
  CONFIRMING: 'CONFIRMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

/** Canonical order for wallet timeline flow (mirrors TransactionFlowModal phases). */
const TX_FLOW_LEDGER_ORDER = ['CONNECTING', 'SIGNING', 'BROADCASTING', 'CONFIRMING', 'SUCCESS', 'ERROR'];

function mergeWalletFlowStates(prev, incoming) {
  const now = Date.now();
  const by = {};
  for (const e of [...(prev || []), ...(incoming || [])]) {
    const s = String(e?.state || '');
    if (!s) continue;
    const t = Number(e?.at) || now;
    if (by[s] == null || t < by[s]) by[s] = t;
  }
  return TX_FLOW_LEDGER_ORDER.filter((s) => by[s] != null).map((s) => ({ state: s, at: by[s] }));
}

function normalizeFlowStatesFromLog(log) {
  const now = Date.now();
  const by = {};
  for (const e of log || []) {
    const s = String(e?.state || '');
    if (!s || s === 'IDLE') continue;
    const t = Number(e?.at) || now;
    if (by[s] == null || t < by[s]) by[s] = t;
  }
  return TX_FLOW_LEDGER_ORDER.filter((s) => by[s] != null).map((s) => ({ state: s, at: by[s] }));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function generateMockTxHash() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch (e) {}
  // Fallback (non-cryptographic) for environments without WebCrypto.
  const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `0x${hex}`;
}
const DEMO_WALLET_ADDRESS_AIG = '0xA1G7425739c8F7c8E2B4c9d1eF3a5B6c7D8e9F0aB1c2';
const DEMO_WALLET_ADDRESS_USDT = '0xUSdT9283c1F4a6E8b2D0e5F7a9C1B3D4E6F8a0B2c4';

// (wallet + ledger domain helpers moved to src/domain/*)

const RESULT_EMOTIONS = {
  1: { title: "PERFECCIÓN ABSOLUTA", sub: "Sincronía Instantánea" },
  2: { title: "EFICIENCIA ÓPTIMA", sub: "Flujo Armónico" },
  3: { title: "MATRIZ DOMINADA", sub: "Control de Ciclo" },
  4: { title: "ADAPTACIÓN LOGRADA", sub: "Resiliencia Activa" },
  5: { title: "VOLUNTAD DE HIERRO", sub: "Alta Intensidad" },
  6: { title: "TRIUNFO ÉPICO", sub: "Sincronía Final Lograda" },
  7: { title: "RECALIBRACIÓN", sub: "Margen de Riesgo Superado" }
};

// --- MOTOR DE SONIDO EN CAPAS (consciencia / fases; tempo fijo, sin Go Pulse) ---
const SoundEngine = {
  isInitialized: false,
  isGold: false,
  _lastEventAt: 0,
  _minGapMs: 520,
  master: null,
  ambientGain: null,
  ambientFilter: null,
  noiseAmb: null,
  humOsc: null,
  humGain: null,
  rollingGain: null,
  rollingFilter: null,
  noiseRoll: null,
  tickSynth: null,
  glitchSynth: null,
  pulseSynth: null,
  synth: null,
  poly: null,

  async init() {
    try {
      const ok = await unlockAudio();
      const Tone = window.Tone;
      if (!Tone) return false;
      if (!ok && Tone.context?.state !== 'running') return false;
      if (this.isInitialized) return true;

      this.master = new Tone.Volume(-6).toDestination();

      this.ambientGain = new Tone.Gain(0.0001).connect(this.master);
      this.ambientFilter = new Tone.Filter(650, 'lowpass').connect(this.ambientGain);
      this.noiseAmb = new Tone.Noise('pink').start();
      this.noiseAmb.volume.value = -22;
      this.noiseAmb.connect(this.ambientFilter);

      this.humOsc = ToneOscSafe(Tone, { frequency: 58, type: 'sine' });
      this.humOsc.start();
      this.humGain = new Tone.Gain(0.0001).connect(this.ambientGain);
      this.humOsc.connect(this.humGain);

      this.rollingGain = new Tone.Gain(0.0001).connect(this.master);
      this.rollingFilter = new Tone.Filter(3200, 'lowpass').connect(this.rollingGain);
      this.noiseRoll = new Tone.Noise('brown').start();
      this.noiseRoll.volume.value = -28;
      this.noiseRoll.connect(this.rollingFilter);

      this.tickSynth = new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 1.2, rolloff: -24, frequency: 2800 },
        filterEnvelope: { attack: 0.01, decay: 0.12, sustain: 0.01, release: 0.06, baseFrequency: 2800, octaves: 2 },
        envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
        volume: -24
      }).connect(this.master);

      this.glitchSynth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 3, rolloff: -48, frequency: 4000 },
        filterEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
        volume: -32
      }).connect(this.master);

      this.pulseSynth = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.008, decay: 0.15, sustain: 0.2, release: 0.35 },
        volume: -16
      }).connect(this.master);

      this.synth = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 },
        volume: -5
      }).connect(this.master);

      this.poly = new Tone.PolySynth(Tone.Synth).connect(this.master);
      this.poly.set({ envelope: { attack: 0.05, release: 1.2 }, volume: -10 });

      this._applyPalette(false);
      this.isInitialized = true;
      return true;
    } catch (e) { return false; }
  },

  _applyPalette(gold) {
    this.isGold = !!gold;
    const Tone = window.Tone;
    if (!this.isInitialized || !Tone) return;
    if (gold) {
      if (this.ambientFilter) this.ambientFilter.frequency.rampTo(1100, 0.7);
      this.tickSynth?.set({ oscillator: { type: 'triangle' }, filter: { frequency: 2200, Q: 0.8 }, volume: -22 });
      this.glitchSynth?.set({ oscillator: { type: 'triangle' }, volume: -30 });
      this.pulseSynth?.set({ oscillator: { type: 'triangle' }, volume: -14 });
      this.poly?.set({ oscillator: { type: 'triangle' }, volume: -9 });
    } else {
      if (this.ambientFilter) this.ambientFilter.frequency.rampTo(650, 0.7);
      this.tickSynth?.set({ oscillator: { type: 'square' }, filter: { frequency: 3200, Q: 1.8 }, volume: -24 });
      this.glitchSynth?.set({ oscillator: { type: 'sawtooth' }, volume: -32 });
      this.pulseSynth?.set({ oscillator: { type: 'sine' }, volume: -16 });
      this.poly?.set({ oscillator: { type: 'square' }, volume: -10 });
    }
  },

  setGoldMode(gold) {
    this._applyPalette(gold);
  },

  _canPlay(minGapMs = this._minGapMs) {
    const now = Date.now();
    if (now - (this._lastEventAt || 0) < minGapMs) return false;
    this._lastEventAt = now;
    return true;
  },

  setAmbientEnabled(on) {
    if (!this.isInitialized || !this.ambientGain) return;
    this.ambientGain.gain.rampTo(on ? 0.88 : 0.0001, on ? 2.2 : 1.4);
    if (this.humGain) this.humGain.gain.rampTo(on ? 0.022 : 0.0001, on ? 2 : 1.2);
  },

  /** Ambient profiles: off | low (barely audible). Visual-only enhancement, no logic coupling. */
  setAmbientProfile(profile) {
    if (!this.isInitialized || !this.ambientGain) return;
    const p = String(profile || 'off');
    if (p === 'low') {
      this.ambientGain.gain.rampTo(0.12, 1.6);
      if (this.humGain) this.humGain.gain.rampTo(0.006, 1.6);
    } else if (p === 'on') {
      this.setAmbientEnabled(true);
    } else {
      this.setAmbientEnabled(false);
    }
  },

  setRollingLayer(active) {
    if (!this.isInitialized || !this.rollingGain) return;
    this.rollingGain.gain.rampTo(active ? 0.52 : 0.0001, active ? 0.45 : 0.55);
  },

  setNoise(active) {
    this.setRollingLayer(active);
  },

  playRollingTick() {
    if (!this.isInitialized) return;
    if (!this._canPlay(90)) return;
    const n = this.isGold ? 'F#6' : 'G6';
    this.tickSynth?.triggerAttackRelease(n, '64n', undefined, 0.028);
  },

  playTick() {
    this.playRollingTick();
  },

  playAnalysisPulse(idx) {
    if (!this.isInitialized) return;
    const i = Math.max(1, Number(idx) || 1) - 1;
    const cold = ['C5', 'D5', 'D#5', 'F5'];
    const warm = ['G4', 'A4', 'B4', 'D5'];
    const notes = this.isGold ? warm : cold;
    this.tickSynth?.triggerAttackRelease(notes[i % 4], '32n', undefined, 0.02);
    if (Math.random() > 0.45) {
      const g = this.isGold ? (Math.random() > 0.5 ? 'B5' : 'D6') : (Math.random() > 0.5 ? 'F#6' : 'A6');
      this.glitchSynth?.triggerAttackRelease(g, '128n', undefined, 0.012);
    }
  },

  playEngine(idx) {
    this.playAnalysisPulse(idx);
  },

  playGlitchMicro() {
    if (!this.isInitialized) return;
    if (!this._canPlay(120)) return;
    const Tone = window.Tone;
    const n1 = this.isGold ? 'E6' : 'G#6';
    const n2 = this.isGold ? 'G6' : 'B6';
    const now = Tone.now();
    this.glitchSynth?.triggerAttackRelease(n1, '128n', now, 0.008);
    if (Math.random() > 0.5) this.glitchSynth?.triggerAttackRelease(n2, '128n', now + 0.04, 0.006);
  },

  playSignalStep(shot) {
    if (!this.isInitialized) return;
    if (!this._canPlay(160)) return;
    const s = Math.min(6, Math.max(1, Number(shot) || 1));
    const coldSeq = ['C3', 'C#3', 'D3', 'D#3', 'E3', 'F3'];
    const goldSeq = ['E3', 'G3', 'B3', 'D4', 'E4', 'G4'];
    const seq = this.isGold ? goldSeq : coldSeq;
    const note = seq[s - 1];
    const Tone = window.Tone;
    const now = Tone.now();
    this.pulseSynth?.triggerAttackRelease(note, '16n', now, 0.38);
    const confirm = this.isGold ? 'B5' : 'E6';
    this.tickSynth?.triggerAttackRelease(confirm, '64n', now + 0.1, 0.022);
  },

  playResultadoRelease(won) {
    if (!this.isInitialized) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const base = 0.88;
    if (this.ambientGain) {
      if (won) {
        this.ambientGain.gain.rampTo(base * 1.12, 0.2);
        this.ambientGain.gain.rampTo(base, 1.35);
      } else {
        this.ambientGain.gain.rampTo(base * 0.72, 0.35);
        this.ambientGain.gain.rampTo(base, 1.1);
      }
    }
    if (won) {
      const chord = this.isGold ? ['B3', 'D4', 'F#4'] : ['C4', 'Eb4', 'G4'];
      this.poly?.triggerAttackRelease(chord, '8n', now + 0.02, 0.35);
    } else {
      const n = this.isGold ? 'G2' : 'C2';
      this.pulseSynth?.triggerAttackRelease(n, '8n', now + 0.02, 0.22);
    }
  },

  playBoot() {
    if (!this.isInitialized) return;
    if (!this._canPlay(260)) return;
    this.synth?.triggerAttackRelease('C4', '8n');
    this.synth?.frequency.rampTo('C5', 0.5);
  },

  playWin(shot) {
    if (!this.isInitialized) return;
    if (!this._canPlay(220)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const shotN = Number(shot);
    if (this.isGold) {
      switch (shotN) {
        case 1: this.poly?.triggerAttackRelease(['B4', 'D5', 'F#5'], '2n', now); break;
        case 2: case 3: this.poly?.triggerAttackRelease(['E4', 'G4', 'B4', 'D5'], '1n', now); break;
        case 4: case 5: this.poly?.triggerAttackRelease(['F#4', 'A4', 'C#5', 'E5'], '1n', now); this.synth?.triggerAttackRelease('B2', '4n', now + 0.1); break;
        case 6: ['E3', 'G3', 'B3', 'D4', 'E4', 'G4', 'B4'].forEach((n, i) => this.poly?.triggerAttackRelease(n, '4n', now + i * 0.08)); break;
        default: this.poly?.triggerAttackRelease(['B4', 'D5', 'F#5'], '1n', now);
      }
    } else {
      switch (shotN) {
        case 1: this.poly?.triggerAttackRelease(['C6', 'G6', 'E7'], '2n', now); break;
        case 2: case 3: this.poly?.triggerAttackRelease(['G4', 'C5', 'E5', 'G5'], '1n', now); break;
        case 4: case 5: this.poly?.triggerAttackRelease(['A3', 'E4', 'A4', 'C5'], '1n', now); this.synth?.triggerAttackRelease('A2', '4n', now + 0.1); break;
        case 6: ['C4', 'E4', 'G4', 'B4', 'C5', 'E5', 'G5'].forEach((n, i) => this.poly?.triggerAttackRelease(n, '4n', now + i * 0.08)); break;
        default: this.poly?.triggerAttackRelease(['C5', 'E5', 'G5'], '1n', now);
      }
    }
  },

  playLoss() {
    if (!this.isInitialized) return;
    if (!this._canPlay(260)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    if (this.isGold) {
      this.synth?.triggerAttackRelease('E2', '1n', now, 0.5);
      this.synth?.frequency.rampTo('A1', 1.4);
    } else {
      this.synth?.triggerAttackRelease('F1', '1n', now, 0.6);
      this.synth?.frequency.rampTo('C1', 1.5);
    }
  },

  playClick() {
    if (!this.isInitialized) return;
    if (!this._canPlay(110)) return;
    const n = this.isGold ? 'F#5' : 'D5';
    this.tickSynth?.triggerAttackRelease(n, '64n', undefined, 0.035);
  },

  /** Subtle cue for ANALISIS/DETECCION (≤1s, very low intensity) */
  playThinkingCue(kind = 'analysis', intensity = 0.2) {
    if (!this.isInitialized) return;
    if (!this._canPlay(520)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const n = kind === 'detection' ? (this.isGold ? 'A3' : 'D#4') : (this.isGold ? 'G3' : 'C4');
    // short, soft pulse (no overlap concerns)
    const v = Math.max(0.05, Math.min(0.35, Number(intensity) || 0.2));
    this.pulseSynth?.triggerAttackRelease(n, '32n', now, 0.12 * v);
    this.tickSynth?.triggerAttackRelease(this.isGold ? 'D6' : 'A6', '128n', now + 0.06, 0.01 * v);
  },

  /** Subtle cue for entering SEÑAL (distinct from per-shot signal steps) */
  playSignalCue(intensity = 0.22) {
    if (!this.isInitialized) return;
    if (!this._canPlay(620)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const n1 = this.isGold ? 'E4' : 'C4';
    const n2 = this.isGold ? 'G4' : 'D4';
    const v = Math.max(0.05, Math.min(0.35, Number(intensity) || 0.22));
    this.pulseSynth?.triggerAttackRelease(n1, '64n', now, 0.18 * v);
    this.pulseSynth?.triggerAttackRelease(n2, '64n', now + 0.09, 0.14 * v);
  },

  /** Soft alert tones for popup signals (≤1s, non-harsh) */
  playPopupCue(type, intensity = 0.22) {
    if (!this.isInitialized) return;
    if (!this._canPlay(720)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const v = Math.max(0.05, Math.min(0.35, Number(intensity) || 0.22));
    if (type === 'risk') {
      const n = this.isGold ? 'G2' : 'C2';
      this.pulseSynth?.triggerAttackRelease(n, '16n', now, 0.22 * v);
      this.tickSynth?.triggerAttackRelease(this.isGold ? 'B4' : 'F#5', '128n', now + 0.08, 0.012 * v);
    } else if (type === 'opportunity') {
      const chord = this.isGold ? ['B4', 'D5'] : ['C5', 'E5'];
      this.poly?.triggerAttackRelease(chord, '16n', now, 0.18 * v);
    } else if (type === 'balance') {
      const n = this.isGold ? 'A3' : 'F3';
      this.pulseSynth?.triggerAttackRelease(n, '32n', now, 0.16 * v);
    } else {
      this.tickSynth?.triggerAttackRelease(this.isGold ? 'D6' : 'A6', '128n', now, 0.01 * v);
    }
  },

  /** Emotional result cues (short, relief-like, ≤500ms). */
  playWinSoft(intensity = 0.22) {
    if (!this.isInitialized) return;
    if (!this._canPlay(720)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const v = Math.max(0.05, Math.min(0.35, Number(intensity) || 0.22));
    const chord = this.isGold ? ['B4', 'D5', 'F#5'] : ['C5', 'E5', 'G5'];
    this.poly?.triggerAttackRelease(chord, '16n', now, 0.22 * v);
    this.tickSynth?.triggerAttackRelease(this.isGold ? 'D6' : 'A6', '128n', now + 0.06, 0.01 * v);
  },

  playLossSoft(intensity = 0.22) {
    if (!this.isInitialized) return;
    if (!this._canPlay(720)) return;
    const Tone = window.Tone;
    const now = Tone.now();
    const v = Math.max(0.05, Math.min(0.35, Number(intensity) || 0.22));
    const n = this.isGold ? 'G2' : 'C2';
    this.pulseSynth?.triggerAttackRelease(n, '16n', now, 0.18 * v);
    this.tickSynth?.triggerAttackRelease(this.isGold ? 'B4' : 'F#4', '128n', now + 0.08, 0.008 * v);
  }
};

/** Avoid instanceof issues if Tone is loaded twice */
function ToneOscSafe(Tone, opts) {
  return new Tone.Oscillator(opts);
}

// --- ESTILOS DINÁMICOS ADAPTATIVOS ---
const GlobalStyles = ({ isLight }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@100;200;300;400;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
    :root { 
      --bg-main: ${isLight ? '#F8FAFC' : '#020008'}; 
      --text-main: ${isLight ? '#0F172A' : '#F0F0F0'};
      --text-title: ${isLight ? '#1E293B' : '#FFFFFF'};
      --glass-bg: ${isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(10, 2, 30, 0.75)'};
      --glass-border: ${isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.08)'};
      --armani-curve: cubic-bezier(0.22, 1, 0.36, 1);
      --accent-glow: ${isLight ? 'rgba(0, 237, 255, 0.3)' : 'rgba(0, 237, 255, 0.15)'};
      --gold-primary: #BF953F;
      --gold-secondary: #FCF6BA;
      --gold-tertiary: #B38728;
      --gold-glow: rgba(191, 149, 63, 0.45);
    }
    html, body { min-height: 100vh; min-height: 100dvh; margin: 0; padding: 0; overflow-x: hidden; background-color: var(--bg-main) !important; transition: background-color 1s var(--armani-curve); }
    @media (min-width: 1024px) {
      html, body { height: 100dvh; max-height: 100dvh; overflow: hidden; }
    }
    body { background-image: radial-gradient(circle at 50% 0%, ${isLight ? 'rgba(0, 237, 255, 0.08)' : 'rgba(138, 43, 226, 0.15)'} 0%, transparent 50%), radial-gradient(circle at 100% 100%, ${isLight ? 'rgba(255, 27, 141, 0.04)' : 'rgba(0, 237, 255, 0.05)'} 0%, transparent 50%); color: var(--text-main); font-family: 'Exo 2', sans-serif; }
    .glass { background: var(--glass-bg); backdrop-filter: blur(25px); border: 1px solid var(--glass-border); border-radius: 20px; box-shadow: ${isLight ? '0 10px 30px -10px rgba(0,0,0,0.05)' : 'none'}; }
    .armani-title-dynamic { font-weight: 200; letter-spacing: 0.35em; text-transform: uppercase; color: var(--text-title); text-shadow: ${isLight ? 'none' : '0 0 15px rgba(255, 255, 255, 0.3)'}; }
    .armani-label-dynamic { font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; font-size: 8px; color: ${isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.5)'}; }
    .status-text-dynamic { font-weight: 100; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-title); filter: ${isLight ? 'none' : 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.2))'}; }

    /* EFECTOS ESPECIALES BOTÓN IA VIVA */
    .btn-glass-armani {
      background: ${isLight ? 'rgba(0, 237, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'};
      backdrop-filter: blur(10px); 
      border: 1px solid ${isLight ? 'rgba(0, 237, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
      color: ${isLight ? '#0891B2' : '#FFFFFF'} !important; 
      transition: all 0.5s var(--armani-curve);
      animation: pulse-lure 4s infinite;
    }

    .btn-energy-ai {
      background: linear-gradient(135deg, #FF1B8D 0%, #8A2BE2 100%);
      color: #FFFFFF !important; border: none; 
      box-shadow: 0 0 25px rgba(255, 27, 141, 0.5);
      transition: all 0.5s var(--armani-curve); 
      position: relative; overflow: hidden;
      animation: energy-surge 1s infinite alternate;
    }

    @keyframes pulse-lure {
      0% { box-shadow: 0 0 0 0px ${isLight ? 'rgba(0,237,255,0.2)' : 'rgba(0,237,255,0.1)'}; transform: scale(1); }
      50% { box-shadow: 0 0 20px 4px ${isLight ? 'rgba(0,237,255,0.4)' : 'rgba(0,237,255,0.25)'}; transform: scale(1.02); }
      100% { box-shadow: 0 0 0 0px ${isLight ? 'rgba(0,237,255,0.2)' : 'rgba(0,237,255,0.1)'}; transform: scale(1); }
    }

    @keyframes energy-surge {
      0% { transform: scale(1); filter: brightness(1); }
      100% { transform: scale(1.03); filter: brightness(1.2); }
    }

    .blockchain-entry {
      animation-name: ledger-slide;
      animation-duration: 0.6s;
      animation-timing-function: var(--armani-curve);
      animation-fill-mode: forwards;
      position: relative;
    }
    @keyframes ledger-slide { 0% { transform: translateX(-20px) scale(0.95); opacity: 0; filter: blur(4px); } 100% { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); } }
    .vortex-spin { animation: vortex 30s infinite linear; }
    @keyframes vortex { to { transform: rotate(360deg); } }
    .pulse-ring { animation: pulse-expand 2.5s infinite; }
    @keyframes pulse-expand { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.3); opacity: 0; } }
    .custom-scrollbar::-webkit-scrollbar { width: 2px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 237, 255, 0.2); border-radius: 10px; }
    
    /* V9.0: ANIMACIÓN DE HOLOGRAMA */
    .figura-proyeccion {
      animation: hologram-flicker 2.5s infinite ease-in-out;
      filter: drop-shadow(0 0 8px currentColor);
    }
    @keyframes hologram-flicker {
      0%, 100% { opacity: 0.6; transform: scale(0.95); }
      50% { opacity: 1; transform: scale(1.05); }
    }
  `}</style>
);

const NeuralReveal = ({ text, delay = 10 }) => {
  const safeText = useMemo(() => (typeof text === 'string' || typeof text === 'number') ? String(text) : "", [text]);
  const [visibleChars, setVisibleChars] = useState(0);
  useEffect(() => { setVisibleChars(0); const timer = setInterval(() => { setVisibleChars(p => (p >= safeText.length ? safeText.length : p + 1)); }, delay); return () => clearInterval(timer); }, [safeText, delay]);
  return <span>{safeText.slice(0, visibleChars)}</span>;
};

function buildViewerNarrative(fase, data = {}) {
  switch (String(fase)) {
    case 'ANALISIS':
      return 'Escaneando patrones del entorno… identificando comportamiento de la mesa…';
    case 'DETECCION':
      return 'Patrón detectado… evaluando consistencia y posible punto de entrada…';
    case 'SEÑAL':
      return 'Señal generada… simulando ejecución para validación estratégica…';
    case 'RESULTADO':
      return `Resultado observado: ${Number(data.wins || 0)} manos ganadas, ${Number(data.losses || 0)} perdidas`;
    default:
      return 'Sistema en observación continua…';
  }
}

function buildSimulationNarrative(fase, data = {}) {
  switch (String(fase)) {
    case 'SEÑAL':
      return `Entrada simulada en T${Number(data.step || 0)} con ${Number(data.amount || 0).toFixed(2)} USDT… aplicando progresión`;
    case 'RESULTADO':
      return `Resultado de simulación — recompensas netas estimadas: ${Number(data.rewardsNet || 0) >= 0 ? '+' : ''}${Number(data.rewardsNet || 0).toFixed(2)} USDT`;
    default:
      return 'Simulación en curso…';
  }
}

function buildRealNarrative(fase, data = {}) {
  switch (String(fase)) {
    case 'SEÑAL':
      return `Ejecutando orden en T${Number(data.step || 0)} con capital real… control de riesgo activo`;
    case 'RESULTADO':
      return `Variación neta de sesión (informativa): ${Number(data.rewardsNet || 0) >= 0 ? '+' : ''}${Number(data.rewardsNet || 0).toFixed(2)} USDT`;
    default:
      return 'Operación en curso… monitoreo activo';
  }
}

function buildNarrative({ mode, fase, data }) {
  if (mode === 'VISOR') return buildViewerNarrative(fase, data);
  if (mode === 'SIMULACION') return buildSimulationNarrative(fase, data);
  if (mode === 'IA_REAL') return buildRealNarrative(fase, data);
  return '';
}

// --- COMPONENTE: NEURAL ANALYTICS ---
const NeuralAnalytics = React.memo(({ stats, isRunning, enginesReady, isLight, isSoundEnabled, onAskOracle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const totals = useMemo(() => Array.isArray(stats?.totals) ? stats.totals : Array(8).fill(0), [stats?.totals]);
  const distribution = useMemo(() => totals.slice(1, 7), [totals]); 
  const maxVal = useMemo(() => Math.max(...distribution, 1), [distribution]);

  return (
    <div className={`glass transition-all duration-500 overflow-hidden flex-none ${isExpanded ? 'p-5' : 'p-4'}`}>
      <div onClick={() => { setIsExpanded(!isExpanded); if (isSoundEnabled) SoundEngine.playClick(); }} className="flex items-center justify-between cursor-pointer group mb-2">
        <div className="flex items-center gap-2">
           <Activity size={14} className="text-cyan-500 group-hover:scale-110 transition-transform"/>
           <span className="armani-label-dynamic opacity-100">Cerebro Estadístico</span>
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="text-center">
          <p className="armani-label-dynamic mb-1">Aciertos</p>
          <p className="text-lg font-mono font-black text-cyan-600">{Number(stats?.wins) || 0}</p>
        </div>
        <div className="text-center">
          <p className="armani-label-dynamic mb-1">Anomalías</p>
          <p className="text-lg font-mono font-black text-pink-600">{Number(totals[7]) || 0}</p>
        </div>
        <div className="text-center border-l border-white/5">
          <p className="armani-label-dynamic mb-1">Afinidad</p>
          <p className={`text-lg font-mono font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{Number(stats?.precision) || 0}%</p>
        </div>
      </div>

      <div className={`transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100 mt-6' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <button onClick={(e) => { e.stopPropagation(); onAskOracle(); }} className="w-full mb-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-cyan-500/20">
          <Sparkles size={14} /> Consultar Oráculo ✨
        </button>

        <div className={`${isLight ? 'bg-slate-50' : 'bg-black/30'} border border-white/5 rounded-xl p-3 mb-4`}>
          <div className="flex justify-between items-center mb-3">
            <span className="armani-label-dynamic">Motores de Varianza</span>
            <span className="text-[8px] font-mono text-purple-500">{isRunning ? (Number(enginesReady) * 25) : 0}% LOAD</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {['VAR', 'PROB', 'MUES', 'SINC'].map((label, i) => (
              <div key={label} className={`flex flex-col items-center py-2 rounded-lg border transition-all duration-500 ${enginesReady > i ? 'border-cyan-500/50 bg-cyan-500/10' : (isLight ? 'border-slate-200' : 'border-black/10')}`}>
                <Binary size={10} className={enginesReady > i ? 'text-cyan-500' : (isLight ? 'text-slate-300' : 'text-slate-600')} />
                <span className="text-[6px] font-bold mt-1 text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${isLight ? 'bg-slate-50' : 'bg-black/40'} border border-white/10 rounded-xl p-4`}>
          <p className="armani-label-dynamic mb-4 flex items-center gap-2"><BarChart3 size={10}/> Distribución de Frecuencia</p>
          <div className="flex items-end justify-between h-20 gap-1.5 px-1">
            {distribution.map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center group">
                <div className="relative w-full flex flex-col items-center justify-end h-full">
                  <span className={`text-[7px] font-mono mb-1 ${Number(val) > 0 ? (isLight ? 'text-slate-800' : 'text-white') : 'text-white/10'}`}>{Number(val)}</span>
                  <div 
                    className={`w-full rounded-t-sm transition-all duration-1000 bg-gradient-to-t from-cyan-600 to-cyan-400`} 
                    style={{ height: `${(Number(val) / maxVal) * 100}%`, minHeight: Number(val) > 0 ? '4px' : '1px' }} 
                  />
                </div>
                <span className="text-[7px] font-bold opacity-30 mt-2">T{idx+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- EL OJO CON PROYECCIÓN HOLOGRÁFICA (V9.0) ---
const LivingPortal = React.memo(({ mode, enginesReady, isLight, isGoPulseActive, isGoldMode, isFaseResult = false, lastWinningShot = null, isRunning, activeAlert = null }) => {
  const isSim = mode === MODOS.SIMULACION; 
  const isGold = Boolean(isGoldMode);
  const baseColor = enginesReady === 4 ? '#00EDFF' : mode === MODOS.VISOR ? '#10b981' : isSim ? '#8A2BE2' : '#00EDFF';
  
  let color = isGold ? '#BF953F' : baseColor;
  if (isFaseResult) {
    color = lastWinningShot ? (isGold ? '#BF953F' : '#00EDFF') : '#ef4444';
  }

  const alertColor = useMemo(() => {
    if (!activeAlert) return null;
    switch (String(activeAlert.type)) {
      case 'balance':
        return '#ec4899'; // rosa
      case 'error':
        return '#ef4444'; // rojo
      case 'diagnostic':
        return '#facc15'; // amarillo
      default:
        return '#22d3ee'; // cyan
    }
  }, [activeAlert]);

  const intensity = useMemo(() => {
    if (!activeAlert) return 'normal';
    const p = Number(activeAlert.priority);
    if (p === 1) return 'high';
    if (p === 2) return 'medium';
    if (p >= 3) return 'low';
    return 'normal';
  }, [activeAlert]);

  const effectiveColor = alertColor || color;

  const armaniCurve = "all 1500ms cubic-bezier(0.22, 1, 0.36, 1)";
  const portalGlowBlur = isGoPulseActive ? (isGold ? 'blur(104px)' : 'blur(96px)') : 'blur(60px)';

  // Función de proyección usando HTML/React Icons sobre la pupila negra
  const renderHologram = () => {
    if (!isFaseResult) return null;

    if (!lastWinningShot) {
      return <AlertTriangle size={36} className="text-red-500 figura-proyeccion" />;
    }

    switch(Number(lastWinningShot)) {
      case 1: return <Crown size={36} className="text-yellow-400 figura-proyeccion" />;
      case 2: case 3: return <Trophy size={36} className="text-cyan-400 figura-proyeccion" />;
      case 4: case 5: return <TargetIcon size={36} className="text-purple-400 figura-proyeccion" />;
      case 6: return <Zap size={36} className="text-white figura-proyeccion" />;
      default: return <Sparkles size={36} className="text-cyan-400 figura-proyeccion" />;
    }
  };

  return (
    <div
      className="relative flex items-center justify-center overflow-visible"
      data-layer="portal"
      data-z="10"
      style={{ width: '256px', height: '256px', transition: armaniCurve, transform: isGoPulseActive ? 'scale(1.05)' : 'scale(1)' }}
    >
      
      {/* Background Glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={
          intensity === 'high'
            ? { scale: [1, 1.15, 1] }
            : intensity === 'medium'
              ? { scale: [1, 1.08, 1] }
              : { scale: 1 }
        }
        transition={{
          repeat: Infinity,
          duration: intensity === 'high' ? 1 : intensity === 'medium' ? 1.6 : 2.2,
          ease: 'easeInOut',
        }}
        style={{
          transition: 'all 0.4s ease',
          opacity: isGoPulseActive ? 0.35 : 0.2,
          filter: portalGlowBlur,
          transform: isGoPulseActive ? 'scale(1.05)' : 'scale(1.0)',
          backgroundColor: effectiveColor,
          boxShadow: isGold ? '0 0 60px rgba(191, 149, 63, 0.4)' : 'none',
        }}
      />
      
      {/* Pulse Ring */}
      {(isRunning || isFaseResult) && (
        <div
          className="absolute inset-0 border border-white/10 rounded-full pulse-ring"
          style={{
            borderColor: effectiveColor,
            transition: 'all 0.4s ease',
            borderWidth: isGoPulseActive ? '2px' : '1px',
            opacity: isGoPulseActive ? 0.8 : 0.6,
          }}
        />
      )}
      
      {/* Ojo Base SVG */}
      <svg viewBox="0 0 200 200" className="w-full h-full relative z-10" style={{ transition: armaniCurve }}>
        <defs>
          <radialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
             <stop offset="0%" stopColor={isGold ? "#FCF6BA" : "white"} />
             <stop offset="40%" stopColor={effectiveColor} />
             <stop offset="100%" stopColor={isLight ? "#F1F5F9" : "#050011"} />
          </radialGradient>
          <linearGradient id="goldEnergyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
             <stop offset="0%" stopColor="#BF953F" />
             <stop offset="50%" stopColor="#FCF6BA" />
             <stop offset="100%" stopColor="#B38728" />
          </linearGradient>
        </defs>

        {isGoPulseActive && !isGold && <g>{[1.1, 1.2, 1.3].map((s, i) => (<circle key={`gp-${i}`} cx="100" cy="100" r="45" fill="none" stroke="rgba(0, 237, 255, 0.35)" strokeWidth="0.45" style={{ animation: `gold-wave-pulse ${2 + i}s infinite linear` }} />))}</g>}
        {isGold && <g>{[1.1, 1.2, 1.3].map((s, i) => (<circle key={i} cx="100" cy="100" r="45" fill="none" stroke="url(#goldEnergyGrad)" strokeWidth="0.5" style={{ animation: `gold-wave-pulse ${2 + i}s infinite linear` }} />))}</g>}
        
        <g className={(isRunning || isFaseResult) ? "vortex-spin" : ""}>
          <circle cx="100" cy="100" r={95} fill="none" stroke={isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.04)"} strokeWidth="0.5" strokeDasharray="10 5" />
          <circle cx="100" cy="100" r={isGoPulseActive ? 87 : 85} fill="none" stroke={effectiveColor} style={{ transition: 'all 0.4s ease', strokeWidth: 1.5, opacity: isGoPulseActive ? 0.3 : 0.15 }} />
        </g>
        
        <g className="oracle-eye" style={{ transition: 'all 0.4s ease', filter: isGoPulseActive ? (isLight ? 'drop-shadow(0 0 12px rgba(0,0,0,0.1))' : `drop-shadow(0 0 15px ${effectiveColor}55)`) : 'none' }}>
          {/* Esclerótica */}
          <circle cx="100" cy="100" r={isGoPulseActive ? "42" : "40"} fill={!lastWinningShot && isFaseResult ? "rgba(239, 68, 68, 0.15)" : isGold ? "url(#goldEnergyGrad)" : (isLight ? "#FFFFFF" : "rgba(255,255,255,0.95)")} stroke={isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)"} strokeWidth="1" />
          
          {/* Iris */}
          <circle cx="100" cy="100" r={isGoPulseActive ? "34" : "32"} fill="url(#portalGrad)" style={{ opacity: isGoPulseActive ? 0.9 : 0.85 }} />
          
          {/* PUPILA: En fase de resultado se dilata (r=28) y se vuelve negro puro para resaltar el holograma */}
          <circle cx="100" cy="100" r={isFaseResult ? 28 : (isRunning ? (isGoPulseActive ? 6 : 11) : 18)} fill={isFaseResult ? "#000000" : (isLight ? "#F1F5F9" : "#020008")} style={{ transition: armaniCurve }} />
          
          <path d="M100 92 Q108 100 100 108 Q92 100 100 92" fill={isGold ? "#000000" : (isLight ? "#0F172A" : "white")} className={(isRunning || isFaseResult) && !isFaseResult ? 'animate-pulse' : 'hidden'} />
        </g>
      </svg>

      {/* OVERLAY HOLOGRÁFICO: Centrado absoluto sobre la pupila */}
      {isFaseResult && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {renderHologram()}
        </div>
      )}
    </div>
  );
});

const ActiveTradingBalanceSelector = React.memo(function ActiveTradingBalanceSelector({
  activeWallet,
  onSelect,
  walletBalanceAig,
  walletBalanceUsdt,
  isLight,
  balanceAnimate,
  stake,
  mgLevels,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const maxUsableMulti = useMemo(() => multiMaxUsable(walletBalanceAig, walletBalanceUsdt), [walletBalanceAig, walletBalanceUsdt]);

  const operational = useMemo(() => {
    if (activeWallet === WALLET_MODE.AIG) return Number(walletBalanceAig);
    return maxUsableMulti;
  }, [activeWallet, walletBalanceAig, maxUsableMulti]);

  const peakBet = useMemo(
    () => Number(stake) * Math.pow(2, Math.max(0, Number(mgLevels) - 1)),
    [stake, mgLevels],
  );

  const multiPeakBlocked = useMemo(
    () => activeWallet === WALLET_MODE.MULTI && peakBet > 0 && !canExecuteMultiPair(walletBalanceAig, walletBalanceUsdt, peakBet),
    [activeWallet, peakBet, walletBalanceAig, walletBalanceUsdt],
  );

  const multiNearLimit = useMemo(() => {
    if (activeWallet !== WALLET_MODE.MULTI || peakBet <= 0) return false;
    if (multiPeakBlocked) return false;
    const slack = maxUsableMulti - peakBet;
    return slack >= 0 && slack < 0.15 * maxUsableMulti;
  }, [activeWallet, peakBet, maxUsableMulti, multiPeakBlocked]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const CoreWalletIcons = ({ mode, sizeClass = 'text-[16px]' }) =>
    mode === WALLET_MODE.AIG ? (
      <span className={`inline-flex items-center gap-0.5 shrink-0 ${sizeClass}`} aria-hidden>
        <span className="leading-none">🟣</span>
      </span>
    ) : (
      <span className={`inline-flex items-center gap-0.5 shrink-0 ${sizeClass}`} aria-hidden>
        <span className="leading-none">🟣</span>
        <span className="leading-none">🟢</span>
      </span>
    );

  const muted = isLight ? 'text-slate-500' : 'text-white/50';
  const main = isLight ? 'text-slate-900' : 'text-white';

  return (
    <div
      ref={rootRef}
      className={`relative z-20 flex flex-col items-end transition-all duration-300 ease-out ${balanceAnimate ? 'scale-110' : ''}`}
      data-layer="ui"
      data-z="20"
    >
      <span className={`armani-label-dynamic text-[7px] ${muted}`}>CARTERA_ACTIVA · IA_REAL</span>
      {activeWallet === WALLET_MODE.MULTI ? (
        <>
          <span className={`text-[9px] font-mono mt-0.5 text-right max-w-[220px] leading-tight ${muted}`}>
            AIG ${Number(walletBalanceAig).toFixed(4)} · USDT ${Number(walletBalanceUsdt).toFixed(2)}
          </span>
          <span className={`text-[9px] font-mono mt-0.5 text-right max-w-[220px] leading-tight ${muted}`}>
            Operable (2×min): ${maxUsableMulti.toFixed(2)} · {multiOperationalPerLeg(walletBalanceAig, walletBalanceUsdt).toFixed(2)}/leg
          </span>
          <span className={`text-[9px] font-mono mt-0.5 text-right max-w-[240px] leading-tight ${muted}`}>
            Excess AIG ${multiExcessAig(walletBalanceAig, walletBalanceUsdt).toFixed(2)} · USDT ${multiExcessUsdt(walletBalanceAig, walletBalanceUsdt).toFixed(2)}
          </span>
        </>
      ) : null}
      {multiPeakBlocked ? (
        <span className={`text-[9px] mt-0.5 text-right max-w-[220px] leading-snug flex items-center justify-end gap-1 ${isLight ? 'text-red-700' : 'text-red-400'}`}>
          <AlertTriangle size={11} className="shrink-0" aria-hidden />
          Cupo Multi insuficiente para T{Number(mgLevels)} (pico ${peakBet.toFixed(2)}).
        </span>
      ) : multiNearLimit ? (
        <span className={`text-[9px] mt-0.5 text-right max-w-[220px] leading-snug ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
          Cerca del límite operativo 50/50 para esta escalera.
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all ease-out duration-300 ${
          multiPeakBlocked
            ? isLight
              ? 'border-red-300 bg-red-50/90 ring-2 ring-red-400/45 hover:border-red-400'
              : 'border-red-500/40 bg-red-950/20 ring-2 ring-red-500/45 hover:border-red-500/60'
            : multiNearLimit
              ? isLight
                ? 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-400/40 hover:border-amber-400'
                : 'border-amber-500/35 bg-amber-500/10 ring-2 ring-amber-500/40 hover:border-amber-500/55'
              : isLight
                ? 'border-slate-200 bg-white hover:border-cyan-400'
                : 'border-white/10 bg-white/5 hover:border-cyan-500/40'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CoreWalletIcons mode={activeWallet} />
        <p className="text-lg font-mono font-black tabular-nums text-cyan-600 balance-glow">${operational.toFixed(2)}</p>
        <ChevronDown size={16} className={`shrink-0 opacity-60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          role="listbox"
          data-layer="ui"
          data-z="40"
          data-debug-anchor
          className={`absolute right-0 top-full z-40 mt-1.5 min-w-[228px] overflow-hidden rounded-xl border py-1 shadow-xl transition-all duration-200 ${
            isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-[rgba(10,2,30,0.97)] backdrop-blur-xl'
          }`}
        >
          {[
            { id: WALLET_MODE.AIG, label: 'AIG Wallet', combined: Number(walletBalanceAig), sub: null },
            {
              id: WALLET_MODE.MULTI,
              label: 'Multi Wallet',
              combined: maxUsableMulti,
              sub: `Custodia AIG ${Number(walletBalanceAig).toFixed(2)} · USDT ${Number(walletBalanceUsdt).toFixed(2)} | Exc. AIG ${multiExcessAig(walletBalanceAig, walletBalanceUsdt).toFixed(2)} · USDT ${multiExcessUsdt(walletBalanceAig, walletBalanceUsdt).toFixed(2)}`,
            },
          ].map((opt) => (
            <li key={opt.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={activeWallet === opt.id}
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-200 ${
                  activeWallet === opt.id
                    ? isLight
                      ? 'border-l-2 border-l-cyan-500 bg-cyan-500/10'
                      : 'border-l-2 border-l-cyan-400 bg-cyan-500/15'
                    : isLight
                      ? 'border-l-2 border-l-transparent hover:bg-slate-50'
                      : 'border-l-2 border-l-transparent hover:bg-white/5'
                }`}
              >
                <CoreWalletIcons mode={opt.id} sizeClass="text-[14px]" />
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{opt.label}</span>
                  <span className={`font-mono text-sm font-bold tabular-nums ${main}`}>
                    ${opt.combined.toFixed(opt.id === WALLET_MODE.AIG ? 4 : 2)}
                    {opt.id === WALLET_MODE.MULTI ? (
                      <span className={`block text-[8px] font-normal normal-case tracking-normal ${muted}`}>máx. 50/50 operable</span>
                    ) : null}
                  </span>
                  {opt.sub ? (
                    <span className={`text-[9px] font-mono font-normal ${muted}`}>{opt.sub}</span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

const WalletSlidePanel = React.memo(function WalletSlidePanel({
  open,
  onClose,
  isLight,
  userWalletAddress,
  userWalletAuthToken,
  setUserWalletAuthToken,
  userWalletSessionRef,
  onConnectWallet,
  onDisconnectWallet,
  onTrustWalletFlow,
  walletMode,
  setWalletMode,
  subView,
  setSubView,
  balanceAig,
  balanceUsdt,
  setBalanceAig,
  setBalanceUsdt,
  wageringAig,
  wageringDual,
  onWagerDeposit,
  walletTxHistory,
  appendWalletTx,
  logTransaction,
  queueWaiting = 0,
}) {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawToken, setWithdrawToken] = useState('AIG');
  const [withdrawExcessOnly, setWithdrawExcessOnly] = useState(true);
  const [demoInAmount, setDemoInAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [txFlow, setTxFlow] = useState({
    open: false,
    state: TX_FLOW_STATE.IDLE,
    txHash: '',
    error: '',
    title: '',
  });
  const txFlowStatesLogRef = useRef([]);
  const { actions: queueAdaptation } = useSystemActions({ transactions: walletTxHistory, queueWaiting });

  const closeTxFlow = useCallback(() => {
    setTxFlow({
      open: false,
      state: TX_FLOW_STATE.IDLE,
      txHash: '',
      error: '',
      title: '',
    });
  }, []);

  useEffect(() => {
    if (!txFlow.open) return;
    const st = txFlow.state;
    if (!st || st === TX_FLOW_STATE.IDLE) return;
    const log = txFlowStatesLogRef.current;
    const prev = log[log.length - 1];
    if (prev?.state === st) return;
    const now = Date.now();
    txFlowStatesLogRef.current = [...log, { state: st, at: now }];
  }, [txFlow.open, txFlow.state]);

  const appendWalletTxWithFlow = useCallback(
    (row) => {
      const snapshot = normalizeFlowStatesFromLog(txFlowStatesLogRef.current);
      const withFlow = snapshot.length ? { ...row, flowStates: snapshot } : row;
      appendWalletTx(withFlow);
    },
    [appendWalletTx],
  );

  useEffect(() => {
    onTrustWalletFlow?.({
      open: txFlow.open,
      state: txFlow.state,
    });
  }, [txFlow.open, txFlow.state, onTrustWalletFlow]);

  const [walletNativeBalance, setWalletNativeBalance] = useState(null);
  useEffect(() => {
    if (isWeb3MockMode()) {
      setWalletNativeBalance(null);
      return undefined;
    }
    const injected = getInjectedEthereum();
    if (!userWalletAddress || typeof window === 'undefined' || !injected) {
      setWalletNativeBalance(null);
      return undefined;
    }
    let cancelled = false;
    const readBal = async () => {
      try {
        const provider = new BrowserProvider(injected);
        const bal = await provider.getBalance(userWalletAddress);
        if (!cancelled) setWalletNativeBalance(formatEther(bal));
      } catch {
        if (!cancelled) setWalletNativeBalance(null);
      }
    };
    readBal();
    const chainListener = () => {
      readBal();
    };
    let unsubChain = () => {};
    if (typeof injected.on === 'function') {
      try {
        injected.on('chainChanged', chainListener);
        unsubChain = () => {
          try {
            if (typeof injected.removeListener === 'function') injected.removeListener('chainChanged', chainListener);
            else if (typeof injected.off === 'function') injected.off('chainChanged', chainListener);
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* ignore */
      }
    }
    return () => {
      cancelled = true;
      unsubChain();
    };
  }, [userWalletAddress]);

  const combinedTotal = useMemo(() => Number(balanceAig) + Number(balanceUsdt), [balanceAig, balanceUsdt]);
  const isMulti = walletMode === WALLET_MODE.MULTI;
  const multiOpLeg = useMemo(() => multiOperationalPerLeg(balanceAig, balanceUsdt), [balanceAig, balanceUsdt]);
  const multiExcAig = useMemo(() => multiExcessAig(balanceAig, balanceUsdt), [balanceAig, balanceUsdt]);
  const multiExcUsdt = useMemo(() => multiExcessUsdt(balanceAig, balanceUsdt), [balanceAig, balanceUsdt]);
  const multiOpTotal = useMemo(() => multiMaxUsable(balanceAig, balanceUsdt), [balanceAig, balanceUsdt]);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {}
  };

  const DEBUG_MOCK_TX_FAIL =
    import.meta.env.DEV && typeof window !== 'undefined' && window.DEBUG_MOCK_TX_FAIL === true;
  const shouldFail = () => DEBUG_MOCK_TX_FAIL && Math.random() < 0.2;

  const mockDeposit = async (amount, userAddress) => {
    const txHash = generateMockTxHash();
    appendWalletTxWithFlow({
      kind: 'deposit',
      token: walletMode === WALLET_MODE.AIG ? 'AIG' : 'AIG+USDT',
      amount,
      note: walletMode === WALLET_MODE.AIG ? undefined : '50/50 ingreso · operativo/excedente en panel',
      status: MOCK_TX_STATUS.PENDING,
      txHash,
    });

    await delay(1_500);
    if (shouldFail()) {
      appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.FAILED });
      return { ok: false, txHash, status: MOCK_TX_STATUS.FAILED };
    }

    appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.CONFIRMING });
    await delay(2_000);
    if (shouldFail()) {
      appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.FAILED });
      return { ok: false, txHash, status: MOCK_TX_STATUS.FAILED };
    }

    if (walletMode === WALLET_MODE.AIG) {
      const nextA = Number(balanceAig) + amount;
      setBalanceAig((p) => Number(p) + amount);
      onWagerDeposit?.('AIG', amount);
      logTransaction?.({
        walletType: 'AIG',
        action: 'deposit',
        amount,
        aigAmount: amount,
        usdtAmount: 0,
        balanceAfter: nextA,
        walletAddress: userAddress,
      });
    } else {
      const half = amount / 2;
      const nextA = Number(balanceAig) + half;
      const nextU = Number(balanceUsdt) + half;
      setBalanceAig((p) => Number(p) + half);
      setBalanceUsdt((p) => Number(p) + half);
      onWagerDeposit?.('DUAL', amount);
      logTransaction?.({
        walletType: 'DUAL',
        action: 'deposit',
        amount,
        aigAmount: half,
        usdtAmount: half,
        balanceAfter: multiMaxUsable(nextA, nextU),
        walletAddress: userAddress,
      });
    }

    appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.COMPLETED });
    return { ok: true, txHash, status: MOCK_TX_STATUS.COMPLETED };
  };

  const mockWithdraw = async (amount, userAddress) => {
    const isMulti = walletMode === WALLET_MODE.MULTI;
    const token = isMulti ? withdrawToken : 'AIG';
    const note = isMulti ? (withdrawExcessOnly ? 'solo excedente' : 'incl. operativo') : undefined;

    const txHash = generateMockTxHash();
    appendWalletTxWithFlow({
      kind: 'withdraw',
      token,
      amount,
      note,
      status: MOCK_TX_STATUS.PENDING,
      txHash,
    });

    await delay(1_500);
    if (shouldFail()) {
      appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.FAILED });
      setWithdrawError('Mock tx failed (debug mode).');
      return { ok: false, txHash, status: MOCK_TX_STATUS.FAILED };
    }

    appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.CONFIRMING });
    await delay(2_000);
    if (shouldFail()) {
      appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.FAILED });
      setWithdrawError('Mock tx failed (debug mode).');
      return { ok: false, txHash, status: MOCK_TX_STATUS.FAILED };
    }

    const prevA = Number(balanceAig);
    const prevU = Number(balanceUsdt);
    const nextA = token === 'AIG' ? prevA - amount : prevA;
    const nextU = token === 'USDT' ? prevU - amount : prevU;
    if (token === 'USDT') setBalanceUsdt((p) => Number(p) - amount);
    else setBalanceAig((p) => Number(p) - amount);

    appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.COMPLETED });
    logTransaction?.({
      walletType: isMulti ? 'DUAL' : 'AIG',
      action: 'withdraw',
      amount,
      aigAmount: token === 'AIG' ? amount : 0,
      usdtAmount: token === 'USDT' ? amount : 0,
      balanceAfter: isMulti ? multiMaxUsable(nextA, nextU) : nextA,
      walletAddress: userAddress,
    });
    return { ok: true, txHash, status: MOCK_TX_STATUS.COMPLETED };
  };

  function isTxAlreadyProcessed(txHash) {
    const h = String(txHash || '');
    if (!h) return false;
    return (Array.isArray(walletTxHistory) ? walletTxHistory : []).some(
      (tx) => String(tx?.txHash || '') === h && tx?.status === MOCK_TX_STATUS.COMPLETED,
    );
  }

  async function realDeposit(amount, userAddress) {
    if (isWeb3MockMode()) throw new Error('No Web3 wallet');
    const injected = typeof window !== 'undefined' ? getInjectedEthereum() : null;
    if (!injected) throw new Error('No Web3 wallet');
    if (!userWalletAddress) {
      console.warn('Deposit attempted without wallet');
      throw new Error('Wallet not connected');
    }

    const provider = new BrowserProvider(injected);
    const network = await provider.getNetwork();
    if (network?.chainId !== 1n) {
      console.warn('Invalid network:', network?.chainId);
      throw new Error('Wrong network. Please switch to Ethereum');
    }
    const signer = await provider.getSigner();

    const MASTER_WALLET_ADDRESS = String(import.meta.env.VITE_MASTER_WALLET_ADDRESS || '').trim();
    if (!MASTER_WALLET_ADDRESS) throw new Error('Missing VITE_MASTER_WALLET_ADDRESS');
    console.info('MASTER WALLET:', MASTER_WALLET_ADDRESS);

    let txHash = '';
    try {
      const tx = await signer.sendTransaction({
        to: MASTER_WALLET_ADDRESS,
        value: parseEther(String(amount)),
      });

      txHash = String(tx?.hash || '');

      appendWalletTxWithFlow({
        kind: 'deposit',
        token: walletMode === WALLET_MODE.AIG ? 'AIG' : 'AIG+USDT',
        amount,
        note: walletMode === WALLET_MODE.AIG ? undefined : '50/50 ingreso · operativo/excedente en panel',
        status: MOCK_TX_STATUS.PENDING,
        txHash,
      });

      logTransaction?.({
        walletType: walletMode === WALLET_MODE.MULTI ? 'DUAL' : 'AIG',
        action: 'deposit',
        amount,
        txHash,
        status: 'PENDING',
        walletAddress: userAddress,
      });

      console.info('Waiting for confirmations...');
      const receipt = await provider.waitForTransaction(txHash, 2);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed on-chain');
      }

      const txData = await provider.getTransaction(txHash);
      const toAddress = txData?.to ? String(txData.to).toLowerCase() : '';
      const expectedAddress = String(MASTER_WALLET_ADDRESS).toLowerCase();
      if (!toAddress || toAddress !== expectedAddress) {
        throw new Error('Invalid destination address');
      }
      const txValue = txData?.value ?? 0n; // BigInt
      const expectedValue = parseEther(String(amount));
      if (txValue < expectedValue) {
        throw new Error('Invalid deposit amount');
      }

      // Backend verification authority (local): only credit if verified.
      try {
        const BACKEND_URL = String(import.meta.env.VITE_BACKEND_URL || '').trim();
        const baseUrl = BACKEND_URL || 'http://localhost:5050';
        if (!BACKEND_URL) console.warn('Missing VITE_BACKEND_URL; using fallback', { baseUrl });

        const resp = await fetch(`${baseUrl}/api/verify-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash, amount, userAddress }),
        });
        const payload = await resp.json().catch(() => ({}));
        console.info('verify-deposit response', { ok: resp.ok, status: resp.status, payload });
        if (!resp.ok || payload?.success !== true) {
          throw new Error(payload?.reason || 'BACKEND_VERIFY_FAILED');
        }
      } catch (e) {
        appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.FAILED });
        console.error('Backend verify-deposit failed:', e);
        throw e;
      }

      if (isTxAlreadyProcessed(txHash)) {
        console.info('TX already processed — skipping credit', { txHash });
        return { ok: true, txHash, status: MOCK_TX_STATUS.COMPLETED, skippedCredit: true };
      }

      // Credit balance using the same logic as mockDeposit.
      if (walletMode === WALLET_MODE.AIG) {
        const nextA = Number(balanceAig) + amount;
        setBalanceAig((p) => Number(p) + amount);
        onWagerDeposit?.('AIG', amount);
        logTransaction?.({
          walletType: 'AIG',
          action: 'deposit',
          amount,
          aigAmount: amount,
          usdtAmount: 0,
          balanceAfter: nextA,
          walletAddress: userAddress,
          txHash,
          status: 'COMPLETED',
        });
      } else {
        const half = amount / 2;
        const nextA = Number(balanceAig) + half;
        const nextU = Number(balanceUsdt) + half;
        setBalanceAig((p) => Number(p) + half);
        setBalanceUsdt((p) => Number(p) + half);
        onWagerDeposit?.('DUAL', amount);
        logTransaction?.({
          walletType: 'DUAL',
          action: 'deposit',
          amount,
          aigAmount: half,
          usdtAmount: half,
          balanceAfter: multiMaxUsable(nextA, nextU),
          walletAddress: userAddress,
          txHash,
          status: 'COMPLETED',
        });
      }

      appendWalletTxWithFlow({ txHash, status: MOCK_TX_STATUS.COMPLETED });
      return { ok: true, txHash, status: MOCK_TX_STATUS.COMPLETED };
    } catch (error) {
      console.error('realDeposit error:', error);
      appendWalletTxWithFlow({ txHash: txHash || 'unknown', status: MOCK_TX_STATUS.FAILED });
      logTransaction?.({
        walletType: walletMode === WALLET_MODE.MULTI ? 'DUAL' : 'AIG',
        action: 'deposit',
        amount,
        txHash: txHash || 'unknown',
        status: 'FAILED',
        walletAddress: userAddress,
      });
      throw error;
    }
  }

  async function realWithdraw(amount, userAddress) {
    console.info('REAL withdraw not implemented yet', { amount, userAddress });
    return { ok: false, status: 'NOT_IMPLEMENTED' };
  }

  async function handleDepositFlow(amount, userAddress) {
    if (WEB3_MODE === 'MOCK') return await mockDeposit(amount, userAddress);
    return await realDeposit(amount, userAddress);
  }

  async function handleWithdrawFlow(amount, userAddress) {
    if (WEB3_MODE === 'MOCK') return await mockWithdraw(amount, userAddress);
    return await realWithdraw(amount, userAddress);
  }

  const handleWithdrawSubmit = async () => {
    setWithdrawError('');
    const wagering = isMulti ? wageringDual : wageringAig;
    if (wagering && wagering.unlocked === false) {
      setWithdrawError('Withdrawal locked — complete wagering volume for this wallet.');
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    let avail;
    const token = isMulti ? withdrawToken : 'AIG';
    if (isMulti) {
      const exA = multiExcessAig(balanceAig, balanceUsdt);
      const exU = multiExcessUsdt(balanceAig, balanceUsdt);
      if (withdrawExcessOnly) avail = token === 'USDT' ? exU : exA;
      else avail = token === 'USDT' ? Number(balanceUsdt) : Number(balanceAig);
    } else avail = token === 'USDT' ? Number(balanceUsdt) : Number(balanceAig);
    if (amt > avail) return;

    if (!userWalletAddress) {
      setWithdrawError('Connect wallet to request a withdrawal.');
      return;
    }

    txFlowStatesLogRef.current = [];
    const withdrawHasAuth = Boolean(String(userWalletAuthToken || '').trim());
    setTxFlow({
      open: true,
      state:
        WEB3_MODE === 'MOCK'
          ? TX_FLOW_STATE.SIGNING
          : withdrawHasAuth
            ? TX_FLOW_STATE.BROADCASTING
            : TX_FLOW_STATE.SIGNING,
      title: 'Retiro',
      txHash: '',
      error: '',
    });

    try {
      if (WEB3_MODE === 'MOCK') {
        await new Promise((r) => setTimeout(r, 200));
        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.BROADCASTING }));
        const userAddress = userWalletAddress || (
          walletMode === WALLET_MODE.AIG
            ? DEMO_WALLET_ADDRESS_AIG
            : `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}`
        );
        const result = await handleWithdrawFlow(amt, userAddress);
        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.CONFIRMING }));
        await new Promise((r) => setTimeout(r, 300));
        if (!result?.ok) {
          throw new Error(String(result?.status || 'WITHDRAW_FAILED'));
        }
        setTxFlow((s) => ({
          ...s,
          state: TX_FLOW_STATE.SUCCESS,
          txHash: result?.txHash || '',
        }));
        setWithdrawAmount('');
        return;
      }

      const BACKEND_URL = String(import.meta.env.VITE_BACKEND_URL || '').trim();
      const baseUrl = BACKEND_URL || 'http://localhost:5050';
      if (!BACKEND_URL) console.warn('Missing VITE_BACKEND_URL; using fallback', { baseUrl });

      let authToken = String(userWalletAuthToken || '').trim();
      if (!authToken) {
        const msgResp = await fetch(`${baseUrl}/api/auth/request-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userWalletAddress }),
        });
        const msgPayload = await msgResp.json().catch(() => ({}));
        if (!msgResp.ok || !msgPayload?.message) {
          throw new Error(msgPayload?.reason || 'AUTH_MESSAGE_FAILED');
        }
        const message = String(msgPayload.message);

        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.SIGNING }));
        const injected = getInjectedEthereum();
        if (!injected) throw new Error('No Web3 wallet');
        const provider = new BrowserProvider(injected);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(message);

        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.BROADCASTING }));
        const verResp = await fetch(`${baseUrl}/api/auth/verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userWalletAddress, signature, message }),
        });
        const verPayload = await verResp.json().catch(() => ({}));
        if (!verResp.ok || verPayload?.success !== true || !verPayload?.token) {
          throw new Error(verPayload?.reason || 'AUTH_VERIFY_FAILED');
        }
        authToken = String(verPayload.token);
        setUserWalletAuthToken?.(authToken);
      }

      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.BROADCASTING }));
      const useAsyncWithdraw = import.meta.env.VITE_WITHDRAW_ASYNC === 'true';
      const resp = await fetch(`${baseUrl}/api/request-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          userAddress: userWalletAddress,
          amount: amt,
          ...(useAsyncWithdraw ? { async: true } : {}),
          queuePriorityStrategy: queueAdaptation.queuePriorityStrategy,
          retryPolicy: queueAdaptation.retryPolicy,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      console.info('request-withdraw response', { ok: resp.ok, status: resp.status, payload });
      if (!resp.ok || payload?.success !== true) {
        throw new Error(payload?.reason || 'WITHDRAW_REQUEST_FAILED');
      }

      if (payload?.status === 'processing' && payload?.requestId) {
        appendWalletTxWithFlow({
          kind: 'withdraw',
          token: 'ETH',
          amount: amt,
          note: 'Queued — finalizing on-chain',
          status: MOCK_TX_STATUS.PENDING,
          txHash: `req:${payload.requestId}`,
          requestId: String(payload.requestId),
        });
        setWithdrawError(`Queued · ${String(payload.requestId)}`);
        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.SUCCESS, txHash: '' }));
        setWithdrawAmount('');
        return;
      }

      const txHash = String(payload?.txHash || '');
      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.CONFIRMING, txHash }));
      await new Promise((r) => setTimeout(r, 350));

      if (txHash) {
        appendWalletTxWithFlow({
          kind: 'withdraw',
          token: 'ETH',
          amount: amt,
          note: 'backend withdrawal',
          status: MOCK_TX_STATUS.COMPLETED,
          txHash,
        });
        setWithdrawError(`TxHash: ${txHash}`);
      } else {
        setWithdrawError('Withdraw request accepted (no txHash returned).');
      }
      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.SUCCESS, txHash }));
    } catch (e) {
      const msg = String(e?.message || 'Withdrawal failed');
      setWithdrawError(msg);
      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.ERROR, error: msg }));
    }
    setWithdrawAmount('');
  };

  const handleDemoInbound = async () => {
    const amt = parseFloat(demoInAmount);
    if (Number.isNaN(amt) || amt <= 0) return;
    if (isDepositing) return;

    const depositNeedsWalletConnect = WEB3_MODE === 'REAL' && !userWalletAddress;
    txFlowStatesLogRef.current = [];
    setTxFlow({
      open: true,
      state: depositNeedsWalletConnect
        ? TX_FLOW_STATE.CONNECTING
        : WEB3_MODE === 'REAL'
          ? TX_FLOW_STATE.SIGNING
          : TX_FLOW_STATE.BROADCASTING,
      title: 'Depósito',
      txHash: '',
      error: '',
    });
    setIsDepositing(true);

    try {
      if (depositNeedsWalletConnect) {
        await onConnectWallet?.();
        setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.SIGNING }));
      }

      const userAddress = userWalletAddress || (
        walletMode === WALLET_MODE.AIG
          ? DEMO_WALLET_ADDRESS_AIG
          : `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}`
      );
      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.BROADCASTING }));

      const result = await handleDepositFlow(amt, userAddress);

      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.CONFIRMING, txHash: result?.txHash || s.txHash }));
      await new Promise((r) => setTimeout(r, 380));

      if (result?.ok === false || result?.status === MOCK_TX_STATUS.FAILED) {
        throw new Error('Deposit failed');
      }

      setTxFlow((s) => ({
        ...s,
        state: TX_FLOW_STATE.SUCCESS,
        txHash: result?.txHash || '',
      }));
      setDemoInAmount('');
    } catch (e) {
      const msg = String(e?.message || e || 'Deposit failed');
      setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.ERROR, error: msg }));
    } finally {
      setIsDepositing(false);
    }
  };

  const qrUrl = (data) => `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(data)}`;

  const panelBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[rgba(10,2,30,0.92)] border-white/10';
  const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10';
  const textMuted = isLight ? 'text-slate-500' : 'text-white/50';
  const textMain = isLight ? 'text-slate-900' : 'text-white';

  return (
    <>
      <div
        role="presentation"
        data-layer="overlay"
        data-z="50"
        data-debug-anchor
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />
      <aside
        data-layer="overlay"
        data-z="50"
        data-debug-anchor
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[420px] shadow-[-12px_0_40px_rgba(0,0,0,0.35)] border-l flex flex-col transition-transform duration-300 ease-out ${panelBg} backdrop-blur-xl ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <div className={`flex items-center justify-between p-5 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            {subView !== WALLET_VIEWS.MAIN ? (
              <button type="button" onClick={() => setSubView(WALLET_VIEWS.MAIN)} className={`p-2 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'} ${textMain}`} aria-label="Back">
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div className="flex items-center gap-2">
              <Wallet size={22} className="text-cyan-500" />
              <div>
                <p className={`armani-label-dynamic opacity-70 text-[8px] ${textMuted}`}>WEB3</p>
                <h2 className={`text-lg font-light tracking-[0.2em] uppercase ${textMain}`}>{subView === WALLET_VIEWS.MAIN ? 'Wallet' : subView === WALLET_VIEWS.DEPOSIT ? 'Depósito' : subView === WALLET_VIEWS.WITHDRAW ? 'Retiro' : 'Historial'}</h2>
                {userWalletAddress ? (
                  <p className={`text-[9px] font-mono mt-1 ${textMuted}`}>Connected: {String(userWalletAddress)}</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {typeof window !== 'undefined' && !isWeb3MockMode() && getInjectedEthereum() && onConnectWallet ? (
              <WalletConnectButton
                isLight={isLight}
                address={userWalletAddress}
                nativeBalance={walletNativeBalance}
                nativeSymbol="BNB"
                busy={txFlow.open && txFlow.state === TX_FLOW_STATE.CONNECTING}
                onDisconnect={onDisconnectWallet}
                onPress={async () => {
                  if (userWalletAddress) return;
                  setTxFlow({
                    open: true,
                    state: TX_FLOW_STATE.CONNECTING,
                    title: 'Wallet',
                    txHash: '',
                    error: '',
                  });
                  try {
                    await onConnectWallet();
                    setTxFlow((s) => ({ ...s, state: TX_FLOW_STATE.SUCCESS }));
                    window.setTimeout(() => closeTxFlow(), 1600);
                  } catch (e) {
                    setTxFlow((s) => ({
                      ...s,
                      state: TX_FLOW_STATE.ERROR,
                      error: String(e?.message || e || 'Connection failed'),
                    }));
                  }
                }}
              />
            ) : null}
            <button type="button" onClick={onClose} className={`p-2 rounded-xl ${textMuted} hover:text-cyan-500 transition-colors`} aria-label="Close wallet">
              <XCircle size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          {subView === WALLET_VIEWS.MAIN && (
            <>
              <div className={`flex rounded-2xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-white/10'}`}>
                <button type="button" onClick={() => setWalletMode(WALLET_MODE.AIG)} className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-[0.25em] uppercase transition-all ${walletMode === WALLET_MODE.AIG ? 'bg-cyan-500 text-white shadow-lg' : textMuted}`}>AIG</button>
                <button type="button" onClick={() => setWalletMode(WALLET_MODE.MULTI)} className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-[0.25em] uppercase transition-all ${walletMode === WALLET_MODE.MULTI ? 'bg-cyan-500 text-white shadow-lg' : textMuted}`}>MULTI</button>
              </div>

              <p className={`text-[10px] ${textMuted} leading-relaxed`}>{walletMode === WALLET_MODE.AIG ? 'Cartera AIG 100% — saldo exclusivo en AIG.' : 'Cartera multi-activo: AIG y USDT en ratio 50/50 para operaciones combinadas.'}</p>
              <p className={`text-[9px] ${textMuted} opacity-80 leading-snug`}>Todo ingreso y retiro de capital se gestiona únicamente desde este panel Wallet.</p>

              <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
                {walletMode === WALLET_MODE.AIG ? (
                  <div>
                    <p className={`armani-label-dynamic mb-1 ${textMuted}`}>AIG</p>
                    <p className={`text-3xl font-mono font-black text-cyan-500`}>{Number(balanceAig).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} <span className="text-xs font-bold opacity-60">AIG</span></p>
                  </div>
                ) : (
                  <>
                    <div className={`rounded-xl border p-3 mb-3 ${isLight ? 'border-cyan-200 bg-cyan-50/80' : 'border-cyan-500/25 bg-cyan-500/5'}`}>
                      <p className={`armani-label-dynamic mb-1 ${textMuted}`}>Operativo (apuestas 50/50)</p>
                      <p className={`font-mono text-lg font-black text-cyan-600`}>${multiOpTotal.toFixed(2)}</p>
                      <p className={`text-[10px] font-mono ${textMuted}`}>{multiOpLeg.toFixed(4)} AIG / pierna · {multiOpLeg.toFixed(2)} USDT / pierna</p>
                      <p className={`text-[9px] mt-2 leading-snug ${textMuted}`}>Solo este cupo participa en IA Real Multi. No se usa excedente automáticamente.</p>
                    </div>
                    <div className={`rounded-xl border p-3 mb-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/20'}`}>
                      <p className={`armani-label-dynamic mb-2 ${textMuted}`}>Excedente (reserva / no operativo)</p>
                      <div className="flex justify-between gap-3 text-sm font-mono">
                        <span className={textMain}>AIG <span className="text-amber-600/90">{multiExcAig.toFixed(4)}</span></span>
                        <span className={textMain}>USDT <span className="text-emerald-600/90">{multiExcUsdt.toFixed(2)}</span></span>
                      </div>
                      <p className={`text-[9px] mt-2 ${textMuted}`}>Retira excedente sin tocar el par 50/50 (modo recomendado en Retiros). Puede conservarse como reserva.</p>
                    </div>
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className={`armani-label-dynamic mb-1 ${textMuted}`}>Custodia AIG</p>
                        <p className={`text-xl font-mono font-black ${textMain}`}>{Number(balanceAig).toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`armani-label-dynamic mb-1 ${textMuted}`}>Custodia USDT</p>
                        <p className={`text-xl font-mono font-black ${textMain}`}>{Number(balanceUsdt).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className={`pt-3 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                      <p className={`armani-label-dynamic mb-1 ${textMuted}`}>Suma custodia</p>
                      <p className={`text-lg font-mono font-black ${textMuted}`}>{combinedTotal.toFixed(4)}</p>
                    </div>
                    <button type="button" disabled className={`mt-2 w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border opacity-50 cursor-not-allowed ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/10 text-white/40'}`}>
                      Convertir excedente (próximamente)
                    </button>
                  </>
                )}
              </div>

              {/* Wagering progress (per-wallet, independent) */}
              <div className={`rounded-2xl border p-5 ${cardBg}`}>
                {(() => {
                  const w = walletMode === WALLET_MODE.MULTI ? wageringDual : wageringAig;
                  const dep = Number(w?.depositAmount || 0);
                  const req = Number(w?.requiredVolume || 0);
                  const cur = Number(w?.currentVolume || 0);
                  const unlocked = Boolean(w?.unlocked);
                  const pct = req > 0 ? Math.max(0, Math.min(100, (cur / req) * 100)) : 100;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <p className={`armani-label-dynamic mb-1 ${textMuted}`}>Wagering</p>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          unlocked ? 'text-emerald-500' : (isLight ? 'text-amber-700' : 'text-amber-400')
                        }`}>
                          {unlocked ? 'UNLOCKED' : 'LOCKED'}
                        </span>
                      </div>
                      <p className={`text-[10px] font-mono ${textMuted}`}>
                        Deposit {dep.toFixed(2)} · Required {req.toFixed(2)} · Volume {cur.toFixed(2)}
                      </p>
                      <div className={`mt-3 h-2 rounded-full overflow-hidden border ${isLight ? 'border-slate-200 bg-slate-100' : 'border-white/10 bg-white/5'}`}>
                        <div
                          className={`h-full ${unlocked ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                          style={{ width: `${pct}%`, transition: 'width 260ms ease-out' }}
                        />
                      </div>
                      <p className={`mt-2 text-[9px] font-mono ${textMuted}`}>
                        {req > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </p>
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button type="button" onClick={() => setSubView(WALLET_VIEWS.DEPOSIT)} className={`flex items-center justify-center gap-2 py-4 rounded-2xl border font-black text-[10px] tracking-[0.2em] uppercase transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800 hover:border-cyan-400' : 'bg-cyan-500/10 border-cyan-500/30 text-white hover:bg-cyan-500/20'}`}>
                  <ArrowDownToLine size={18} className="text-cyan-500" /> Depósito
                </button>
                <button type="button" onClick={() => setSubView(WALLET_VIEWS.WITHDRAW)} className={`flex items-center justify-center gap-2 py-4 rounded-2xl border font-black text-[10px] tracking-[0.2em] uppercase transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800 hover:border-cyan-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                  <ArrowUpFromLine size={18} className="text-pink-500" /> Retiro
                </button>
                <button type="button" onClick={() => setSubView(WALLET_VIEWS.HISTORY)} className={`flex items-center justify-center gap-2 py-4 rounded-2xl border font-black text-[10px] tracking-[0.2em] uppercase transition-all ${isLight ? 'bg-white border-slate-200 text-slate-800 hover:border-cyan-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                  <History size={18} /> Historial
                </button>
              </div>
              <p className={`text-[8px] text-center font-mono uppercase tracking-widest ${textMuted} opacity-70`}>
                Deposit · Withdraw · History — demo flows (UI only)
              </p>
            </>
          )}

          {subView === WALLET_VIEWS.DEPOSIT && (
            <div className="space-y-6">
              {walletMode === WALLET_MODE.AIG ? (
                <div className={`rounded-2xl border p-5 ${cardBg}`}>
                  <p className={`armani-label-dynamic mb-3 ${textMuted}`}>Dirección AIG</p>
                  <div className="flex items-center gap-2">
                    <code className={`flex-1 text-[10px] font-mono break-all ${textMain}`}>{DEMO_WALLET_ADDRESS_AIG}</code>
                    <button type="button" onClick={() => copyText(DEMO_WALLET_ADDRESS_AIG)} className="p-2 rounded-lg border border-cyan-500/30 text-cyan-500 shrink-0" aria-label="Copy"><Copy size={16} /></button>
                  </div>
                  <div className="mt-5 flex justify-center">
                    <div className={`rounded-xl p-3 ${isLight ? 'bg-white' : 'bg-black/40'}`}><img src={qrUrl(DEMO_WALLET_ADDRESS_AIG)} alt="" className="w-[132px] h-[132px]" width={132} height={132} /></div>
                  </div>
                  <p className={`text-[10px] mt-4 ${textMuted}`}>Envía únicamente AIG a esta dirección. Verifica la red antes de transferir.</p>
                </div>
              ) : (
                <>
                  <div className={`rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 ${textMain}`}>
                    <p className="text-[10px] font-black tracking-widest uppercase text-amber-600 mb-1">Ingreso 50 / 50 y excedente</p>
                    <p className={`text-[11px] leading-relaxed ${textMuted}`}>El demo reparte el ingreso mitad AIG / mitad USDT. Tras acreditar, el <strong className={textMain}>operativo</strong> es el mínimo entre ambas custodias por pierna; el <strong className={textMain}>excedente</strong> queda en la pierna con saldo mayor (no entra en apuestas hasta equilibrar).</p>
                  </div>
                  <div className={`rounded-2xl border p-5 space-y-5 ${cardBg}`}>
                    <div>
                      <p className={`armani-label-dynamic mb-2 flex items-center gap-2 ${textMuted}`}><QrCode size={12} /> AIG</p>
                      <div className="flex items-center gap-2">
                        <code className={`flex-1 text-[10px] font-mono break-all ${textMain}`}>{DEMO_WALLET_ADDRESS_AIG}</code>
                        <button type="button" onClick={() => copyText(DEMO_WALLET_ADDRESS_AIG)} className="p-2 rounded-lg border border-cyan-500/30 text-cyan-500"><Copy size={16} /></button>
                      </div>
                      <div className="mt-3 flex justify-center"><img src={qrUrl(DEMO_WALLET_ADDRESS_AIG)} alt="" className="w-[112px] h-[112px] rounded-lg" width={112} height={112} /></div>
                    </div>
                    <div className={`border-t pt-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                      <p className={`armani-label-dynamic mb-2 flex items-center gap-2 ${textMuted}`}><QrCode size={12} /> USDT</p>
                      <div className="flex items-center gap-2">
                        <code className={`flex-1 text-[10px] font-mono break-all ${textMain}`}>{DEMO_WALLET_ADDRESS_USDT}</code>
                        <button type="button" onClick={() => copyText(DEMO_WALLET_ADDRESS_USDT)} className="p-2 rounded-lg border border-cyan-500/30 text-cyan-500"><Copy size={16} /></button>
                      </div>
                      <div className="mt-3 flex justify-center"><img src={qrUrl(DEMO_WALLET_ADDRESS_USDT)} alt="" className="w-[112px] h-[112px] rounded-lg" width={112} height={112} /></div>
                    </div>
                  </div>
                </>
              )}

              <div className={`rounded-2xl border p-4 ${cardBg}`}>
                <p className={`armani-label-dynamic mb-2 ${textMuted}`}>Registrar ingreso (demo)</p>
                <p className={`text-[9px] mb-2 ${textMuted}`}>Actualiza custodia en cadena. En Multi, operativo y excedente se recalculan de forma transparente (min por pierna).</p>
                <input type="number" step="any" min="0" placeholder="Monto" value={demoInAmount} onChange={(e) => setDemoInAmount(e.target.value)} className={`w-full rounded-xl border p-3 font-mono text-sm outline-none ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-black/30 text-white'}`} />
                <button type="button" onClick={handleDemoInbound} className={`mt-3 w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>Registrar demo</button>
                {walletMode === WALLET_MODE.MULTI ? (
                  <p className={`text-[9px] mt-2 ${textMuted}`}>Primero equilibra vía 50/50 sobre el ingreso; el sistema deriva operativo = min(AIG,USDT) por pierna y excedente en la pierna sobrante.</p>
                ) : null}
              </div>
            </div>
          )}

          {subView === WALLET_VIEWS.WITHDRAW && (
            <div className={`rounded-2xl border p-5 space-y-4 ${cardBg}`}>
              <p className={`text-[11px] ${textMuted}`}>{isMulti ? 'Multi: por defecto solo se retira excedente, sin tocar el par operativo 50/50.' : 'Retiro sobre saldo AIG de custodia.'}</p>
              {withdrawError ? (
                <div className={`rounded-xl border px-3 py-2 text-[10px] font-mono ${
                  isLight ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-500/35 bg-red-950/30 text-red-200'
                }`}>
                  {withdrawError}
                </div>
              ) : null}
              {isMulti ? (
                <>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setWithdrawToken('AIG')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${withdrawToken === 'AIG' ? 'bg-cyan-500 text-white' : `${isLight ? 'bg-slate-100' : 'bg-white/5'} ${textMuted}`}`}>AIG</button>
                    <button type="button" onClick={() => setWithdrawToken('USDT')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${withdrawToken === 'USDT' ? 'bg-cyan-500 text-white' : `${isLight ? 'bg-slate-100' : 'bg-white/5'} ${textMuted}`}`}>USDT</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => setWithdrawExcessOnly(true)} className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-wide border ${withdrawExcessOnly ? 'border-cyan-500 bg-cyan-500/15 text-cyan-600' : `${isLight ? 'border-slate-200' : 'border-white/10'} ${textMuted}`}`}>Solo excedente (recomendado)</button>
                    <button type="button" onClick={() => setWithdrawExcessOnly(false)} className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-wide border ${!withdrawExcessOnly ? 'border-amber-500 bg-amber-500/15 text-amber-700' : `${isLight ? 'border-slate-200' : 'border-white/10'} ${textMuted}`}`}>Incluir operativo (avanzado)</button>
                  </div>
                </>
              ) : null}
              <div>
                <p className={`armani-label-dynamic mb-1 ${textMuted}`}>{isMulti ? (withdrawExcessOnly ? 'Máx. retirable (excedente)' : 'Máx. retirable (custodia total)') : 'Disponible'}</p>
                <p className={`font-mono text-xl ${textMain}`}>
                  {isMulti
                    ? (withdrawExcessOnly
                        ? (withdrawToken === 'USDT' ? multiExcUsdt.toFixed(2) : multiExcAig.toFixed(4))
                        : (withdrawToken === 'USDT' ? Number(balanceUsdt).toFixed(2) : Number(balanceAig).toFixed(4)))
                    : Number(balanceAig).toFixed(4)}{' '}
                  {isMulti && withdrawToken === 'USDT' ? 'USDT' : 'AIG'}
                </p>
                {isMulti && !withdrawExcessOnly ? (
                  <p className={`text-[9px] mt-1 text-amber-600 ${isLight ? '' : 'text-amber-400'}`}>Puede reducir el cupo operativo 50/50; sin ajustes automáticos.</p>
                ) : null}
              </div>
              <input type="number" step="any" min="0" placeholder="Monto a retirar" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className={`w-full rounded-xl border p-3 font-mono outline-none ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/30 text-white'}`} />
              <button
                type="button"
                onClick={handleWithdrawSubmit}
                className="w-full py-4 rounded-2xl btn-energy-ai text-[10px] font-black tracking-widest uppercase text-white"
              >
                Confirmar retiro
              </button>
            </div>
          )}

          {subView === WALLET_VIEWS.HISTORY && (
            <div className="space-y-3">
              <p className={`text-[10px] font-black uppercase tracking-[0.28em] ${textMuted}`}>Living ledger</p>
              <WalletTxTimeline entries={walletTxHistory} isLight={isLight} />
            </div>
          )}
        </div>
      </aside>
      <TransactionFlowModal
        open={txFlow.open}
        state={txFlow.state}
        txHash={txFlow.txHash}
        errorMessage={txFlow.error}
        title={txFlow.title}
        isLight={isLight}
        onClose={closeTxFlow}
        adaptationTransactions={walletTxHistory}
        queueWaiting={queueWaiting}
      />
    </>
  );
});

const HubHistoryPanel = React.memo(function HubHistoryPanel({ ledger }) {
  const [walletFilter, setWalletFilter] = useState('ALL'); // ALL | AIG | DUAL
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | deposit | withdraw | bet | win | loss
  const [dateFilter, setDateFilter] = useState('7D'); // ALL | 24H | 7D

  const filtered = useMemo(() => {
    const now = Date.now();
    const minTs =
      dateFilter === '24H' ? now - 24 * 60 * 60 * 1000 : dateFilter === '7D' ? now - 7 * 24 * 60 * 60 * 1000 : 0;
    return (Array.isArray(ledger) ? ledger : []).filter((e) => {
      if (walletFilter !== 'ALL' && e.walletType !== walletFilter) return false;
      if (typeFilter !== 'ALL' && e.action !== typeFilter) return false;
      if (minTs && Number(e.timestamp) < minTs) return false;
      return true;
    });
  }, [ledger, walletFilter, typeFilter, dateFilter]);

  const exportJson = useCallback(() => {
    try {
      const payload = JSON.stringify(filtered, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `genesis-ledger-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, [filtered]);

  const pill = 'px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all';
  const select = 'w-full rounded-xl border px-3 py-2 text-[10px] font-mono bg-white/5 border-white/10 text-white/85 outline-none';

  return (
    <div className="mt-2 px-4 pb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Ledger</span>
        <button type="button" onClick={exportJson} className={`${pill} border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10`}>
          Export JSON
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <select value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)} className={select} aria-label="Filter by wallet">
          <option value="ALL">Wallet: All</option>
          <option value="AIG">Wallet: AIG</option>
          <option value="DUAL">Wallet: Dual</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={select} aria-label="Filter by action">
          <option value="ALL">Type: All</option>
          <option value="deposit">deposit</option>
          <option value="withdraw">withdraw</option>
          <option value="bet">bet</option>
          <option value="win">win</option>
          <option value="loss">loss</option>
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={select} aria-label="Filter by date">
          <option value="24H">Date: 24h</option>
          <option value="7D">Date: 7d</option>
          <option value="ALL">Date: all</option>
        </select>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
        <div className="max-h-[48vh] overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-5 text-center text-[10px] font-mono text-white/40">No entries match filters.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {filtered.slice(0, 200).map((e) => (
                <li key={e.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-mono text-white/55">
                      {new Date(Number(e.timestamp)).toLocaleString()}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${
                        e.action === 'win'
                          ? 'text-emerald-300'
                          : e.action === 'loss'
                            ? 'text-pink-300'
                            : e.action === 'bet'
                              ? 'text-amber-300'
                              : e.action === 'deposit'
                                ? 'text-cyan-300'
                                : 'text-white/65'
                      }`}
                    >
                      {e.action}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-white/80">
                      {e.walletType === 'DUAL' ? '🟣🟢 DUAL' : '🟣 AIG'} · {Number(e.amount).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-white/55">after ${Number(e.balanceAfter).toFixed(2)}</span>
                  </div>
                  {Number(e.aigAmount) || Number(e.usdtAmount) ? (
                    <div className="mt-1 text-[9px] font-mono text-white/45">
                      AIG {Number(e.aigAmount || 0).toFixed(4)} · USDT {Number(e.usdtAmount || 0).toFixed(2)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

const HubDashboardPanel = React.memo(function HubDashboardPanel({
  activeWalletKey,
  wallets,
  ledger,
  fase,
  sessionStats,
}) {
  const iaStatus = useMemo(() => {
    switch (fase) {
      case FASES.ANALISIS:
        return { label: 'Analyzing', tone: 'cyan' };
      case FASES.DETECCION:
        return { label: 'Detecting', tone: 'purple' };
      case FASES.SEÑAL:
        return { label: 'Signal', tone: 'amber' };
      case FASES.RESULTADO:
        return { label: 'Result', tone: 'emerald' };
      default:
        return { label: 'Idle', tone: 'slate' };
    }
  }, [fase]);

  const activeBalance = useMemo(() => {
    if (activeWalletKey === WALLET_KEY.DUAL) return multiMaxUsable(wallets.dual.aig, wallets.dual.usdt);
    return Number(wallets.aig.balance);
  }, [activeWalletKey, wallets]);

  const dailyPnL = useMemo(() => computeDailyPnL24hFromLedger(ledger), [ledger]);

  const sessionDerived = useMemo(() => computeSessionDerivedCounts(ledger), [ledger]);

  const winRate = useMemo(() => {
    const bets = sessionDerived.bets;
    if (!bets) return 0;
    return (sessionDerived.wins / bets) * 100;
  }, [sessionDerived]);

  const recent = useMemo(() => (Array.isArray(ledger) ? ledger : []).slice(0, 10), [ledger]);

  const card = 'rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4';
  const label = 'text-[9px] font-black uppercase tracking-[0.35em] text-white/55';
  const big = 'text-2xl font-mono font-black text-white/90';

  const toneClass =
    iaStatus.tone === 'cyan'
      ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200'
      : iaStatus.tone === 'purple'
        ? 'border-purple-500/25 bg-purple-500/10 text-purple-200'
        : iaStatus.tone === 'amber'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : iaStatus.tone === 'emerald'
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
            : 'border-slate-500/25 bg-white/5 text-white/70';

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Cockpit</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${toneClass}`}>
          IA: {iaStatus.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <p className={label}>Active wallet</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none" aria-hidden>
                {activeWalletKey === WALLET_KEY.DUAL ? '🟣🟢' : '🟣'}
              </span>
              <p className={big}>${Number(activeBalance).toFixed(2)}</p>
            </div>
            {activeWalletKey === WALLET_KEY.DUAL ? (
              <div className="text-right text-[9px] font-mono text-white/45">
                AIG {Number(wallets.dual.aig).toFixed(2)} · USDT {Number(wallets.dual.usdt).toFixed(2)}
              </div>
            ) : (
              <div className="text-right text-[9px] font-mono text-white/45">AIG {Number(wallets.aig.balance).toFixed(2)}</div>
            )}
          </div>
          {activeWalletKey === WALLET_KEY.DUAL ? (
            <p className="mt-2 text-[9px] font-mono text-white/40">
              Operable = 2×min · Excess AIG {Number(wallets.dual.excessAig).toFixed(2)} · USDT {Number(wallets.dual.excessUsdt).toFixed(2)}
            </p>
          ) : null}
        </div>

        <div className={card}>
          <p className={label}>Daily PnL (24h)</p>
          <p className={`mt-2 ${big} ${dailyPnL >= 0 ? 'text-emerald-300' : 'text-pink-300'}`}>
            {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
          </p>
          <p className="mt-2 text-[9px] font-mono text-white/40">From ledger wins − losses (last 24h)</p>
        </div>

        <div className={card}>
          <p className={label}>Win rate</p>
          <p className={big}>{winRate.toFixed(1)}%</p>
          <p className="mt-2 text-[9px] font-mono text-white/40">
            wins {sessionDerived.wins} / bets {sessionDerived.bets}
          </p>
        </div>

        <div className={card}>
          <p className={label}>Session</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">bets</p>
              <p className="text-lg font-mono font-black text-white/85">{sessionDerived.bets}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">wins</p>
              <p className="text-lg font-mono font-black text-emerald-300">{sessionDerived.wins}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">losses</p>
              <p className="text-lg font-mono font-black text-pink-300">{sessionDerived.losses}</p>
            </div>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/40">
            Engine stats: wins {Number(sessionStats?.wins || 0)} · losses {Number(sessionStats?.losses || 0)} · total {Number(sessionStats?.total || 0)}
          </p>
        </div>
      </div>

      <div className={`mt-3 ${card}`}>
        <div className="flex items-center justify-between gap-3">
          <p className={label}>Recent activity</p>
          <p className="text-[9px] font-mono text-white/40">last {Math.min(10, (Array.isArray(ledger) ? ledger : []).length)}</p>
        </div>
        <div className="mt-2 max-h-[32vh] overflow-y-auto custom-scrollbar">
          {recent.length === 0 ? (
            <div className="py-4 text-center text-[10px] font-mono text-white/40">No ledger activity yet.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {recent.map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-white/85 truncate">
                      {e.walletType === 'DUAL' ? '🟣🟢' : '🟣'} {e.action} · {Number(e.amount).toFixed(2)}
                    </p>
                    <p className="text-[9px] font-mono text-white/40 truncate">{new Date(Number(e.timestamp)).toLocaleTimeString()}</p>
                  </div>
                  <p className="text-[10px] font-mono text-white/55 shrink-0">after ${Number(e.balanceAfter).toFixed(2)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

const HubAnalyticsPanel = React.memo(function HubAnalyticsPanel({
  activeWalletKey,
  wallets,
  ledger,
  stake,
  mgLevels,
}) {
  const formatNumber = useCallback((n, decimals = 2) => {
    const v = Number(n);
    return Number.isFinite(v) ? v.toFixed(decimals) : (0).toFixed(decimals);
  }, []);

  const rows = useMemo(() => asLedgerRows(ledger), [ledger]);

  const totals = useMemo(() => computeTotals(rows), [rows]);

  const today = useMemo(() => computeTodayPnL24h(rows), [rows]);

  const winRate = useMemo(() => computeWinRatePct(totals), [totals]);

  const streaks = useMemo(() => computeStreaks(rows), [rows]);

  const riskLevel = useMemo(() => {
    const lossStreak = streaks.currentLoss;
    if (lossStreak >= 3) return 'HIGH';
    if (lossStreak === 2) return 'MEDIUM';
    return 'LOW';
  }, [streaks]);

  const exposure = useMemo(() => {
    const s = Number(stake);
    const L = Math.max(1, Math.floor(Number(mgLevels)));
    const peak = s * Math.pow(2, Math.max(0, L - 1));
    const balance =
      activeWalletKey === WALLET_KEY.DUAL ? multiMaxUsable(wallets.dual.aig, wallets.dual.usdt) : Number(wallets.aig.balance);
    const ratio = balance > 0 ? peak / balance : 0;
    if (!(peak > 0) || !(balance > 0)) return { level: 'LOW', peak, balance, ratio };
    if (ratio >= 0.6) return { level: 'HIGH', peak, balance, ratio };
    if (ratio >= 0.3) return { level: 'MEDIUM', peak, balance, ratio };
    return { level: 'LOW', peak, balance, ratio };
  }, [stake, mgLevels, activeWalletKey, wallets]);

  const walletSplit = useMemo(() => computeWalletSplit(rows), [rows]);

  const card = 'rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4';
  const label = 'text-[9px] font-black uppercase tracking-[0.35em] text-white/55';
  const big = 'text-2xl font-mono font-black text-white/90';

  const riskTone =
    riskLevel === 'HIGH'
      ? 'border-red-500/25 bg-red-500/10 text-red-200'
      : riskLevel === 'MEDIUM'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';

  const expoTone =
    exposure.level === 'HIGH'
      ? 'text-red-200'
      : exposure.level === 'MEDIUM'
        ? 'text-amber-200'
        : 'text-emerald-200';

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Analytics</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${riskTone}`}>
          Risk: {riskLevel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <p className={label}>Performance</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={big}>{formatNumber(winRate, 1)}%</p>
            <div className="text-right text-[9px] font-mono text-white/45">
              bets {totals.bets} · wins {totals.wins} · losses {totals.losses}
            </div>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/40">Win Rate (%)</p>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-cyan-400/70"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        totals.wins + totals.losses > 0 ? (totals.wins / (totals.wins + totals.losses)) * 100 : 0,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[9px] font-mono text-white/40">wins vs losses</p>
            </div>
            <div className="w-24 text-right text-[9px] font-mono text-white/45">
              {totals.wins} / {totals.losses}
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <p className={label}>PnL (últimas 24h, basado en timestamp)</p>
            <div className="relative group">
              <button
                type="button"
                className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black text-white/60 hover:text-white/90 hover:border-cyan-500/30 transition-all"
                aria-label="PnL info"
              >
                i
              </button>
              <div className="pointer-events-none absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="rounded-lg border border-white/10 bg-[rgba(10,2,30,0.92)] px-2.5 py-2 shadow-xl backdrop-blur-xl">
                  <p className="text-[10px] font-mono text-white/80 whitespace-nowrap">
                    Based on total win/loss amounts (not operable balance)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className={`mt-2 ${big} ${today.pnl >= 0 ? 'text-emerald-300' : 'text-pink-300'}`}>
            {today.pnl >= 0 ? '+' : ''}${formatNumber(today.pnl, 2)}
          </p>
          <p className={`mt-2 text-[10px] font-mono ${totals.pnl >= 0 ? 'text-emerald-200' : 'text-pink-200'}`}>
            Total PnL {totals.pnl >= 0 ? '+' : ''}${formatNumber(totals.pnl, 2)}
          </p>
          <p className="mt-2 text-[9px] font-mono text-white/40">From ledger win/loss amounts</p>
        </div>

        <div className={card}>
          <p className={label}>Streaks</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">current</p>
              <p className="text-lg font-mono font-black text-white/85">
                {streaks.current.kind === 'none' ? '—' : `${streaks.current.kind.toUpperCase()} ×${streaks.current.count}`}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">max</p>
              <p className="text-[11px] font-mono text-white/80 mt-1">
                WIN ×{streaks.maxWin} · LOSS ×{streaks.maxLoss}
              </p>
            </div>
          </div>
        </div>

        <div className={card}>
          <p className={label}>Exposure (Peak / Balance)</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className={`text-xl font-mono font-black ${expoTone}`}>
              Exposure: {formatNumber(Number(exposure.ratio) * 100, 1)}%
            </p>
            <div className="text-right text-[9px] font-mono text-white/45">
              peak ${formatNumber(exposure.peak, 2)}
              <br />
              bal ${formatNumber(exposure.balance, 2)}
            </div>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/40">
            Exposure (Peak / Balance) · peak = stake × 2^(T−1)
          </p>
        </div>
      </div>

      <div className={`mt-3 ${card}`}>
        <p className={label}>Wallet performance split</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">🟣 AIG</p>
            <p className={`mt-1 text-[10px] font-mono ${walletSplit.aig.pnl >= 0 ? 'text-emerald-200' : 'text-pink-200'}`}>
              PnL {walletSplit.aig.pnl >= 0 ? '+' : ''}${walletSplit.aig.pnl.toFixed(2)}
            </p>
            <p className="mt-1 text-[9px] font-mono text-white/45">
              wins ${walletSplit.aig.wins.toFixed(2)} · losses ${walletSplit.aig.losses.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">🟣🟢 DUAL</p>
            <p className={`mt-1 text-[10px] font-mono ${walletSplit.dual.pnl >= 0 ? 'text-emerald-200' : 'text-pink-200'}`}>
              PnL {walletSplit.dual.pnl >= 0 ? '+' : ''}${walletSplit.dual.pnl.toFixed(2)}
            </p>
            <p className="mt-1 text-[9px] font-mono text-white/45">
              wins ${walletSplit.dual.wins.toFixed(2)} · losses ${walletSplit.dual.losses.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

const HubAiStrategyPanel = React.memo(function HubAiStrategyPanel({
  fase,
  activeWalletKey,
  wallets,
  ledger,
  stake,
  mgLevels,
}) {
  const aiState = useMemo(() => {
    switch (fase) {
      case FASES.ANALISIS:
        return { label: 'Analyzing patterns', tone: 'cyan' };
      case FASES.DETECCION:
        return { label: 'Detecting signals', tone: 'purple' };
      case FASES.SEÑAL:
        return { label: 'Executing strategy', tone: 'amber' };
      case FASES.RESULTADO:
        return { label: 'Evaluating outcome', tone: 'emerald' };
      default:
        return { label: 'Idle', tone: 'slate' };
    }
  }, [fase]);

  const rows = useMemo(() => (Array.isArray(ledger) ? ledger : []), [ledger]);

  const streaks = useMemo(() => {
    const outcomes = rows.filter((e) => e.action === 'win' || e.action === 'loss');
    if (outcomes.length === 0) return { currentWin: 0, currentLoss: 0, currentKind: 'none', currentCount: 0 };
    const firstKind = outcomes[0].action;
    let currentCount = 0;
    for (const e of outcomes) {
      if (e.action !== firstKind) break;
      currentCount += 1;
    }
    return {
      currentWin: firstKind === 'win' ? currentCount : 0,
      currentLoss: firstKind === 'loss' ? currentCount : 0,
      currentKind: firstKind,
      currentCount,
    };
  }, [rows]);

  const winRate = useMemo(() => {
    const bets = rows.filter((e) => e.action === 'bet').length;
    const wins = rows.filter((e) => e.action === 'win').length;
    return bets ? (wins / bets) * 100 : 0;
  }, [rows]);

  const riskLevel = useMemo(() => {
    if (streaks.currentLoss >= 3) return 'HIGH';
    if (streaks.currentLoss === 2) return 'MEDIUM';
    return 'LOW';
  }, [streaks]);

  const exposure = useMemo(() => {
    const s = Number(stake);
    const L = Math.max(1, Math.floor(Number(mgLevels)));
    const peak = s * Math.pow(2, Math.max(0, L - 1));
    const balance =
      activeWalletKey === WALLET_KEY.DUAL ? multiMaxUsable(wallets.dual.aig, wallets.dual.usdt) : Number(wallets.aig.balance);
    if (!(peak > 0) || !(balance > 0)) return { level: 'LOW', peak, balance, ratio: 0 };
    const ratio = peak / balance;
    if (ratio >= 0.6) return { level: 'HIGH', peak, balance, ratio };
    if (ratio >= 0.3) return { level: 'MEDIUM', peak, balance, ratio };
    return { level: 'LOW', peak, balance, ratio };
  }, [stake, mgLevels, activeWalletKey, wallets]);

  const dualImbalance = useMemo(() => {
    if (activeWalletKey !== WALLET_KEY.DUAL) return { isDual: false, unbalanced: false, msg: null };
    const a = Number(wallets.dual.aig);
    const u = Number(wallets.dual.usdt);
    const exA = Number(wallets.dual.excessAig || 0);
    const exU = Number(wallets.dual.excessUsdt || 0);
    const denom = Math.max(a, u, 1);
    const skew = Math.abs(a - u) / denom;
    const unbalanced = (exA > 0 || exU > 0) && skew > 0.08;
    return {
      isDual: true,
      unbalanced,
      msg: unbalanced ? `Imbalance detected (excess on one leg).` : `Symmetry OK (50/50 operable).`,
      aig: a,
      usdt: u,
      excessAig: exA,
      excessUsdt: exU,
      skew,
    };
  }, [activeWalletKey, wallets]);

  const suggestions = useMemo(() => {
    const list = [];
    if (streaks.currentLoss >= 3) list.push({ kind: 'risk', text: 'Reduce stake to minimize exposure' });
    if (dualImbalance.isDual && dualImbalance.unbalanced) list.push({ kind: 'wallet', text: 'Rebalance wallet for optimal execution' });
    if (exposure.level === 'HIGH') list.push({ kind: 'expo', text: 'Lower T limit or reduce base stake' });
    if (winRate >= 60 && streaks.currentLoss === 0 && rows.filter((e) => e.action === 'bet').length >= 5)
      list.push({ kind: 'good', text: 'System performing optimally' });
    if (list.length === 0) list.push({ kind: 'info', text: 'Maintain discipline. Observe variance and keep exposure controlled.' });
    return list;
  }, [streaks, dualImbalance, exposure, winRate, rows]);

  const card = 'rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4 transition-all duration-300';
  const label = 'text-[9px] font-black uppercase tracking-[0.35em] text-white/55';

  const tone =
    aiState.tone === 'cyan'
      ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200'
      : aiState.tone === 'purple'
        ? 'border-purple-500/25 bg-purple-500/10 text-purple-200'
        : aiState.tone === 'amber'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : aiState.tone === 'emerald'
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
            : 'border-white/10 bg-white/5 text-white/70';

  const steps = [
    { id: FASES.ANALISIS, label: 'Analyzing' },
    { id: FASES.DETECCION, label: 'Detecting' },
    { id: FASES.SEÑAL, label: 'Signal' },
    { id: FASES.RESULTADO, label: 'Result' },
  ];
  const activeStepIdx = Math.max(0, steps.findIndex((s) => s.id === fase));

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">AI Strategy</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${tone}`}>
          {aiState.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <p className={label}>AI status</p>
          <p className="mt-2 text-[13px] font-mono text-white/85">{aiState.label}</p>
          <p className="mt-2 text-[9px] font-mono text-white/40">Phase: {String(fase)}</p>
        </div>

        <div className={card}>
          <p className={label}>Decision flow</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            {steps.map((s, idx) => {
              const active = idx === activeStepIdx;
              const done = idx < activeStepIdx;
              return (
                <div key={s.id} className="flex-1 min-w-0">
                  <div
                    className={`h-2 rounded-full border transition-all duration-300 ${
                      active
                        ? 'border-cyan-400/40 bg-cyan-500/35 shadow-[0_0_14px_rgba(0,237,255,0.18)]'
                        : done
                          ? 'border-white/10 bg-white/15'
                          : 'border-white/10 bg-white/5'
                    }`}
                  />
                  <p className={`mt-1 text-[8px] font-black uppercase tracking-widest truncate ${active ? 'text-cyan-200' : 'text-white/45'}`}>
                    {s.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className={card}>
          <p className={label}>Risk insight</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono text-white/60">Risk</p>
              <p className={`text-xl font-mono font-black ${riskLevel === 'HIGH' ? 'text-red-300' : riskLevel === 'MEDIUM' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {riskLevel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-white/60">Exposure</p>
              <p className={`text-xl font-mono font-black ${exposure.level === 'HIGH' ? 'text-red-300' : exposure.level === 'MEDIUM' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {exposure.level}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/40">
            loss streak {streaks.currentLoss} · win rate {winRate.toFixed(1)}% · peak ${Number(exposure.peak).toFixed(2)} / bal ${Number(exposure.balance).toFixed(2)}
          </p>
        </div>

        <div className={card}>
          <p className={label}>Wallet intelligence</p>
          {activeWalletKey === WALLET_KEY.DUAL ? (
            <>
              <p className="mt-2 text-[10px] font-mono text-white/75">
                Symmetry: <span className={dualImbalance.unbalanced ? 'text-amber-300' : 'text-emerald-300'}>{dualImbalance.unbalanced ? 'UNBALANCED' : 'OK'}</span>
              </p>
              <p className="mt-1 text-[9px] font-mono text-white/45">
                AIG {Number(dualImbalance.aig).toFixed(2)} · USDT {Number(dualImbalance.usdt).toFixed(2)} · excess AIG {Number(dualImbalance.excessAig).toFixed(2)} · USDT {Number(dualImbalance.excessUsdt).toFixed(2)}
              </p>
              <p className="mt-2 text-[9px] font-mono text-white/40">{dualImbalance.msg}</p>
            </>
          ) : (
            <p className="mt-2 text-[10px] font-mono text-white/75">Single token mode (AIG). Dual symmetry not applicable.</p>
          )}
        </div>
      </div>

      <div className={`mt-3 ${card}`}>
        <p className={label}>Suggestions</p>
        <ul className="mt-2 space-y-2">
          {suggestions.map((s, idx) => (
            <li key={`${s.kind}-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] leading-none" aria-hidden>
                {s.kind === 'good' ? '✅' : s.kind === 'risk' ? '🔻' : s.kind === 'wallet' ? '⚠️' : s.kind === 'expo' ? '⚠️' : 'ℹ️'}
              </span>
              <span className="text-[11px] font-medium text-white/85">{s.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

const HubSecurityPanel = React.memo(function HubSecurityPanel({
  userId,
  activeWalletKey,
  wallets,
  ledger,
  sessionStartTs,
}) {
  const rows = useMemo(() => (Array.isArray(ledger) ? ledger : []), [ledger]);

  const walletType = useMemo(() => (activeWalletKey === WALLET_KEY.DUAL ? 'Dual' : 'AIG'), [activeWalletKey]);

  const short = useCallback((addr) => {
    const s = String(addr || '');
    if (!s) return '—';
    if (s.length <= 12) return s;
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  }, []);

  const walletAddress = useMemo(() => {
    if (activeWalletKey === WALLET_KEY.DUAL) {
      return `${short(DEMO_WALLET_ADDRESS_AIG)} | ${short(DEMO_WALLET_ADDRESS_USDT)}`;
    }
    return short(DEMO_WALLET_ADDRESS_AIG);
  }, [activeWalletKey, short]);

  const connection = useMemo(() => {
    const connected = Boolean(userId);
    return { connected, label: connected ? 'Connected' : 'Disconnected' };
  }, [userId]);

  const lastActivityTs = useMemo(() => {
    const ledgerTs = rows.length ? Number(rows[0]?.timestamp) || 0 : 0;
    return Math.max(Number(sessionStartTs) || 0, ledgerTs);
  }, [rows, sessionStartTs]);

  const sessionStatus = useMemo(() => {
    const now = Date.now();
    const idleMs = now - (Number(lastActivityTs) || now);
    const isIdle = idleMs > 2 * 60 * 1000;
    return { isIdle, label: isIdle ? 'Idle' : 'Active', idleMs };
  }, [lastActivityTs]);

  const recentTx = useMemo(() => {
    const mapped = rows
      .filter((e) => ['deposit', 'withdraw', 'bet', 'win', 'loss'].includes(String(e.action)))
      .slice(0, 8)
      .map((e) => {
        const age = Date.now() - Number(e.timestamp || 0);
        let status = 'Confirmed';
        if (e.action === 'withdraw') status = age < 30_000 ? 'Pending' : 'Confirmed';
        if (e.action === 'bet') status = 'Executed';
        if (e.action === 'win') status = 'Settled';
        if (e.action === 'loss') status = 'Settled';
        if (e.action === 'deposit') status = 'Confirmed';
        return { ...e, status };
      });
    return mapped;
  }, [rows]);

  const activityLog = useMemo(() => {
    const base = [
      {
        id: `sec-${sessionStartTs}`,
        timestamp: Number(sessionStartTs),
        action: 'wallet-connected',
        walletType: activeWalletKey === WALLET_KEY.DUAL ? 'DUAL' : 'AIG',
        amount: 0,
        balanceAfter: 0,
      },
      ...rows,
    ];
    return base.slice(0, 10);
  }, [rows, sessionStartTs, activeWalletKey]);

  const card = 'rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4';
  const label = 'text-[9px] font-black uppercase tracking-[0.35em] text-white/55';

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Security</span>
        <button
          type="button"
          disabled
          className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
          title="UI only — disconnect coming soon"
        >
          Disconnect wallet
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card}>
          <p className={label}>Wallet security</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-mono text-white/85">{walletAddress}</p>
            <span
              className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
                connection.connected
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/25 bg-red-500/10 text-red-200'
              }`}
            >
              {connection.label}
            </span>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/45">Wallet type: {walletType}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">Encryption</p>
              <p className="text-[10px] font-mono text-emerald-200 mt-1">Active</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">Secure link</p>
              <p className="text-[10px] font-mono text-emerald-200 mt-1">Active</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/45">Integrity</p>
              <p className="text-[10px] font-mono text-emerald-200 mt-1">OK</p>
            </div>
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/35">Indicators are UI-only (simulated).</p>
        </div>

        <div className={card}>
          <p className={label}>Session info</p>
          <div className="mt-2 space-y-2 text-[10px] font-mono text-white/75">
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Session start</span>
              <span>{new Date(Number(sessionStartTs)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Last activity</span>
              <span>{new Date(Number(lastActivityTs)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Status</span>
              <span className={sessionStatus.isIdle ? 'text-amber-200' : 'text-emerald-200'}>{sessionStatus.label}</span>
            </div>
          </div>
          <p className="mt-3 text-[9px] font-mono text-white/35">Idle threshold: 2 minutes without ledger activity.</p>
        </div>

        <div className={card}>
          <p className={label}>Transaction status (simulated)</p>
          <div className="mt-2 max-h-[26vh] overflow-y-auto custom-scrollbar">
            {recentTx.length === 0 ? (
              <div className="py-4 text-center text-[10px] font-mono text-white/40">No transactions yet.</div>
            ) : (
              <ul className="divide-y divide-white/10">
                {recentTx.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-white/85 truncate">
                        {e.walletType === 'DUAL' ? '🟣🟢' : '🟣'} {e.action} · {Number(e.amount).toFixed(2)}
                      </p>
                      <p className="text-[9px] font-mono text-white/40 truncate">
                        {new Date(Number(e.timestamp)).toLocaleTimeString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
                        e.status === 'Pending'
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                          : e.status === 'Executed'
                            ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200'
                            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                      }`}
                    >
                      {e.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[9px] font-mono text-white/35">Uses ledger timestamps for pending/confirmed simulation.</p>
        </div>

        <div className={card}>
          <p className={label}>Activity log</p>
          <div className="mt-2 max-h-[26vh] overflow-y-auto custom-scrollbar">
            <ul className="divide-y divide-white/10">
              {activityLog.map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-white/85 truncate">
                      {e.action === 'wallet-connected' ? '🔌 wallet connected' : `${e.walletType === 'DUAL' ? '🟣🟢' : '🟣'} ${e.action}`}
                      {e.amount ? ` · ${Number(e.amount).toFixed(2)}` : ''}
                    </p>
                    <p className="text-[9px] font-mono text-white/40 truncate">{new Date(Number(e.timestamp)).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

const HubSettingsPanel = React.memo(function HubSettingsPanel({
  isLightMode,
  setIsLightMode,
  isSoundEnabled,
  setIsSoundEnabled,
  setIsSoundEnabledWithInit,
}) {
  const [language, setLanguage] = useState('EN'); // UI only
  const [reducedMotion, setReducedMotion] = useState(false); // UI only

  const toggleBase =
    'relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';
  const knobBase = 'inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200';

  const row = 'flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4';
  const label = 'text-[10px] font-black uppercase tracking-[0.35em] text-white/70';
  const sub = 'text-[9px] font-mono text-white/45 mt-1';

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Settings</span>
        <span className="text-[9px] font-mono text-white/40">Saved instantly</span>
      </div>

      <div className="space-y-3">
        <div className={row}>
          <div className="min-w-0">
            <p className={label}>Theme</p>
            <p className={sub}>Light / Dark</p>
          </div>
          <button
            type="button"
            onClick={() => setIsLightMode(!isLightMode)}
            className={`${toggleBase} ${isLightMode ? 'bg-cyan-500/25 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}
            role="switch"
            aria-checked={isLightMode}
            aria-label="Toggle theme"
          >
            <span className={`${knobBase} ${isLightMode ? 'translate-x-5' : 'translate-x-1'} ${isLightMode ? 'bg-white' : 'bg-white/90'}`} />
          </button>
        </div>

        <div className={row}>
          <div className="min-w-0">
            <p className={label}>Sound</p>
            <p className={sub}>Enable / Disable</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSoundEnabledWithInit(!isSoundEnabled)}
            className={`${toggleBase} ${isSoundEnabled ? 'bg-cyan-500/25 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}
            role="switch"
            aria-checked={isSoundEnabled}
            aria-label="Toggle sound"
          >
            <span className={`${knobBase} ${isSoundEnabled ? 'translate-x-5' : 'translate-x-1'} ${isSoundEnabled ? 'bg-white' : 'bg-white/90'}`} />
          </button>
        </div>

        <div className={row}>
          <div className="min-w-0">
            <p className={label}>Language</p>
            <p className={sub}>English / Spanish (UI only)</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLanguage('EN')}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                language === 'EN'
                  ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
              aria-pressed={language === 'EN'}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ES')}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                language === 'ES'
                  ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
              aria-pressed={language === 'ES'}
            >
              ES
            </button>
          </div>
        </div>

        <div className={row}>
          <div className="min-w-0">
            <p className={label}>Animations</p>
            <p className={sub}>Normal / Reduced motion (UI only)</p>
          </div>
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`${toggleBase} ${reducedMotion ? 'bg-amber-500/20 border-amber-500/30' : 'bg-white/5 border-white/10'}`}
            role="switch"
            aria-checked={reducedMotion}
            aria-label="Toggle reduced motion"
          >
            <span className={`${knobBase} ${reducedMotion ? 'translate-x-5' : 'translate-x-1'} ${reducedMotion ? 'bg-white' : 'bg-white/90'}`} />
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[9px] font-mono text-white/45">
            Language and reduced-motion are UI preferences only (no system behavior changes yet).
          </p>
        </div>
      </div>
    </div>
  );
});

const HubEcosystemPanel = React.memo(function HubEcosystemPanel() {
  const card = 'rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4 opacity-70';
  const label = 'text-[9px] font-black uppercase tracking-[0.35em] text-white/55';
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/70">Multi-Token Ecosystem</span>
        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-200">
          Coming Soon
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-3">
        <p className="text-[11px] font-mono text-white/70">
          Future integration of communities, tokens, and strategic partners.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={card} aria-disabled="true">
          <p className={label}>Partner Tokens</p>
          <p className="mt-2 text-[10px] font-mono text-white/55">Coming soon</p>
          <p className="mt-2 text-[9px] font-mono text-white/35">Listings will be curated and audited.</p>
        </div>
        <div className={card} aria-disabled="true">
          <p className={label}>Community Integration</p>
          <p className="mt-2 text-[10px] font-mono text-white/55">Coming soon</p>
          <p className="mt-2 text-[9px] font-mono text-white/35">Role-based access and on-chain identity support.</p>
        </div>
        <div className={`${card} sm:col-span-2`} aria-disabled="true">
          <p className={label}>Project Onboarding</p>
          <p className="mt-2 text-[10px] font-mono text-white/55">Approval required</p>
          <p className="mt-2 text-[9px] font-mono text-white/35">Applications will require security review and governance approval.</p>
        </div>
      </div>
    </div>
  );
});

export default function App() {
  /** Relay BFF → core-api upstream (Winx u otro proveedor en EXTERNAL_SIGNALS_*). Sin demo en servidor. */
  useExternalSignals();
  const extStreamTick = useExternalSignalsStore((s) => s.streamTick);
  const extActiveSignals = useExternalSignalsStore((s) => s.activeSignals);
  const extHistory = useExternalSignalsStore((s) => s.history);

  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const audioUnlockEpoch = useSyncExternalStore(subscribeAudioUnlock, getAudioUnlockEpoch, getAudioUnlockEpoch);
  const [isGoPulseActive, setIsGoPulseActive] = useState(false);
  const [fase, setFase] = useState(FASES.STANDBY);
  const [isRunning, setIsRunning] = useState(false);
  const [enginesReady, setEnginesReady] = useState(0);
  const [stats, setStats] = useState({ wins: 0, precision: 100.00, totals: Array(8).fill(0) });
  const [history, setHistory] = useState([]);
  const [gpulseHistory, setGpulseHistory] = useState([]);
  const [demoBalance, setDemoBalance] = useState(1000.00); 
  const [balanceAnimate, setBalanceAnimate] = useState(false);
  const [pulseCharge, setPulseCharge] = useState(0);
  const [scores, setScores] = useState({ player: 0, banker: 0, rolling: false });
  const [activeShot, setActiveShot] = useState(null);
  const [lastWinningShot, setLastWinningShot] = useState(null); 
  const [pattern, setPattern] = useState([]); 
  const [winnerSide, setWinnerSide] = useState(null);
  const [roundSteps, setRoundSteps] = useState([]);
  const [currentMesa, setCurrentMesa] = useState(BACCARAT_TABLES[0]);
  const [currentRonda, setCurrentRonda] = useState(1);
  const [stake, setStake] = useState(10.00);
  const [mgLevels, setMgLevels] = useState(6);
  const [selectedMode, setSelectedMode] = useState(resolveUiDefaultMode);
  const [iaRealEngineState, setIaRealEngineState] = useState(() => createIdleIaRealVisualState());
  const iaRealPhaseTimersRef = useRef(/** @type {ReturnType<typeof setTimeout>[]} */ ([]));
  const clearIaRealPhaseTimers = useCallback(() => {
    iaRealPhaseTimersRef.current.forEach(clearTimeout);
    iaRealPhaseTimersRef.current = [];
  }, []);

  const isIaRealProviderShell = useMemo(
    () => selectedMode === MODOS.IA_REAL && GPULSE_REAL_PROVIDER_EXECUTION,
    [selectedMode],
  );

  /** Legacy phase enum for non–IA-Real UI; when IA Real provider shell is on, derived only from `iaRealEngineState.status`. */
  const presentationFase = useMemo(() => {
    if (isIaRealProviderShell) return iaRealStatusToPresentationFase(iaRealEngineState.status);
    return fase;
  }, [isIaRealProviderShell, iaRealEngineState.status, fase]);

  const hideSimulacionUi = String(import.meta.env.VITE_GPULSE_HIDE_SIM_MODE ?? '0').trim() === '1';
  const [activeCycleMode, setActiveCycleMode] = useState(null);

  useEffect(() => {
    if (hideSimulacionUi && selectedMode === MODOS.SIMULACION) setSelectedMode(MODOS.IA_REAL);
  }, [hideSimulacionUi, selectedMode]);

  useEffect(() => {
    if (isIaRealProviderShell) return;
    clearIaRealPhaseTimers();
    setIaRealEngineState(createIdleIaRealVisualState());
  }, [isIaRealProviderShell, clearIaRealPhaseTimers]);

  const shellModeButtons = useMemo(() => {
    const all = [
      { id: MODOS.VISOR, label: 'Visor', icon: <Monitor size={12} />, color: '#10b981' },
      { id: MODOS.SIMULACION, label: 'Simular', icon: <Activity size={12} />, color: '#8A2BE2' },
      { id: MODOS.IA_REAL, label: 'IA Real', icon: <Zap size={12} />, color: '#FF1B8D' },
    ];
    return hideSimulacionUi ? all.filter((m) => m.id !== MODOS.SIMULACION) : all;
  }, [hideSimulacionUi]);

  const [sessionStats, setSessionStats] = useState({ wins: 0, losses: 0, total: 0, distribution: Array(8).fill(0), sessionRewardsNet: 0 });
  const [showSessionReport, setShowSessionReport] = useState(false);
  const [isProcessingSequence, setIsProcessingSequence] = useState(false);
  const [aiSpeech, setAiSpeech] = useState({ message: "MI MATRIZ ESTÁ LISTA. ESPERANDO TU COMANDO.", type: "info" });

  const [isWalletPanelOpen, setIsWalletPanelOpen] = useState(false);
  const [userWalletAddress, setUserWalletAddress] = useState(null);
  const [userWalletAuthToken, setUserWalletAuthToken] = useState(null);
  const userWalletSessionRef = useRef({ provider: null, signer: null });
  const [wallets, setWallets] = useState(() => ({
    aig: {
      balance: 2540.182,
      wagering: { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true },
    },
    dual: {
      ...normalizeDualBalances({ aig: 2540.182, usdt: 875.42 }),
      wagering: { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true },
    },
  }));
  /** Active IA trading wallet: 'aig' single-token | 'dual' AIG+USDT 50/50 */
  const [activeWalletKey, setActiveWalletKey] = useState(WALLET_KEY.AIG);
  const [walletMode, setWalletMode] = useState(WALLET_MODE.AIG);
  const [walletSubView, setWalletSubView] = useState(WALLET_VIEWS.MAIN);
  const [walletTxHistory, setWalletTxHistory] = useState([]);
  const [trustWalletFlow, setTrustWalletFlow] = useState({ open: false, state: TX_FLOW_STATE.IDLE });
  const [trustPremiumFlow, setTrustPremiumFlow] = useState({ open: false, state: TX_FLOW_STATE.IDLE });
  const [trustGlowUntil, setTrustGlowUntil] = useState(0);

  const trustPendingCount = useMemo(
    () =>
      (Array.isArray(walletTxHistory) ? walletTxHistory : []).filter(
        (t) => t?.status === MOCK_TX_STATUS.PENDING || t?.status === MOCK_TX_STATUS.CONFIRMING,
      ).length,
    [walletTxHistory],
  );

  const trustLastConfirmedAt = useMemo(() => {
    const list = Array.isArray(walletTxHistory) ? walletTxHistory : [];
    const done = list.filter((t) => t?.status === MOCK_TX_STATUS.COMPLETED);
    if (!done.length) return null;
    return Math.max(...done.map((t) => Number(t?.at) || 0));
  }, [walletTxHistory]);

  const prevTrustWalletState = useRef(TX_FLOW_STATE.IDLE);
  const prevTrustPremiumState = useRef(TX_FLOW_STATE.IDLE);

  useEffect(() => {
    const s = trustWalletFlow.state;
    if (s === TX_FLOW_STATE.SUCCESS && prevTrustWalletState.current !== TX_FLOW_STATE.SUCCESS) {
      setTrustGlowUntil(Date.now() + 2600);
    }
    prevTrustWalletState.current = s;
  }, [trustWalletFlow.state]);

  useEffect(() => {
    const s = trustPremiumFlow.state;
    if (s === TX_FLOW_STATE.SUCCESS && prevTrustPremiumState.current !== TX_FLOW_STATE.SUCCESS) {
      setTrustGlowUntil(Date.now() + 2600);
    }
    prevTrustPremiumState.current = s;
  }, [trustPremiumFlow.state]);

  const onTrustWalletFlow = useCallback((snap) => {
    setTrustWalletFlow({
      open: Boolean(snap?.open),
      state: String(snap?.state ?? TX_FLOW_STATE.IDLE),
    });
  }, []);

  useEffect(() => {
    if (isWeb3MockMode()) return undefined;
    const eth = getInjectedEthereum();
    if (!eth || typeof eth.on !== 'function') return undefined;

    const handleAccountsChanged = (accounts) => {
      try {
        const next = Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0]) : '';
        if (next) {
          const normalized = getAddress(next);
          userWalletSessionRef.current = { provider: null, signer: null };
          setUserWalletAddress(normalized);
        } else {
          userWalletSessionRef.current = { provider: null, signer: null };
          setUserWalletAddress(null);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Wallet accountsChanged handler failed:', e);
      }
    };

    try {
      eth.on('accountsChanged', handleAccountsChanged);
    } catch {
      return undefined;
    }
    return () => {
      try {
        if (typeof eth.removeListener === 'function') eth.removeListener('accountsChanged', handleAccountsChanged);
        else if (typeof eth.off === 'function') eth.off('accountsChanged', handleAccountsChanged);
      } catch {
        /* ignore */
      }
    };
  }, []);
  const [igniteDenyAnim, setIgniteDenyAnim] = useState(false);
  /** IA orchestration (executeAIFlow) — cleared in finally so ignition never stays “hung” */
  const [aiFlowThinking, setAiFlowThinking] = useState(false);

  const [showOracleModal, setShowOracleModal] = useState(false);
  const [oracleInsight, setOracleInsight] = useState("");
  const [loadingOracle, setLoadingOracle] = useState(false);
  const [tableIntuition, setTableIntuition] = useState("Escaneando mazo...");
  const [loadingIntuition, setLoadingIntuition] = useState(false);

  const [activeView, setActiveView] = useState("dashboard");
  /** Sub-vista interna de Access (overview | compare | upgrade) para voz / analytics. */
  const [gpulseAccessSubView, setGpulseAccessSubView] = useState('overview');
  const { isPremium: gpulsePremium } = usePremiumStatus();
  const [syncTarget, setSyncTarget] = useState(5);
  const [systemMessage, setSystemMessage] = useState('');
  const [systemNarrative, setSystemNarrative] = useState('');
  const [coreVisual, setCoreVisual] = useState('IDLE');
  /** ON: exige sync mínimo en executeSequence; OFF: sin bloqueo por sync (toggle del usuario). */
  const [syncMode, setSyncMode] = useState(true);
  const [syncModeManuallyChanged, setSyncModeManuallyChanged] = useState(false);
  const [gpulseGuidedHighlight, setGpulseGuidedHighlight] = useState(false);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [hubSlideIn, setHubSlideIn] = useState(false);
  const [hubActiveId, setHubActiveId] = useState('dashboard');
  const hubPanelRef = useRef(null);
  const [isSmartHubOpen, setIsSmartHubOpen] = useState(false);
  const smartHubRef = useRef(null);

  const { syncPercent, registerInteraction } = useSynchronization({ isPremium: gpulsePremium, syncTarget });

  const syncHudStatus = useMemo(() => {
    const delta = Math.abs(syncPercent - syncTarget);
    if (delta >= 1) return 'syncing';
    if (isRunning && presentationFase !== FASES.STANDBY && presentationFase !== FASES.RESULTADO) return 'syncing';
    return 'synced';
  }, [syncPercent, syncTarget, isRunning, presentationFase]);

  /** Solo el toggle del usuario; no acoplar a modo de juego. */
  const isSyncRequired = syncMode === true;

  /** Ejecución pausada por sync insuficiente; se libera cuando syncPercent >= syncTarget (vínculo con SYNC_BLOCK). */
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (!isSyncRequired) {
      setIsBlocked(false);
      return;
    }
    if (syncPercent < syncTarget) {
      setIsBlocked(true);
      return;
    }
    setIsBlocked((b) => (b && syncPercent >= syncTarget ? false : b));
  }, [isSyncRequired, syncPercent, syncTarget]);

  /** Latest sync-guard inputs for scheduled runAction callbacks (avoids stale scheduler closure). */
  const triggerSequenceGuardInputsRef = useRef({
    isSyncRequired: true,
    isBlocked: false,
    syncPercent: 0,
    syncTarget: 5,
  });
  triggerSequenceGuardInputsRef.current = {
    isSyncRequired,
    isBlocked,
    syncPercent,
    syncTarget,
  };

  useEffect(() => {
    if (selectedMode === MODOS.IA_REAL && !syncModeManuallyChanged) {
      setSyncMode(true);
    }
  }, [selectedMode, syncModeManuallyChanged]);

  useEffect(() => {
    if (selectedMode !== MODOS.IA_REAL) {
      setSyncModeManuallyChanged(false);
    }
  }, [selectedMode]);

  useEffect(() => {
    switch (presentationFase) {
      case FASES.ANALISIS:
        setSyncTarget(30);
        setSystemMessage('Escaneando entorno...');
        break;
      case FASES.DETECCION:
        setSyncTarget(60);
        setSystemMessage('Detectando patrón...');
        break;
      case FASES.SEÑAL:
        setSyncTarget(85);
        setSystemMessage('Ejecutando señal...');
        break;
      case FASES.RESULTADO:
        setSyncTarget(100);
        setSystemMessage('Sincronización completada');
        break;
      case FASES.REINICIO:
        setSyncTarget(5);
        setSystemMessage('Recalibrando sistema...');
        break;
      default:
        setSyncTarget(5);
        setSystemMessage('Sistema en espera');
    }
  }, [presentationFase]);

  useEffect(() => {
    setSystemMessage(
      syncMode
        ? 'Modo sincronización activo'
        : 'Modo libre activo (sin validación de sincronización)',
    );
  }, [syncMode]);

  useEffect(() => {
    console.log('FASE:', fase);
    console.log('SYNC TARGET:', syncTarget);
    console.log('SYNC:', syncPercent);
    console.log('SYNC MODE:', syncMode);
    console.log('SYNC REQUIRED:', isSyncRequired);
  }, [fase, syncTarget, syncPercent, syncMode, isSyncRequired]);

  useEffect(() => {
    console.log('FASE CAMBIO →', fase);
  }, [fase]);

  // Narrative by mode (keeps existing systemMessage intact for sync/system status).
  useEffect(() => {
    const mode = String(activeCycleMode || selectedMode || '');
    const step = Number(activeShot || 0);
    const amount = step > 0 ? Number(computeBetForStep(stake, step) || 0) : 0;
    const rewardsNet = Number(sessionStats?.sessionRewardsNet || 0);

    const next = buildNarrative({
      mode,
      fase: presentationFase,
      data: {
        wins: sessionStats?.wins,
        losses: sessionStats?.losses,
        step,
        amount,
        rewardsNet,
      },
    });

    setSystemNarrative(next || '');
  }, [activeCycleMode, selectedMode, presentationFase, activeShot, stake, sessionStats?.wins, sessionStats?.losses, sessionStats?.sessionRewardsNet]);

  const [ledger, setLedger] = useState([]);
  const demoBalanceRef = useRef(demoBalance);
  useEffect(() => {
    demoBalanceRef.current = demoBalance;
  }, [demoBalance]);

  useEffect(() => {
    if (activeView !== 'access') {
      setGpulseAccessSubView('overview');
    }
  }, [activeView]);

  const syncInteractThrottleRef = useRef(0);
  useEffect(() => {
    const onClick = () => {
      const t = Date.now();
      if (t - syncInteractThrottleRef.current < 240) return;
      syncInteractThrottleRef.current = t;
      registerInteraction();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [registerInteraction]);

  useEffect(() => {
    const handleFirstInteraction = async () => {
      await unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem('gpulse_guided_done') === '1') return;
      if (sessionStorage.getItem('gpulse_guided_pending') === '1') {
        setGpulseGuidedHighlight(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onGuided = () => {
      try {
        if (localStorage.getItem('gpulse_guided_done') === '1') return;
      } catch {
        /* ignore */
      }
      setGpulseGuidedHighlight(true);
    };
    window.addEventListener('gpulse:guided-start', onGuided);
    return () => window.removeEventListener('gpulse:guided-start', onGuided);
  }, []);

  const dismissGpulseGuided = useCallback(() => {
    setGpulseGuidedHighlight((on) => {
      if (!on) return on;
      try {
        localStorage.setItem('gpulse_guided_done', '1');
        sessionStorage.removeItem('gpulse_guided_pending');
      } catch {
        /* ignore */
      }
      return false;
    });
  }, []);

  const sessionStartTsRef = useRef(Date.now());
  const [aiPopup, setAiPopup] = useState(null);
  const aiPopupTimerRef = useRef(null);
  const lastSoundRef = useRef(0);
  const lastSoundCueRef = useRef({ phaseKey: '', popupKey: '', at: 0 });
  const lastPopupTimeRef = useRef(0);

  const [hudFocusBoost, setHudFocusBoost] = useState(false);
  const hudFocusTimerRef = useRef(null);
  const [isActionDebugEnabled, setIsActionDebugEnabled] = useState(false);
  const actionLogRef = useRef([]);
  const enginePlanRef = useRef(null);
  const [isEngineDebugOpen, setIsEngineDebugOpen] = useState(false);
  const [isSystemIntelOpen, setIsSystemIntelOpen] = useState(false);
  const [actionLogTick, setActionLogTick] = useState(0);
  const lastActionTickAtRef = useRef(0);
  const [isEnginePaused, setIsEnginePaused] = useState(false);
  const [isEngineStepMode, setIsEngineStepMode] = useState(false);
  const stepQueueRef = useRef([]);
  const executeSequenceRef = useRef(null);
  const speakRef = useRef(null);
  const snapshotsRef = useRef([]);
  const snapshotIdRef = useRef(0);

  // Engine timing refs must exist before clearEngineTimers (avoids TDZ / stale source order).
  const cycleTimeout = useRef(null);
  const scoreInterval = useRef(null);
  const engineTimers = useRef([]);
  const isSequenceTriggered = useRef(false);
  /** Patrón guardado si executeSequence difiere por sync bajo (reintento al subir sync o SYNC OFF). */
  const syncBlockedPatternRef = useRef(null);
  /** True desde SYNC_BLOCK hasta que syncPercent >= syncTarget y executeSequence continúa (evita bucle scheduler). */
  const executionBlockedBySyncRef = useRef(false);
  /** Patrón guardado si G_Pulse bloquea en IA_REAL (reintento cuando la señal sea válida). */
  const gpulseBlockedPatternRef = useRef(null);
  const isGoldModeRef = useRef(false);
  /** Latest external signal row id driving IA Real (provider-only execution). */
  const lastProviderSignalIdRef = useRef(null);
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'genesis-oracle-v9-0';

  // Hoisted function; refs above are initialized before any call site runs.
  function clearEngineTimers() {
    if (cycleTimeout.current) clearTimeout(cycleTimeout.current);
    engineTimers.current.forEach((t) => clearTimeout(t));
    engineTimers.current = [];
  }

  const takeEngineSnapshot = useCallback((note) => {
    if (!import.meta.env.DEV) return;
    const ts = Date.now();
    const snap = {
      id: `snap-${ts}-${snapshotIdRef.current++}`,
      timestamp: ts,
      note: String(note || ''),
      phase: presentationFase,
      isRunning,
      isProcessingSequence,
      enginesReady,
      currentMesa,
      currentRonda,
      // sequence state
      pattern: Array.isArray(pattern) ? [...pattern] : [],
      activeShot,
      winnerSide,
      lastWinningShot,
      scores: scores ? { ...scores } : null,
      // domain state
      wallets: typeof structuredClone === 'function' ? structuredClone(wallets) : JSON.parse(JSON.stringify(wallets)),
      ledger: typeof structuredClone === 'function' ? structuredClone(ledger) : JSON.parse(JSON.stringify(ledger)),
    };
    const prev = Array.isArray(snapshotsRef.current) ? snapshotsRef.current : [];
    snapshotsRef.current = [...prev, snap].slice(-20);
  }, [presentationFase, isRunning, isProcessingSequence, enginesReady, currentMesa, currentRonda, pattern, activeShot, winnerSide, lastWinningShot, scores, wallets, ledger]);

  useEffect(() => {
    // snapshot on every phase change
    takeEngineSnapshot(`phase:${String(presentationFase)}`);
  }, [presentationFase, takeEngineSnapshot]);

  useEffect(() => {
    if (presentationFase !== FASES.RESULTADO) return;
    // snapshot on result signal (win/loss)
    takeEngineSnapshot(lastWinningShot ? `result:WIN:T${Number(lastWinningShot)}` : 'result:LOSS');
  }, [presentationFase, lastWinningShot, takeEngineSnapshot]);

  const restoreEngineSnapshot = useCallback((snapshotId) => {
    if (!import.meta.env.DEV) return;
    const snaps = Array.isArray(snapshotsRef.current) ? snapshotsRef.current : [];
    const snap = snaps.find((s) => s.id === snapshotId);
    if (!snap) return;
    clearEngineTimers();
    stepQueueRef.current = [];

    setIsEnginePaused(true);
    setIsEngineStepMode(false);

    // restore primary state
    setFase(snap.phase);
    setIsRunning(Boolean(snap.isRunning));
    setIsProcessingSequence(Boolean(snap.isProcessingSequence));
    setEnginesReady(Number(snap.enginesReady) || 0);
    setCurrentMesa(snap.currentMesa);
    setCurrentRonda(Number(snap.currentRonda) || 1);

    // restore sequence state
    setPattern(Array.isArray(snap.pattern) ? snap.pattern : []);
    setActiveShot(snap.activeShot ?? null);
    setWinnerSide(snap.winnerSide ?? null);
    setLastWinningShot(snap.lastWinningShot ?? null);
    setScores(snap.scores || { player: 0, banker: 0, rolling: false });
    isSequenceTriggered.current = false;

    // restore domain state
    setWallets(snap.wallets);
    setLedger(snap.ledger);
  }, []);

  const replayLastActions = useCallback((count = 10) => {
    if (!import.meta.env.DEV) return;
    const n = Math.max(1, Math.min(50, Number(count) || 10));
    const logs = Array.isArray(actionLogRef.current) ? actionLogRef.current : [];
    const slice = logs.slice(-n);
    if (slice.length === 0) return;

    // pause engine scheduling to avoid interference
    clearEngineTimers();
    setIsEnginePaused(true);
    setIsEngineStepMode(false);

    const baseTs = Number(slice[0].timestamp) || Date.now();
    for (let i = 0; i < slice.length; i++) {
      const e = slice[i];
      const dt = Math.max(0, Math.min(3000, (Number(e.timestamp) || baseTs) - baseTs));
      const t = setTimeout(() => {
        // replay only if payload exists and action is known
        if (!e || e.known === false) return;
        const action = { type: e.type, payload: e.payload };
        // reuse the same actionCtx wiring by invoking runAction with minimal ctx
        runAction(action, {
          isSoundEnabled,
          isActive: true,
          phase: fase,
          debug: isActionDebugEnabled,
          onActionLog: (entry) => {
            actionLogRef.current = [...actionLogRef.current, entry].slice(-200);
          },
          isSequenceTriggeredRef: isSequenceTriggered,
          SoundEngine,
          speak: (k) => speakRef.current?.(k),
          executeSequence: (p) => executeSequenceRef.current?.(p),
          shouldTriggerSequence,
          setEnginesReady,
          setCurrentMesa,
          setCurrentRonda,
          setPattern,
          setWinnerSide,
          setActiveShot,
        });
      }, dt);
      engineTimers.current.push(t);
    }
  }, [fase, isActionDebugEnabled, isSoundEnabled, shouldTriggerSequence]);

  const activeTradingWallet = useMemo(
    () => (activeWalletKey === WALLET_KEY.DUAL ? WALLET_MODE.MULTI : WALLET_MODE.AIG),
    [activeWalletKey],
  );

  const walletBalanceAig = useMemo(
    () => (activeWalletKey === WALLET_KEY.AIG ? wallets.aig.balance : wallets.dual.aig),
    [activeWalletKey, wallets],
  );
  const walletBalanceUsdt = useMemo(
    () => (activeWalletKey === WALLET_KEY.DUAL ? wallets.dual.usdt : 0),
    [activeWalletKey, wallets],
  );

  const activeTradingWalletRef = useRef(activeTradingWallet);
  useEffect(() => {
    activeTradingWalletRef.current = activeTradingWallet;
  }, [activeTradingWallet]);

  const setWalletBalanceAig = useCallback((updater) => {
    setWallets((w) => {
      const mode = activeTradingWalletRef.current;
      if (mode === WALLET_MODE.AIG) {
        const prev = w.aig.balance;
        const next = typeof updater === 'function' ? updater(prev) : Number(updater);
        return { ...w, aig: { ...w.aig, balance: next } };
      }
      const prev = w.dual.aig;
      const next = typeof updater === 'function' ? updater(prev) : Number(updater);
      const dualNext = normalizeDualBalances({ ...w.dual, aig: next });
      return { ...w, dual: { ...dualNext, wagering: w.dual?.wagering } };
    });
  }, []);

  const setWalletBalanceUsdt = useCallback((updater) => {
    setWallets((w) => {
      const prev = w.dual.usdt;
      const next = typeof updater === 'function' ? updater(prev) : Number(updater);
      const dualNext = normalizeDualBalances({ ...w.dual, usdt: next });
      return { ...w, dual: { ...dualNext, wagering: w.dual?.wagering } };
    });
  }, []);

  const setPanelBalanceAig = useCallback((updater) => {
    setWallets((w) => {
      if (walletMode === WALLET_MODE.AIG) {
        const prev = w.aig.balance;
        const next = typeof updater === 'function' ? updater(prev) : Number(updater);
        return { ...w, aig: { ...w.aig, balance: next } };
      }
      const prev = w.dual.aig;
      const next = typeof updater === 'function' ? updater(prev) : Number(updater);
      const dualNext = normalizeDualBalances({ ...w.dual, aig: next });
      return { ...w, dual: { ...dualNext, wagering: w.dual?.wagering } };
    });
  }, [walletMode]);

  const setPanelBalanceUsdt = useCallback((updater) => {
    setWallets((w) => {
      const prev = w.dual.usdt;
      const next = typeof updater === 'function' ? updater(prev) : Number(updater);
      const dualNext = normalizeDualBalances({ ...w.dual, usdt: next });
      return { ...w, dual: { ...dualNext, wagering: w.dual?.wagering } };
    });
  }, []);

  const panelBalanceAig = walletMode === WALLET_MODE.AIG ? wallets.aig.balance : wallets.dual.aig;
  const panelBalanceUsdt = walletMode === WALLET_MODE.MULTI ? wallets.dual.usdt : 0;

  const applyWagerDeposit = useCallback((walletType, depositAmount) => {
    const amt = Number(depositAmount) || 0;
    const multiplier = 10;
    setWallets((w) => {
      if (walletType === 'DUAL') {
        const prev = w.dual?.wagering || { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true };
        const requiredVolume = Math.max(0, amt * multiplier);
        const currentVolume = 0;
        const unlocked = requiredVolume <= 0;
        return { ...w, dual: { ...w.dual, wagering: { ...prev, depositAmount: amt, requiredVolume, currentVolume, unlocked } } };
      }
      const prev = w.aig?.wagering || { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true };
      const requiredVolume = Math.max(0, amt * multiplier);
      const currentVolume = 0;
      const unlocked = requiredVolume <= 0;
      return { ...w, aig: { ...w.aig, wagering: { ...prev, depositAmount: amt, requiredVolume, currentVolume, unlocked } } };
    });
  }, []);

  const applyWagerVolume = useCallback((walletType, volumeAmount) => {
    const inc = Math.max(0, Number(volumeAmount) || 0);
    if (!(inc > 0)) return;
    setWallets((w) => {
      if (walletType === 'DUAL') {
        const prev = w.dual?.wagering || { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true };
        const nextVol = Number(prev.currentVolume || 0) + inc;
        const req = Number(prev.requiredVolume || 0);
        const unlocked = req <= 0 ? true : nextVol >= req;
        return { ...w, dual: { ...w.dual, wagering: { ...prev, currentVolume: nextVol, unlocked } } };
      }
      const prev = w.aig?.wagering || { depositAmount: 0, requiredVolume: 0, currentVolume: 0, unlocked: true };
      const nextVol = Number(prev.currentVolume || 0) + inc;
      const req = Number(prev.requiredVolume || 0);
      const unlocked = req <= 0 ? true : nextVol >= req;
      return { ...w, aig: { ...w.aig, wagering: { ...prev, currentVolume: nextVol, unlocked } } };
    });
  }, []);

  const setIsSoundEnabledWithInit = useCallback(
    async (nextState) => {
      const next = Boolean(nextState);
      if (next) await SoundEngine.init();
      setIsSoundEnabled(next);
      if (next && SoundEngine.isInitialized) SoundEngine.playClick();
    },
    [setIsSoundEnabled],
  );

  const walletAigRef = useRef(walletBalanceAig);
  const walletUsdtRef = useRef(walletBalanceUsdt);

  useEffect(() => {
    walletAigRef.current = walletBalanceAig;
  }, [walletBalanceAig]);
  useEffect(() => {
    walletUsdtRef.current = walletBalanceUsdt;
  }, [walletBalanceUsdt]);

  // --- Wallet sync debugging (DEV only; no logic changes) ---
  const walletDebugLastLogAtRef = useRef(0);
  const walletDebugLastIssuesRef = useRef('');
  const walletAutoFixLastAtRef = useRef(0);
  const walletAutoFixLastKeyRef = useRef('');
  const walletAutoFixCooldownByCauseRef = useRef({});
  const walletHealthHistoryRef = useRef([]);

  const getWalletSnapshot = useCallback(
    (label = '') => {
      const now = Date.now();
      const genesis = typeof window !== 'undefined' ? window.__GENESIS_WALLET__ : undefined;
      const dual = wallets?.dual || {};
      const aig = wallets?.aig || {};

      const totalBalanceHud = activeWalletKey === WALLET_KEY.DUAL
        ? multiMaxUsable(Number(dual.aig), Number(dual.usdt))
        : Number(aig.balance);

      return {
        label: String(label || ''),
        timestamp: now,
        iso: new Date(now).toISOString(),

        // refs
        walletAigRef: Number(walletAigRef.current),
        walletUsdtRef: Number(walletUsdtRef.current),

        // react-derived balances (what UI often shows)
        walletBalanceAig: Number(walletBalanceAig),
        walletBalanceUsdt: Number(walletBalanceUsdt),

        // raw state tree
        wallets_aig_balance: Number(aig.balance),
        wallets_dual_aig: Number(dual.aig),
        wallets_dual_usdt: Number(dual.usdt),
        wallets_dual_excessAig: Number(dual.excessAig || 0),
        wallets_dual_excessUsdt: Number(dual.excessUsdt || 0),

        // HUD totals / mode
        totalBalanceHud: Number(totalBalanceHud),
        operableFromGenesis: Number(genesis?.operableBalance ?? NaN),
        activeWalletKey: String(activeWalletKey),
        walletMode: String(walletMode),
        activeTradingWallet: String(activeTradingWallet),
        activeMode: String(activeCycleMode || selectedMode || ''),

        // extra context
        fase: String(fase),
        isRunning: Boolean(isRunning),
        isWalletPanelOpen: Boolean(isWalletPanelOpen),
        stake: Number(stake),
        mgLevels: Number(mgLevels),

        // not present in codebase currently, but reserved for future pricing
        aigPrice: null,

        // multi wallet data
        multiWalletData: {
          aig: Number(dual.aig),
          usdt: Number(dual.usdt),
          operable: Number(multiMaxUsable(Number(dual.aig), Number(dual.usdt))),
        },
      };
    },
    [
      wallets,
      activeWalletKey,
      walletMode,
      activeTradingWallet,
      activeCycleMode,
      selectedMode,
      fase,
      isRunning,
      isWalletPanelOpen,
      stake,
      mgLevels,
      walletBalanceAig,
      walletBalanceUsdt,
    ],
  );

  const detectDesync = useCallback((s) => {
    const issues = [];
    const eps = 1e-6;

    const pairs = [
      ['walletAigRef', s.walletAigRef, 'walletBalanceAig', s.walletBalanceAig],
      ['walletUsdtRef', s.walletUsdtRef, 'walletBalanceUsdt', s.walletBalanceUsdt],
      ['walletBalanceAig', s.walletBalanceAig, 'wallets_aig_balance', s.wallets_aig_balance],
      ['walletBalanceAig', s.walletBalanceAig, 'wallets_dual_aig', s.wallets_dual_aig],
      ['walletBalanceUsdt', s.walletBalanceUsdt, 'wallets_dual_usdt', s.wallets_dual_usdt],
    ];

    for (const [aKey, aVal, bKey, bVal] of pairs) {
      if (!Number.isFinite(aVal) || !Number.isFinite(bVal)) continue;
      const d = Math.abs(aVal - bVal);
      if (d > 0.01 && d > eps) {
        issues.push({ kind: 'mismatch', aKey, aVal, bKey, bVal, delta: d });
      }
    }

    const nums = [
      ['walletAigRef', s.walletAigRef],
      ['walletUsdtRef', s.walletUsdtRef],
      ['walletBalanceAig', s.walletBalanceAig],
      ['walletBalanceUsdt', s.walletBalanceUsdt],
      ['wallets_aig_balance', s.wallets_aig_balance],
      ['wallets_dual_aig', s.wallets_dual_aig],
      ['wallets_dual_usdt', s.wallets_dual_usdt],
    ];
    for (const [k, v] of nums) {
      if (!Number.isFinite(v)) issues.push({ kind: 'invalid', key: k, value: v });
      if (v < -0.0001) issues.push({ kind: 'negative', key: k, value: v });
    }

    return issues;
  }, []);

  const detectDesyncAdvanced = useCallback(
    (s) => {
      const issues = detectDesync(s);
      const causes = [];

      const mismatch = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 0.01;

      // REF vs STATE mismatch → STATE_NOT_SYNCED
      if (mismatch(s.walletAigRef, s.walletBalanceAig) || mismatch(s.walletUsdtRef, s.walletBalanceUsdt)) {
        causes.push({
          code: 'STATE_NOT_SYNCED',
          detail: 'Refs difieren de balances derivados (state). Posible falta de espejo ref→state o actualización tardía.',
        });
      }

      // STATE vs TREE mismatch → SOURCE_OF_TRUTH_CONFLICT
      if (mismatch(s.walletBalanceAig, s.wallets_aig_balance) || mismatch(s.walletBalanceAig, s.wallets_dual_aig) || mismatch(s.walletBalanceUsdt, s.wallets_dual_usdt)) {
        causes.push({
          code: 'SOURCE_OF_TRUTH_CONFLICT',
          detail: 'Balances derivados no coinciden con el árbol `wallets`. Probable conflicto de fuente (AIG vs DUAL) o routing por modo.',
        });
      }

      // HUD inválido → BAD_DERIVED_CALCULATION
      if (!Number.isFinite(s.totalBalanceHud) || s.totalBalanceHud < -0.0001) {
        causes.push({
          code: 'BAD_DERIVED_CALCULATION',
          detail: 'El total mostrado (HUD) es inválido/negativo. Revisa derivación (multiMaxUsable / selección de wallet activa).',
        });
      }

      // Diferencia por timing → ASYNC_DELAY
      const hasMismatch = issues.some((i) => i && i.kind === 'mismatch');
      if (hasMismatch && (s.isRunning || s.fase === 'SEÑAL')) {
        causes.push({
          code: 'ASYNC_DELAY',
          detail:
            'Durante ejecución/SEÑAL, el desfase puede venir de updates asíncronos (setState batching / refs actualizadas antes que render).',
        });
      }

      return { issues, causes };
    },
    [detectDesync],
  );

  const getWalletHealthScore = useCallback((s) => {
    const { issues, causes } = detectDesyncAdvanced(s);
    let score = 100;

    for (const i of issues) {
      if (!i) continue;
      if (i.kind === 'invalid') score -= 30;
      else if (i.kind === 'negative') score -= 20;
      else if (i.kind === 'mismatch') score -= 8;
      else score -= 5;
    }

    for (const c of causes) {
      if (!c) continue;
      if (c.code === 'BAD_DERIVED_CALCULATION') score -= 25;
      else if (c.code === 'SOURCE_OF_TRUTH_CONFLICT') score -= 18;
      else if (c.code === 'STATE_NOT_SYNCED') score -= 12;
      else if (c.code === 'ASYNC_DELAY') score -= 8;
      else score -= 6;
    }

    return Math.max(0, Math.min(100, score));
  }, [detectDesyncAdvanced]);

  const autoFixWalletSync = useCallback(
    (snapshot, result) => {
      if (!import.meta.env.DEV) return { applied: false, reason: 'not_dev' };
      if (typeof window === 'undefined') return { applied: false, reason: 'no_window' };

      const AUTO_FIX_ENABLED = window.WALLET_AUTO_FIX === true;
      if (!AUTO_FIX_ENABLED) return { applied: false, reason: 'disabled' };
      if (String(snapshot?.fase) === 'RESULTADO') return { applied: false, reason: 'blocked_in_resultado' };

      const health = getWalletHealthScore(snapshot);
      if (health >= 95) return { applied: false, reason: 'healthy_skip', health };

      const now = Date.now();
      if (now - walletAutoFixLastAtRef.current < 500) return { applied: false, reason: 'cooldown' };

      const causes = Array.isArray(result?.causes) ? result.causes : [];
      const rawCodes = causes.map((c) => c?.code).filter(Boolean);
      const PRIORITY = [
        'BAD_DERIVED_CALCULATION',
        'SOURCE_OF_TRUTH_CONFLICT',
        'STATE_NOT_SYNCED',
        'ASYNC_DELAY',
      ];
      const prioRank = new Map(PRIORITY.map((c, i) => [c, i]));
      const causeCodes = [...new Set(rawCodes)].sort((a, b) => (prioRank.get(a) ?? 999) - (prioRank.get(b) ?? 999));
      const key = `${snapshot?.label || ''}|${causeCodes.join(',')}`;
      if (key && key === walletAutoFixLastKeyRef.current && now - walletAutoFixLastAtRef.current < 1500) {
        return { applied: false, reason: 'repeat_guard' };
      }

      let applied = false;
      const actions = [];
      let resolvedCause = null;

      const syncFromRefs = () => {
        const nextA = Number(walletAigRef.current);
        const nextU = Number(walletUsdtRef.current);
        // Avoid unnecessary renders: only update if delta > 0.01
        setWalletBalanceAig((prev) => (Math.abs(Number(prev) - nextA) > 0.01 ? nextA : prev));
        setWalletBalanceUsdt((prev) => (Math.abs(Number(prev) - nextU) > 0.01 ? nextU : prev));
        applied = true;
        actions.push('SYNC_STATE_FROM_REFS');
      };

      // Deterministic: pick ONE cause (highest priority), then apply at most ONE action.
      for (const code of causeCodes) {
        if (
          code === 'BAD_DERIVED_CALCULATION' ||
          code === 'SOURCE_OF_TRUTH_CONFLICT' ||
          code === 'STATE_NOT_SYNCED' ||
          code === 'ASYNC_DELAY'
        ) {
          resolvedCause = code;
          break;
        }
      }

      const COOLDOWN_BY_CAUSE = 1200;
      if (resolvedCause) {
        const last = Number(walletAutoFixCooldownByCauseRef.current?.[resolvedCause] || 0);
        if (last > 0 && now - last < COOLDOWN_BY_CAUSE) {
          return {
            applied: false,
            reason: 'cause_cooldown',
            resolvedCause,
            waitMs: COOLDOWN_BY_CAUSE - (now - last),
            health,
          };
        }
      }

      if (resolvedCause === 'BAD_DERIVED_CALCULATION') {
        actions.push('WARN_ONLY_BAD_DERIVED_CALCULATION');
      } else if (resolvedCause === 'SOURCE_OF_TRUTH_CONFLICT') {
        syncFromRefs();
        actions.push('REFS_DOMINANT');
      } else if (resolvedCause === 'STATE_NOT_SYNCED') {
        syncFromRefs();
      } else if (resolvedCause === 'ASYNC_DELAY') {
        window.setTimeout(() => {
          if (window.WALLET_AUTO_FIX !== true) return;
          const nextA = Number(walletAigRef.current);
          const nextU = Number(walletUsdtRef.current);
          setWalletBalanceAig((prev) => (Math.abs(Number(prev) - nextA) > 0.01 ? nextA : prev));
          setWalletBalanceUsdt((prev) => (Math.abs(Number(prev) - nextU) > 0.01 ? nextU : prev));
        }, 120);
        actions.push('RETRY_ASYNC_DELAY_120MS');
      }

      if (!resolvedCause && !applied && actions.length === 0) return { applied: false, reason: 'no_action', health };

      walletAutoFixLastAtRef.current = now;
      walletAutoFixLastKeyRef.current = key;
      if (resolvedCause) walletAutoFixCooldownByCauseRef.current[resolvedCause] = now;
      console.info('WALLET AUTO-FIX', {
        applied,
        actions,
        causeCodes,
        resolvedCause,
        mode: snapshot?.activeMode,
        fase: snapshot?.fase,
        timestamp: snapshot?.timestamp,
        health,
        at: new Date(now).toISOString(),
      });
      return { applied, actions, causeCodes, resolvedCause, health };
    },
    [setWalletBalanceAig, setWalletBalanceUsdt, getWalletHealthScore],
  );

  const logWalletSync = useCallback(
    (label = '') => {
      if (!import.meta.env.DEV) return null;
      const now = Date.now();
      if (now - walletDebugLastLogAtRef.current < 250) return null;
      walletDebugLastLogAtRef.current = now;

      const snap = getWalletSnapshot(label);
      const result = detectDesyncAdvanced(snap);
      const { issues, causes } = result;
      const issuesKey = issues.length ? JSON.stringify(issues.slice(0, 6)) : '';
      const health = getWalletHealthScore(snap);
      // Optional: keep small health history to spot instability (DEV only).
      walletHealthHistoryRef.current = [...(Array.isArray(walletHealthHistoryRef.current) ? walletHealthHistoryRef.current : []), health].slice(-20);
      const recent = walletHealthHistoryRef.current.slice(-5);
      const lowCount = recent.filter((x) => Number(x) < 70).length;
      const unstable = recent.length >= 5 && lowCount >= 3;

      console.groupCollapsed(
        `%cWALLET_SYNC%c ${snap.label} · ${new Date(snap.timestamp).toLocaleTimeString()} · issues:${issues.length}`,
        'color:#22d3ee;font-weight:800;',
        'color:inherit;',
      );
      console.table({
        activeMode: snap.activeMode,
        fase: snap.fase,
        activeWalletKey: snap.activeWalletKey,
        walletMode: snap.walletMode,
        activeTradingWallet: snap.activeTradingWallet,
        totalBalanceHud: snap.totalBalanceHud,
        operableFromGenesis: snap.operableFromGenesis,
        walletAigRef: snap.walletAigRef,
        walletBalanceAig: snap.walletBalanceAig,
        wallets_aig_balance: snap.wallets_aig_balance,
        wallets_dual_aig: snap.wallets_dual_aig,
        walletUsdtRef: snap.walletUsdtRef,
        walletBalanceUsdt: snap.walletBalanceUsdt,
        wallets_dual_usdt: snap.wallets_dual_usdt,
      });
      if (issues.length) {
        if (issuesKey !== walletDebugLastIssuesRef.current) {
          walletDebugLastIssuesRef.current = issuesKey;
          console.warn('DESYNC DETECTED', issues);
          if (causes.length) console.info('POSSIBLE CAUSES', causes);
        } else {
          console.warn('DESYNC DETECTED (repeat)', { count: issues.length });
        }
      }
      console.info('WALLET HEALTH', health);
      if (unstable) console.info('WALLET HEALTH (unstable)', { recent, lowCount });

      // Optional auto-fix layer (DEV-only, opt-in via DevTools: window.WALLET_AUTO_FIX = true)
      if (issues.length) {
        if (String(snap.fase) !== 'RESULTADO') autoFixWalletSync(snap, result);
      }
      console.groupEnd();
      return snap;
    },
    [getWalletSnapshot, detectDesyncAdvanced, getWalletHealthScore, autoFixWalletSync],
  );

  // Entry to IA_REAL: snapshot once.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const mode = String(activeCycleMode || selectedMode || '');
    if (mode !== MODOS.IA_REAL) return;
    logWalletSync('ENTER_IA_REAL');
  }, [activeCycleMode, selectedMode, logWalletSync]);

  // Optional: force wallet state to follow refs (DEBUG ONLY; OFF by default).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;
    if (window.__WALLET_SYNC_DEBUG__ !== true) return;
    const id = window.setInterval(() => {
      // Intentionally simple: mirror ref values into state setters.
      setWalletBalanceAig(Number(walletAigRef.current));
      setWalletBalanceUsdt(Number(walletUsdtRef.current));
    }, 1000);
    return () => window.clearInterval(id);
  }, [setWalletBalanceAig, setWalletBalanceUsdt]);

  useEffect(() => {
    const operable =
      activeWalletKey === WALLET_KEY.DUAL
        ? 2 * multiOperationalPerLeg(wallets.dual.aig, wallets.dual.usdt)
        : wallets.aig.balance;
    window.__GENESIS_WALLET__ = {
      activeWallet: activeWalletKey,
      wallets,
      operableBalance: operable,
      activeTradingMode: activeTradingWallet,
    };
    return () => {
      delete window.__GENESIS_WALLET__;
    };
  }, [activeWalletKey, wallets, activeTradingWallet]);

  useEffect(() => {
    window.toggleDebug = () => {
      document.body.classList.toggle('debug');
    };
    return () => {
      delete window.toggleDebug;
    };
  }, []);

  useEffect(() => {
    // Optional: toggle action debug without touching UI.
    window.toggleActionDebug = () => setIsActionDebugEnabled((v) => !v);
    return () => {
      delete window.toggleActionDebug;
    };
  }, []);

  useEffect(() => {
    // Optional: toggle engine debug panel without touching UI.
    window.toggleEngineDebugPanel = () => setIsEngineDebugOpen((v) => !v);
    return () => {
      delete window.toggleEngineDebugPanel;
    };
  }, []);

  useEffect(() => {
    window.toggleSystemIntelligencePanel = () => setIsSystemIntelOpen((v) => !v);
    return () => {
      delete window.toggleSystemIntelligencePanel;
    };
  }, []);

  const pauseEngine = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setIsEnginePaused(true);
    clearEngineTimers();
  }, []);

  const resumeEngine = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setIsEnginePaused(false);
  }, []);

  const resetEngine = useCallback(() => {
    if (!import.meta.env.DEV) return;
    clearEngineTimers();
    stepQueueRef.current = [];
    isSequenceTriggered.current = false;
    syncBlockedPatternRef.current = null;
    executionBlockedBySyncRef.current = false;
    setIsBlocked(false);
    gpulseBlockedPatternRef.current = null;
    setIsEnginePaused(false);
    setIsEngineStepMode(false);
    setEnginesReady(0);
    setWinnerSide(null);
    setActiveShot(null);
    setPattern([]);
    setScores({ player: 0, banker: 0, rolling: false });
    SoundEngine.setNoise(false);
    setIsProcessingSequence(false);
    setIsRunning(false);
    setActiveCycleMode(null);
    setFase(FASES.STANDBY);
    setCoreVisual('IDLE');
  }, []);

  const stepEngineOnce = useCallback(() => {
    if (!import.meta.env.DEV) return;
    if (!isEngineStepMode) return;
    const q = Array.isArray(stepQueueRef.current) ? stepQueueRef.current : [];
    const next = q.shift();
    stepQueueRef.current = q;
    if (!next) return;
    if (next.kind === 'action') {
      // Use same ctx as scheduler will use when running actions normally.
      // (ctx is reconstructed in the scheduler effect; here we only step phase/visuals safely)
      // For safety, only support a small subset here:
      if (next.action?.type === 'RESET_ROUND_VISUALS') {
        setWinnerSide(null);
        setActiveShot(null);
      } else if (next.action?.type === 'RESET_SEQUENCE_TRIGGER') {
        isSequenceTriggered.current = false;
      } else if (next.action?.type === 'SET_NOISE') {
        SoundEngine.setNoise(Boolean(next.action?.payload?.active));
      } else if (next.action?.type === 'ENGINE_READY_STEP') {
        const idx = Number(next.action?.payload?.enginesReady) || 0;
        if (idx > 0) setEnginesReady(idx);
      } else if (next.action?.type === 'SPEAK') {
        const kind = String(next.action?.payload?.kind || '');
        if (kind) speakRef.current?.(kind);
      } else if (next.action?.type === 'SET_MESA_RONDA') {
        const mesa = next.action?.payload?.mesa;
        const ronda = next.action?.payload?.ronda;
        if (mesa) setCurrentMesa(mesa);
        if (Number.isFinite(Number(ronda))) setCurrentRonda(Number(ronda));
      } else if (next.action?.type === 'TRIGGER_SEQUENCE') {
        if (shouldTriggerSequence(isSequenceTriggered.current)) {
          const pattern = Array.isArray(next.action?.payload?.pattern) ? next.action.payload.pattern : null;
          if (pattern) {
            isSequenceTriggered.current = true;
            setPattern(pattern);
            executeSequenceRef.current?.(pattern);
          }
        }
      }
    } else if (next.kind === 'phase') {
      setFase(next.nextPhase);
    }
  }, [isEngineStepMode]);

  // --- Live Projection: unified round steps (UI source of truth) ---
  useEffect(() => {
    const seq = Array.isArray(pattern) ? pattern : [];
    if (seq.length === 0) {
      setRoundSteps([]);
      return;
    }
    setRoundSteps(
      seq.slice(0, 6).map((sig, idx) => ({
        step: idx + 1,
        signal: String(sig).toUpperCase() === 'BANKER' ? 'BANKER' : 'PLAYER',
        result: undefined,
        status: 'PENDING',
      })),
    );
  }, [pattern, currentMesa, currentRonda]);

  useEffect(() => {
    const shot = Number(activeShot);
    const hasShot = Number.isFinite(shot) && shot >= 1 && shot <= 6;
    const resultSide =
      winnerSide === 'player' ? 'PLAYER' : winnerSide === 'banker' ? 'BANKER' : null;
    if (!hasShot || !resultSide) return;

    setRoundSteps((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.length === 0) return prev;
      return arr.map((s) => {
        if (Number(s.step) !== shot) return s;
        const signal = s.signal;
        const status = signal === resultSide ? 'WIN' : 'LOSS';
        return { ...s, result: resultSide, status };
      });
    });
  }, [activeShot, winnerSide]);

  useEffect(() => {
    // Mark terminal win/loss on RESULTADO for stable rendering.
    if (presentationFase !== FASES.RESULTADO) return;
    setRoundSteps((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.length === 0) return prev;
      const winStep = Number(lastWinningShot);
      if (Number.isFinite(winStep) && winStep >= 1 && winStep <= 6) {
        return arr.map((s) => (Number(s.step) === winStep ? { ...s, status: 'WIN' } : s));
      }
      // Loss outcome: keep per-step results recorded during execution; if none, keep pending.
      return arr;
    });
  }, [presentationFase, lastWinningShot]);

  const pulseHudFocus = useCallback(() => {
    setHudFocusBoost(true);
    if (hudFocusTimerRef.current) window.clearTimeout(hudFocusTimerRef.current);
    hudFocusTimerRef.current = window.setTimeout(() => setHudFocusBoost(false), 520);
  }, []);

  useEffect(() => {
    // focus pulse on key events: new alert, shot transitions, final result.
    if (aiPopup) pulseHudFocus();
  }, [aiPopup, pulseHudFocus]);
  useEffect(() => {
    if (scores?.rolling) pulseHudFocus();
  }, [scores?.rolling, pulseHudFocus]);
  useEffect(() => {
    if (presentationFase === FASES.RESULTADO) pulseHudFocus();
  }, [presentationFase, pulseHudFocus]);

  const closeHub = useCallback(() => {
    setHubSlideIn(false);
    window.setTimeout(() => setIsHubOpen(false), 300);
  }, []);

  useEffect(() => {
    if (isHubOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isHubOpen]);

  useEffect(() => {
    if (!isHubOpen) {
      setHubSlideIn(false);
      return;
    }
    setHubSlideIn(false);
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHubSlideIn(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [isHubOpen]);

  useEffect(() => {
    if (!isHubOpen) return;
    const t = window.setTimeout(() => hubPanelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isHubOpen]);

  useEffect(() => {
    if (!isSmartHubOpen) return;
    const handler = (e) => {
      const t = e?.target;
      if (t && typeof t.closest === 'function' && t.closest('#smart-hub')) return;
      setIsSmartHubOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSmartHubOpen]);

  useEffect(() => {
    if (!isSmartHubOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsSmartHubOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSmartHubOpen]);

  useEffect(() => {
    if (!isHubOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeHub();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHubOpen, closeHub]);

  const handleHubKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Tab') return;
      const root = hubPanelRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    },
    [],
  );

  const hubMenuItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { id: 'wallet', label: 'Wallet', Icon: Wallet },
      { id: 'history', label: 'History', Icon: History },
      { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
      { id: 'ai', label: 'AI Strategy', Icon: BrainCircuit },
      { id: 'security', label: 'Security', Icon: Shield },
      { id: 'settings', label: 'Settings', Icon: Settings2 },
      { id: 'ecosystem', label: 'Ecosystem', Icon: Globe },
    ],
    [],
  );

  // --- MEMOS DE LÓGICA ---
  const neuralInsight = useMemo(() => {
    if (sessionStats.total === 0) return { interpretation: "ESPERANDO ACTIVIDAD...", recommendation: "INICIA UN CICLO PARA ANALIZAR." };
    const acc = (sessionStats.wins / sessionStats.total) * 100;
    if (activeCycleMode === MODOS.VISOR) {
        if (acc > 90) return { interpretation: "MESA PREDETERMINADA: Los patrones estadísticos son inusualmente claros.", recommendation: "ANÁLISIS: Alta recurrencia detectada en ciclos de corto plazo." };
        return { interpretation: "OBSERVACIÓN ESTABLE: He validado la sincronía de los últimos bloques.", recommendation: "IA VIVA: Mi análisis técnico confirma una mesa de baja volatilidad." };
    }
    if (acc > 90) return { interpretation: "ESTADO DE GRACIA: He sincronizado perfectamente con el azar de esta mesa.", recommendation: "TÁCTICA: Sugiero mantener el ritmo. La ventaja es nuestra." };
    if (sessionStats.losses > 0) return { interpretation: "RUIDO EN EL SISTEMA: Detecto un aumento en la desviación estándar.", recommendation: "ADVERTENCIA: Mi análisis sugiere un cambio de entorno inmediato." };
    return { interpretation: "ESTABILIDAD LOGRADA: He neutralizado la ventaja de la casa efectivamente.", recommendation: "FLUJO: Continuamos operando bajo los parámetros de mi matriz base." };
  }, [sessionStats, activeCycleMode]);

  const statusUI = useMemo(() => {
    if (isIaRealProviderShell) {
      const st = iaRealEngineState.status;
      if (st === 'IDLE') return { title: 'EN REPOSO', sub: 'Esperando señal...' };
      if (st === 'SYNC') return { title: 'SINCRONIZACIÓN', sub: 'Sincronizando...' };
      if (st === 'WAITING_RESULT') return { title: 'SEÑAL ACTIVA', sub: 'Esperando resultado...' };
      if (st === 'RESULT_ANIMATION') return { title: 'RESULTADO', sub: 'Mano resuelta' };
      if (st === 'SUCCESS') return { title: 'SEÑAL ACERTADA', sub: 'Mano resuelta' };
      if (st === 'FAILED') return { title: 'SEÑAL FALLIDA', sub: 'Mano resuelta' };
      return { title: 'IA REAL', sub: '' };
    }
    if (fase === FASES.RESULTADO) return { title: lastWinningShot ? (RESULT_EMOTIONS[lastWinningShot]?.title || "SINC_LOGRADA") : "RECALIBRACIÓN", sub: "MI NÚCLEO ESTÁ APRENDIENDO..." };
    return { 
      title: Number(enginesReady) === 4 ? 'SINC_TOTAL' : fase === FASES.ANALISIS ? 'PENSANDO...' : enginesReady > 0 ? 'CALCULANDO' : 'EN REPOSO', 
      sub: isRunning ? `MODO: ${activeCycleMode || 'SYNC'}` : 'ESPERANDO TU SEÑAL' 
    };
  }, [isIaRealProviderShell, iaRealEngineState.status, fase, lastWinningShot, enginesReady, isRunning, activeCycleMode]);

  const isGoldMode = useMemo(() => isGoPulseActive && pulseCharge === 100, [isGoPulseActive, pulseCharge]);
  const goPulseSpeedFactor = useMemo(() => (isGoPulseActive ? 0.6 : 1), [isGoPulseActive]);

  /** Pre-flight Multi (IA Real): escalera completa requiere cubrir el disparo pico T{mgLevels} */
  const sequencePeakBet = useMemo(
    () => Number(stake) * Math.pow(2, Math.max(0, Number(mgLevels) - 1)),
    [stake, mgLevels],
  );
  const iaRealMultiPeakBlocked = useMemo(
    () =>
      selectedMode === MODOS.IA_REAL &&
      activeTradingWallet === WALLET_MODE.MULTI &&
      sequencePeakBet > 0 &&
      !canExecuteMultiPair(walletBalanceAig, walletBalanceUsdt, sequencePeakBet),
    [selectedMode, activeTradingWallet, sequencePeakBet, walletBalanceAig, walletBalanceUsdt],
  );
  const iaRealMultiMaxReachableStep = useMemo(() => {
    if (selectedMode !== MODOS.IA_REAL || activeTradingWallet !== WALLET_MODE.MULTI) return Number(mgLevels);
    return multiMaxReachableStep(walletBalanceAig, walletBalanceUsdt, stake, mgLevels);
  }, [selectedMode, activeTradingWallet, walletBalanceAig, walletBalanceUsdt, stake, mgLevels]);

  const maxUsableMultiPreFlight = useMemo(
    () => multiMaxUsable(walletBalanceAig, walletBalanceUsdt),
    [walletBalanceAig, walletBalanceUsdt],
  );
  const iaRealMultiNearLimit = useMemo(() => {
    if (selectedMode !== MODOS.IA_REAL || activeTradingWallet !== WALLET_MODE.MULTI) return false;
    if (iaRealMultiPeakBlocked) return false;
    if (sequencePeakBet <= 0) return false;
    const cap = maxUsableMultiPreFlight;
    if (!(cap > 0)) return false;
    const slack = cap - sequencePeakBet;
    return slack >= 0 && slack < 0.15 * cap;
  }, [selectedMode, activeTradingWallet, iaRealMultiPeakBlocked, sequencePeakBet, maxUsableMultiPreFlight]);

  const showMultiPreflightNearBanner = useMemo(() => !isRunning && iaRealMultiNearLimit, [isRunning, iaRealMultiNearLimit]);

  useEffect(() => {
    isGoldModeRef.current = isGoldMode;
  }, [isGoldMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSoundEnabled) {
        SoundEngine.setAmbientProfile('off');
        SoundEngine.setRollingLayer(false);
        return;
      }
      if (!isAudioUnlocked()) return;
      await SoundEngine.init();
      if (!cancelled) {
        SoundEngine.setAmbientProfile('off');
        SoundEngine.setGoldMode(isGoldModeRef.current);
      }
    })();
    return () => { cancelled = true; };
  }, [isSoundEnabled, audioUnlockEpoch]);

  useEffect(() => {
    if (!SoundEngine.isInitialized) return;
    if (!isSoundEnabled) {
      SoundEngine.setAmbientProfile('off');
      return;
    }
    const shouldHum = isRunning && (fase === FASES.ANALISIS || fase === FASES.DETECCION);
    SoundEngine.setAmbientProfile(shouldHum ? 'low' : 'off');
  }, [fase, isRunning, isSoundEnabled]);

  useEffect(() => {
    if (!SoundEngine.isInitialized) return;
    SoundEngine.setGoldMode(isGoldMode);
  }, [isGoldMode]);

  useEffect(() => {
    if (!isRunning || !isSoundEnabled || fase !== FASES.DETECCION) return undefined;
    const id = window.setInterval(() => { SoundEngine.playGlitchMicro(); }, 410);
    return () => window.clearInterval(id);
  }, [fase, isRunning, isSoundEnabled]);

  const speak = useCallback((msgType, params = {}) => {
    const isVisor = (activeCycleMode || selectedMode) === MODOS.VISOR;
    let message = "";
    switch(msgType) {
        case 'ANALISIS': message = isVisor ? "Estudiando la varianza de la mesa. Buscando el patrón oculto." : "Iniciando cálculo de probabilidad marginal. El capital está bajo mi guardia."; break;
        case 'DETECCION': message = isVisor ? "Detecto una anomalía estadística. Interceptando la frecuencia." : "Estableciendo punto de entrada óptimo. El azar es solo una ilusión."; break;
        case 'TIRO': message = isVisor ? `Analizando bloque T${params.shot}. Mi visión no parpadea.` : `Ejecutando orden en T${params.shot}. Minimizando la ventaja de la casa.`; break;
        case 'WIN': message = isVisor ? `Sincronía estadística verificada en T${params.shot}. Bloque perfecto.` : `Victoria confirmada en T${params.shot}. He doblegado la banca.`; break;
        case 'FAIL': message = isVisor ? "Ruido estadístico detectado en T6. Cerrando observación táctica." : "Varianza incontrolable. Iniciando protocolo de retirada y ahorro."; break;
        case 'REINICIO': message = isVisor ? "Vaciando registros de azar. Preparando mi siguiente análisis." : "Limpiando mi núcleo probabilístico. Vamos por otro ciclo maestro."; break;
        default: message = String(msgType);
    }
    setAiSpeech({ message, type: "info" });
  }, [activeCycleMode, selectedMode]);

  // Avoid TDZ issues: make speak callable from earlier callbacks (step/replay).
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  const askOracle = async () => {
    setLoadingOracle(true); setShowOracleModal(true);
    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const systemPrompt = "Eres Genesis Oracle, una IA viva experta en estadística de casino de lujo. Tu tono es sofisticado, analítico y misterioso.";
      const userPrompt = `Analiza sesión: [Aciertos: ${sessionStats.wins}, Fallos: ${sessionStats.losses}, Total: ${sessionStats.total}, Recompensas netas (informativo): ${sessionStats.sessionRewardsNet}]. Mesa: ${currentMesa}. Recomendación táctica maestra de 2 párrafos.`;
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } }) });
      const result = await response.json();
      setOracleInsight(result.candidates?.[0]?.content?.parts?.[0]?.text || "Mi núcleo está recalibrando.");
    } catch (e) { setOracleInsight("Error en enlace neural."); } finally { setLoadingOracle(false); }
  };

  const getTableIntuition = async (histData) => {
    if (loadingIntuition) return;
    setLoadingIntuition(true);
    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const recent = histData.slice(0, 5).map(h => `${h.side} T${h.shot}`).join(", ");
      const userPrompt = `Basado en resultados Baccarat: [${recent}], genera intuición técnica de una sola frase corta (máximo 10 palabras) sobre la mesa ${currentMesa}.`;
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: userPrompt }] }] }) });
      const result = await response.json();
      setTableIntuition(result.candidates?.[0]?.content?.parts?.[0]?.text || "Varianza neutra detectada.");
    } catch (e) { setTableIntuition("Error de escaneo."); } finally { setLoadingIntuition(false); }
  };

  const appendWalletTx = useCallback((row) => {
    setWalletTxHistory((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const now = Date.now();
      const requestId = row?.requestId ? String(row.requestId) : '';
      if (requestId) {
        const ridx = safePrev.findIndex((e) => String(e?.requestId || '') === requestId);
        if (ridx >= 0) {
          const next = [...safePrev];
          const mergedFlow = mergeWalletFlowStates(next[ridx].flowStates, row.flowStates);
          const merged = { ...next[ridx], ...row, at: next[ridx]?.at ?? now };
          if (mergedFlow.length) merged.flowStates = mergedFlow;
          next[ridx] = merged;
          return next.slice(0, 60);
        }
      }
      const txHash = row?.txHash ? String(row.txHash) : '';
      if (txHash) {
        const idx = safePrev.findIndex((e) => String(e?.txHash || '') === txHash);
        if (idx >= 0) {
          const next = [...safePrev];
          const mergedFlow = mergeWalletFlowStates(next[idx].flowStates, row.flowStates);
          const merged = { ...next[idx], ...row, at: next[idx]?.at ?? now };
          if (mergedFlow.length) merged.flowStates = mergedFlow;
          next[idx] = merged;
          return next.slice(0, 60);
        }
      }
      return [
        { id: `w-${now}-${Math.random().toString(36).slice(2, 9)}`, ...row, at: now },
        ...safePrev,
      ].slice(0, 60);
    });
  }, []);

  const logTransaction = useCallback((entry) => {
    const ts = Date.now();
    const row = {
      id: `l-${ts}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: ts,
      walletType: entry.walletType, // 'AIG' | 'DUAL'
      action: entry.action, // deposit | withdraw | bet | win | loss
      amount: Number(entry.amount) || 0,
      aigAmount: Number(entry.aigAmount) || 0,
      usdtAmount: Number(entry.usdtAmount) || 0,
      balanceAfter: Number(entry.balanceAfter) || 0,
      walletAddress: String(entry.walletAddress || ''),
    };
    setLedger((prev) => [row, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
  }, []);

  const ledgerOutcomesDesc = useMemo(() => {
    // ledger is already newest-first, but ensure correct numeric timestamp ordering
    return (Array.isArray(ledger) ? ledger : [])
      .filter((e) => e.action === 'win' || e.action === 'loss')
      .map((e) => ({ action: e.action, timestamp: Number(e.timestamp) || 0 }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [ledger]);

  const lossStreak = useMemo(() => {
    if (ledgerOutcomesDesc.length === 0) return 0;
    if (ledgerOutcomesDesc[0].action !== 'loss') return 0;
    let c = 0;
    for (const e of ledgerOutcomesDesc) {
      if (e.action !== 'loss') break;
      c += 1;
    }
    return c;
  }, [ledgerOutcomesDesc]);

  const ledgerBetCount = useMemo(
    () => (Array.isArray(ledger) ? ledger : []).filter((e) => e.action === 'bet').length,
    [ledger],
  );
  const ledgerWinCount = useMemo(
    () => (Array.isArray(ledger) ? ledger : []).filter((e) => e.action === 'win').length,
    [ledger],
  );
  const winRatePct = useMemo(() => (ledgerBetCount > 0 ? (ledgerWinCount / ledgerBetCount) * 100 : 0), [ledgerBetCount, ledgerWinCount]);

  const exposureLevel = useMemo(() => {
    const s = Number(stake);
    const L = Math.max(1, Math.floor(Number(mgLevels)));
    const peak = s * Math.pow(2, Math.max(0, L - 1));
    const balance =
      activeWalletKey === WALLET_KEY.DUAL ? multiMaxUsable(wallets.dual.aig, wallets.dual.usdt) : Number(wallets.aig.balance);
    const ratio = balance > 0 ? peak / balance : 0;
    if (ratio >= 0.6) return 'HIGH';
    if (ratio >= 0.3) return 'MEDIUM';
    return 'LOW';
  }, [stake, mgLevels, activeWalletKey, wallets]);

  const dualImbalanceDetected = useMemo(() => {
    const a = Number(wallets?.dual?.aig);
    const u = Number(wallets?.dual?.usdt);
    const exA = Number(wallets?.dual?.excessAig || 0);
    const exU = Number(wallets?.dual?.excessUsdt || 0);
    const denom = Math.max(a, u, 1);
    const skew = Math.abs(a - u) / denom;
    return (exA > 0 || exU > 0) && skew > 0.08;
  }, [wallets]);

  const aiPopupCandidate = useMemo(() => {
    // Priority: risk > balance > opportunity > info
    if (lossStreak >= 3 || exposureLevel === 'HIGH') {
      const msg =
        lossStreak >= 5
          ? 'Critical risk. Stop or reset strategy.'
          : lossStreak === 4
            ? 'High risk detected. Consider reducing stake.'
            : 'Risk increasing. Monitor closely.';
      return { type: 'risk', message: msg, critical: lossStreak >= 5 || exposureLevel === 'HIGH' };
    }
    if (dualImbalanceDetected) {
      return { type: 'balance', message: 'Dual wallet imbalance detected. Rebalance for optimal execution.', critical: false };
    }
    if (winRatePct >= 60 && lossStreak === 0 && ledgerBetCount >= 5) {
      return { type: 'opportunity', message: 'Opportunity detected. System performing optimally.', critical: false };
    }
    return null;
  }, [lossStreak, exposureLevel, dualImbalanceDetected, winRatePct, ledgerBetCount]);

  const systemSyncMood = useMemo(() => {
    if (lossStreak >= 3 || exposureLevel === 'HIGH') return 'risk';
    if (dualImbalanceDetected) return 'balance';
    if (winRatePct >= 60 && lossStreak === 0 && ledgerBetCount >= 5) return 'opportunity';
    return 'neutral';
  }, [lossStreak, exposureLevel, dualImbalanceDetected, winRatePct, ledgerBetCount]);

  // --- Slow, non-intrusive diagnostics (no realtime spam) ---
  const [signalIdleTime, setSignalIdleTime] = useState(0);
  const diagnosticsCooldownRef = useRef(0);
  const [diagnostics, setDiagnostics] = useState(() =>
    runDiagnostics({
      actionLog: actionLogRef.current,
      currentPhase: fase,
      isActive: isRunning,
    }),
  );

  // Idle timer: only meaningful in SEÑAL; counts seconds.
  useEffect(() => {
    if (!isRunning || fase !== FASES.SEÑAL) {
      setSignalIdleTime(0);
      return;
    }
    const id = window.setInterval(() => setSignalIdleTime((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [fase, isRunning]);

  // Reset idle on any engine activity tick while in SEÑAL.
  useEffect(() => {
    if (!isRunning) return;
    if (fase !== FASES.SEÑAL) return;
    setSignalIdleTime(0);
  }, [actionLogTick, fase, isRunning]);

  const computeDiagnosticsSnapshot = useCallback(() => {
    const base = runDiagnostics({
      actionLog: actionLogRef.current,
      currentPhase: fase,
      isActive: isRunning,
    });

    // Remove noisy/short-window heuristics; keep only actionable diagnostics.
    const issues = (Array.isArray(base.issues) ? base.issues : []).filter(
      (i) => i && i.id !== 'phase_stuck' && i.id !== 'action_overflow_rate' && i.id !== 'action_overflow_buffer',
    );

    // Add slow "idle in SEÑAL" diagnostic (30min).
    if (isRunning && fase === FASES.SEÑAL && signalIdleTime > 1800) {
      issues.unshift({
        id: 'signal_idle_long',
        severity: 'warning',
        title: 'Signal idle',
        message: 'Fase SEÑAL sin actividad prolongada.',
        meta: { idleSeconds: signalIdleTime },
      });
    }

    return {
      ...base,
      ok: issues.length === 0,
      issues,
      summary: issues.length ? `${issues[0].severity.toUpperCase()}: ${issues[0].title}` : 'OK',
    };
  }, [fase, isRunning, signalIdleTime]);

  // Global cooldown: never update diagnostics more often than every 2 minutes.
  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - diagnosticsCooldownRef.current < 120_000) return;
      diagnosticsCooldownRef.current = now;
      setDiagnostics(computeDiagnosticsSnapshot());
    };

    // Evaluate on phase transitions / running toggles, but respect cooldown.
    run();

    // Periodic slow refresh (keeps UX stable, avoids realtime spam).
    const id = window.setInterval(run, 10_000);
    return () => window.clearInterval(id);
  }, [computeDiagnosticsSnapshot]);

  // Active alert (single source for "silent" visual state): aiPopup > diagnostics.
  const activeAlert = useMemo(() => {
    if (aiPopup) {
      if (aiPopup.type === 'balance') return { type: 'balance', priority: 2, message: aiPopup.message };
      if (aiPopup.type === 'risk') return { type: 'error', priority: aiPopup.critical ? 1 : 2, message: aiPopup.message };
      if (aiPopup.type === 'opportunity') return { type: 'info', priority: 3, message: aiPopup.message };
      return { type: String(aiPopup.type || 'info'), priority: aiPopup.critical ? 1 : 3, message: aiPopup.message };
    }
    if (diagnostics && diagnostics.ok === false) {
      const sev = String(diagnostics.issues?.[0]?.severity || 'warning');
      return {
        type: sev === 'critical' ? 'error' : 'diagnostic',
        priority: sev === 'critical' ? 1 : 2,
        message: String(diagnostics.issues?.[0]?.message || diagnostics.summary || ''),
      };
    }
    return null;
  }, [aiPopup, diagnostics]);

  const gpulseStats = useMemo(() => {
    if (!gpulseHistory.length) return null;

    let total = 0;
    let wins = 0;

    const zoneStats = {
      hot: { total: 0, wins: 0 },
      neutral: { total: 0, wins: 0 },
      cold: { total: 0, wins: 0 },
    };

    gpulseHistory.forEach((entry) => {
      if (!entry.executed || entry.result === null) return;

      total++;
      if (entry.result === 'win') wins++;

      if (zoneStats[entry.zone]) {
        zoneStats[entry.zone].total++;
        if (entry.result === 'win') {
          zoneStats[entry.zone].wins++;
        }
      }
    });

    const winrate = total ? wins / total : 0;

    const zoneWinrate = {
      hot: zoneStats.hot.total ? zoneStats.hot.wins / zoneStats.hot.total : 0,
      neutral: zoneStats.neutral.total ? zoneStats.neutral.wins / zoneStats.neutral.total : 0,
      cold: zoneStats.cold.total ? zoneStats.cold.wins / zoneStats.cold.total : 0,
    };

    return {
      total,
      wins,
      winrate,
      zoneWinrate,
    };
  }, [gpulseHistory]);

  useEffect(() => {
    console.log('G_PULSE_STATS', gpulseStats);
  }, [gpulseStats]);

  const dynamicWeights = useMemo(() => {
    if (!gpulseStats) return null;

    const weights = {
      rhythm: 0.2,
      volatility: 0.15,
      momentum: 0.2,
      streak: 0.25,
      pressure: 0.2,
    };

    if (gpulseStats.zoneWinrate.hot < 0.5) {
      weights.momentum -= 0.05;
      weights.streak += 0.05;
    }

    return weights;
  }, [gpulseStats]);

  const gpulse = useMemo(() => {
    return computeGPulse(history, dynamicWeights || undefined);
  }, [history, dynamicWeights]);

  // Live refs for async gate checks (executeSequence may await; keep freshest values).
  const gpulseLiveRef = useRef(gpulse);
  const gpulseStatsLiveRef = useRef(gpulseStats);
  useEffect(() => {
    gpulseLiveRef.current = gpulse;
  }, [gpulse]);
  useEffect(() => {
    gpulseStatsLiveRef.current = gpulseStats;
  }, [gpulseStats]);

  useEffect(() => {
    console.log('G_PULSE', gpulse);
  }, [gpulse]);

  useEffect(() => {
    if (dynamicWeights) {
      console.log('DYNAMIC_WEIGHTS', dynamicWeights);
    }
  }, [dynamicWeights]);

  const energyOpacity = useMemo(() => {
    const base = isGoPulseActive ? 0.12 : 0.07;
    const phaseBoost =
      presentationFase === FASES.SEÑAL
        ? 0.06
        : presentationFase === FASES.DETECCION
          ? 0.04
          : presentationFase === FASES.ANALISIS
            ? 0.03
            : 0.02;
    const moodBoost = systemSyncMood === 'risk' ? 0.05 : systemSyncMood === 'balance' ? 0.04 : systemSyncMood === 'opportunity' ? 0.04 : 0.0;
    return Math.min(0.22, base + phaseBoost + moodBoost);
  }, [isGoPulseActive, presentationFase, systemSyncMood]);

  const portalSyncClass = useMemo(() => {
    if (presentationFase === FASES.ANALISIS || presentationFase === FASES.DETECCION) return 'sync-portal-breath';
    if (presentationFase === FASES.SEÑAL) return 'sync-portal-breath';
    return '';
  }, [presentationFase]);

  useEffect(() => {
    const currentKey = aiPopup ? `${aiPopup.type}::${aiPopup.message}` : '';
    const nextKey = aiPopupCandidate ? `${aiPopupCandidate.type}::${aiPopupCandidate.message}` : '';

    // Clear pinned/previous alert when resolved.
    if (!aiPopupCandidate) {
      if (aiPopupTimerRef.current) window.clearTimeout(aiPopupTimerRef.current);
      if (aiPopup) setAiPopup(null);
      return;
    }

    if (nextKey === currentKey) return;

    const now = Date.now();
    if (now - lastPopupTimeRef.current < 4000) return;
    lastPopupTimeRef.current = now;

    setAiPopup(aiPopupCandidate);
    if (aiPopupTimerRef.current) window.clearTimeout(aiPopupTimerRef.current);

    // Critical alerts stay visible until resolved.
    if (!aiPopupCandidate.critical) {
      aiPopupTimerRef.current = window.setTimeout(() => setAiPopup(null), 3000);
    }

    return () => {
      if (aiPopupTimerRef.current) window.clearTimeout(aiPopupTimerRef.current);
    };
  }, [aiPopupCandidate, aiPopup]);

  useEffect(() => {
    if (!isSoundEnabled) return;
    if (!SoundEngine.isInitialized) return;
    if (Date.now() - lastSoundRef.current < 500) return;
    const now = Date.now();
    const debounceMs = 700;

    const phaseKey = `fase:${String(presentationFase)}`;
    if (phaseKey !== lastSoundCueRef.current.phaseKey && now - lastSoundCueRef.current.at > debounceMs) {
      const intensity =
        systemSyncMood === 'risk' ? 0.22 :
        systemSyncMood === 'opportunity' ? 0.18 :
        systemSyncMood === 'balance' ? 0.16 :
        0.16;
      if (presentationFase === FASES.ANALISIS) SoundEngine.playThinkingCue('analysis', intensity);
      else if (presentationFase === FASES.DETECCION) SoundEngine.playThinkingCue('detection', intensity);
      else if (presentationFase === FASES.SEÑAL) SoundEngine.playSignalCue(Math.min(0.22, intensity + 0.04));
      lastSoundCueRef.current.phaseKey = phaseKey;
      lastSoundCueRef.current.at = now;
      lastSoundRef.current = now;
    }
  }, [presentationFase, isSoundEnabled, systemSyncMood]);

  useEffect(() => {
    if (!isSoundEnabled) return;
    if (!SoundEngine.isInitialized) return;
    if (!aiPopup) return;
    if (Date.now() - lastSoundRef.current < 500) return;
    const now = Date.now();
    const debounceMs = 900;
    const popupKey = `popup:${aiPopup.type}:${aiPopup.message}`;
    if (popupKey === lastSoundCueRef.current.popupKey) return;
    if (now - lastSoundCueRef.current.at < debounceMs) return;
    const intensity =
      aiPopup?.type === 'risk' ? 0.3 :
      aiPopup?.type === 'opportunity' ? 0.25 :
      0.2;
    SoundEngine.playPopupCue(aiPopup.type, intensity);
    lastSoundCueRef.current.popupKey = popupKey;
    lastSoundCueRef.current.at = now;
    lastSoundRef.current = now;
  }, [aiPopup, isSoundEnabled]);

  const openWalletPanel = useCallback(() => {
    setWalletSubView(WALLET_VIEWS.MAIN);
    setWalletMode(activeTradingWallet);
    setIsWalletPanelOpen(true);
    if (import.meta.env.DEV) logWalletSync('OPEN_WALLET_PANEL');
    if (isSoundEnabled) SoundEngine.playClick();
  }, [isSoundEnabled, activeTradingWallet, logWalletSync]);

  const closeWalletPanel = useCallback(() => {
    setIsWalletPanelOpen(false);
    setTimeout(() => setWalletSubView(WALLET_VIEWS.MAIN), 350);
  }, []);

  async function handleConnectWallet() {
    if (userWalletAddress) {
      console.info('Wallet already connected');
      return userWalletAddress;
    }
    if (isWeb3MockMode()) {
      throw new Error('NO_INJECTED_WALLET');
    }
    try {
      const { provider, signer, address } = await connectInjectedWallet();
      const normalizedAddress = getAddress(address);
      userWalletSessionRef.current = { provider, signer };
      setUserWalletAddress(normalizedAddress);
      console.info('Wallet connected:', normalizedAddress);
      return normalizedAddress;
    } catch (err) {
      console.error('Wallet connection failed:', err);
      throw err;
    }
  }

  const handleDisconnectWallet = useCallback(() => {
    userWalletSessionRef.current = { provider: null, signer: null };
    setUserWalletAddress(null);
    setUserWalletAuthToken(null);
  }, []);

  const handleHubItemSelect = useCallback(
    (id) => {
      if (id === 'wallet') {
        setActiveView('wallet');
        openWalletPanel();
      } else {
        setActiveView(id);
      }
      closeHub();
    },
    [openWalletPanel, closeHub],
  );

  const saveResult = useCallback(async (shot, lastBet, side) => {
    setStats(prev => { 
      const newT = [...(Array.isArray(prev?.totals) ? prev.totals : Array(8).fill(0))]; 
      if (Number(shot) > 0) newT[Number(shot)]++; else newT[7]++; 
      const count = newT.reduce((a, b) => a + b, 0); 
      return { wins: (prev?.wins || 0) + (Number(shot) > 0 ? 1 : 0), precision: parseFloat(((count > 0 ? (count - newT[7]) / count : 1) * 100).toFixed(2)), totals: newT }; 
    });
    if (Number(shot) > 0 && activeCycleMode !== MODOS.VISOR) {
      const winAmount = Number(lastBet) * (side === 'banker' ? 1.95 : 2.0);
      if (activeCycleMode === MODOS.IA_REAL) {
        const preA = Number(walletAigRef.current);
        const preU = Number(walletUsdtRef.current);
        const isDual = activeTradingWallet === WALLET_MODE.MULTI;
        const aDelta = isDual ? winAmount / 2 : winAmount;
        const uDelta = isDual ? winAmount / 2 : 0;
        const afterA = preA + aDelta;
        const afterU = preU + uDelta;
        logTransaction({
          walletType: isDual ? 'DUAL' : 'AIG',
          action: 'win',
          amount: winAmount,
          aigAmount: aDelta,
          usdtAmount: uDelta,
          balanceAfter: isDual ? multiMaxUsable(afterA, afterU) : afterA,
          walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
        });
        applyIaRealWinCredit(activeTradingWallet, winAmount, setWalletBalanceAig, setWalletBalanceUsdt);
      } else {
        const pre = Number(demoBalanceRef.current);
        const after = pre + winAmount;
        const isDual = activeTradingWallet === WALLET_MODE.MULTI;
        logTransaction({
          walletType: isDual ? 'DUAL' : 'AIG',
          action: 'win',
          amount: winAmount,
          aigAmount: isDual ? winAmount / 2 : winAmount,
          usdtAmount: isDual ? winAmount / 2 : 0,
          balanceAfter: after,
          walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
        });
        setDemoBalance(prev => Number(prev) + winAmount);
      }
      setBalanceAnimate(true); setTimeout(() => setBalanceAnimate(false), 300);
    }
    const entry = { mesa: String(currentMesa), ronda: Number(currentRonda), shot: Number(shot), side: String(side || 'FAIL') };
    const ts = Date.now();
    setHistory((prev) => {
      const row = { id: `local-${ts}-${Math.random().toString(16).slice(2, 10)}`, ...entry, timestamp: { toMillis: () => ts } };
      const logs = [row, ...prev];
      logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      return logs.slice(0, 30);
    });
    if (db && userId) {
      try {
        const statsRef = doc(db, 'artifacts', appId, 'users', userId, 'stats', 'main');
        const docSnap = await getDoc(statsRef);
        let cur = docSnap.exists() ? docSnap.data() : { wins: 0, totals: Array(8).fill(0) };
        const updatedTotals = Array.isArray(cur.totals) ? [...cur.totals] : Array(8).fill(0); 
        if (Number(shot) > 0) updatedTotals[Number(shot)]++; else updatedTotals[7]++;
        const count = updatedTotals.reduce((a, b) => a + b, 0); 
        await setDoc(statsRef, { wins: (Number(cur.wins) || 0) + (Number(shot) > 0 ? 1 : 0), precision: parseFloat(((count > 0 ? (count - updatedTotals[7]) / count : 1) * 100).toFixed(2)), totals: updatedTotals });
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'history'), { mesa: entry.mesa, ronda: entry.ronda, shot: entry.shot, side: entry.side, timestamp: serverTimestamp() });
      } catch (e) {}
    }
  }, [db, userId, appId, activeCycleMode, activeTradingWallet, currentMesa, currentRonda, logTransaction]);

  function updateLastGpulseResult(result) {
    setGpulseHistory((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].executed === true && updated[i].result === null) {
          updated[i] = {
            ...updated[i],
            result: result,
          };
          break;
        }
      }
      return updated;
    });
  }

  const executeSequence = useCallback(async (pat) => {
    if (GPULSE_REAL_PROVIDER_EXECUTION && activeCycleMode === MODOS.IA_REAL) {
      setIsProcessingSequence(false);
      setCoreVisual('READY');
      return;
    }
    if (import.meta.env.DEV) {
      console.log('EXECUTE SEQUENCE TRIGGERED');
      console.log('SYNC CHECK:', { syncMode, isSyncRequired, syncPercent });
    }
    setCoreVisual('EXECUTING');
    if (import.meta.env.DEV) logWalletSync('BEFORE_EXECUTE_SEQUENCE');

    const executionContext = {
      gpulseForced: false,
      syncForced: false,
      fundsCapped: false,
    };
    const executionId = Date.now();
    let executionConfidence = 1;
    const getExecutionQuality = (conf) =>
      conf > 0.85 ? 'HIGH' : conf > 0.6 ? 'MEDIUM' : 'LOW';
    const logExecutionFinal = () => {
      console.info('EXECUTION CONTEXT', {
        executionId,
        executionContext,
        executionConfidence,
        executionQuality: getExecutionQuality(executionConfidence),
      });
    };
    const logExecutionInterrupted = ({ reason, step }) => {
      console.warn('EXECUTION INTERRUPTED', {
        executionId,
        reason,
        step,
        executionContext,
        executionConfidence,
        executionQuality: getExecutionQuality(executionConfidence),
      });
    };

    const DEBUG_BYPASS_GPULSE =
      import.meta.env.DEV && typeof window !== 'undefined' && window.DEBUG_BYPASS_GPULSE === true;
    const DEBUG_FORCE_SYNC_READY =
      import.meta.env.DEV && typeof window !== 'undefined' && window.DEBUG_FORCE_SYNC_READY === true;

    // SYNC stabilization: allow a slow fallback so IA_REAL never deadlocks on impossible sync targets.
    const syncBlockStartRef = executeSequence._syncBlockStartRef || (executeSequence._syncBlockStartRef = { at: 0 });
    if (isSyncRequired && !DEBUG_FORCE_SYNC_READY && syncPercent < syncTarget) {
      if (!syncBlockStartRef.at) syncBlockStartRef.at = Date.now();
      const waitedMs = Date.now() - syncBlockStartRef.at;
      if (waitedMs > 45_000) {
        console.warn('⚠️ SYNC TIMEOUT → FORCED EXECUTION', { waitedMs, syncPercent, syncTarget });
        executionContext.syncForced = true;
        executionConfidence *= 0.8;
      } else {
      console.warn('⛔ Sync insuficiente');
      console.warn('SYNC BLOCK', { syncPercent, syncTarget });
      setCoreVisual('BLOCKED_SYNC');
      setSystemMessage('Esperando sincronización óptima...');
      syncBlockedPatternRef.current = Array.isArray(pat) ? pat : null;
      executionBlockedBySyncRef.current = true;
      setIsBlocked(true);
      isSequenceTriggered.current = false;
      setPattern([]);
      logExecutionInterrupted({ reason: 'SYNC_BLOCK', step: null });
      return;
      }
    } else {
      syncBlockStartRef.at = 0;
    }

    syncBlockedPatternRef.current = null;
    executionBlockedBySyncRef.current = false;
    if (isSyncRequired && syncPercent >= syncTarget) {
      setIsBlocked(false);
    }

    if (isSyncRequired && syncPercent >= 60 && syncPercent < 85) {
      setAiSpeech({
        message: 'Sincronización por debajo del óptimo — operando con precaución.',
        type: 'warning',
      });
    }

    const statsNow = gpulseStatsLiveRef.current;
    const gpNow = gpulseLiveRef.current;
    const hotWinrate = statsNow?.zoneWinrate?.hot ?? 0;
    const totalSamples = statsNow?.total ?? 0;

    // Stabilization thresholds (IA_REAL): relaxed vs previous gate, but still meaningful.
    const GPULSE_MIN_CONFIDENCE = 0.55;
    const GPULSE_MIN_HOT = 0.5; // maps to gpulse.score (0–1). (gpulse.hot does not exist)

    const enforceGpulseGate = activeCycleMode === MODOS.IA_REAL;

    const isValidByGPulse =
      !enforceGpulseGate ||
      (Number(gpNow.confidence) >= GPULSE_MIN_CONFIDENCE && Number(gpNow.score) >= GPULSE_MIN_HOT);

    console.log('VALIDATION CHECK', {
      zone: gpulse.zone,
      phase: gpulse.phase,
      hotWinrate,
      enforceGpulseGate,
      isValidByGPulse,
    });
    console.warn('GPULSE CHECK', {
      enforceGpulseGate,
      isValidByGPulse,
      debugBypass: DEBUG_BYPASS_GPULSE,
      gpulseData: gpNow,
      hotWinrate,
      GPULSE_MIN_CONFIDENCE,
      GPULSE_MIN_HOT,
      totalSamples,
    });

    let gpulseOk = isValidByGPulse;
    if (!gpulseOk && enforceGpulseGate && !DEBUG_BYPASS_GPULSE && import.meta.env.DEV) {
      let attempts = 0;
      while (!gpulseOk && attempts < 3) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 400));
        attempts += 1;
        const s2 = gpulseStatsLiveRef.current;
        const g2 = gpulseLiveRef.current;
        const hw2 = s2?.zoneWinrate?.hot ?? 0;
        const ts2 = s2?.total ?? 0;
        gpulseOk =
          Number(g2.confidence) >= GPULSE_MIN_CONFIDENCE && Number(g2.score) >= GPULSE_MIN_HOT;
        console.warn('GPULSE CHECK (retry)', {
          attempts,
          gpulseOk,
          gpulseData: g2,
          hotWinrate: hw2,
          GPULSE_MIN_CONFIDENCE,
          GPULSE_MIN_HOT,
          totalSamples: ts2,
        });
      }
      if (!gpulseOk) {
        console.warn('⚠️ GPULSE TIMEOUT → FORCED EXECUTION');
        executionContext.gpulseForced = true;
        executionConfidence *= 0.7;
        gpulseOk = true;
      }
    }

    if (!gpulseOk && enforceGpulseGate && DEBUG_BYPASS_GPULSE) {
      executionContext.gpulseForced = true;
      executionConfidence *= 0.7;
    }

    if (!gpulseOk && !(DEBUG_BYPASS_GPULSE && enforceGpulseGate)) {
      console.log('⛔ Señal bloqueada por G_Pulse', gpNow);
      setCoreVisual('BLOCKED_GPULSE');
      setGpulseHistory((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          score: gpNow.score,
          zone: gpNow.zone,
          phase: gpNow.phase,
          suggestion: gpNow.suggestion,
          executed: false,
          result: null,
        },
      ]);
      isSequenceTriggered.current = false;
      gpulseBlockedPatternRef.current = enforceGpulseGate && Array.isArray(pat) ? pat : null;
      setPattern([]);
      if (enforceGpulseGate) {
        setSystemMessage('Condiciones no óptimas… esperando alineación G_Pulse');
      }
      logExecutionInterrupted({ reason: 'GPULSE_BLOCK', step: null });
      return;
    }

    setGpulseHistory((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        score: gpulse.score,
        zone: gpulse.zone,
        phase: gpulse.phase,
        suggestion: gpulse.suggestion,
        executed: true,
        result: null,
      },
    ]);

    setIsProcessingSequence(true);
    // FUNDS stabilization: cap levels to what is actually playable (prevents abort mid-loop).
    const requestedLevels = Math.max(1, Math.floor(Number(mgLevels) || 1));
    let effectiveLevels = requestedLevels;
    if (activeCycleMode === MODOS.IA_REAL) {
      let playable = 0;
      for (let k = 1; k <= requestedLevels; k++) {
        const bet = computeBetForStep(stake, k);
        const funds = canExecuteShot({
          activeCycleMode: 'IA_REAL',
          activeTradingWallet,
          walletModeAigConst: WALLET_MODE.AIG,
          aig: walletAigRef.current,
          usdt: walletUsdtRef.current,
          bet,
        });
        if (!funds.ok) break;
        playable = k;
      }
      effectiveLevels = Math.max(1, playable);
      if (effectiveLevels < requestedLevels) {
        console.warn('⚠️ FUNDS CAP', { requestedLevels, effectiveLevels });
        setSystemMessage(`Fondos limitan progresión: ejecutando hasta T${effectiveLevels} (de T${requestedLevels}).`);
        executionContext.fundsCapped = true;
        executionConfidence *= 0.9;
      }
    }
    const winAt = computeWinAt(effectiveLevels); 
    const speedFactor = goPulseSpeedFactor; 

    const MULTI_INSUFFICIENT = 'Insufficient balance in one of the assets to execute this operation';

    const abortSequenceFunds = (msg, meta = {}) => {
      console.warn('⛔ IA_REAL ABORT (FUNDS)', {
        msg,
        meta,
        activeTradingWallet,
        walletAIG: Number(walletAigRef.current),
        walletUSDT: Number(walletUsdtRef.current),
        stake: Number(stake),
        mgLevels: Number(mgLevels),
      });
      logExecutionInterrupted({ reason: 'ABORT_FUNDS', step: meta?.step ?? null });
      setCoreVisual('ERROR_FUNDS');
      if (scoreInterval.current) clearInterval(scoreInterval.current);
      SoundEngine.setNoise(false);
      setAiSpeech({ message: msg, type: 'error' });
      setSystemMessage(msg);
      setIsProcessingSequence(false);
      setIsRunning(false);
      setFase(FASES.STANDBY);
      setActiveCycleMode(null);
      setEnginesReady(0);
      isSequenceTriggered.current = false;
      setWinnerSide(null);
      setActiveShot(null);
    };

    for (let i = 1; i <= effectiveLevels; i++) {
      console.warn('LOOP STATUS', { isRunning, step: i });
      if (!isRunning) {
        console.warn('⛔ LOOP BREAK', { step: i, fase, reason: 'isRunning false' });
        setCoreVisual('INTERRUPTED');
        logExecutionInterrupted({ reason: 'LOOP_BREAK_isRunning_false', step: i });
        break;
      }
      const currentBet = computeBetForStep(stake, i);
      if (import.meta.env.DEV) logWalletSync(`STEP_${i}_PRECHECK`);
      console.warn('FUNDS CHECK', {
        walletAIG: walletAigRef.current,
        stake,
        mgLevels,
        required: Number(stake) * Number(mgLevels),
        step: i,
        bet: currentBet,
      });

      const funds = canExecuteShot({
        activeCycleMode: activeCycleMode === MODOS.IA_REAL ? 'IA_REAL' : String(activeCycleMode),
        activeTradingWallet,
        walletModeAigConst: WALLET_MODE.AIG,
        aig: walletAigRef.current,
        usdt: walletUsdtRef.current,
        bet: currentBet,
      });
      if (!funds.ok) {
        abortSequenceFunds(
          funds.reason === 'INSUFFICIENT_AIG' ? 'RESERVA INSUFICIENTE PARA OPERAR.' : MULTI_INSUFFICIENT,
          { step: i, bet: Number(currentBet), reason: funds.reason },
        );
        return;
      }

      setActiveShot(i);
      if (isSoundEnabled) SoundEngine.playSignalStep(i);

      speak('TIRO', { shot: i });

      if (activeCycleMode !== MODOS.VISOR) {
        if (activeCycleMode === MODOS.IA_REAL) {
          const preA = Number(walletAigRef.current);
          const preU = Number(walletUsdtRef.current);
          const isDual = activeTradingWallet === WALLET_MODE.MULTI;
          const aDelta = isDual ? currentBet / 2 : currentBet;
          const uDelta = isDual ? currentBet / 2 : 0;
          const afterA = preA - aDelta;
          const afterU = preU - uDelta;
          logTransaction({
            walletType: isDual ? 'DUAL' : 'AIG',
            action: 'bet',
            amount: currentBet,
            aigAmount: aDelta,
            usdtAmount: uDelta,
            balanceAfter: isDual ? multiMaxUsable(afterA, afterU) : afterA,
            walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
          });
          applyIaRealStakeDebit(activeTradingWallet, currentBet, setWalletBalanceAig, setWalletBalanceUsdt);
          applyWagerVolume(isDual ? 'DUAL' : 'AIG', currentBet);
        } else {
          const pre = Number(demoBalanceRef.current);
          const after = pre - currentBet;
          const isDual = activeTradingWallet === WALLET_MODE.MULTI;
          logTransaction({
            walletType: isDual ? 'DUAL' : 'AIG',
            action: 'bet',
            amount: currentBet,
            aigAmount: isDual ? currentBet / 2 : currentBet,
            usdtAmount: isDual ? currentBet / 2 : 0,
            balanceAfter: after,
            walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
          });
          setDemoBalance((p) => Number(p) - currentBet);
          applyWagerVolume(isDual ? 'DUAL' : 'AIG', currentBet);
        }
        setBalanceAnimate(true); setTimeout(() => setBalanceAnimate(false), 300);
      }

      setScores({ player: 0, banker: 0, rolling: true });
      if (isSoundEnabled) SoundEngine.setNoise(true);
      let ticks = 0;
      scoreInterval.current = setInterval(() => { if (!isRunning) return; setScores(prev => ({ ...prev, player: Math.floor(Math.random()*10), banker: Math.floor(Math.random()*10) })); if (isSoundEnabled) SoundEngine.playRollingTick(); if (++ticks > 12) clearInterval(scoreInterval.current); }, COGNITIVE_ROLL_TICK_MS);
      await new Promise(r => setTimeout(r, 1800 * speedFactor));
      if (!isRunning) {
        console.warn('⛔ LOOP BREAK', { step: i, fase, reason: 'isRunning false (after wait)' });
        setCoreVisual('INTERRUPTED');
        logExecutionInterrupted({ reason: 'LOOP_BREAK_isRunning_false_after_wait', step: i });
        break;
      }
      clearInterval(scoreInterval.current);

      const isWinner = isWinningStep(i, winAt);
      const side = isWinner ? pat[i-1] : (pat[i-1] === 'player' ? 'banker' : 'player');
      setWinnerSide(side); setScores({ player: side === 'player' ? 9 : 1, banker: side === 'banker' ? 9 : 1, rolling: false });
      
      if (isWinner) { 
        if (isSoundEnabled) { SoundEngine.playResultadoRelease(true); SoundEngine.playWinSoft(0.22); }
        setLastWinningShot(i); 
        speak('WIN', { shot: i });
        const net = (currentBet * (side === 'banker' ? 1.95 : 2.0)) - Array.from({length: i}, (_, idx) => Number(stake) * Math.pow(2, idx)).reduce((a,b)=>a+b, 0);
        setSessionStats(prev => { const newD = [...prev.distribution]; newD[i]++; return { ...prev, wins: prev.wins + 1, total: prev.total + 1, distribution: newD, sessionRewardsNet: Number(prev.sessionRewardsNet) + net }; });
        await saveResult(i, currentBet, side);
        updateLastGpulseResult('win');
        setCoreVisual('READY');
        console.log('REACHED RESULTADO');
        logExecutionFinal();
        setFase(FASES.RESULTADO); setIsProcessingSequence(false); return; 
      }
      if (i === effectiveLevels) { 
        if (isSoundEnabled) { SoundEngine.playResultadoRelease(false); SoundEngine.playLossSoft(0.22); }
        speak('FAIL');
        const totalLoss = computeTotalLoss(stake, effectiveLevels);
        if (activeCycleMode !== MODOS.VISOR) {
          if (activeCycleMode === MODOS.IA_REAL) {
            const isDual = activeTradingWallet === WALLET_MODE.MULTI;
            const afterA = Number(walletAigRef.current);
            const afterU = Number(walletUsdtRef.current);
            logTransaction({
              walletType: isDual ? 'DUAL' : 'AIG',
              action: 'loss',
              amount: totalLoss,
              aigAmount: isDual ? totalLoss / 2 : totalLoss,
              usdtAmount: isDual ? totalLoss / 2 : 0,
              balanceAfter: isDual ? multiMaxUsable(afterA, afterU) : afterA,
              walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
            });
          } else {
            const after = Number(demoBalanceRef.current);
            const isDual = activeTradingWallet === WALLET_MODE.MULTI;
            logTransaction({
              walletType: isDual ? 'DUAL' : 'AIG',
              action: 'loss',
              amount: totalLoss,
              aigAmount: isDual ? totalLoss / 2 : totalLoss,
              usdtAmount: isDual ? totalLoss / 2 : 0,
              balanceAfter: after,
              walletAddress: isDual ? `AIG:${DEMO_WALLET_ADDRESS_AIG} | USDT:${DEMO_WALLET_ADDRESS_USDT}` : DEMO_WALLET_ADDRESS_AIG,
            });
          }
        }
        setSessionStats(prev => { const newD = [...prev.distribution]; newD[7]++; return { ...prev, losses: prev.losses + 1, total: prev.total + 1, distribution: newD, sessionRewardsNet: Number(prev.sessionRewardsNet) - totalLoss }; });
        await saveResult(0, 0, null);
        updateLastGpulseResult('loss');
        setCoreVisual('READY');
        console.log('REACHED RESULTADO');
        logExecutionFinal();
        setFase(FASES.RESULTADO); setIsProcessingSequence(false); return; 
      }
      await new Promise(r => setTimeout(r, 1500 * speedFactor));
      if (!isRunning) {
        logExecutionInterrupted({ reason: 'LOOP_BREAK_FINAL', step: i });
        break;
      }
      setWinnerSide(null);
    }
    setIsProcessingSequence(false);
  }, [
    gpulse,
    gpulseStats,
    isRunning,
    activeCycleMode,
    activeTradingWallet,
    mgLevels,
    stake,
    goPulseSpeedFactor,
    isSoundEnabled,
    saveResult,
    speak,
    logTransaction,
    updateLastGpulseResult,
    setAiSpeech,
    isSyncRequired,
    syncPercent,
    syncTarget,
    syncMode,
  ]);

  useEffect(() => {
    executeSequenceRef.current = executeSequence;
  }, [executeSequence]);

  /** IA Real (proveedor): NEW_SIGNAL → SEÑAL sin motor local; NEW_RESULT → RESULTADO. */
  useEffect(() => {
    if (!GPULSE_REAL_PROVIDER_EXECUTION || selectedMode !== MODOS.IA_REAL) return;

    const pending = extActiveSignals.filter((s) => s.status === 'pending');
    if (pending.length === 0) return;
    const latest = pending[pending.length - 1];
    if (lastProviderSignalIdRef.current === latest.id) return;
    lastProviderSignalIdRef.current = latest.id;

    clearIaRealPhaseTimers();
    setIsRunning(true);
    setActiveCycleMode(MODOS.IA_REAL);
    const mesaStr = String(latest.mesa ?? '').trim();
    setCurrentMesa(mesaStr || BACCARAT_TABLES[0]);
    const r = latest.round;
    setCurrentRonda(r != null && r !== '' ? Number(r) || 1 : 1);
    if (!isIaRealProviderShell) {
      setFase(FASES.SEÑAL);
    }
    isSequenceTriggered.current = true;
    syncBlockedPatternRef.current = null;
    gpulseBlockedPatternRef.current = null;
    setSystemMessage('Señal recibida · esperando NEW_RESULT del proveedor.');
    setWinnerSide(null);
    setActiveShot(null);
    setPattern([]);
    setIsProcessingSequence(false);

    if (isIaRealProviderShell) {
      const vf0 = extractVectorForecastFromActiveRow(latest);
      const vIdx = forecastStepIndexFromProviderRow(latest, vf0.length);
      const t0 = Date.now();
      if (isSyncRequired && isBlocked) {
        logIaRealEngineInput({
          activeRow: latest,
          outcomeRow: null,
          correlationKey: latest.correlationKey,
          nextStatus: 'SYNC',
        });
        setIaRealEngineState({
          status: 'SYNC',
          activeRow: latest,
          outcomeRow: null,
          visualStepIndex: vIdx,
          visualProgress: 0,
          startedAt: t0,
        });
      } else {
        /** WAITING_RESULT immediately on NEW_SIGNAL — no artificial delay (only real events). */
        logIaRealEngineInput({
          activeRow: latest,
          outcomeRow: null,
          correlationKey: latest.correlationKey,
          nextStatus: 'WAITING_RESULT',
        });
        setIaRealEngineState({
          status: 'WAITING_RESULT',
          activeRow: latest,
          outcomeRow: null,
          visualStepIndex: vIdx,
          visualProgress: 0,
          startedAt: t0,
        });
      }
    }
  }, [
    extStreamTick,
    extActiveSignals,
    selectedMode,
    isIaRealProviderShell,
    isSyncRequired,
    isBlocked,
    clearIaRealPhaseTimers,
  ]);

  useEffect(() => {
    if (!GPULSE_REAL_PROVIDER_EXECUTION || selectedMode !== MODOS.IA_REAL) return;

    const sid = lastProviderSignalIdRef.current;
    if (!sid) return;
    const stillPending = extActiveSignals.some((s) => s.id === sid && s.status === 'pending');
    if (stillPending) return;
    const done = extHistory.find((h) => h.id === sid);
    if (!done || done.settledAt == null) return;

    if (isIaRealProviderShell) {
      const st = iaRealEngineState.status;
      if (st !== 'WAITING_RESULT' && st !== 'SYNC') return;

      if (done.winStatus) {
        setLastWinningShot(1);
      } else {
        setLastWinningShot(null);
      }
      setScores({ player: done.winStatus ? 9 : 1, banker: done.winStatus ? 1 : 9, rolling: false });
      setIsProcessingSequence(false);
      setCoreVisual('READY');
      setSystemMessage(done.winStatus ? 'Resultado: acierto.' : 'Resultado: sin acierto.');

      clearIaRealPhaseTimers();
      const hit = done.winStatus === true;
      logIaRealEngineInput({
        activeRow: iaRealEngineState.activeRow,
        outcomeRow: done,
        correlationKey: String(done.correlationKey ?? iaRealEngineState.activeRow?.correlationKey ?? ''),
        nextStatus: hit ? 'SUCCESS' : 'FAILED',
      });
      setIaRealEngineState((prev) => ({
        ...prev,
        status: hit ? 'SUCCESS' : 'FAILED',
        outcomeRow: done,
      }));
      const t = setTimeout(() => {
        logIaRealEngineInput({
          activeRow: null,
          outcomeRow: null,
          correlationKey: null,
          nextStatus: 'IDLE',
          reason: 'ia_real_result_display_elapsed',
        });
        setIaRealEngineState(createIdleIaRealVisualState());
        setIsRunning(false);
        lastProviderSignalIdRef.current = null;
        setCoreVisual('IDLE');
        setSystemMessage('Sistema en espera');
      }, IA_REAL_RESULT_DISPLAY_MS);
      iaRealPhaseTimersRef.current.push(t);
      return;
    }

    if (fase !== FASES.SEÑAL) return;

    if (done.winStatus) {
      setLastWinningShot(1);
    } else {
      setLastWinningShot(null);
    }
    setScores({ player: done.winStatus ? 9 : 1, banker: done.winStatus ? 1 : 9, rolling: false });
    setFase(FASES.RESULTADO);
    setIsProcessingSequence(false);
    setCoreVisual('READY');
    setSystemMessage(done.winStatus ? 'Resultado: acierto.' : 'Resultado: sin acierto.');
  }, [
    extStreamTick,
    extActiveSignals,
    extHistory,
    fase,
    selectedMode,
    isIaRealProviderShell,
    iaRealEngineState.status,
    clearIaRealPhaseTimers,
  ]);

  /** IA Real: sync guard overlays WAITING when blocked. */
  useEffect(() => {
    if (!isIaRealProviderShell) return;
    if (!lastProviderSignalIdRef.current) return;
    const cur = extActiveSignals.find((x) => x.id === lastProviderSignalIdRef.current && x.status === 'pending');
    if (!cur) return;
    if (isSyncRequired && isBlocked) {
      setIaRealEngineState((s) => {
        if (s.status === 'SUCCESS' || s.status === 'FAILED' || s.status === 'RESULT_ANIMATION') return s;
        const vf = extractVectorForecastFromActiveRow(cur);
        const vIdx = forecastStepIndexFromProviderRow(cur, vf.length);
        const next = { ...s, status: 'SYNC', activeRow: cur, visualStepIndex: vIdx };
        logIaRealEngineInput({
          activeRow: next.activeRow,
          outcomeRow: next.outcomeRow ?? null,
          correlationKey: next.activeRow?.correlationKey,
          nextStatus: 'SYNC',
        });
        return next;
      });
    } else {
      setIaRealEngineState((s) => {
        if (s.status !== 'SYNC') return s;
        const vf = extractVectorForecastFromActiveRow(cur);
        const vIdx = forecastStepIndexFromProviderRow(cur, vf.length);
        const next = { ...s, status: 'WAITING_RESULT', activeRow: cur, visualStepIndex: vIdx };
        logIaRealEngineInput({
          activeRow: next.activeRow,
          outcomeRow: next.outcomeRow ?? null,
          correlationKey: next.activeRow?.correlationKey,
          nextStatus: 'WAITING_RESULT',
        });
        return next;
      });
    }
  }, [isIaRealProviderShell, isSyncRequired, isBlocked, extActiveSignals]);

  /** Provider-only: martingale / contador updates on the pending row → visual step index (no local T1–T6 loop). */
  useEffect(() => {
    if (!isIaRealProviderShell) return;
    const sid = lastProviderSignalIdRef.current;
    if (!sid) return;
    setIaRealEngineState((s) => {
      if (s.status !== 'WAITING_RESULT' && s.status !== 'SYNC') return s;
      const row = extActiveSignals.find((x) => x.id === sid && x.status === 'pending');
      if (!row) return s;
      const vf = extractVectorForecastFromActiveRow(row);
      const vIdx = forecastStepIndexFromProviderRow(row, vf.length);
      if (s.activeRow?.id !== row.id) {
        const next = { ...s, activeRow: row, visualStepIndex: vIdx };
        logIaRealEngineInput({
          activeRow: next.activeRow,
          outcomeRow: next.outcomeRow ?? null,
          correlationKey: next.activeRow?.correlationKey,
          nextStatus: next.status,
          visualStepIndex: vIdx,
        });
        return next;
      }
      if (s.visualStepIndex === vIdx) return s;
      const next = { ...s, activeRow: row, visualStepIndex: vIdx };
      logIaRealEngineInput({
        activeRow: next.activeRow,
        outcomeRow: next.outcomeRow ?? null,
        correlationKey: next.activeRow?.correlationKey,
        nextStatus: next.status,
        visualStepIndex: vIdx,
      });
      return next;
    });
  }, [extStreamTick, extActiveSignals, isIaRealProviderShell]);

  /** Reintenta la secuencia cuando syncPercent >= syncTarget (mismo umbral que SYNC_BLOCK), sin re-disparar el scheduler. */
  useEffect(() => {
    if (GPULSE_REAL_PROVIDER_EXECUTION && activeCycleMode === MODOS.IA_REAL) return;
    if (!isRunning || fase !== FASES.SEÑAL) return;
    const pat = syncBlockedPatternRef.current;
    if (!pat || !Array.isArray(pat) || pat.length === 0) return;
    if (isSequenceTriggered.current || isProcessingSequence) return;
    if (isSyncRequired && syncPercent < syncTarget) return;
    isSequenceTriggered.current = true;
    setPattern(pat);
    queueMicrotask(() => executeSequenceRef.current?.(pat));
  }, [syncPercent, syncTarget, fase, isRunning, isSyncRequired, isProcessingSequence, syncMode]);

  /** Reintenta la secuencia cuando G_Pulse vuelve a ser válido (IA_REAL), sin tocar scheduler ni sync. */
  useEffect(() => {
    if (GPULSE_REAL_PROVIDER_EXECUTION && activeCycleMode === MODOS.IA_REAL) return;
    if (!isRunning || fase !== FASES.SEÑAL) return;
    if (activeCycleMode !== MODOS.IA_REAL) return;
    const pat = gpulseBlockedPatternRef.current;
    if (!pat || !Array.isArray(pat) || pat.length === 0) return;
    if (isSequenceTriggered.current || isProcessingSequence) return;

    const hotWinrate = gpulseStats?.zoneWinrate?.hot ?? 0;
    const totalSamples = gpulseStats?.total ?? 0;
    const isLearningPhase = totalSamples < 10;
    const confidenceThreshold = isLearningPhase ? 0.5 : 0.6;

    const ready =
      gpulse.zone === 'hot' &&
      gpulse.phase !== 'rupture' &&
      (isLearningPhase || hotWinrate > 0.55) &&
      gpulse.confidence > confidenceThreshold;

    if (!ready) return;

    console.log('🔁 Reintentando ejecución por G_Pulse válido');
    gpulseBlockedPatternRef.current = null;
    isSequenceTriggered.current = true;
    setPattern(pat);
    queueMicrotask(() => executeSequenceRef.current?.(pat));
  }, [gpulse, gpulseStats, isRunning, fase, activeCycleMode, isProcessingSequence]);

  const stopCycle = useCallback(() => {
    if (isProcessingSequence) return; 
    if (isSoundEnabled) SoundEngine.playClick();
    if (sessionStats.total > 0) setShowSessionReport(true);
    clearIaRealPhaseTimers();
    logIaRealEngineInput({
      activeRow: null,
      outcomeRow: null,
      correlationKey: null,
      nextStatus: 'IDLE',
      reason: 'stopCycle',
    });
    setIaRealEngineState(createIdleIaRealVisualState());
    setIsRunning(false); setFase(FASES.STANDBY); setActiveCycleMode(null); setEnginesReady(0);
    setCoreVisual('IDLE');
    isSequenceTriggered.current = false;
    lastProviderSignalIdRef.current = null;
    syncBlockedPatternRef.current = null;
    executionBlockedBySyncRef.current = false;
    setIsBlocked(false);
    gpulseBlockedPatternRef.current = null;
    if (cycleTimeout.current) clearTimeout(cycleTimeout.current);
    if (scoreInterval.current) clearInterval(scoreInterval.current);
    engineTimers.current.forEach(t => clearTimeout(t)); engineTimers.current = [];
    SoundEngine.setNoise(false); speak('REINICIO');
  }, [isProcessingSequence, isSoundEnabled, sessionStats.total, speak, clearIaRealPhaseTimers]);

  const startCycle = async () => {
    if (GPULSE_REAL_PROVIDER_EXECUTION && selectedMode === MODOS.IA_REAL) {
      setSystemMessage('Motor local desactivado: el ciclo avanza solo con NEW_SIGNAL / NEW_RESULT del proveedor.');
      return;
    }
    if (selectedMode === MODOS.IA_REAL) {
      if (activeTradingWallet === WALLET_MODE.AIG) {
        if (Number(walletBalanceAig) < Number(stake)) { setAiSpeech({ message: "RESERVA INSUFICIENTE PARA OPERAR.", type: "error" }); return; }
      } else if (!canExecuteMultiPair(walletBalanceAig, walletBalanceUsdt, stake)) {
        setAiSpeech({ message: "Insufficient balance in one of the assets to execute this operation", type: "error" }); return;
      } else if (iaRealMultiPeakBlocked) {
        setAiSpeech({
          message:
            'Insufficient balance to complete full sequence. Adjust stake or lower Límite T, or rebalance Multi Wallet (50/50).',
          type: 'error',
        });
        return;
      }
    }
    setAiFlowThinking(true);
    try {
      await executeAIFlow({
        actionLog: actionLogRef.current,
        currentPhase: FASES.STANDBY,
        isActive: false,
        history,
      });
    } catch (err) {
      console.error('[executeAIFlow]', err);
    } finally {
      setAiFlowThinking(false);
    }

    if (isSoundEnabled) { await SoundEngine.init(); SoundEngine.playBoot(); }
    setSessionStats({ wins: 0, losses: 0, total: 0, distribution: Array(8).fill(0), sessionRewardsNet: 0 });
    if (selectedMode !== MODOS.IA_REAL) setDemoBalance(1000.00);
    isSequenceTriggered.current = false;
    setActiveCycleMode(selectedMode); setIsRunning(true); setFase(FASES.ANALISIS);
    speak('ANALISIS');
  };

  const ignitionBlocked = useMemo(
    () => !isRunning && selectedMode === MODOS.IA_REAL && activeTradingWallet === WALLET_MODE.MULTI && iaRealMultiPeakBlocked,
    [isRunning, selectedMode, activeTradingWallet, iaRealMultiPeakBlocked],
  );

  const handlePreflightReduceStake = useCallback(() => {
    setStake((s) => {
      const n = Number(s);
      if (Number.isNaN(n) || n <= 0) return 1;
      const next = Math.max(1, Math.round(n * 0.85 * 100) / 100);
      return next;
    });
    if (isSoundEnabled) SoundEngine.playClick();
  }, [isSoundEnabled]);

  const handlePreflightLowerT = useCallback(() => {
    setMgLevels((L) => Math.max(1, Number(L) - 1));
    if (isSoundEnabled) SoundEngine.playClick();
  }, [isSoundEnabled]);

  const handleIgnitionClick = useCallback(() => {
    if (isProcessingSequence) return;
    if (isRunning) {
      stopCycle();
      return;
    }
    if (ignitionBlocked) {
      setIgniteDenyAnim(true);
      window.setTimeout(() => setIgniteDenyAnim(false), 460);
      return;
    }
    void startCycle();
  }, [isProcessingSequence, isRunning, ignitionBlocked, stopCycle, startCycle]);

  /** IA Real: optional audio + haptic on first paint of a settled result (event-driven; no logic timers). */
  const iaRealOutcomePresented = useCallback((hit) => {
    if (!isSoundEnabled) return;
    void SoundEngine.init().then(() => {
      try {
        if (hit) SoundEngine.playSignalCue(0.18);
        else SoundEngine.playClick();
      } catch {
        /* ignore */
      }
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(hit ? [10, 38, 12] : [18, 22, 18]);
      }
    } catch {
      /* ignore */
    }
  }, [isSoundEnabled]);

  // --- Core (nucleus) interaction laws (UI/UX only; motor intact) ---
  const isCoreLocked = isIaRealProviderShell
    ? iaRealEngineState.status === 'WAITING_RESULT' || iaRealEngineState.status === 'SYNC'
    : fase === FASES.SEÑAL || fase === FASES.DETECCION;
  const coreRejectAnimRef = useRef(null);
  const [coreRejectAnim, setCoreRejectAnim] = useState(false);
  const coreClickGuardRef = useRef(0);

  const triggerPulseFeedback = useCallback(() => {
    setCoreRejectAnim(true);
    if (coreRejectAnimRef.current) window.clearTimeout(coreRejectAnimRef.current);
    coreRejectAnimRef.current = window.setTimeout(() => setCoreRejectAnim(false), 260);
    pulseHudFocus();
  }, [pulseHudFocus]);

  useEffect(() => {
    return () => {
      if (coreRejectAnimRef.current) window.clearTimeout(coreRejectAnimRef.current);
    };
  }, []);

  const handleCoreClick = useCallback(() => {
    const now = Date.now();
    if (now - coreClickGuardRef.current < 450) return;
    coreClickGuardRef.current = now;

    if (isCoreLocked) {
      triggerPulseFeedback();
      setSystemMessage('Ejecución en curso… espera a que finalice');
      return;
    }

    if (isIaRealProviderShell) {
      if (iaRealEngineState.status === 'IDLE') {
        setSystemMessage('Listo para iniciar…');
        void startCycle();
        return;
      }
      if (
        iaRealEngineState.status === 'RESULT_ANIMATION' ||
        iaRealEngineState.status === 'SUCCESS' ||
        iaRealEngineState.status === 'FAILED'
      ) {
        setSystemMessage('Puedes detener el sistema cuando quieras');
        stopCycle();
        return;
      }
      triggerPulseFeedback();
      return;
    }

    if (fase === FASES.STANDBY) {
      setSystemMessage('Listo para iniciar…');
      void startCycle();
      return;
    }

    if (fase === FASES.RESULTADO) {
      setSystemMessage('Puedes detener el sistema cuando quieras');
      stopCycle();
      return;
    }

    // Default: ignore but give gentle feedback
    triggerPulseFeedback();
  }, [
    fase,
    isCoreLocked,
    isIaRealProviderShell,
    iaRealEngineState.status,
    startCycle,
    stopCycle,
    triggerPulseFeedback,
  ]);

  useEffect(() => {
    let interval = null;
    if (isGoPulseActive) {
      interval = setInterval(() => {
        setPulseCharge((prev) => (prev >= 100 ? 100 : prev + 1));
      }, 50);
    } else {
      setPulseCharge(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGoPulseActive]);

  useEffect(() => {
    if (!isRunning) return;
    if (isEnginePaused) return;
    if (GPULSE_REAL_PROVIDER_EXECUTION && selectedMode === MODOS.IA_REAL) {
      return () => {};
    }
    if (import.meta.env.DEV) console.log('SCHEDULER RUN:', { fase, isRunning });
    const speedFactor = goPulseSpeedFactor;
    const plan = nextPhasePlan(fase, {
      speedFactor,
      tables: BACCARAT_TABLES,
      isSequenceTriggered: isSequenceTriggered.current,
      rng: Math.random,
    });
    console.log('PROGRAMANDO ACCIONES:', plan.actions);
    console.log('NEXT PHASE:', plan.nextPhase);
    enginePlanRef.current = { nextPhase: plan?.nextPhase ?? null, delay: Number(plan?.delay || 0) };

    const actionCtx = {
      // state + refs
      isSoundEnabled,
      isSequenceTriggeredRef: isSequenceTriggered,
      isActive: isRunning,
      phase: fase,
      debug: isActionDebugEnabled,
      onActionLog: (entry) => {
        actionLogRef.current = [...actionLogRef.current, entry].slice(-200);
        const now = Date.now();
        if (now - lastActionTickAtRef.current > 250) {
          lastActionTickAtRef.current = now;
          setActionLogTick((t) => t + 1);
        }
      },

      // services
      SoundEngine,

      // functions
      speak,
      executeSequence: (p) => executeSequenceRef.current?.(p),
      shouldTriggerSequence,
      guardTriggerSequence: () => {
        const g = triggerSequenceGuardInputsRef.current;
        if (!g.isSyncRequired) return true;
        if (syncBlockedPatternRef.current != null) return false;
        if (g.isBlocked && g.syncPercent < g.syncTarget) return false;
        return true;
      },

      // setters
      setEnginesReady,
      setCurrentMesa,
      setCurrentRonda,
      setPattern,
      setWinnerSide,
      setActiveShot,
    };

    // ANALISIS has a known reset on entry (kept behavior identical).
    if (fase === FASES.ANALISIS) {
      isSequenceTriggered.current = false;
      setEnginesReady(0);
    }

    // Schedule actions (may include multiple offsets).
    const actions = Array.isArray(plan?.actions) ? plan.actions : [];
    if (isEngineStepMode) {
      const ordered = [...actions].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
      const q = ordered.map((a) => ({ kind: 'action', action: a }));
      if (plan?.nextPhase && Number(plan.delay || 0) > 0) q.push({ kind: 'phase', nextPhase: plan.nextPhase });
      stepQueueRef.current = q;
    } else {
      for (const a of actions) {
        const at = Math.max(0, Number(a.at || 0));
        const t = setTimeout(() => {
          if (!isRunning) return;
          console.log('EJECUTANDO ACCION:', a.type);
          runAction(a, actionCtx);
        }, at);
        engineTimers.current.push(t);
      }
    }

    // Schedule next phase if requested.
    if (!isEngineStepMode && plan?.nextPhase && Number(plan.delay || 0) > 0) {
      cycleTimeout.current = setTimeout(() => {
        if (!isRunning) return;
        console.log('CAMBIANDO A FASE:', plan.nextPhase);
        setFase(plan.nextPhase);
      }, Number(plan.delay || 0));
    }

    return () => {
      if (cycleTimeout.current) clearTimeout(cycleTimeout.current);
      // Ensure we clear any scheduled engine timers for this phase tick.
      engineTimers.current.forEach((t) => clearTimeout(t));
      engineTimers.current = [];
    };
  }, [fase, isRunning, isEnginePaused, isEngineStepMode, goPulseSpeedFactor, selectedMode]);

  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const auth = getAuth(app);
        setLogLevel('error'); setDb(firestore);
        onAuthStateChanged(auth, (user) => { if (user) { setUserId(user.uid); setIsAuthReady(true); } });
        if (typeof __initial_auth_token !== 'undefined') await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) {}
    };
    initFirebase();
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js";
    script.async = true; document.head.appendChild(script);
    return () => { if (document.head && script.parentNode) document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;
    const statsRef = doc(db, 'artifacts', appId, 'users', userId, 'stats', 'main');
    const unsubStats = onSnapshot(statsRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const totals = Array.isArray(data.totals) ? data.totals : Array(8).fill(0);
      const next = { wins: Number(data.wins) || 0, precision: Number(data.precision) || 100, totals };
      const nextSum = sumStatTotals(totals);
      const nextWins = Number(data.wins) || 0;
      setStats((prev) => {
        const prevSum = sumStatTotals(prev.totals);
        if (nextSum === 0 && nextWins === 0 && prevSum > 0) return prev;
        if (nextSum < prevSum) return prev;
        return next;
      });
    });
    const historyRef = collection(db, 'artifacts', appId, 'users', userId, 'history');
    const q = query(historyRef, limit(20));
    const unsubHistory = onSnapshot(q, (querySnap) => { 
      const logs = []; 
      querySnap.forEach(d => logs.push({ id: d.id, ...d.data() })); 
      logs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)); 
      setHistory((prev) => {
        const merged = mergeLedgerHistory(logs, prev);
        if (merged.length > 4) queueMicrotask(() => getTableIntuition(merged));
        return merged;
      });
    });
    return () => { unsubStats(); unsubHistory(); };
  }, [isAuthReady, db, userId, appId]);

  const socketBaseUrl = useMemo(() => {
    const ex = String(import.meta.env.VITE_SOCKET_URL || '').trim();
    if (ex) return ex.replace(/\/$/, '');
    const b = String(import.meta.env.VITE_BACKEND_URL || '').trim();
    if (!b) return '';
    try {
      return new URL(b).origin;
    } catch {
      return b.replace(/\/$/, '');
    }
  }, []);

  const queueStats = useQueueStats(socketBaseUrl);

  return (
    <GpulseProvider>
    <GpulseSystemHealthSync />
    <GpulseSystemModeSync transactions={walletTxHistory} queueWaiting={queueStats.waiting} />
    <GpulseFeedbackSync transactions={walletTxHistory} queueWaiting={queueStats.waiting} />
    <GpulseSocketSync socketUrl={socketBaseUrl} userAddress={userWalletAddress} appendWalletTx={appendWalletTx} />
    <GpulseSystemCoreProvider
      txOpen={trustWalletFlow.open}
      txState={trustWalletFlow.state}
      isRunning={isRunning}
      aiFlowBusy={aiFlowThinking}
    >
    <div
      className="relative z-0 isolate min-h-screen min-h-[100dvh] lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0 flex flex-col gap-3 p-4 md:p-6 transition-colors duration-500 overflow-x-hidden lg:overflow-hidden"
      data-layer="ui"
      data-z="0"
    >
      <GlobalStyles isLight={isLightMode} />
      <div className="aurora-container z-0" data-layer="bg" data-z="0" data-debug-anchor aria-hidden>
        <div className="aurora-beam z-0" style={{ position: 'absolute', width: '100%', height: '100%', filter: 'blur(100px)', opacity: isLightMode ? 0.08 : 0.15, background: 'radial-gradient(circle, #00EDFF, transparent)', transition: 'opacity 1.2s ease' }} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            systemSyncMood === 'risk'
              ? 'radial-gradient(circle at 50% 55%, rgba(239,68,68,0.08), transparent 55%)'
              : systemSyncMood === 'balance'
                ? 'radial-gradient(circle at 50% 55%, rgba(255,27,141,0.07), transparent 55%)'
                : systemSyncMood === 'opportunity'
                  ? 'radial-gradient(circle at 50% 55%, rgba(0,237,255,0.06), transparent 55%)'
                  : 'radial-gradient(circle at 50% 55%, rgba(0,200,255,0.05), transparent 60%)',
          opacity: energyOpacity,
          transition: 'opacity 320ms ease-out',
        }}
      >
        {/* micro particles */}
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={`bgp-${i}`}
            className="sync-particle absolute w-1.5 h-1.5 rounded-full bg-white/20"
            style={{
              left: `${12 + i * 13}%`,
              top: `${20 + (i * 9) % 55}%`,
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-30 shrink-0 flex flex-col" data-layer="ui" data-z="30">
      <header className="glass relative p-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${isLightMode ? 'bg-slate-200' : 'bg-black/5 border-[#00EDFF]/20'} border shadow-sm`}>
            <Eye className="text-cyan-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl armani-title-dynamic leading-none">Genesis Oracle</h1>
            <p className="armani-label-dynamic opacity-40 mt-1 font-mono text-[8px]">IA_ENTITY_ID: {String(userId || 'ANON').substring(0, 10)}</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-2" aria-label="Primary navigation">
          {[
            { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
            { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
            { id: 'history', label: 'History', Icon: History },
            { id: 'access', label: 'Access', Icon: Unlock },
          ].map(({ id, label, Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id)}
                className={`group h-10 px-3 rounded-xl border flex items-center gap-2 transition-all duration-200 transform-gpu ${
                  active
                    ? 'bg-cyan-500/10 border-cyan-500/35 text-cyan-200 shadow-[0_0_16px_rgba(0,237,255,0.18)] scale-[1.02]'
                    : isLightMode
                      ? 'bg-white/80 border-slate-200 text-slate-700 hover:border-cyan-400 hover:shadow-[0_0_14px_rgba(6,182,212,0.18)] hover:scale-105'
                      : 'bg-white/5 border-white/10 text-white/75 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:shadow-[0_0_14px_rgba(0,237,255,0.12)] hover:scale-105'
                }`}
              >
                <Icon size={16} className={active ? 'text-cyan-300' : 'text-white/55 group-hover:text-cyan-200'} aria-hidden />
                <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-white' : ''}`}>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActiveView('wallet');
              openWalletPanel();
            }}
            className={`group h-10 px-3 rounded-xl border flex items-center gap-2 transition-all duration-200 transform-gpu ${
              activeView === 'wallet'
                ? 'bg-pink-500/10 border-pink-500/35 text-pink-200 shadow-[0_0_16px_rgba(255,27,141,0.18)] scale-[1.02]'
                : isLightMode
                  ? 'bg-white/80 border-slate-200 text-slate-700 hover:border-pink-400 hover:shadow-[0_0_14px_rgba(255,27,141,0.16)] hover:scale-105'
                  : 'bg-white/5 border-white/10 text-white/75 hover:border-pink-500/40 hover:bg-pink-500/10 hover:shadow-[0_0_14px_rgba(255,27,141,0.12)] hover:scale-105'
            }`}
            aria-label="Wallet"
          >
            <Wallet size={16} className={activeView === 'wallet' ? 'text-pink-300' : 'text-white/55 group-hover:text-pink-200'} aria-hidden />
            <span className="text-[10px] font-black uppercase tracking-widest">Wallet</span>
          </button>
        </nav>
        <div className="relative flex items-center gap-3" ref={smartHubRef}>
           <div className="relative">
             <button onClick={async () => { await SoundEngine.init(); setIsGoPulseActive(!isGoPulseActive); if (isSoundEnabled) SoundEngine.playClick(); }} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-700 ${isGoldMode ? 'btn-gold-fusion' : (isGoPulseActive ? 'gopulse-glow bg-cyan-500/10' : (isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/5 border-black/10 text-gray-400'))}`}>
               <Activity size={18} className={isGoPulseActive ? 'animate-pulse' : ''} />
             </button>
             {isGoPulseActive && !isGoldMode && (
               <svg className="absolute -inset-1 w-12 h-12 -rotate-90 pointer-events-none">
                 <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-500/10" />
                 <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={138} strokeDashoffset={138 - (138 * pulseCharge) / 100} className="text-cyan-500 transition-all duration-300" strokeLinecap="round" />
               </svg>
             )}
             {isGoPulseActive && !isGoldMode && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-cyan-500">{pulseCharge}%</span>}
           </div>
           <button onClick={async () => { const newState = !isSoundEnabled; if (newState) await SoundEngine.init(); setIsSoundEnabled(newState); if (newState) SoundEngine.playClick(); }} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isSoundEnabled ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 shadow-[0_0_10px_rgba(0,237,255,0.2)]' : (isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/5 border-black/10 text-gray-400')}`}>
             {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
           </button>
           <button onClick={() => setIsLightMode(!isLightMode)} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-white/5 border-white/10 text-yellow-400'}`}>
             {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
           </button>
           {activeCycleMode === MODOS.VISOR ? (
             <div className={`flex flex-col items-end transition-all duration-300 ${balanceAnimate ? 'scale-110' : ''}`}>
               <span className="armani-label-dynamic text-[7px]">IA_ANALYSIS_ACTIVE</span>
               <p className="text-lg font-mono font-black balance-glow text-gray-500">MONITORING</p>
             </div>
           ) : selectedMode === MODOS.IA_REAL ? (
             <ActiveTradingBalanceSelector
               activeWallet={activeTradingWallet}
               onSelect={(w) => {
                 setActiveWalletKey(w === WALLET_MODE.MULTI ? WALLET_KEY.DUAL : WALLET_KEY.AIG);
                 setBalanceAnimate(true);
                 setTimeout(() => setBalanceAnimate(false), 300);
               }}
               walletBalanceAig={walletBalanceAig}
               walletBalanceUsdt={walletBalanceUsdt}
               isLight={isLightMode}
               balanceAnimate={balanceAnimate}
               stake={stake}
               mgLevels={mgLevels}
             />
           ) : (
             <div className={`flex flex-col items-end transition-all duration-300 ${balanceAnimate ? 'scale-110' : ''}`}>
               <span className="armani-label-dynamic text-[7px]">
                 {isRunning && activeCycleMode !== MODOS.IA_REAL ? 'VIRTUAL_FUNDS' : 'RESERVA_CAPITAL'}
               </span>
               <p className={`text-lg font-mono font-black balance-glow ${isRunning && activeCycleMode !== MODOS.IA_REAL ? 'text-purple-500' : (isLightMode ? 'text-slate-400' : 'text-white/60')}`}>
                 ${Number(demoBalance).toFixed(2)}
               </p>
             </div>
           )}
           <BoundTrustPulse
             isLight={isLightMode}
             walletFlow={trustWalletFlow}
             premiumFlow={trustPremiumFlow}
             successGlowUntil={trustGlowUntil}
             pendingTxCount={trustPendingCount}
             lastConfirmedAt={trustLastConfirmedAt}
             walletTxHistory={walletTxHistory}
             queueWaiting={queueStats.waiting}
           />
           <button type="button" onClick={openWalletPanel} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-700 hover:border-cyan-400' : 'bg-white/5 border-white/10 text-cyan-400 hover:bg-cyan-500/10'}`} aria-label="Cartera — capital y movimientos">
             <Wallet size={20} />
           </button>
           <div id="smart-hub" className="relative">
             <button
               type="button"
               onClick={() => setIsSmartHubOpen((v) => !v)}
               className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-200 transform-gpu ${
                 isSmartHubOpen
                   ? 'border-pink-500/40 bg-pink-500/10 shadow-[0_0_18px_rgba(255,27,141,0.22)]'
                   : isLightMode
                     ? 'bg-white/90 border-slate-200 text-slate-800 hover:border-cyan-400'
                     : 'bg-white/5 border-white/10 text-white/80'
               } ${
                 systemSyncMood === 'risk'
                   ? 'sync-smartglow-risk'
                   : systemSyncMood === 'balance'
                     ? 'sync-smartglow-balance'
                     : systemSyncMood === 'opportunity'
                       ? 'sync-smartglow-opportunity'
                       : ''
               } ${isSmartHubOpen ? 'scale-105' : 'hover:scale-105'} ${
                 isSmartHubOpen
                   ? ''
                   : 'hover:shadow-[0_0_12px_rgba(0,237,255,0.14),0_0_12px_rgba(255,27,141,0.10)]'
               }`}
               aria-label="Smart hub — quick modules"
               aria-expanded={isSmartHubOpen}
               aria-haspopup="menu"
             >
               <Grid3X3 size={20} strokeWidth={2.25} className={isSmartHubOpen ? 'text-pink-300' : 'text-cyan-300/90'} />
             </button>

             <AnimatePresence>
               {isSmartHubOpen ? (
                 <motion.div
                   key="smart-hub-panel"
                   initial={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                   animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                   exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                   transition={{ duration: 0.18, ease: 'easeOut' }}
                   className="absolute right-0 top-full mt-3 z-50"
                 >
                   <div className="relative w-[min(92vw,360px)] sm:w-[360px]">
                     {/* soft holographic backdrop */}
                     <div
                       aria-hidden
                       className="absolute -inset-6 rounded-[28px] opacity-40"
                       style={{
                         background:
                           'radial-gradient(circle at 30% 20%, rgba(0,237,255,0.18), transparent 55%), radial-gradient(circle at 70% 30%, rgba(255,27,141,0.14), transparent 55%), radial-gradient(circle at 50% 100%, rgba(138,43,226,0.10), transparent 60%)',
                         filter: 'blur(10px)',
                       }}
                     />
                     {/* floating particles (subtle) */}
                     <div aria-hidden className="absolute inset-0 pointer-events-none">
                       {Array.from({ length: 8 }).map((_, i) => (
                         <span
                           key={`p-${i}`}
                           className="absolute w-1 h-1 rounded-full bg-white/20"
                           style={{
                             left: `${10 + (i * 11) % 80}%`,
                             top: `${12 + (i * 17) % 70}%`,
                             opacity: 0.18,
                           }}
                         />
                       ))}
                     </div>

                     <div className="relative rounded-2xl border border-white/10 bg-[rgba(10,2,30,0.85)] backdrop-blur-xl shadow-xl overflow-hidden">
                       <div className="px-4 pt-4 pb-3 border-b border-white/10">
                         <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/70">Smart Hub</p>
                         <p className="text-[9px] font-mono text-white/40 mt-1">Advanced modules · holographic access</p>
                       </div>

                       <div className="p-4">
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           {[
                             { id: 'ai', label: 'AI Strategy', Icon: BrainCircuit, pos: 'sm:col-start-2' },
                             { id: 'security', label: 'Security', Icon: Shield, pos: 'sm:col-start-1' },
                             { id: 'settings', label: 'Settings', Icon: Settings2, pos: 'sm:col-start-3' },
                             { id: 'ecosystem', label: 'Ecosystem', Icon: Globe, pos: 'sm:col-start-2' },
                           ].map((item, idx) => (
                             <motion.button
                               key={item.id}
                               type="button"
                               initial={{ opacity: 0, scale: 0.85, y: -8, filter: 'blur(6px)' }}
                               animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                               transition={{ duration: 0.22, ease: 'easeOut', delay: idx * 0.04 }}
                               onClick={() => {
                                setActiveView(item.id);
                                 setIsSmartHubOpen(false);
                               }}
                               className={`h-14 sm:h-16 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-3 flex items-center justify-between gap-3 text-left transition-all duration-200 transform-gpu hover:scale-105 hover:shadow-[0_0_14px_rgba(0,237,255,0.14),0_0_14px_rgba(255,27,141,0.10)] ${item.pos}`}
                             >
                               <span className="flex items-center gap-2 min-w-0">
                                 <item.Icon size={18} className="text-cyan-300/90 shrink-0" aria-hidden />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-white/85 truncate">
                                   {item.label}
                                 </span>
                               </span>
                               <span
                                 aria-hidden
                                 className="w-2 h-2 rounded-full"
                                 style={{ boxShadow: '0 0 12px rgba(255, 0, 150, 0.2)' }}
                               />
                             </motion.button>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 </motion.div>
               ) : null}
             </AnimatePresence>
           </div>
        </div>
      </header>
      <ProviderRelayStatusStrip variant="bar" />
      </div>

      <div
        className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 w-full flex-1 lg:min-h-0 lg:overflow-auto custom-scrollbar"
        data-layer="ui"
        data-z="20"
        style={{
          transition: 'opacity 220ms ease-out',
          opacity: hudFocusBoost ? 0.94 : 1,
        }}
      >
        
        {/* ASIDE IZQUIERDO — HistoryPanel (ledger stack): mobile order 3, desktop column 3 */}
        <aside
          className="relative z-20 order-3 flex flex-col gap-4 min-h-0 overflow-x-hidden lg:order-3 lg:col-span-3"
          data-layer="ui"
          data-z="20"
          style={{ transition: 'opacity 220ms ease-out', opacity: hudFocusBoost ? 0.92 : 1 }}
        >
          <NeuralAnalytics stats={stats} isRunning={isRunning} enginesReady={enginesReady} isLight={isLightMode} isSoundEnabled={isSoundEnabled} onAskOracle={askOracle} />

          <motion.div
            layout
            className={`relative shrink-0 rounded-2xl ${gpulseGuidedHighlight ? 'ring-2 ring-cyan-400/45' : ''}`}
            animate={
              gpulseGuidedHighlight
                ? {
                    boxShadow: [
                      '0 0 0px rgba(34,211,238,0)',
                      '0 0 32px rgba(34,211,238,0.28)',
                      '0 0 0px rgba(34,211,238,0)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 2.4, repeat: gpulseGuidedHighlight ? Infinity : 0, ease: 'easeInOut' }}
            onPointerDownCapture={() => {
              if (gpulseGuidedHighlight) dismissGpulseGuided();
            }}
          >
            {gpulseGuidedHighlight ? (
              <span className="pointer-events-none absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-400/40 bg-black/90 px-3 py-1 text-[8px] font-black uppercase tracking-[0.22em] text-cyan-100/95 shadow-[0_0_22px_rgba(34,211,238,0.28)]">
                Empieza por aquí
              </span>
            ) : null}
            <GpulseControlPanelSystemFrame isLight={isLightMode}>
            <div
              className={`glass rounded-2xl border p-3 transition-colors duration-300 ${
                gpulse.zone === 'cold'
                  ? isLightMode
                    ? 'border-blue-300/70 bg-blue-50/90'
                    : 'border-blue-500/35 bg-blue-500/[0.07]'
                  : gpulse.zone === 'neutral'
                    ? isLightMode
                      ? 'border-amber-300/70 bg-amber-50/90'
                      : 'border-yellow-500/35 bg-yellow-500/[0.07]'
                    : isLightMode
                      ? 'border-red-300/70 bg-red-50/90'
                      : 'border-red-500/40 bg-red-500/[0.08]'
              }`}
              data-layer="ui"
              data-z="20"
              aria-label="G_Pulse panel"
            >
              <div
                className={`flex items-center justify-between gap-2 border-b pb-2 mb-2 ${
                  isLightMode ? 'border-slate-200' : 'border-white/10'
                }`}
              >
                <span
                  className={`text-[9px] font-black uppercase tracking-[0.3em] ${
                    isLightMode ? 'text-slate-600' : 'text-white/60'
                  }`}
                >
                  G_Pulse Panel
                </span>
                <span
                  className={`text-xl font-mono font-black tabular-nums ${
                    gpulse.zone === 'cold'
                      ? isLightMode
                        ? 'text-blue-600'
                        : 'text-blue-400'
                      : gpulse.zone === 'neutral'
                        ? isLightMode
                          ? 'text-amber-600'
                          : 'text-yellow-400'
                        : isLightMode
                          ? 'text-red-600'
                          : 'text-red-500'
                  }`}
                >
                  {Math.round(Number(gpulse.score) * 100)}%
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-1.5 text-[10px] font-mono">
                <div className="flex justify-between gap-2">
                  <dt className={isLightMode ? 'text-slate-500' : 'text-white/45'}>Zona</dt>
                  <dd
                    className={`font-black uppercase tracking-wide ${
                      gpulse.zone === 'cold'
                        ? isLightMode
                          ? 'text-blue-600'
                          : 'text-blue-400'
                        : gpulse.zone === 'neutral'
                          ? isLightMode
                            ? 'text-amber-600'
                            : 'text-yellow-400'
                          : isLightMode
                            ? 'text-red-600'
                            : 'text-red-500'
                    }`}
                  >
                    {gpulse.zone === 'cold' ? 'Fría' : gpulse.zone === 'neutral' ? 'Neutra' : 'Caliente'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className={isLightMode ? 'text-slate-500' : 'text-white/45'}>Fase</dt>
                  <dd className={isLightMode ? 'text-slate-800' : 'text-white/90'}>
                    {gpulse.phase === 'stable' ? 'Estable' : gpulse.phase === 'warning' ? 'Alerta' : gpulse.phase === 'rupture' ? 'Ruptura' : String(gpulse.phase)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className={isLightMode ? 'text-slate-500' : 'text-white/45'}>Sugerencia</dt>
                  <dd className={isLightMode ? 'text-slate-800' : 'text-white/90'}>
                    {gpulse.suggestion === 'wait'
                      ? 'Esperar'
                      : gpulse.suggestion === 'watch'
                        ? 'Observar'
                        : gpulse.suggestion === 'enter'
                          ? 'Entrar'
                          : String(gpulse.suggestion)}
                  </dd>
                </div>
              </dl>

              <div className="relative mt-3 rounded-xl border border-white/5 px-2 py-2">
                <p
                  className={`mb-2 text-[8px] font-black uppercase tracking-[0.28em] ${
                    isLightMode ? 'text-slate-500' : 'text-white/35'
                  }`}
                >
                  Señales avanzadas
                </p>
                <div className="pointer-events-none select-none space-y-1 blur-[3px]">
                  <div className="flex justify-between text-[10px] font-mono text-white/50">
                    <span>Coherencia latente</span>
                    <span>—</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-white/50">
                    <span>Presión de flujo</span>
                    <span>—</span>
                  </div>
                </div>
              </div>

              <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/25 px-3 py-3 opacity-[0.52]">
                <div className="pointer-events-none flex items-start gap-2 blur-[1.5px]">
                  <Lock size={14} className="mt-0.5 shrink-0 text-white/45" aria-hidden />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/48">Modo avanzado bloqueado</p>
                    <p className="mt-1 text-[9px] leading-relaxed text-white/38">
                      Se desbloquea al alcanzar mayor sincronización
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </GpulseControlPanelSystemFrame>
          </motion.div>
          
          <div className="glass flex-grow flex flex-col min-h-0 overflow-x-hidden overflow-y-visible">
            <div className={`p-4 border-b ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-black/5 bg-white/5'} font-black flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-cyan-500 ${isRunning ? 'animate-pulse' : 'opacity-30'}`} />
                <span className="armani-label-dynamic opacity-100">Neural Ledger (Historial)</span>
              </div>
              <Activity size={12} className={isRunning ? 'animate-pulse text-cyan-600' : 'opacity-20'}/>
            </div>
            
            <div className="flex-grow relative min-h-0 overflow-x-hidden blockchain-line">
              <div className="scanline-stream" />
              <div className="min-h-[200px] max-h-[min(340px,45vh)] lg:h-[340px] lg:max-h-none overflow-y-auto custom-scrollbar p-4 space-y-3">
                {history.length > 0 ? history.map((log, idx) => (
                  <div key={log.id} className={`p-3 rounded-xl border ${isLightMode ? 'border-slate-100 bg-white shadow-sm' : 'border-black/5 bg-white/5'} border-l-2 ${Number(log.shot) === 0 ? 'border-l-red-500' : 'border-l-cyan-600'} blockchain-entry`} style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className="flex justify-between text-[8px] mb-1 font-mono">
                      <span className={Number(log.shot) === 0 ? "text-red-500" : "text-cyan-600"}>
                        {Number(log.shot) === 0 ? 'ANOMALIA_DETECTADA' : 'SINC_LOGRADA'}
                      </span>
                      <span className="opacity-30">0x{Math.random().toString(16).slice(2, 6)}</span>
                    </div>
                    <div className="text-[10px] flex justify-between font-mono text-white">
                        <span className="opacity-50 text-[9px] font-bold">{String(log.mesa)}</span>
                        <span className={Number(log.shot) === 0 ? "text-red-500/50" : (isLightMode ? "text-slate-800" : "text-white")}>
                            {Number(log.shot) === 0 ? 'FAIL' : `${String(log.side || 'FAIL').toUpperCase()} T${log.shot}`}
                        </span>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex items-center justify-center opacity-20 flex-col gap-2">
                    <Server size={24}/>
                    <span className="armani-label-dynamic">SIN REGISTROS</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
        
        {/* MAIN CENTRAL — MainView (eye / hub): mobile order 1, desktop center column */}
        <main
          className="relative z-20 order-1 flex flex-col gap-4 min-h-0 min-w-0 overflow-x-hidden lg:order-2 lg:col-span-6"
          data-layer="ui"
          data-z="20"
          style={{ transition: 'opacity 220ms ease-out', opacity: hudFocusBoost ? 0.92 : 1 }}
        >
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <motion.section
                key="view-dashboard"
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`glass relative z-20 flex-grow flex flex-col items-center p-10 text-center overflow-x-hidden min-h-0 transition-all duration-1000 ${isGoldMode ? 'panel-gold-synergy' : ''}`}
                data-layer="ui"
                data-z="20"
              >
                <div className="pointer-events-none absolute top-3 right-3 z-50 flex flex-wrap items-center justify-end gap-2">
                  <GpulseSyncHUD
                    syncPercentage={syncPercent}
                    status={syncHudStatus}
                    message={systemMessage}
                    isLightMode={isLightMode}
                    className="opacity-80"
                  />
                  <div className="pointer-events-auto shrink-0">
                    <GpulseSyncToggle
                      syncMode={syncMode}
                      setSyncMode={setSyncMode}
                      setSyncModeManuallyChanged={setSyncModeManuallyChanged}
                    />
                  </div>
                </div>

                <div className="z-20 w-full min-h-[80px] mb-6 flex flex-col items-center justify-center">
                  <h2 className="text-4xl status-text-dynamic mb-2"><NeuralReveal key={statusUI.title} text={statusUI.title} /></h2>
                  <p className="armani-label-dynamic opacity-40 tracking-[0.5em]">{statusUI.sub}</p>
                </div>
                
                <div className="relative z-20 flex flex-grow flex-col items-center justify-center w-full min-h-[380px] overflow-visible">
                  <div className="relative mb-8 flex h-[min(480px,92vw)] w-[min(480px,92vw)] max-h-[480px] max-w-[480px] shrink-0 items-center justify-center overflow-visible">
                    <AIThinkingLayer phase={fase} isLight={isLightMode} />
                    <motion.button
                      type="button"
                      onClick={handleCoreClick}
                      className={`relative z-10 ${portalSyncClass} ${isCoreLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{
                        transition: 'transform 320ms ease-out',
                        filter: isCoreLocked ? 'drop-shadow(0 0 26px rgba(34,211,238,0.18))' : undefined,
                      }}
                      animate={
                        coreRejectAnim
                          ? { scale: [1, 1.045, 0.99, 1] }
                          : isCoreLocked
                            ? { scale: [1, 1.02, 1] }
                            : { scale: 1 }
                      }
                      transition={
                        coreRejectAnim
                          ? { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
                          : isCoreLocked
                            ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                            : { duration: 0.25 }
                      }
                      aria-label={isCoreLocked ? 'Núcleo bloqueado: ejecución en curso' : 'Núcleo IA'}
                    >
                      {/* EL OJO V9.0 - Holograma proyectado de forma absoluta sobre la pupila */}
                      <LivingPortal 
                        isRunning={isRunning} 
                        mode={activeCycleMode || selectedMode} 
                        enginesReady={enginesReady} 
                        isLight={isLightMode} 
                        isGoPulseActive={isGoPulseActive} 
                        isGoldMode={isGoldMode}
                        isFaseResult={isIaRealProviderShell ? presentationFase === FASES.RESULTADO : fase === FASES.RESULTADO}
                        lastWinningShot={lastWinningShot}
                        activeAlert={activeAlert}
                      />
                    </motion.button>
                  </div>

                  {isIaRealProviderShell ? (
                    <IaRealExecutionLayer
                      engine={iaRealEngineState}
                      isLightMode={isLightMode}
                      onOutcomePresented={iaRealOutcomePresented}
                    />
                  ) : null}

                  {fase === FASES.SEÑAL && !isIaRealProviderShell && (
                    <div
                      className="absolute bottom-12 z-30 w-full space-y-8 animate-in zoom-in-95 pointer-events-auto"
                      data-layer="signal"
                      data-z="30"
                      data-debug-anchor
                    >
                      <div className="flex justify-center gap-4">
                        <div className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[200px] backdrop-blur-md`}>
                          <p className="armani-label-dynamic mb-1 opacity-60">Mesa Interceptada</p>
                          <p className={`text-3xl font-black font-mono tracking-tighter ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{String(currentMesa)}</p>
                        </div>
                        <div className={`${isLightMode ? 'bg-white shadow-md' : 'bg-black/60'} px-6 py-4 rounded-3xl border border-white/5 min-w-[120px] backdrop-blur-md`}>
                          <p className="armani-label-dynamic mb-1 opacity-60">Secuencia</p>
                          <p className={`text-4xl font-black font-mono ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{Number(currentRonda)}</p>
                        </div>
                      </div>
                      <div className="flex justify-center flex-wrap gap-4">
                        {pattern.map((type, idx) => (
                          <div key={idx} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-sm font-black transition-all ${activeShot === idx + 1 ? 'border-cyan-500 bg-cyan-500 text-white scale-110 shadow-lg' : type === 'player' ? 'border-cyan-500 text-cyan-600 bg-cyan-500/5' : 'border-pink-500 text-pink-600 bg-pink-500/5'}`}>
                            {activeShot === idx + 1 && scores.rolling ? <Loader2 size={18} className="animate-spin" /> : (type === 'player' ? 'P' : 'B')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <motion.div
                  animate={{
                    width: systemNarrative ? 320 : 40,
                    height: systemNarrative ? 80 : 40,
                    borderRadius: systemNarrative ? 20 : 9999,
                    paddingLeft: systemNarrative ? 20 : 0,
                    paddingRight: systemNarrative ? 20 : 0,
                    paddingTop: systemNarrative ? 12 : 0,
                    paddingBottom: systemNarrative ? 12 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 120, damping: 15 }}
                  className="
                    relative
                    mt-8
                    bg-black/40
                    backdrop-blur-xl
                    border border-white/10
                    shadow-[0_10px_40px_rgba(0,0,0,0.4)]
                    overflow-hidden
                    before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/10 before:opacity-30
                    z-20
                  "
                >
                  {/* Cristal grueso (subtle), vive en ambos estados */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-40 pointer-events-none" />

                  {/* Reflejo tornasol: más presente cuando está activo */}
                  <div
                    className={`absolute -top-10 -left-10 w-[200%] h-[200%] bg-gradient-to-r from-cyan-400/10 via-violet-500/10 to-blue-400/10 rotate-12 animate-[spin_12s_linear_infinite] pointer-events-none transition-opacity duration-500 ${
                      systemNarrative ? 'opacity-20' : 'opacity-10'
                    }`}
                  />

                  {/* Glow pasivo (cuando no hay narrativa) */}
                  <div
                    className={`absolute inset-0 bg-cyan-400/10 blur-xl animate-pulse pointer-events-none transition-opacity duration-500 ${
                      systemNarrative ? 'opacity-15' : 'opacity-30'
                    }`}
                  />

                  <AnimatePresence mode="wait">
                    {systemNarrative ? (
                      <motion.p
                        key={String(systemNarrative)}
                        initial={{ opacity: 0, y: 5, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className={`relative z-10 text-left text-sm leading-relaxed tracking-wide ${
                          isLightMode ? 'text-cyan-700/90' : 'text-cyan-200/90'
                        }`}
                      >
                        <NeuralReveal text={systemNarrative} delay={8} />
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </motion.section>
            ) : (
              <motion.section
                key={`view-${activeView}`}
                initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`glass relative z-20 flex-grow flex flex-col overflow-hidden min-h-0 ${isGoldMode ? 'panel-gold-synergy' : ''}`}
                data-layer="ui"
                data-z="20"
              >
                <div className={`p-4 border-b ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="armani-label-dynamic opacity-100">
                      {activeView === 'analytics'
                        ? 'Analytics'
                        : activeView === 'history'
                          ? 'History'
                          : activeView === 'access'
                            ? 'Access'
                            : activeView === 'ai'
                              ? 'AI Strategy'
                              : activeView === 'security'
                                ? 'Security'
                                : activeView === 'settings'
                                  ? 'Settings'
                                  : activeView === 'ecosystem'
                                    ? 'Ecosystem'
                                    : String(activeView).toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className={`px-3 h-9 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-200 transform-gpu hover:scale-105 ${
                      isLightMode
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-cyan-400'
                        : 'bg-white/5 border-white/10 text-white/80 hover:border-cyan-500/40 hover:bg-cyan-500/10'
                    }`}
                  >
                    Back
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {activeView === 'analytics' ? (
                    <HubAnalyticsPanel
                      activeWalletKey={activeWalletKey}
                      wallets={wallets}
                      ledger={ledger}
                      stake={stake}
                      mgLevels={mgLevels}
                    />
                  ) : null}
                  {activeView === 'history' ? <HubHistoryPanel ledger={ledger} /> : null}
                  {activeView === 'access' ? (
                    <GpulseMembershipView
                      gpulse={gpulse}
                      onSubViewChange={setGpulseAccessSubView}
                      onTrustPremiumFlow={setTrustPremiumFlow}
                    />
                  ) : null}
                  {activeView === 'ai' ? (
                    <HubAiStrategyPanel
                      fase={fase}
                      activeWalletKey={activeWalletKey}
                      wallets={wallets}
                      ledger={ledger}
                      stake={stake}
                      mgLevels={mgLevels}
                    />
                  ) : null}
                  {activeView === 'security' ? (
                    <HubSecurityPanel
                      userId={userId}
                      activeWalletKey={activeWalletKey}
                      wallets={wallets}
                      ledger={ledger}
                      sessionStartTs={sessionStartTsRef.current}
                    />
                  ) : null}
                  {activeView === 'settings' ? (
                    <HubSettingsPanel
                      isLightMode={isLightMode}
                      setIsLightMode={setIsLightMode}
                      isSoundEnabled={isSoundEnabled}
                      setIsSoundEnabled={setIsSoundEnabled}
                      setIsSoundEnabledWithInit={setIsSoundEnabledWithInit}
                    />
                  ) : null}
                  {activeView === 'ecosystem' ? <HubEcosystemPanel /> : null}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <section
            className={`glass p-6 relative z-20 border-t transition-all duration-1000 ${isGoldMode ? 'panel-gold-synergy' : (isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/5 border-white/5')}`}
            data-layer="ui"
            data-z="20"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-5 space-y-3">
                <div className="flex items-center gap-2 px-1 text-cyan-600"><Settings2 size={12}/><label className="armani-label-dynamic opacity-100">Configuración Táctica</label></div>
                <div className={`grid gap-2 ${shellModeButtons.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {shellModeButtons.map((m) => (
                    <button key={m.id} disabled={isRunning} onClick={async () => { await SoundEngine.init(); setSelectedMode(m.id); if (isSoundEnabled) SoundEngine.playClick(); speak(String(m.id)); }} className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${selectedMode === m.id ? (isLightMode ? 'bg-slate-800 border-slate-900 text-white shadow-md' : 'bg-white/10 border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]') : (isLightMode ? 'bg-white border-slate-200 text-slate-400' : 'bg-black/10 border-black/10 text-slate-400')}`}>
                      <div className="font-black text-[10px] uppercase" style={{ color: selectedMode === m.id && !isLightMode ? m.color : '' }}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-4 flex gap-3">
                <div className={`flex-1 ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/5 border-white/5'} border rounded-xl p-3.5 relative overflow-hidden transition-all ${selectedMode === MODOS.VISOR ? 'opacity-20' : ''}`}>
                  <p className="armani-label-dynamic mb-1">Monto Base</p>
                  <input disabled={isRunning || selectedMode === MODOS.VISOR} type="number" value={stake} onChange={(e)=>setStake(parseFloat(e.target.value))} className={`bg-transparent font-mono font-black text-lg w-full outline-none ${isLightMode ? 'text-slate-800' : 'text-white'}`}/>
                </div>
                <div className={`flex-1 ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/5 border-white/5'} border rounded-xl p-3.5 relative overflow-hidden transition-all ${selectedMode === MODOS.VISOR ? 'opacity-20' : ''}`}>
                  <p className="armani-label-dynamic mb-1">Límite T</p>
                  <div className={`flex justify-between items-center text-lg font-mono font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                    <button disabled={isRunning || selectedMode === MODOS.VISOR} onClick={()=>setMgLevels(Math.max(1, Number(mgLevels)-1))} className="text-cyan-600 hover:scale-125 transition-transform">-</button>
                    <span>{Number(mgLevels)}</span>
                    <button disabled={isRunning || selectedMode === MODOS.VISOR} onClick={()=>setMgLevels(Math.min(6, Number(mgLevels)+1))} className="text-cyan-600 hover:scale-125 transition-transform">+</button>
                  </div>
                </div>
              </div>
              <div className="relative z-40 md:col-span-3 flex flex-col gap-2" data-layer="ui" data-z="40">
                <div
                  className={`preflight-panel-transition overflow-hidden ${
                    showMultiPreflightNearBanner ? 'max-h-[120px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                  aria-hidden={!showMultiPreflightNearBanner}
                >
                  <div
                    className={`rounded-xl border px-3 py-2.5 text-left mb-2 transition-colors duration-300 ${
                      isLightMode ? 'border-amber-300 bg-amber-50' : 'border-amber-500/45 bg-amber-500/10'
                    }`}
                  >
                    <p className={`text-[10px] font-black uppercase tracking-wide ${isLightMode ? 'text-amber-800' : 'text-amber-400'}`}>
                      Near operational limit
                    </p>
                    <p className={`text-[10px] font-mono mt-1 tabular-nums ${isLightMode ? 'text-amber-950/80' : 'text-white/85'}`}>
                      Required peak: ${sequencePeakBet.toFixed(2)} · Available: ${maxUsableMultiPreFlight.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div
                  className={`preflight-panel-transition overflow-hidden ${
                    ignitionBlocked ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                  aria-hidden={!ignitionBlocked}
                >
                  <div
                    role="alert"
                    className={`rounded-xl border px-3 py-2.5 text-left mb-2 transition-colors duration-300 ${
                      isLightMode ? 'border-red-300 bg-red-50' : 'border-red-500/45 bg-red-950/35'
                    }`}
                  >
                    <p className={`text-[10px] font-black uppercase tracking-wide ${isLightMode ? 'text-red-800' : 'text-red-400'}`}>
                      Pre-flight blocked
                    </p>
                    <p className={`text-[11px] font-medium leading-snug mt-1 ${isLightMode ? 'text-slate-900' : 'text-white/95'}`}>
                      Insufficient balance to complete full sequence
                    </p>
                    <div className={`mt-2 space-y-0.5 font-mono text-[10px] tabular-nums ${isLightMode ? 'text-slate-700' : 'text-white/80'}`}>
                      <p>
                        Required peak: <span className={isLightMode ? 'text-red-700' : 'text-red-300'}>${sequencePeakBet.toFixed(2)}</span>
                      </p>
                      <p>
                        Available: <span className={isLightMode ? 'text-emerald-800' : 'text-emerald-400'}>${maxUsableMultiPreFlight.toFixed(2)}</span>
                        <span className={`text-[9px] font-sans font-normal ml-1 ${isLightMode ? 'text-slate-500' : 'text-white/45'}`}>(50/50 operativo)</span>
                      </p>
                    </div>
                    {iaRealMultiMaxReachableStep > 0 && iaRealMultiMaxReachableStep < Number(mgLevels) ? (
                      <p className={`text-[10px] font-mono mt-2 ${isLightMode ? 'text-slate-800' : 'text-cyan-300/90'}`}>
                        You can only execute up to T{iaRealMultiMaxReachableStep} with current balance
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={handlePreflightReduceStake}
                        className={`min-w-0 flex-1 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all duration-200 border ${
                          isLightMode
                            ? 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                            : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        Reduce stake
                      </button>
                      <button
                        type="button"
                        disabled={Number(mgLevels) <= 1}
                        onClick={handlePreflightLowerT}
                        className={`min-w-0 flex-1 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all duration-200 border disabled:opacity-35 disabled:cursor-not-allowed ${
                          isLightMode
                            ? 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                            : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        Lower T limit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openWalletPanel();
                          if (isSoundEnabled) void SoundEngine.init().then(() => SoundEngine.playClick());
                        }}
                        className={`min-w-[100%] sm:min-w-0 sm:flex-1 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all duration-200 border ${
                          isLightMode
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100'
                            : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                        }`}
                      >
                        Open Wallet
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`w-full flex items-center justify-center py-2 ${igniteDenyAnim ? 'ignite-deny-shake' : ''}`}>
                  <CoreButton
                    onClick={handleIgnitionClick}
                    disabled={Boolean(isProcessingSequence || ignitionBlocked)}
                    isExecuting={Boolean(isRunning)}
                    syncReady={syncPercent >= syncTarget}
                    coreVisual={coreVisual}
                  />
                </div>
              </div>
            </div>
          </section>

          <GpulseVoiceAssistant
            gpulse={gpulse}
            userPlan={GPULSE_VOICE_USER_PLAN}
            activeView={activeView}
            accessSubView={gpulseAccessSubView}
            isLightMode={isLightMode}
            anchor="main"
          />
        </main>

        {/* ASIDE DERECHO — ControlPanel (Live Monitor / IA context): mobile order 2, desktop left column */}
        <aside
          className={`relative z-20 order-2 flex flex-col gap-6 min-h-0 overflow-x-hidden glass p-6 lg:order-1 lg:col-span-3 ${winnerSide ? 'border-l-4' : ''}`}
          data-layer="ui"
          data-z="20"
          style={{ borderLeftColor: winnerSide ? COLORS[winnerSide] : 'transparent' }}
        >
          <div className="flex justify-between border-b border-black/5 pb-4">
            <h3 className="armani-label-dynamic flex items-center gap-2 opacity-100"><Tv size={14} /> Live Monitor</h3>
            <div className={`px-2 py-0.5 rounded-full text-[8px] font-mono ${isRunning ? 'bg-green-500/20 text-green-600 animate-pulse' : (isLightMode ? 'bg-slate-100 text-slate-400' : 'bg-black/5 text-slate-400')}`}>
              {isRunning ? 'ESCANEANDO' : 'OFFLINE'}
            </div>
          </div>
          
          <div className={`${isLightMode ? 'bg-white shadow-sm' : 'bg-white/5'} p-4 rounded-2xl border border-white/10`}>
              <div className="flex items-center gap-2 mb-2 text-cyan-400"><Lightbulb size={14}/> <span className="armani-label-dynamic">IA Intuition ✨</span></div>
              <p className="text-[11px] font-light italic leading-relaxed text-white/80">
                {loadingIntuition ? <Loader2 size={12} className="animate-spin inline mr-2"/> : tableIntuition}
              </p>
          </div>

          {/* Fixed alert bar (replaces floating popups) */}
          <AnimatePresence>
            {(!diagnostics?.ok || aiPopup) ? (
              <motion.div
                key={`alertbar-${!diagnostics?.ok ? `diag-${diagnostics.issues?.[0]?.id}` : `${aiPopup?.type}-${aiPopup?.message}`}`}
                initial={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="w-full"
                aria-live="polite"
              >
                <div
                  className={`w-full rounded-2xl border px-4 py-2.5 backdrop-blur-xl shadow-lg ${
                    isLightMode ? 'bg-white/90' : 'bg-[rgba(10,2,30,0.75)]'
                  }`}
                  style={{
                    borderColor:
                      (!diagnostics?.ok && diagnostics.issues?.[0]?.severity === 'critical')
                        ? 'rgba(239,68,68,0.40)'
                        : (!diagnostics?.ok && diagnostics.issues?.[0]?.severity === 'warning')
                          ? 'rgba(245,158,11,0.40)'
                          : aiPopup?.type === 'risk'
                        ? 'rgba(239,68,68,0.35)'
                        : aiPopup?.type === 'balance'
                          ? 'rgba(255,27,141,0.35)'
                          : aiPopup?.type === 'opportunity'
                            ? 'rgba(0,237,255,0.35)'
                            : 'rgba(255,255,255,0.10)',
                    boxShadow:
                      (!diagnostics?.ok && diagnostics.issues?.[0]?.severity === 'critical')
                        ? '0 0 18px rgba(239,68,68,0.20)'
                        : (!diagnostics?.ok && diagnostics.issues?.[0]?.severity === 'warning')
                          ? '0 0 18px rgba(245,158,11,0.16)'
                          : aiPopup?.type === 'risk'
                        ? '0 0 18px rgba(239,68,68,0.18)'
                        : aiPopup?.type === 'balance'
                          ? '0 0 18px rgba(255,27,141,0.16)'
                          : aiPopup?.type === 'opportunity'
                            ? '0 0 18px rgba(0,237,255,0.14)'
                            : '0 0 14px rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-black uppercase tracking-[0.35em] ${
                            !diagnostics?.ok
                              ? (diagnostics.issues?.[0]?.severity === 'critical' ? 'text-red-300' : 'text-amber-300')
                              : aiPopup?.type === 'risk'
                              ? 'text-red-300'
                              : aiPopup?.type === 'balance'
                                ? 'text-pink-300'
                                : aiPopup?.type === 'opportunity'
                                  ? 'text-cyan-300'
                                  : 'text-white/70'
                          }`}
                        >
                          {!diagnostics?.ok
                            ? (diagnostics.issues?.[0]?.severity === 'critical' ? 'ENGINE' : 'DIAGNOSTICS')
                            : aiPopup?.type === 'risk'
                              ? 'RISK'
                              : aiPopup?.type === 'balance'
                                ? 'BALANCE'
                                : aiPopup?.type === 'opportunity'
                                  ? 'OPPORTUNITY'
                                  : 'INFO'}
                        </span>
                        {aiPopup?.critical ? (
                          <span className="text-[9px] font-mono text-white/55 uppercase tracking-widest">PINNED</span>
                        ) : null}
                      </div>
                      <p className={`mt-1 text-[12px] font-medium leading-snug ${
                        isLightMode ? 'text-slate-800' : 'text-white/90'
                      }`}>
                        {!diagnostics?.ok ? String(diagnostics.issues?.[0]?.message || diagnostics.summary) : aiPopup?.message}
                      </p>
                    </div>
                    {aiPopup?.critical ? (
                      <span
                        aria-hidden
                        className="shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full"
                        style={{
                          background: aiPopup?.type === 'risk' ? '#ef4444' : '#00EDFF',
                          boxShadow:
                            aiPopup?.type === 'risk'
                              ? '0 0 12px rgba(239,68,68,0.35)'
                              : '0 0 12px rgba(0,237,255,0.28)',
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="shrink-0 mt-1 w-2 h-2 rounded-full"
                        style={{
                          background:
                            !diagnostics?.ok
                              ? (diagnostics.issues?.[0]?.severity === 'critical' ? '#ef4444' : '#f59e0b')
                              : aiPopup?.type === 'risk'
                              ? '#ef4444'
                              : aiPopup?.type === 'balance'
                                ? '#ff1b8d'
                                : aiPopup?.type === 'opportunity'
                                  ? '#22c55e'
                                  : '#3b82f6',
                          opacity: 0.8,
                        }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Compact operational HUD (Live Projection) */}
          <div
            className={`relative rounded-2xl border overflow-hidden ${
              isLightMode ? 'bg-white/90 border-slate-200 shadow-sm' : 'bg-[rgba(10,2,30,0.55)] border-white/10'
            }`}
            style={{
              borderColor:
                systemSyncMood === 'risk'
                  ? 'rgba(239,68,68,0.35)'
                  : systemSyncMood === 'balance'
                    ? 'rgba(255,27,141,0.35)'
                    : systemSyncMood === 'opportunity'
                      ? 'rgba(0,237,255,0.35)'
                      : (isLightMode ? 'rgba(148,163,184,0.55)' : 'rgba(255,255,255,0.10)'),
              boxShadow:
                systemSyncMood === 'risk'
                  ? '0 0 18px rgba(239,68,68,0.12)'
                  : systemSyncMood === 'balance'
                    ? '0 0 18px rgba(255,27,141,0.12)'
                    : systemSyncMood === 'opportunity'
                      ? '0 0 18px rgba(0,237,255,0.10)'
                      : '0 0 0 rgba(0,0,0,0)',
              transition: 'box-shadow 260ms ease-out, border-color 260ms ease-out',
              filter: activeView === 'dashboard' ? 'saturate(0.92) brightness(0.98)' : 'saturate(1.05) brightness(1.18)',
            }}
          >
            {/* soft backdrop */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 20% 20%, rgba(0,237,255,0.10), transparent 55%), radial-gradient(circle at 80% 25%, rgba(255,27,141,0.08), transparent 55%), radial-gradient(circle at 50% 110%, rgba(138,43,226,0.06), transparent 60%)',
              }}
            />
            {/* subtle animated border energy */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                boxShadow:
                  systemSyncMood === 'risk'
                    ? 'inset 0 0 0 1px rgba(239,68,68,0.25)'
                    : systemSyncMood === 'balance'
                      ? 'inset 0 0 0 1px rgba(255,27,141,0.22)'
                      : systemSyncMood === 'opportunity'
                        ? 'inset 0 0 0 1px rgba(0,237,255,0.22)'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            />

            <div className="relative p-4">
              {(() => {
                const isDashboardActive = activeView === 'dashboard';
                const mode = isDashboardActive ? 'PASSIVE' : 'ACTIVE';
                const steps = Array.isArray(roundSteps) ? roundSteps : [];
                const shot = Number(activeShot);
                const activeIdx = Number.isFinite(shot) && shot >= 1 && shot <= 6 ? shot : null;
                const activeStep = activeIdx ? steps.find((s) => Number(s.step) === activeIdx) : null;
                const lastResolved = [...steps].reverse().find((s) => s?.result);
                const lastResultSide = lastResolved?.result || null; // 'PLAYER' | 'BANKER' | null
                const lastResultStep = lastResolved?.step || null;
                const lastStatus = lastResolved?.status || null; // WIN | LOSS | PENDING | null
                const signalSide = activeStep?.signal || (steps[0]?.signal ?? null); // fallback neutral-ish
                const signalKey = signalSide === 'BANKER' ? 'banker' : signalSide === 'PLAYER' ? 'player' : 'neutral';
                const signalGlow =
                  signalKey === 'player'
                    ? 'rgba(0,237,255,0.24)'
                    : signalKey === 'banker'
                      ? 'rgba(255,27,141,0.22)'
                      : 'rgba(59,130,246,0.16)';

                const miniOraclePulseMs =
                  fase === FASES.ANALISIS
                    ? 2400
                    : fase === FASES.DETECCION
                      ? 1800
                      : fase === FASES.SEÑAL
                        ? 900
                        : scores?.rolling
                          ? 1100
                          : fase === FASES.RESULTADO
                            ? 1400
                            : 2400;

                const isResultWin = fase === FASES.RESULTADO && lastWinningShot;
                const isResultLoss = fase === FASES.RESULTADO && !lastWinningShot;

                const resultChipColor =
                  lastResultSide === 'PLAYER'
                    ? '#00EDFF'
                    : lastResultSide === 'BANKER'
                      ? '#FF1B8D'
                      : '#3b82f6';

                // --- BACKUP (current/refactored) signal/progression implementation ---
                // Kept for comparison; not used in rendering after safe revert.
                const renderMiniOracle_new = () => (
                  <div className="mt-4 flex items-center justify-center">
                    <div
                      className="relative w-12 h-12 rounded-full border"
                      style={{
                        borderColor:
                          signalKey === 'player'
                            ? 'rgba(0,237,255,0.55)'
                            : signalKey === 'banker'
                              ? 'rgba(255,27,141,0.55)'
                              : (isLightMode ? 'rgba(148,163,184,0.55)' : 'rgba(255,255,255,0.18)'),
                        background: 'transparent',
                        boxShadow:
                          signalKey === 'player'
                            ? '0 0 10px rgba(0,237,255,0.12)'
                            : signalKey === 'banker'
                              ? '0 0 10px rgba(255,27,141,0.10)'
                              : '0 0 10px rgba(59,130,246,0.08)',
                        transform:
                          fase === FASES.RESULTADO && isResultWin
                            ? 'scale(1.06)'
                            : fase === FASES.RESULTADO && isResultLoss
                              ? 'scale(0.98)'
                              : 'scale(1)',
                        transition: 'transform 220ms ease-out, box-shadow 220ms ease-out',
                        animation: isDashboardActive ? 'none' : `pulse ${miniOraclePulseMs}ms ease-in-out infinite`,
                        opacity: isDashboardActive ? 0.65 : 1,
                      }}
                      aria-label="Mini oracle signal (new)"
                    />
                  </div>
                );

                const computeStepClass_new = (sig, isPast, isActive, isFuture) => {
                  const base = isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10';
                  const sigOutline =
                    sig === 'BANKER' ? 'border-pink-500/55 text-pink-200' : 'border-cyan-500/55 text-cyan-200';
                  const sigFill =
                    sig === 'BANKER'
                      ? 'bg-pink-500/18 border-pink-500/60 text-pink-100'
                      : 'bg-cyan-500/18 border-cyan-500/60 text-cyan-100';
                  const futureAura =
                    sig === 'BANKER'
                      ? 'shadow-[0_0_12px_rgba(255,27,141,0.08)]'
                      : 'shadow-[0_0_12px_rgba(0,237,255,0.08)]';
                  const pastGlow =
                    sig === 'BANKER'
                      ? 'shadow-[0_0_14px_rgba(255,27,141,0.10)]'
                      : 'shadow-[0_0_14px_rgba(0,237,255,0.10)]';
                  const activeGlow =
                    sig === 'BANKER'
                      ? 'shadow-[0_0_26px_rgba(255,27,141,0.18)]'
                      : 'shadow-[0_0_26px_rgba(0,237,255,0.16)]';
                  const passiveFutureOpacity = 'opacity-10';
                  const passivePastOpacity = 'opacity-80';
                  const passiveActiveScale = 'scale-[1.06]';
                  const activeInitialOpacity = activeIdx ? '' : 'opacity-70';
                  const activeFutureOpacity = 'opacity-65';
                  const activePastOpacity = 'opacity-40';
                  const activeActiveScale = 'scale-[1.14]';
                  return `h-12 rounded-2xl border flex flex-col items-center justify-center transition-all duration-200 transform-gpu ${
                    (!isDashboardActive && !activeIdx ? sigOutline : (isFuture ? sigOutline : (isPast || isActive ? sigFill : base)))
                  } ${
                    isDashboardActive
                      ? (isFuture ? passiveFutureOpacity : isPast ? passivePastOpacity : '')
                      : (activeIdx ? (isFuture ? activeFutureOpacity : isPast ? activePastOpacity : '') : activeInitialOpacity)
                  } ${isFuture ? futureAura : ''} ${isPast ? pastGlow : ''} ${
                    isActive ? `${isDashboardActive ? passiveActiveScale : activeActiveScale} ${isDashboardActive ? '' : 'animate-pulse'} ${activeGlow}` : ''
                  }`;
                };

                return (
                  <>
              {/* HEADER: Mesa / Ronda */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[9px] font-black uppercase tracking-[0.35em] ${isLightMode ? 'text-slate-500' : 'text-white/55'}`}>
                    LIVE CONTROL
                  </p>
                  <p className={`mt-1 text-[9px] font-mono uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-white/40'}`}>
                    {mode}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-black tracking-widest ${
                      isLightMode ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white/85'
                    }`}>
                      Mesa: {String(currentMesa)}
                    </span>
                    <span className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-black tracking-widest ${
                      isLightMode ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white/85'
                    }`}>
                      Ronda: {Number(currentRonda)}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-[8px] font-mono ${
                  isRunning ? 'bg-green-500/20 text-green-500 animate-pulse' : (isLightMode ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/35')
                }`}>
                  {isRunning ? 'ACTIVE' : 'IDLE'}
                </div>
              </div>

              {/* SIGNAL + RESULT combined: PLAYER / BANKER */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {([
                  { id: 'player', label: 'PLAYER', color: 'cyan', score: Number(scores.player) },
                  { id: 'banker', label: 'BANKER', color: 'pink', score: Number(scores.banker) },
                ]).map((s) => {
                  const resultSideKey =
                    lastResultSide === 'PLAYER' ? 'player' : lastResultSide === 'BANKER' ? 'banker' : null;
                  const isWinner = resultSideKey === s.id;
                  const isLoser = Boolean(resultSideKey) && resultSideKey !== s.id;
                  const isRolling = Boolean(scores?.rolling);
                  const glow =
                    s.id === 'player'
                      ? (isDashboardActive ? 'shadow-[0_0_12px_rgba(0,237,255,0.14)]' : 'shadow-[0_0_24px_rgba(0,237,255,0.24)]')
                      : (isDashboardActive ? 'shadow-[0_0_12px_rgba(255,27,141,0.12)]' : 'shadow-[0_0_22px_rgba(255,27,141,0.20)]');
                  const border =
                    s.id === 'player'
                      ? 'border-cyan-500/35'
                      : 'border-pink-500/35';
                  const text =
                    s.id === 'player'
                      ? 'text-cyan-300'
                      : 'text-pink-300';
                  const bg =
                    s.id === 'player'
                      ? 'bg-cyan-500/10'
                      : 'bg-pink-500/10';
                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border px-4 py-3 flex items-center justify-between transition-all duration-200 transform-gpu ${
                        isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
                      } ${
                        isWinner
                          ? `${border} ${bg} ${glow} ${isDashboardActive ? 'scale-[1.02]' : 'scale-105'} ${!isDashboardActive && fase === FASES.RESULTADO ? 'animate-pulse' : ''}`
                          : ''
                      } ${isLoser ? (isDashboardActive ? 'opacity-55' : 'opacity-35') : ''}`}
                    >
                      <div className="min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-[0.35em] ${isWinner ? text : (isLightMode ? 'text-slate-500' : 'text-white/55')}`}>
                          {s.label}
                        </p>
                        <p className={`mt-1 text-[10px] font-mono ${isLightMode ? 'text-slate-700' : 'text-white/70'}`}>
                          {scores?.rolling
                            ? (activeStep?.signal
                                ? `${activeStep.signal} SIGNAL`
                                : 'SIGNAL…')
                            : (isWinner ? 'WIN' : (resultSideKey ? 'LOSE' : 'STANDBY'))}
                        </p>
                      </div>
                      <div className={`font-mono font-black tabular-nums ${isLightMode ? 'text-slate-800' : 'text-white'} ${scores?.rolling ? 'opacity-70' : ''} ${isDashboardActive ? 'text-[26px]' : 'text-3xl'}`}>
                        {Number.isFinite(s.score) ? s.score : 0}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MINI ORACLE (signal indicator) */}
              <div className="mt-4 flex items-center justify-center">
                <div
                  className="relative w-12 h-12 rounded-full border"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    background:
                      isLightMode ? 'rgba(255,255,255,0.8)' : 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.14), rgba(0,0,0,0.25))',
                    boxShadow:
                      fase === FASES.SEÑAL
                        ? `0 0 26px ${signalGlow}`
                        : scores?.rolling
                          ? `0 0 20px ${signalGlow}`
                          : fase === FASES.RESULTADO
                            ? (isResultWin
                                ? `0 0 26px rgba(34,197,94,0.18), 0 0 22px ${signalGlow}`
                                : `0 0 18px rgba(239,68,68,0.16)`)
                            : `0 0 14px ${signalGlow}`,
                    transform: fase === FASES.RESULTADO && isResultWin ? 'scale(1.06)' : fase === FASES.RESULTADO && isResultLoss ? 'scale(0.98)' : 'scale(1)',
                    transition: 'transform 220ms ease-out, box-shadow 220ms ease-out',
                    animation: isDashboardActive ? 'none' : `pulse ${miniOraclePulseMs}ms ease-in-out infinite`,
                    opacity: isDashboardActive ? 0.65 : 1,
                  }}
                  aria-label="Mini oracle signal"
                >
                  <div
                    aria-hidden
                    className="absolute inset-[10px] rounded-full"
                    style={{
                      background:
                        signalKey === 'player'
                          ? 'radial-gradient(circle at 50% 50%, rgba(0,237,255,0.35), transparent 70%)'
                          : signalKey === 'banker'
                            ? 'radial-gradient(circle at 50% 50%, rgba(255,27,141,0.32), transparent 70%)'
                            : 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.22), transparent 70%)',
                      opacity: scores?.rolling || fase === FASES.SEÑAL ? 0.95 : 0.55,
                      transition: 'opacity 220ms ease-out',
                    }}
                  />
                </div>
              </div>

              {/* PROGRESS (T1–T6) */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className={`text-[9px] font-black uppercase tracking-[0.35em] ${isLightMode ? 'text-slate-500' : 'text-white/50'}`}>
                    LIVE EXECUTION
                  </p>
                  <p className={`text-[9px] font-mono ${isLightMode ? 'text-slate-500' : 'text-white/45'}`}>
                    T1–T6
                  </p>
                </div>
                <p className={`mt-2 text-[10px] font-mono font-black tracking-widest ${
                  Number(activeShot) > 0 && scores?.rolling ? (isLightMode ? 'text-slate-700' : 'text-white/75') : (isLightMode ? 'text-slate-400' : 'text-white/40')
                }`}>
                  {Number(activeShot) > 0 && scores?.rolling
                    ? `T${Number(activeShot)} — EXECUTING`
                    : fase === FASES.SEÑAL
                      ? 'WAITING RESULT'
                      : '—'}
                </p>
                <div className="mt-3 grid grid-cols-6 gap-3">
                  {(steps.length ? steps : Array.from({ length: 6 }).map((_, i) => ({ step: i + 1, signal: 'PLAYER', status: 'PENDING' }))).map((s) => {
                    const t = Number(s.step);
                    const sig = s.signal; // 'PLAYER' | 'BANKER'
                    const isActive = Boolean(scores?.rolling) && activeIdx === t;
                    const isPast = activeIdx ? t < activeIdx : Boolean(s.result);
                    const isFuture = activeIdx ? t > activeIdx : !s.result;

                    const base = isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10';
                    const empty = isLightMode ? 'text-slate-400' : 'text-white/20';

                    const sigStyle =
                      sig === 'BANKER'
                        ? 'border-pink-500/45 bg-pink-500/14 text-pink-200'
                        : 'border-cyan-500/45 bg-cyan-500/14 text-cyan-200';

                    const pastGlow =
                      sig === 'BANKER'
                        ? 'shadow-[0_0_14px_rgba(255,27,141,0.12)]'
                        : 'shadow-[0_0_14px_rgba(0,237,255,0.12)]';

                    const activeGlow =
                      sig === 'BANKER'
                        ? 'shadow-[0_0_26px_rgba(255,27,141,0.20)]'
                        : 'shadow-[0_0_26px_rgba(0,237,255,0.18)]';

                    // Dual-mode behavior:
                    // PASSIVE: subtle + minimal motion
                    // ACTIVE: guidance mode (all lit initially; past fades; current strong; future softly lit)
                    const passiveFutureOpacity = 'opacity-10';
                    const passivePastOpacity = 'opacity-80';
                    const passiveActiveScale = 'scale-[1.06]';

                    const activeInitialOpacity = activeIdx ? '' : 'opacity-70';
                    const activeFutureOpacity = 'opacity-65';
                    const activePastOpacity = 'opacity-40';
                    const activeActiveScale = 'scale-[1.14]';

                    return (
                      <div
                        key={`t-${t}`}
                        className={`h-12 rounded-2xl border flex flex-col items-center justify-center transition-all duration-200 transform-gpu ${
                          // ACTIVE mode: all steps lit initially with signal color
                          (!isDashboardActive && !activeIdx ? sigStyle : (isPast || isActive ? sigStyle : base))
                        } ${
                          isDashboardActive
                            ? (isFuture ? passiveFutureOpacity : isPast ? passivePastOpacity : '')
                            : (activeIdx
                                ? (isFuture ? activeFutureOpacity : isPast ? activePastOpacity : '')
                                : activeInitialOpacity)
                        } ${isPast ? `${pastGlow}` : ''} ${
                          isActive
                            ? `${isDashboardActive ? passiveActiveScale : activeActiveScale} ${isDashboardActive ? '' : 'animate-pulse'} ${activeGlow}`
                            : ''
                        }`}
                      >
                        <span className={`text-[9px] font-mono font-black ${isPast || isActive ? '' : empty}`}>T{t}</span>
                        <span className={`text-[11px] font-black ${isPast || isActive ? '' : empty}`}>
                          {sig === 'BANKER' ? 'B' : 'P'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CURRENT RESULT (MICRO) */}
              <div className={`mt-4 px-3 py-2 rounded-xl border flex items-center justify-between ${
                isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
              }`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-white/55'}`}>
                  Último
                </span>
                <span className={`text-[10px] font-mono font-black flex items-center gap-2 ${
                  fase === FASES.RESULTADO
                    ? (isResultWin ? 'text-white' : 'text-red-300')
                    : (isLightMode ? 'text-slate-700' : 'text-white/70')
                }`}>
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: fase === FASES.RESULTADO ? (isResultWin ? resultChipColor : '#ef4444') : (lastResultSide ? resultChipColor : 'rgba(255,255,255,0.25)'),
                      boxShadow: fase === FASES.RESULTADO ? `0 0 14px ${fase === FASES.RESULTADO && isResultWin ? resultChipColor : 'rgba(239,68,68,0.35)'}` : 'none',
                      transition: 'box-shadow 220ms ease-out',
                    }}
                  />
                  {fase === FASES.RESULTADO
                    ? (isResultWin && lastWinningShot ? `${String(lastResultSide)} WIN · T${Number(lastWinningShot)}` : 'FAIL')
                    : (lastResultSide ? `${String(lastResultSide)} ${lastStatus === 'WIN' ? 'WIN' : lastStatus === 'LOSS' ? 'LOSS' : 'READY'}${lastResultStep ? ` · T${Number(lastResultStep)}` : ''}` : '—')}
                </span>
              </div>
                  </>
                );
              })()}
            </div>
          </div>
          
          <div className={`p-4 rounded-xl border ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'border-white/5 bg-white/5'} mt-auto`}>
            <div className="flex items-center justify-between mb-2">
              <span className="armani-label-dynamic opacity-100">Protección IA</span>
              <ShieldCheck size={14} className={isRunning ? 'text-cyan-500' : 'text-slate-400'}/>
            </div>
            <p className="text-[10px] text-cyan-600 font-mono truncate uppercase tracking-widest">{isRunning ? 'Active_Shield' : 'Standby'}</p>
          </div>
        </aside>
      </div>

      <WalletSlidePanel
        open={isWalletPanelOpen}
        onClose={closeWalletPanel}
        isLight={isLightMode}
        userWalletAddress={userWalletAddress}
        userWalletAuthToken={userWalletAuthToken}
        setUserWalletAuthToken={setUserWalletAuthToken}
        userWalletSessionRef={userWalletSessionRef}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onTrustWalletFlow={onTrustWalletFlow}
        walletMode={walletMode}
        setWalletMode={setWalletMode}
        subView={walletSubView}
        setSubView={setWalletSubView}
        balanceAig={panelBalanceAig}
        balanceUsdt={panelBalanceUsdt}
        setBalanceAig={setPanelBalanceAig}
        setBalanceUsdt={setPanelBalanceUsdt}
        wageringAig={wallets?.aig?.wagering}
        wageringDual={wallets?.dual?.wagering}
        onWagerDeposit={applyWagerDeposit}
        walletTxHistory={walletTxHistory}
        appendWalletTx={appendWalletTx}
        logTransaction={logTransaction}
        queueWaiting={queueStats.waiting}
      />

      {/* MODAL AUDITORÍA */}
      {showSessionReport && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500"
          data-layer="modal"
          data-z="60"
          data-debug-anchor
        >
          <div className="glass w-full max-w-[620px] p-8 md:p-12 relative overflow-hidden border border-white/10 text-left text-white shadow-2xl">
            <button onClick={() => setShowSessionReport(false)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-all"><XCircle size={28}/></button>
            <div className="flex items-center gap-5 mb-10">
              <div className="w-16 h-16 rounded-[20px] bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20"><FileText size={32} className="text-cyan-400" /></div>
              <div>
                <h3 className="text-2xl armani-title-dynamic leading-none text-white">{activeCycleMode === MODOS.VISOR ? 'Auditoría Probabilística' : 'Informe de Gestión'}</h3>
                <p className="armani-label-dynamic mt-1 opacity-50 font-mono text-white">ID: {Math.floor(Math.random()*10000)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5"><p className="armani-label-dynamic text-white mb-1">Aciertos</p><p className="text-3xl font-mono font-black text-cyan-400">{Number(sessionStats.wins)}</p></div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5"><p className="armani-label-dynamic text-white mb-1">Desvíos</p><p className="text-3xl font-mono font-black text-pink-600">{Number(sessionStats.losses)}</p></div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10"><p className="armani-label-dynamic text-white mb-1">Precisión</p><p className="text-3xl font-mono font-black text-white">{sessionStats.total > 0 ? ((sessionStats.wins / sessionStats.total) * 100).toFixed(0) : 0}%</p></div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5"><p className="armani-label-dynamic text-white mb-1">Total</p><p className="text-3xl font-mono font-black text-white/50">{Number(sessionStats.total)}</p></div>
            </div>
            
            {/* Ocultamos Proyección de Capital en Modo Visor */}
            {activeCycleMode !== MODOS.VISOR && (
              <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-between">
                <div>
                  <p className="armani-label-dynamic text-cyan-400 mb-1 opacity-100 flex items-center gap-2"><DollarSign size={10}/> Recompensas netas (sesión)</p>
                  <h4 className="text-4xl font-mono font-black text-white">{Number(sessionStats.sessionRewardsNet) >= 0 ? '+' : ''}${Number(sessionStats.sessionRewardsNet).toFixed(2)}</h4>
                </div>
                <div className={`p-4 rounded-2xl ${Number(sessionStats.sessionRewardsNet) >= 0 ? 'bg-cyan-500/10 text-cyan-400' : 'bg-pink-500/10 text-pink-400'}`}>
                  {Number(sessionStats.sessionRewardsNet) >= 0 ? <TrendingUp size={32} /> : <AlertTriangle size={32} />}
                </div>
              </div>
            )}

            <div className="mb-8 p-6 rounded-3xl bg-black/40 border border-white/5">
              <p className="armani-label-dynamic text-white mb-5 flex items-center gap-2 opacity-100"><TrendingUp size={12}/> Distribución de Sincronía (T1-T6)</p>
              <div className="grid grid-cols-7 gap-3">
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="text-center">
                    <p className={`text-[10px] font-mono mb-2 ${Number(sessionStats.distribution[i]) > 0 ? 'text-cyan-400' : 'text-white/20'}`}>{i === 7 ? 'FAIL' : `T${i}`}</p>
                    <div className="h-16 w-full bg-white/5 rounded-lg flex flex-col justify-end items-center overflow-hidden"><div className={`w-full transition-all duration-1000 ${i === 7 ? 'bg-pink-600' : 'bg-cyan-500'}`} style={{ height: `${(Number(sessionStats.distribution[i]) / (Number(sessionStats.wins) || 1)) * 100}%`, minHeight: Number(sessionStats.distribution[i]) > 0 ? '4px' : '0px' }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-10 space-y-4">
              <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/10"><p className="armani-label-dynamic text-cyan-400 mb-2 opacity-100 flex items-center gap-2"><BrainCircuit size={12}/> Análisis Cognitivo</p><p className="text-sm font-light italic text-white/90 leading-relaxed">{String(neuralInsight.interpretation)}</p></div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10"><p className="armani-label-dynamic text-white mb-2 opacity-100 flex items-center gap-2"><Zap size={12}/> Recomendación Maestra</p><p className="text-sm font-light text-white leading-relaxed">{String(neuralInsight.recommendation)}</p></div>
            </div>
            <button onClick={() => setShowSessionReport(false)} className="w-full py-6 btn-energy-ai rounded-2xl text-xs font-black tracking-[0.4em] uppercase text-white">Finalizar Auditoría</button>
          </div>
        </div>
      )}

      {isHubOpen ? (
        <>
          <div
            role="presentation"
            className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${hubSlideIn ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeHub}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-hub-title"
            id="system-hub-panel"
            ref={hubPanelRef}
            tabIndex={-1}
            onKeyDown={handleHubKeyDown}
            className={`fixed top-0 right-0 z-[60] h-full w-[min(90vw,320px)] border-l border-white/10 shadow-[-16px_0_48px_rgba(0,0,0,0.45)] flex flex-col bg-gradient-to-b from-[rgba(12,3,32,0.97)] via-[rgba(8,2,24,0.98)] to-[rgba(4,0,14,0.99)] backdrop-blur-xl transition-transform duration-300 ease-out origin-right transform-gpu ${
              hubSlideIn ? 'translate-x-0 scale-100' : 'translate-x-full scale-[0.98]'
            }`}
          >
            <div className="flex items-center justify-between gap-3 p-5 border-b border-white/10">
              <h2 id="system-hub-title" className="text-sm font-black uppercase tracking-[0.35em] text-white/95">
                System Hub
              </h2>
              <button
                type="button"
                onClick={closeHub}
                className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-cyan-500/40 hover:bg-white/5 transition-all"
                aria-label="Close system hub"
              >
                <XCircle size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto custom-scrollbar py-3 px-2" aria-label="System navigation">
              <ul className="space-y-1">
                {hubMenuItems.map(({ id, label, Icon }) => {
                  const active = hubActiveId === id;
                  return (
                    <li key={id}>
                      <div className={id === 'ecosystem' ? 'relative group' : undefined}>
                      <button
                        type="button"
                        onClick={() => handleHubItemSelect(id)}
                        className={`relative w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 cursor-pointer border border-transparent transform-gpu ${
                          active
                            ? 'bg-cyan-500/15 text-cyan-100 border-cyan-500/25 shadow-[0_0_12px_rgba(0,237,255,0.14)]'
                            : id === 'ecosystem'
                              ? 'text-white/65 hover:bg-white/8 hover:text-white hover:shadow-[0_0_14px_rgba(0,237,255,0.12)] hover:scale-[1.02] opacity-70'
                              : 'text-white/80 hover:bg-white/8 hover:text-white hover:shadow-[0_0_14px_rgba(0,237,255,0.12)] hover:scale-[1.02]'
                        }`}
                      >
                        {active ? (
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 h-full w-[3px] rounded-r-full bg-gradient-to-b from-cyan-300 via-cyan-400 to-emerald-300 shadow-[0_0_8px_rgba(0,237,255,0.45)]"
                          />
                        ) : null}
                        <Icon size={18} className={active ? 'text-cyan-300' : 'text-white/50'} aria-hidden />
                        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
                        {id === 'ecosystem' ? (
                          <span className="ml-auto text-[9px] font-mono text-white/40">Coming soon</span>
                        ) : null}
                      </button>
                      {id === 'ecosystem' ? (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          <div className="rounded-lg border border-white/10 bg-[rgba(10,2,30,0.92)] px-2.5 py-2 shadow-xl backdrop-blur-xl">
                            <p className="text-[10px] font-mono text-white/80 whitespace-nowrap">
                              Multi-token integrations coming soon
                            </p>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {hubActiveId === 'dashboard' ? (
              <HubDashboardPanel
                activeWalletKey={activeWalletKey}
                wallets={wallets}
                ledger={ledger}
                fase={fase}
                sessionStats={sessionStats}
              />
            ) : null}
            {hubActiveId === 'analytics' ? (
              <HubAnalyticsPanel
                activeWalletKey={activeWalletKey}
                wallets={wallets}
                ledger={ledger}
                stake={stake}
                mgLevels={mgLevels}
              />
            ) : null}
            {hubActiveId === 'ai' ? (
              <HubAiStrategyPanel
                fase={fase}
                activeWalletKey={activeWalletKey}
                wallets={wallets}
                ledger={ledger}
                stake={stake}
                mgLevels={mgLevels}
              />
            ) : null}
            {hubActiveId === 'security' ? (
              <HubSecurityPanel
                userId={userId}
                activeWalletKey={activeWalletKey}
                wallets={wallets}
                ledger={ledger}
                sessionStartTs={sessionStartTsRef.current}
              />
            ) : null}
            {hubActiveId === 'settings' ? (
              <HubSettingsPanel
                isLightMode={isLightMode}
                setIsLightMode={setIsLightMode}
                isSoundEnabled={isSoundEnabled}
                setIsSoundEnabled={setIsSoundEnabled}
                setIsSoundEnabledWithInit={setIsSoundEnabledWithInit}
              />
            ) : null}
            {hubActiveId === 'ecosystem' ? <HubEcosystemPanel /> : null}
            {hubActiveId === 'history' ? <HubHistoryPanel ledger={ledger} /> : null}
          </div>
        </>
      ) : null}

      {/* Floating popups removed — alerts now live in the fixed right-side alert bar */}
      <div aria-hidden />

      <SystemIntelligencePanel
        open={isSystemIntelOpen}
        onClose={() => setIsSystemIntelOpen(false)}
        isLight={isLightMode}
        backendOrigin={socketBaseUrl}
        transactions={walletTxHistory}
        queueWaiting={queueStats.waiting}
      />

      <EngineDebugPanel
        open={isEngineDebugOpen}
        onClose={() => setIsEngineDebugOpen(false)}
        isLight={isLightMode}
        orchestratorBusy={aiFlowThinking}
        phase={fase}
        isActive={isRunning}
        isDev={import.meta.env.DEV}
        isDebugEnabled={isActionDebugEnabled}
        isPaused={isEnginePaused}
        isStepMode={isEngineStepMode}
        stepRemaining={(Array.isArray(stepQueueRef.current) ? stepQueueRef.current.length : 0)}
        onPause={pauseEngine}
        onResume={resumeEngine}
        onReset={resetEngine}
        onToggleStepMode={() => {
          if (!import.meta.env.DEV) return;
          setIsEngineStepMode((v) => !v);
          clearEngineTimers();
        }}
        onStepOnce={stepEngineOnce}
        onForcePhase={(p) => {
          if (!import.meta.env.DEV) return;
          clearEngineTimers();
          stepQueueRef.current = [];
          setFase(String(p));
        }}
        snapshotsRef={snapshotsRef}
        onRestoreSnapshot={restoreEngineSnapshot}
        onReplayActions={replayLastActions}
        actionLogRef={actionLogRef}
        planRef={enginePlanRef}
      />

      <GpulseSystemCoreIndicator
        isLight={isLightMode}
        onActivate={() => {
          if (trustWalletFlow.open) openWalletPanel();
          setActiveView('dashboard');
        }}
      />

      <footer className="relative z-20 p-4 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.5em] opacity-30 text-white" data-layer="ui" data-z="20">
        <div className="flex items-center gap-4">
          <span>Genesis AI v9.0.0 Crystal Hologram</span>
          <button
            type="button"
            onClick={() => setIsSystemIntelOpen((v) => !v)}
            className="opacity-50 hover:opacity-100 transition-opacity text-cyan-400/90 tracking-[0.2em]"
            title="System Intelligence"
          >
            SYS·INTEL
          </button>
          <a
            href="/admin/login"
            className="opacity-50 hover:opacity-100 transition-opacity text-amber-200/80 tracking-[0.2em]"
            title="Acceso operadores — panel admin (sesión segura)"
          >
            ADMIN
          </a>
          <a
            href="/admin/signals"
            className="opacity-50 hover:opacity-100 transition-opacity text-emerald-300/85 tracking-[0.2em]"
            title="Señales en vivo (misma app; pide login admin si no hay sesión)"
          >
            SEÑALES
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-pink-500 flex items-center gap-2">
            Protocolo de Azar Activo <Circle size={6} className="fill-current animate-pulse" />
          </span>
        </div>
      </footer>
    </div>
    </GpulseSystemCoreProvider>
    </GpulseProvider>
  );
}
