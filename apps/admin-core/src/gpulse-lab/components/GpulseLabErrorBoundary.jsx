import React from 'react';

export class GpulseLabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[gpulse-lab] ErrorBoundary', error, errorInfo?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] rounded-xl border border-amber-500/35 bg-zinc-950/95 p-6 text-slate-200 shadow-lg">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wide text-amber-200">GPulse Lab — panel error</h2>
          <p className="mt-2 font-mono text-xs text-slate-400">
            Something went wrong in this view. The rest of the admin app stays available.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[11px] text-red-300/95">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button
            type="button"
            className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-slate-200 hover:bg-white/10"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default GpulseLabErrorBoundary;
