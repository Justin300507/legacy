import { AnimatePresence, motion } from 'framer-motion';
import type { AddRelation } from '../../lib/addRelative';
import { partnersOf } from '../../lib/graph';
import { answerPlaceholder, cancelAdd, chooseOtherParent, saveAdd } from '../../store/actions';
import { useFamily } from '../../store/family';
import { useUI, type AddFlow } from '../../store/ui';
import { FORM_AT } from '../scene/Ghost';
import { Avatar } from './Avatar';
import { useIsSmall, useReachedTime } from './hooks';
import { PersonForm } from './PersonForm';

const TITLES: Record<AddRelation, string> = {
  first: 'Add the first person',
  parent: 'New parent of',
  partner: 'New partner of',
  child: 'New child of',
  sibling: 'New sibling of',
};

/** The add-person form; rendered next to the ghost (desktop) or as a bottom sheet (phone). */
export function AddPersonForm({ flow }: { flow: AddFlow }) {
  const anchor = useFamily((s) => (flow.anchorId ? s.byId.get(flow.anchorId) : undefined));
  const title = flow.relation === 'first' ? TITLES.first : `${TITLES[flow.relation!]} ${anchor?.name ?? ''}`;
  return (
    <motion.div className="panel form-panel" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <PersonForm title={title} submitLabel="Save" onSubmit={saveAdd} onCancel={cancelAdd} />
    </motion.div>
  );
}

/** Returns the form element when it should be shown beside the ghost in 3D (desktop only). */
export function useGhostForm() {
  const mode = useUI((s) => s.mode);
  const small = useIsSmall();
  const flow = mode.kind === 'add' && mode.stage === 'form' ? mode : null;
  const delay = flow?.relation === 'first' ? 300 : FORM_AT;
  const ready = useReachedTime(flow ? flow.startedAt + delay : Infinity);
  return flow && ready && !small ? <AddPersonForm key={flow.newId} flow={flow} /> : null;
}

/** Questions asked before the ghost appears, plus the phone bottom-sheet form. */
export function AddFlowOverlay() {
  const mode = useUI((s) => s.mode);
  const index = useFamily((s) => s.index);
  const byId = useFamily((s) => s.byId);
  const small = useIsSmall();
  const flow = mode.kind === 'add' ? mode : null;
  const ready = useReachedTime(flow?.stage === 'form' ? flow.startedAt + (flow.relation === 'first' ? 300 : FORM_AT) : Infinity);
  const anchor = flow?.anchorId ? byId.get(flow.anchorId) : undefined;

  return (
    <AnimatePresence>
      {flow?.stage === 'placeholder' && anchor && (
        <motion.div key="ph" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="panel dialog" role="dialog" aria-modal="true">
            <p>
              <strong>{anchor.name}</strong> has no parents in the tree yet. Siblings are connected through shared parents — create a placeholder parent?
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={() => answerPlaceholder(false)}>
                Cancel
              </button>
              <button className="btn primary" autoFocus onClick={() => answerPlaceholder(true)}>
                Create placeholder
              </button>
            </div>
          </div>
        </motion.div>
      )}
      {flow?.stage === 'otherParent' && anchor && (
        <motion.div key="op" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="panel dialog" role="dialog" aria-modal="true">
            <p>
              Who is the other parent of <strong>{anchor.name}</strong>’s new child?
            </p>
            <div className="choice-list">
              {partnersOf(index, anchor.id).map((id) => {
                const p = byId.get(id)!;
                return (
                  <button key={id} className="choice" onClick={() => chooseOtherParent(id)}>
                    <Avatar photo={p.photo} name={p.name} size={32} />
                    {p.name}
                  </button>
                );
              })}
              <button className="choice" onClick={() => chooseOtherParent(null)}>
                <span className="avatar" style={{ width: 32, height: 32 }}>
                  ?
                </span>
                Unknown
              </button>
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={cancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}
      {flow?.stage === 'form' && small && ready && (
        <motion.div
          key={`sheet-${flow.newId}`}
          className="bottom-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <PersonForm
            title={flow.relation === 'first' ? TITLES.first : `${TITLES[flow.relation!]} ${anchor?.name ?? ''}`}
            onSubmit={saveAdd}
            onCancel={cancelAdd}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
