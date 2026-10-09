/** Small reusable building blocks. */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { t } from "../i18n";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  busy = false,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? t.loading : children}
    </button>
  );
}

/** The wordmark: a hand-painted sign with a tuk-tuk fringe. */
export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div className={`logo logo-${size}`} aria-label={t.gameName}>
      <span className="logo-word">{t.gameName}</span>
    </div>
  );
}

/** Decorative tent-fabric band (khayamiya-inspired). */
export function Fringe() {
  return <div className="fringe" aria-hidden="true" />;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

/** Segmented choice (rounds, timers). */
export function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
  format = String,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <span className="segmented-label">{label}</span>
      <div className="segmented-options">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            className={o === value ? "on" : ""}
            disabled={disabled}
            onClick={() => onChange(o)}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
