import React from 'react';
import { GradientButton } from './GradientButton.jsx';

/**
 * Catches render errors in Genesis subtree so a failed widget does not white-screen the whole app.
 */
export class GenesisErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const err = error instanceof Error ? error : new Error(String(error));
    const rawStack = typeof info?.componentStack === 'string' ? info.componentStack.trim() : '';
    const frames = rawStack
      ? rawStack
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
    const innerMost = frames[0] ?? '(no component stack)';

    console.groupCollapsed(
      `[GenesisErrorBoundary] ${err.name}: ${err.message.slice(0, 200)} | at ${innerMost}`,
    );
    console.error('Exact message:', err.message);
    console.error('Error name:', err.name);
    if (error != null && error !== err) console.error('Raw thrown value:', error);
    if (err.stack) console.error('JS stack:\n', err.stack);
    if (rawStack) console.error('React component stack (inner → outer):\n', rawStack);
    if (frames.length) {
      console.error('Innermost component line:', frames[0]);
      if (frames.length > 1) console.error('Next frames:', frames.slice(1, 6).join(' → '));
    }
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center font-display text-slate-200">
          <p className="text-lg text-rose-200">Something went wrong in the Genesis UI.</p>
          <p className="max-w-md text-sm text-slate-500">{String(this.state.error?.message || 'Unknown error')}</p>
          <GradientButton
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </GradientButton>
        </div>
      );
    }
    return this.props.children;
  }
}
