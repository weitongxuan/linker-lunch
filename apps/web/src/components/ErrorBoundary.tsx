import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** 任何 render 例外都接住,顯示可重整的提示,而不是整頁空白 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[lunch-map] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal" role="alert">
        <div className="fatal-title">出錯了</div>
        <div className="fatal-sub">頁面遇到問題,重新整理通常就好。若一直發生,把下面這行貼給維護的人:</div>
        <code className="fatal-msg">{this.state.error.message}</code>
        <button className="btn pri" onClick={() => window.location.reload()}>
          重新整理
        </button>
      </div>
    );
  }
}
