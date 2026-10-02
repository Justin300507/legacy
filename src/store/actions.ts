import { Vector3 } from 'three';
import { planAddition, singleParentChildren, type AddRelation } from '../lib/addRelative';
import { cam, flyToPoint, frame, orbitToShow, type CameraMove } from '../lib/camera';
import { demoFamily } from '../lib/demo';
import { parentsOf, partnersOf } from '../lib/graph';
import { newId } from '../lib/id';
import { exportTree, parseTree } from '../lib/io';
import { computeLayout } from '../lib/layout';
import type { Gender, Person, Relationship } from '../lib/types';
import { useFamily } from './family';
import { live } from './live';
import { useUI, type AddFlow } from './ui';

export type PersonDraft = { name: string; photo?: Blob; gender?: Gender; birthYear?: number; notes?: string };

export const FADE_MS = 400;

const ui = () => useUI.getState();
const family = () => useFamily.getState();

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const report = (e: unknown) => ui().showToast(errorText(e));

const currentView = (): CameraMove => ({
  kind: 'fly',
  position: cam.position.toArray(),
  target: cam.target.toArray(),
  duration: 1000,
});

// ---------- camera ----------

export function frameAll(front = false) {
  ui().moveCamera(frame([...live.values()], { front }));
}

function frameTree(people: Person[], relationships: Relationship[]) {
  ui().moveCamera(frame([...computeLayout(people, relationships).values()], { front: true }));
}

const isSmallScreen = () => window.matchMedia('(max-width: 640px)').matches;

export function flyToPerson(id: string) {
  ui().select(id);
  const p = live.get(id) ?? computeLayout(family().people, family().relationships).get(id);
  if (!p) return;
  // The side panel covers the right edge (desktop) or the lower ~60% (phone bottom sheet).
  const at = isSmallScreen() ? { x: 0, y: 0.5 } : { x: -360 / window.innerWidth, y: 0 };
  ui().moveCamera(flyToPoint(p, 18, at));
}

// ---------- selection / clicks ----------

export function clickPerson(id: string) {
  const { mode, select, setMode } = ui();
  if (mode.kind === 'add') return;
  if (mode.kind === 'connect') {
    if (!mode.a) setMode({ ...mode, a: id });
    else if (!mode.b && id !== mode.a) setMode({ ...mode, b: id });
    else setMode({ kind: 'connect', a: id, b: null });
    return;
  }
  select(id);
}

export function clickBackground() {
  if (ui().mode.kind === 'idle') ui().select(null);
}

export function cancelCurrent() {
  const { mode } = ui();
  if (mode.kind === 'add') cancelAdd();
  else if (mode.kind === 'connect') clearConnection();
  else ui().select(null);
}

// ---------- find connection ----------

export function startConnection() {
  ui().setMode({ kind: 'connect', a: ui().selectedId, b: null });
  ui().select(null);
}

export function setConnectionEnd(which: 'a' | 'b', id: string | null) {
  const { mode, setMode } = ui();
  if (mode.kind === 'connect') setMode({ ...mode, [which]: id });
}

export function clearConnection() {
  ui().setMode({ kind: 'idle' });
  frameAll();
}

// ---------- add relative ----------

const currentFlow = (): AddFlow | null => {
  const m = ui().mode;
  return m.kind === 'add' ? m : null;
};

export function startAdd(anchorId: string | null) {
  const flow: AddFlow = {
    kind: 'add',
    anchorId,
    relation: anchorId ? null : 'first',
    stage: 'pick',
    otherParent: null,
    placeholderId: null,
    coParentOf: [],
    newId: newId(),
    startedAt: 0,
    closingAt: null,
    returnTo: currentView(),
  };
  if (anchorId) ui().setMode(flow);
  else enterForm(flow);
}

export function chooseRelation(relation: AddRelation) {
  const flow = currentFlow();
  if (!flow?.anchorId) return;
  const { index } = family();
  const next = { ...flow, relation };
  if (relation === 'sibling' && parentsOf(index, flow.anchorId).length === 0) return ui().setMode({ ...next, stage: 'placeholder' });
  if (relation === 'partner') {
    const kids = singleParentChildren(index, flow.anchorId);
    if (kids.length) return ui().setMode({ ...next, stage: 'coParent', coParentOf: kids });
  }
  if (relation === 'child') {
    const partners = partnersOf(index, flow.anchorId);
    if (partners.length > 1) return ui().setMode({ ...next, stage: 'otherParent' });
    return enterForm({ ...next, otherParent: partners[0] ?? null });
  }
  enterForm(next);
}

export function answerPlaceholder(create: boolean) {
  const flow = currentFlow();
  if (!flow) return;
  if (create) enterForm({ ...flow, placeholderId: newId() });
  else cancelAdd();
}

export function chooseOtherParent(id: string | null) {
  const flow = currentFlow();
  if (flow) enterForm({ ...flow, otherParent: id });
}

export function chooseCoParentOf(childIds: string[]) {
  const flow = currentFlow();
  if (flow) enterForm({ ...flow, coParentOf: childIds });
}

function enterForm(flow: AddFlow) {
  const f: AddFlow = { ...flow, stage: 'form', startedAt: performance.now() };
  ui().setMode(f);
  const { people, relationships, index } = family();
  const plan = planAddition(index, f.anchorId, f.relation!, { id: f.newId, name: '' }, f);
  const layout = computeLayout([...people, ...plan.people], [...relationships, ...plan.relationships]);
  const spot = layout.get(f.newId)!;
  const anchor = f.anchorId ? layout.get(f.anchorId) : undefined;
  if (anchor) ui().moveCamera(orbitToShow(anchor, spot, { bottomSheet: isSmallScreen() }));
  else ui().moveCamera({ kind: 'fly', target: spot.toArray(), position: spot.clone().add(new Vector3(0, 1.5, 13)).toArray(), duration: 900 });
}

export async function saveAdd(draft: PersonDraft) {
  const flow = currentFlow();
  if (!flow?.relation) return;
  try {
    const person: Person = { id: flow.newId, ...draft };
    const plan = planAddition(family().index, flow.anchorId, flow.relation, person, flow);
    await family().add(plan.people, plan.relationships);
    ui().setMode({ kind: 'idle' });
    ui().select(person.id);
  } catch (e) {
    report(e);
  }
}

export function cancelAdd() {
  const flow = currentFlow();
  if (!flow) return;
  if (flow.stage !== 'form') {
    ui().setMode({ kind: 'idle' });
    return;
  }
  ui().setMode({ ...flow, stage: 'closing', closingAt: performance.now() });
  if (flow.returnTo) ui().moveCamera(flow.returnTo);
  setTimeout(() => {
    const m = ui().mode;
    if (m.kind === 'add' && m.newId === flow.newId) ui().setMode({ kind: 'idle' });
  }, FADE_MS);
}

// ---------- linking existing people ----------

export async function linkParent(childId: string, parentId: string) {
  try {
    await family().add([], [{ id: newId(), type: 'parent', parent: parentId, child: childId }]);
  } catch (e) {
    report(e);
  }
}

export function confirmUnlink(relId: string, message: string) {
  ui().setDialog({
    message,
    confirmLabel: 'Remove link',
    danger: true,
    onConfirm: async () => {
      try {
        await family().unlink(relId);
      } catch (e) {
        report(e);
      }
    },
  });
}

// ---------- edit / delete ----------

export async function savePerson(id: string, draft: PersonDraft) {
  const existing = family().byId.get(id);
  if (!existing) return;
  try {
    await family().update({ id, ...draft });
  } catch (e) {
    report(e);
  }
}

export function confirmDelete(id: string) {
  const person = family().byId.get(id);
  if (!person) return;
  ui().setDialog({
    message: `Delete ${person.name || 'this person'}? Their relationships will be removed too.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      try {
        await family().remove(id);
        const { mode, selectedId } = ui();
        if (selectedId === id) ui().select(null);
        if (mode.kind === 'connect' && (mode.a === id || mode.b === id)) ui().setMode({ kind: 'idle' });
      } catch (e) {
        report(e);
      }
    },
  });
}

// ---------- whole tree ----------

function replaceWith(people: Person[], relationships: Relationship[], message: string) {
  const run = async () => {
    try {
      await family().replaceAll(people, relationships);
      ui().setMode({ kind: 'idle' });
      ui().select(null);
      frameTree(people, relationships);
    } catch (e) {
      report(e);
    }
  };
  if (family().people.length === 0) void run();
  else ui().setDialog({ message, confirmLabel: 'Replace', danger: true, onConfirm: run });
}

export function clearTree() {
  const n = family().people.length;
  ui().setDialog({
    message: `Delete all ${n} ${n === 1 ? 'person' : 'people'} and start an empty tree? Export first if you want a backup.`,
    confirmLabel: 'Delete everything',
    danger: true,
    onConfirm: async () => {
      try {
        await family().replaceAll([], []);
        ui().setMode({ kind: 'idle' });
        ui().select(null);
        ui().moveCamera(frame([], { front: true }));
      } catch (e) {
        report(e);
      }
    },
  });
}

export function loadDemo() {
  const demo = demoFamily();
  replaceWith(demo.people, demo.relationships, 'Replace your current tree with the demo family?');
}

export async function importFile(file: File) {
  try {
    const tree = parseTree(await file.text());
    replaceWith(tree.people, tree.relationships, `Replace your current tree with “${file.name}” (${tree.people.length} people)?`);
  } catch (e) {
    report(e);
  }
}

export async function exportFile() {
  try {
    const { people, relationships } = family();
    const json = await exportTree(people, relationships);
    const filename = `legacy-family-tree-${new Date().toISOString().slice(0, 10)}.json`;
    const native = await import('../native');
    if (native.isNative()) return await native.saveFileNative(filename, json);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    // Closing the share sheet without picking a target isn't an error.
    if (!/cancel/i.test(errorText(e))) report(e);
  }
}

export async function initialLoad() {
  try {
    await family().load();
    const { people, relationships } = family();
    frameTree(people, relationships);
  } catch (e) {
    report(e);
  }
}
