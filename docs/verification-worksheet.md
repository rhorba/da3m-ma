# Verification worksheet — the 10 draft programmes

**Generated 2026-09-18 from `data/programs/*.json`. Procedure: `docs/curation-guide.md`.**

Every programme below is a draft: `verification.status` is `draft`, so `pnpm catalogue:sync` skips it and nothing reaches the public catalogue (ADR-8). The engine, the wizard, the results page and the programme pages are all finished and tested — this file is the last thing standing between them and a usable beta.

## How to use this

For each programme: open its official source, read the **Claims to confirm** list, and correct anything wrong in the JSON file. Then answer the **Decisions needed** questions — those are places where the official page was ambiguous and a judgement was recorded as an assumption rather than a fact. When a programme is right:

```jsonc
"verification": {
  "status": "verified",        // was "draft"
  "verifiedAt": "2026-09-18",  // the date you checked the source
  "verifiedBy": "rhorba",      // your name, for the audit trail
  "notes": "..."               // keep; append anything you corrected
}
```

Then `pnpm catalogue:validate` (checks rules + golden profiles), `pnpm catalogue:sync` (publishes verified files as immutable versions), and commit. A programme can be signed off on its own — there is no need to do all ten at once.

## Source reachability

All 11 official source URLs across the ten programmes returned HTTP 200 on 2026-09-18,
so nothing has moved since they were consulted on 2026-09-17. No dead links to work
around.

## The ten at a glance

| Programme | Operator | Decisions needed |
|---|---|---|
| `bourse-incubation` | Tamwilcom | 2 |
| `damane-express` | Tamwilcom | 3 |
| `damane-intelak-rural` | Tamwilcom | 1 |
| `damane-intelak` | Tamwilcom | 2 |
| `innov-dev` | Tamwilcom | 3 |
| `pret-amorcage` | Tamwilcom | 0 |
| `pret-honneur-startup` | Tamwilcom | 2 |
| `start-tpe` | Tamwilcom | 1 |
| `tech-boost` | Tamwilcom | 2 |
| `tech-start` | Tamwilcom | 2 |

**18 decisions across 10 programmes.**

---

## Bourse d'incubation (offre Startup VB)

`data/programs/bourse-incubation.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | grant |
| Status | rolling |
| Amount | up to 200 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilstartups.ma/bourse_incubation.php> (consulted 2026-09-17) — Tamwilcom Startups: Bourse d'incubation detail
- <https://www.tamwilcom.ma/nos-solutions/startups> (consulted 2026-09-17) — Tamwilcom: Startups overview (VB offer)

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `legal_form` is none of [none, auto_entrepreneur]  
    _Réservé aux entreprises constituées en société de droit marocain._
  - `has_partner_support` is true  
    _Votre candidature doit être validée par une structure d'accompagnement partenaire de Tamwilcom (incubateur, accélérateur)._
  - `innovation_stage` is poc_validated  
    _Réservé aux startups ayant validé leur preuve de concept (POC) et qui développent leur prototype ou MVP._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] startup under Moroccan law, past POC, building prototype or MVP; application validated by a Tamwilcom (SNGFE) partner; grant up to 90% of the investment programme, capped at 200,000 DH; min 10% contribution; conditional on a support agreement.
- [ ] Part of the Startup Venture Building offer (Ministry of Digital Transition, Digital Morocco 2030).

**Decisions needed** — the official page was ambiguous here

- [ ] 'startup de droit marocain' = an incorporated company (excludes project holders and auto-entrepreneurs) — confirm whether a not-yet-incorporated team can apply.
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.

**Golden profiles** (3): `incorporated startup past POC` → eligible, `auto-entrepreneur` → ineligible, `legal form unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Damane Express

`data/programs/damane-express.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | guarantee |
| Status | rolling |
| Amount | not published |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilcom.ma/nos-solutions/tres-petites-entreprises> (consulted 2026-09-17) — Current product page: beneficiaries and sector exclusions
- <https://www.bkam.ma/content/download/835688/9083030/Charte%20TPE.pdf> (consulted 2026-09-17) — Bank Al-Maghrib Charte TPE, art. 2: TPE definition

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `legal_form` is not none  
    _Réservé aux entreprises déjà créées (personne physique ou morale)._
  - `revenue_band` is one of [none, lt_1m, 1m_10m]  
    _Réservé aux entreprises dont le chiffre d'affaires annuel hors taxes ne dépasse pas 10 millions de dirhams._
  - `sector` is none of [real_estate_development, high_sea_fishing]  
    _La promotion immobilière et la pêche hauturière ne sont pas éligibles._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] TPE under Moroccan law, all sectors except real-estate development and high-sea fishing; guarantees operating and investment loans.

**Decisions needed** — the official page was ambiguous here

- [ ] 'TPE' uses Bank Al-Maghrib's official definition (turnover ≤ 10 MDH, Charte TPE art. 2); the Tamwilcom page doesn't restate a threshold.
- [ ] 'TPE' implies an existing business, so project holders (legal_form = none) are excluded.
- [ ] no guarantee rate or amount cap is published on the current page.

**Golden profiles** (5): `small SARL` → eligible, `auto-entrepreneur` → eligible, `project not yet created` → ineligible, `high-sea fishing company` → ineligible, `turnover unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Damane Intelak Al Moustatmir Al Qarawi

`data/programs/damane-intelak-rural.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | guarantee |
| Status | rolling |
| Amount | up to 1 200 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilcom.ma/nos-solutions/tres-petites-entreprises> (consulted 2026-09-17) — Current product page
- <https://www.finances.gov.ma/SiteAssets/Lists/Actualits/AllItems/intelak-moustatmir-al-qarawi.pdf> (consulted 2026-09-17) — CCG product sheet published by the Ministry of Finance: full eligibility criteria

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `is_rural` is true  
    _Réservé aux activités exercées en milieu rural._
  - `revenue_band` is one of [none, lt_1m, 1m_10m]  
    _Réservé aux entreprises dont le chiffre d'affaires annuel hors taxes ne dépasse pas 10 millions de dirhams._
  - `sector` is none of [real_estate_development, high_sea_fishing]  
    _La promotion immobilière et la pêche hauturière ne sont pas éligibles._
  - **ANY of:**
    - `company_age_months` <= 60  
      _Réservé aux entreprises créées depuis 5 ans au maximum._
    - `exports_to_africa` is true  
      _La limite de 5 ans ne s'applique pas aux entreprises exportatrices vers l'Afrique._
    - `sector` is agriculture  
      _La limite de 5 ans ne s'applique pas non plus aux petites exploitations agricoles._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct


**Decisions needed** — the official page was ambiguous here

- [ ] 'petites exploitations agricoles' (exempt from the 5-year limit) is approximated as sector = agriculture, with size bounded by the 10 MDH turnover rule.

**Golden profiles** (4): `young rural business` → eligible, `established small farm` → eligible, `urban business` → ineligible, `location unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Damane Intelak (programme Intelaka)

`data/programs/damane-intelak.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | guarantee |
| Status | rolling |
| Amount | up to 1 200 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilcom.ma/nos-solutions/tres-petites-entreprises> (consulted 2026-09-17) — Current product page: target, 80% cover, no fee
- <https://www.finances.gov.ma/Publication/daag/2020/PresentationMLM%20du%20FAFE%20VF.pdf> (consulted 2026-09-17) — Ministry of Finance, Programme INTELAKA offre produits (2020), p.8 and p.10
- <https://www.bkam.ma/content/download/835688/9083030/Charte%20TPE.pdf> (consulted 2026-09-17) — Bank Al-Maghrib Charte TPE (Dec 2025), art. 2: TPE turnover ≤ 10 MDH

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `revenue_band` is one of [none, lt_1m, 1m_10m]  
    _Réservé aux entreprises dont le chiffre d'affaires annuel hors taxes ne dépasse pas 10 millions de dirhams._
  - `sector` is none of [real_estate_development, high_sea_fishing]  
    _La promotion immobilière et la pêche hauturière ne sont pas éligibles._
  - **ANY of:**
    - `company_age_months` <= 60  
      _Réservé aux entreprises créées depuis 5 ans au maximum._
    - `exports_to_africa` is true  
      _La limite de 5 ans ne s'applique pas aux entreprises exportatrices vers l'Afrique._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct


**Decisions needed** — the official page was ambiguous here

- [ ] 'jeunes porteurs de projets' means a business not yet created is eligible, so no legal-form criterion.
- [ ] The 2% interest rate is from 2020 and is shown nowhere as a rule.

**Golden profiles** (6): `young small business` → eligible, `older exporter to Africa` → eligible, `turnover above 10 MDH` → ineligible, `older, not exporting` → ineligible, `real-estate developer` → ineligible, `age and export unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Innov Dev (Fonds Innov Invest)

`data/programs/innov-dev.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | loan |
| Status | rolling |
| Amount | not published |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilcom.ma/nos-solutions/fonds-innov-invest> (consulted 2026-09-17) — Tamwilcom: Fonds Innov Invest, Innov Dev section

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `legal_form` is none of [none, auto_entrepreneur]  
    _Réservé aux entreprises constituées en société de droit marocain._
  - `raised_external_funding` is true  
    _Réservé aux entreprises ayant réalisé une levée de fonds auprès d'investisseurs externes._
  - `is_innovative` is true  
    _Réservé aux projets innovants._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] participatory loan for innovative SMEs in their growth phase, for investment and operating needs; beneficiaries are SMEs under Moroccan law that have raised funds from external investors and carry innovative projects.

**Decisions needed** — the official page was ambiguous here

- [ ] 'PME de droit marocain' = incorporated company (excludes project holders and auto-entrepreneurs).
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.
- [ ] no amount, rate or SME size threshold is published on the page (Bank Al-Maghrib's charter defines only TPE) — size is NOT encoded.

**Golden profiles** (3): `funded innovative SA` → eligible, `no external funding` → ineligible, `funding unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Prêt d'amorçage (offre Startup VB)

`data/programs/pret-amorcage.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | loan |
| Status | rolling |
| Amount | up to 2 000 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilstartups.ma/pret_amorcage.php> (consulted 2026-09-17) — Tamwilcom Startups: Prêt d'amorçage detail
- <https://www.tamwilcom.ma/nos-solutions/startups> (consulted 2026-09-17) — Tamwilcom: Startups overview (VB offer)

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `partner_invested` is true  
    _Réservé aux startups dans lesquelles une structure partenaire de Tamwilcom a investi._
  - `company_age_months` >= 24  
    _Réservé aux startups ayant au moins 2 ans d'activité._
  - `revenue_growing` is true  
    _Réservé aux startups dont le volume d'affaires est en croissance._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] startups invested in by partner support organisations, with at least 2 years of activity and positive revenue growth, aiming for a Series A raise; mezzanine loan without collateral up to 2,000,000 DH, not exceeding 50% of the partner's equity investment; 5% (excl. tax) rate; max 5 years incl. 1 year deferral; early repayment on Series A.
- [ ] NOT ENCODED: the Series A intention and the 50%-of-partner-investment cap (a loan-sizing rule, not eligibility).
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.

**Decisions needed:** none recorded.

**Golden profiles** (3): `backed, 3 years, growing` → eligible, `too young` → ineligible, `growth unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Prêt d'honneur startup (offre Startup VB)

`data/programs/pret-honneur-startup.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | loan |
| Status | rolling |
| Amount | up to 500 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilstartups.ma/pret_honneur.php> (consulted 2026-09-17) — Tamwilcom Startups: Prêt d'honneur detail
- <https://www.tamwilcom.ma/nos-solutions/startups> (consulted 2026-09-17) — Tamwilcom: Startups overview (VB offer)

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `legal_form` is none of [none, auto_entrepreneur]  
    _Réservé aux entreprises constituées en société de droit marocain._
  - `is_innovative` is true  
    _Réservé aux projets innovants._
  - `has_partner_support` is true  
    _Votre candidature doit être validée par une structure d'accompagnement partenaire de Tamwilcom (incubateur, accélérateur)._
  - `innovation_stage` is mvp_ready  
    _Réservé aux startups ayant dépassé le stade du MVP et qui préparent la mise sur le marché._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] startup under Moroccan law with an innovative project past MVP, to finalise and deploy the product towards product-market fit; application validated by a Tamwilcom (SNGFE) partner; interest-free, collateral-free loan up to 90% of the investment programme, capped at 500,000 DH; min 10% contribution; repayment over max 5 years with up to 2 years' deferral; decision within 30 days of a complete file.

**Decisions needed** — the official page was ambiguous here

- [ ] same as bourse-incubation for 'startup de droit marocain'.
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.

**Golden profiles** (3): `innovative startup past MVP` → eligible, `not innovative` → ineligible, `innovation unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Start-TPE

`data/programs/start-tpe.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | loan |
| Status | rolling |
| Amount | not published |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilcom.ma/nos-solutions/tres-petites-entreprises> (consulted 2026-09-17) — Current product page
- <https://www.finances.gov.ma/Publication/daag/2020/PresentationMLM%20du%20FAFE%20VF.pdf> (consulted 2026-09-17) — Ministry of Finance, Programme INTELAKA offre produits (2020), p.11
- <https://www.bkam.ma/content/download/835688/9083030/Charte%20TPE.pdf> (consulted 2026-09-17) — Charte TPE, art. 2

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `has_intelaka_loan` is true  
    _Réservé aux bénéficiaires d'un crédit d'investissement garanti dans le cadre du programme Intelaka._
  - `revenue_band` is one of [none, lt_1m, 1m_10m]  
    _Réservé aux entreprises dont le chiffre d'affaires annuel hors taxes ne dépasse pas 10 millions de dirhams._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct


**Decisions needed** — the official page was ambiguous here

- [ ] TPE turnover ≤ 10 MDH (Bank Al-Maghrib definition).

**Golden profiles** (3): `Intelaka borrower` → eligible, `no Intelaka loan` → ineligible, `loan status unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Tech Boost (Fonds Innov Invest)

`data/programs/tech-boost.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | loan |
| Status | rolling |
| Amount | up to 750 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilstartups.ma/techBoost.php> (consulted 2026-09-17) — Tamwilcom Startups: Tech Boost detail
- <https://www.tamwilcom.ma/nos-solutions/fonds-innov-invest> (consulted 2026-09-17) — Tamwilcom: Fonds Innov Invest overview

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `has_partner_support` is true  
    _Votre candidature doit être validée par une structure d'accompagnement partenaire de Tamwilcom (incubateur, accélérateur)._
  - `innovation_stage` is mvp_ready  
    _Réservé aux startups ayant dépassé le stade du MVP et qui préparent la mise sur le marché._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] startups past MVP, application validated by a Tamwilcom partner, going to market towards product-market fit; honour loan (no interest, no collateral) up to 80% of eligible spend, capped at 500,000 DH (750,000 DH for deep tech); 20% contribution; repayment over max 5 years with up to 2 years' deferral. amountMaxMad uses the deep-tech cap.

**Decisions needed** — the official page was ambiguous here

- [ ] 'past MVP, aiming for product-market fit' = innovation_stage mvp_ready (not growth).
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.

**Golden profiles** (3): `incubated startup past MVP` → eligible, `still building the MVP` → ineligible, `stage unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

---

## Tech Start (Fonds Innov Invest)

`data/programs/tech-start.json`

| | |
|---|---|
| Operator | Tamwilcom |
| Kind | grant |
| Status | rolling |
| Amount | up to 400 000 DH |
| Opens / closes | — / — |
| Application URL | none — page links to the source instead |

**Sources** (open these to check against)

- <https://www.tamwilstartups.ma/techStart.php> (consulted 2026-09-17) — Tamwilcom Startups: Tech Start detail
- <https://www.tamwilcom.ma/nos-solutions/fonds-innov-invest> (consulted 2026-09-17) — Tamwilcom: Fonds Innov Invest overview

**Eligibility rules as the engine will apply them**

- **ALL of:**
  - `has_partner_support` is true  
    _Votre candidature doit être validée par une structure d'accompagnement partenaire de Tamwilcom (incubateur, accélérateur)._
  - `innovation_stage` is poc_validated  
    _Réservé aux startups ayant validé leur preuve de concept (POC) et qui développent leur prototype ou MVP._

**Documents listed:** none. Check whether the source publishes a list.

**Claims to confirm** — taken from the official page; tick or correct

- [ ] startups past POC, application validated by a Tamwilcom partner, aiming to build a prototype or MVP; grant up to 80% of eligible spend, capped at 200,000 DH (400,000 DH with an invention patent); 20% own contribution; conditional on a support agreement. amountMaxMad uses the patent cap; the summary states both.

**Decisions needed** — the official page was ambiguous here

- [ ] 'past POC, building MVP' = innovation_stage poc_validated.
- [ ] All Innov Invest / Startup VB products are applied for through Tamwilcom partner support organisations (list: https://www.tamwilstartups.ma/partenaires.php), which run calls with deadlines — check open calls at https://www.tamwilstartups.ma/projets_actuels.php.

**Golden profiles** (4): `incubated startup past POC` → eligible, `idea stage` → ineligible, `no partner support` → ineligible, `support unknown` → needs_info

These pin the behaviour in CI. If you change a rule, the expectations here must still hold or `catalogue:validate` fails — which is the point.

