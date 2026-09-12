# Debate — E-tp-01 Team member profiles
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: bio + image pickers on StaffPage. **NEXT** — `staff.bio`/`staff.imagePath` exist (schema.ts:77-85 verified) and `PUT /api/tenant/staff/:id` accepts them (tenant.ts:214); "only the form fields are missing."
- "A dead type surface with live plumbing is the definition of a small diff." Band 2 #9 (Staff record bundle with E-tp-05). **HIGH**

## 2 · Engineering Lead
- **S**. UI edits name/title only (StaffPage.tsx:35-36); wire picker to existing upload (tenant.ts:1401). Crons: none.
- Listed as independent-of-everything, first-weeks-eligible. **HIGH**

## 3 · Council
- **GREEN-with-conditions** | MS. Dead type surface confirmed; upload path exists.
- Conditions: staff photos = employee personal data → consent at hire-onboarding + deletion on staff delete (media cleanup in the delete path, same PR); bio text on a consumer surface = UGC with E-mg-05-lite hygiene. Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **LOW-MED**. Workaround: the owner's Instagram handles faces; "a staff card with just a name is enough for a market that books the same person as last time."
- Evidence: OBSERVED-workaround (dead type surface, code-proven). Notice day 1: **n**.

## 5 · Challenge round
**C → A:** A calls it "the definition of a small diff"; C attaches an employee-consent + delete-path media-cleanup obligation that must land in the same PR — the floor is higher than two form fields.
**A → B:** band slot mismatch on an S diff — A holds it for Band 2 #9 (Staff record bundle), B lists it first-weeks-eligible.

## 6 · Chair log
- **Agreed:** small UI diff on live plumbing ships NEXT, carrying C's consent + media-cleanup conditions.
- **Contested:** bundle-with-E-tp-05 (A) vs independent first-week (B); whether C's PDPL conditions make it a mini-bundle.
- **Escalation:** None.
- **Closure state:** CLEARED
