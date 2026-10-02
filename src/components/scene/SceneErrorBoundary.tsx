import { Component, type ReactNode } from 'react';

type State = { error: Error | null };

/** Shows why the 3D view failed instead of leaving a blank black page. */
export class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="scene-error panel" role="alert">
        <h3>The 3D view couldn’t start</h3>
        <p>{this.state.error.message}</p>
        <p className="dialog-hint">Your family tree is still saved. Try reloading; if this keeps happening, check that hardware acceleration is enabled in your browser.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
