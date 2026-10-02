import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { resizePhoto } from '../../lib/photo';
import type { Gender } from '../../lib/types';
import type { PersonDraft } from '../../store/actions';
import { useObjectUrl } from './hooks';

type Props = {
  title: string;
  initial?: PersonDraft;
  submitLabel?: string;
  showNotes?: boolean;
  onSubmit: (draft: PersonDraft) => Promise<void> | void;
  onCancel: () => void;
};

type PhotoProps = { value?: Blob; onChange: (b?: Blob) => void; busy: boolean; onBusy: (busy: boolean) => void };

function PhotoInput({ value, onChange, busy, onBusy }: PhotoProps) {
  const url = useObjectUrl(value);
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  const take = async (file?: File) => {
    if (!file) return;
    setError(undefined);
    onBusy(true);
    try {
      onChange(await resizePhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read image');
    } finally {
      onBusy(false);
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <div className="photo-input">
      <button
        type="button"
        className={`photo-drop${drag ? ' drag' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={drop}
        aria-label="Upload photo"
      >
        {url ? <img src={url} alt="" /> : <span>{busy ? '…' : 'Add photo'}</span>}
      </button>
      <div className="photo-hint">
        <span>Click or drop an image</span>
        {value && (
          <button type="button" className="link" onClick={() => onChange(undefined)}>
            Remove
          </button>
        )}
        {error && <span className="error">{error}</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function PersonForm({ title, initial, submitLabel = 'Save', showNotes, onSubmit, onCancel }: Props) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [photo, setPhoto] = useState(initial?.photo);
  const [birthYear, setBirthYear] = useState(initial?.birthYear?.toString() ?? '');
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const year = birthYear.trim() ? Number(birthYear) : undefined;
  const yearInvalid = year !== undefined && (!Number.isInteger(year) || year < 1 || year > 3000);
  const valid = name.trim().length > 0 && !yearInvalid && !photoBusy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        photo,
        birthYear: year,
        gender: gender || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="person-form" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <h3>{title}</h3>
      <PhotoInput value={photo} onChange={setPhoto} busy={photoBusy} onBusy={setPhotoBusy} />
      <label htmlFor={`${id}-name`}>Name</label>
      <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus maxLength={80} />
      <div className="row">
        <div>
          <label htmlFor={`${id}-year`}>Birth year</label>
          <input id={`${id}-year`} inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="Optional" aria-invalid={yearInvalid} />
        </div>
        <div>
          <label htmlFor={`${id}-gender`}>Gender</label>
          <select id={`${id}-gender`} value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      {showNotes && (
        <>
          <label htmlFor={`${id}-notes`}>Notes</label>
          <textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </>
      )}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!valid || saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
