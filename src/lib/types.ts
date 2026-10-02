export type Gender = 'male' | 'female' | 'other';

export type Person = {
  id: string;
  name: string;
  photo?: Blob;
  gender?: Gender;
  birthYear?: number;
  /** ISO date YYYY-MM-DD; when set, birthYear is derived from it. */
  birthDate?: string;
  /** ISO date YYYY-MM-DD. */
  deathDate?: string;
  notes?: string;
};

export type Relationship =
  | { id: string; type: 'partner'; a: string; b: string; /** ISO date YYYY-MM-DD */ weddingDate?: string }
  | { id: string; type: 'parent'; parent: string; child: string };

/** One hop in a path: `kind` is what `to` is to `from`. */
export type StepKind = 'parent' | 'child' | 'partner';
export type Step = { from: string; to: string; kind: StepKind };

export type Vec3 = [number, number, number];
