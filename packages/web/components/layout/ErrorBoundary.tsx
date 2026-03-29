"use client";
import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[40vh] p-6">
          <div className="text-center space-y-3 max-w-md">
            <div className="text-4xl opacity-30">⚠️</div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm opacity-60">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-sm transition">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
