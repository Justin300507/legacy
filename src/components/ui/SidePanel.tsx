import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { canAdd, parentCandidates, suggestedParents, type AddRelation } from '../../lib/addRelative';
import { childrenOf, parentsOf, partnersOf, siblingsOf } from '../../lib/graph';
import type { Relationship } from '../../lib/types';
import {
  cancelAdd,
  chooseRelation,
  confirmDelete,
  confirmUnlink,
  flyToPerson,
  linkParent,
  savePerson,
  startAdd,
  startConnection,
} from '../../store/actions';
import { useFamily } from '../../store/family';
import { useUI } from '../../store/ui';
import { Avatar } from './Avatar';
import { useIsSmall } from './hooks';
import { PersonForm } from './PersonForm';
import { PersonPicker } from './PersonPicker';

const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' } as const;
const RELATIONS: { id: Exclude<AddRelation, 'first'>; label: string }[] = [
  { id: 'parent', label: 'Parent' },
  { id: 'partner', label: 'Partner' },
  { id: 'child', label: 'Child' },
  { id: 'sibling', label: 'Sibling' },
];

type ListProps = {
  title: string;
  ids: readonly string[];
  half?: Set<string>;
  /** The relationship joining the selected person to `id`, if it can be removed from here. */
  linkOf?: (id: string) => Relationship | undefined;
  unlinkText?: (name: string) => string;
  children?: ReactNode;
};

function RelativeList({ title, ids, half, linkOf, unlinkText, children }: ListProps) {
  const byId = useFamily((s) => s.byId);
  if (!ids.length && !children) return null;
  return (
    <section className="relatives">
      <h4>{title}</h4>
      <ul>
        {ids.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          const link = linkOf?.(id);
          return (
            <li key={id} className="relative-row">
              <button className="relative" onClick={() => flyToPerson(id)}>
                <Avatar photo={p.photo} name={p.name} size={30} />
                <span>{p.name}</span>
                {half?.has(id) && <small>half</small>}
              </button>
              {link && unlinkText && (
                <button className="unlink" title="Remove this link" aria-label={`Remove link to ${p.name}`} onClick={() => confirmUnlink(link.id, unlinkText(p.name))}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {children}
    </section>
  );
}

/** Link an existing person as a parent: quick suggestions plus a searchable picker. */
function SetParent({ childId, childName }: { childId: string; childName: string }) {
  const index = useFamily((s) => s.index);
  const byId = useFamily((s) => s.byId);
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => new Set(parentCandidates(index, childId)), [index, childId]);
  const suggested = suggestedParents(index, childId);
  if (!candidates.size) return null;
  return (
    <div className="set-parent">
      {suggested.map((id) => (
        <button key={id} className="btn suggest" onClick={() => linkParent(childId, id)}>
          + Set {byId.get(id)?.name} as parent
        </button>
      ))}
      {open ? (
        <PersonPicker value={null} placeholder={`Choose ${childName}’s parent…`} only={candidates} autoFocus onPick={(id) => void linkParent(childId, id).then(() => setOpen(false))} />
      ) : (
        <button className="link" onClick={() => setOpen(true)}>
          + Set an existing person as parent
        </button>
      )}
    </div>
  );
}

export function SidePanel() {
  const selectedId = useUI((s) => s.selectedId);
  const mode = useUI((s) => s.mode);
  const person = useFamily((s) => (selectedId ? s.byId.get(selectedId) : undefined));
  const index = useFamily((s) => s.index);
  const relationships = useFamily((s) => s.relationships);
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
                  <RelativeList
                    title="Parents"
                    ids={parentsOf(index, person.id)}
                    linkOf={(id) => relationships.find((r) => r.type === 'parent' && r.parent === id && r.child === person.id)}
                    unlinkText={(name) => `Remove ${name} as ${person.name}’s parent? Both people stay in the tree.`}
                  >
                    <SetParent childId={person.id} childName={person.name} />
                  </RelativeList>
                  <RelativeList
                    title="Partners"
                    ids={partnersOf(index, person.id)}
                    linkOf={(id) => relationships.find((r) => r.type === 'partner' && ((r.a === id && r.b === person.id) || (r.b === id && r.a === person.id)))}
                    unlinkText={(name) => `Remove the partner link between ${person.name} and ${name}? Both people stay in the tree.`}
                  />
                  <RelativeList
                    title="Children"
                    ids={childrenOf(index, person.id)}
                    linkOf={(id) => relationships.find((r) => r.type === 'parent' && r.parent === person.id && r.child === id)}
                    unlinkText={(name) => `Remove ${person.name} as ${name}’s parent? Both people stay in the tree.`}
                  />
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
