import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import type { Vector3 } from 'three';
import { frame } from '../../lib/camera';
import { computeLayout } from '../../lib/layout';
import { describeConnection } from '../../lib/relationship';
import { clearConnection, setConnectionEnd } from '../../store/actions';
import { useFamily } from '../../store/family';
import { useConnectionPath } from '../../store/selectors';
import { useUI } from '../../store/ui';
import { PersonPicker } from './PersonPicker';

/** "Justin is Maria's first cousin", with names and relation emphasised. */
function Sentence({ relation, a, b }: { relation: string; a: string; b: string }) {
  return (
    <p className="sentence">
      <em>{a}</em> is <em>{b}</em>’s <strong>{relation}</strong>
    </p>
  );
}

export function ConnectionPanel() {
  const mode = useUI((s) => s.mode);
  const index = useFamily((s) => s.index);
  const byId = useFamily((s) => s.byId);
  const path = useConnectionPath();
  const connect = mode.kind === 'connect' ? mode : null;

  const description = useMemo(() => (path && path.length ? describeConnection(path, index, byId) : null), [path, index, byId]);

  // Fly the camera to frame the whole path once it's found.
  useEffect(() => {
    if (!path || path.length === 0) return;
    const { people, relationships } = useFamily.getState();
    const layout = computeLayout(people, relationships);
    const ids = [path[0].from, ...path.map((s) => s.to)];
    useUI.getState().moveCamera(frame(ids.map((id) => layout.get(id)).filter((v): v is Vector3 => !!v), { duration: 1300, lift: 0.18 }));
  }, [path]);

  const a = connect?.a ? byId.get(connect.a) : undefined;
  const b = connect?.b ? byId.get(connect.b) : undefined;
  const prompt = !connect?.a ? 'Pick the first person' : !connect.b ? 'Now pick the second person' : null;

  return (
    <AnimatePresence>
      {connect && (
        <motion.div key="picker" className="panel connect-bar" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
          <div className="connect-title">
            <span className="dot" /> Find connection
            {prompt && <span className="hint">{prompt} — click a node or search</span>}
          </div>
          <div className="connect-pickers">
            <PersonPicker label="A" value={connect.a} placeholder="Person A" onPick={(id) => setConnectionEnd('a', id)} />
            <span className="arrow">→</span>
            <PersonPicker label="B" value={connect.b} placeholder="Person B" onPick={(id) => setConnectionEnd('b', id)} />
            <button className="btn ghost" onClick={clearConnection}>
              Clear
            </button>
          </div>
        </motion.div>
      )}
      {connect && a && b && path !== undefined && (
        <motion.div key={`result-${a.id}-${b.id}`} className="panel result-panel" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}>
          {path === null ? (
            <p className="sentence">
              No connection found between <em>{a.name}</em> and <em>{b.name}</em>.
            </p>
          ) : path.length === 0 ? (
            <p className="sentence">That’s the same person.</p>
          ) : (
            description && (
              <>
                <Sentence relation={description.relation} a={a.name} b={b.name} />
                <p className="chain">
                  {description.chain.split(' → ').map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="arrow">→</span>}
                      {part}
                    </span>
                  ))}
                </p>
              </>
            )
          )}
          <button className="btn" onClick={clearConnection}>
            Clear
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
