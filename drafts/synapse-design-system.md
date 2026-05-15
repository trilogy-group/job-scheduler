# Synapse Design System Tokens
*Extracted 2026-05-15 from https://synapse.ti.trilogy.com/_next/static/chunks/02853lmmwkngd.css (public CSS bundle, no auth required). The /projects dashboard is SSO-gated but the login page and all static assets are publicly accessible.*

## Typography

### Font Stacks
```css
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", Consolas, monospace;
```
Font features: `"ss01", "cv11"` (OpenType stylistic alternates)
Body: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`

### Type Scale (Tailwind v4 CSS vars)
| Token | rem | px |
|---|---|---|
| `--text-xs` | 0.75rem | 12px |
| `--text-sm` | 0.875rem | 14px |
| `--text-base` | 1rem | 16px |
| `--text-lg` | 1.125rem | 18px |
| `--text-xl` | 1.25rem | 20px |
| `--text-2xl` | 1.5rem | 24px |
| `--text-3xl` | 1.875rem | 30px |
| `--text-4xl` | 2.25rem | 36px |
| `--text-5xl` | 3rem | 48px |
| `--text-6xl` | 3.75rem | 60px |
| `--text-7xl` | 4.5rem | 72px |

Custom sizes in use: 9px, 10px, 11px, 12px, 12.5px, 13px, 14px, 15px, 17px, 26px, 7.5rem

### Font Weights
| Token | Value |
|---|---|
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |

### Letter Spacing
| Token | Value |
|---|---|
| `--tracking-tighter` | -0.05em |
| `--tracking-tight` | -0.025em |
| `--tracking-wider` | 0.05em |
| `--tracking-widest` | 0.1em |

Custom tracking in use: 0.15em, 0.18em, 0.2em

Heading pattern: `font-semibold tracking-tight` (weight 600, -0.025em spacing)

### Line Heights
| Token | Value |
|---|---|
| `--leading-tight` | 1.25 |
| `--leading-snug` | 1.375 |
| (base) | 1.5 |
| `--leading-relaxed` | 1.625 |

Custom line heights: 0.95, 1.05, 1.25, 1 (leading-none)

---

## Color Tokens

### Brand / Accent (Cyan/Teal)
| Token | Hex | Description |
|---|---|---|
| `--color-accent-300` | `#00ccf9` | Bright cyan (light accent, highlights) |
| `--color-accent-500` | `#00a1c8` | Primary accent (buttons, focus ring, active states) |

### Status / Semantic Colors
| Token | Hex | Description |
|---|---|---|
| `--color-ok` | `#67bb6b` | Green — success, completed |
| `--color-warn` | `#f3ae58` | Amber — warning |
| `--color-bad` | `#f04c5a` | Red — error, failed |
| `--color-idle` | `#86909b` | Gray — idle, neutral, queued |

*Note: `--color-bad-soft`, `--color-ok-soft`, `--color-warn-soft`, `--color-info`, `--color-info-soft` are referenced in component-level CSS (not in global bundle). Infer as 10–15% opacity overlays of their base color.*

### Semantic Surface Tokens — Dark Mode (default, `color-scheme: dark`)
| Token | Hex | Lab | Description |
|---|---|---|---|
| `--bg` | `#0a0e11` | lab(3.69%) | Page background |
| `--bg-elev` | `#13161a` | lab(7.21%) | Elevated surface (cards, panels) |
| `--bg-hover` | `#1c2024` | lab(11.83%) | Hover state background |
| `--fg` | `#f8f8f8` | lab(97.68%) | Primary text |
| `--fg-muted` | `#9a9fa5` | lab(65.19%) | Secondary / muted text |
| `--fg-subtle` | `#6d7277` | lab(47.79%) | Tertiary / placeholder text |
| `--border` | `#23272b` | lab(15.31%) | Default border |
| `--border-strong` | `#373b40` | lab(24.59%) | Stronger border (inputs, dividers) |

### Semantic Surface Tokens — Light Mode (`prefers-color-scheme: light`)
| Token | Hex | Description |
|---|---|---|
| `--bg` | `#fcfcfc` | Page background |
| `--bg-elev` | `#f5f5f5` | Elevated surface |
| `--bg-hover` | `#eeeeee` | Hover state |
| `--fg` | `#0e1216` | Primary text |
| `--fg-muted` | `#44484d` | Secondary / muted |
| `--fg-subtle` | `#6d7277` | Tertiary (same both modes) |
| `--border` | `#d9dfe5` | Default border |
| `--border-strong` | `#bfc5ca` | Stronger border |

**Default is dark mode.** Synapse is a dark-first product.

---

## Spacing

Base unit: `--spacing: 0.25rem` (4px). All Tailwind spacing multiplies this.

Common spacings in use:
- 0.5 (2px), 1 (4px), 1.5 (6px), 2 (8px), 2.5 (10px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 7 (28px), 8 (32px), 10 (40px), 12 (48px), 14 (56px), 16 (64px), 20 (80px), 24 (96px), 28 (112px)

---

## Border Radius

| Token | Value | px |
|---|---|---|
| `--radius-sm` | 0.25rem | 4px |
| `--radius-md` | 0.375rem | 6px |
| `--radius-lg` | 0.5rem | 8px |
| `--radius-xl` | 0.75rem | 12px |
| `--radius-2xl` | 1rem | 16px |
| `rounded-full` | 3.4e38px | Circle |
| `rounded-[1px]` | 1px | Near-square badge |

Button pattern: `rounded-xl` (12px)
Card pattern: `rounded-2xl` (16px) or `rounded-xl`
Tag/badge: `rounded-full` or `rounded`

---

## Transitions & Animation

| Token | Value |
|---|---|
| `--default-transition-duration` | 0.15s |
| `--default-transition-timing-function` | cubic-bezier(0.4, 0, 0.2, 1) |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) |
| `--animate-pulse` | pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite |

`.reveal` pattern: `opacity: 0 + translateY(16px)` → `opacity: 1 + translateY(0)` over 0.7s `cubic-bezier(.2,.7,.2,1)`. Used for page enter animations.

---

## Shadow

| Class | Value |
|---|---|
| `.shadow-sm` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)` |
| `.shadow-md` | `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)` |
| `.shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)` |
| `.shadow-2xl` | `0 25px 50px rgba(0,0,0,0.25)` |
| `.card-shadow` | `0 1px rgba(0,0,0,0.04), 0 4px 24px -8px rgba(0,0,0,0.12)` |

`card-shadow` is Synapse's custom card elevation — very subtle, lab-space aware.

---

## Focus / Accessibility

Focus ring: `outline: 2px solid var(--color-accent-500); outline-offset: 2px; border-radius: 4px`
Scrollbars: `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent`
Reduced-motion: `.reveal` animations disabled via `@media (prefers-reduced-motion: reduce)`

---

## Component Patterns (inferred from Tailwind classes in DOM)

### Buttons
```css
/* Primary / Outlined (login button pattern) */
rounded-xl px-4 py-3 text-sm font-medium
border border-[var(--border-strong)]
bg-[var(--bg-elev)] hover:bg-[var(--bg-hover)]
transition-colors disabled:opacity-60
```

### Status Pills (scheduler-relevant)
Based on `--color-*` tokens, each state should map to:
| Scheduler State | Color Token | Background (6%) | Border (30%) |
|---|---|---|---|
| QUEUED | `--color-idle` `#86909b` | `rgba(134,144,155,0.06)` | `rgba(134,144,155,0.3)` |
| PROGRESS | `--color-accent-500` `#00a1c8` | `rgba(0,161,200,0.06)` | `rgba(0,161,200,0.3)` |
| COMPLETED | `--color-ok` `#67bb6b` | `rgba(103,187,107,0.06)` | `rgba(103,187,107,0.3)` |
| FAILED | `--color-bad` `#f04c5a` | `rgba(240,76,90,0.06)` | `rgba(240,76,90,0.3)` |
| CANCELLED | `--fg-subtle` `#6d7277` | `rgba(109,114,119,0.06)` | `rgba(109,114,119,0.3)` |

PROGRESS state should use `animate-pulse` on the dot indicator.

### Logo / Brand Mark
```html
<!-- Synapse logo: 8px cyan dot + semibold tracking-tight text -->
<span class="block size-2 rounded-full bg-[var(--color-accent-500)]"></span>
<span class="font-semibold tracking-tight text-lg">Synapse</span>
```

### Typography Hierarchy
- Page H1: `text-2xl font-semibold tracking-tight` (24px, 600, -0.025em)
- Section H2: `text-xl font-semibold tracking-tight` (20px, 600)
- Body: `text-sm` (14px, 400, line-height 1.43)
- Muted body: `text-sm text-[var(--fg-muted)]`
- Caption / meta: `text-xs text-[var(--fg-subtle)]`
- Label / uppercase: `text-xs tracking-widest uppercase` (tracking 0.1em)
- Monospace (job IDs, counts): `font-mono tabular`

### Cards
```css
rounded-xl bg-[var(--bg-elev)] card-shadow border border-[var(--border)]
```

### Input / Search
```css
bg-[var(--bg-elev)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm
placeholder:text-[var(--fg-subtle)]
focus:border-[var(--border-strong)] focus:outline-none
transition-colors
```

### Table
- Header: `text-xs font-medium tracking-wider text-[var(--fg-subtle)] uppercase`
- Row: `border-b border-[var(--border)] hover:bg-[var(--bg-hover)]`
- Cell: `text-sm text-[var(--fg)]` (default), `text-[var(--fg-muted)]` (secondary columns)
- Monospace cells (IDs, hashes): `font-mono text-xs tabular`

### Navigation
- Synapse uses a sidebar nav (operator dashboard). Nav items: `text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]`
- Active item: `text-[var(--fg)] bg-[var(--bg-hover)]` with left accent `border-l-2 border-[var(--color-accent-500)]`

---

## Container / Layout

Max widths:
| Token | rem | px |
|---|---|---|
| xs | 20rem | 320px |
| sm | 24rem | 384px |
| md | 28rem | 448px |
| lg | 32rem | 512px |
| xl | 36rem | 576px |
| 2xl | 42rem | 672px |
| 3xl | 48rem | 768px |
| 4xl | 56rem | 896px |
| 5xl | 64rem | 1024px |
| 6xl | 72rem | 1152px |
| 7xl | 80rem | 1280px |

App uses `max-w-[1200px]` and `max-w-[1600px]` for wide layouts.

Breakpoints (Tailwind defaults): sm 640px, md 768px, lg 1024px

---

## Dark/Light Mode Strategy

Synapse defaults to **dark mode** (`color-scheme: dark` on `:root`). All semantic tokens (`--bg`, `--fg`, `--border`, etc.) are dark by default and override to light values under `@media (prefers-color-scheme: light)`. There is no manual theme toggle visible in the public CSS — it follows OS preference.

**Implication for job-scheduler dashboard**: Match this pattern — dark-first, `prefers-color-scheme: light` override, no manual toggle (or add one later as enhancement).

---

## Implications for `apps/dashboard/`

1. **Color tokens**: Add CSS variables matching Synapse's semantic set to `apps/dashboard/app/globals.css`. Use the same token names for familiarity (`--bg`, `--bg-elev`, `--fg`, `--fg-muted`, `--border`, etc.).
2. **Accent**: `--color-accent-500: #00a1c8` (cyan). Replace any hardcoded blues/indigos.
3. **Status pills**: Use the status → color mapping table above. Add `animate-pulse` dot on PROGRESS jobs.
4. **Typography**: Ensure Inter is loaded (it's in the font stack). Apply `font-feature-settings: "ss01", "cv11"` on the body.
5. **Card style**: `rounded-xl bg-[var(--bg-elev)] card-shadow border border-[var(--border)]` — replace any existing card classes.
6. **Dark-first**: flip the dashboard default to dark; let OS light preference override.
7. **Table headers**: `text-xs uppercase tracking-wider text-[var(--fg-subtle)]` — Synapse's table header style.
8. **Focus ring**: Ensure `outline: 2px solid var(--color-accent-500); outline-offset: 2px` on all interactive elements.

---

## Source
- CSS bundle: `https://synapse.ti.trilogy.com/_next/static/chunks/02853lmmwkngd.css`
- HTML source: `https://synapse.ti.trilogy.com/login` (public login page)
- llms.txt: `https://synapse.ti.trilogy.com/llms.txt`
- Extracted: 2026-05-15T14:54Z by job-scheduler-wt-lint (job-scheduler-a86)
