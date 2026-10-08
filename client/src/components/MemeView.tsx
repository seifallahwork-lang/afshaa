/** Renders a template with a player's design (text boxes + drawing) on top. */
import type { MemeDesign, Stroke, TextBox } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import type { ReactNode, SyntheticEvent } from "react";

/** If Google Drive's thumbnail link fails, retry once through Google's image CDN link. */
export function driveFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const m = img.src.match(/drive\.google\.com\/thumbnail\?id=([\w-]+)/);
  if (m && !img.dataset.retried) {
    img.dataset.retried = "1";
    img.src = `https://lh3.googleusercontent.com/d/${m[1]}=w1200`;
  }
}

export const STROKE_PX = [0, 3, 6, 11];

export function strokePath(s: Stroke): string {
  const p = s.points;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += ` L${p[i]} ${p[i + 1]}`;
  return d;
}

export function boxStyle(b: TextBox): React.CSSProperties {
  return {
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w}%`,
    height: `${b.h}%`,
    color: b.color,
    background: b.bg === "transparent" ? "transparent" : b.bg,
    borderRadius: b.rounded ? "0.7em" : 0,
    fontSize: `${b.size}cqi`,
  };
}

export function TemplateImage({ template }: { template: MemeTemplate }) {
  return (
    <img
      src={template.image}
      alt={template.name}
      draggable={false}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={driveFallback}
    />
  );
}

export function StrokesLayer({ strokes, children }: { strokes: Stroke[]; children?: ReactNode }) {
  return (
    <svg className="strokes" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {strokes.map((s, i) => (
        <path
          key={i}
          d={strokePath(s)}
          fill="none"
          stroke={s.color}
          strokeWidth={STROKE_PX[s.width] ?? 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {children}
    </svg>
  );
}

export function MemeView({
  template,
  design,
  className = "",
}: {
  template: MemeTemplate;
  design: MemeDesign | null;
  className?: string;
}) {
  return (
    <figure className={`meme ${className}`}>
      <TemplateImage template={template} />
      {design && (
        <div className="meme-layer">
          <StrokesLayer strokes={design.strokes} />
          {design.boxes.map((b) => (
            <div key={b.id} className={`tbox ${b.bg === "transparent" ? "is-outlined" : ""}`} style={boxStyle(b)} dir="auto">
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
