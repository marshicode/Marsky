export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="26" fill="#F97316" />
      <circle cx="32" cy="32" r="6.4" fill="#fff" />
      <ellipse
        cx="32"
        cy="32"
        rx="19"
        ry="8"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        transform="rotate(-24 32 32)"
      />
      <circle cx="48" cy="22" r="4.4" fill="#fff" />
    </svg>
  );
}
