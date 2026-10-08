/** A small crawling bug. The motion stops with prefers-reduced-motion. */
export function BugVisual() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className="size-28 animate-[bug-crawl_3s_ease-in-out_infinite] text-primary sm:size-36"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    >
      <path d="M45 28 36 14M75 28l9-14" />
      <path d="M30 56 10 48M30 74 8 78M31 92 16 108" />
      <path d="M90 56l20-8M90 74l22 4M89 92l15 16" />
      <ellipse cx="60" cy="34" rx="16" ry="14" fill="var(--surface)" />
      <ellipse cx="60" cy="76" rx="32" ry="34" fill="var(--surface)" />
      <path d="M60 44v66" />
      <circle cx="53" cy="32" r="3" fill="currentColor" stroke="none" />
      <circle cx="67" cy="32" r="3" fill="currentColor" stroke="none" />
      <circle cx="46" cy="72" r="5" fill="currentColor" stroke="none" />
      <circle cx="74" cy="72" r="5" fill="currentColor" stroke="none" />
      <circle cx="50" cy="94" r="4" fill="currentColor" stroke="none" />
      <circle cx="70" cy="94" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
