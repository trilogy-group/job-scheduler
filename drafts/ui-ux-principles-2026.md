# UI/UX Principles for Data-Dense Scheduler Dashboards (2025–26)

A synthesis of current best practices for the job-scheduler dashboard
(`apps/dashboard/`), focused on dense tables, filtering, search, command
palettes, state-aware UI, and performance at queue scale.

## 1. Dense Table Design

- **Zebra striping is conditional**: Nielsen Norman recommends striping only
  when rows exceed ~5 columns or scan distance is long; otherwise rely on
  row-hover and tight baselines. Salient/Linear use subtle 4–6% luminance
  deltas, not hard alternation.
- **Sticky headers + sticky first column** keep job ID and status anchored
  during horizontal scroll; pair `position: sticky` with a 1px bottom shadow.
- **Virtualize rather than paginate** for >200 rows. TanStack Virtual gives
  O(visible) DOM nodes; combine with `overscan: 8` to hide scroll edges.
- **Resizable columns** must persist to `localStorage` keyed by table id and
  respect a `min-width` so status pills never wrap.

**Implications for this project**: Adopt `@tanstack/react-virtual` in
`apps/dashboard/QueueTable.tsx`. Replace 50-row pagination with a single
windowed list scaling to 5k+ jobs. Add sticky `<thead>` and sticky `job_id`
column. Persist column widths under `job-scheduler.table.queue.cols`.

Refs:
- https://tanstack.com/virtual/latest/docs/introduction
- https://www.nngroup.com/articles/table-design/

## 2. Filter Chip Patterns

- **Linear-style chips**: each filter is a removable pill with `×`; inactive
  filters appear as a single "+ Filter" affordance, not a wall of empty selects.
- **Notion-style multi-select**: popover with search input + checkbox list;
  apply on close to avoid query thrash.
- **Overflow**: collapse to "+3 more" after the row would wrap; expand on click
  into a full-width chip tray.

**Implications for this project**: Refactor `apps/dashboard/components/FilterBar.tsx`
into a chip array driven by URL search params (`?status=FAILED&provider=fireworks`).
Use Radix Popover + `cmdk` for multi-select. Cap visible chips at 5.

Refs:
- https://www.radix-ui.com/primitives/docs/components/popover
- https://m3.material.io/components/chips/guidelines

## 3. Search-as-You-Type

- **Debounce 200ms** is the documented sweet spot (web.dev: 150–300ms; <100ms
  causes request storms, >300ms feels laggy).
- **Highlight matches** with `<mark>` and `aria-label` so screen readers
  announce "match: job_abc123".
- **Couple to `/`** as a global focus shortcut (GitHub/Linear convention) and
  `Esc` to clear. Use `useDeferredValue` to keep typing responsive.

**Implications for this project**: Wrap `JobSearchInput` in `useDeferredValue`
and a 200ms `useDebouncedCallback`. Register `/` in the global keymap.

Refs:
- https://web.dev/articles/debounce-your-input-handlers
- https://react.dev/reference/react/useDeferredValue

## 4. Command-K Palette

- Use **`cmdk`** (pacocoursey) — ships an ARIA-correct combobox, fuzzy matcher,
  and groups out of the box.
- **Recent actions** at the top when input is empty; switch to fuzzy results
  on first keystroke. Cap recents at 5.
- **Accessibility**: input `role="combobox"`, list `role="listbox"`, items
  `role="option"`; `aria-activedescendant` follows arrow keys.

**Implications for this project**: Add `cmdk` to `apps/dashboard`. Wire actions:
"Cancel job", "Retry failed", "Jump to provider Fireworks", "Open run logs".
Persist recents in `localStorage` under `cmdk.recents`.

Refs:
- https://github.com/pacocoursey/cmdk
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

## 5. State-Machine-Aware UI

- **Empty vs. zero-results vs. error are distinct** — don't reuse one component.
  Empty = "create your first job" CTA; zero-results = "clear filters"; error =
  retry + correlation id.
- **Skeletons match final layout** (row count, column widths) so CLS is zero.
  Animate with a 1.5s shimmer, not a spinner.
- **Status pills** map to scheduler states with stable semantics:
  QUEUED=slate, PROGRESS=blue (pulsing), COMPLETED=green, FAILED=red,
  CANCELLED=neutral.

**Implications for this project**: Build `<TableState kind="empty|loading|error|no-results">`
in `apps/dashboard/components/`. Replace ad-hoc spinners. Add a status-pill
component driven by the existing `JobStatus` type so colors never drift.

Refs:
- https://www.smashingmagazine.com/2022/02/empty-states-ux-design/

## 6. Performance for Large Queues

- **Windowing beats pagination** when users scan/sort across the full queue
  (typical ops dashboard). Pagination wins only when a page is a discrete unit
  of work.
- **Optimistic updates** for cancel/retry: mutate local cache immediately,
  reconcile on server ack, roll back with a toast (TanStack Query `onMutate`).
- **Stream over poll**: a single SSE/WebSocket channel scales better than N
  polling tables. Coalesce updates in a 100ms rAF tick to avoid render storms.

**Implications for this project**: Migrate `useJobsQuery` from 5s polling to
SSE off the existing tick endpoint. Add `onMutate` handlers in cancel/retry
mutations.

Refs:
- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

## Summary: Prioritized Action List

1. **[High / Low]** Add `@tanstack/react-virtual` to `QueueTable` — unblocks 1k+ row dashboards immediately.
2. **[High / Low]** Introduce `<TableState>` for empty / loading / error / no-results.
3. **[High / Medium]** Adopt `cmdk` for Command-K palette with recents and ARIA combobox.
4. **[High / Medium]** Migrate polling → SSE for live job status; coalesce in rAF.
5. **[Medium / Low]** Debounce search at 200ms + `useDeferredValue` + `/` shortcut.
6. **[Medium / Medium]** Rebuild `FilterBar` as URL-synced chips with Notion-style multi-select popovers.
7. **[Medium / Low]** Centralize status pill colors against the `JobStatus` enum to lock state-machine ↔ UI.
8. **[Low / Low]** Persist column widths and visible columns per table in `localStorage`.
