import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { enforceAuthentication } from "../../utils/supabase/middleware";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../proxy";

test("anonymous pages redirect to login with their full local destination", () => {
  for (const path of ["/", "/users", "/invoices/new", "/vendors/new", "/properties", "/rules", "/events?type=invoice&id=example&page=2", "/not-a-real-page"]) {
    const response = enforceAuthentication(new NextRequest(`https://app.example${path}`), false, NextResponse.next());
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get("location")!);
    assert.equal(destination.origin, "https://app.example");
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("next"), path);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("only login and password recovery are public pages", () => {
  for (const path of ["/login?next=/users", "/reset-password?code=recovery"]) {
    const original = NextResponse.next();
    assert.equal(enforceAuthentication(new NextRequest(`https://app.example${path}`), false, original), original);
  }
  for (const path of ["/login-extra", "/reset-password-extra", "/login/private"]) {
    assert.equal(enforceAuthentication(new NextRequest(`https://app.example${path}`), false, NextResponse.next()).status, 307);
  }
});

test("unauthenticated APIs return 401 JSON and expired action POSTs redirect with GET", async () => {
  const response = enforceAuthentication(new NextRequest("https://app.example/api/invoices/document", { method: "POST" }), false, NextResponse.next());
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("location"), null);
  assert.deepEqual(await response.json(), { error: "Sign in to continue." });
  const page = enforceAuthentication(new NextRequest("https://app.example/invoices/new", { method: "POST" }), false, NextResponse.next());
  assert.equal(page.status, 303);
});

test("auth cookie updates survive redirects and API rejection", () => {
  for (const path of ["/invoices", "/api/events/search"]) {
    const original = NextResponse.next();
    original.cookies.set("auth-token", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax" });
    const response = enforceAuthentication(new NextRequest(`https://app.example${path}`), false, original);
    assert.deepEqual(response.cookies.getAll(), original.cookies.getAll());
  }
});

test("authenticated requests pass through unchanged", () => {
  for (const path of ["/", "/rules", "/api/invoices/extract"]) {
    const original = NextResponse.next();
    assert.equal(enforceAuthentication(new NextRequest(`https://app.example${path}`), true, original), original);
  }
});

test("only SDK-managed workflow paths bypass the application login proxy", () => {
  for (const path of ["/.well-known/workflow/v1/flow", "/.well-known/workflow/v1/webhook/test-token"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://app.example${path}` }), false);
  }
  for (const path of ["/", "/invoices", "/api/invoices/document", "/.well-known/workflow-evil", "/.well-known/private"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://app.example${path}` }), true);
  }
});
