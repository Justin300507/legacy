import { useRef } from 'react';
import { exportFile, flyToPerson, frameAll, importFile, loadDemo, startConnection, clearConnection } from '../../store/actions';
import { useFamily } from '../../store/family';
import { useUI } from '../../store/ui';
import { PersonPicker } from './PersonPicker';

export function TopBar() {
  const mode = useUI((s) => s.mode);
  const count = useFamily((s) => s.people.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const connecting = mode.kind === 'connect';
  const busy = mode.kind === 'add';

  return (
    <header className="top-bar">
      <div className="brand-search">
        <span className="brand">
          <span className="brand-ring" /> Family<b>3D</b>
        </span>
        {count > 0 && <PersonPicker className="search" value={null} placeholder="Search people…" onPick={flyToPerson} />}
      </div>
      <nav className="toolbar">
        <button className={`btn ${connecting ? 'primary' : ''}`} disabled={busy || count < 2} onClick={connecting ? clearConnection : startConnection}>
          Find Connection
        </button>
        <button className="btn ghost" disabled={count === 0} onClick={() => frameAll()} title="Fit whole tree">
          Fit
        </button>
        <button className="btn ghost" disabled={busy} onClick={loadDemo}>
          Load demo family
        </button>
        <button className="btn ghost" disabled={count === 0} onClick={exportFile}>
          Export
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </nav>
    </header>
  );
}
