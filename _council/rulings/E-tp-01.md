ID: E-tp-01 (+ Fresha pair F-sa-200)
Name: Team member profiles
Surface: merchant SaaS (edit); bio/image surface on the consumer booking page
Category: team-permissions
Class: PARTIAL
Fresha behaviour: Merchants showcase staff profiles with bio, image and specialties. KB: COMPARE-01:180 (hc/276,611; fb-marketplace), docs/Gap.md:295-298.
Egebeya current state: staff.bio and staff.imagePath exist (src/db/schema.ts:77-85, verified) and PUT /api/tenant/staff/:id already accepts them (src/api/tenant.ts:214, verified); StaffPage edits name/title only (src/pages/Dashboard/StaffPage.tsx:35-36).
Blockers: none (legal conditions inside the same PR, not a blocker)
Debate summary: A called it "a dead type surface with live plumbing — the definition of a small diff": NEXT, Band 2 #9 in the staff-record bundle with E-tp-05. B priced S and listed it first-weeks-eligible; wire the picker to the existing upload path (tenant.ts:1401). C gave GREEN-with-conditions: staff photos are employee personal data → consent at hire-onboarding and media cleanup on staff delete in the SAME PR; bio text becomes consumer-visible UGC with E-mg-05-lite hygiene. D rated impact LOW-MED — the owner's Instagram handles faces today. Chair cleared NEXT with C's conditions; the bundle-vs-first-week slot and whether consent turns it into a mini-bundle stayed contested.
Council ruling: BUILD NEXT
Closure method (if BUILD): scope: bio textarea + image picker on StaffPage, writing through the existing PUT /staff/:id; upload reuses the existing media path (tenant.ts:1401). Entity changes: none (columns exist). Endpoint changes: none (endpoint already accepts bio/imagePath). UI changes: StaffPage form fields; bio/image rendered on consumer staff cards; hire-onboarding consent line; media cleanup wired into the staff-delete path (tenant.ts:248 region) in the same PR; am/en for all strings. Test additions: bio/imagePath round-trip through PUT; delete removes media; staff-scoped eq(tenantId) isolation preserved.
Substitute method (if any): none.
Owner: Product Owner
Effort: S
Money path: NO
Protected decision referenced (if any): PDPL employee-data handling (C condition); COMPARE-03 review-hygiene posture for consumer-visible text.
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: OBSERVED-workaround frequency (dead type surface, code-proven); workaround = owner's Instagram handles the faces; notice day 1: n.
Confidence: HIGH (all four GREEN; only band slot contested)
CEO ruling (final): BUILD NEXT — small bio+image form fields; the endpoint already accepts them.
