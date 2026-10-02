# 3D Family Tree Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Local-only 3D family tree web app per the user spec and `docs/superpowers/specs/2026-10-02-family-tree-3d-design.md`.

**Architecture:** Pure TS libs (graph, relationship, layout) under test; zustand stores over Dexie; R3F scene reads stores and lerps to layout targets; a `CameraRig` consumes camera intents; UI overlays in React DOM with framer-motion.

**Tech Stack:** Vite, React 18, TypeScript, three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, zustand, dexie, framer-motion, vitest.

## Global Constraints
- Background #000000; panels #0a0a0a with blue borders; single accent #2F80FF.
- Connections dotted (dashed Line / QuadraticBezierLine), dashes animate.
- Photos resized to max 256x256 before storing; stored as Blob.
- No backend. No stored derived relations.
- 60fps at 200+ nodes: shared geometries/materials, texture cache by person id.
- Gates: `npm run build` and `npx vitest run` both clean.

---

## Phase 1 — Core libs (checkpoint after)

### Task 1: Scaffold
- [ ] Vite react-ts template; install deps; vitest config; folder structure; black global CSS. Build passes.

### Task 2: `src/lib/types.ts`, `src/lib/graph.ts`
**Produces:**
- `type Person`, `type Relationship` (spec verbatim), `type Step = { from: string; to: string; kind: 'parent'|'child'|'partner' }` (`kind` = what `to` is relative to `from`).
- `buildIndex(people, rels) => GraphIndex` with `parents(id)`, `children(id)`, `partners(id)`.
- `findPath(index, a, b) => Step[] | null` (BFS, undirected, direction remembered).
- `directRelatives(index, id)` → `{ parents, children, partners, siblings }`.
- Tests: path a→a empty, unreachable null, shortest chosen, direction tags correct.

### Task 3: `src/lib/relationship.ts`
**Produces:** `describe(path: Step[], index, people: Map) => { label: string; sentence: string; chain: string }`.
Tests (≥20): father, mother, son, daughter, grandfather, great-grandmother, grandson, brother, sister,
half-brother, uncle, aunt, great-uncle, nephew, niece, first cousin, second cousin, first cousin once
removed (both directions), second cousin once removed, husband/wife, father-in-law, mother-in-law,
brother-in-law (spouse's brother), sister-in-law (brother's wife), son-in-law, stepmother, step-son,
step-sister, self, unrelated → null, neutral gender fallback, chain text format.

### Task 4: `src/lib/layout.ts`
**Produces:** `computeLayout(people, rels) => Map<string, Vector3>`; `GEN_GAP = 4`.
Tests: older generation higher Y; partners same Y and adjacent X; child X centered under couple
midpoint; siblings' branches differ in Z when they have descendants; no two nodes coincide (200 random-ish nodes); disconnected components separated.

## Phase 2 — Data + basic scene (checkpoint after)

### Task 5: `src/lib/db.ts`, `src/lib/photo.ts`, `src/lib/io.ts`, `src/lib/demo.ts`, `src/store/family.ts`
- Dexie `people`, `relationships`. Store actions: `load`, `addPerson(person, rels)`, `updatePerson`, `deletePerson` (cascade), `replaceAll`.
- `resizePhoto(file) => Blob` (canvas, ≤256, jpeg). `exportJson`/`importJson` with base64 photos.
- Demo: 15 people, 4 generations, a remarriage, cousins. Test io roundtrip of non-photo fields.

### Task 6: Scene
- `Scene.tsx` (Canvas, black, OrbitControls damping, Bloom), `PersonNode.tsx` (Billboard ring + photo/initials disc + Text, lerp position, hover/selected states, opacity for dimming), `Connections.tsx` (partner dashed lines, parent-child Quadratic bezier from couple midpoint, animated dashOffset), shared `materials.ts`, `textures.ts` cache.

## Phase 3 — UI + flows (checkpoint after)

### Task 7: `src/store/ui.ts`, `CameraRig.tsx`, Toolbar, SearchBox, SidePanel (relatives, edit, delete-confirm), empty state.
### Task 8: Find Connection — picking, path highlight (dim 15%, pulse), camera framing, bottom panel, Clear.
### Task 9: Add Relative — type picker, sibling-placeholder and other-parent prompts, orbit spin, ghost node, line draw-in, Html form (bottom sheet on mobile), save scale-in, cancel fade.

## Phase 4 — Polish
### Task 10: Responsive CSS, import/export buttons, final `npm run build` + `npx vitest run`.
