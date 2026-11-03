# Shift-Mate — Cash Shift Reconciliation

## 1. Project Overview

**Shift-Mate** is a Vietnamese-language web application designed to help cashiers at small food and beverage businesses reconcile cash at the end of a shift.

The product addresses a common operational problem: when the amount of cash physically counted does not match the expected balance, staff must manually investigate transactions, expenses, and unrecorded orders to understand the discrepancy.

Shift-Mate provides a structured workflow for cash counting, exception tracking, discrepancy investigation, and shift handover.

**Core user story (JS5):** Help cashiers investigate end-of-shift cash discrepancies with transparent calculations and evidence-based reconciliation.

## 2. Core Features

### Opening Cash Count
- Count opening cash by Vietnamese banknote denomination.
- Calculate the opening cash total automatically.
- Compare counted cash against the previous shift's handover amount.
- Highlight any opening discrepancy.

### Exception Log
- Record cash expenses and quick orders created during POS outages.
- Capture transaction details, payment methods, and supporting references.
- Manage exception statuses: pending, verified, or accounted in POS.
- Identify potentially duplicate or contradictory records.

### Closing Cash Count
- Enter POS cash sales and recorded cash outflows.
- Count physical closing cash by denomination.
- Calculate expected cash and compare it with actual cash.

### Discrepancy Investigation
- Generate rule-based investigation suggestions.
- Highlight pending cash expenses, unverified quick orders, and possible counting errors.
- Require human verification before unresolved transactions affect reconciliation calculations.
- Avoid automatically claiming an exact root cause without evidence.

### Shift Handover
- Summarize the reconciliation outcome.
- Distinguish reconciled, explained, and unresolved cases.
- Record handover notes and produce a copyable summary.

## 3. Getting Started

### Prerequisites

- Node.js
- npm
- A modern web browser

### Installation

1. Clone or download the GitHub repository.
2. Open a terminal in the project root directory, where `package.json` is located.
3. Install dependencies:

   `npm install`

4. Start the development server:

   `npm run dev`

5. Open the local address displayed in the terminal.

   In the verified local setup, the application was available at `http://localhost:8080/`.

**Windows PowerShell note:** If PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev`.

## 4. Architecture Overview

Shift-Mate is a client-side web application built with React, TypeScript, TanStack Router, and Vite.

### Main Project Structure

| Location | Responsibility |
|---|---|
| `src/routes/` | Application pages and navigation |
| `src/components/` | Reusable UI components and cash-counting forms |
| `src/hooks/` | Supporting React hooks |
| `src/lib/shift/types.ts` | Domain data structures |
| `src/lib/shift/calc.ts` | Cash reconciliation calculations, validation, and investigation rules |
| `src/lib/shift/store.ts` | Shift state and local data persistence |
| `src/test/` | Automated tests |
| `public/` | Static assets |

### Data Model

The main domain objects include:

- Shift
- CashCount and CashCountLine
- ExceptionLog
- POSSummary
- Reconciliation

### Data Storage

The MVP uses browser `localStorage` for demonstration persistence.

No authentication service, cloud database, or live POS connection is implemented in the current version.

## 5. Reconciliation Logic

The expected closing cash is calculated as:

**Expected Cash = Opening Cash + POS Cash Sales − POS Cash Outflows − Verified Off-POS Cash Expenses + Verified Off-POS Cash Quick Orders + Confirmed Adjustments**

The cash discrepancy is:

**Discrepancy = Actual Closing Cash − Expected Closing Cash**

Key business rules:

- Only verified off-POS records affect the expected cash balance.
- Pending exceptions are excluded from confirmed calculations.
- Transactions already accounted for in POS are not counted again.
- QR-only quick orders do not increase physical cash.
- Split-payment orders contribute only their cash component.
- A zero discrepancy does not automatically mean the shift is reconciled when unresolved exceptions or conflicting records remain.
- Investigation suggestions are rule-based and require human verification.

These controls help reduce double-counting and prevent unsupported automatic adjustments.

## 6. Testing and Validation

The project includes automated tests using Vitest.

Run the test suite with:

`npm test`

Or on Windows PowerShell:

`npm.cmd test`

**Verified local test result (3 November 2026):**

- 5 test files passed.
- 32 tests passed.
- 0 tests failed.

The test suite covers cash calculation logic, demo data, UI presentation, denomination count form behavior, and application routing.

Passing these tests confirms the implemented test cases succeed; it does not guarantee that the application is free from all defects.

## 7. Known Limitations

The current version is a functional MVP rather than a production-ready financial system.

- **No live POS integration:** POS amounts must be entered manually.
- **No banking API integration:** Bank transactions are not retrieved or verified.
- **No authentication or role management:** The MVP does not provide production-grade access controls.
- **Local-only persistence:** Browser storage is not designed for multi-device synchronization or durable financial recordkeeping.
- **No automatic root-cause determination:** Investigation suggestions highlight possible explanations, not definitive conclusions.
- **No real-time synchronization:** Changes are not shared between multiple cashiers or devices.
- **No OCR-based input:** POS slips and receipts are not automatically extracted in the implemented MVP.

The application should be evaluated as a prototype using fictional demonstration data, not as a certified financial accounting system.

## 8. AI-Assisted Development

Shift-Mate was developed with AI-assisted tools, including Lovable and ChatGPT.

AI was used to support interface implementation, code generation, business-rule refinement, and technical troubleshooting.

Business requirements, reconciliation assumptions, exception-handling rules, and validation decisions were reviewed and refined throughout development.

A separate AI Log & Reflection document describes significant prompts, AI mistakes, corrections, and lessons learned.

## 9. Future Development

Potential next versions may include:

- OCR-assisted POS closeout data entry.
- POS integration to reduce manual input.
- User authentication and role-based access.
- Cloud persistence and cross-device shift handovers.
- Expanded reporting and reconciliation analytics.

These are future development directions and are **not presented as implemented features in the current MVP**.

---

**Project:** Shift-Mate  
**Challenge:** Techcombank AI Transformation Division — Intern Challenge 2026  
**Product focus:** Cash discrepancy investigation and shift reconciliation for small F&B businesses
