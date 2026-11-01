"use client";

import { useState } from "react";

export type FilterType = "invoice" | "vendor" | "property" | "actor";
export type FilterOption = { id: string; label: string };
export type FilterOptions = Record<FilterType, FilterOption[]>;

const labels: Record<FilterType, string> = {
  invoice: "Invoice",
  vendor: "Vendor",
  property: "Property",
  actor: "Actions by user",
};

export default function FilterForm({ options, initialType, initialId }: {
  options: FilterOptions;
  initialType: FilterType | "";
  initialId: string;
}) {
  const [type, setType] = useState<FilterType | "">(initialType);
  const [id, setId] = useState(initialId);

  return (
    <form action="/events" className="card card-body d-flex flex-column flex-md-row align-items-md-end gap-3 mb-4">
      <label className="form-label mb-0 flex-fill">Show
        <select name="type" className="form-select mt-1" value={type} onChange={(event) => {
          setType(event.target.value as FilterType | "");
          setId("");
        }}>
          <option value="">All activity</option>
          {(Object.keys(labels) as FilterType[]).map((value) => (
            <option key={value} value={value}>{labels[value]}</option>
          ))}
        </select>
      </label>
      <label className="form-label mb-0 flex-fill">Record or user
        <select name="id" className="form-select mt-1" value={id} onChange={(event) => setId(event.target.value)} disabled={!type} required={Boolean(type)}>
          <option value="">{type ? `Choose ${labels[type].toLowerCase()}` : "Choose a filter first"}</option>
          {type && options[type].map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-primary">Apply filter</button>
    </form>
  );
}
