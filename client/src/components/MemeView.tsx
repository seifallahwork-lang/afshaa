/** Renders a template with a player's design (crop, text boxes, drawing, caption bar). */
import type { Crop, MemeDesign, Stroke, Strip, TextBox } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import type { CSSProperties, ReactNode, SyntheticEvent } from "react";
import { imageSrc } from "../lib/images";

/** If an image fails, retry once through Google's image CDN (Drive images only). */
export function imageFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const m = img.src.match(/\/api\/img\/([\w-]+)/) ?? img.src.match(/thumbnail\?id=([\w-]+)/);
  if (m && !img.dataset.retried) {
    img.dataset.retried = "1";
    img.removeAttribute("crossorigin"); // Google's CDN may not allow canvas use; showing the picture matters more
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

export function boxStyle(b: TextBox): CSSProperties {
  return {
    left: `${b.x}%`,
    top: `${b.y}%`,
    width: `${b.w}%`,
    height: `${b.h}%`,
    color: b.color,
    background: b.bg === "transparent" ? "transparent" : b.bg,
    borderRadius: b.rounded ? "0.7em" : 0,
    fontSize: `${b.size}cqi`,
    transform: b.rotate ? `rotate(${b.rotate}deg)` : undefined,
    ["--ol" as string]: b.color.toUpperCase() === "#000000" ? "#fff" : "#000",
  };
}

export const boxClass = (b: TextBox) => `tbox ${b.outline ? "is-outlined" : ""}`;

/** Stage + image styles for a crop window (keeps the right aspect ratio). */
export function cropStyles(crop: Crop | null | undefined): { stage?: CSSProperties; img?: CSSProperties } {
  if (!crop) return {};
  return {
    stage: { aspectRatio: `${crop.w * crop.ar} / ${crop.h}` },
    img: {
      position: "absolute",
      width: `${10000 / crop.w}%`,
      maxWidth: "none",
      left: `${(-crop.x * 100) / crop.w}%`,
      top: `${(-crop.y * 100) / crop.h}%`,
    },
  };
}

export function TemplateImage({ template, style, onLoad }: { template: MemeTemplate; style?: CSSProperties; onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void }) {
  return (
    <img
      src={imageSrc(template.image)}
      alt={template.name}
      draggable={false}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      decoding="async"
      style={style}
      onError={imageFallback}
      onLoad={onLoad}
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

export function StripBar({ strip, children }: { strip: Strip; children?: ReactNode }) {
  return (
    <div className="strip" style={{ color: strip.color, background: strip.bg }} dir="auto">
      {children ?? strip.text}
    </div>
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
  const crop = cropStyles(design?.crop);
  const strip = design?.strip;
  return (
    <figure className={`meme ${className}`}>
      {strip?.position === "top" && <StripBar strip={strip} />}
      <div className="meme-stage" style={crop.stage}>
        <TemplateImage template={template} style={crop.img} />
        {design && (
          <div className="meme-layer">
            <StrokesLayer strokes={design.strokes} />
            {design.boxes.map((b) => (
              <div key={b.id} className={boxClass(b)} style={boxStyle(b)} dir="auto">
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {strip?.position === "bottom" && <StripBar strip={strip} />}
    </figure>
  );
}
