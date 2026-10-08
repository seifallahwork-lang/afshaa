import type { MemeTemplate } from "@shared/templates";
import { textLength } from "@shared/text";

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
      <img src={template.image} alt={template.name} draggable={false} />
      {(text || placeholder) && (
        <figcaption className={`meme-caption pos-${position} size-${sizeClass} ${text ? "" : "is-placeholder"}`} dir="auto">
          {text || placeholder}
        </figcaption>
      )}
    </figure>
  );
}
