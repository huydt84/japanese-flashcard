# Kotoba application

Mode: Operate. Teachers author and assign vocabulary; students accept invitations, read the lesson vocabulary, and choose focused flashcard or multiple-choice practice.

## Direction contract

**THESIS:** A calm digital study desk where one learning object owns attention; refuse dashboard-card clutter and ornamental “Japanese” clichés.

**OWN-WORLD:** Cool mineral canvas, white paper-like surfaces, charcoal ink, vermilion product marks, and semantic red/amber/green answer controls. Large Japanese type meets compact, precise Vietnamese UI.

**STORY:** Sign in, enter the correct role workspace, create or receive a lesson, read its full vocabulary list, choose a mode and configure it, then complete a focused learning session and return to the list.

**FIRST VIEWPORT:** On public entry, explanation sits left and the card sits right. The study and teacher-preview routes lead with the lesson title, description, count, and a flat vocabulary list. The same Flashcards and Multiple Choice controls bracket the list; a centered setup dialog precedes one active learning object. During flashcards, the card centers at near-reading scale with four circular controls directly below.

**FORM:** Modern Japanese study planner grid, third in the grounded list; seed `c145e437`. Signature interaction: the card turns as one physical plane in either study direction, with answer controls always visible and available on either face.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Lesson flow

- `/study/[lessonId]` and `/preview/[lessonId]` open the full vocabulary overview. Each row includes kanji, hiragana, Vietnamese meaning, Japanese example, and translation; session state stays on the same route and a reload returns to the overview. Empty lessons show guidance and disabled mode controls.
- Both copies of the mode controls open the same setup dialog. Students can choose direction, due/unseen or all cards, a count or all eligible cards, and shuffle. Flashcards default to due/unseen, all eligible cards, front first, and unshuffled. Multiple choice defaults to all vocabulary, up to ten eligible questions, kanji-to-meaning, and shuffled question order. Answer options are shuffled independently.
- Teacher preview uses all cards and hides the due scope; neither activity writes learner progress. Flashcard study retains FSRS ratings, undo, direction changes, and remaining-card shuffle. Returning to the list restores its scroll position and refreshes student due counts.
- Multiple choice is score-only practice with immediate feedback, vocabulary explanations, and final answer review. It stores no quiz history and does not change review scheduling. Duplicate or ambiguous prompts are omitted; at least two distinct answers are required.
- The native setup dialog locks background scrolling, keeps an explicit keyboard focus cycle, and restores focus on Escape, Cancel, or Close. Its body scrolls while the footer remains reachable; normalized selects retain visible chevrons and `44px` targets.

## Finish evidence

Scoped disposition: **ship**. The visual review's two accessibility findings are resolved: study selects retain their target size, and quiz feedback/result text has sufficient contrast. Dark-mode primary-button text was also improved. Desktop/mobile light/dark captures cover overview, setup, quiz, feedback, and results in `.impeccable/review/lesson-flow/`. Verification: 39 unit/component checks, 20 authenticated browser checks, lint, typecheck, and production build passed. No images were generated for this flow.

## Personal lesson extension

- Each joined class on `/student` has a **Tạo bài học cá nhân** action. It opens `/student/classes/[classId]/lessons/new`, a focused paper form for the title and description. The class name and privacy copy precede the form and explain that only the creator and classroom teacher can view the lesson, even after publication.
- `/student/classes/[classId]/lessons/[lessonId]` uses the shared lesson editor. The creator can edit the title, add or edit cards, import Excel or CSV, reorder or delete cards, and publish for their own study. Privacy copy stays beside the lesson's title and publication status.
- The student dashboard lists the creator's drafts and published personal lessons within the existing class list. Rows show personal, publication, and privacy labels plus a separate edit link. Published rows open the existing study flow; drafts remain authoring entries.
- The teacher's existing class list identifies each personal lesson's creator and limited audience. The teacher uses the existing editor and preview. Personal lessons retain flat rows and quiet metadata; focused authoring forms retain paper lift. On phones, actions stack below the text. No shared styles or visual identity changed.

### Local finish evidence, 2026-11-08

Scoped disposition: **SHIP** for the new personal-lesson UI. The finish reviewer inspected all 40 captures in `.impeccable/review/personal-lessons/`: creation, student dashboard, shared editor, and teacher class list, each in light and dark themes at `320x760`, `390x844`, `1440x900`, `1440x1000`, and `1920x1080`. The review found no material visual issues, missing labels, or invalid captures. The mechanical detector returned `[]`. No images or other assets were generated.

Local validation passed lint, typecheck, 47 unit tests, 3 real PostgreSQL integration tests, 32 full local browser E2E tests, and the production build. Screenshot review supports the visual disposition only; runtime and access-control evidence comes from the separate tests. Final cleanup found no project app, test, or build processes and no listeners on ports `3000` or `3110`.

Migrations ran only against isolated local PostgreSQL. This extension has no production database changes, deployment, or production browser verification. Production deployment and verification remain required before describing the UI as live.

### Production deployment, 2026-11-08

Deployed the personal-lesson code to `https://japanese-flashcard-nu.vercel.app` through the repository deployment command. Vercel deployment `dpl_9F9SWhAFRNuYMS91LD7SZawvXyYZ` reached `READY`. Production migrations `004_student_personal_lessons.sql` and `005_student_lesson_insert_returning.sql` committed; migration history confirms both and the subsequent dry run reports no pending migrations. The database verification command passed its schema, nine RLS tables, identity mapping, and restricted runtime-role checks.

Production smoke checks returned successful responses for `/`, `/privacy`, and `/terms`. Signed-out `/app`, `/teacher`, and `/student` responses direct visitors to `/`. In the existing signed-in admin student workspace, the deployed classroom action and personal-lesson creation form loaded with the privacy explanation. The form was inspected without submitting a production lesson. Full authoring, import, study, and peer-isolation behavior remains covered by the separate local browser and database tests.

Signed-in role checks also passed on production: `/app` routes to the active student or teacher workspace, and a mismatched workspace URL redirects to the active role. Admin workspace switching worked in both directions; the original student mode and `/student` page were restored. No production lesson or card was created during verification.
