"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CAlert, CButton, CForm, CFormInput, CFormSelect } from "@coreui/react";
import type { InvoiceDetails } from "@/lib/invoices/invoice-parser";
import { invoiceStatuses, invoiceStatusLabels, type InvoiceStatus } from "@/lib/invoices/status";
import { archiveInvoice, createInvoice, updateInvoice, type InvoiceInput } from "./actions";
import ArchiveButton from "@/components/ArchiveButton.client";
import styles from "./invoice-form.module.scss";

type Option = { id: string; name: string };
type VendorOption = Option & { account_number: string | null };
type Fields = Omit<InvoiceInput, "date">;

const initialFields: Fields = {
  vendorId: "",
  propertyId: "",
  invoiceNumber: "",
  amountDue: "",
  dueDate: "",
  paymentUrl: "",
  status: "created",
};

function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueMatch(options: Option[], name: string | null) {
  if (!name) return undefined;
  const matches = options.filter((option) => normalize(option.name) === normalize(name));
  return matches.length === 1 ? matches[0] : undefined;
}

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paymentLink(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function InvoiceFormClient({ vendors, properties, invoice }: {
  vendors: VendorOption[];
  properties: Option[];
  invoice?: { id: string; fields: Fields };
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(invoice?.fields ?? initialFields);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [validated, setValidated] = useState(false);
  const [saving, startSaving] = useTransition();
  const [notification, setNotification] = useState<{ color: "danger" | "info" | "success"; message: string } | null>(null);
  const accountNumber = vendors.find((vendor) => vendor.id === fields.vendorId)?.account_number ?? "";
  const payUrl = paymentLink(fields.paymentUrl);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const setField =
    (key: Exclude<keyof Fields, "status">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setPreviewType(file?.type ?? "");
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setNotification(null);
  }

  async function extractDetails() {
    if (!selectedFile || extracting) return;
    if (selectedFile.size > 4 * 1024 * 1024) {
      setNotification({ color: "danger", message: "Choose a PDF smaller than 4 MB for extraction." });
      return;
    }
    setExtracting(true);
    setNotification(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/invoices/extract", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as { details?: InvoiceDetails; error?: string };
      if (!response.ok || !result.details) {
        throw new Error(result.error ?? "Could not extract invoice details.");
      }

      const details = result.details;
      const vendor = uniqueMatch(vendors, details.vendorName);
      const property = uniqueMatch(properties, details.propertyName);
      setFields((prev) => ({
        ...prev,
        vendorId: vendor?.id ?? "",
        propertyId: property?.id ?? "",
        invoiceNumber: details.invoiceNumber ?? "",
        amountDue: details.amountDue ?? "",
        dueDate: details.dueDate ?? "",
        paymentUrl: details.paymentUrl ?? "",
      }));
      const problems = [
        !vendor && (details.vendorName ? `No unique vendor match for “${details.vendorName}”.` : "Vendor not found in the PDF."),
        !property && (details.propertyName ? `No unique property match for “${details.propertyName}”.` : "Property not found in the PDF."),
      ].filter(Boolean);
      setNotification({
        color: "info",
        message: `Details extracted. ${problems.join(" ")} Review every field before saving.`.replace(/\s+/g, " "),
      });
    } catch (error) {
      setNotification({
        color: "danger",
        message: error instanceof Error ? error.message : "Could not extract invoice details.",
      });
    } finally {
      setExtracting(false);
    }
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setValidated(true);
    setNotification(null);
    if (!e.currentTarget.checkValidity() || !fields.vendorId || !fields.propertyId) return;

    startSaving(async () => {
      try {
        const result = invoice
          ? await updateInvoice(invoice.id, fields)
          : await createInvoice({ ...fields, date: localDate() });
        if (result) {
          setNotification({ color: "danger", message: result.error });
        } else if (invoice) {
          router.push("/invoices");
        } else {
          setNotification({ color: "success", message: "Invoice saved." });
          setFields(initialFields);
          setSelectedFile(null);
          setPreviewUrl("");
          setPreviewType("");
          if (fileInputRef.current) fileInputRef.current.value = "";
          setValidated(false);
        }
      } catch (error) {
        setNotification({
          color: "danger",
          message: `Could not save invoice: ${error instanceof Error ? error.message : "Please try again."}`,
        });
      }
    });
  };

  return (
    <div className={`${styles.layout} ${invoice ? styles.layoutEdit : ""}`}>
      {!invoice && <section className={styles.previewPanel} aria-label="Invoice file preview">
        <div className={styles.previewHeader}>
          <strong className={styles.fileName}>{selectedFile?.name ?? "Invoice file"}</strong>
          <label className={`btn btn-outline-secondary ${styles.fileButton}`}>
            {selectedFile ? "Change file" : "Choose file"}
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".pdf,image/*"
              disabled={extracting}
              onChange={selectFile}
              aria-label="Choose invoice PDF or image"
            />
          </label>
        </div>
        <div className={styles.previewSurface}>
          {previewUrl ? (
            <object className={styles.preview} data={previewUrl} type={previewType} aria-label="Selected invoice preview">
              <a href={previewUrl} target="_blank" rel="noreferrer">Open invoice preview</a>
            </object>
          ) : (
            <div className={styles.previewEmpty}>
              <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                <path d="M14 2v5a1 1 0 0 0 1 1h5" />
              </svg>
              <p className="fw-semibold mb-1">Preview an invoice here</p>
              <p className="text-body-secondary mb-0">Choose a PDF or image to review while entering the details.</p>
            </div>
          )}
        </div>
        <div className={styles.previewFooter}>
          {selectedFile && (selectedFile.type === "application/pdf" || /\.pdf$/i.test(selectedFile.name)) && (
            <CButton color="secondary" type="button" disabled={extracting} onClick={() => void extractDetails()}>
              {extracting ? "Extracting…" : "Extract details from PDF"}
            </CButton>
          )}
          <p className="mb-0 small text-body-secondary">Preview only. The file is not saved with the invoice.</p>
        </div>
      </section>}

      <section className={styles.formPanel} aria-labelledby="invoice-form-heading">

      <CForm id={formId} noValidate validated={validated} onSubmit={handleSave}>

      {(vendors.length === 0 || properties.length === 0) && (
        <CAlert color="warning">
          {vendors.length === 0 && properties.length === 0
            ? "Add a vendor and a property before saving an invoice."
            : vendors.length === 0
              ? "Add a vendor before saving an invoice."
              : "Add a property before saving an invoice."}
        </CAlert>
      )}

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <CFormSelect id="vendorId" name="vendor_id" label="Vendor *" required disabled={vendors.length === 0} value={fields.vendorId} onChange={setField("vendorId")} feedbackInvalid="Choose a vendor.">
            <option value="" disabled>Choose a vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </CFormSelect>
        </div>
        <div className={styles.field}>
          <CFormInput type="text" id="invoiceNumber" label="Reference number *" placeholder="e.g. BILL-1001" required value={fields.invoiceNumber} onChange={setField("invoiceNumber")} feedbackInvalid="Reference number is required." />
        </div>
        <div className={styles.field}>
          <CFormInput type="number" id="amountDue" label="Amount *" step="0.01" min="0.01" placeholder="$0.00" required value={fields.amountDue} onChange={setField("amountDue")} feedbackInvalid="Enter an amount greater than 0." />
        </div>
        <div className={styles.field}>
          <CFormInput type="date" id="dueDate" label="Due date *" required value={fields.dueDate} onChange={setField("dueDate")} feedbackInvalid="Due date is required." />
        </div>
        <div className={styles.field}>
          <CFormSelect id="propertyId" name="property_id" label="Property *" required disabled={properties.length === 0} value={fields.propertyId} onChange={setField("propertyId")} feedbackInvalid="Choose a property.">
            <option value="" disabled>Choose a property</option>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </CFormSelect>
        </div>
        <div className={styles.field}>
          <CFormInput type="text" id="accountNumber" label="Account number" value={accountNumber} placeholder="Set on vendor" readOnly />
          <p className={styles.fieldHint}>From the selected vendor.</p>
        </div>
        <div className={styles.field}>
          <CFormInput type="url" id="paymentUrl" name="payment_url" label="Payment URL (optional)" placeholder="https://example.com/invoice" value={fields.paymentUrl} onChange={setField("paymentUrl")} feedbackInvalid="Enter a valid URL." />
        </div>
        <div className={styles.field}>
          <CFormSelect id="status" name="status" label="Status *" value={fields.status} onChange={(e) => setFields((prev) => ({ ...prev, status: e.target.value as InvoiceStatus }))}>
            {invoiceStatuses.map((status) => <option key={status} value={status}>{invoiceStatusLabels[status]}</option>)}
          </CFormSelect>
        </div>
      </div>

      {notification && (
        <CAlert
          className="mt-4 mb-0"
          color={notification.color}
          role={notification.color === "danger" ? "alert" : "status"}
          aria-live={notification.color === "danger" ? "assertive" : "polite"}
          dismissible
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </CAlert>
      )}
      </CForm>
      <div className={styles.actions}>
        <div className={styles.actionGroup}>
          {invoice && <Link href={`/events?type=invoice&id=${invoice.id}`} className="btn btn-outline-secondary">History</Link>}
          {invoice && <ArchiveButton action={archiveInvoice} id={invoice.id} name={invoice.fields.invoiceNumber} />}
          {payUrl ? (
            <a href={payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">Pay</a>
          ) : (
            <button type="button" disabled className="btn btn-outline-primary" title="Enter a valid payment URL to enable Pay">Pay</button>
          )}
        </div>
        <div className={styles.actionGroup}>
          <Link href="/invoices" className="btn btn-outline-secondary">Cancel</Link>
          <CButton color="primary" type="submit" form={formId} disabled={saving || extracting || vendors.length === 0 || properties.length === 0}>
            {saving ? "Saving…" : invoice ? "Save changes" : "Save bill"}
          </CButton>
        </div>
      </div>
      </section>
    </div>
  );
}
