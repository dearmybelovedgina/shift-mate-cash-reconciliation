# Shift-Mate — AI Usage Log & Reflection

## 1. Project Overview

**Project:** Shift-Mate — Cash Reconciliation & Shift Handover Assistant

**Context:** Techcombank AI Transformation Intern Challenge

**Primary use case:** Investigating cash discrepancies at the end of a shift in a small F&B business.

**Objective:** Help staff record cash-related activities, identify potential causes of discrepancies, and prepare a clearer shift handover.

AI was used as a development assistant to support planning, coding, debugging, testing, and documentation. The resulting MVP uses rule-based reconciliation logic rather than an AI model to make financial decisions.

## 2. How AI Was Used

| Development stage | AI assistance | Human responsibility |
|---|---|---|
| Problem definition | Structure the reconciliation workflow and user journey | Select the core problem and scope |
| MVP design | Suggest page structures, field labels, and interaction flows | Review usability and business relevance |
| Implementation | Generate and revise React/TypeScript code | Run the application and test actual behavior |
| Testing | Help interpret errors and identify possible fixes | Execute tests and verify results |
| POS automation | Support OCR integration and financial field extraction | Check source documents and validate extracted values |
| Documentation | Draft explanations and technical reflections | Review accuracy and ensure claims match the implementation |

## 3. AI-Assisted Automation — POS Receipt OCR

### Task

Reduce repetitive manual entry of financial figures from POS shift-closing receipts.

### Implemented workflow

1. The cashier uploads an image of a POS closing receipt.
2. Tesseract.js performs optical character recognition.
3. Rule-based parsing identifies supported financial field labels and amounts.
4. Extracted values are displayed alongside their original OCR text.
5. The user checks, corrects, or completes the required fields.
6. The user explicitly confirms the reviewed values.

The OCR feature operates separately from the core cash-reconciliation workflow. Confirmed OCR results are not automatically written into the active shift.

## 4. What Worked

The automation was tested using one structured KiotViet-style POS shift-closing report.

After adjustments to the parsing logic, the interface successfully displayed eight financial fields and their corresponding amounts:

- Opening cash
- Cash movement during the shift
- Sales
- Cash receipts
- Cash expenses
- Closing cash
- Bank transfer
- Card payments

The OCR workflow was also tested successfully on the publicly deployed Netlify website.

## 5. What Did Not Work — AI and Automation Limitations

### Issue 1: Vietnamese label recognition

**Problem:** The initial parser failed to identify some financial fields even though OCR had recognized their text.

**Cause:** Text normalization removed Vietnamese accents, but the matching rules still searched for accented labels.

**Correction:** Matching rules were revised to use normalized text consistently.

**Lesson:** Successful OCR text recognition does not guarantee successful extraction of structured financial data.

### Issue 2: Dependence on receipt format

**Problem:** The extraction logic worked with recognizable labels from a structured KiotViet-style receipt, but it was not designed to reliably interpret every POS format.

**Limitation:** Receipts with different labels, layouts, or missing information may require manual completion.

**Human intervention:** Staff must verify extracted amounts against the original document and fill in missing data.

**Lesson:** The tool is a format-dependent prototype, not a universal POS receipt reader.

### Issue 3: Ambiguous financial meaning

**Problem:** A receipt may include fields such as "Sales" and "Cash during shift" without explicitly identifying the exact cash-sales amount required by Shift-Mate.

**Risk:** Automatically mapping an ambiguous value could introduce incorrect figures into reconciliation.

**Correction:** The tool preserves source labels and does not automatically treat ambiguous figures as cash revenue.

**Lesson:** Financial meaning cannot always be inferred safely from an OCR result.

## 6. Before-and-After Measurement

A small, single-sample timing exercise was performed using the structured POS receipt.

| Activity | Measured or estimated duration |
|---|---:|
| Manual entry of eight receipt fields | Approximately 90 seconds |
| OCR processing | 1.9 seconds |
| Human verification of extracted results | Approximately 24 seconds |
| Manual completion of one missing field and confirmation | Approximately 3 seconds |
| Total OCR-assisted workflow | Approximately 28.9 seconds |

**Estimated time saved:** 61.1 seconds per tested receipt.

**Estimated time reduction:** 67.9%.

Calculation: (90 − 28.9) / 90 × 100 ≈ 67.9%.

**Measurement limitations:** This was one informal test with a structured sample receipt, not a controlled study. The manually entered missing value was a test assumption, not a verified POS figure. Results do not establish financial accuracy or performance across different receipt formats.

## 7. Human-in-the-Loop Safeguards

- Extracted amounts remain visible for review.
- Users can edit or complete values before confirmation.
- Confirmation requires an explicit user action.
- Ambiguous cash-sales amounts are not automatically inferred.
- Confirmed OCR values do not automatically update active-shift financial records.

These safeguards aim to reduce the risk of treating machine-extracted information as verified financial evidence.

## 8. Deployment and Testing

**Live MVP:** https://shiftmade.netlify.app

**POS OCR automation:** https://shiftmade.netlify.app/ocr-pos

**Source repository:** https://github.com/dearmybelovedgina/shift-mate-cash-reconciliation

The application was deployed using GitHub and Netlify. The main page and OCR functionality were manually checked after deployment.

## 9. Personal Reflection

The most important learning from this project is that automation effectiveness depends on both technical performance and business interpretation.

Initially, it appeared sufficient to extract numeric values from a POS receipt. Testing showed that three different problems must be addressed: recognizing text, identifying the correct field, and understanding whether that field is appropriate for reconciliation.

AI assistance accelerated implementation and debugging, but it did not replace the need to validate financial meanings and test the product directly.

For financial workflows, a reliable assistant should make uncertainty visible, preserve traceability to source information, and leave final verification to the responsible user.

## 10. Future Improvements

- Support a wider range of POS receipt templates.
- Detect missing or low-confidence fields.
- Add stronger validation for financial values and receipt totals.
- Evaluate performance across multiple real-world receipt formats.
- Introduce controlled transfer of verified OCR values into the reconciliation workflow.
- Conduct repeatable timing and accuracy tests with more receipts.

**Conclusion:** Shift-Mate demonstrates how AI-assisted development and OCR automation can support cash reconciliation while keeping financial verification and final decisions under human control.
