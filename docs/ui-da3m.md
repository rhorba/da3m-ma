# UI Foundation: Da3m.ma
**UX Reference**: docs/ux-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: UI Designer

## 1. Design Approach
- **Strategy**: Tailwind CSS + shadcn/ui with a custom token layer.
- **Rationale**: Framework for speed (YAGNI); custom treatment only where the product's meaning lives — the tri-state result cards, the freshness stamp, the pipeline cards.
- **Identity constraint (from PRD §7)**: must **not** read as a government portal. No red/green national palette, no crest, no ministry-style serif headers, no "portail officiel" visual language. Da3m should feel like a sharp independent advisor: warm, plain-spoken, confident.
- **Anti-default**: no purple gradients, no glassmorphism, no stock 3D illustrations of people shaking hands. Typography and colour carry the brand.

## 2. Design Tokens
```css
:root {
  /* Colour — "ink, teal, saffron" */
  --color-primary:     #0F5E5A;  /* deep teal — primary actions, eligible */
  --color-primary-fg:  #FFFFFF;
  --color-accent:      #E3A018;  /* saffron — needs_info, deadlines approaching, highlights */
  --color-accent-fg:   #1A1712;
  --color-background:  #FBF9F5;  /* warm paper */
  --color-surface:     #FFFFFF;
  --color-border:      #E6E0D6;
  --color-text:        #1A1712;
  --color-text-muted:  #6A645A;
  --color-success:     #0F5E5A;  /* same as primary: eligible == good */
  --color-warning:     #946100;  /* saffron darkened for text: 5.0:1 on paper */
  --color-error:       #B03A2E;  /* deadlines J-2, destructive */
  --color-ineligible:  #736D63;  /* muted, not alarming — ineligible is information, not failure: 4.9:1 */

  /* Typography */
  --font-sans:    "Inter", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;          /* headings only, soft optical size */
  --font-arabic:  "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif;

  --text-xs: 0.75rem;  --text-sm: 0.875rem; --text-md: 1rem;
  --text-lg: 1.25rem;  --text-xl: 1.75rem;  --text-2xl: 2.5rem;

  /* Spacing — 4px base */
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem;    --space-6: 1.5rem; --space-10: 2.5rem;

  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 16px;
  --shadow-card: 0 1px 2px rgba(26,23,18,.06), 0 2px 8px rgba(26,23,18,.04);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-background: #12110E; --color-surface: #1B1A16; --color-border: #2E2B25;
    --color-text: #F2EEE6; --color-text-muted: #A59F93;
    --color-primary: #3FA59E; --color-accent: #F0B63A; --color-ineligible: #7A756C;
  }
}
:root[data-theme="dark"] { /* same overrides as above */ }
```
Fraunces is used for page titles and the hero only; everything functional is Inter. Arabic headings use Plex Sans Arabic at heavier weight rather than a display face.

## 3. Component Inventory
| Component | Reuse Existing | Build New | Notes |
|---|---|---|---|
| Button, Input, Select, RadioGroup, Dialog, Sheet, Toast, Table, Tabs, Skeleton, Badge | shadcn/ui | No | Retokenised |
| Command (programme search) | shadcn/ui | No | |
| **WizardStepper** | No | **Yes** | Step dots + "Étape 2/5"; big tap targets; RadioCards not dropdowns |
| **RadioCard** | No | **Yes** | Full-width selectable card for wizard answers |
| **ResultGroup** | No | **Yes** | Eligible / À préciser / Non éligible sections; counts; ineligible collapsed |
| **ProgramResultCard** | No | **Yes** | Operator, kind, amount range, StatusDot, FreshnessStamp, actions |
| **ReasonList** | No | **Yes** | Failing criteria / missing fields, localised |
| **InlineQuestion** | No | **Yes** | Answers a `needs_info` field inline and re-evaluates |
| **StatusDot** | No | **Yes** | open / upcoming / rolling / closed — colour + text label |
| **FreshnessStamp** | No | **Yes** | "vérifié le 12/09/2026"; turns warning at > 30 days (admin only) |
| **NonAffiliationNote** | No | **Yes** | Short, visible on results + programme pages |
| **PipelineBoard** | No | **Yes** | Columns per stage; dnd-kit; keyboard-movable cards |
| **DossierCard** | No | **Yes** | Client, programme, DeadlineChip, checklist progress |
| **DeadlineChip** | No | **Yes** | neutral > J-7, saffron ≤ J-7, red ≤ J-2 — always with text "J-5" |
| **RuleDiffPreview** (admin) | No | **Yes** | Outcome deltas across test profiles before publish |
| LanguageSwitcher | No | Yes | Sets `lang` + `dir` on `<html>` |

## 4. Responsive Breakpoints
| Breakpoint | Width | Layout Notes |
|---|---|---|
| Mobile | < 768px | B2C primary target. Wizard one question per screen; results single column; sticky "Enregistrer" bar. Cabinet usable read-only-ish: board becomes a stage-tabbed list |
| Tablet | 768–1024px | Results two columns; Cabinet board horizontally scrollable columns |
| Desktop | > 1024px | Cabinet primary target: sidebar nav + board; client detail split view (profile left, runs/dossiers right) |

## 5. RTL / Arabic
- `dir="rtl"` on `<html>` for `ar`; logical properties only (`ms-`, `me-`, `ps-`, `pe-` in Tailwind).
- Amounts, dates and "J-5" wrapped in `<bdi>`; MAD amounts formatted with `Intl.NumberFormat('ar-MA')` using Latin digits (the convention on Moroccan official documents).
- Pipeline board column order mirrors in RTL (first stage on the right).
- DoD for any AR screen: native-reader pass on real copy — never mirrored French (Bina lesson).

## 6. Accessibility Baseline
- Contrast (computed, WCAG 2.1 formula): teal `#0F5E5A` on paper `#FBF9F5` = 7.2:1; white on teal = 7.6:1; muted text `#6A645A` = 5.6:1; ineligible `#736D63` = 4.9:1; warning text `#946100` = 5.0:1; error `#B03A2E` = 5.7:1. Saffron `#E3A018` is 2.2:1 on paper, so it is **never** used for text — only as a fill behind dark `#1A1712` text (7.9:1). Dark mode: teal `#3FA59E` = 6.4:1, ineligible `#7A756C` = 4.1:1 (large text / icons only in dark mode).
- Outcome is never conveyed by colour alone: icon + group heading + text.
- Wizard: each step is a `<fieldset>` with `<legend>`; RadioCards are real radio inputs.
- Pipeline board: cards movable by keyboard (dnd-kit keyboard sensor) with live-region announcements ("Dossier déplacé vers Déposé").
- Focus: 2px teal outline + 2px offset on all interactive elements.
- Reduced motion respected for board and result transitions.
