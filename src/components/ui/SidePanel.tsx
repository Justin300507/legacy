import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { canAdd, type AddRelation } from '../../lib/addRelative';
import { childrenOf, parentsOf, partnersOf, siblingsOf } from '../../lib/graph';
import { cancelAdd, chooseRelation, confirmDelete, flyToPerson, savePerson, startAdd, startConnection } from '../../store/actions';
import { useFamily } from '../../store/family';
import { useUI } from '../../store/ui';
import { Avatar } from './Avatar';
import { useIsSmall } from './hooks';
import { PersonForm } from './PersonForm';

const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' } as const;
const RELATIONS: { id: Exclude<AddRelation, 'first'>; label: string }[] = [
  { id: 'parent', label: 'Parent' },
  { id: 'partner', label: 'Partner' },
  { id: 'child', label: 'Child' },
  { id: 'sibling', label: 'Sibling' },
];

function RelativeList({ title, ids, half }: { title: string; ids: readonly string[]; half?: Set<string> }) {
  const byId = useFamily((s) => s.byId);
  if (!ids.length) return null;
  return (
    <section className="relatives">
      <h4>{title}</h4>
      <ul>
        {ids.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return (
            <li key={id}>
              <button className="relative" onClick={() => flyToPerson(id)}>
                <Avatar photo={p.photo} name={p.name} size={30} />
                <span>{p.name}</span>
                {half?.has(id) && <small>half</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SidePanel() {
  const selectedId = useUI((s) => s.selectedId);
  const mode = useUI((s) => s.mode);
  const person = useFamily((s) => (selectedId ? s.byId.get(selectedId) : undefined));
  const index = useFamily((s) => s.index);
  const small = useIsSmall();
  const [editing, setEditing] = useState(false);

  useEffect(() => setEditing(false), [selectedId]);

  const picking = mode.kind === 'add' && mode.stage === 'pick' && mode.anchorId === person?.id;
  const visible = !!person && (mode.kind === 'idle' || picking);

  const siblings = person ? siblingsOf(index, person.id) : [];
  const grandparents = person ? [...new Set(parentsOf(index, person.id).flatMap((p) => parentsOf(index, p)))] : [];

  return (
    <AnimatePresence>
      {visible && person && (
        <motion.aside
          key="side"
          className="panel side-panel"
          initial={small ? { y: '100%' } : { x: 380, opacity: 0 }}
          animate={small ? { y: 0 } : { x: 0, opacity: 1 }}
          exit={small ? { y: '100%' } : { x: 380, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        >
          <button className="close" aria-label="Close" onClick={() => (picking ? cancelAdd() : useUI.getState().select(null))}>
            ×
          </button>
          {editing ? (
            <PersonForm
              title="Edit person"
              initial={person}
              showNotes
              onSubmit={async (d) => {
                await savePerson(person.id, d);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <header className="person-header">
                <Avatar photo={person.photo} name={person.name} size={96} />
                <h2>{person.name || 'Unnamed'}</h2>
                <p className="meta">
                  {[person.birthYear && `Born ${person.birthYear}`, person.gender && GENDER_LABEL[person.gender]].filter(Boolean).join(' · ') || 'No details yet'}
                </p>
              </header>
              {person.notes && <p className="notes">{person.notes}</p>}

              {picking ? (
                <section className="relation-picker">
                  <h4>Add a relative to {person.name}</h4>
                  <div className="grid">
                    {RELATIONS.map((r) => {
                      const ok = canAdd(index, person.id, r.id);
                      return (
                        <button key={r.id} className="btn" disabled={!ok} title={ok ? undefined : 'Already has two parents'} onClick={() => chooseRelation(r.id)}>
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                  <button className="btn ghost wide" onClick={cancelAdd}>
                    Cancel
                  </button>
                </section>
              ) : (
                <>
                  <div className="panel-actions">
                    <button className="btn primary" onClick={() => startAdd(person.id)}>
                      Add relative
                    </button>
                    <button className="btn" onClick={startConnection}>
                      Find connection
                    </button>
                  </div>
                  <RelativeList title="Parents" ids={parentsOf(index, person.id)} />
                  <RelativeList title="Partners" ids={partnersOf(index, person.id)} />
                  <RelativeList title="Children" ids={childrenOf(index, person.id)} />
                  <RelativeList title="Siblings" ids={siblings.map((s) => s.id)} half={new Set(siblings.filter((s) => s.half).map((s) => s.id))} />
                  <RelativeList title="Grandparents" ids={grandparents} />
                  <div className="panel-actions secondary">
                    <button className="btn" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => confirmDelete(person.id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
