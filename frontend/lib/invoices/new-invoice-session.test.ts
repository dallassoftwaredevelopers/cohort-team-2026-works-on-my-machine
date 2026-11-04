import assert from "node:assert/strict";
import test from "node:test";
import { Activity, act, createElement as element, useState } from "react";
import { JSDOM } from "jsdom";
import NewInvoiceSession from "../../app/invoices/new/NewInvoiceSession.client";

// Exercise React Activity itself: this is the cacheComponents hide/reveal
// lifecycle, rather than a test that merely unmounts the page manually.
type DraftProps = { onPending?: (deliver: () => void) => void };
function Draft({ onPending }: DraftProps) {
  const [draft, setDraft] = useState({ number: "", file: "", error: "" });
  return element("section", null,
    element("input", { name: "reference", value: draft.number, readOnly: true }),
    element("button", { "data-action": "duplicate", onClick: () => setDraft({ number: "BILL-1001", file: "invoice.pdf", error: "Duplicate invoice" }) }, "Upload duplicate"),
    element("button", { "data-action": "draft", onClick: () => setDraft({ number: "UNSAVED", file: "draft.pdf", error: "" }) }, "Enter draft"),
    element("button", { "data-action": "pending", onClick: () => onPending?.(() => setDraft({ number: "LATE-RESPONSE", file: "old.pdf", error: "Duplicate invoice" })) }, "Start upload"),
    draft.file && element("p", { "data-preview": true }, draft.file),
    draft.error && element("p", { role: "alert" }, draft.error),
  );
}

test("new invoice sessions reset retained drafts on leaving, including rejected uploads", async (t) => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  const { createRoot } = await import("react-dom/client");
  try {
    for (const scenario of ["duplicate", "draft"] as const) {
      await t.test(`${scenario} clears fields, preview and messages when Activity hides and reveals the page`, async () => {
        const host = dom.window.document.createElement("div");
        dom.window.document.body.append(host);
        const root = createRoot(host);
        const render = (mode: "visible" | "hidden") => root.render(element(Activity, { mode, children: element(NewInvoiceSession, { children: element(Draft) }) }));
        try {
          await act(() => render("visible"));
          await act(() => host.querySelector<HTMLButtonElement>(`[data-action="${scenario}"]`)!.click());
          assert.notEqual(host.querySelector<HTMLInputElement>("input")!.value, "");
          assert.ok(host.querySelector("[data-preview]"));
          if (scenario === "duplicate") assert.equal(host.querySelector('[role="alert"]')?.textContent, "Duplicate invoice");
          await act(() => render("hidden"));
          await act(() => render("visible"));
          assert.equal(host.querySelector<HTMLInputElement>("input")!.value, "");
          assert.equal(host.querySelector("[data-preview]"), null);
          assert.equal(host.querySelector('[role="alert"]'), null);
        } finally { await act(() => root.unmount()); host.remove(); }
      });
    }

    await t.test("rerendering the active session preserves values and the duplicate warning for correction", async () => {
      const host = dom.window.document.createElement("div");
      dom.window.document.body.append(host);
      const root = createRoot(host);
      const render = () => root.render(element(NewInvoiceSession, { children: element(Draft) }));
      try {
        await act(render);
        await act(() => host.querySelector<HTMLButtonElement>('[data-action="duplicate"]')!.click());
        // Server refreshes after creating a vendor/property must not erase intake.
        await act(render);
        assert.equal(host.querySelector<HTMLInputElement>("input")!.value, "BILL-1001");
        assert.equal(host.querySelector('[role="alert"]')?.textContent, "Duplicate invoice");
      } finally { await act(() => root.unmount()); host.remove(); }
    });

    await t.test("an edit form outside the new-invoice boundary retains its draft on hide/reveal", async () => {
      const host = dom.window.document.createElement("div");
      dom.window.document.body.append(host);
      const root = createRoot(host);
      const render = (mode: "visible" | "hidden") => root.render(element(Activity, { mode, children: element(Draft) }));
      try {
        await act(() => render("visible"));
        await act(() => host.querySelector<HTMLButtonElement>('[data-action="draft"]')!.click());
        await act(() => render("hidden"));
        await act(() => render("visible"));
        assert.equal(host.querySelector<HTMLInputElement>("input")!.value, "UNSAVED");
      } finally { await act(() => root.unmount()); host.remove(); }
    });

    await t.test("a delayed response from the previous visit cannot refill the new draft", async () => {
      const host = dom.window.document.createElement("div");
      dom.window.document.body.append(host);
      const root = createRoot(host);
      let deliver: (() => void) | undefined;
      const render = (mode: "visible" | "hidden") => root.render(element(Activity, {
        mode, children: element(NewInvoiceSession, { children: element<DraftProps>(Draft, { onPending: (callback) => { deliver = callback; } }) }),
      }));
      try {
        await act(() => render("visible"));
        await act(() => host.querySelector<HTMLButtonElement>('[data-action="pending"]')!.click());
        assert.ok(deliver);
        await act(() => render("hidden"));
        await act(() => render("visible"));
        await act(() => { deliver!(); });
        assert.equal(host.querySelector<HTMLInputElement>("input")!.value, "");
        assert.equal(host.querySelector('[role="alert"]'), null);
        assert.equal(host.querySelector("[data-preview]"), null);
      } finally { await act(() => root.unmount()); host.remove(); }
    });
  } finally {
    dom.window.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
