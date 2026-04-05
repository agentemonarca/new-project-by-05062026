import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Crosshair, Minus, Plus } from 'lucide-react';

/**
 * @typedef {'active' | 'pending' | 'inactive'} NodeStatus
 */

/**
 * @typedef {{ id: string, label: string, status: NodeStatus, volume?: number, left?: TreeNode, right?: TreeNode }} TreeNode
 */

const V_GAP = 78;
const BASE_SPREAD = 220;

/** Status → ring + fill */
const STATUS_STYLES = {
  active: {
    ring: 'rgba(34,197,94,0.95)',
    fill: 'rgba(22,101,52,0.85)',
    glow: 'rgba(34,197,94,0.55)',
    label: 'Active',
  },
  pending: {
    ring: 'rgba(234,179,8,0.95)',
    fill: 'rgba(113,63,18,0.85)',
    glow: 'rgba(250,204,21,0.45)',
    label: 'Pending',
  },
  inactive: {
    ring: 'rgba(239,68,68,0.9)',
    fill: 'rgba(127,29,29,0.85)',
    glow: 'rgba(248,113,113,0.4)',
    label: 'Inactive',
  },
};

const NODE_R = 22;

/**
 * @param {TreeNode | undefined} node
 * @param {number} depth
 * @param {number} maxDepth
 * @param {number} cx
 * @param {number} spread
 * @param {{ id: string, x: number, y: number, label: string, status: NodeStatus, volume: number, depth: number }[]} positions
 * @param {{ id: string, fromId: string, toId: string, x1: number, y1: number, x2: number, y2: number }[]} edges
 */
function layoutTree(node, depth, maxDepth, cx, spread, positions, edges) {
  if (!node || depth > maxDepth) return;
  const y = 52 + depth * V_GAP;
  positions.push({
    id: node.id,
    x: cx,
    y,
    label: node.label,
    status: node.status,
    volume: node.volume ?? 0,
    depth,
  });

  const nextSpread = spread * 0.52;
  if (node.left) {
    const lx = cx - spread;
    const childY = y + V_GAP;
    edges.push({
      id: `e-${node.id}-L`,
      fromId: node.id,
      toId: node.left.id,
      x1: cx,
      y1: y,
      x2: lx,
      y2: childY,
    });
    layoutTree(node.left, depth + 1, maxDepth, lx, nextSpread, positions, edges);
  }
  if (node.right) {
    const rx = cx + spread;
    const childY = y + V_GAP;
    edges.push({
      id: `e-${node.id}-R`,
      fromId: node.id,
      toId: node.right.id,
      x1: cx,
      y1: y,
      x2: rx,
      y2: childY,
    });
    layoutTree(node.right, depth + 1, maxDepth, rx, nextSpread, positions, edges);
  }
}

/** Demo tree — 4 levels, varied status */
function buildDemoTree(rootLabel = 'You') {
  /** @type {TreeNode} */
  const tree = {
    id: 'n-root',
    label: rootLabel,
    status: 'active',
    volume: 12840,
    left: {
      id: 'n-L',
      label: '0x71…a2',
      status: 'active',
      volume: 4200,
      left: {
        id: 'n-LL',
        label: '0x9c…01',
        status: 'active',
        volume: 2100,
        left: { id: 'n-LLL', label: '0xaa…10', status: 'pending', volume: 400 },
        right: { id: 'n-LLR', label: '0xbb…20', status: 'inactive', volume: 120 },
      },
      right: {
        id: 'n-LR',
        label: '0x44…33',
        status: 'pending',
        volume: 980,
        left: { id: 'n-LRL', label: '0xcc…40', status: 'active', volume: 520 },
        right: { id: 'n-LRR', label: '0xdd…50', status: 'active', volume: 310 },
      },
    },
    right: {
      id: 'n-R',
      label: '0x22…b4',
      status: 'active',
      volume: 5100,
      left: {
        id: 'n-RL',
        label: '0xee…61',
        status: 'inactive',
        volume: 0,
        left: { id: 'n-RLL', label: '0xff…70', status: 'pending', volume: 80 },
      },
      right: {
        id: 'n-RR',
        label: '0x11…82',
        status: 'active',
        volume: 2400,
        left: { id: 'n-RRL', label: '0x22…90', status: 'active', volume: 1100 },
        right: { id: 'n-RRR', label: '0x33…a0', status: 'pending', volume: 640 },
      },
    },
  };
  return tree;
}

function curvedPath(x1, y1, x2, y2) {
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

/**
 * Rough viewport cull: skip nodes far outside view (performance when zoomed).
 * @param {typeof positions[0]} p
 * @param {number} pad
 */
function inViewPad(p, pad, w, h) {
  return p.x >= -pad && p.x <= w + pad && p.y >= -pad && p.y <= h + pad;
}

/**
 * @param {{
 *   rootLabel?: string,
 *   maxDepth?: number,
 *   className?: string,
 * }} props
 */
export function BinaryNetworkTree({ rootLabel = 'You', maxDepth = 4, className = '' }) {
  const uid = useId();
  const reduceMotion = useReducedMotion();
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [selected, setSelected] = useState(null);

  const W = 880;
  const H = 520;

  const tree = useMemo(() => buildDemoTree(rootLabel), [rootLabel]);

  const { positions, edges } = useMemo(() => {
    const positions = [];
    const edges = [];
    layoutTree(tree, 0, maxDepth, W / 2, BASE_SPREAD, positions, edges);
    return { positions, edges };
  }, [tree, maxDepth]);

  /** Cap ~31 nodes at depth 4 — render all; cull only extreme off-canvas when zoomed (optional) */
  const visiblePositions = useMemo(() => {
    const pad = 200;
    return positions.filter((p) => inViewPad(p, pad, W, H));
  }, [positions, W, H]);

  const centerView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback((e) => {
    const delta = e.deltaY > 0 ? -0.07 : 0.07;
    setZoom((z) => Math.min(2.4, Math.max(0.35, z + delta)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    return () => el.removeEventListener('wheel', prevent);
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('[data-node]')) return;
    setDrag({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y });
  }, [pan]);

  const onMouseMove = useCallback(
    (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / zoom;
      const dy = (e.clientY - drag.sy) / zoom;
      setPan({ x: drag.px + dx, y: drag.py + dy });
    },
    [drag, zoom],
  );

  const endDrag = useCallback(() => setDrag(null), []);

  const zoomIn = () => setZoom((z) => Math.min(2.4, z + 0.15));
  const zoomOut = () => setZoom((z) => Math.max(0.35, z - 0.15));

  const filterId = `glow-${uid.replace(/:/g, '')}`;
  const filterLineId = `lineglow-${uid.replace(/:/g, '')}`;

  return (
    <div className={`relative ${className}`.trim()}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Depth ≤ {maxDepth} · {positions.length} nodes
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" /> Active
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" /> Pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" /> Inactive
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={centerView}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Center
          </button>
        </div>
      </div>

      <div
        ref={svgRef}
        role="application"
        aria-label="Binary network tree"
        className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.12),transparent_50%),#020617]"
        style={{ touchAction: 'none' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseLeave={endDrag}
        onMouseUp={endDrag}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block select-none">
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={filterLineId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}>
            {/* Edges */}
            <g filter={reduceMotion ? undefined : `url(#${filterLineId})`}>
              {edges.map((e) => {
                const y1 = e.y1 + NODE_R;
                const y2 = e.y2 - NODE_R;
                const d = curvedPath(e.x1, y1, e.x2, y2);
                const isHl =
                  hoveredId && (e.fromId === hoveredId || e.toId === hoveredId || selected?.id === e.fromId || selected?.id === e.toId);
                return (
                  <motion.path
                    key={e.id}
                    d={d}
                    fill="none"
                    stroke={isHl ? 'rgba(52,211,153,0.9)' : 'rgba(45,212,191,0.38)'}
                    strokeWidth={isHl ? 3.2 : 2}
                    initial={reduceMotion ? false : { pathLength: 0, opacity: 0.45 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            {visiblePositions.map((p) => {
              const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.inactive;
              const isHover = hoveredId === p.id;
              const isSel = selected?.id === p.id;
              return (
                <g
                  key={p.id}
                  data-node
                  transform={`translate(${p.x} ${p.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId((h) => (h === p.id ? null : h))}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelected(p);
                  }}
                >
                  <motion.circle
                    r={NODE_R}
                    fill={st.fill}
                    stroke={st.ring}
                    strokeWidth={isSel ? 3 : isHover ? 2.5 : 2}
                    filter={`url(#${filterId})`}
                    initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: isHover ? 1.1 : 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  />
                  <circle r={NODE_R + 5} fill="none" stroke={st.glow} strokeWidth="2" opacity={isHover ? 0.55 : 0.22} />
                  <text
                    textAnchor="middle"
                    y={p.depth === 0 ? 5 : 4}
                    className="pointer-events-none fill-white"
                    style={{ fontSize: p.depth === 0 ? 12 : 0, fontWeight: 700, fontFamily: 'system-ui, sans-serif' }}
                  >
                    {p.depth === 0 ? 'You' : ''}
                  </text>
                  {p.depth > 0 ? (
                    <text
                      textAnchor="middle"
                      y={NODE_R + 14}
                      className="pointer-events-none fill-slate-300"
                      style={{ fontSize: 9, fontFamily: 'ui-monospace, monospace' }}
                    >
                      {p.label.length > 8 ? `${p.label.slice(0, 6)}…` : p.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4 rounded-xl border border-white/10 bg-slate-950/90 p-4 backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Node</p>
                <p className="font-mono text-sm text-white">{selected.label}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Status:{' '}
                  <span style={{ color: STATUS_STYLES[selected.status]?.ring }}>{STATUS_STYLES[selected.status]?.label}</span>
                  {' · '}
                  Depth {selected.depth}
                </p>
                <p className="mt-1 text-xs text-slate-500">Volume (demo): {selected.volume.toLocaleString()} pts</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="mt-2 text-[10px] text-slate-600">
        Scroll to zoom · drag empty space to pan · hover highlights branches · click node for details.
      </p>
    </div>
  );
}
