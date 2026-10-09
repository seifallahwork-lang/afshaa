import { useState } from "react";
import { DEVELOPER } from "../config/developer";
import { t } from "../i18n";

/** Small button at the bottom-left → card with the developer's contacts. */
export function DeveloperButton({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`dev-btn ${inline ? "dev-btn-inline" : ""}`} onClick={() => setOpen(true)}>
        👨‍💻 {t.meetDev}
      </button>
      {open && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t.meetDev} onClick={() => setOpen(false)}>
          <div className="sheet dev-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-x" aria-label={t.close} onClick={() => setOpen(false)}>
              ✕
            </button>
            <p className="dev-kicker">{t.meetDev}</p>
            <h2 className="dev-name">{DEVELOPER.name}</h2>
            <p className="dev-title" dir="ltr">
              {DEVELOPER.title}
            </p>
            <p className="dev-note">{DEVELOPER.note}</p>
            <div className="dev-links">
              <a className="btn btn-primary" href={DEVELOPER.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              <a className="btn btn-secondary" href={`mailto:${DEVELOPER.email}?subject=${encodeURIComponent("لعبة قفشة")}`}>
                ✉️ {t.devEmail}
              </a>
              {DEVELOPER.whatsapp && (
                <a
                  className="btn btn-whatsapp"
                  href={`https://wa.me/${DEVELOPER.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 {t.devWhatsapp}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
