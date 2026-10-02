import { useEffect, useReducer } from 'react';
import { MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';
import type { Person } from '../../lib/types';

type Entry = { blob: Blob; material: MeshBasicMaterial; ready: boolean };

/** One photo material per person, reused across re-renders and remounts. */
const cache = new Map<string, Entry>();
const loader = new TextureLoader();

function dispose(id: string) {
  const e = cache.get(id);
  if (!e) return;
  e.material.map?.dispose();
  e.material.dispose();
  cache.delete(id);
}

export function prunePhotoCache(keep: Set<string>) {
  for (const id of [...cache.keys()]) if (!keep.has(id)) dispose(id);
}

export function usePhotoMaterial(person: Person): MeshBasicMaterial | null {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const { id, photo } = person;

  useEffect(() => {
    if (!photo) {
      dispose(id);
      return;
    }
    if (cache.get(id)?.blob === photo) return;
    dispose(id);
    const entry: Entry = { blob: photo, material: new MeshBasicMaterial({ transparent: true, color: 0xc4c4c4 }), ready: false };
    cache.set(id, entry);
    const url = URL.createObjectURL(photo);
    loader.load(
      url,
      (tex) => {
        URL.revokeObjectURL(url);
        if (cache.get(id) !== entry) return tex.dispose();
        tex.colorSpace = SRGBColorSpace;
        entry.material.map = tex;
        entry.material.needsUpdate = true;
        entry.ready = true;
        rerender();
      },
      undefined,
      () => URL.revokeObjectURL(url),
    );
  }, [id, photo]);

  const e = cache.get(id);
  return photo && e?.blob === photo && e.ready ? e.material : null;
}
