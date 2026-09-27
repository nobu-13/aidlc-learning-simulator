// ErrorBoundary — 予期しない render エラーの受け皿（nfr-design の error handling 2-way split）。
// 期待される domain error は ErrorView が扱い、ここは「予期しない render エラー」の最後の安全網。
// DomainInvariantError の意味は握り潰さない（fallback を出しつつ、エラーは開発時に可視）。
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  /** fallback の見出し・本文（locale 解決済みテキスト）。 */
  readonly title: string;
  readonly body: string;
}

interface State {
  readonly hasError: boolean;
  readonly message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 握り潰さず、開発時に可視化する（no-network posture: 外部送信はしない）。
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main>
          <section className="error" role="alert" aria-labelledby="boundary-h">
            <h1 id="boundary-h">{this.props.title}</h1>
            <p>{this.props.body}</p>
            <p className="visually-hidden" data-testid="boundary-message">
              {this.state.message}
            </p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
