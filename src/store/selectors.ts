import { useMemo } from 'react';
import { planAddition } from '../lib/addRelative';
import { findPath } from '../lib/graph';
import { computeLayout } from '../lib/layout';
import { useFamily } from './family';
import { useUI, type AddFlow } from './ui';

export const isGhostStage = (flow: AddFlow) => flow.stage === 'form' || flow.stage === 'closing';

/** Layout targets, including the provisional person while the add-relative ghost is showing. */
export function useLayoutTargets() {
  const people = useFamily((s) => s.people);
  const relationships = useFamily((s) => s.relationships);
  const index = useFamily((s) => s.index);
  const mode = useUI((s) => s.mode);
  const provisional = useMemo(
    () =>
      mode.kind === 'add' && isGhostStage(mode) && mode.relation
        ? planAddition(index, mode.anchorId, mode.relation, { id: mode.newId, name: '' }, mode)
        : null,
    [mode, index],
  );
  return useMemo(
    () =>
      provisional
        ? computeLayout([...people, ...provisional.people], [...relationships, ...provisional.relationships])
        : computeLayout(people, relationships),
    [people, relationships, provisional],
  );
}

/** undefined while picking, null when unconnected, else the path from A to B. */
export function useConnectionPath() {
  const mode = useUI((s) => s.mode);
  const index = useFamily((s) => s.index);
  const a = mode.kind === 'connect' ? mode.a : null;
  const b = mode.kind === 'connect' ? mode.b : null;
  return useMemo(() => (a && b ? findPath(index, a, b) : undefined), [a, b, index]);
}
