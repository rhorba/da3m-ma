# Arabic copy: first pass and handover for the native reader (Story 4.7)

**2026-10-10. First pass by the agent; the sign-off still needs a native Moroccan Arabic reader.**

All 240 interface strings in `messages/ar.json` were read against `messages/fr.json`. Programme text in `data/programs/*.json` (titles, summaries, criterion reasons) was not reviewed in this pass.

## Fixed in this pass

- **Number agreement.** Every count used only ICU `one`/`other`, producing "27 برامج". The strings now use `two` / `few` / `many` / `other`: برنامجان, ٣–١٠ برامج, ١١–٩٩ برنامجًا, ١٠٠ برنامج. Affects the results groups, the catalogue count, the claimed-questionnaires notice, the eligible count in Mon espace, and the alert digest subject.
- **Register.** The alerts strings used the formal plural (أكّدوا). They now match the rest of the site, which addresses the reader in the singular (تحقق، لديك).

## For the native reader to decide

1. **Gender.** The site addresses the reader in the masculine singular (أنت مؤهل، هل أنت مغربي…). French uses inclusive forms ("Marocain·e"). Is the masculine acceptable as the neutral default, or should key strings be rephrased to avoid gendered forms (e.g. "هل تقيم خارج المغرب؟")?
2. **MRE question.** "هل أنت مغربي مقيم بالخارج؟" — should it say "من مغاربة العالم" to match the help text, and should it cover people who have returned for good (MDM Invest includes them)?
3. **Digits and separators.** Amounts are written "100.000 درهم" with Western digits and a period. Is that the expected form for a Moroccan audience, or should it be "100 000" or Eastern Arabic digits?
4. **Terms of art.** Please confirm: مقاول ذاتي (auto-entrepreneur), الإنعاش العقاري (promotion immobilière), المسطرة (démarche), بشكل مستمر (au fil de l'eau), نموذج أولي (MVP).
5. **Tone.** "الاطلاع على المسطرة" for "Voir la démarche" reads administrative. Is something plainer better on a button?
6. **Programme content.** The Arabic titles, summaries and eligibility reasons in all 27 programme files, especially the 17 added on 2026-10-10.

## How to change a string

Edit `messages/ar.json` (interface) or the `ar` fields in `data/programs/<slug>.json` (programme text), then run `pnpm test` and `pnpm catalogue:validate`. The i18n test fails if a key is missing in any language.
