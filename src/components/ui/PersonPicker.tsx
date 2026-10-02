import { useId, useMemo, useState } from 'react';
import type { Person } from '../../lib/types';
import { useFamily } from '../../store/family';
import { Avatar } from './Avatar';

type Props = {
  value: string | null;
  onPick: (id: string) => void;
  placeholder: string;
  label?: string;
  className?: string;
  /** Restrict choices to these ids. */
  only?: Set<string>;
  autoFocus?: boolean;
};

export function matchPeople(people: Person[], query: string, limit = 8): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people.slice(0, limit);
  const starts = people.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
  const contains = people.filter((p) => !starts.includes(p) && p.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/** Searchable person dropdown. */
export function PersonPicker({ value, onPick, placeholder, label, className, only, autoFocus }: Props) {
  const allPeople = useFamily((s) => s.people);
  const byId = useFamily((s) => s.byId);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const people = useMemo(() => (only ? allPeople.filter((p) => only.has(p.id)) : allPeople), [allPeople, only]);
  const matches = useMemo(() => matchPeople(people, query), [people, query]);
  const selected = value ? byId.get(value) : undefined;

  const pick = (p: Person) => {
    onPick(p.id);
    setQuery('');
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className={`picker ${className ?? ''}`}>
      {label && <span className="picker-label">{label}</span>}
      <input
        value={open ? query : (selected?.name ?? '')}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, matches.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label ?? placeholder}
        autoFocus={autoFocus}
      />
      {open && matches.length > 0 && (
        <ul className="picker-list panel" id={listId} role="listbox">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <Avatar photo={p.photo} name={p.name} size={26} />
                <span>{p.name}</span>
                {p.birthYear && <small>{p.birthYear}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
