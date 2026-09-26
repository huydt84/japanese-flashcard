# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated and confirmed: Next.js App Router with TypeScript and Tailwind CSS, Supabase Auth/PostgreSQL/Realtime, deployed to Vercel.

## Users

- Teachers create Japanese classes, lessons, flashcards, invitations, and inspect basic learner progress.
- Students accept class invitations and review assigned vocabulary with spaced repetition.
- The product supports multiple independent teachers and classes; tenant data must remain isolated.

## Product Purpose

Kotoba helps a teacher turn a Japanese vocabulary lesson into an approachable flashcard practice flow. Success means a teacher can publish and assign a lesson quickly, while a student can understand what is due and complete a focused review session from desktop or mobile.

## Positioning

The teaching workflow and the learning loop live together: teacher-authored kanji cards become personal FSRS review schedules for each invited learner, without requiring either person to manage a general-purpose flashcard tool.

## Operating Context

- Vietnamese interface with Japanese learning content and Vietnamese meanings.
- Teachers author cards individually or import a fixed CSV format.
- Students study the published lessons of classes they have joined.
- Invitations are delivered in-app and may wait for a matching Google account to register.

## Capabilities and Constraints

- Google OAuth is the only sign-in method.
- A regular user chooses exactly one permanent role, teacher or student, during first-run onboarding.
- A privileged development admin can switch between the real teacher and student workspaces; admin is not offered during onboarding and has no separate product dashboard.
- Teachers create classes, draft/publish lessons, manage cards and invite students by email.
- Students accept or decline invitations, join classes and study published lessons.
- Cards contain kanji, hiragana, Vietnamese meaning, a Japanese example and its Vietnamese translation.
- Review ratings are Again, Hard and Good, plus an immediate undo action; scheduling uses FSRS with 0.9 requested retention.
- Teachers receive basic progress metrics, not advanced analytics.
- MVP excludes passwords, audio, outbound email, chat, general-purpose admin tooling and self-service account deletion.

## Brand Commitments

- Working product name: Kotoba.
- Visual direction: a modern study desk with a cool grey canvas, generous whitespace, white learning surfaces and highly legible Japanese type.
- The provided reference image is authority only for the circular undo/wrong/unsure/correct study controls.
- Japanese red is the product accent. Red, amber and green are reserved for semantic answer feedback.

## Evidence on Hand

- Reference image for the four study controls: `/var/folders/b9/12z2hmf16nqc2pwkflld1d_h0000gn/T/TemporaryItems/NSIRD_screencaptureui_dAdY18/Screenshot 2026-09-16 at 17.48.16.png`.
- No production logo, brand assets, customer proof or existing application implementation is available.

## Product Principles

- Keep authoring fast enough for a teacher preparing a real lesson.
- Make the next learning action obvious and reachable with one hand.
- Treat learner progress and class membership as private, tenant-isolated data.
- Use calm visual hierarchy; reserve strong colour for actions and learning feedback.
- Preserve review history even when the latest answer is undone.

## Accessibility & Inclusion

- Keyboard-operable study flow with visible focus and screen-reader labels.
- WCAG AA contrast, reduced-motion support and responsive layouts down to 390px.
- Do not rely on colour alone to communicate answer meaning.
