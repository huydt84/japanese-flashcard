<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shell commands

- Prefix shell commands with `rtk`, following `/Users/huydinhtrong/.codex/RTK.md`. Use `rtk proxy <command>` when a command needs unfiltered output or is not supported directly.
- Run project commands from this repository. The commands below include the required prefix.

## Flashcard and lesson updates

- Follow `PRODUCT.md` for product behavior and `DESIGN.md` for interface conventions. Keep teacher, student, and privileged admin workspace behavior consistent with those documents.
- Use the existing lesson editor or Excel import flow for user-requested vocabulary changes.
- Excel imports use the first worksheet with exactly five columns in order: `kanji`, `hiragana`, `meaning_vi`, `example_ja`, `example_vi`. Require text in all five cells, preserve Japanese and Vietnamese content, and follow the template and limits documented in `README.md`.
- Preserve class ownership, membership, publication state, and tenant isolation when changing lessons or cards. Teacher previews must not write student progress; multiple-choice practice must not change FSRS scheduling or review history.
- Data changes in Supabase can appear on the live site without a Vercel redeploy only when the deployed code already supports the changed data shape and presentation. Schema changes belong in `supabase/migrations`.

## Reporting change status

- In the final response, distinguish what changed in the database, what changed in the local code, and what is actually visible on the production website. Never describe a database-only change as a completed user-visible UI change.
- A new data type, label, or UI behavior requires deployment before it can appear on production. State clearly when that deployment has not happened, even if the database migration has already run.
- Say “verified on production” only after checking the deployed behavior. If the user reports that they deployed it, acknowledge that separately from any verification Codex performed.
- For mixed database-and-code changes, summarize the remaining deployment or verification step explicitly instead of saying only that the change is done.

## Environment file safety

- Only files named exactly `.env` are protected environment and secret sources; similarly named files such as `.env.local`, `.env.prod`, `.env.template`, or `foo.env` are ordinary project files.
- Never read, print, modify, copy, or otherwise expose `.env`, even when filesystem access is unrestricted. Do not bypass this rule. Tell the user when a value must be changed.
- A user-requested project command may consume `.env` incidentally, but its values must never be intercepted or exposed.
- Access a remote database only through a repository script that reads its required environment variables internally. Never expand, interpolate, echo, or place a secret value directly in a shell command.
- If a command truly requires a literal secret value, ask the user to enter the value and run that command themselves. Never ask the user to paste the secret into chat.
- Keep Supabase management credentials and service-role/secret keys out of frontend code and `NEXT_PUBLIC_*` variables. Use the repository's local database wrappers, which suppress credential output, rather than printing raw Supabase status.

## Package management

- Use pnpm 11.25.0 for all project commands; use `rtk pnpm exec` for installed tools and `rtk pnpm dlx` for one-off tools. Do not use raw npm or npx.
- Install with `rtk pnpm install --frozen-lockfile`. Keep the pinned package manager, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` security settings in sync. Review dependency scripts before granting narrowly scoped build permissions; never disable protections just to make installation succeed.
- Keep the lockfile compatible with the pinned Vercel CLI. Do not upgrade pnpm independently of deployment compatibility checks.

## Local development

- Run project commands directly from the repository. Do not introduce sandbox-specific cache paths, socket allowlists, temporary project copies, or escalation steps.
- Use `rtk pnpm run dev` for the normal development app. It uses the real backend configured in `.env`; use the isolated local workflow for tests that create or change data.
- For isolated development, run `rtk pnpm run db:up:local`, `rtk pnpm run db:migrate:local`, then `rtk pnpm run dev:local`. The local wrapper maps the `LOCAL_*` settings internally and enables the development-only test login endpoint without editing `.env`.
- Codex may start the development server in a persistent session, inspect the exact process listening on port 3000, stop a confirmed japanese-flashcard process, and restart it after changes.
- Test the normal local app at `http://localhost:3000`, matching the Playwright configuration. Keep the server running while using the in-app Browser, and rely on Fast Refresh or reload the page after changes.
- Manage the isolated Supabase stack with `rtk pnpm run db:status:local` and `rtk pnpm run db:down:local`. Use `rtk pnpm run db:reset:local` only when an intentional reset of local data is part of the requested work; normal updates use migrations.
- Use `rtk pnpm run db:history`, `rtk pnpm run db:inspect`, and `rtk pnpm run db:verify` for remote migration history, table statistics, and schema checks. Preview pending production migrations with `rtk pnpm run db:migrate:dry-run` before applying an authorized migration with `rtk pnpm run db:migrate`.

## Resource and memory hygiene

- Start development through `rtk pnpm run dev` or `rtk pnpm run dev:local`. Neither command provides automatic orphan-process cleanup or a custom heap limit; manage cleanup explicitly.
- Before starting a server, inspect port 3000 and reuse the confirmed japanese-flashcard process when possible. Do not launch overlapping dev servers for independent checks.
- Let `rtk pnpm run test:e2e:local` manage its own server at `http://127.0.0.1:3110` and its existing `.next-playwright-local` build directory. Do not start a competing server on that port or replace the repository's test isolation with ad hoc copies.
- At the end of work, stop every development or Playwright process started by Codex and verify that this checkout has no orphaned `detached-flush` or esbuild process and no listener left on test-only port 3110. Never use broad process-name kills; resolve the project path, parent process, and listening port first. Preserve unrelated and pre-existing user processes.
- Reuse one browser session for browser verification and close surplus pages, contexts, and test runners after the batched pass. Keep the configured Playwright worker policy: two workers for local authenticated tests and Playwright's default for the regular suite. Increase concurrency only when a measured requirement justifies it.
- Start the container runtime and local Supabase only for work that needs them. When Codex started the database and no further local database work remains, use `rtk pnpm run db:down:local`; before stopping the container runtime itself, verify that no unrelated containers are running.
- For builds, full E2E runs, or performance investigations, record project-scoped process counts and resident memory before and after. Treat monotonic growth or repeated Node/esbuild pairs as a failed run that must be diagnosed and cleaned up, not as expected framework overhead. Do not raise heap limits to mask a leak; record the reason and before/after measurements for any temporary override.

## Engineering decision quality

- Prefer established ecosystem practices and maintained tooling when they solve the actual problem. Evaluate decisions by correctness, maintainability, portability, diagnostics, CI support, and onboarding across the full lifecycle.
- Treat local optimizations such as minimizing dependency count, setup steps, or lines of configuration as secondary trade-offs. Do not replace mature tooling with bespoke infrastructure solely to optimize those local costs.
- When deviating from an established practice, identify the concrete project constraint, compare the lifecycle costs, and leave the reasoning discoverable in the relevant code or documentation.
- Match verification to the failure mode. Build and unit checks do not substitute for real-browser end-to-end coverage of browser runtime, hydration, navigation, and user-visible integration failures.

## Quality checks

- The standard checks are `rtk pnpm run lint`, `rtk pnpm run typecheck`, `rtk pnpm test`, `rtk pnpm run test:e2e`, and `rtk pnpm run build`. Run the checks appropriate to the change and report anything not run.
- Install missing browser binaries with `rtk pnpm exec playwright install chromium webkit`.
- The regular E2E command skips tests that require authenticated local data. For teacher/student flows, notifications, study behavior, or role changes, start local Supabase, apply local migrations, and run `rtk pnpm run test:e2e:local`.
- Pass targeted Playwright arguments after `--`, for example `rtk pnpm run test:e2e:local -- tests/e2e/teacher-student-flow.spec.ts`. The wrapper obtains local test credentials internally and the fixtures create and remove their test accounts. Never redirect these tests to production.

## Responsive UI verification

- Every UI change or visual bug fix must be checked in a real browser at all three canonical viewports: phone `320x760`, MacBook `1440x900`, and Dell `1920x1080`.
- Also retain coverage from the existing Playwright projects: desktop Chromium at `1440x1000` and mobile WebKit at `390x844`. Those configured projects alone do not cover the canonical viewport matrix.
- Audit every affected surface when shared styles change. The baseline matrix is the landing page, onboarding, teacher dashboard, class detail, lesson/card editor and Excel import, invitation and progress views, student dashboard, notifications, teacher preview, and student study flow. Include privileged admin workspace switching and edited states such as vocabulary lists, study setup, card fronts/backs, quiz feedback/results, dialogs, and both themes where supported.
- After a visual fix, rerun the relevant existing feature E2E tests: `tests/e2e/landing.spec.ts`, `tests/e2e/authenticated.spec.ts`, `tests/e2e/notifications.spec.ts`, or `tests/e2e/teacher-student-flow.spec.ts`. Use the local E2E wrapper for authenticated suites.
- Add a geometry or behavior assertion for the exact reported symptom so a visual regression can fail deterministically.
- Perform a batched screenshot pass across the affected matrix, fix the findings together, then run one confirmation pass. Do not treat unit tests, builds, DOM presence, or a single viewport as visual sign-off.

## Vercel deployment

Use this runbook for an authorized production deploy from Codex desktop.

1. Run the normal checks in the repository:

   ```sh
   rtk pnpm run lint
   rtk pnpm run typecheck
   rtk pnpm test
   rtk pnpm run test:e2e
   rtk pnpm run build
   ```

   Run `rtk pnpm run test:e2e:local` with the local database prepared when the change affects authenticated behavior. A passing regular E2E run does not verify the skipped authenticated suites.

2. Validate the deployment configuration and review pending migrations without exposing environment values:

   ```sh
   rtk pnpm run env:check
   rtk pnpm run db:migrate:dry-run
   ```

   For an upload-only preview, use `rtk pnpm exec vercel deploy --dry --json`.

3. Deploy the linked project through its repository command:

   ```sh
   rtk pnpm run deploy:prod
   ```

   This command validates configuration, applies pending Supabase migrations, syncs only the public variables marked `@vercel` in `.env.template` to Vercel Production and Preview, then deploys with the locked Vercel CLI. Supabase CLI credentials stay out of Vercel. If authentication has expired, ask the user to complete `rtk pnpm exec vercel login` once, then retry the deploy.

4. Smoke-check the actual production alias returned by Vercel. Check `/`, `/privacy`, and `/terms` for successful responses. Verify signed-out redirects and signed-in role routing through `/app`, `/teacher`, and `/student`, then exercise the changed behavior with the appropriate role. Privileged admins use the teacher/student workspaces; there is no separate `/admin` dashboard.

5. After schema changes, run `rtk pnpm run db:verify` and report database verification separately from production browser verification.

Use `rtk pnpm exec vercel --prod --yes` only when intentionally deploying without environment sync or migrations. Keep `.env`, local build caches, test reports, and Supabase CLI state excluded by `.vercelignore`, while preserving `pnpm-lock.yaml` in the upload. Keep Vercel Functions near the Supabase region as documented in `README.md`.
