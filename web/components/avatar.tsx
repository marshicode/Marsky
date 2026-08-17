type Size = "md" | "sm" | "mini";

const dims: Record<Size, string> = {
  md: "h-[34px] w-[34px] text-[13px]",
  sm: "h-[26px] w-[26px] text-[11px]",
  mini: "h-5 w-5 text-[9px]",
};

export function Avatar({
  initials,
  color = "#F97316",
  size = "md",
  you = false,
  className,
}: {
  initials: string;
  color?: string;
  size?: Size;
  /** Marks this avatar as the current user — gets the orange ring (DESIGN.md §6.2). */
  you?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white",
        "border-2 border-card",
        dims[size],
        you && "outline-2 outline-brand",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
