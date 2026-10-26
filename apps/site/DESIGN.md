---
name: Pluton (marketing site)
description: A run of photographic plates, negative and print, where the one thing that moved is inked in ultramarine.
colors:
  brand-ultramarine: "#2B3BFF"
  ultramarine-press: "#2232E0"
  plate-grey: "#DEDFDA"
  plate-step: "#CDCFC7"
  print-black: "#0E0E12"
  print-step: "#1D1D24"
  paper: "#F3F3EF"
  ink: "#101018"
  ink-muted: "#4A4B52"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 8.6vw, 8.5rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 0.8rem + 3.4vw, 4rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.15rem + 0.8vw, 1.875rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(0.875rem, 0.85rem + 0.1vw, 0.9375rem)"
    fontWeight: 400
    lineHeight: 1.45
  price:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(3rem, 1rem + 4.4vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
rounded:
  none: "0px"
spacing:
  frame: "10px"
  margin: "clamp(16px, 2.2vw, 32px)"
  gap: "clamp(12px, 1.6vw, 24px)"
  bar: "60px"
  chapter-y: "160px"
components:
  button-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 26px"
    height: "52px"
  button-paper-hover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.brand-ultramarine}"
  button-blue:
    backgroundColor: "{colors.brand-ultramarine}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 26px"
    height: "52px"
  button-blue-hover:
    backgroundColor: "{colors.ultramarine-press}"
  segment:
    backgroundColor: "{colors.plate-step}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  segment-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  interface-fragment:
    backgroundColor: "{colors.plate-grey}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "26px"
    width: "460px"
  faq-item:
    backgroundColor: "{colors.plate-step}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "18px 24px"
    height: "72px"
  faq-item-open:
    backgroundColor: "{colors.brand-ultramarine}"
    textColor: "{colors.white}"
  ticket:
    backgroundColor: "{colors.brand-ultramarine}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "44px"
    width: "1180px"
  top-bar:
    backgroundColor: "{colors.print-black}"
    textColor: "{colors.paper}"
    height: "60px"
    padding: "0 {spacing.margin}"
---

# Design System: Pluton (marketing site)

Scope: `apps/site`, and the product app in `apps/web`, which prints in the same plates at app density (tokens and utilities in `apps/web/src/styles.css`): plate-grey content, a print-black sidebar chapter, Jost, square corners, ultramarine for what moved and what to press, and the blink for the AI at work.

## Overview

**Creative North Star: "The Blink Comparator"**

Pluto was found by flicking between two photographs of the same sky and seeing the one dot that moved. The site is built as that instrument: a run of photographic plates, each chapter a whole flat field of plate grey or print black, with brand ultramarine as the ink that marks what moved and what to press. Nothing floats, nothing glows; a surface is told apart from its neighbour by one step in tone, never by a line or a shadow.

Density is poster-like. Display type is set huge, bold and uppercase, and sits directly on the field; body text is sentence case and calm. The product appears only as interface fragments printed in the two inks of the chapter they sit in, so the app is shown as part of the plate rather than as a screenshot pasted on top. Real archival photographs (the 1930 discovery plates, the comparator, Tombaugh's logbook, the astrograph, New Horizons' Pluto) are shown in greyscale and carry their credits in the footer.

Motion has one signature: the blink, a hard two-state flip in `steps(1)` with no crossfade. Everything else is quiet entrances that happen once.

**Key Characteristics:**
- Chapters are full-bleed flat fields; grey and black alternate, ultramarine owns one whole chapter (the market blink) and the price ticket.
- One face, Jost, from 400 to 700. Uppercase bold display, sentence-case text.
- Square corners on every rectangle. Circles only where the world is round: stars, the marker ring, the switch, ticket notches.
- No rules, no shadows, no gradients at rest.
- Interface fragments (`data-ui`) printed in their chapter's two inks.
- The blink as the one signature motion.

## Colors

Two photographic grounds, two inks, and one ultramarine that is reserved for the mark and the action.

### Primary
- **Brand Ultramarine** (`brand-ultramarine`): the inked marker ring around Pluto, the second line of the intro heading, the selected lead, status lines inside fragments, every primary action, the open FAQ item, the price ticket, and the whole "Blink a market" chapter. Also selection and focus colour on light grounds.
- **Ultramarine Press** (`ultramarine-press`): hover state of blue buttons and the unselected segment fill on the ticket. Never a ground of its own.

### Neutral
- **Plate Grey** (`plate-grey`): the light chapter field (intro, FAQ, the hero frame) and the paper of every interface fragment.
- **Plate Step** (`plate-step`): one tone down from Plate Grey. Separates surfaces on a grey field: alternate rows in fragments, segments, closed FAQ items, the fragment chapter beside "How it works".
- **Print Black** (`print-black`): the dark chapter field (how it works, messages, pricing, footer) and the page background.
- **Print Step** (`print-step`): one tone up from Print Black; the empty slider track.
- **Paper** (`paper`): text on black and blue fields, the light button, the mover evidence card.
- **Ink** (`ink`): text on grey fields and on paper; the selected segment.
- **Ink Muted** (`ink-muted`): term labels in fragment definition lists and the "To / Subject" prefixes. Used only inside fragments.

### Named Rules
**The Two Inks Rule.** Every chapter prints in exactly two inks: its field and its text colour (grey + ink, black + paper, blue + white). Ultramarine is the only colour allowed to cross into a grey or black chapter.

**The Step Not Line Rule.** Adjacent surfaces are separated by a step in tone (Plate Grey to Plate Step, Print Black to Print Step), never by a border or divider.

**The Ink Is Rare Rule.** On grey and black chapters, ultramarine marks one thing that moved or one thing to press. If two blue things compete on one screen, one of them is wrong.

## Typography

**Display Font:** Jost Variable (with Jost, system-ui)
**Body Font:** Jost Variable (same face)

**Character:** A single geometric face doing everything, from a 136px uppercase headline to a 14px caption. The contrast comes from weight, case and size, never from a second family.

### Hierarchy
- **Display** (700, `clamp(3.25rem, 8.6vw, 8.5rem)`, 0.9, -0.03em, uppercase): the hero headline over the plates and the intro statement. The hero line size also fits to its longest line (`92cqw / (chars * 0.66)`). The footer address uses the same treatment at `clamp(2rem, 7.4vw, 9rem)`.
- **Headline** (700, `clamp(2.25rem, 0.8rem + 3.4vw, 4rem)`, 0.9, -0.03em, uppercase, balanced): chapter heads such as "First, it reads your website", "Every word is yours to check", "Pluton, hosted", "Before you start".
- **Title** (500, `clamp(1.375rem, 1.15rem + 0.8vw, 1.875rem)`, 1.15): step titles in the Messages column. In the blink chapter the same size is set 700 uppercase as its heading.
- **Body** (400, `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)`, 1.5): all running text, kept to 42-58ch. Buttons and segment labels use this size at 500.
- **Label** (400, `clamp(0.875rem, 0.85rem + 0.1vw, 0.9375rem)`, 1.45): fragment content, captions, navigation, sample notes ("Sample market. Names are made up."), footer meta.
- **Price** (700, `clamp(3rem, 1rem + 4.4vw, 5.5rem)`, 0.9, -0.04em, tabular figures): the ticket price only.
- **Stair** (700, 2.25rem, 1.08, -0.02em): the intro sentence whose lines step right by `6vw` each; collapses to inline text on phones.

### Named Rules
**The One Face Rule.** Jost only. Hierarchy is weight (400 / 500 / 700), case and size.

**The Shout And Speak Rule.** Uppercase belongs to Display and Headline. Everything a person reads for meaning is sentence case.

## Layout

A 12-column grid with no gutter at the chapter level and `gap` (`clamp(12px, 1.6vw, 24px)`) inside chapters; side margin `margin` (`clamp(16px, 2.2vw, 32px)`). Chapters run full bleed and roughly a viewport tall (88-100svh), with 160px vertical padding on text-led chapters (pricing, FAQ).

- **Hero:** a plate-grey frame of `frame` (10px) around a black panel spanning columns 1-10, where the two 1930 plates blink; columns 11-12 hold five stacked chapter swatches, each painted in its chapter's ground, which are the navigation.
- **Top bar:** fixed, 60px, hidden until the hero has scrolled away, then repaints itself in the ground of the chapter beneath it.
- **How it works:** a half/half split, words on black and fragment on plate step, driven by one stepped slider across the bottom.
- **Messages:** the output sits sticky on black in columns 1-6 while the controls scroll on grey in columns 7-12.
- **Pricing:** one centred ticket, max 1180px, 7fr / 3fr main and stub.

Breakpoints: tablet at 1080px (bar nav hidden, split layouts stack), phone at 760px with its own composition (hero panel 72svh with the swatches as a row of 52px bars beneath, frame drops to 8px, slider moves under its fragment, ticket stacks with a horizontal perforation).

## Elevation & Depth

The system is flat. There are no shadows, no gradients and no translucent layers at rest; depth is conveyed only by a tonal step between neighbouring fields and by real photographs. Focus is a 3px solid outline offset 3px, in ultramarine on light grounds and paper on blue or black.

### Named Rules
**The Flat Plate Rule.** Surfaces are flat at rest. If something needs to stand apart, step its tone one notch; never draw a line or cast a shadow.

## Shapes

Every rectangle has square corners (0px): buttons, segments, fragments, cards, FAQ items, the ticket, the slider thumb (a 32px square). Circles appear only where the world is round: stars in the sample market, the 3px ultramarine marker ring around the dot that moved, the poster-size blink switch (pill track, round thumb), the ticket's half-circle notches and perforation dots, and the clipped disc of Pluto in the footer.

## Components

### Buttons
Flat, square, one fill, sentence case.
- **Shape:** square (0px), min-height 52px, 0 26px padding, 500 weight at body size.
- **Paper:** paper on ink, used on black, blue and the hero panel; hover goes white with ultramarine text.
- **Blue:** ultramarine with white text, used on grey grounds and in the bar; hover deepens to Ultramarine Press.
- **Press:** `scale(0.97)` over 140ms ease-out. Compact variant in the top bar at 40px.

### Segmented choices
- **Style:** a row of square 44px chips with 6px gaps, Plate Step on grey, hover `#C0C2B9`.
- **State:** selected flips to Ink with Paper text. On the ticket the chips sit in Ultramarine Press and the selected one turns Paper.
- **Approve control:** a 52px blue block that, when checked, becomes Ink and reads "Approved · Undo"; in automatic mode a 48 x 8px window bar empties over ten seconds.

### Interface fragments (signature)
The product, printed into the chapter rather than pasted on it. Any element marked `data-ui`.
- **Corner Style:** square.
- **Background:** Plate Grey with Ink text; alternating rows in Plate Step; term labels in Ink Muted.
- **Accent:** one ultramarine thing per fragment: the company name, the selected lead, the status line, the primary action.
- **Internal Padding:** 26px; max width 460px (mail 480px, padding 28px).
- **Shadow / Border:** none.

### Blink switch (signature)
A poster-size toggle (14em x 7em at up to 30px per em) that flips the sample market between Monday and Thursday. Paper track with ultramarine thumb when off; inverted when on, and the whole chapter turns from blue to print black. The movers jump without interpolation and gain a paper marker ring and their name.

### FAQ
- **Style:** stacked full-width items, 8px apart, Plate Step on grey, 72px summary, plus sign drawn from two 3px bars.
- **State:** the open item becomes an ultramarine block with white text; only one opens at a time.

### Price ticket
An ultramarine ticket with a main area and a stub separated by a perforation of 6px print-black dots and two 28px notches cut in the page colour.

### Navigation
- **Hero swatches:** five chapter-coloured blocks, 20px padding, body size 500; hover slides the label 8px right.
- **Top bar:** label-size links at 62% opacity, the current chapter at full opacity and underlined; a compact blue Start button.
- **Languages:** EN FR IT ES DE in the hero panel, current one underlined.

### Motion
- **The blink:** `steps(1, end)` at a 1.6s cycle, swapping plate, marker and date with no fade. Pausable; with reduced motion it becomes a manual flip.
- **Entrances:** once per element, 24px rise and fade over 800ms `cubic-bezier(0.22, 1, 0.36, 1)`, staggered 80ms in reading order. The hero headline rises out of its line mask over 1000ms.
- **State changes:** 140ms press, 180ms hover, 240ms UI, 300ms field repaint. Ambient: a 24s plate drift and a 120s turn of Pluto in the footer, both stopped by reduced motion.

## Do's and Don'ts

### Do:
- **Do** build every chapter as one full-bleed flat field from Plate Grey, Plate Step, Print Black or Brand Ultramarine, printed in two inks.
- **Do** separate neighbouring surfaces by one tonal step (#DEDFDA to #CDCFC7, #0E0E12 to #1D1D24).
- **Do** set display and chapter heads in Jost 700 uppercase at line-height 0.9 and -0.03em tracking; keep reading text in sentence case.
- **Do** show the product as `data-ui` fragments in their chapter's inks, with exactly one ultramarine accent each.
- **Do** keep every rectangle square (0px) and reserve circles for things that are round in the world.
- **Do** make the blink a hard `steps(1)` flip and offer a pause; give reduced-motion users a manual flip.
- **Do** label sample data as sample ("Names are made up") and credit every archival photograph.

### Don't:
- **Don't** draw rules, borders or dividers between surfaces.
- **Don't** cast shadows or use gradients on surfaces at rest.
- **Don't** round the corners of buttons, cards, fragments or inputs.
- **Don't** add a second typeface.
- **Don't** spread ultramarine as decoration; it marks what moved or what to press.
- **Don't** paste a full app screenshot into a device frame; print a fragment instead.
- **Don't** crossfade the blink; it is a cut.
