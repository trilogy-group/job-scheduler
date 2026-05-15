# Synapse Design System

Extracted from public CSS bundle (https://synapse.ti.trilogy.com/_next/static/chunks/02853lmmwkngd.css) on 2026-05-15. No SSO auth required — bundle is publicly accessible.

## Source

- CSS bundle: `/_next/static/chunks/02853lmmwkngd.css` (full Tailwind 4 output + custom layer)
- Product description: `/llms.txt`
- Landing page HTML (no auth): `https://synapse.ti.trilogy.com/`

---

## Color Tokens

### Global (mode-agnostic)

| Token | Value (hex) | Usage |
|---|---|---|
| `--color-accent-300` | `#00ccf9` | Light cyan — progress bars, highlights |
| `--color-accent-500` | `#00a1c8` | Primary cyan/teal — CTAs, active states, focus rings |
| `--color-ok` | `#67bb6b` | Green — success, healthy, passing |
| `--color-warn` | `#f3ae58` | Amber — warning, in-progress, degraded |
| `--color-bad` | `#f04c5a` | Red — error, failed, critical |
| `--color-idle` | `#86909b` | Slate gray — idle, inactive, disabled states |

### Dark Mode (default — no media query needed)

| Token | Value (hex) | Lab equivalent |
|---|---|---|
| `--bg` | `#0a0e11` | lab(3.69% -.55 -2.33) — page background |
| `--bg-elev` | `#13161a` | lab(7.21% -.90 -3.47) — cards, panels, elevated surfaces |
| `--bg-hover` | `#1c2024` | lab(11.83% -1.00 -3.52) — hover state, progress track bg |
| `--fg` | `#f8f8f8` | lab(97.68%) — primary text |
| `--fg-muted` | `#9a9fa5` | lab(65.19%) — secondary text, nav links |
| `--fg-subtle` | `#6d7277` | lab(47.79%) — placeholder text, disabled, metadata |
| `--border` | `#23272b` | lab(15.31%) — default borders |
| `--border-strong` | `#373b40` | lab(24.59%) — hover borders, scrollbar track |

### Light Mode (`prefers-color-scheme: light`)

| Token | Value (hex) |
|---|---|
| `--bg` | `#fcfcfc` |
| `--bg-elev` | `#f5f5f5` |
| `--bg-hover` | `#eeeeee` |
| `--fg` | `#0e1216` |
| `--fg-muted` | `#44484d` |
| `--fg-subtle` | `#6d7277` (same as dark) |
| `--border` | `#d9dfe5` |
| `--border-strong` | `#bfc5ca` |

### Semantic Soft Variants (used in CSS via `var()`, likely defined in JS/global CSS not in bundle)

These are referenced in the bundle but not defined there — likely injected via Tailwind config or a global CSS file:
- `--accent` — maps to `--color-accent-500` behavior (border, bg, text usage identical)
- `--color-bad-soft` — soft red background tint
- `--color-ok-soft` — soft green background tint
- `--color-warn-soft` — soft amber background tint
- `--color-info` — informational blue (distinct from accent)
- `--color-info-soft` — soft info background
- `--text`, `--text-muted` — text color aliases (used alongside `--fg`)

---

## Typography

### Font Stacks

```
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", Consolas, monospace
```

**Font features** (applied to `html, body`): `"ss01", "cv11"` — Inter stylistic set 1 (alternate digits) + character variant 11.  
**Font smoothing**: `antialiased` (webkit + moz).

### Type Scale

| Token | rem | px equiv | Line height |
|---|---|---|---|
| `text-xs` | 0.75rem | 12px | 1.333 |
| `text-sm` | 0.875rem | 14px | 1.429 |
| `text-base` | 1rem | 16px | 1.5 |
| `text-lg` | 1.125rem | 18px | 1.556 |
| `text-xl` | 1.25rem | 20px | 1.4 |
| `text-2xl` | 1.5rem | 24px | 1.333 |
| `text-3xl` | 1.875rem | 30px | 1.2 |
| `text-4xl` | 2.25rem | 36px | 1.111 |
| `text-5xl` | 3rem | 48px | 1 |
| `text-6xl` | 3.75rem | 60px | 1 |
| `text-7xl` | 4.5rem | 72px | 1 |

Custom sizes observed in components: `9px`, `10px`, `11px`, `12px`, `12.5px`, `13px`, `14px`, `15px`, `17px`, `26px`, `2.6rem`, `7.5rem`.

### Font Weights

| Class | Weight |
|---|---|
| `font-normal` | 400 |
| `font-medium` | 500 |
| `font-semibold` | 600 |
| `font-bold` | 700 |

### Letter Spacing

| Class | Value | Use case |
|---|---|---|
| `tracking-tighter` | -0.05em | Hero headlines |
| `tracking-tight` | -0.025em | Section headers |
| `tracking-wider` | 0.05em | Labels |
| `tracking-widest` | 0.1em | ALL CAPS metadata |
| custom `[0.15em]` | 0.15em | Tag chips |
| custom `[0.18em]` | 0.18em | Tag chips |
| custom `[0.2em]` | 0.2em | Tag chips |

### Line Heights

| Class | Value |
|---|---|
| `leading-tight` | 1.25 |
| `leading-snug` | 1.375 |
| `leading-relaxed` | 1.625 |
| `leading-none` | 1 |
| `leading-[0.95]` | 0.95 (tight hero) |
| `leading-[1.05]` | 1.05 |
| `leading-[1.25]` | 1.25 |

---

## Spacing Scale

Base unit: **0.25rem (4px)** — standard Tailwind 4 scale.

Common component spacings observed:
- Component padding: `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px), `p-8` (32px)
- Card internal: `p-6 md:p-7` (24px → 28px)
- Nav item: `px-3 py-1.5` (12px × 6px)
- Input: `px-4 py-3` (16px × 12px)
- Tag/pill: `px-2 py-0.5` (8px × 2px)
- Section vertical: `py-16` → `py-32` → `py-40`

---

## Border Radii

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` / `--radius-sm` | 0.25rem (4px) | Tags, small chips |
| `rounded-md` / `--radius-md` | 0.375rem (6px) | Buttons, badges |
| `rounded-lg` / `--radius-lg` | 0.5rem (8px) | Inputs, small cards |
| `rounded-xl` / `--radius-xl` | 0.75rem (12px) | Modal dialogs |
| `rounded-2xl` / `--radius-2xl` | 1rem (16px) | **Primary card radius** |
| `rounded-full` | 9999px | Pills, avatar badges, inputs |
| `rounded-[1px]` | 1px | Progress bar fill |

---

## Shadows

| Class | Value | Usage |
|---|---|---|
| `card-shadow` (custom) | `0 1px rgba(0,0,0,0.04), 0 4px 24px -8px rgba(0,0,0,0.12)` | Card component shadow |
| `shadow-sm` | `0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)` | Tag chips, pills |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | Hover elevation |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` | Modals |
| `shadow-black/40` | Black at 40% opacity | Used with `shadow-2xl` on hero images |

---

## Motion / Animation

### Default Transition
```
transition-duration: 0.15s
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)
```

### Easing Presets
| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| default ease | `cubic-bezier(0.4, 0, 0.2, 1)` |

### Named Animations
| Name | Value | Usage |
|---|---|---|
| `animate-pulse` | `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` | Skeleton loaders |
| `reveal / reveal-in` (custom) | opacity 0→1 + translateY(16px→0), 0.7s `cubic-bezier(0.2, 0.7, 0.2, 1)` | Page entrance animation |

Reduced motion: `reveal` is reset to `opacity:1; transition:none; transform:none` when `prefers-reduced-motion: reduce`.

### Duration Overrides
- `duration-200`: 0.2s
- `duration-300`: 0.3s

---

## Blur Tokens

| Token | Value |
|---|---|
| `--blur-md` | 12px |
| `--blur-xl` | 24px |
| `backdrop-blur` | 8px |
| `backdrop-blur-[2px]` | 2px |

---

## Component Patterns (from landing page HTML)

### Card
```html
<div class="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]
            p-6 md:p-7 hover:border-[var(--border-strong)] transition-colors">
  <!-- card content -->
</div>
```

### Text Input (rounded, full-width)
```html
<input class="flex-1 px-4 py-3 rounded-full border border-[var(--border)] bg-[var(--bg-elev)]
             text-sm placeholder:text-[var(--fg-subtle)] focus:border-[var(--color-accent-500)]
             focus:outline-none transition-colors" />
```

### Tag Chip (muted)
```html
<span class="px-2 py-0.5 rounded-full text-[10px] font-medium border border-[var(--border)]
            bg-[var(--bg)] text-[var(--fg-muted)] shadow-sm">
  tag
</span>
```

### Tag Chip (accent)
```html
<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[var(--color-accent-500)]
            bg-[var(--bg)] text-[var(--color-accent-500)] tabular tracking-wider">
  ACTIVE
</span>
```

### Nav Link
```html
<a class="hidden sm:inline-flex items-center px-3 py-1.5 text-sm text-[var(--fg-muted)]
          hover:text-[var(--fg)] transition-colors">
  Link
</a>
```

### Status Dot
```html
<span class="block size-2 rounded-full bg-[var(--color-accent-500)]
            group-hover:scale-110 transition-transform"></span>
```

### Progress Bar
```html
<div class="flex-1 h-1 rounded-full bg-[var(--bg-hover)] overflow-hidden">
  <div class="h-full bg-[var(--color-accent-500)]"></div>
</div>
```

### Inline-grid card header (used for stat cards)
```html
<div class="flex items-baseline gap-2 mb-3">
  <span class="text-2xl font-bold tracking-tight">42</span>
  <span class="text-sm text-[var(--fg-muted)]">label</span>
</div>
```

### Expand/collapse section (animated)
```html
<!-- Collapsed -->
<div class="grid transition-all duration-300 ease-out grid-rows-[0fr] opacity-0">
  <div class="overflow-hidden"><!-- content --></div>
</div>
<!-- Expanded -->
<div class="grid transition-all duration-300 ease-out grid-rows-[1fr] opacity-100">
  <div class="overflow-hidden"><!-- content --></div>
</div>
```

---

## Grid Breakpoints (Tailwind 4 defaults)

| Prefix | Min-width |
|---|---|
| `sm:` | 40rem (640px) |
| `md:` | 48rem (768px) |
| `lg:` | 64rem (1024px) |

Page max-widths observed: `max-w-[1200px]`, `max-w-[1600px]`, `max-w-7xl` (80rem).

---

## Color Scheme

- **Default**: **dark mode** (no media query — `:root` directly sets dark vars)
- **Light mode**: via `@media (prefers-color-scheme: light)`
- **Scheme declaration**: `color-scheme: dark` on `:root`

---

## Special Utilities

- `.tabular`: `font-variant-numeric: tabular-nums` — applied to numeric counters, stats, timing values
- `.mono`: `font-family: var(--font-mono)` — code blocks, IDs
- `.reveal` / `.reveal-in`: entrance animation (translateY + fade, 0.7s)
- `.card-shadow`: custom layered shadow for cards
- Scrollbar: `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent` (applied to `*`)
- Focus: `outline: 2px solid var(--color-accent-500); outline-offset: 2px; border-radius: 4px` on `:focus-visible`

---

## Implications for apps/dashboard Redesign

1. **Dark-first**: Apply dark mode as default, light via media query — matches Synapse exactly.
2. **Accent**: Replace any existing brand color with `--color-accent-500: #00a1c8` as primary interactive color.
3. **Card pattern**: Use `rounded-2xl + border + bg-[var(--bg-elev)] + p-6` for all data cards.
4. **Status pills**: Jobs in PROGRESS → `--color-ok` chip; QUEUED → `--color-warn` chip; FAILED → `--color-bad` chip; IDLE → `--color-idle` chip.
5. **Typography**: Adopt Inter with `ss01, cv11` feature settings; use `tracking-tight` on headers, `tabular` on numeric columns.
6. **Inputs**: Adopt rounded-full pill input pattern for search, rounded-lg for forms.
7. **Animations**: Add `reveal/reveal-in` entrance animation to data sections; use 0.15s default transitions.
8. **Progress**: Use 1px h-1 rounded-full track + accent fill for GPU utilization bars.
