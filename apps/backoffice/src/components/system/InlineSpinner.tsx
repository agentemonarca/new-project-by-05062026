/** Small indeterminate spinner for control buttons (Tailwind `animate-spin`). */
export default function InlineSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={`inline-block shrink-0 animate-spin text-current ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        fill="currentColor"
        className="opacity-90"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
