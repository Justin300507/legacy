# 3D Family Tree — Design

Date: 2026-10-02. Source requirements: the user's full spec (pasted in session). This doc records the
design decisions layered on top of it; the user spec remains authoritative for visuals and features.

## Stack
Vite + React + TypeScript, three.js via @react-three/fiber + drei, @react-three/postprocessing (Bloom),
zustand, Dexie, framer-motion, vitest. No backend.

## Structure
```
src/
  components/scene/  Scene, PersonNode, Connections, GhostNode, CameraRig
  components/ui/     Toolbar, SearchBox, SidePanel, ConnectionPanel, AddRelativeForm, dialogs
  lib/               layout.ts, relationship.ts, graph.ts (BFS/path, derived relatives),
                     db.ts (Dexie), photo.ts (resize), io.ts (export/import), demo.ts (seed)
  store/             family.ts (data, persisted), ui.ts (selection/hover/mode/camera intents)
```

## Data
`Person` and `Relationship` exactly as in the user spec. Dexie tables `people`, `relationships`.
Derived relations (siblings, grandparents, cousins, in-laws) are computed in `lib/graph.ts`, never stored.
Delete person = delete person + all relationships referencing them (one transaction).

## Layout — `computeLayout(people, relationships) => Map<id, Vector3>`
- Generation: roots (no parents) get 0; BFS assigns child = parent+1, partners equalised to the max of the
  pair (iterate to fixpoint). Y = -generation * 4.
- Units: a person plus their partners form a family unit. Tree is laid out recursively: a unit's width =
  max(own width, sum of child-unit widths). Children centred under their parents' midpoint.
- Z: each child branch of a unit gets a Z offset on an arc (angle spread by branch index), accumulated
  down the tree, so sibling branches separate in depth.
- Disconnected components placed side by side on X.
- Pure function; components lerp current position toward target each frame.

## Relationship naming — `lib/relationship.ts`
- `findPath(a, b)` — BFS over undirected edges, each step tagged `parent | child | partner`.
- `describeRelationship(path, people)` — reduces step sequence:
  - Pure blood path `up^m down^n` → common-ancestor method: m=0 → descendant (child, grandchild,
    great-…), n=0 → ancestor, m=n=1 sibling, n=1 → aunt/uncle (great-…), m=1 → niece/nephew,
    else cousin degree = min(m,n)-1, removed = |m-n|.
  - Leading/trailing partner step: partner of blood relative → in-law/spouse variants
    (spouse, X-in-law for parent/child/sibling, otherwise "X's spouse"/"spouse's X").
  - `parent → partner` (not the other biological parent) → step-parent; `partner → child` where
    child isn't the person's own → step-child; step-sibling via parent→partner→child.
  - Gendered terms from `gender`; neutral fallback (parent/child/sibling/…).
- Also produces the chain text ("Justin → father Thomas → brother George → daughter Maria").
- ≥20 vitest cases.

## UI state and animated flows
`store/ui.ts` holds `mode`: `idle | connect-pick | connect-result | add-relative`, plus selection,
hover, and a `cameraIntent` (`{position, target, durationMs, orbit?}`) consumed by `CameraRig`, which
animates OrbitControls' camera/target with easing and disables user control while animating.
- Find connection: pick A, pick B (click or dropdown) → path → dim non-path to 15% opacity, path
  lines bright with a travelling pulse, camera frames path bounding sphere, bottom panel with text.
- Add relative: choose type → camera orbit (~1.5s, eased) to view target slot → ghost node at the
  slot computed by running `computeLayout` with a provisional person → dotted line draws 0→1 from
  anchor → drei `<Html>` form (bottom sheet on small screens). Sibling without parents prompts for a
  placeholder parent; child with multiple partners prompts for the other parent (or unknown).
  Save → persist, node scales in. Cancel → fade out, camera returns.

## Performance
Module-level shared geometries/materials; per-person texture cache keyed by id + photo identity;
photos resized to ≤256×256 before storing. Line dash animation via shared material dashOffset.

## Testing
vitest on pure libs: relationship (≥20), graph/path, layout invariants. Gates: `npm run build`,
`npx vitest run`.
