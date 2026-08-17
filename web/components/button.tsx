import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-bold " +
  "transition-all active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_6px_16px_rgba(249,115,22,.35)] hover:bg-brand-dark",
  ghost:
    "border-[1.5px] border-line bg-card text-ink hover:border-brand hover:text-brand-dark dark:hover:text-brand-light",
};

const sizes: Record<Size, string> = {
  md: "px-[18px] py-[10px] text-[15px]",
  sm: "px-3 py-1.5 text-[13px]",
};

type Props = {
  variant?: Variant;
  size?: Size;
  href?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "children">;

export function Button({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  ...rest
}: Props) {
  const classes = [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
