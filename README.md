# Shift-Mate Cash Reconciliation

Build a responsive Vietnamese-language web app called Shift-Mate, based strictly on this product specification.

PURPOSE: A cash shift reconciliation companion for small F&B cashiers. Core user story JS5: help cashiers investigate end-of-shift cash discrepancies.

SCREENS:

1. Open Shift: enter banknote quantities by VND denominations; calculate opening cash; flag opening discrepancy.

2. Exception Log: record cash expenses, POS-outage quick orders, and status (pending, verified, accounted in POS).

3. Close Shift: enter POS cash sales, cash outflows, count ending cash by denominations, calculate expected vs actual cash.

4. Investigate: show discrepancy and rule-based suggestions for unverified expense, pending quick order, recount; human must confirm before adjusting numbers. Never claim an exact root cause without evidence.

5. Handover: reconciled/explained/unresolved status, notes, and copyable report.

FORMULA: Expected closing cash = opening cash + POS cash sales - all confirmed cash outflows +/- other confirmed adjustments. Never double-count expenses. Actual minus expected = discrepancy.

DATA: Shift, CashCount, CashCountLine, ExceptionLog, POSSummary, Reconciliation. Use localStorage for demo persistence. Seed realistic, clearly labeled fictional demo data. No authentication or cloud database for v1.

UX: polished fintech dashboard, Vietnamese copy, white background, soft blue palette, responsive desktop/mobile. Include validation, empty and error states, clear currency formatting, status indicators.

TEST CASES: matched shift, verified unrecorded cash expense 50,000 VND, unresolved discrepancy, invalid input, duplicate warning, conflicting evidence and corrections.

OUT OF SCOPE: bank API, bank verification, QR OCR, POS integration, automatic exact root-cause detection, realtime sync. Do not add these.

Build the MVP progressively with understandable, maintainable code. Do not present proposed features as already tested.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4a261349-e013-49e0-8e71-c1be03a065cf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
