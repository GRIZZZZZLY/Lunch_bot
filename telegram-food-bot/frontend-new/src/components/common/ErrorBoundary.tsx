import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/lib/monitoring';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack, source: 'ErrorBoundary' });
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          padding: 20,
          margin: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          color: 'var(--ink)',
          fontFamily: 'var(--mono)',
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
          Что-то пошло не так
        </div>
        <div style={{ color: 'var(--ink-2)', fontSize: 12, marginBottom: 12 }}>
          {this.state.error.message || 'Неизвестная ошибка'}
        </div>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            background: 'var(--pri)',
            color: 'var(--pri-ink)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }
}
