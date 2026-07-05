interface Props {
  size?: number;
  className?: string;
}

/** Yellow loading circle shown in place of a whole section while its
 * data is still being fetched, rather than letting individual pieces
 * (rating, poster, episode title, ...) pop in one at a time. */
export function Spinner({ size = 32, className = '' }: Props) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-4 border-signal-500/25 border-t-signal-500 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
