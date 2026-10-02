import { create } from 'zustand';
import type { AddRelation } from '../lib/addRelative';
import type { CameraMove } from '../lib/camera';

export type AddFlow = {
  kind: 'add';
  anchorId: string | null;
  relation: AddRelation | null;
  /** pick type → optional question → form (spin, ghost, line, form) → closing (fade out) */
  stage: 'pick' | 'placeholder' | 'otherParent' | 'coParent' | 'form' | 'closing';
  otherParent: string | null;
  placeholderId: string | null;
  coParentOf: string[];
  newId: string;
  startedAt: number;
  closingAt: number | null;
  returnTo: CameraMove | null;
};

export type Mode =
  | { kind: 'idle' }
  | { kind: 'connect'; a: string | null; b: string | null }
  | AddFlow;

export type Dialog = { message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void };

type UIState = {
  mode: Mode;
  selectedId: string | null;
  hoveredId: string | null;
  cameraMove: (CameraMove & { seq: number }) | null;
  toast: string | null;
  dialog: Dialog | null;
  setMode: (mode: Mode) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  moveCamera: (move: CameraMove) => void;
  showToast: (msg: string | null) => void;
  setDialog: (dialog: Dialog | null) => void;
};

let seq = 0;

export const useUI = create<UIState>((set) => ({
  mode: { kind: 'idle' },
  selectedId: null,
  hoveredId: null,
  cameraMove: null,
  toast: null,
  dialog: null,
  setMode: (mode) => set({ mode }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  moveCamera: (move) => set({ cameraMove: { ...move, seq: ++seq } }),
  showToast: (toast) => set({ toast }),
  setDialog: (dialog) => set({ dialog }),
}));
