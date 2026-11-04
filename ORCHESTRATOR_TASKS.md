# Orchestrator task list

Everything planned for Fico, split into tasks that can be handed out one by one. Background and reasoning are in `newfeaturesplan.md`. Already done on branch `feature/auto-capture-and-instant-answer`: `utils/safe-to-spend.ts`, `utils/notification-parser.ts` and their tests.

## Rules for every task
- Branch from the latest `main`, one branch and one pull request per task. Never push to `main`.
- Run `npm run lint`, `npm run build` and `npm run test:offline` before opening a pull request. Add a test under `scripts/` for each new util (style of `scripts/test-engine.mts`).
- Preview or what-if actions must never change stored balances.
- Respect `hideAmountsOnOpen` in every new view. Amounts go through `formatMoney`.
- Any Supabase change needs a migration file, and a new synced table also needs `SYNCED_TABLES` in `lib/local/sync.ts` and a rebuild of `lib/local/schema.generated.ts` (`scripts/build-local-schema.mjs`). A human applies migrations to the live project.
- Mark tasks that need a real device or live server as "human check" in the pull request.

## Order
1. Phase A: sync fixes (S1 to S6). Data safety comes first.
2. Phase B: Insights page (I1 to I3).
3. Phase C: milestones (M1 to M4) and interactivity (F1 to F5), in parallel.
4. Phase D: retention (R1 to R6).
5. Bugs (B1, B2) any time.

---

## Phase A: sync

### S1. Diagnose stuck syncing
Files: `lib/local/sync.ts`, `lib/local/status.ts`, `components/sync-status.tsx`, new `components/page/settings/sync-debug.tsx`
- Add a Sync details section in Settings: pending count, the oldest queued changes (name or table, age, last error), tables the server does not have (`missing`), `refresh_all` flag, last sync time, last error.
- Add "Copy report" (no row data, only names and counts).
- Done when: the screen lists each stuck change with its RPC or table and why it is waiting.

### S2. Stop one stuck change blocking everything
Files: `lib/local/sync.ts` (`push`, `replay`, `isRetryable`)
- Retry with exponential backoff (1 min up to 30 min) instead of every 60 seconds.
- Treat a missing `sync_replay` (`PGRST202`) as "server needs a migration": hold the queue, show one clear message, and do not retry in a loop.
- After N failed tries (default 8) move a change to a `dead` status, keep its data, tell the user once, and let the rest continue. Add "Retry" and "Discard" for dead changes in S1's screen.
- Done when: a change that always fails no longer blocks later changes, and nothing is silently dropped.

### S3. Incremental pull
Files: `lib/local/sync.ts` (`download`, `remoteIndex`, `localIndex`)
- Fetch only rows with `updated_at` greater than the last successful pull (minus a small overlap), per table. Tables without `updated_at` keep the current id comparison.
- Detect deletes with a periodic full id check (weekly, or on demand from S1's screen) or a server-side deleted-rows table.
- Replace the 60-second timer: sync on resume, on reconnect, after a push, and every 5 minutes while visible.
- Done when: a no-change sync makes one small request per table, and tests in `scripts/test-sync.mts` cover updates, deletes and the full check.

### S4. Per-table `refresh_all`
Files: `lib/local/sync.ts` (`pull`)
- Track the refresh per table so one failing table does not force every table to re-download on every sync.
- Done when: a test with one table that always fails shows the others downloading once only.

### S5. Quiet sync badge
Files: `components/sync-status.tsx`
- Show nothing while syncing normally. Show a small dot when changes are waiting, and the full pill only when the user needs to act (offline with changes, a dead change, a server migration needed).
- Done when: no spinner appears during an ordinary background sync.

### S6. Sync tests
Files: `scripts/test-sync.mts`, `scripts/test-local-sync.mjs`
- Cover S2 to S4, including a change targeting a missing table, an expired session, and an offline-to-online switch.

---

## Phase B: Insights

### I1. Insights page
Files: `ionic-pages/StatisticsPage.tsx` (rename to Insights, keep route `/statistics`), `components/nav/nav-items.ts`, `components/page/statistics/*`, `components/page/dashboard/spending-chart.tsx`
- One shared period picker. Sections: Spending (period summary, category split, trend), Money (net worth and wallets, from `components/page/wallet/money-overview-card.tsx`), Bills and budgets (`bills-overview.tsx`, `budget-overview.tsx` content), Debts and investments (net position, ROI), Forecast (safe to spend, link to Forecast page).
- Section chips at the top jump to each section.
- Done when: every figure that was in an overview card on another page is available here.

### I2. Remove overview cards from other pages
Files: `ionic-pages/BillsPage.tsx`, `BudgetsPage.tsx`, `CategoriesPage.tsx`, `WalletsPage.tsx`, `DebtsPage.tsx`, `InvestmentsPage.tsx`, `TransactionsPage.tsx`, and the overview components they use
- Remove the cards. Each page keeps its list, filters, and at most one line (for example "3 due this week").
- Home stays unchanged.
- Done when: no overview card remains outside Home and Insights, and no component is left unused.

### I3. Links to Insights
- Each page gets a "See insights" link that opens the matching section. Add deep links such as `/statistics#debts`.

---

## Phase C: milestones

### M1. Milestone detection
Files: new `utils/milestones.ts`, new `scripts/test-milestones.mts`
- A pure function comparing the before and after state of goals, obligations and investments and returning milestones crossed:
  - Goals: first deposit, 25/50/75/100%.
  - Debt: each installment paid, balance below a round number, 50%, cleared; money lent paid back.
  - Investing: first investment, first return recorded, value passing principal, total invested crossing round amounts.
- Count only real events (deposit, payment, recorded return), never balance adjustments or reconcile.
- Each result carries a short "what changed" figure (new debt-free date, interest saved, days of spending covered).
- Done when: tests cover each rule, including a dip below a threshold and recovery returning no repeat.

### M2. Show each milestone once
Files: new migration for `milestones` table (id, owner_id, kind, subject_id, level, reached_at), `lib/local/sync.ts` (`SYNCED_TABLES`), `lib/local/schema.generated.ts`, new `queries/user/milestone/milestones.ts`
- Store reached milestones, synced like other tables. M1's output is filtered against them.
- Human check: the migration is applied to the live project.

### M3. Wire to existing flows
Files: `components/page/debts/record-payment-sheet.tsx`, `components/page/investments/investment-sheet.tsx`, goal deposit flow, `store/celebration-store.ts`, `components/celebration-dialog.tsx`
- After each mutation, run M1 and call `celebrate()`. Scale it: small check for first deposit, a short card at 50%, full confetti for cleared or finished.

### M4. Goal journey and progress ticks
Files: `components/page/goals/goal-card.tsx`, `components/page/goals/goal-progress.ts`, debt and investment detail views
- Tick marks at 25/50/75/100% on the progress bar that fill as passed.
- A journey timeline on each goal and debt ("Started Aug 3, first ₱1,000 Aug 10, halfway Oct 2").
- Optional share card with the milestone and an option to hide amounts.

---

## Phase C: interactivity

### F1. What-if forecast
Files: `utils/forecast.ts`, `ionic-pages/ForecastPage.tsx`, `queries/user/planned/planned-items.ts`
- Daily-spend slider (₱0 to 2x typical) overriding the typical-flow toggle.
- Feed planned items (`amountLow`, `amountHigh`) into `buildForecast` as dated events, with the range shown as a band.
- Planned items draggable by date and amount; "Save to plan" writes back, dragging alone does not.
- Done when: moving a slider or an item redraws in under 100 ms, and Reset returns to the saved plan.

### F2. Safe-to-spend ring and instant answer
Files: `utils/safe-to-spend.ts` (done), new `queries/user/safe-to-spend/*`, `components/page/transaction/quick-add-sheet.tsx`, `components/floating-agent.tsx`, `components/page/home/fico-balance-card.tsx`, `store/home-widgets-store.ts`, `types/settings.ts`
- A hook that gathers cash wallets, unpaid bills, future income (planned items and income bills), spent today, and a floor setting.
- In `finish()` (quick-add) and the agent's save path, run `applyTransaction` then show `instantAnswer(...)` in the toast.
- Home widget `safeToSpend`: a ring for today's allowance with next payday and days left; can be hidden or reordered.
- Note: `useOpenBills` and `useAllWallets` assert the Supabase backend; add local-backend equivalents or skip the answer when data is missing.
- Done when: the figure equals the MCP `safe_to_spend` result for the same data.

### F3. Tappable charts
Files: `components/page/dashboard/spending-chart.tsx`, `components/page/statistics/category-distribution-card.tsx`
- Tapping a bar, day or slice opens a bottom sheet of its transactions; long-press and drag sets the period.
- Done when: the sheet total equals the tapped value.

### F4. Swipe inbox
Files: new `components/page/transaction/triage-inbox.tsx`, `utils/import-csv.ts`, `utils/frequent-transactions.ts`
- One card at a time: right accepts the suggested category, left skips, up edits; a fourth action marks the item as already spent with no balance change.
- Done when: 50 imported items clear in under 2 minutes.

### F5. Check-ins and actionable insights
Files: `utils/push.ts`, `scripts/sw.source.js`, insight cards
- Optional evening prompt at a user-set time with one-tap actions; insight cards get "Planned" and "Reduce" buttons.
- Done when: it can be switched off in Settings.

---

## Phase D: retention

### R1. Auto-capture from notifications (Android)
Files: `utils/notification-parser.ts` (done), new Capacitor plugin under `android/`, new "To confirm" tray
- Human step first: collect real GCash, Maya, GoTyme, BDO and BPI notification texts and replace the sample texts in `scripts/test-notification-parser.mts`.
- `NotificationListenerService` plugin reading only the apps in `NOTIFICATION_SOURCES`; the user grants access in Settings.
- Tray: each item shows parsed fields with Confirm, Edit, Dismiss. Nothing is saved without a tap at first.
- Process on device, store only parsed fields and the reference, never the raw text.
- iOS: paste or Share-sheet capture instead.
- Human check: needs a real Android device.

### R2. Reasons to open the app
- Payday card ("your sahod is in") using F2's figure.
- Utang reminder: one-tap shareable message for money lent (`components/page/debts`).
- Weekly recap, short and shareable.

### R3. Philippines-specific planning
- 13th month planner (expected amount, reduction for unpaid leave, what it covers), leave and salary view, freelancer tax and contribution tracker.

### R4. First 60 seconds
Files: `components/page/onboarding/OnboardingPage.tsx`, `utils/onboarding.ts`
- Ask one goal on signup and show a forecast for it before any setup.

### R5. Shared use (needs design first)
- Shared wallets for couples or family, split bills, group savings and paluwagan. Write a short design note (data model, permissions, sync) before any code. Human review required.

### R6. Measure
- Track where new users drop off (day 1, 3, 7) without sending personal data; add the numbers to a simple internal view.

---

## Bugs

### B1. Crypto prices null or stale
Files: `utils/crypto-prices.ts`, `queries/crypto/prices.ts`, `fico-api/mcp/src/crypto.ts`
- Investments return `price: null` and `stale: true`; a coin held in small units shows a near-zero value. Find why the price lookup fails, fall back to the last known price with an "as of" time, and fix the unit handling.
- Done when: the holdings show a current value and a visible "as of" time.

### B2. Clean up `fico-api` leftovers
Files: `fico-api/initialization/data/quests.json`, `packages.json`, `models/Globalpass.ts`, `models/Staffusers.ts` and their controllers, services, routes and validators
- Confirm nothing references them, then remove. List anything still referenced in the pull request instead of removing it.
