/**
 * Safety net: if anything on screen crashes (often caused by a browser
 * extension or auto-translate editing the page), React would leave a blank
 * page. Instead we redraw the app automatically; the room connection and
 * the player's seat are kept, so the game simply continues.
 */
import { Component, type ReactNode } from "react";

interface State {
  crashes: number;
  key: number;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashes: 0, key: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return {};
  }

  componentDidCatch(error: unknown): void {
    console.error("Screen crashed, redrawing", error);
    if (this.state.crashes >= 3) {
      window.location.reload(); // last resort: same as pressing refresh
      return;
    }
    this.setState((s) => ({ crashes: s.crashes + 1, key: s.key + 1 }));
    window.setTimeout(() => this.setState({ crashes: 0 }), 10_000);
  }

  render() {
    return <div key={this.state.key} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
