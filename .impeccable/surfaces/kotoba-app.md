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
