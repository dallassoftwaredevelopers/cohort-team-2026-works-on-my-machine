"use client";

import { useEffect, useId, useState } from "react";

export type FilterType = "invoice" | "vendor" | "property" | "actor";
export type FilterOption = { id: string; label: string };
export type FilterOptions = Record<FilterType, FilterOption[]>;

const labels: Record<FilterType, string> = {
  invoice: "Invoice",
  vendor: "Vendor",
  property: "Property",
  actor: "Actions by user",
};

export default function FilterForm({ initialLabel = "", initialType, initialId }: {
  initialLabel?: string;
  initialType: FilterType | "";
  initialId: string;
}) {
  const [type, setType] = useState<FilterType | "">(initialType);
  const [id, setId] = useState(initialId);
  const [query, setQuery] = useState(initialLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const searchKey = `${type}:${query.trim()}`;
  const [result, setResult] = useState<{ key: string; options: FilterOption[]; error?: string }>();
  const searchable = Boolean(type) && !id && query.trim().length >= 2;
  const options = result?.key === searchKey ? result.options : [];
  const error = result?.key === searchKey ? result.error : undefined;
  const loading = searchable && result?.key !== searchKey;

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, q: query.trim() });
        const response = await fetch(`/api/events/search?${params}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not search records.");
        if (!controller.signal.aborted) setResult({ key: searchKey, options: body.options });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: searchKey, options: [], error: error instanceof Error ? error.message : "Could not search records." });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [type, query, searchable, searchKey]);

  function choose(option: FilterOption) {
    setId(option.id);
    setQuery(option.label);
    setOpen(false);
    setActive(-1);
  }

  return (
    <form action="/events" onSubmit={(event) => { if (type && !id) event.preventDefault(); }} className="card card-body d-flex flex-column flex-md-row align-items-md-end gap-3 mb-4">
      <label className="form-label mb-0 flex-fill">Show
        <select name="type" className="form-select mt-1" value={type} onChange={(event) => {
          setType(event.target.value as FilterType | "");
          setId("");
          setQuery("");
          setOpen(false);
          setActive(-1);
        }}>
          <option value="">All activity</option>
          {(Object.keys(labels) as FilterType[]).map((value) => (
            <option key={value} value={value}>{labels[value]}</option>
          ))}
        </select>
      </label>
      <div className="flex-fill position-relative">
        <label htmlFor={`${listId}-input`} className="form-label mb-0">Record or user</label>
        <input id={`${listId}-input`} type="search" role="combobox" autoComplete="off" className="form-control mt-1"
          value={query} disabled={!type} maxLength={100} aria-expanded={open && searchable} aria-controls={listId}
          aria-autocomplete="list" aria-activedescendant={open && active >= 0 && options[active] ? `${listId}-${active}` : undefined}
          placeholder={!type ? "Choose a filter first" : type === "invoice" ? "Search by vendor name…" : "Search by name…"}
          onFocus={() => { if (!id) setOpen(true); }} onBlur={() => setOpen(false)}
          onChange={(event) => { setQuery(event.target.value); setId(""); setActive(-1); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setOpen(true);
              setActive((index) => event.key === "ArrowDown" ? Math.min(index + 1, options.length - 1) : Math.max(index - 1, 0));
            } else if (event.key === "Enter" && !id) {
              event.preventDefault();
              if (open && options[active]) choose(options[active]);
            } else if (event.key === "Escape") setOpen(false);
          }} />
        <input type="hidden" name="id" value={id} />
        {open && searchable && <div className="position-absolute start-0 end-0 bg-body border rounded shadow-sm z-3" style={{ maxHeight: "18rem", overflowY: "auto" }}>
          <ul id={listId} role="listbox" aria-label="Matching records" className="list-unstyled mb-0">
            {options.map((option, index) => <li key={option.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
              className={`px-3 py-2 ${active === index ? "bg-primary text-white" : ""}`} style={{ cursor: "pointer" }}
              onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.label}</li>)}
          </ul>
          <div role="status" className="small text-body-secondary px-3 py-2">
            {loading ? "Searching…" : error ?? (options.length === 0 ? "No matches found." : options.length === 20 ? "Showing 20 matches. Keep typing to narrow the search." : `${options.length} matches.`)}
          </div>
        </div>}
      </div>
      <button type="submit" className="btn btn-primary" disabled={Boolean(type) && !id}>Apply filter</button>
    </form>
  );
}
