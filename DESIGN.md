---
name: Kotoba
description: A calm modern study desk for teaching and retaining Japanese vocabulary.
colors:
  canvas: "#edf0f3"
  surface: "#f9fafb"
  surface-strong: "#ffffff"
  ink: "#1e252d"
  muted: "#596570"
  line: "#d8dde2"
  brand: "#c63d3d"
  brand-strong: "#a82e32"
  wrong: "#d73b3e"
  unsure: "#a86600"
  correct: "#168a55"
  correct-ink: "color-mix(in srgb, var(--correct) 80%, var(--ink))"
  wrong-ink: "color-mix(in srgb, var(--wrong) 80%, var(--ink))"
  focus: "#245e9b"
typography:
  display:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(3.1rem, 6vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 650
    lineHeight: 1.25
  japanese-display:
    fontFamily: "Noto Sans JP, sans-serif"
    fontSize: "clamp(5rem, 16vw, 9rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
rounded:
  field: "12px"
  card: "16px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "40px"
  4xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "0.7rem 1rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.field}"
  button-secondary:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "0.7rem 1rem"
    height: "44px"
  field:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0.8rem 0.9rem"
  paper-card:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
  navigation-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "0 0.75rem"
    height: "44px"
  status-published:
    backgroundColor: "color-mix(in srgb, {colors.correct} 10%, transparent)"
    textColor: "{colors.correct}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  review-control:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: Kotoba

## Overview

**Creative North Star: "Bàn học hiện đại"**

Kotoba feels like a calm modern study desk: a cool mineral workspace holds bright paper-like learning surfaces, precise charcoal type, and one restrained vermilion mark. The interface is quiet enough for long study sessions but never sterile; generous whitespace and highly legible Japanese type keep the learning object in command.

The same world spans persuasion and operation. The landing page pairs a concise promise with a live flashcard; teacher and student shells use planner-like rails and disciplined lists; the study session removes nearly everything except one physical card and its next action. Avoid ornamental Japanese motifs, decorative dashboards, and interchangeable card grids.

**Key Characteristics:**

- Cool mineral canvas with white paper surfaces
- Large Japanese learning content paired with compact Vietnamese controls
- Vermilion used sparingly for identity and primary action
- Lists and dividers for information; elevated cards only for focused work
- One physical-plane flip as the signature interaction

## Colors

The palette resembles charcoal ink and white paper on a cool grey desk, with vermilion identity and explicit semantic feedback.

### Primary

- **Kotoba Vermilion** (`brand`): Marks the brand, primary actions, due counts, progress fill, and selected emphasis.
- **Pressed Vermilion** (`brand-strong`): Deepens the primary action on hover; it is not a second accent.

### Secondary

- **Focus Blue** (`focus`): Reserved for keyboard focus and active field boundaries so accessibility feedback stays distinct from brand emphasis.

### Tertiary

- **Answer Red** (`wrong`): Means an incorrect recall or error only.
- **Uncertain Amber** (`unsure`): Means a difficult or uncertain recall only.
- **Success Green** (`correct`): Means correct recall, completion, or published success only.
- **Feedback Ink** (`correct-ink`, `wrong-ink`): Strengthens quiz feedback and result labels against the current paper or canvas; retain the base semantic colors for borders, icons, and tinted answer surfaces.

### Neutral

- **Mineral Canvas** (`canvas`): The page and app-workspace ground.
- **Quiet Paper** (`surface`): Navigation rails, subdued containers, details panels, and empty states.
- **Bright Paper** (`surface-strong`): Flashcards, forms, active controls, and elevated work surfaces.
- **Charcoal Ink** (`ink`): Primary copy and icons.
- **Pencil Grey** (`muted`): Supporting copy, metadata, keyboard hints, and quiet links.
- **Desk Line** (`line`): Dividers, table rules, field boundaries, and progress tracks.

Dark mode preserves the same semantic roles with `canvas` `#14191f`, `surface` `#1b2229`, `surface-strong` `#222a32`, `ink` `#f1f3f4`, `muted` `#aeb8c1`, `line` `#36414b`, `brand` `#e26363`, `brand-strong` `#f07b7b`, `wrong` `#ef6a6d`, `unsure` `#e5a52f`, `correct` `#42b980`, and `focus` `#80b9ef`.

### Named Rules

**The One Vermilion Voice Rule.** Use vermilion for brand identity, the primary action, and immediate due-state emphasis; its rarity gives it authority.

**The Feedback Is Meaning Rule.** Red, amber, and green communicate answer or system status, always with a label or icon; never use them as decoration.

## Typography

**Display Font:** Geist (with sans-serif fallback)  
**Body Font:** Geist (with sans-serif fallback)  
**Japanese Font:** Noto Sans JP (with sans-serif fallback)  
**Label/Mono Font:** Geist for labels; Geist Mono for spreadsheet headers and machine-formatted text

**Character:** Geist keeps the Vietnamese interface compact, contemporary, and matter-of-fact. Noto Sans JP makes Japanese study content feel native to the same system while carrying enough scale and weight to become the visual focus.

### Hierarchy

- **Display** (700, fluid `3.1rem–5.25rem`, `0.94`): Landing promise only; tightly tracked and intentionally broad.
- **Headline** (700, fluid `2.25rem–3rem`, `1`): Page titles and major completion states.
- **Title** (700, `1.5rem`, `1.33`): Section and surface headings.
- **Body** (400, `1rem`, `1.5`): Explanations and operational copy; persuasive paragraphs grow to `1.125rem` and stay near `48–55ch`.
- **Label** (650, `0.86rem`, `1.25`): Fields, navigation, metadata, and buttons; micro-labels may use uppercase with `0.08em` tracking.
- **Japanese Display** (600, fluid `5rem–9rem`, `1`): The kanji face of the active study card.

### Named Rules

**The Learning Object Leads Rule.** Japanese content may be dramatically larger than the interface around it; Vietnamese controls remain compact and precise.

## Layout

Kotoba uses a planner grid with generous breathing room. The landing surface is capped at `1380px` and becomes a two-column promise/card composition at `1024px`. Product pages use an app shell: a `248px` sticky rail from `768px` upward and a horizontal, scrollable navigation band below it. Primary content is capped at `1152px`; focused study content is capped at `896px`, with the card itself at `768px`.

Spacing follows an `8px`-based rhythm, most often `12`, `16`, `20`, `24`, `32`, `40`, and `48px`. Forms and metadata can be compact inside a generous outer composition. Teacher pages favor one dominant list plus a `360–390px` authoring rail rather than equal card grids. On narrow screens, columns stack, outer padding falls to `16–20px`, and study controls dock to the bottom edge for one-hand reach.

Lesson overviews cap the vocabulary list at `1024px`. Repeated mode controls bracket the list, pairing horizontally from `640px` and stacking below it. Vocabulary rows use a `1:1.6` reading-to-meaning grid from the same breakpoint and a single column on mobile. A centered setup dialog temporarily takes focus; active flashcards and quiz questions then return to a single learning object.

Personal-lesson creation uses one focused paper form capped at `42rem`. Student class headers and lesson rows retain the flat list structure; their creation, study, and edit actions stack below the text on phones and align beside it from `640px`. Personal lessons use the same editor layout as teacher-authored lessons.

**The One Dominant Object Rule.** Each viewport has one clear working object—promise, list, form, or flashcard—and supporting regions must remain visually subordinate.

## Elevation & Depth

The system is flat by default and gains depth selectively. Dividers and tonal surfaces structure navigation, lessons, progress, and tables; the single paper shadow (`0 22px 55px rgba(49, 63, 77, 0.12)`) is reserved for flashcards, focused forms, role choices, and circular review controls. Dark mode deepens it to `0 24px 60px rgba(0, 0, 0, 0.32)`.

### Shadow Vocabulary

- **Paper Lift** (`0 22px 55px rgba(49, 63, 77, 0.12)`): A soft ambient lift for objects that are handled or acted upon.
- **Focus Ring** (`0 0 0 3px color-mix(in srgb, var(--focus) 45%, transparent)`): Keyboard focus on all interactive elements; fields use a quieter `20%` mix while focused.
- **Modal Backdrop** (`rgba(16,23,31,.55)`): Dims the vocabulary overview behind the native setup dialog; the dialog uses Paper Lift in the browser's top layer.

### Named Rules

**The Paper Is Earned Rule.** Lists and passive containers stay flat; use paper lift only when the user is handling, choosing, or studying the surface.

## Shapes

Rounded geometry is deliberate and limited. Interactive fields, buttons, and navigation items use gently curved `12px` corners; substantial cards and panels use `16px`; status chips, brand marks, progress tracks, icon actions, and review controls are fully circular. One-pixel rules separate dense information without boxing every item. Flashcards clip their content so the front and back read as one physical plane.

**The Three-Radius Rule.** Use `12px`, `16px`, or a full pill; introducing nearby radii weakens the system's precision.

## Components

Components feel tactile but restrained: crisp labels, reachable targets, a soft paper response, and state changes that preserve attention.

### Buttons

- **Shape:** Gently curved rectangle (`12px`) with a `44px` minimum touch target.
- **Primary:** Kotoba Vermilion with white text in light mode and Mineral Canvas text in dark mode, `0.7rem 1rem` padding, and weight `700`. The dark-mode text preserves contrast against the lighter vermilion.
- **Hover / Focus:** Deepen to Pressed Vermilion over `180ms`; use the blue focus ring for keyboard navigation and a `1px` downward press response.
- **Secondary:** Bright Paper with Charcoal Ink, a Desk Line border, and weight `650`; do not tint it vermilion.

### Chips

- **Style:** Fully rounded, compact, and semantically tinted at roughly `10%` background strength.
- **State:** Published uses Success Green; draft uses a muted Desk Line fill. Chips name status rather than acting as decoration.

### Cards / Containers

- **Corner Style:** Substantial cards use `16px`; the active flashcard uses the same silhouette at much larger scale.
- **Background:** Bright Paper for focus, Quiet Paper for supporting or empty surfaces.
- **Shadow Strategy:** Paper Lift only on handled surfaces; see Elevation & Depth.
- **Border:** Usually none on paper surfaces; dense lists and tables use top, bottom, or row dividers instead.
- **Internal Padding:** Usually `24px`, rising to `48px` on the desktop study card and falling to `28px` on mobile.

### Inputs / Fields

- **Style:** Bright Paper, `1px` Desk Line border, `12px` corners, and `0.8rem 0.9rem` padding.
- **Focus:** Focus Blue border plus a soft `3px` blue ring.
- **Error / Disabled:** Errors use Answer Red with explicit text; disabled actions retain their silhouette and fall to `35–60%` opacity.
- **Study selects:** A `44px` minimum height, normalized native appearance, and a visible trailing chevron keep direction and scope controls consistent across browsers.

### Navigation

The desktop rail sits on Quiet Paper with a Desk Line boundary. Items are `44px` high, semibold, and become Bright Paper on hover. On mobile the rail becomes a horizontal band with scrollable items instead of a collapsed icon drawer.

### Personal lesson authoring

Personal lessons reuse the existing paper forms, fields, status chips, and flat vocabulary rows. A secondary creation action belongs to each joined class header. The creation form places the class name and privacy explanation above the fields, including that publication keeps the same audience. Dashboard rows place personal, publication, and privacy labels beneath the title, with a separate edit action. Teacher class rows add creator and privacy metadata in the same quiet text treatment. The shared editor keeps privacy copy near the title and status; its title, card, import, ordering, deletion, and publication controls retain the established teacher-editor language.

### Study Card and Review Controls

The study card is the signature object: a Bright Paper plane, `16px` corners, generous Paper Lift, and Japanese type at near-reading scale. It flips around the Y axis in `480ms` with `cubic-bezier(.4, 0, .2, 1)` and supports either face as the starting prompt. Face visibility changes at the turn's midpoint so WebKit does not show mirrored text. A compact direction selector and shuffle action sit above the card; shuffling reorders only the remaining cards. Swipe left grades Sai and swipe right grades Đúng. The card follows the pointer without a fixed travel cap, accepts a deliberate `56px` swipe, then leaves the viewport in `280ms` before saving the review. Horizontal page scrolling is clipped for the study session so the exiting card cannot drag the page sideways. The next card is visible underneath during the save with a quiet saving overlay; the last card reveals a saving state. A failed save returns the original card. Short drags snap back, and tapping still flips. All four review controls stay fully visible on either face, with a status message when there is nothing to undo. Saving temporarily guards repeated actions without dimming the controls. Review actions are circular paper buttons labeled Hoàn tác, Sai, Chưa chắc, and Đúng; semantic color is reinforced by icon, text, and keyboard shortcut. Reduced-motion mode removes the animated flip and release travel without hiding content or feedback.

### Vocabulary Rows and Mode Controls

Vocabulary entries stay flat with dividing rules and `24–28px` vertical spacing. Kanji and reading form one group; Vietnamese meaning, Japanese example, and translation form the other. The same entry appears in the overview, quiz explanation, and final answer review. The two mode buttons use bordered Bright Paper surfaces with `16px` corners, an icon, a short description, and a quiet arrow; hover changes the border to vermilion without adding a shadow.

### Study Setup Dialog

Both modes share a centered native dialog with `16px` corners and a maximum width of `34rem`. Its width and maximum height leave `16px` clearance on each viewport edge. A scrollable form body sits between the fixed header and action footer, preserving access to Cancel and Start on short screens. Direction, student scope, count or all, and shuffle use the existing field language. Opening locks background scrolling and cycles Tab within the dialog; Escape, Cancel, and Close restore focus to the initiating mode button or lesson title. Entry uses a quiet `180ms` fade with `6px` travel, removed for reduced motion.

### Multiple-Choice Question and Review

One paper question leads above flat answer buttons with `12px` corners and a `64px` minimum height. Options stack on mobile and form two columns from `640px`. Selection locks the answer, reveals labeled semantic feedback and the full vocabulary entry, and exposes an explicit next action. The correct answer and a wrong selection use tinted surfaces, borders, and icons; feedback text uses Feedback Ink. Final results return to flat vocabulary rows with a score and answer labels. Focus moves to each new question or the results heading.

## Do's and Don'ts

### Do:

- **Do** let one learning or authoring object dominate each view.
- **Do** use flat lists, dividers, and whitespace for dense operational information.
- **Do** keep interactive targets at least `44px` high and keyboard focus visibly blue.
- **Do** pair every answer color with a label, icon, or status phrase.
- **Do** keep the study controls reachable at the bottom of a narrow screen.

### Don't:

- **Don't** decorate with torii gates, brush textures, rising suns, or other ornamental Japanese clichés.
- **Don't** turn every dataset or action into an elevated dashboard card.
- **Don't** use Answer Red, Uncertain Amber, or Success Green for non-semantic accents.
- **Don't** compete with the active flashcard using secondary panels, dense chrome, or oversized navigation.
- **Don't** invent new shadows, radii, or accent colors when the existing vocabulary already expresses the state.
