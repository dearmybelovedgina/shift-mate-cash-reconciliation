<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Reconciliation math lives only in `src/lib/shift/calc.ts` as pure functions with tests in `src/test/shift-calc.test.ts`; UI must not re-implement formulas (keeps the no-double-count rule in one place).
- v1 persistence is localStorage via `src/lib/shift/store.tsx` (no auth/cloud) — read storage in effects to avoid hydration mismatch.
- Exception status changes must pass `validateException` in `src/lib/shift/calc.ts` (every save and the Kiểm tra dialog); only `cashComponent` decides how much of a record counts as cash, so QR never leaks into expected cash.
- Display-only pending/conflict summaries live in `src/lib/shift/presentation.ts` and reuse `findConflicts`; they must not change cash math or persisted reconciliation statuses.
