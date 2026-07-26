---
name: Egebeya
description: The kebele noticewall — a no-code builder for Ethiopian service businesses, framed around the telebirr receipt on a Qof-coffee counter.
# Canonical token source: this frontmatter is normative. The Tailwind v4 theme
# (the @theme block in src/index.css) is the runtime mirror of these tokens —
# semantic aliases such as `--color-primary`, `--color-surface`, `--color-ink`,
# `--color-accent`, `--color-canvas` exist SO THAT Tailwind utilities like
# `bg-primary`, `bg-surface`, `text-ink`, `bg-canvas` are auto-generated from
# the same single source of truth documented here. There is no separate
# tailwind.config.js (this project is Tailwind v4) and no competing CSS
# variable: --color-paper = --color-surface, --color-telebirr = --color-primary,
# --color-counter = --color-canvas, etc. are kept ONLY for explicit
# receipt-moment surfaces; new code reaches for the semantic alias.
colors:
  surface: "#F6F1E8"
  surface-raised: "#FBF8F2"
  ink: "#1A1411"
  ink-soft: "#6E5B4E"
  ink-rule: "rgba(26, 20, 17, 0.12)"
  ink-rule-dashed: "rgba(26, 20, 17, 0.28)"
  primary: "#0FA958"
  primary-deep: "#063F2D"
  accent: "#D33426"
  canvas: "#3B2820"
  canvas-soft: "#7A5C49"
  canvas-rule: "rgba(122, 92, 73, 0.30)"
  link: "#063F2D"
  focus: "#063F2D"
  success: "#0FA958"
  success-deep: "#063F2D"
  warning: "#D33426"
  # Kebele primitives retained for explicit receipt-moment surfaces:
  paper: "#F6F1E8"
  paper-bleached: "#FBF8F2"
  counter: "#3B2820"
  counter-soft: "#7A5C49"
  telebirr: "#0FA958"
  telebirr-deep: "#063F2D"
  signal: "#D33426"
  ink-rule-counter: "rgba(122, 92, 73, 0.30)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "clamp(2.75rem, 6.2vw, 6rem)"
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontWeight: 700
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontWeight: 400
    fontSize: "1rem"
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontWeight: 500
    fontSize: "0.75rem"
    lineHeight: 1.4
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  ethiopic-display:
    fontFamily: "Noto Serif Ethiopic, serif"
    fontWeight: 700
    fontSize: "clamp(1.5rem, 4vw, 3.5rem)"
    lineHeight: 0.95
  receipt-mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontWeight: 500
    fontSize: "0.85rem"
    lineHeight: 1.4
rounded:
  card: "2px"
  chip: "2px"
  pill: "9999px"
spacing:
  page-x: "20px"
  page-x-sm: "32px"
  page-x-lg: "48px"
  section-y: "64px"
  section-y-lg: "96px"
  card-pad: "20px"
  card-pad-lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    borderColor: "{colors.ink-rule-dashed}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
  button-counter:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "16px 24px"
  input-receipt:
    borderColor: "{colors.ink-rule-dashed}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "10px 2px"
  input-receipt-focus:
    borderColor: "{colors.primary}"
  card-receipt:
    backgroundColor: "{colors.surface-raised}"
    borderColor: "{colors.ink-rule}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-tariff-row:
    borderColor: "{colors.ink-rule}"
    padding: "16px 4px"
  badge-status:
    borderColor: "{colors.ink-rule}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
  take-a-number-chip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-raised}"
    typography: "{typography.receipt-mono}"
    rounded: "{rounded.chip}"
  wordmark-stack:
    typography: "{typography.ethiopic-display}"
---

# Design System: Egebeya

## Overview

**Creative North Star: "The kebele noticewall — the telebirr receipt on a Qof-coffee counter."**

Egebeya's visual identity is the receipt Ethiopian service-business owners and their customers already trust most: the telebirr charge slip, printed on cream newsprint, signed by a green header rule and a psycho-bold mono tariff row. Around it lives the warmth of the salon counter — espresso wood, a take-a-number token, hairline dividers — the institution customers walk into for an appointment. *The deposit confirms the appointment*: a thing that physically becomes a receipt, designed to make that mechanism visible on a phone screen.

The category-default navy hero + amber pill CTA + three lucide-icon feature cards is the rut this world refuses. So is the warm-cream + Fraunces-display + terracotta-accent module-default calibration rut. Egebeya is a no-code builder, but the headline pages refuse generic SaaS chrome; the salon's wall is the metaphor for "pin things to a site," with realistic Addis context (Ethiopian-calendar date stamps, +251 phone formats, Bricolage + Ethiopic masthead) earning the audience's identification instead of borrowing it.

**Key Characteristics:**

- Cream paper ground (`--color-surface` = `#F6F1E8`) on every customer-facing area; espresso `--color-canvas` (`#3B2820`) for inverted bands only.
- Telebirr green (`--color-primary` = `#0FA958`) owns 30–50% of the surface *only* when dramatizing the deposit-confirms-booking moment; everywhere else, restrained (neutrals plus one accent).
- Hairline rules (`--color-ink-rule` 1px solid) instead of card shadows. Shadows exist for one narrated moment (the pushpin shadow under a pinned notice); never for ambient lift.
- Receipt-mono (JetBrains Mono) for numerals, tariffs, tx_refs, dates, slot times, status labels. Bricolage Grotesque for headlines; never Inter-as-display.
- Noto Serif Ethiopic for every Amharic glyph at display scale; the ኢ-ገበያ wordmark is the masthead lockup with Bricolage "Egebeya" beneath.
- 2px radius everywhere (`--radius-card`); pills exist only as `rounded-full` utility for genuine take-a-number chips, never as default button shape.

## Colors

The palette is one warm cream ground, one espresso ink family, and one saturated green accent, with one reserve red for warnings. There is no blue. Tint secondary text from the surface hue — never gray. Gradients and blurred decorative "blobs" do not exist in this world; a field owns a region, never a glow.

### Primary

- **Telebirr Green** (`#0FA958`, token `--color-primary`): the deposit / commit / book / success action. Use it where the surface dramatizes that the user is taking a number or confirming an appointment. Bold on light cream, paired with `paper-bleached` text. Hover and deep-headings-on-green use **Telebirr Deep** (`#063F2D`, `--color-primary-deep`).

### Accent (Reserve)

- **Ethiopian-poster Red** (`#D33426`, token `--color-accent`): errors, cancellations, warnings, sparingly. Never co-occurs with `--color-primary` on the same surface; the green is the loud voice and red is the rare exception.

### Neutral

- **Newsprint Cream / Paper** (`#F6F1E8`, `--color-surface`): the page ground. Default `body` background.
- **Bleached Paper / Receipt Card** (`#FBF8F2`, `--color-surface-raised`): card and input surfaces that sit *on* the cream ground.
- **Espresso Ink** (`#1A1411`, `--color-ink`): body text and headings — espresso near-black, not true black, for warmth on cream. Contrast ≥ 9:1 against `--color-surface`.
- **Ink Soft** (`#6E5B4E`, `--color-ink-soft`): secondary text, mono eyebrow labels, helper paragraphs. Tinted from ink, never gray; contrast ≥ 4.6:1 on `--color-surface`.
- **Ink Rule** (`rgba(26, 20, 17, 0.12)`, `--color-ink-rule`): 1px hairline divider — the structural device of a receipt.
- **Ink Rule Dashed** (`rgba(26, 20, 17, 0.28)`, `--color-ink-rule-dashed`): dashed 1px "tear here" affordance for inputs and rule breaks.
- **Counter** (`#3B2820`, `--color-canvas`): espresso wood; the inverted band used at page close and sidebar chrome. Text on counter is `--color-surface-raised`.
- **Counter Soft** (`#7A5C49`, `--color-canvas-soft`): secondary text on `--color-canvas`.
- **Counter Rule** (`rgba(122, 92, 73, 0.30)`, `--color-canvas-rule`): hairline rule on `--color-canvas` bands (the PricingSection highlighted-card divider, the Footer top rule).

### Named Rules

**The One Voice Rule.** The telebirr-green accent appears on ≤10% of any surface that is not dramatizing the deposit-confirm-booking moment. Its rarity is the point — the green is conventionally loud, so if used as ambient chrome it dissolves into SaaS habit.

**The No-Blue Rule.** There is no blue in Egebeya's palette. Any blue literal (`#1E3A8A`, `bg-blue-50`, `text-blue-600`) is the off-world placeholder predecessor and a defect. Replace with `--color-canvas` (espresso), `--color-ink` (ink), or `--color-primary` (telebirr).

**The Tinted-Neutral Rule.** Secondary text, eyebrow labels, and helper copy use `--color-ink-soft` (espresso-tinted) on cream and `--color-canvas-soft` on counter. Never `text-gray-400` / `text-gray-500` / `text-gray-700` — those are Tailwind neutrals and they read as a different system.

## Typography

**Display Font:** Bricolage Grotesque (`system-ui` fallback) — heavy weights only (520–700); variable optical sizes for true display behavior; `letter-spacing: -0.025em` at hero scale, `-0.015em` at title.
**Body Font:** Inter (`Segoe UI`, system-ui fallbacks) — 400 for body, 500–600 for emphasized UI text. Measure 65–75ch.
**Receipt-mono Font:** JetBrains Mono (`ui-monospace`, `SFMono-Regular` fallbacks) — 500–700. Drives every numeral field: tariffs, tx_refs, slot times, status pills.
**Ethiopic Display Font:** Noto Serif Ethiopic (`serif` fallback) — 700 only, for every Amharic glyph at display scale. The ኢ-ገበያ wordmark is set in this face.

**Character:** Bricolage is a grotesk with character (slight optical-size contrast, broken-curve terminals), chosen over DM Sans / Plus Jakarta because those are training-data defaults for "modern SaaS". Inter is the workhorse and never the display. JetBrains Mono earns its place because telebirr receipts and tx_refs are data, not costume. Noto Serif Ethiopic is the only face with real Amharic ligature fidelity — substituting anything else into the wordmark or Amharic headings degrades the identity.

### Hierarchy

- **Display** (700, `clamp(2.75rem, 6.2vw, 6rem)`, line-height 1.02, tracking -0.025em): hero headlines only on Persuade surfaces; never below 2.5rem on mobile.
- **Headline** (700, `clamp(2rem, 5vw, 3.5rem)`, 1.05, -0.025em): section H2 in landing; dashboard page titles.
- **Title** (700, `clamp(1.5rem, 3vw, 2.25rem)`, 1.1, -0.015em): section H3, plan-card title, modal title, large list-item label.
- **Body** (400, `1rem`, 1.6, 65–75ch): default paragraph and most UI copy.
- **Label** (500 mono, `0.75rem`, 1.4, tracking 0.08em, uppercase): receipt-mono eyebrow ("PRICING", "TODAY'S QUEUE · ADDIS TIME", "TELEBIRR · RECEIPT"), status pills.
- **Ethiopic Display** (700 Noto Serif Ethiopic, `clamp(1.5rem, 4vw, 3.5rem)`, line-height 0.95): every Amharic wordmark or scoped Amharic heading extension.
- **Receipt Mono** (500, `0.85rem`, 1.4): mono numerals inside tariff rows, queue rows, deposit receipts, slot lists.

### Named Rules

**The Mono-For-Data Rule.** Any numeral that captures a tariff, an amount, a slot time, a tx_ref, a queue position, or a date stamp uses JetBrains Mono. Mixing Inter into those fields collapses the receipt metaphor; the mono is how the surface tells the user "this is the data inside your booking."

**The Inter-Is-Not-Display Rule.** Inter never appears above `1.125rem` as a heading element. A surface that ships a 3rem Inter headline has slipped into SaaS habit; rework against Bricolage.

## Layout

The page is a top-to-bottom receipt. Container is `max-w-6xl` on Persuade surfaces (Landing), `max-w-3xl` on dense pricing tabs, `max-w-xl` for the Business Hours card. Horizontal padding scales `px-5 sm:px-8 lg:px-12` (`--spacing-page-x` family); section vertical rhythm is `py-16 lg:py-24` (`--spacing-section-y` family). The masthead plank is a single `border-b-2 border-ink` line capping the top of every Persuade page — wood-rule geometry, never a centered logo lockup.

The booking flow (`/:slug/book`) follows the receipt's own three rows: **what is being charged / who is paying / what this confirms**. Each step is one hairline-ruled paragraph of a single receipt, not a multi-card wizard.

Dashboard (`/dashboard/*`) is the **Operate** register: counter-band sidebar in `--color-canvas`, `--color-surface-raised` panels with `--color-ink-rule` hairlines, no card shadows, Booking-status row living in receipt-mono. Spacing tightens to `p-6` panels on the dashboard since the operating scene chieftains scan over polish.

Mobile is the operating mode of primary user (owner-on-phone, often on a Tecno/Infinix on 3G). Every page must work at 360px with the same receipt topology; nav collapses to a single cream dropdown panel with ink-rule dividers, no hamburger modal chrome. Touch targets ≥ 44×44px.

## Elevation & Depth

The world is **flat by default**. Depth is conveyed tonally — paper ground → bleached-paper card → counter band — never by ambient shadow. There is no `shadow-sm`, no `shadow-lg`, no `shadow-2xl` shadow family. The exception is one authored moment per surface, listed below; everywhere else, the surface is hairline-divided, not lifted.

### Shadow Vocabulary (a vocabulary of one)

- **Pinned-notice offset** (`0 1px 2px rgba(26, 20, 17, 0.08)`, optional + `0 4px 12px rgba(26, 20, 17, 0.10)` on hover): the only shadow in the system. Lives under a single pinned notice at a time to make the wall metaphor real. Tailwind: avoid the named `shadow-*` utilities; emit the literal `box-shadow` inline.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. The pinned-notice shadow appears only as the authored "this is pinned" affordance on a Hero / notice / highlighted plan-card. Any other use of `shadow-sm` / `shadow-lg` is a defect.

**The No-Glass Rule.** `backdrop-blur`, `backdrop-filter: blur(20px)`, `bg-white/90 backdrop-blur` — none of these exist. Navbar's scrolled-in `saturate(180%) blur(4px)` is the lone exception, kept because the Navbar serves a scroll-aware utility, not decorative sheen; do not extend it elsewhere.

## Shapes

Corners are 2px (`--radius-card`). Cards, inputs, primary buttons, badges, chips, the take-a-number square — all 2px. There is no `rounded-lg`, no `rounded-xl`, no `rounded-2xl`, no `rounded-full` in the system *except* the literal take-a-number chip on the queue row (which accepts up to 2px — square aspect, not pill). Buttons are never pills: a received receipt is never a rounded shape.

**Form language:** 1px solid `--color-ink-rule` everywhere dividers are needed. Inputs are 1px dashed `--color-ink-rule-dashed` (the receipt tear-line), 2px `--color-primary` on focus — not a glowing box, an underline thickening. Disabled inputs are dashed `--color-ink-rule` at lower alpha.

## Components

### Buttons

- **Shape:** 2px radius (`rounded-card`), no shadow. Padding 16px 24px for primary, 12px 24px for secondary/UI buttons.
- **Primary ("deposit / take a number"):** `--color-primary` fill, `--color-surface-raised` text, Bricolage heavy (`--font-display` 700). Hover → `--color-primary-deep`. Focus → 2px `--color-focus` ring offset. Full-width on mobile, auto-width on desktop.
- **Secondary (mono outline):** 1px dashed `--color-ink-rule-dashed` border, `--color-ink` text, JetBrains Mono uppercase tracked +0.08em. Hover → border thickens slightly or text deepens; never fills.
- **Counter (espresso button on a `--color-canvas` band):** `--color-primary` fill on counter, `--color-surface-raised` text — same shape as primary, used when the inverted band would hide a transparent-button ghost.
- **Ghost / link:** `--color-link` (`#063F2D`) text, underline on hover, no fill. Used for in-paragraph links and the "log in" nav link.
- **Destructive:** `--color-accent` (`#D33426`) fill, `--color-surface-raised` text. Rare; reserves the deposit-action emphasis for green.

### Inputs / Fields

- **Style:** 1px dashed `--color-ink-rule-dashed` underline on `--color-surface`, no surrounding box, font `--font-body`. The `.receipt-input` helper class in `index.css` is canonical.
- **Focus:** border-bottom thickens to 2px `--color-primary`. Never a box-ring glow, never `#1E3A8A` focus-ring (off-world).
- **Error:** border switches to `--color-accent`; helper text in mono `--color-accent`. No red-banner full card.
- **Disabled:** dashed border at lower alpha; text `--color-ink-soft`; cursor `not-allowed`.

### Cards / Receipt Surfaces

- **Corner Style:** 2px radius.
- **Background:** `--color-surface-raised` (`#FBF8F2`) on a `--color-surface` (`#F6F1E8`) ground. Highlighted cards (e.g. the Pro plan) invert: `--color-ink` fill, `--color-surface-raised` text, 2px `--color-primary` outline.
- **Border:** 1px solid `--color-ink-rule`. Optionally preceded by a 2px `--color-primary` `::before` rule when the card is a receipt dramatizing a payment (the `.receipt-rule-top` helper in `index.css`).
- **Shadow Strategy:** none (see Elevation). Exception: the highlighted plan-card or hero notice may use the pinned-notice offset.
- **Internal Padding:** `p-5 sm:p-6 lg:p-7` (`--spacing-card-pad` family).

### Status Pills (Bookings list)

- **Style:** mono uppercase inside a `--color-primary` / `--color-accent` / `--color-ink-rule` hairline outline. Never soft-pastel `bg-green-100 text-green-800` chrome.

### Take-a-Number Chip

- **Style:** small `--color-primary` swatch square (1.75rem × 1.75rem default, 2.25rem on queue rows), `--color-surface-raised` text, `--font-receipt` 700, 2px radius. Used for queue position on the public booking page and as the booking serial number on the receipt card.

### Wordmark / Masthead Lockup

- **Style:** stacked — heavy Amharic `ኢ-ገበያ` in Noto Serif Ethiopic above Bricolage "Egebeya" beneath, both set in `--color-ink` on cream. On a `--color-canvas` band both flip to `--color-surface-raised` with the Latin line in `--color-canvas-soft`. The ኢ glyph marker is the visual key.

### Navigation (Navbar)

- **Style:** fixed top, transparent over the hero, scrolled-in `--color-surface` with 1px ink-rule bottom hairline + `saturate(180%) blur(4px)` backdrop. Wordmark left, Bricolage link text right. CTA is a telebirr-filled "Take a number" pill (2px — not rounded-full). Mobile menu is a single cream dropdown panel with ink-rule dividers between link rows; no off-canvas modal.

### Puck Editor Chrome

- **Style:** the editor's outer shell (sidebar, top bar, drawer) is themed to kebele tokens via the `--puck-color-*` CSS variables Puck exposes (see `.impeccable/design.json` for the override map). The **canvas content** is NOT kebele-themed — it shows the actual tenant-built site, which has its own visual rules per the Puck block components (Hero / Services / Gallery / BookingForm / etc.). The two surfaces are deliberately separate: chrome belongs to Egebeya, canvas belongs to the tenant.

## Do's and Don'ts

### Do:

- **Do** use `bg-primary`, `bg-surface`, `bg-surface-raised`, `text-ink`, `text-ink-soft`, `border-ink-rule`, `bg-canvas`, `text-canvas-soft`, `text-link`, `focus:ring-focus` Tailwind utilities (the semantic aliases in `src/index.css`'s `@theme`).
- **Do** retain the bare kebele primitives (`bg-paper`, `bg-telebirr`, `font-receipt`, `rounded-rd-card`) when the surface dramatizes the explicit Ethiopian-receipt moment.
- **Do** pair Bricolage + Noto Serif Ethiopic + Inter + JetBrains Mono — these four faces ARE the design. Loading something else requires an authored reason.
- **Do** tint secondary text from the surface hue (`--color-ink-soft` on cream, `--color-canvas-soft` on counter), never gray.
- **Do** reserve `--color-primary` green for the deposit / commit / book action and the take-a-number chip; everywhere else prefer ink + counter.
- **Do** ship 2px radius (`rounded-card`) everywhere; deny `rounded-xl` / `rounded-2xl` / `rounded-full` defaults.
- **Do** keep interaction chrome mono (status pills, eyebrows, dates, slot times); use Bricolage only for genuine headline moments.
- **Do** replace inputs with `.receipt-input` dash-underline treatment on customer-facing Booking and Settings forms.

### Don't:

- **Don't** use `#1E3A8A` (navy), `#F59E0B` (amber), or any Tailwind `bg-blue-*` / `bg-amber-*` / `text-blue-*` literal. They are off-world; the unification pass deletes them.
- **Don't** use `bg-white` / `bg-gray-50` / `bg-gray-100` / `text-gray-400` / `text-gray-500` / `text-gray-700` / `border-gray-200` / `border-gray-300`. They read as a different design system. Use the kebele surface/ink-rule aliases instead.
- **Don't** apply box-shadow defaults (`shadow-sm`, `shadow-lg`, `shadow-xl`). The world is flat; only the pinned-notice offset is valid.
- **Don't** ship gradient decorations (`bg-gradient-to-br`, `rounded-full bg-[#F59E0B]/20 blur-3xl`). Gradients and blurred "blobs" do not exist in this world.
- **Don't** set Inter above 1.125rem as a heading. Inter-as-display is the typo-rut of generic SaaS.
- **Don't** use `rounded-full` for buttons. Pills contradict the receipt metaphor; buttons are 2px rectangles.
- **Don't** tint shadow, focus, or border colors with navy or amber. The focus ring is `--color-focus` (telebirr-deep), border is `--color-ink-rule`, shadows are the pinned-notice offset only.
- **Don't** invent blue/red/green-purple icon-chip variants (the dead `Features.tsx` had `bg-purple-100` / `bg-blue-100` / `bg-green-100` icon tiles). Status color is `--color-primary` (success), `--color-accent` (warning), `--color-canvas-soft` (neutral).
- **Don't** carry the kebele canvas over to the Puck editor's *canvas content* — the canvas belongs to the tenant's published site; the chrome belongs to Egebeya. Theme Puck's outer shell only.
