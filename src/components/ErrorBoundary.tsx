import { Component, type ReactNode } from 'react';
import { ErrorScreen } from './StatusScreens';

/** Shows the error screen instead of a blank page if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    return error ? <ErrorScreen message={error.message} onRetry={() => window.location.reload()} /> : this.props.children;
  }
}
