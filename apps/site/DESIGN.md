---
name: Pluton, Golden Gate
description: Pluto is the desktop; Pluton's own windows are the glass laid over it.
colors:
  brand-ultramarine: "#2B3BFF"
  ultramarine-press: "#2232E0"
  ultramarine-night: "#3443FF"
  accent-text-night: "#9AA3FF"
  plate-ring: "#4F5DFF"
  ink: "#101018"
  ink-night: "#F4F4F7"
  ground-day: "#CBBFAE"
  ground-night: "#06060A"
  material-day: "rgb(248 248 251 / 0.58)"
  material-night: "rgb(24 24 32 / 0.52)"
  veil-day: "rgb(238 235 230 / 0.6)"
  veil-night: "rgb(4 4 8 / 0.42)"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 1.2rem + 4.3vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.15rem + 2.9vw, 4rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.032em"
  title:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(1.1875rem, 1.05rem + 0.4vw, 1.4375rem)"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 1rem + 0.2vw, 1.1875rem)"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  price:
    fontFamily: "Jost Variable, Jost, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 1.6rem + 4.4vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.045em"
    fontFeature: "tnum"
rounded:
  row: "10px"
  field: "12px"
  card: "16px"
  panel: "20px"
  window: "26px"
  pill: "999px"
  menu-item: "8px"
  menu-row: "9px"
spacing:
  margin: "clamp(16px, 3vw, 40px)"
  gap: "clamp(14px, 1.8vw, 28px)"
  bar: "48px"
  section: "clamp(112px, 13vw, 200px)"
components:
  window:
    backgroundColor: "{colors.material-day}"
    textColor: "{colors.ink}"
    rounded: "{rounded.window}"
  button-accent:
    backgroundColor: "{colors.brand-ultramarine}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "40px"
  button-accent-hover:
    backgroundColor: "{colors.ultramarine-press}"
  button-glass:
    backgroundColor: "{colors.material-day}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  segmented:
    rounded: "{rounded.pill}"
    height: "36px"
  field:
    rounded: "{rounded.field}"
    height: "44px"
  note:
    backgroundColor: "{colors.material-day}"
    rounded: "22px"
    padding: "14px 16px"
---

# Design System: Pluton, Golden Gate

Scope: the landing page in `apps/site`, built from the shared kit `packages/glass` (`@pluton/glass`), which the app in `apps/web` can adopt as is. The app still prints in the 1930 plates on this branch; moving it onto the kit is a separate step.

## Overview

**Creative North Star: "Pluto is the desktop."**

The page is a macOS 27 desktop whose wallpaper is Pluto, as New Horizons saw it in 2015. In the light appearance it is the dunes under the Norgay mountains; in the dark one, Pluto's backlit crescent, like a dynamic wallpaper that changes with the time of day. Pluton's own windows (the Agent, the Brain, a Play, a message, the MCP setup) are sheets of glass laid over it. Once the hero is behind the visitor, the desktop steps back the way it does behind a full-screen window: it blurs and takes a veil in the appearance's tone, so words read anywhere while the glass keeps its colour.

The AI is the subject of the first screen: the hero window is the real Agent, with the app's four suggestions, answering from a sample workspace. While it works, an ultramarine light runs round its edge and the logo's two halves close and open along their 17° cut.

**Key characteristics:**
- Glass over real pictures of Pluto, never over a flat colour or a gradient blob.
- Continuous corners (`corner-shape: squircle` where the browser draws it, larger radii so the curve keeps its size).
- One face, Jost, sentence case everywhere; weight and size carry the hierarchy.
- Ultramarine is what to press and what the AI is doing. Nothing else is blue.
- Three chapters leave the desktop for their own picture: the flyover video under "It asks before it acts", Pluto itself behind the price, and the 1930 plates in their window.

## Colours

The material is neutral and takes its colour from what is behind it. Tokens live in `packages/glass/src/glass.css` as `--gg-*` and switch with `prefers-color-scheme`, or with `data-theme` on `<html>` in the app.

- **Brand Ultramarine** (`#2B3BFF`): accent buttons, the selected item, the switch, the meter, scores of 80 and above, the AI edge and the thinking mark. In the dark appearance fills lift to `#3443FF` and ultramarine as text lifts to `#9AA3FF`.
- **Ink** (`#101018` day, `#F4F4F7` night) with two steps of the same ink at 68% and 48% for details and placeholders. Never a separate grey.
- **Material**: thin, regular and thick glass at 34%, 58% and 80% white by day; 30%, 52% and 76% smoke by night; blur 28px, saturation 185%. Without backdrop-filter, or with reduced transparency, the glass becomes a near-solid sheet.
- **Plate ring** (`#4F5DFF`): the marker around Pluto on the black 1930 plates, where the brand blue would sink.
- **Veil**: warm paper at 60% by day, black at 42% by night, over the blurred desktop past the hero.

**The Ink Is Rare Rule.** One ultramarine thing to press per window. Two blue buttons side by side means one of them should be plain.

## Typography

Jost Variable for everything except real code (the platform monospace in `.gg-code`). Display and headlines are 700, set tight (-0.035em, leading 0.98 to 1), balanced, sentence case, two lines at most at every width. Interface text inside windows is 13 to 16px; running text on the page is 17 to 19px at 1.55.

## Elevation

Glass is the one depth system. A window has a 0.5px outer edge, a bright inner top edge (the light catching it), a faint rim all round and one soft shadow with an offset; nested surfaces (cards, fields, sidebars) are wells with no shadow. Controls inside glass are fills, not more glass.

## Components (`@pluton/glass`)

React components that render to plain HTML, so the landing page ships them with no React in the browser; `wireGlass()` from `@pluton/glass/behaviors` gives the static segmented controls and switches their behaviour. In the app they take `value` and `onChange` like any controlled component.

- **Glass, Window, Sidebar, SideItem, Card, Row**: the material and its layouts. A window with a `sidebar` splits in two, the sidebar floating inside it as its own pane; `aiWorking` lights its edge.
- **Button, LinkButton** (`accent`, `glass`, `plain`, `quiet`; `sm`, `md`, `lg`): capsules that press to 96%.
- **Segmented, Switch, Field, Chip**: the controls.
- **Score, Meter, Avatar**: a lead's fit as a ring, budget used, initials on a colour picked from the name.
- **Thinking, Bubble, Looked, Approval**: the agent. An `Approval` card turns into its done line once approved.
- **Note, Disclosure, Code, Menubar, Logo, AppIcon**.

## Motion

- **Signature:** the agent at work: ultramarine light runs round the window (2.4s a turn), the logo's halves close and open (1.3s), the answer streams in a few words at a time, then its cards rise one after another.
- **The blink:** the 1930 plates still flip with `steps(1)` and no crossfade, with a pause button.
- **Entrances:** once per element, 26px rise with a blur that clears, 900ms `cubic-bezier(0.22, 1, 0.36, 1)`, 80ms apart in reading order. Notifications slide in from the right on a light spring.
- **The desktop:** blurs, scales to 108% and takes its veil over 900ms when the hero leaves.
- Reduced motion keeps every state and drops the travel; the flyover stays on its poster.

## Do's and Don'ts

- **Do** lay glass over a real picture of Pluto; **don't** put glass on a flat field where it reads as a grey box.
- **Do** keep text on the page in the full ink over the veiled desktop, and white over the dark scrim on photo chapters.
- **Do** label sample data as sample and credit every picture and clip on the credits page.
- **Don't** add a second typeface, gradients as decoration, or a second blue.
- **Don't** nest one card in another; a well inside a window is the limit.
