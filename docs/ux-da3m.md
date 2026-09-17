# UX Foundation: Da3m.ma
**PRD Reference**: docs/prd-da3m.md
**Version**: 1.0 | **Date**: 2026-09-17 | **Author**: UX Designer

## 1. User Personas (minimal — YAGNI)
| Persona | Role | Goal | Pain Point |
|---|---|---|---|
| **Amine**, 26 | Project holder, idea stage, Fès, mostly on mobile | Find out if any programme can fund his first equipment | Every portal assumes he already has a company; he can't tell which apply to him |
| **Nadia**, 41 | Owner of an 8-person SARL in Casablanca, 4 years old | Fund a digitalisation project | Heard of "90% subsidies" on Facebook; can't tell what's real, current, or for her size |
| **Hicham**, 38 | Consultant, 3-person cabinet, ~40 SME clients | Match each client to programmes fast and never miss a deadline | Does the matching in his head + Excel; deadlines live in WhatsApp |
| **Curator** (the user) | Platform admin | Keep every rule correct and current | Programme pages change without notice |

## 2. Information Architecture / Site Map
```
[Da3m.ma]
├── (public)
│   ├── /                         hero + "Vérifier mon éligibilité" + featured open programmes
│   ├── /eligibilite              wizard (5–7 steps)
│   ├── /resultats/[id]           results (anon token or owner)
│   ├── /programmes               filterable catalogue (kind, operator, status, sector)
│   ├── /programmes/[slug]        programme page (SEO)
│   ├── /cabinet                  B2B landing + pricing
│   └── /a-propos                 non-affiliation, method, how we verify
├── (account)
│   ├── /mon-espace               saved profile, past results, alerts
│   └── /mon-espace/profil        edit profile → re-run
├── (cabinet)                     requires firm org
│   ├── /cabinet/tableau          deadlines this week, dossiers by stage, recent runs
│   ├── /cabinet/clients          list + add
│   ├── /cabinet/clients/[id]     profile, eligibility runs, dossiers
│   ├── /cabinet/dossiers         pipeline board
│   └── /cabinet/parametres       members, roles, billing
└── (admin)
    ├── /admin/revisions          review queue (source changed, re-verify due, fetch failing)
    └── /admin/programmes/[slug]  versions, rule editor, preview, publish
```

## 3. Core User Flows

### Flow 1: Amine checks eligibility (anonymous → saved)
```
[Landing] → [Start wizard]
   → Step 1 Situation: idea / registered company / auto-entrepreneur / cooperative
   → Step 2 Project: sector, region
   → Step 3 You: age band, MRE?
   → Step 4 Size (skipped if "idea"): company age, employees band, revenue band
   → Step 5 Need: amount band, purpose (create / equip / innovate / digitalise / export)
   → [Results]
        ├── Eligible (3)          → programme card → "Documents to prepare" → "Official link"
        ├── Need more info (2)    → "Answer 1 question" inline → result updates in place
        └── Not eligible (19)     → collapsed; each with the named reason
   → [Save & get alerts] → sign-up (profile + report claimed) → [Mon espace]
```
Progress is kept in the anon profile after every step; closing the tab loses nothing.

### Flow 2: Hicham onboards a client and opens a dossier
```
[Clients] → [+ Client] → name, contact → same wizard fields (compact, single page)
   → [Run eligibility] → client report (same result groups)
   → on an eligible programme: [Create dossier]
        → deadline prefilled from programme closes_at (editable), owner = me
   → [Pipeline board] → drag: to_prepare → documents_collected → submitted → ...
   → J-7 and J-2 email reminders → [Tableau] "This week" list
```

### Flow 3: Curator handles a source change
```
[Email: 2 review tasks] → [/admin/revisions]
   → task: "Intelaka source changed" → side-by-side text diff
   → no material change?  → [Resolve: no change] (bumps nothing; logs it)
   → material change      → [Open new draft version] (copied from current)
        → edit rules / amounts / dates → [Preview: run 5 saved test profiles, see outcome deltas]
        → [Publish] → programme page revalidated → alerts queued for affected profiles
```
The preview step shows *which outcomes change* before publishing — that's what makes publishing safe.

## 4. Key Screen Wireframes

### Results (mobile-first)
```
┌───────────────────────────────┐
│ Da3m.ma                   FR ▾│
├───────────────────────────────┤
│ Vos résultats                 │
│ Profil : idée · Fès · 26–35   │
│ [Modifier mes réponses]       │
│                               │
│ ✅ ÉLIGIBLE (3)               │
│ ┌───────────────────────────┐ │
│ │ Forsa · Maroc PME         │ │
│ │ Subvention · jusqu'à …    │ │
│ │ ● Ouvert  · vérifié 12/09 │ │
│ │ [Documents] [Site officiel↗]│
│ └───────────────────────────┘ │
│ …                             │
│                               │
│ ❔ À PRÉCISER (2)             │
│ ┌───────────────────────────┐ │
│ │ Intelaka                  │ │
│ │ Votre projet est-il en    │ │
│ │ milieu rural ?  [Oui][Non]│ │
│ └───────────────────────────┘ │
│                               │
│ ✕ NON ÉLIGIBLE (19)      [▾]  │
│   Innov Risk — réservé aux    │
│   entreprises immatriculées   │
│                               │
│ ┌───────────────────────────┐ │
│ │ 🔔 Soyez alerté à         │ │
│ │ l'ouverture des appels    │ │
│ │ [Enregistrer mon profil]  │ │
│ └───────────────────────────┘ │
│ ⓘ Outil indépendant, non      │
│ gouvernemental. Vérifiez      │
│ auprès de l'organisme.        │
└───────────────────────────────┘
```

### Cabinet — pipeline board (desktop)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Cabinet Hicham Conseil   Tableau  Clients  Dossiers  Paramètres      │
├──────────────────────────────────────────────────────────────────────┤
│ Filtres: [Consultant ▾] [Programme ▾] [Échéance ≤ 30j]               │
│ À préparer (6)  │ Pièces réunies (4) │ Déposé (5) │ En instruction (3)│
│ ┌────────────┐  │ ┌────────────┐     │            │                   │
│ │ Atlas Bois │  │ │ Nadia SARL │     │  …         │  …                │
│ │ Forsa      │  │ │ Istitmar   │     │            │                   │
│ │ ⏰ J-5  ◐4/7│  │ │ ⏰ J-12 ●7/7│     │            │                   │
│ └────────────┘  │ └────────────┘     │            │                   │
└──────────────────────────────────────────────────────────────────────┘
   ◐4/7 = checklist progress; ⏰ turns saffron at J-7, red at J-2
```

## 5. Screen States
| Screen | Empty | Loading | Error | Success |
|---|---|---|---|---|
| Wizard | — | Step transition instant (client state); submit shows progress | Keeps answers; "Réessayer" | Redirect to results |
| Results | "Aucun programme ne correspond encore — voici ce qui vous rapprocherait" (top 3 closest by fewest failing criteria) | Skeleton cards | Answers preserved, retry | Groups rendered, eligible expanded |
| Programme page | — | Static | Static fallback | — |
| Mon espace | "Pas encore de profil. [Vérifier mon éligibilité]" | Skeleton | Retry banner | Alert confirmation toast |
| Clients | "Ajoutez votre premier client — 2 minutes" + CTA | Table skeleton | Retry, list kept | Row highlight |
| Pipeline | Columns with "Créez un dossier depuis un résultat éligible" | Column skeletons | Optimistic move reverted with toast | Card settles |
| Review queue | "Tout est à jour ✓ — dernière vérification 02:00" | Skeleton | Fetch errors shown as their own task type | Task disappears, toast |

## 6. UX Principles
1. **Never a dead end.** "Not eligible" always explains why; zero matches shows the closest programmes and what would change the outcome.
2. **Unknown is a question, not a no.** `needs_info` results ask one inline question and update in place.
3. **Freshness is visible.** Status (open/closed/upcoming) and "vérifié le" on every programme card.
4. **Clearly not the government.** Plain independent identity; non-affiliation stated where results are shown, not buried in the footer.
5. **Mobile-first for B2C, desktop-first for Cabinet.** Amine is on a phone; Hicham is at a desk with 40 clients.
6. **Arabic is real.** Fully translated copy reviewed by a native reader; Darija-friendly labels allowed in AR where they're clearer than MSA.
