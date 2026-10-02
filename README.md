# Family 3D

A 3D family tree that runs entirely in your browser. People are glowing blue rings in 3D space, connected by animated dotted lines. Data (including photos) is stored locally in IndexedDB — no backend.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build into dist/
```

To try it on a phone, run `npm run dev -- --host` and open the printed network URL.

## Features

- **3D tree** — generations on Y, couples side by side, children under their parents' midpoint, sibling branches fanned out in depth, the whole tree gently curved toward you. In-laws' families sit behind the person who married in. Orbit / zoom / pan with mouse or touch.
- **Find Connection** — pick two people (click nodes or search). Shortest path through parent/child/partner links, named with the common-ancestor method: *father*, *great-uncle*, *second cousin once removed*, *sister-in-law*, *step-son*, … The rest of the tree dims, the path lights up with a travelling pulse, and the camera frames it.
- **Add relative** — select a person → *Add relative* → Parent / Partner / Child / Sibling. The camera spins round, a ghost node appears where the new person will go, the connecting line draws itself, and the form slides in beside it (bottom sheet on phones). Asks for the other parent when someone has several partners, and offers a placeholder parent for siblings of someone with no parents.
- Side panel with details and direct relatives (click to fly there), edit, delete.
- Search, empty state, demo family (15 people, 4 generations, remarriage, cousins), JSON export / import with photos embedded as base64.

## Layout of the code

```
src/lib/            pure logic (unit tested)
  graph.ts          index, shortest path, siblings
  relationship.ts   relationship naming
  layout.ts         computeLayout(people, relationships) → Map<id, Vector3>
  addRelative.ts    what "add a sibling/child/…" creates
  db.ts io.ts photo.ts demo.ts camera.ts
src/store/          zustand stores (family data, UI mode), actions
src/components/scene/  three.js scene (nodes, lines, ghost, camera rig)
src/components/ui/     2D overlay (panels, forms, pickers)
```
