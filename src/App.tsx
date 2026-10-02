import { useEffect } from 'react';
import { Scene } from './components/scene/Scene';
import { AddFlowOverlay, useGhostForm } from './components/ui/AddFlow';
import { ConnectionPanel } from './components/ui/ConnectionPanel';
import { ConfirmDialog, Toast } from './components/ui/Overlays';
import { SidePanel } from './components/ui/SidePanel';
import { TopBar } from './components/ui/TopBar';
import { DatesPanel } from './components/ui/DatesPanel';
import { cancelCurrent, initialLoad } from './store/actions';
import { useFamily } from './store/family';
import { useUI } from './store/ui';

export default function App() {
  const ghostForm = useGhostForm();
  const loaded = useFamily((s) => s.loaded);
  const empty = useFamily((s) => s.people.length === 0);
  const idle = useUI((s) => s.mode.kind === 'idle');

  useEffect(() => {
    void initialLoad();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select');
      if (e.key === 'Escape' && !typing && !useUI.getState().dialog) cancelCurrent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Scene ghostForm={ghostForm} />
      <TopBar />
      {loaded && empty && idle && (
        <p className="empty-hint">
          Your tree is empty. Click the ring to add the first person, or <b>Load demo family</b> to explore.
        </p>
      )}
      <SidePanel />
      <DatesPanel />
      <ConnectionPanel />
      <AddFlowOverlay />
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
