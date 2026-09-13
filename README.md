# Clinic Stock Console

An Inventory system for a clinic
supplies team that helps the manage their stocks to ensure it is always upto date.

## Getting started

```bash
npm install
npm run dev
```

The app talks directly to `https://dummyjson.com` from the browser — no server-side API key or env
file is required. Sign in with any DummyJSON test user, e.g. `emilys` / `emilyspass`.

```bash
npm run lint          # ESLint
npm run format:check  # Prettier check
npm test              # Vitest unit tests
npm run build          # production build
```

## Components and screen structure

- **`/login`** — `LoginForm` (react-hook-form + Zod, plain `register`/`errors` — no form-wrapper abstraction).
- **`/stock`** — `FiltersBar` (search / category / sort), `StockTable` (real `<table>` at ≥640px, stacked
  card list below), `PaginationControls`.
- **`/items/[id]`** — `ItemDetail` (image, description, price, stock), `StockCorrectionDialog`
  (native `<dialog>` element + form).
- **Shared across all three data screens** — `LoadingState`, `EmptyState`, `ErrorState`. No screen
  invents its own loading/error treatment.
- **`components/ui/*`** — five small, dependency-free Tailwind components: `Button`, `Input`,
  `Select` (native `<select>`), `Skeleton`, `Dialog` (native `<dialog>` element), plus a `toast.tsx`
  context for save confirmations. No shadcn/Radix — see the note below on why.

### Why no shadcn/ui or Radix

The app originally used shadcn/ui's Radix-based primitives. They were replaced with plain Tailwind
components on native HTML elements, because for an app this size the Radix layer (plus the
`Form`/`FormField`/`FormItem` context machinery shadcn adds to make it composable with
react-hook-form) added more indirection than it saved:

- **`Dialog`** → native `<dialog>` + `showModal()`/`close()`. The browser already gives you
  focus-trapping, `Esc`-to-close, and focus-return-to-trigger — no dependency needed.
- **`Select`** → native `<select>`. Correct keyboard/screen-reader behaviour out of the box, and
  simpler to read than a hand-rolled listbox.
- **Forms** → react-hook-form's plain `register()`/`formState.errors`, used directly in each form
  component instead of through a generic `Form`/`FormField` context wrapper. This is the single
  biggest boilerplate cut: compare `login-form.tsx` in this version to a shadcn-`Form`-wrapped
  version and it's roughly half the code for the same validation behaviour.
- **Toasts** → a ~30-line custom `ToastProvider`/`useToast` (state array + `setTimeout` dismiss)
  instead of `sonner`.

TanStack Query, Zod, and react-hook-form were kept: they're solving real problems specific to this
brief (request cancellation/caching, schema validation, form state) rather than providing styled UI,
so cutting them would mean re-implementing the same logic by hand with more risk, not less code.

## Where state lives, and why

| State                                                  | Bucket                                                | Why                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product list, product detail, categories, current user | **TanStack Query cache**                              | Server-owned data; never mirrored into `useState`, so there's one source of truth and automatic request de-duplication/cancellation.                                                                            |
| `q`, `category`, `sortBy`, `order`, `page`             | **URL (`useSearchParams` / `router.push`)**           | Must survive reload and be shareable over chat. `lib/url-state.ts` holds all the parsing/serializing/patching logic as pure functions — the page component reads/writes the URL, it never owns a parallel copy. |
| Open item id                                           | **Its own route**, `/items/[id]`                      | Required by the brief; see decision log for the trade-off this implies for "back to list".                                                                                                                      |
| Search input's in-progress keystrokes                  | **Local `useState`** (`FiltersBar`'s `searchDraft`)   | Debounced ~350ms before being pushed to the URL, so we're not rewriting history on every keystroke. This is UI state, not application state — it's fully derived from and reconciled back into the URL.         |
| Dialog open/closed, form field focus                   | **Local `useState` / react-hook-form internal state** | Scoped entirely to the component that owns it.                                                                                                                                                                  |

## Fetching, caching, invalidation (TanStack Query)

- Query key for the list is the **entire params object**: `['products', { q, category, sortBy, order, page }]`.
  Changing any filter produces a new key, which is what makes the race-condition guarantee work for
  free — React Query cancels/ignores a superseded in-flight request automatically. This is verified
  explicitly in `tests/search-race.test.ts` and manually against `?delay=2000` / `?delay=0`.
- `placeholderData: keepPreviousData` on the list query keeps the previous page's rows visible
  (dimmed via `isFetching`) while a new page/filter loads, instead of flashing a full skeleton.
- `staleTime: Infinity` (and `gcTime: Infinity`) on both the product list and the single-product
  query, `Infinity` on `/auth/me` (only invalidated by an explicit logout or a fresh login), 5 minutes
  on categories (rarely changes). See "Why the product queries never auto-refetch" below — this isn't
  the React Query default and is load-bearing for stock corrections not reverting.
- Stock correction uses `onMutate`/`onError`/`onSuccess` for an optimistic update with rollback (see
  Phase 4 decision below).

### DummyJSON endpoint limitation

DummyJSON does not support combining search + category + sort in one call. `buildProductsUrl` in
`lib/queries/products.ts` resolves this by priority: a non-empty `q` always hits
`/products/search`, otherwise a non-empty `category` hits `/products/category/{slug}`, otherwise the
plain `/products` list. Sort params are appended on top of whichever base endpoint was chosen (all
three support `sortBy`/`order`). Because the two filters can't compose anyway, the UI clears whichever
one you're not currently using — setting a search term clears the selected category and vice versa
(`app/stock/page.tsx`, `updateParams`) — rather than silently accepting a combination the API would
ignore.

## Accessibility

- All interactive controls are native `<button>`/`<input>`/Radix primitives — reachable and operable
  by keyboard alone; Radix's `Dialog` returns focus to its trigger on close and closes on `Esc` for
  free.
- Visible focus rings: a single `:focus-visible` outline declared once in `app/globals.css`,
  applied consistently everywhere rather than per-component.
- Every form field uses `Label` + `Input` pairing (via the `Form`/`FormField` wrapper), never
  placeholder-as-label.
- Async status changes (login errors, stock-save success/failure) surface either via `role="alert"`
  inline messages or `sonner` toasts, not silently.
- `LoadingState` renders `role="status" aria-live="polite"` with a visually-hidden label, so screen
  reader users get an announcement instead of silence.

## Responsiveness

Verified at 360px width specifically: `StockTable` renders a real `<table>` at `sm:` and up, and a
stacked `Card` list below it — a squeezed table is not usable at that width, so this is a distinct
layout, not a CSS shrink.

## DummyJSON limitations and workarounds

- **`PUT /products/{id}` doesn't persist server-side.** The optimistic cache update
  (`useCorrectStock` in `lib/queries/products.ts`) stands in as the "real" outcome for the session —
  the UI behaves exactly as if the save persisted, for as long as the tab stays open.

### Why the product queries never auto-refetch

Because writes don't persist server-side, any background refetch of `['product', id]` or
`['products', ...]` after a correction will always re-serve the _original_ value — the mock server
has no idea a PUT ever happened. React Query's defaults (`staleTime: 0`, `refetchOnMount: true`)
fire exactly that kind of "harmless" background refetch the moment a query remounts with data older
than its staleTime — e.g. navigating from the item detail page back to `/stock` and back again, or
just leaving a list page open past its staleTime. The symptom was a stock correction silently
reverting to its pre-correction value a few seconds after being saved, with no error and no visible
network activity, reported as "goes back to the initial value... when refreshed."

The fix: `useProduct` and `useProducts` both use `staleTime: Infinity, gcTime: Infinity`. Once a
query has data, nothing refetches it automatically for the rest of the tab's life; the cache _is_
the source of truth, updated only by an explicit mutation or by `ErrorState`'s "Try again" button
(a genuine, user-initiated refetch, which still works normally for actual fetch failures — that's a
different query state, `isError`, not a background revalidation of already-successful data).
Regression coverage: `tests/optimistic-rollback.test.ts` → _"keeps a corrected value in cache
indefinitely — no automatic revert on remount."_

The trade-off: if this were a real backend shared across users/devices, `staleTime: Infinity` would
mean never seeing someone else's change without a manual reload. For a single-operator session
against a mock API, that trade-off is the right one — see the decision log entry below.

- **No combined search+category+sort** — see above.
- **`/auth/me` after refresh** — a successful `/auth/refresh` sets a new access token in memory; the
  next `/auth/me` call (or any authenticated call) uses it transparently via `apiFetch`, no manual
  re-hydration needed.
- **404 shape** — `GET /products/{bad-id}` returns a JSON body with a `message` field and a 404
  status; `useProduct`'s retry function treats 404 as terminal (not transient) and the item page shows
  a real not-found `EmptyState` instead of retrying or crashing.

## Decision log

**1. Item id in the URL as its own route (`/items/[id]`), not `?item=12` overlaying the list**

- _Decision:_ Dedicated route, as required by the brief.
- _Rejected alternative:_ `?item=12` on top of `/stock`, rendering the detail as a modal/overlay over
  the still-mounted list.
- _Why:_ A real route is trivially shareable and deep-linkable on its own — "someone pastes
  `/items/12` into chat" needs zero special-casing. The real trade-off this creates is "back to list":
  we solved it by passing `returnTo=<the exact list URL the user came from>` as a query param, rather
  than resetting to a bare `/stock`. The cost is a slightly longer URL; the benefit is the user never
  loses their place. If two people open the same item link from _different_ list states, `returnTo`
  correctly sends each of them back to their own filtered view rather than a shared one.

**2. Token storage: access token in memory only, refresh token in `sessionStorage`**

- _Decision:_ `accessToken` is a module-level JS variable (lost on hard reload); `refreshToken` lives
  in `sessionStorage`.
- _Rejected alternatives:_ (a) both in `localStorage`, (b) both in memory only, (c) httpOnly cookies.
- _Why:_ There's no backend of our own here, so we can't set an httpOnly cookie from a real server —
  that's the actually-correct answer for a production system and isn't available to us. Between the
  remaining options: `localStorage` for the refresh token would survive a full browser restart and be
  shared cross-tab, which is more persistence than a shared ward tablet needs and a slightly larger
  XSS blast radius. Memory-only for both would mean any hard reload logs the user out, which fails
  the "session survives token expiry without losing the user's place" requirement the moment someone
  reloads. `sessionStorage` for the refresh token is the middle ground: it survives the reload/tab
  restore ward staff actually do mid-shift, without becoming a durable, cross-tab-shared credential on
  a shared device.

**3. Stock correction: optimistic update, not pessimistic wait-then-update**

- _Decision:_ Update the cached stock value immediately on submit (`onMutate`), roll back on failure.
- _Rejected alternative:_ Wait for the `PUT` response before updating anything, only reflecting the
  new value once confirmed.
- _Why:_ Ward tablets are on patchy wifi — a pessimistic approach means every save feels laggy even
  when it will succeed. Since DummyJSON's `PUT` doesn't persist anyway, "waiting for confirmation"
  doesn't buy real correctness here, only worse perceived latency. The optimistic approach is only
  defensible because we pair it with an honest rollback path: `tests/optimistic-rollback.test.ts`
  exists specifically because "looks optimistic but silently never rolls back" is the failure mode
  that would make this dangerous for a stock system.

**4. Save button: disabled while pending, not spinner-while-clickable**

- _Decision:_ Both the login submit button and the stock-correction save button disable during their
  respective pending states, showing changed label text ("Signing in…" / "Saving…") rather than
  staying clickable with a spinner overlay.
- _Rejected alternative:_ Leave the button clickable with an inline spinner, allowing repeat clicks.
- _Why:_ On patchy wifi, a clickable-during-pending button invites duplicate submissions (double
  login attempts, or worse, two overlapping stock corrections racing each other). Disabling is the
  simpler, safer default for a form that mutates a shared resource, and we kept it consistent across
  both forms in the app rather than mixing patterns.

**5. Debounce (350ms) for the search box**

- _Decision:_ 350ms debounce on the raw keystrokes before writing to the URL.
- _Rejected alternative:_ No debounce (write every keystroke straight to the URL), or a much longer
  debounce (~800ms+).
- _Why:_ Sub-300ms debounces still generate a request-per-keystroke for fast typists; anything much
  past 400ms starts to feel unresponsive on a search box. 350ms is deliberately still fast enough
  that the race-condition guarantee (an old, slow response never overwriting a new, fast one) has to
  do real work rather than being masked by a debounce so long it rarely fires two overlapping
  requests — verified with `?delay=2000` against `?delay=0` and in `tests/search-race.test.ts`.
  (The list query originally also carried a 15s `staleTime` for the same "don't refetch a filter
  combo the user just bounced away from" reasoning — see decision #7 for why that became `Infinity`.)

**6. Bulk correction patches every cache entry that holds the item, not just the one being viewed**

- _Decision:_ both `useCorrectStock` and `useBulkCorrectStock` patch the single-item cache
  (`['product', id]`) and every cached stock-list page (`['products', ...]`) that contains the
  affected product(s), in the same optimistic update / rollback pass.
- _Rejected alternative:_ patch only the cache for whatever screen triggered the correction (the
  detail page), and rely on `invalidateQueries` to eventually bring the list back in sync.
- _Why:_ this was a real bug found during review — correcting stock from the detail page updated
  only `['product', id]`, so the list looked unchanged (stale) until its 15s `staleTime` lapsed and a
  refetch happened to fire. Worse, `invalidateQueries` isn't actually a fix here: since DummyJSON's
  `PUT` doesn't persist server-side, a refetch would silently pull the _original_, uncorrected value
  back from the mock server, undoing the correction the user just made. Patching every relevant cache
  entry directly, without refetching, is the only way the optimistic value stays the source of truth
  for the session. `tests/optimistic-rollback.test.ts` covers both the patch and its rollback at the
  list-cache level, specifically to guard against this regressing again.

**7. `staleTime`/`gcTime`: `Infinity` on the product queries, not a longer finite value**

- _Decision:_ `useProduct` and `useProducts` never consider their cached data stale and never garbage
  collect it while the tab is open.
- _Rejected alternative:_ keep the original 15s (list) / default 0s (detail) staleTime, or just bump
  both to something longer like 5 minutes.
- _Why:_ this was a real, reported bug — a stock correction would silently revert to its
  pre-correction value on its own, with no error, some time after being saved successfully. Root
  cause: with any finite staleTime, React Query's default `refetchOnMount` fires a background refetch
  the next time that exact query remounts with data older than its staleTime (leaving the item detail
  page and coming back, revisiting a list page/filter combo, etc.). Since DummyJSON's `PUT` never
  persists server-side, that refetch always re-serves the _original_ value and overwrites the
  optimistic patch. A longer finite value only widens the window before the same bug resurfaces; it
  doesn't fix it. `Infinity` is the honest expression of the actual constraint: this mock backend
  cannot produce a legitimately newer value than what's already in the cache, so there is nothing a
  background refetch could ever correctly get us, only ways for it to get things wrong. See "Why the
  product queries never auto-refetch" above and the regression test in
  `tests/optimistic-rollback.test.ts`.

## Optional features

The brief explicitly said not to attempt these at the cost of the required behaviour, so they were
added last, after the five graded outcomes above were re-verified working.

- **Bulk correction** — implemented. Checkboxes per row (`StockTable`) plus a "select all on this
  page" checkbox feed a `Set<number>` of selected ids (local UI state, cleared automatically whenever
  the search/filter/sort/page changes, since a selection from a different result set would be
  ambiguous). A `BulkActionBar` appears once anything is selected; `BulkCorrectionDialog` applies one
  stock value to every selected item via `useBulkCorrectStock`, using the same optimistic-update/
  rollback shape as the single-item correction. DummyJSON has no bulk endpoint, so this is `N`
  individual `PUT` requests under `Promise.allSettled`. Failure is per-item, not all-or-nothing: items
  that succeed keep their new value, items that fail are rolled back individually to their real prior
  stock, and `BulkCorrectionDialog` reports the split honestly ("8 of 10 items updated, 2 failed and
  have been restored") rather than a blanket success/failure message.
- **Offline / reconnect indicator** — implemented. `OfflineBanner` listens to the browser's
  `online`/`offline` events and shows a persistent amber banner while offline, plus a brief green
  "Back online" confirmation on reconnect. This matters more here than in a typical app, given the
  brief's own framing of ward tablets on patchy wifi — a failed save should look like a failed save,
  not identical to a successful one.
- **Virtualised scrolling of the full 194 items** — deliberately not implemented, and this is the one
  place "optional" and "required" were genuinely in tension. Virtualising only pays off once you're
  rendering a long, unpaginated list — which means fetching all 194 items in one request and dropping
  the `page` parameter, since a virtualised window over a paginated fetch has nothing to virtualise (12
  rows aren't worth it). But `page` is one of the four values the URL-state requirement (outcome #3)
  explicitly has to preserve and restore, and the empty-page-strand requirement (outcome #2) is
  specifically about page navigation. Reworking the data model to drop pagination risked regressing
  both of those to add a feature the brief marked optional. If this becomes a real requirement later,
  the cleanest path is probably a `view=all` URL flag that switches `useProducts` to an unpaginated
  fetch and `StockTable` to a windowed render (e.g. `react-window`), left as a separate mode rather
  than a replacement for the paginated one — but that's a deliberate follow-up, not something to bolt
  on inside the current model.

## Manual acceptance checklist

Re-run these against a deployed build before calling the app done (see brief §"Final acceptance
pass"):

- [ ] Fast-replace a search query under `?delay=2000` — no stale result flash.
- [ ] Change category/sort while on a later page — never lands on an empty page.
- [ ] Reload mid-session, and open a copied URL from another browser profile — same
      search/filter/sort/page both times.
- [ ] Every data screen (list, detail, categories) shows loading, empty, and a recoverable error
      against `/http/500`.
- [ ] Correct a single item's stock, navigate away (back to `/stock`, or to another item) and back —
      the corrected value must still be there, not reverted. Repeat after leaving the tab idle for a
      minute or more.
- [ ] Correct stock from `/stock`'s table, then open that item's detail page — value matches. Correct
      it again from the detail page, then go back to `/stock` — value matches there too, with no
      refresh needed either direction.
- [ ] Force a single-item stock save to fail (e.g. throttle to offline mid-save, or a mocked 500): the
      dialog stays open, the field keeps what you typed, the visible stock elsewhere reverts to the
      real prior value, Cancel/Save/the input are disabled only while the request is in flight, and
      Save relabels to "Retry save".
- [ ] Bulk-correct a selection where at least one id will fail (e.g. an id outside DummyJSON's real
      range): the dialog reports how many succeeded vs failed, the succeeded rows keep the new value,
      the failed rows revert to their real prior value, and the toast/inline message never claims a
      full success when it wasn't one.
- [ ] Full keyboard pass, and a check at 360px width.
- [ ] Sit idle past 1 minute (token expiry), then act — session refreshes without losing place or
      showing a blank screen.
- [ ] `format:check`, `lint`, and `test` all fail the pipeline on a deliberately broken commit, then
      pass again once fixed.
