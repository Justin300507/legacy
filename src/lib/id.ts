let seq = 0;

// Sortable by creation order (Dexie returns rows by primary key, and layout tie-breaks use that order).
// Not crypto.randomUUID: it's unavailable on plain-http LAN origins such as testing on a phone.
export const newId = () =>
  Date.now().toString(36).padStart(9, '0') +
  (seq++ % 1679616).toString(36).padStart(4, '0') +
  Math.random().toString(36).slice(2, 6);
