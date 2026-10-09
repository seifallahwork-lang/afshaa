/** ⬇️ Download and 🚩 Report buttons shown under a meme. */
import { designText, type MemeDesign } from "@shared/design";
import type { MemeTemplate } from "@shared/templates";
import { useState } from "react";
import { DEVELOPER } from "../config/developer";
import { t } from "../i18n";
import { downloadMeme } from "../lib/exportMeme";
import { imageSrc } from "../lib/images";
import { Button } from "./ui";

export function DownloadButton({ template, design, name }: { template: MemeTemplate; design: MemeDesign; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="mini-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await downloadMeme(template, design, name);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
      title={failed ? t.downloadFail : t.download}
    >
      {busy ? "…" : failed ? "⚠️" : "⬇️"} {t.download}
    </button>
  );
}

/** Opens Gmail (or the mail app) with a pre-filled, editable report to the developer. */
export function ReportButton({
  template,
  design,
  code,
  round,
  reporter,
}: {
  template: MemeTemplate;
  design: MemeDesign;
  code: string;
  round: number;
  reporter: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const open = () => {
    const subject = t.reportSubject(code);
    const image = imageSrc(template.image).startsWith("http") ? imageSrc(template.image) : `${location.origin}${template.image}`;
    const body = t.reportBody({ code, round, text: designText(design), image, reporter });
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(DEVELOPER.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const win = window.open(gmail, "_blank", "noopener");
    if (!win) location.href = `mailto:${DEVELOPER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setConfirm(false);
  };
  return (
    <>
      <button type="button" className="mini-btn mini-btn-danger" onClick={() => setConfirm(true)}>
        🚩 {t.report}
      </button>
      {confirm && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setConfirm(false)}>
          <div className="sheet confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>🚩 {t.reportTitle}</h2>
            <p>{t.reportText}</p>
            <div className="row">
              <Button onClick={open}>{t.reportYes}</Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                {t.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
