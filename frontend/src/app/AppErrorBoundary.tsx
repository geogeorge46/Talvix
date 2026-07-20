import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, ErrorState } from '../design-system';
interface State {
  failed: boolean;
}
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void error;
    void info; /* Reporting integration boundary. Never log sensitive request data. */
  }
  render() {
    if (this.state.failed)
      return (
        <main className="tvx-system-page">
          <ErrorState
            variant="page"
            detail="Talvix could not display this page."
          />
          <Button onClick={() => window.location.assign('/')}>
            Reload workspace
          </Button>
        </main>
      );
    return this.props.children;
  }
}
