import type { SyntheticEvent } from "react";
import type { MemeTemplate } from "@shared/templates";
import { textLength } from "@shared/text";

/** If Google Drive's thumbnail link fails, retry once through Google's image CDN link. */
function driveFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const m = img.src.match(/drive\.google\.com\/thumbnail\?id=([\w-]+)/);
  if (m && !img.dataset.retried) {
    img.dataset.retried = "1";
    img.src = `https://lh3.googleusercontent.com/d/${m[1]}=w1200`;
  }
}

/** A meme template with the caption painted on it, classic white-with-outline style. */
export function MemeCard({
  template,
  caption,
  placeholder,
  className = "",
}: {
  template: MemeTemplate;
  caption?: string | null;
  placeholder?: string;
  className?: string;
}) {
  const text = caption?.trim() || "";
  const len = textLength(text || placeholder || "");
  const sizeClass = len > 100 ? "xs" : len > 60 ? "sm" : len > 30 ? "md" : "lg";
  const position = template.captionPosition ?? "bottom";
  return (
    <figure className={`meme ${className}`}>
      <img
        src={template.image}
        alt={template.name}
        draggable={false}
        referrerPolicy="no-referrer"
        decoding="async"
        onError={driveFallback}
      />
      {(text || placeholder) && (
        <figcaption className={`meme-caption pos-${position} size-${sizeClass} ${text ? "" : "is-placeholder"}`} dir="auto">
          {text || placeholder}
        </figcaption>
      )}
    </figure>
  );
}
