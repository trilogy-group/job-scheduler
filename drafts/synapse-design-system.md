# Synapse Design System Reference

Extracted from https://synapse.ti.trilogy.com via public landing page CSS and HTML.
Source: `/_next/static/chunks/02853lmmwkngd.css` + SSR HTML.
Date extracted: 2026-05-15.

---

## Color Tokens

### Semantic / Status Colors (same in light + dark modes)

| Token | Hex | Lab (wide-gamut) | Usage |
|---|---|---|---|
| `--color-accent-500` | `#00a1c8` | `lab(60.15% -37.19 -41.70)` | Primary CTA, focus rings, accent borders |
| `--color-accent-300` | `#00ccf9` | `lab(75.24% -35.52 -37.48)` | Lighter accent, icon fills, chip text |
| `--color-ok` | `#67bb6b` | `lab(69.24% -39.23 32.11)` | Success, trust-high, "PASS" |
| `--color-warn` | `#f3ae58` | `lab(76.59% 19.90 53.46)` | Warning, "medium confidence", pending |
| `--color-bad` | `#f04c5a` | `lab(57.28% 64.12 30.07)` | Error, trust-low, "FAIL" |
| `--color-idle` | `#86909b` | `lab(59.38% -2.06 -7.08)` | Idle/inactive agents, warming-up state |

### Surface + Text Colors

#### Dark mode (default — `color-scheme: dark`)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#0a0e11` | Page background |
| `--bg-elev` | `#13161a` | Elevated surfaces (cards, panels) |
| `--bg-hover` | `#1c2024` | Hover state backgrounds |
| `--fg` | `#f8f8f8` | Primary text |
| `--fg-muted` | `#9a9fa5` | Secondary/muted text |
| `--fg-subtle` | `#6d7277` | Placeholders, metadata |
| `--border` | `#23272b` | Default borders |
| `--border-strong` | `#373b40` | Hover/active borders |

#### Light mode (`prefers-color-scheme: light`)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#fcfcfc` | Page background |
| `--bg-elev` | `#f5f5f5` | Elevated surfaces |
| `--bg-hover` | `#eeeeee` | Hover state backgrounds |
| `--fg` | `#0e1216` | Primary text |
| `--fg-muted` | `#44484d` | Secondary/muted text |
| `--fg-subtle` | `#6d7277` | Placeholders (same as dark) |
| `--border` | `#d9dfe5` | Default borders |
| `--border-strong` | `#bfc5ca` | Hover/active borders |

---

## Typography

### Font Stacks

```
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", Consolas, monospace
```

Body font features: `"ss01", "cv11"` (Inter optical variants).

### Type Scale (Tailwind-based, 1 spacing unit = 0.25rem)

| Class | Size | Default line-height |
|---|---|---|
| `text-xs` | 0.75rem (12px) | 1.333 |
| `text-sm` | 0.875rem (14px) | 1.429 |
| `text-base` | 1rem (16px) | 1.5 |
| `text-lg` | 1.125rem (18px) | 1.556 |
| `text-xl` | 1.25rem (20px) | 1.4 |
| `text-2xl` | 1.5rem (24px) | 1.333 |
| `text-3xl` | 1.875rem (30px) | 1.2 |
| `text-4xl` | 2.25rem (36px) | 1.111 |
| `text-5xl` | 3rem (48px) | 1.0 |
| `text-6xl` | 3.75rem (60px) | 1.0 |
| `text-7xl` | 4.5rem (72px) | 1.0 |
| hero (lg) | 7.5rem (120px) | 1.0 |

Custom inline sizes used in components: `9px`, `10px`, `11px`, `12px`, `13px`, `17px`, `26px`.

### Font Weights

| Token | Value |
|---|---|
| `font-normal` | 400 |
| `font-medium` | 500 |
| `font-semibold` | 600 |
| `font-bold` | 700 |

### Letter Spacing

| Class | Value | Used for |
|---|---|---|
| `tracking-tighter` | -0.05em | Large display headings |
| `tracking-tight` | -0.025em | Section headings |
| `tracking-wider` | 0.05em | Uppercase labels |
| `tracking-widest` | 0.10em | Fine uppercase labels |
| custom `0.15em` | 0.15em | Agent/loop labels |
| custom `0.18em` | 0.18em | Section eyebrow text |
| custom `0.20em` | 0.20em | Section eyebrow text (prominent) |

### Line Heights

| Class | Value |
|---|---|
| `leading-tight` | 1.25 |
| `leading-snug` | 1.375 |
| `leading-relaxed` | 1.625 |
| `leading-[0.95]` | 0.95 (hero tight) |
| `leading-[1.05]` | 1.05 (section h2) |

---

## Spacing Scale

Base unit: `0.25rem` (4px). Spacing = `n × 0.25rem`.

Breakpoints:
- sm: 40rem (640px)
- md: 48rem (768px)
- lg: 64rem (1024px)

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 0.25rem (4px) | Inline elements |
| `rounded-md` | 0.375rem (6px) | Focus outline |
| `rounded-lg` | 0.5rem (8px) | Small cards, inner elements |
| `rounded-xl` | 0.75rem (12px) | Icon containers |
| `rounded-2xl` | 1rem (16px) | Cards, modals |
| `rounded-full` | 9999px | Pills, buttons, avatars |

---

## Shadows

| Class | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px #0000001a, 0 1px 2px -1px #0000001a` | Subtle elevation |
| `shadow-md` | `0 4px 6px -1px #0000001a, 0 2px 4px -2px #0000001a` | Dropdowns |
| `shadow-lg` | `0 10px 15px -3px #0000001a, 0 4px 6px -4px #0000001a` | Modals |
| `shadow-2xl` | `0 25px 50px -12px #00000040` | Hero cards |
| `.card-shadow` | `0 1px rgba(0,0,0,.04), 0 4px 24px -8px rgba(0,0,0,.12)` | Data cards |

---

## Component Patterns

### Card

```html
<div class="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 md:p-7
            transition-all hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]/50">
```

### Nav Bar

```html
<header class="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg)]/70 border-b border-[var(--border)]/50">
```

### Button — Primary

```html
<button class="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium
               bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 transition-opacity">
```

Small variant: `px-3.5 py-1.5`

### Button — Secondary / Ghost

```html
<button class="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium
               border border-[var(--border)] text-[var(--fg-muted)]
               hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors">
```

### Tag / Chip (colored)

```html
<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] border"
      style="background-color: oklch(0.32 0.07 HUE / 0.55);
             border-color: oklch(0.55 0.10 HUE / 0.55);
             color: oklch(0.88 0.10 HUE)">
  label
</span>
```
Hue values used in practice: 65 (yellow), 114 (lime), 134 (green), 141 (green), 144 (green), 206 (blue), 220 (blue), 222 (blue), 293 (purple), 320 (magenta), 333 (pink), 351 (red).

### Status Badge (tabular)

```html
<span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border tabular"
      style="color: var(--color-ok); border-color: var(--color-ok); opacity: 0.85">
  ACTIVE
</span>
```

### Input Field

```html
<input class="flex-1 px-4 py-3 rounded-full border border-[var(--border)]
              bg-[var(--bg-elev)] text-sm placeholder:text-[var(--fg-subtle)]
              focus:border-[var(--color-accent-500)] focus:outline-none transition-colors">
```

### Mac Chrome (mock terminal card)

```html
<div class="rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl shadow-black/40 overflow-hidden">
  <div class="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-elev)]/60">
    <span class="size-2 rounded-full bg-[var(--color-bad)]/60"></span>
    <span class="size-2 rounded-full bg-[var(--color-warn)]/60"></span>
    <span class="size-2 rounded-full bg-[var(--color-ok)]/60"></span>
    <span class="ml-2 text-[10px] text-[var(--fg-subtle)] mono">window title</span>
  </div>
  <!-- content -->
</div>
```

### Left-Edge Status Marker

```html
<div class="relative rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] overflow-hidden">
  <span aria-hidden="true" class="absolute left-0 top-0 bottom-0 w-[3px]"
        style="background: var(--color-ok)"></span>
  <!-- content with pl-4 -->
</div>
```

### Focus Ring (global)

```css
:focus-visible {
  outline: 2px solid var(--color-accent-500);
  outline-offset: 2px;
  border-radius: 4px;
}
```

---

## Animation

### Reveal (scroll into view)

```css
.reveal {
  opacity: 0;
  will-change: opacity, transform;
  transition: opacity 0.7s cubic-bezier(0.2, 0.7, 0.2, 1),
              transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
  transform: translateY(16px);
}
.reveal-in {
  opacity: 1;
  transform: translateY(0);
}
```
Disable at `prefers-reduced-motion: reduce`.

### Default Transition

```css
transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Pulse

```css
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
/* keyframes: 50% { opacity: 0.5 } */
```

---

## Utility Classes (non-obvious)

| Class | Purpose |
|---|---|
| `.tabular` | `font-variant-numeric: tabular-nums` — numbers align in tables |
| `.mono` | `font-family: var(--font-mono)` |
| `.card-shadow` | Soft card shadow (see Shadows above) |
| `.antialiased` | `-webkit-font-smoothing: antialiased` |
| `.reveal` / `.reveal-in` | Scroll-triggered fade+slide animation |

---

## Design Language Notes

1. **Dark-first**: Default theme is dark (`#0a0e11` base). Light mode via media query only.
2. **OKLCH everywhere**: Accent tints, overlays, and component states use `oklch()` relative color syntax for predictable lightness/chroma relationships (e.g., `oklch(from var(--color-accent-500) l c h / 0.15)`).
3. **Dense information density**: Components pack high-density data using 9–13px text, tabular-nums, and chip badges — not standard Tailwind defaults.
4. **Monospace labels**: Agent names, hashes, timestamps, and scores use the `.mono` class for visual distinction.
5. **No hardcoded colors in components**: All colors flow through CSS custom properties — only the `:root` block and Tailwind theme layer contain hex/lab values.
6. **Inter as primary**: Font stack optimizes for Inter with OpenType features `ss01` + `cv11`.
7. **Accent hue**: `oklch(... 220)` = blue-indigo family. Consistent with Trilogy tech brand direction.

---

## Container / Max-Width Presets

| Token | Value |
|---|---|
| `max-w-xs` | 20rem (320px) |
| `max-w-sm` | 24rem (384px) |
| `max-w-md` | 28rem (448px) |
| `max-w-lg` | 32rem (512px) |
| `max-w-xl` | 36rem (576px) |
| `max-w-2xl` | 42rem (672px) |
| `max-w-3xl` | 48rem (768px) |
| `max-w-4xl` | 56rem (896px) |
| `max-w-5xl` | 64rem (1024px) |
| `max-w-6xl` | 72rem (1152px) |
| `max-w-7xl` | 80rem (1280px) |
