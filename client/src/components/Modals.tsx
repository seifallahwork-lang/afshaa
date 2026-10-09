/** How-to-play sheet, QR code sheet, and a generic confirm sheet. */
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { Button } from "./ui";

export function Sheet({ onClose, children, className = "" }: { onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`sheet ${className}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-x" aria-label={t.close} onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function HowToPlayButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`pill-btn ${className}`} onClick={() => setOpen(true)}>
        ❓ {t.howToPlay}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} className="howto">
          <h2>{t.howToTitle}</h2>
          <ol className="howto-steps">
            {t.howToSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <Button className="btn-big" onClick={() => setOpen(false)}>
            {t.gotIt}
          </Button>
        </Sheet>
      )}
    </>
  );
}

export function QrButton({ link, code }: { link: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!open || src) return;
    QRCode.toDataURL(link, { width: 360, margin: 1, color: { dark: "#231942", light: "#FFFFFF" } }).then(setSrc, () => setSrc(null));
  }, [open, link, src]);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ▦ {t.qr}
      </Button>
      {open && (
        <Sheet onClose={() => setOpen(false)} className="qr-sheet">
          <h2>{t.qrTitle}</h2>
          {src ? <img className="qr-img" src={src} alt={link} width={300} height={300} /> : <p>{t.loading}</p>}
          <p className="qr-code" dir="ltr">
            {code}
          </p>
          <p className="hint qr-link" dir="ltr">
            {link}
          </p>
        </Sheet>
      )}
    </>
  );
}

export function ConfirmSheet({
  title,
  text,
  yes,
  onYes,
  onClose,
}: {
  title: string;
  text?: string;
  yes: string;
  onYes: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} className="confirm-sheet">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      <div className="row">
        <Button
          onClick={() => {
            onYes();
            onClose();
          }}
        >
          {yes}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </Sheet>
  );
}
