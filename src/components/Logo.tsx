interface Props {
  className?: string;
}

/** The app's "logo": a simple TV-screen-and-stand outline (matching
 * public/favicon.svg) with the letters "TV" inside, in the signal
 * yellow accent color. Colors are hardcoded to the current theme
 * value rather than `currentColor`/CSS vars, matching how the
 * standalone favicon.svg has to be authored (it can't reference this
 * app's CSS). */
export function Logo({ className = 'h-7 w-7' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="14" y="20" width="36" height="24" rx="3" fill="none" stroke="#facc15" strokeWidth="4" />
      <rect x="26" y="46" width="12" height="3" rx="1.5" fill="#facc15" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="800"
        fontSize="15"
        fill="#facc15"
      >
        TV
      </text>
    </svg>
  );
}
