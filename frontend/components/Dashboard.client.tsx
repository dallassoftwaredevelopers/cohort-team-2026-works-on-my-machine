
"use client";

import Link from "next/link";

import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";

import {
  invoiceStatusLabels,
  isInvoiceStatus,
} from "@/lib/invoices/status";

type InvoiceRow = {
  id: string;
  reference_number: string;
  amount: number;
  due_date: string | null;
  status: string;
  vendor: { name: string } | null;
  property: { name: string } | null;
};

type DashboardStats = {
  needsReview: number;
  dueInSevenDays: number;
  dueTotal: number;
  awaitingApproval: number;
  paid: number;
};

type DashboardProps = {
  firstName: string;
  greeting: string;
  stats: DashboardStats;
  dueSoon: InvoiceRow[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function getStatusColor(status: string) {
  switch (status) {
    case "created":
    case "waiting on approval":
      return "warning" as const;
    case "approved":
      return "info" as const;
    case "paid":
      return "success" as const;
    default:
      return "secondary" as const;
  }
}

function getStatusLabel(status: string) {
  return isInvoiceStatus(status)
    ? invoiceStatusLabels[status]
    : status;
}

export default function Dashboard({
  firstName,
  greeting,
  stats,
  dueSoon,
}: DashboardProps) {
  const summaryCards = [
    {
      label: "Needs Review",
      value: stats.needsReview,
      colorClass: "text-warning",
      subtitle: "",
    },
    {
      label: "Due in 7 Days",
      value: stats.dueInSevenDays,
      colorClass: "text-body",
      subtitle: `${currency.format(stats.dueTotal)} total`,
    },
    {
      label: "Awaiting Approval",
      value: stats.awaitingApproval,
      colorClass: "text-info",
      subtitle: "",
    },
    {
      label: "Paid",
      value: stats.paid,
      colorClass: "text-success",
      subtitle: "",
    },
  ];

  return (
    <>
      {/* Personalized welcome header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-semibold mb-1">
            {greeting}, {firstName}!
          </h1>
          <p className="text-body-secondary mb-0">
            Here's what needs attention across your properties.
          </p>
        </div>

        <CButton color="primary" href="/invoices/new">
          Upload a Bill
        </CButton>
      </div>

      {/* Dashboard summary cards */}
      <CRow className="g-3 mb-4">
        {summaryCards.map((card) => (
          <CCol key={card.label} xs={12} sm={6} xl={3}>
            <CCard className="h-100 shadow-sm">
              <CCardBody>
                <p className="small text-body-secondary mb-2">
                  {card.label}
                </p>
                <div
                  className={`h3 fw-semibold mb-0 ${card.colorClass}`}
                >
                  {card.value}
                </div>
                {card.subtitle && (
                  <p className="small text-body-secondary mt-1 mb-0">
                    {card.subtitle}
                  </p>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Due Soon invoice table */}
      <CCard className="shadow-sm">
        <CCardHeader className="bg-body d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
          <h2 className="h6 fw-semibold mb-0">
            Due Soon
          </h2>
          <CButton
            color="link"
            href="/invoices"
            size="sm"
            className="text-decoration-none p-0"
          >
            View All Invoices
          </CButton>
        </CCardHeader>

        {dueSoon.length === 0 ? (
          <CCardBody>
            <p className="text-body-secondary mb-0">
              No unpaid invoices with due dates to display.
            </p>
          </CCardBody>
        ) : (
          <div className="table-responsive">
            <CTable hover align="middle" className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell scope="col" className="ps-3">
                    Vendor
                  </CTableHeaderCell>
                  <CTableHeaderCell scope="col">
                    Property
                  </CTableHeaderCell>
                  <CTableHeaderCell
                    scope="col"
                    className="text-end"
                  >
                    Amount
                  </CTableHeaderCell>
                  <CTableHeaderCell scope="col">
                    Due Date
                  </CTableHeaderCell>
                  <CTableHeaderCell scope="col">
                    Status
                  </CTableHeaderCell>
                </CTableRow>
              </CTableHead>

              <CTableBody>
                {dueSoon.map((invoice) => (
                  <CTableRow key={invoice.id}>
                    <CTableDataCell className="ps-3 fw-medium">
                      <Link
                        href={`/invoices/${invoice.id}/edit`}
                        className="text-body text-decoration-none"
                      >
                        {invoice.vendor?.name ?? "—"}
                      </Link>
                    </CTableDataCell>
                    <CTableDataCell>
                      {invoice.property?.name ?? "—"}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      {currency.format(Number(invoice.amount))}
                    </CTableDataCell>
                    <CTableDataCell>
                      {formatDate(invoice.due_date)}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatusColor(invoice.status)}>
                        {getStatusLabel(invoice.status)}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}
      </CCard>
    </>
  );
}
