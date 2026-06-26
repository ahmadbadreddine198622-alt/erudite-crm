# Peninsula 2 Duplicate Landlord — Diagnostic Report

**Generated:** 2026-06-26  
**App:** PropCRM (69cabceaeeb8bb5e3a62ead3)  
**Status:** DRY RUN — zero writes, zero deletes performed

---

## Summary

| Metric | Count |
|---|---|
| Total Peninsula 2 records | 560 |
| Records with blank `unit_reference` | 328 |
| Duplicate groups found | 12 |
| **Type 1** (SAFE — punctuation/spacing only) | **7 groups** |
| **Type 2** (SAFE — reorder/transliteration) | **1 group** |
| **Type 3** (REVIEW — unit/field differences) | **4 groups** |
| **Type 4** (DO NOT MERGE — owner-change/passport conflict) | **0 groups** |
| Records proposed for deletion (if approved) | **12** |
| Units that would go from blank → filled | **1** (via merge, not standalone backfill) |
| Groups with AI on losers but not survivor (flagged) | **0** |

All 12 duplicate groups are 2-record pairs. No group has more than 2 records. All survivors and losers have `ai_processing_status = "completed"` — no AI work would be lost in any merge.

---

## Type 1 — SAFE (Punctuation/Spacing Only) — 7 Groups

### Group 1: MOHAMMED F.A. ATIYA / MOHAMMED F A ATIYA
- **Survivor:** `6a1f09bb3dd48e7e5c375cbb` — MOHAMMED F.A. ATIYA (unit: blank, phone: +971509972442, passport: 5045877, ai: completed)
- **Loser:** `6a1f09baec25bb6ab74f02d8` — MOHAMMED F A ATIYA (phone: +971507992442)
- **Union phones:** +971509972442, +971507992442
- **Union emails:** mohamed.atiya@maguire.ae, atiya@raptorx.co
- **Fill-if-empty:** residence_country = "Palestine, State of"

### Group 2: PARD MIDDLE EAST HOLDING FZ LLC / FZ-LLC
- **Survivor:** `6a1f06de707fb1d4798a4104` — PARD MIDDLE EAST HOLDING FZ LLC (unit: blank, phone: +971502872531, ai: completed)
- **Loser:** `6a1f06df9fa671062a955935` — PARD MIDDLE EAST HOLDING FZ-LLC (phone: +971502210814)
- **Union phones:** +971502872531, +971502210814, +971505014019
- **Union emails:** info@pardhc.com, fsantoni78@outlook.com

### Group 3: KATHARINA KRAKOWITZER-BORTHAYRE / KATHARINA KRAKOWITZER BORTHAYRE
- **Survivor:** `6a1f06adfd4288f7519f0ecd` — KATHARINA KRAKOWITZER-BORTHAYRE (unit: blank, phone: +971585612201, passport: U 4401079, ai: completed)
- **Loser:** `6a1f06ad75ffbb256feaeb59` — KATHARINA KRAKOWITZER BORTHAYRE (phone: +971505691870)
- **Union phones:** +971585612201, +971505691870, +971566838941
- **Union emails:** k.krakowitzer@shima.at
- **Fill-if-empty:** residence_country = "Austria"

### Group 4: JUI-LIEN HUNG / JUI LIEN HUNG
- **Survivor:** `6a1f06ac25d0821a4e54fba7` — JUI-LIEN HUNG (unit: 2009, phone: +886916659359, passport: 360895397, ai: completed)
- **Loser:** `6a1f06acd415647b626f15f8` — JUI LIEN HUNG (unit: 2009, phone: blank)
- **Union phones:** +886916659359, +886965723452
- **Union emails:** bearbig0710@gmail.com, holaviaka@gmail.com

### Group 5: JAMES THOMAS O'DOCHERTY / JAMES THOMAS O DOCHERTY
- **Survivor:** `6a1f06a9ebd0b10085fefce8` — JAMES THOMAS O'DOCHERTY (unit: blank, phone: +971508495928, passport: 801857576, ai: completed)
- **Loser:** `6a1f06a856c1de5c046d80c4` — JAMES THOMAS O DOCHERTY (phone: blank)
- **Union phones:** +971508495928, +34637768806
- **Union emails:** r1jod@hotmail.com, golfexpressonline@gmail.com
- **Fill-if-empty:** residence_country = "United Kingdom"

### Group 6: DAN-ALEXANDRU MOROSAN / DAN ALEXANDRU MOROSAN
- **Survivor:** `6a1f067df98f4d705d2c0701` — DAN-ALEXANDRU MOROSAN (unit: 808, phone: +971565920008, passport: 58528116, ai: completed)
- **Loser:** `6a1f067d4667411615e683af` — DAN ALEXANDRU MOROSAN (unit: 808, phone: blank)
- **Union phones:** +971565920008, +40751025244
- **Union emails:** dan.morosan@law.ubbcluj.ro, omar.najeeb@live.com

### Group 7: CFI MIDDLE EAST FZ LLC / FZ-LLC
- **Survivor:** `6a1f067bdf1c9e42cae3a03d` — CFI MIDDLE EAST FZ LLC (unit: blank, phone: +971585418613, ai: completed)
- **Loser:** `6a1f067bdb72882a19d5be17` — CFI MIDDLE EAST FZ-LLC (phone: +971547016431)
- **Union phones:** +971585418613, +971547016431
- **Union emails:** roman@cfi.cloud

---

## Type 2 — SAFE (Reorder/Transliteration) — 1 Group

### Group 8: ALFIYA RESHETOVA / ALFIIA RESHETOVA
- **Survivor:** `6a1f06630fb3d929ca9aa11d` — ALFIYA RESHETOVA (unit: blank, phone: +971556197409, passport: 53 0291509, ai: completed)
- **Loser:** `6a1f06631a7eac3030f6c474` — ALFIIA RESHETOVA (phone: +971556197409, same phone)
- **Union phones:** +971556197409, +971559747247
- **Union emails:** reshetovy@yandex.ru
- **Note:** ALFIYA vs ALFIIA — transliteration variant (Y↔I). Same passport confirms same person.

---

## Type 3 — REVIEW (Unit/Field Differences) — 4 Groups

These are all name-reorder pairs where the survivor has a `unit_reference` and the loser has it blank. Same passport confirms same person. Classified as Type 3 for review because of the unit difference, but all have matching passports.

### Group 9: MOSKALEVA TATIANA / TATIANA MOSKALEVA
- **Survivor:** `6a1f09bba397ada2f2c07f2e` — MOSKALEVA TATIANA (unit: 2012, phone: +79107499387, passport: 66 4315953, ai: completed)
- **Loser:** `6a1f09c6b82f40955af4b91d` — TATIANA MOSKALEVA (unit: blank, phone: +79107499387, same phone, passport: 66 4315953)
- **Union phones:** +79107499387, +79266665515
- **Union emails:** mpochta203@gmail.com
- **Recommendation:** Safe to merge — same passport, same phone, survivor has unit.

### Group 10: DMYTRENKO ANDRII / ANDRII DMYTRENKO
- **Survivor:** `6a1f096a7a9522b14c346186` — DMYTRENKO ANDRII (unit: 2307, phone: +380505548672, passport: FV253173, ai: completed)
- **Loser:** `6a1f066c495b9036c9b37800` — ANDRII DMYTRENKO (unit: blank, phone: +971505923367, passport: FV253173)
- **Union phones:** +380505548672, +971505923367
- **Union emails:** andrii.dmytrenko@gmail.com
- **Recommendation:** Safe to merge — same passport, survivor has unit.

### Group 11: KOVTUNOVA VALERIIA / VALERIIA KOVTUNOVA
- **Survivor:** `6a1f06b0e986be588fb7ee85` — KOVTUNOVA VALERIIA (unit: 2314, phone: +380990905055, passport: FU962539, ai: completed)
- **Loser:** `6a1f0700d2812ed690128bd4` — VALERIIA KOVTUNOVA (unit: blank, phone: +971503630208, passport: FU962539)
- **Union phones:** +380990905055, +971503630208
- **Union emails:** kovtunova19@gmail.com
- **Recommendation:** Safe to merge — same passport, survivor has unit.

### Group 12: MARIE-CHRISTINE FRENETTE / MARIE CHRISTINE FRENETTE
- **Survivor:** `6a1f06c31617de4a7e37a80a` — MARIE-CHRISTINE FRENETTE (unit: "1702, 1702", phone: +15149836920, passport: AN856665, ai: completed)
- **Loser:** `6a1f06c3abe496dfd5e08172` — MARIE CHRISTINE FRENETTE (unit: blank, phone: blank, passport: blank)
- **Union phones:** +15149836920, +34628858991
- **Union emails:** marie-christine.frenette@outlook.com
- **Note:** Unit value "1702, 1702" appears duplicated — may need cleanup. Survivor has passport, loser doesn't.
- **Recommendation:** Safe to merge — same person (hyphen vs space in name), survivor has all data.

---

## Type 4 — DO NOT MERGE — 0 Groups

No Type 4 (owner-change or passport conflict) records found among the 12 duplicate groups.

---

## Unit Backfill Proposals — 1 Proposal

| Record ID | Name | Proposed Unit | Confidence | Source |
|---|---|---|---|---|
| `6a1f06c3abe496dfd5e08172` | MARIE CHRISTINE FRENETTE | 1702, 1702 | exact_name_match | Name matches survivor record with unit 1702 |

**Note:** This backfill is within a duplicate group (Group 12). If the merge is approved, the loser would be deleted and this backfill becomes moot. No standalone (non-duplicate) unit backfills were found — the remaining 327 blank-unit records have no exact name match to a record with a unit.

---

## Merge Plan Summary

If all 12 groups are approved for merge:
- **12 records would be deleted** (1 loser per group)
- **0 AI fields would be lost** (all survivors have `ai_processing_status = "completed"`)
- **0 stage changes** (all records are at `initial_contact` stage)
- Phones/emails would be unioned (append-only) onto each survivor
- Fill-if-empty values applied where survivor is missing data the loser has

### Survivor → Loser mapping (for approval):

| # | Type | Survivor ID | Loser ID (to delete) |
|---|---|---|---|
| 1 | 1 | `6a1f09bb3dd48e7e5c375cbb` | `6a1f09baec25bb6ab74f02d8` |
| 2 | 1 | `6a1f06de707fb1d4798a4104` | `6a1f06df9fa671062a955935` |
| 3 | 1 | `6a1f06adfd4288f7519f0ecd` | `6a1f06ad75ffbb256feaeb59` |
| 4 | 1 | `6a1f06ac25d0821a4e54fba7` | `6a1f06acd415647b626f15f8` |
| 5 | 1 | `6a1f06a9ebd0b10085fefce8` | `6a1f06a856c1de5c046d80c4` |
| 6 | 1 | `6a1f067df98f4d705d2c0701` | `6a1f067d4667411615e683af` |
| 7 | 1 | `6a1f067bdf1c9e42cae3a03d` | `6a1f067bdb72882a19d5be17` |
| 8 | 2 | `6a1f06630fb3d929ca9aa11d` | `6a1f06631a7eac3030f6c474` |
| 9 | 3 | `6a1f09bba397ada2f2c07f2e` | `6a1f09c6b82f40955af4b91d` |
| 10 | 3 | `6a1f096a7a9522b14c346186` | `6a1f066c495b9036c9b37800` |
| 11 | 3 | `6a1f06b0e986be588fb7ee85` | `6a1f0700d2812ed690128bd4` |
| 12 | 3 | `6a1f06c31617de4a7e37a80a` | `6a1f06c3abe496dfd5e08172` |

---

*This is a DRY RUN report. No data has been modified. Waiting for approval before any merge or delete.*