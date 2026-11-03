import type { ReactNode } from "react";
import styles from "./invoice-form.module.scss";

export default function InvoiceDocumentPreview({ url, mime, name, children, error }: {
  url?: string; mime?: string; name?: string; children?: ReactNode; error?: string;
}) {
  return <section className={styles.previewPanel} aria-label="Invoice document">
    <div className={styles.previewHeader}><strong className={styles.fileName}>{name || "Invoice document"}</strong></div>
    <div className={styles.previewSurface}>
      {url ? mime?.startsWith("image/")
        // Signed and local blob URLs are rendered directly without image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className={styles.preview} style={{ objectFit: "contain" }} src={url} alt={name || "Invoice scan"} />
        : <object className={styles.preview} data={url} type="application/pdf" aria-label="Invoice PDF">
          <a href={url} target="_blank" rel="noreferrer">Open invoice document</a>
        </object>
        : <p className={styles.previewEmpty}>{error || "No invoice document attached."}</p>}
    </div>
    <div className={styles.previewFooter}>
      {url && <a href={url} target="_blank" rel="noreferrer">Open document in a new tab</a>}
      {children}
    </div>
  </section>;
}
