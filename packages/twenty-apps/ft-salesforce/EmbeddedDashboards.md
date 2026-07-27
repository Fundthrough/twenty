# Embedded Dashboards (FlowWidget)

How to embed a single Flow **dashboard app** inside a third‑party portal hosted on a
different domain, using the `FlowWidget` JavaScript bundle.

> **TL;DR** — The portal drops one `<script>` on its page and calls
> `window.FlowWidget.init(...)`. The widget mounts the dashboard directly into a
> host element, signs the user in with Google, and calls the Flow BFF cross‑origin.
> Making it work off‑domain requires three config steps: (1) enable **direct app
> access** on the dashboard, (2) add the portal origin to **Google Authorized
> JavaScript origins**, (3) add the portal origin to the **BFF CORS allowlist**.
> The portal must also relax its **CSP/COOP** headers (see
> [§7](#7-third-party-portal-requirements-cors--content-security-policy)).

## Contents

1. [How it works](#1-how-it-works)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 — Enable direct app access on the dashboard](#3-step-1--enable-direct-app-access-on-the-dashboard)
4. [Step 2 — Google OAuth configuration](#4-step-2--google-oauth-configuration)
5. [Step 3 — Flow BFF CORS allowlist](#5-step-3--flow-bff-cors-allowlist)
6. [Step 4 — Add the widget to the portal page](#6-step-4--add-the-widget-to-the-portal-page)
7. [Third‑party portal requirements: CORS & Content Security Policy](#7-third-party-portal-requirements-cors--content-security-policy)
8. [`init()` configuration reference](#8-init-configuration-reference)
9. [Dashboards & their arguments](#9-dashboards--their-arguments)
10. [Authentication & data scoping](#10-authentication--data-scoping)
11. [Adding embed support to a new dashboard](#11-adding-embed-support-to-a-new-dashboard)
12. [Troubleshooting](#12-troubleshooting)
13. [Security notes & limitations](#13-security-notes--limitations)
14. [Reference: source files](#14-reference-source-files)

---

## 1. How it works

- The Flow HITL frontend build produces a self‑contained IIFE bundle, **`bundle.js`**,
  served by the Flow host at `https://<flow-host>/bundle.js` (nginx has a dedicated
  `location = /bundle.js`). It is a separate, lean build from the main SPA — it
  contains only the dashboards framework (its own React), not the HITL app shell.
- The portal includes that script and calls `window.FlowWidget.init({...})`. The
  widget **mounts the dashboard directly into a host `<div>`** (it is *not* an
  iframe), so its JavaScript runs under the **portal's origin**.
- **Auth** is Google OAuth *in the widget*: if the viewer isn't signed in, the
  widget shows a Google sign‑in button; the Google credential is exchanged at
  `POST {apiBaseUrl}/auth/google` for a Flow JWT stored in `localStorage` (scoped
  to the portal origin). Dashboard data is then fetched cross‑origin from the BFF
  with an `Authorization: Bearer <jwt>` header.
- **Styling** is Tailwind compiled with every rule scoped under `.flow-widget-root`
  (added to the host element) and injected as a single `<style>` at runtime, so the
  widget's CSS neither leaks into nor is broken by the host page's base styles.

Because the widget runs in the portal's page (cross‑origin to both the Flow host
and the BFF), the browser enforces **CORS** on the BFF calls and the portal's
**CSP** on the Google scripts and BFF connections — hence the config steps below.

---

## 2. Prerequisites

- The dashboard you want to embed must:
  - have the **"direct app access"** capability enabled (see Step 1), and
  - implement an **`InitApp`** if it should preselect an entity from
    `dashboardArguments` (e.g. a specific company). Dashboards without an `InitApp`
    render their default/search view. See [§9](#9-dashboards--their-arguments) and
    [§11](#11-adding-embed-support-to-a-new-dashboard).
- The viewer must be a **provisioned Flow HITL user** (role `admin`, `hitl_admin`,
  or `hitl_user`) signing in with a Google account Flow recognizes. The portal's
  own customers cannot sign in — see [§10](#10-authentication--data-scoping).
- You need admin access to: the **Flow admin UI** (to toggle direct app access),
  the **Google Cloud Console** OAuth client, and the **Flow deployment config**
  (or the Variables admin UI) to set the CORS allowlist.

---

## 3. Step 1 — Enable direct app access on the dashboard

The widget only renders dashboards that are flagged for direct app access and that
the signed‑in user may access. It validates the requested `dashboardId` against
`GET /hitl/dashboard-components/standalone` (which returns only
`direct_app_enabled = true` rows the user can see).

In the Flow **admin UI → HITL → Dashboard Apps**, edit the dashboard component and:

1. Enable **Direct app access**. This also requires a **direct app path** starting
   with `/apps/` (e.g. `/apps/company-profile`). The widget does not use the path
   itself, but the toggle requires it.
2. Set **Access control** so the intended users qualify (`all`, or `roles`/`users`
   scoped to specific HITL roles/users). `admin`/`hitl_admin` always have access.

> The underlying row lives in the `dashboard_components` table
> (`direct_app_enabled`, `direct_app_path`, `access_control`).

---

## 4. Step 2 — Google OAuth configuration

The widget uses Google Identity Services, which validates the **origin of the host
page** against the OAuth client's allowlist. In **Google Cloud Console → APIs &
Services → Credentials → your OAuth 2.0 Client ID**:

1. **Authorized JavaScript origins** — add each portal origin, e.g.
   `https://portal.example.com`. Rules:
   - Exact origin: scheme + host (+ port). **HTTPS required** (except `http://localhost`).
   - **No wildcards** — every embedding domain must be listed explicitly.
   - No path, no trailing slash.
2. **Authorized redirect URIs** — **not required**. The widget uses the Google
   credential (ID‑token) button flow, not the auth‑code redirect flow.
3. **Client ID must match the BFF.** The `googleClientId` the widget uses must equal
   the BFF's `GOOGLE_CLIENT_ID`, because the BFF verifies the ID token's `audience`
   against it. (The embedding domain does **not** affect token verification — only
   the origin handshake and CORS.)

Notes:
- The widget uses the explicit **sign‑in button popup** (One Tap is disabled), which
  is the most robust option across browsers that block third‑party cookies.
- If the portal sets a `Cross-Origin-Opener-Policy`, it must allow popups — see
  [§7](#7-third-party-portal-requirements-cors--content-security-policy).

---

## 5. Step 3 — Flow BFF CORS allowlist

The widget makes cross‑origin requests to the BFF (`/auth/google` and the
`/dashboard/...` data routes) with an `Authorization` header, so the BFF must allow
the portal origin.

Set **`CORS_ALLOWED_ORIGINS`** — a comma‑separated list of exact origins:

```
CORS_ALLOWED_ORIGINS=https://portal.example.com,https://app.fundthrough.com
```

Two ways to set it (variables service takes precedence over the env var):

- **Variables service (no redeploy):** create/update a `string` variable with
  identifier `CORS_ALLOWED_ORIGINS` in the Flow admin **Variables** UI. Changes
  propagate within ~5 minutes (the BFF caches the value; the check itself is
  in‑memory per request, so this adds no per‑request DB load).
- **Environment variable:** set `CORS_ALLOWED_ORIGINS` in the BFF deployment env
  (used as the fallback when the variable is unset).

Behavior:
- When set, only listed origins are allowed (the BFF reflects the matching origin);
  all others are rejected by the browser.
- When **unset** (e.g. local dev), the BFF reflects any origin — do **not** rely on
  this in production.
- The BFF already permits the `Authorization`, `Content-Type`, `X-User-Action*`, and
  `X-API-Key` request headers. Auth is a bearer token (not cookies), so cookies are
  not sent cross‑origin.
- **`bundle.js` needs no CORS** — a `<script src>` loads cross‑origin without CORS
  headers.

---

## 6. Step 4 — Add the widget to the portal page

```html
<!-- Host element the dashboard mounts into -->
<div id="myWidget"></div>

<!-- Load the bundle from the Flow host -->
<script src="https://<flow-host>/bundle.js"></script>
<script>
  window.FlowWidget.init({
    targetElementId: 'myWidget',
    dashboardId: 'company_profile',
    dashboardArguments: { companyId: 32241 },     // dashboard-specific (see §9)
    apiBaseUrl: 'https://<bff-host>',             // Flow BFF origin
    googleClientId: '<same-as-BFF-GOOGLE_CLIENT_ID>',
  });
</script>
```

- `googleClientId` may instead be provided via
  `<meta name="google-client-id" content="...">` in the page `<head>`.
- The stylesheet is injected automatically by `bundle.js`; **no separate
  `<link>` is required.**
- A runnable sample lives in the repo at
  [`apps/hitl-frontend/public/widget.html`](../apps/hitl-frontend/public/widget.html)
  (served at `https://<flow-host>/widget.html`).

---

## 7. Third‑party portal requirements: CORS & Content Security Policy

These are things the **portal** must configure on **its own** pages/headers.

### 7.1 CORS (portal side)

The portal itself does not need to *serve* any CORS headers for the widget — the
cross‑origin calls go **from** the widget **to** the Flow BFF, so CORS is enforced
on the **BFF** (Step 3), not on the portal. The only portal‑side networking concern
is CSP `connect-src` (below), which must permit those cross‑origin calls.

### 7.2 Content Security Policy (portal side)

If the portal sends a `Content-Security-Policy`, it must allow the widget to load
Google's sign‑in script, open the Google popup, call the BFF, render user avatars,
and inject its stylesheet. Add these sources (merge with the portal's existing
policy — do not replace it):

| Directive | Must allow | Why |
|-----------|-----------|-----|
| `script-src` | `https://<flow-host>` and `https://accounts.google.com/gsi/client` | load `bundle.js` and Google Identity Services |
| `connect-src` | `https://<bff-host>` and `https://accounts.google.com` | BFF data/auth calls; Google token endpoints |
| `frame-src` (or `child-src`) | `https://accounts.google.com` | the Google sign‑in popup/iframe |
| `img-src` | `https://*.googleusercontent.com` `data:` | Google user avatars; inline images |
| `style-src` | `'unsafe-inline'` | the widget injects a `<style>` element at runtime, and Google's button uses inline styles |
| `font-src` | `data:` (and `https://fonts.gstatic.com` if the portal wants Inter) | icon/embedded fonts |

Example header (adapt to the portal's existing policy):

```
Content-Security-Policy:
  script-src 'self' https://<flow-host> https://accounts.google.com/gsi/client;
  connect-src 'self' https://<bff-host> https://accounts.google.com;
  frame-src https://accounts.google.com;
  img-src 'self' data: https://*.googleusercontent.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
```

> **`style-src 'unsafe-inline'` is required.** The bundle injects its compiled CSS as
> an inline `<style>`. If the portal cannot allow inline styles, contact the Flow
> team — the widget can be built to emit a separate `bundle.css` `<link>` instead.

### 7.3 Cross‑Origin‑Opener‑Policy (COOP)

The Google sign‑in **popup** posts the credential back to the opener window. If the
portal sets COOP, it **must** use:

```
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

`Cross-Origin-Opener-Policy: same-origin` **breaks Google sign‑in** (the popup can't
message the portal page).

### 7.4 Cross‑Origin‑Embedder‑Policy (COEP)

Avoid `Cross-Origin-Embedder-Policy: require-corp` on the embedding page — it blocks
the cross‑origin `bundle.js` and Google resources unless every one of them sends
matching CORP/CORS headers. If COEP is mandatory in the portal, engage the Flow team.

---

## 8. `init()` configuration reference

`window.FlowWidget.init(config)` where `config` is:

| Field | Required | Description |
|-------|----------|-------------|
| `targetElementId` | ✅ | Id of the host element the dashboard mounts into. |
| `dashboardId` | ✅ | The dashboard's `dashboardUiId` (e.g. `company_profile`, `portfolio_management`). |
| `dashboardArguments` | — | Object passed to the dashboard's `InitApp` as URL query params (e.g. `{ companyId: 32241 }`). See [§9](#9-dashboards--their-arguments). |
| `googleClientId` | — | Google OAuth client id. Resolution order: this arg → `<meta name="google-client-id">` → the value baked into the bundle at build time. Must match the BFF `GOOGLE_CLIENT_ID`. |
| `apiBaseUrl` | — | Flow BFF origin. Falls back to the build‑time `VITE_BFF_API_URL`. Set explicitly for cross‑origin portals. |
| `tokenKey` | — | `localStorage` key for the JWT (default `task_agent_auth_token`). |

Behavior notes:
- Calling `init` again on the same element **re‑renders** (it does not double‑mount).
- A 401 from the BFF drops the widget back to the sign‑in view **in place** — it does
  **not** redirect the host page.

---

## 9. Dashboards & their arguments

`dashboardArguments` are forwarded to the dashboard's static `InitApp` as URL query
parameters; the dashboard resolves them and opens on the corresponding detail view.
A dashboard **without** an `InitApp` ignores `dashboardArguments` and renders its
default/search view.

| `dashboardId` | Argument(s) | Notes |
|---------------|-------------|-------|
| `company_profile` | `companyId` (alias `clientId`) | FundThrough company id; resolved to `{id,name,uuid}` and opens that company's detail view. |
| `portfolio_management` | `clientId` | Client/company id; opens that client's portfolio detail view. |
| *(others)* | — | Render their default view unless an `InitApp` is added ([§11](#11-adding-embed-support-to-a-new-dashboard)). |

> The `companyId`/`clientId` must be the **FundThrough company id** (numeric). If the
> portal only has a different identifier, a resolver must be added.

---

## 10. Authentication & data scoping

- **Who can sign in:** only provisioned Flow HITL users (`admin`, `hitl_admin`,
  `hitl_user`). The sign‑in exchanges a Google credential at `POST /auth/google`
  (`appContext: 'hitl'`) for a Flow JWT. The portal's own end customers cannot
  authenticate.
- **Session storage:** the JWT is stored in `localStorage` under the **portal's
  origin**, so each embedding domain has its own independent session.
- **Data scoping:** dashboard data is **not** scoped to a specific customer — any
  signed‑in HITL user can query any client/company. This is acceptable for internal
  users embedded in an internal‑facing portal. **Do not** expose the widget to a
  portal's own customers as‑is (see [§13](#13-security-notes--limitations)).

---

## 11. Adding embed support to a new dashboard

To let a dashboard preselect its entity from `dashboardArguments` (as
`company_profile` and `portfolio_management` do):

1. **Add a static `InitApp`** to the dashboard component (in
   `packages/dashboards-ui/src/dashboards/<Name>/`). It receives
   `{ queryParams, payloadStorageKey }`, reads its argument(s) from `queryParams`,
   fetches what it needs, and writes the result to `localStorage` under
   `payloadStorageKey`:

   ```ts
   MyDashboard.InitApp = async ({ queryParams, payloadStorageKey }) => {
     const id = queryParams.get('someId');
     if (!id) { localStorage.setItem(payloadStorageKey, JSON.stringify({})); return; }
     const result = await fetchApi(`/dashboard/.../${encodeURIComponent(id)}`);
     if (!result.success || !result.data) throw new Error(result.error?.message);
     localStorage.setItem(payloadStorageKey, JSON.stringify({ /* selected entity */ }));
   };
   ```

2. **Consume the payload** in the component with precedence
   `standalonePayload > pinnedState > defaults` (initialize its selected‑entity /
   view state from `standalonePayload`).

3. **Add a by‑id BFF route** if one doesn't exist, returning exactly what the
   component needs (e.g. `GET /dashboard/company-profile/companies/:companyId` →
   `{ id, name, uuid }`). Register it in `packages/dashboards-bff-routes`.

4. Enable **direct app access** on the dashboard (Step 1) and document its argument
   in [§9](#9-dashboards--their-arguments).

See `CompanyProfileDashboard.InitApp` and `PortfolioManagementDashboard.InitApp` for
worked examples.

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Google button doesn't render / `idpiframe_initialization_failed`, "origin is not allowed" | Portal origin missing from **Authorized JavaScript origins** (Step 2), or origin isn't HTTPS. |
| Sign‑in popup opens then nothing happens | Portal sets `COOP: same-origin`; use `same-origin-allow-popups` ([§7.3](#73-crossorigin-openerpolicy-coop)). |
| Data calls fail with a CORS error in the console | Portal origin missing from **`CORS_ALLOWED_ORIGINS`** (Step 3), or the widget's `apiBaseUrl` points at the wrong host. |
| Google script / BFF call blocked by CSP | Add the sources in [§7.2](#72-content-security-policy-portal-side) to the portal's CSP. |
| Widget renders unstyled | Portal CSP forbids inline styles; add `style-src 'unsafe-inline'`. |
| "Dashboard not available" panel | Dashboard not flagged **direct app access**, or the signed‑in user lacks access (Step 1). |
| `bundle.js` returns HTML / 404 | Not served at `/<flow-host>/bundle.js`; confirm the widget build ran and nginx serves it. |
| Client/company id doesn't select anything | Wrong argument key or a non‑company identifier; see [§9](#9-dashboards--their-arguments). |

---

## 13. Security notes & limitations

- **Internal‑user auth only.** There is no per‑customer data scoping — any signed‑in
  HITL user can query any client. Making this safe for a portal's *own customers*
  requires a **signed embed token** flow (portal backend mints a short‑lived,
  scoped token) plus per‑customer authorization on the BFF — not yet implemented.
- **Production CORS** must use an explicit `CORS_ALLOWED_ORIGINS` allowlist; never
  ship with it unset (which reflects any origin).
- **Styling isolation is scoped, not sandboxed.** The widget's CSS is scoped under
  `.flow-widget-root`, but extremely aggressive host resets (e.g. global `!important`
  rules) can still bleed in. If strict isolation is required, an iframe/Shadow‑DOM
  variant would be needed.
- **Bundle size.** One bundle serves any dashboard (it includes all direct‑app
  dashboards + its own React), ~180 KB gzipped. Per‑dashboard code splitting is a
  possible future optimization.

---

## 14. Reference: source files

| Concern | Path |
|---------|------|
| Widget entry (`window.FlowWidget.init`) | `apps/hitl-frontend/src/widget/index.tsx` |
| Widget app / auth gate / loader | `apps/hitl-frontend/src/widget/{FlowWidgetApp,WidgetLogin,WidgetDashboardLoader}.tsx` |
| Widget build (emits `dist/bundle.js`) | `apps/hitl-frontend/vite.widget.config.ts` (`npm run build:widget`) |
| Widget README | `apps/hitl-frontend/src/widget/README.md` |
| Sample embed page | `apps/hitl-frontend/public/widget.html` |
| nginx `/bundle.js` route | `configs/nginx/nginx.conf` |
| BFF CORS allowlist | `apps/bff/src/app.ts` (`CORS_ALLOWED_ORIGINS`) |
| Google token verification | `apps/bff/src/services/AuthService.ts` |
| Direct‑app gate endpoint | `apps/bff/src/routes/hitl/HITLDashboardRoutes.ts` (`/hitl/dashboard-components/standalone`) |
| Dashboard registry (id → component) | `packages/dashboards-ui/src/dashboards/registry.ts` |
| Example `InitApp`s | `packages/dashboards-ui/src/dashboards/{CompanyProfile,PortfolioManagement}/*.tsx` |
