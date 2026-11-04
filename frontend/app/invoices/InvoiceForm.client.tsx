"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CAlert, CButton, CForm, CFormInput, CFormSelect } from "@coreui/react";
import type { InvoiceDetails } from "@/lib/invoices/invoice-parser";
import { invoiceStatusLabels, isInvoiceLocked } from "@/lib/invoices/status";
import { ruleReasonLabel } from "@/lib/invoices/rule-reasons";
import { isAutoPayable } from "@/lib/invoices/payment-gate";
import { approveInvoice, createInvoice, updateInvoice, type InvoiceInput } from "./actions";
import AppDialog from "@/components/AppDialog.client";
import VendorForm from "@/app/vendors/VendorForm.client";
import PropertyForm from "@/app/properties/PropertyForm.client";
import InvoiceDocumentPreview from "./InvoiceDocumentPreview";
import PaymentConfirmation from "./PaymentConfirmation.client";
import InvoiceRecordActions from "./InvoiceRecordActions.client";
import DemoPayment from "./DemoPayment.client";
import type { PaymentView } from "./payment-actions";
import styles from "./invoice-form.module.scss";

type Option = { id: string; name: string };
type VendorOption = Option & { account_number: string | null };
type Fields = Omit<InvoiceInput, "date">;
type Evaluation = {
  outcome: string;
  reasons: string[];
  evaluated_amount: number;
  comparable_count: number;
  comparable_average: number | null;
  max_auto_approval_amount: number | null;
  max_above_average_percent: number | null;
  min_comparable_bills: number | null;
};

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

function mergeById<T extends Option>(base: T[], added: T[]) {
  return [...base, ...added.filter((item) => !base.some((b) => b.id === item.id))];
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

export function InvoiceFormClient({ vendors: vendorsProp, properties: propertiesProp, invoice, evaluation, document, paymentConfirmation, canViewHistory = false, demoPayment, returnHref = "/invoices" }: {
  vendors: VendorOption[];
  properties: Option[];
  invoice?: { id: string; fields: Fields };
  evaluation?: Evaluation | null;
  document?: { url?: string; mime?: string; name?: string; error?: string };
  paymentConfirmation?: string | null;
  canViewHistory?: boolean;
  demoPayment?: { enabled: boolean; attempt: PaymentView | null };
  returnHref?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(invoice?.fields ?? initialFields);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractingRef = useRef(false);
  const activeVisit = useRef(false);
  const formId = useId();
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [validated, setValidated] = useState(false);
  const [saving, startSaving] = useTransition();
  const [dialog, setDialog] = useState<"vendor" | "property" | "pay" | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [unmatched, setUnmatched] = useState<{ vendor?: string; property?: string }>({});
  const [addedVendors, setAddedVendors] = useState<VendorOption[]>([]);
  const [addedProperties, setAddedProperties] = useState<Option[]>([]);
  const vendors = mergeById(vendorsProp, addedVendors);
  const properties = mergeById(propertiesProp, addedProperties);
  const [notification, setNotification] = useState<{ color: "danger" | "info" | "success"; message: string } | null>(null);
  const accountNumber = vendors.find((vendor) => vendor.id === fields.vendorId)?.account_number ?? "";
  const payUrl = paymentLink(fields.paymentUrl);
  const locked = isInvoiceLocked(invoice?.fields.status);
  const isDirty = !!invoice && (["vendorId", "propertyId", "invoiceNumber", "amountDue", "dueDate", "paymentUrl"] as const).some((key) => fields[key] !== invoice.fields[key]);
  const paymentUnresolved = demoPayment?.attempt && ["starting", "running", "uncertain"].includes(demoPayment.attempt.status);

  useLayoutEffect(() => {
    activeVisit.current = true;
    return () => { activeVisit.current = false; };
  }, []);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const setField =
    (key: Exclude<keyof Fields, "status">) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));

  function openDialog(kind: "vendor" | "property") {
    setDialogKey((key) => key + 1);
    setDialog(kind);
  }

  function resetNewInvoice() {
    setFields({ ...initialFields });
    setSelectedFile(null);
    setPreviewUrl("");
    setPreviewType("");
    setValidated(false);
    setNotification(null);
    setUnmatched({});
    setDialog(null);
    setAddedVendors([]);
    setAddedProperties([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePay() {
    if (!invoice) return;
    startSaving(async () => {
      try {
        if (await isAutoPayable({ id: invoice.id, vendorId: fields.vendorId })) {
          // TODO: auto-pay
          setNotification({ color: "info", message: "Auto-pay is not available yet." });
          return;
        }
        setDialog("pay");
      } catch (error) {
        setNotification({ color: "danger", message: error instanceof Error ? error.message : "Could not start payment." });
      }
    });
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setPreviewType(file?.type ?? "");
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setNotification(null);
    if (file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))) void extractDetails(file);
  }

  async function saveNewInvoice(details: Omit<InvoiceInput, "status">, file?: File | null) {
    let attachment: { path: string; name: string } | undefined;
    if (file) {
      const upload = new FormData();
      upload.append("file", file);
      const response = await fetch("/api/invoices/document", { method: "POST", body: upload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not upload invoice document.");
      attachment = { path: result.path, name: result.name };
    }
    const result = await createInvoice(details, attachment);
    // Next.js can retain this form's state when navigating back to /new.
    // Reset after success, before either creation path navigates away.
    if (!("error" in result) && activeVisit.current) resetNewInvoice();
    return result;
  }

  async function extractDetails(file: File) {
    if (extractingRef.current) return;
    if (file.size > 4 * 1024 * 1024) {
      setNotification({ color: "danger", message: "Choose a PDF smaller than 4 MB for extraction." });
      return;
    }
    extractingRef.current = true;
    setExtracting(true);
    setNotification(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/invoices/extract", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as { details?: InvoiceDetails; error?: string };
      if (!activeVisit.current) return;
      if (!response.ok || !result.details) {
        throw new Error(result.error ?? "Could not extract invoice details.");
      }

      const details = result.details;
      const vendor = uniqueMatch(vendors, details.vendorName);
      const property = uniqueMatch(properties, details.propertyName);
      setUnmatched({
        vendor: !vendor && details.vendorName ? details.vendorName : undefined,
        property: !property && details.propertyName ? details.propertyName : undefined,
      });
      setFields((prev) => ({
        ...prev,
        vendorId: vendor?.id ?? "",
        propertyId: property?.id ?? "",
        invoiceNumber: details.invoiceNumber ?? "",
        amountDue: details.amountDue ?? "",
        dueDate: details.dueDate ?? "",
        paymentUrl: details.paymentUrl ?? "",
      }));
      if (vendor && property && details.invoiceNumber && details.amountDue && details.dueDate) {
        const saved = await saveNewInvoice({
          date: localDate(),
          vendorId: vendor.id,
          propertyId: property.id,
          invoiceNumber: details.invoiceNumber,
          amountDue: details.amountDue,
          dueDate: details.dueDate,
          paymentUrl: details.paymentUrl ?? "",
        }, file);
        if (!activeVisit.current) return;
        if ("error" in saved) throw new Error(saved.error);
        router.push(`/invoices/${saved.id}/edit`);
        return;
      }
      const problems = [
        !vendor && (details.vendorName ? `No unique vendor match for “${details.vendorName}”.` : "Vendor not found in the PDF."),
        !property && (details.propertyName ? `No unique property match for “${details.propertyName}”.` : "Property not found in the PDF."),
      ].filter(Boolean);
      setNotification({
        color: "info",
        message: `Details extracted, but automatic intake needs correction. ${problems.join(" ")} Complete the missing fields and save.`.replace(/\s+/g, " "),
      });
    } catch (error) {
      if (!activeVisit.current) return;
      setNotification({
        color: "danger",
        message: error instanceof Error ? error.message : "Could not extract invoice details.",
      });
    } finally {
      if (activeVisit.current) {
        extractingRef.current = false;
        setExtracting(false);
      }
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
        const details = {
          vendorId: fields.vendorId,
          propertyId: fields.propertyId,
          invoiceNumber: fields.invoiceNumber,
          amountDue: fields.amountDue,
          dueDate: fields.dueDate,
          paymentUrl: fields.paymentUrl,
        };
        if (invoice) {
          const result = await updateInvoice(invoice.id, details);
          if (!activeVisit.current) return;
          if (result) { setNotification({ color: "danger", message: result.error }); return; }
          router.push(returnHref);
        } else {
          const result = await saveNewInvoice({ ...details, date: localDate() }, selectedFile);
          if (!activeVisit.current) return;
          if ("error" in result) { setNotification({ color: "danger", message: result.error }); return; }
          router.push(`/invoices/${result.id}/edit`);
        }
      } catch (error) {
        if (!activeVisit.current) return;
        setNotification({
          color: "danger",
          message: `Could not save invoice: ${error instanceof Error ? error.message : "Please try again."}`,
        });
      }
    });
  };

  return (
    <div className={styles.layout}>
      <InvoiceDocumentPreview
        url={invoice ? document?.url : previewUrl}
        mime={invoice ? document?.mime : previewType}
        name={invoice ? document?.name : selectedFile?.name}
        error={document?.error}
      >
        {!invoice ? <>
          <label className={`btn btn-outline-secondary ${styles.fileButton}`}>
            {selectedFile ? "Change file" : "Choose PDF or image"}
            <input ref={fileInputRef} className="visually-hidden" type="file"
              accept=".pdf,image/png,image/jpeg,image/webp,image/gif" disabled={extracting || saving}
              onChange={selectFile} aria-label="Choose invoice PDF or image" />
          </label>
          {selectedFile && /\.pdf$/i.test(selectedFile.name) && <CButton color="secondary" type="button" disabled={extracting || saving}
            onClick={() => void extractDetails(selectedFile)}>{extracting ? "Extracting and saving…" : "Retry PDF extraction"}</CButton>}
          <p className="small mb-0">PDFs are extracted automatically. Images are saved when you save the invoice.</p>
        </> : <button type="button" className="btn btn-outline-secondary" onClick={() => router.refresh()}>Refresh document</button>}
      </InvoiceDocumentPreview>

      <section className={styles.formPanel} aria-labelledby="invoice-form-heading">

      <CForm id={formId} noValidate validated={validated} autoComplete={invoice ? undefined : "off"} onSubmit={handleSave}>

      {invoice && locked && <CAlert color="info">This invoice is {invoiceStatusLabels[invoice.fields.status]}. Its details are locked after approval.</CAlert>}

      {(vendors.length === 0 || properties.length === 0) && (
        <CAlert color="warning">
          {vendors.length === 0 && properties.length === 0
            ? "Add a vendor and a property before saving an invoice."
            : vendors.length === 0
              ? "Add a vendor before saving an invoice."
              : "Add a property before saving an invoice."}
          {vendors.length === 0 && <button type="button" className="btn btn-link p-0 ms-2 align-baseline" onClick={() => openDialog("vendor")}>+ Add vendor</button>}
          {properties.length === 0 && <button type="button" className="btn btn-link p-0 ms-2 align-baseline" onClick={() => openDialog("property")}>+ Add property</button>}
        </CAlert>
      )}

      <fieldset disabled={locked} className="border-0 p-0 m-0">
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <CFormSelect id="vendorId" name="vendor_id" label="Vendor *" required disabled={vendors.length === 0} value={fields.vendorId} onChange={setField("vendorId")} feedbackInvalid="Choose a vendor.">
            <option value="" disabled>Choose a vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </CFormSelect>
          {!locked && !fields.vendorId && unmatched.vendor
            ? <p className={styles.fieldHint}>No match for “{unmatched.vendor}”. <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => openDialog("vendor")}>+ Add as new vendor</button></p>
            : !locked && <p className={styles.fieldHint}>Not listed? <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => openDialog("vendor")}>+ Add vendor</button></p>}
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
          {!locked && !fields.propertyId && unmatched.property
            ? <p className={styles.fieldHint}>No match for “{unmatched.property}”. <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => openDialog("property")}>+ Add as new property</button></p>
            : !locked && <p className={styles.fieldHint}>Not listed? <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => openDialog("property")}>+ Add property</button></p>}
        </div>
        <div className={styles.field}>
          <CFormInput type="text" id="accountNumber" label="Account number" value={accountNumber} placeholder="Set on vendor" readOnly />
          <p className={styles.fieldHint}>From the selected vendor.</p>
        </div>
        <div className={styles.field}>
          <CFormInput type="url" id="paymentUrl" name="payment_url" label="Payment URL (optional)" placeholder="https://example.com/invoice" value={fields.paymentUrl} onChange={setField("paymentUrl")} feedbackInvalid="Enter a valid URL." />
        </div>
        <div className={styles.field}>
          <CFormInput type="text" id="status" label="Status" value={invoice ? invoiceStatusLabels[fields.status] : "Set by approval rules on save"} readOnly />
        </div>
      </div>
      </fieldset>

      {evaluation && <div className="alert alert-light border mt-4 mb-0" role="status">
        <strong>{evaluation.outcome === "approved" ? "Initial rules: approved" : "Initial rules: needed approval"}</strong>
        {evaluation.reasons.length > 0 && <ul className="mb-0 mt-2">
          {evaluation.reasons.map((reason) => <li key={reason}>{ruleReasonLabel(reason)}</li>)}
        </ul>}
        <p className="small mb-0 mt-2">At intake: ${Number(evaluation.evaluated_amount).toFixed(2)}. Limit: {evaluation.max_auto_approval_amount === null ? "unset" : `$${Number(evaluation.max_auto_approval_amount).toFixed(2)}`}.</p>
        <p className="small mb-0">Comparable bills: {evaluation.comparable_count} (minimum {evaluation.min_comparable_bills ?? "unset"}). Average: {evaluation.comparable_average === null ? "—" : `$${Number(evaluation.comparable_average).toFixed(2)}`}. Allowed above average: {evaluation.max_above_average_percent === null ? "unset" : `${evaluation.max_above_average_percent}%`}.</p>
      </div>}

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
          {invoice && <InvoiceRecordActions id={invoice.id} name={invoice.fields.invoiceNumber} status={invoice.fields.status} canViewHistory={canViewHistory} />}
          {invoice && invoice.fields.status === "waiting on approval" &&
            <CButton color="success" size="sm" type="button" disabled={saving || isDirty} title={isDirty ? "Save your changes before approving" : undefined} onClick={() => startSaving(async () => {
              try {
                const result = await approveInvoice(invoice.id);
                if (result) setNotification({ color: "danger", message: result.error });
                else router.refresh();
              } catch (error) {
                setNotification({ color: "danger", message: error instanceof Error ? error.message : "Could not approve invoice." });
              }
            })}>Approve</CButton>}
          {invoice?.fields.status === "approved" && !paymentUnresolved && (payUrl ? (
            <CButton color="primary" size="sm" variant="outline" type="button" disabled={saving} onClick={handlePay}>Pay</CButton>
          ) : (
            <button type="button" disabled className="btn btn-sm btn-outline-primary" title="Enter a valid payment URL to enable Pay">Pay</button>
          ))}
        </div>
        <div className={styles.actionGroup}>
          <Link href={returnHref} className="btn btn-sm btn-outline-secondary">{invoice?.fields.status === "paid" ? "Back" : "Cancel"}</Link>
          {!locked && <CButton color="primary" size="sm" type="submit" form={formId} disabled={saving || extracting || vendors.length === 0 || properties.length === 0 || (invoice && !isDirty)}>
            {saving ? "Saving…" : invoice ? "Save changes" : "Save bill"}
          </CButton>}
        </div>
      </div>
      {invoice && (invoice.fields.status === "approved" || invoice.fields.status === "payment processing") && demoPayment && <DemoPayment
        key={demoPayment.attempt?.id ?? invoice.id}
        invoiceId={invoice.id} enabled={demoPayment.enabled} initialAttempt={demoPayment.attempt}
      />}
      {invoice && locked && invoice.fields.status !== "payment processing" && !paymentUnresolved && <PaymentConfirmation invoiceId={invoice.id} confirmation={paymentConfirmation ?? null} readOnly={invoice.fields.status === "paid"} />}
      </section>

      <AppDialog visible={dialog === "vendor"} onClose={() => setDialog(null)} title="Add vendor">
        <VendorForm key={dialogKey} defaultName={unmatched.vendor} onCancel={() => setDialog(null)}
          onSaved={(vendor) => {
            setAddedVendors((prev) => [...prev, vendor]);
            setFields((prev) => ({ ...prev, vendorId: vendor.id }));
            setUnmatched((prev) => ({ ...prev, vendor: undefined }));
            setDialog(null);
          }} />
      </AppDialog>
      <AppDialog visible={dialog === "property"} onClose={() => setDialog(null)} title="Add property">
        <PropertyForm key={dialogKey} defaultName={unmatched.property} onCancel={() => setDialog(null)}
          onSaved={(property) => {
            setAddedProperties((prev) => [...prev, property]);
            setFields((prev) => ({ ...prev, propertyId: property.id }));
            setUnmatched((prev) => ({ ...prev, property: undefined }));
            setDialog(null);
          }} />
      </AppDialog>
      {invoice && payUrl && <AppDialog visible={dialog === "pay"} onClose={() => setDialog(null)} title="Pay vendor">
        <ol className="ps-3 d-grid gap-4 mb-0">
          <li className="d-grid gap-2">
            <p className="mb-0">Open the vendor&apos;s payment page and complete payment.</p>
            <div><a href={payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary">Open vendor payment page</a></div>
          </li>
          <li className="d-grid gap-2">
            <p className="mb-0">Come back here and enter the confirmation number.</p>
            <PaymentConfirmation invoiceId={invoice.id} confirmation={paymentConfirmation ?? null} variant="dialog" />
          </li>
        </ol>
      </AppDialog>}
    </div>
  );
}
