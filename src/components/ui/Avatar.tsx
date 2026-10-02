import { initialsOf, useObjectUrl } from './hooks';

export function Avatar({ photo, name, size = 40 }: { photo?: Blob; name: string; size?: number }) {
  const url = useObjectUrl(photo);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url ? <img src={url} alt="" /> : initialsOf(name)}
    </span>
  );
}
