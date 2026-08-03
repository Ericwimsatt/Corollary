---
name: Corollary
description: Minimal analyst overlay for live DraftKings best ball draft decisions.
colors:
  sheet-bg: "#ecf4ee"
  sheet-panel: "#ffffff"
  sheet-panel-raised: "#f7fbf7"
  sheet-panel-soft: "#dfeae3"
  sheet-line: "#ccdcd2"
  sheet-line-strong: "#9ab0a3"
  ink: "#101914"
  muted-ink: "#4a5d50"
  faint-ink: "#77877d"
  warning-ink: "#935a0d"
  qb-blue: "#1165b7"
  rb-green: "#004c54"
  wr-orange: "#bd6414"
  te-purple: "#6f4ab0"
  success-green: "#1fbf75"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "0"
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
components:
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet-panel}"
    rounded: "{rounded.sm}"
    height: "24px"
  input-compact:
    backgroundColor: "{colors.sheet-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "25px"
    width: "38px"
  panel:
    backgroundColor: "{colors.sheet-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
---

# Design System: Corollary

## Overview

**Creative North Star: "Draft Sheet"**

Corollary should feel like a compact analyst sheet embedded inside the draft room: direct, tabular, and built for fast comparison. The surface can be pleasant and polished, but it should never ask the drafter to parse a theme before reading the data.

The system is minimal by default. Roster construction is understood through visual allocation bars, not secondary interpretation labels. Playoff matchups are understood through prominent opponent team colors with high-contrast abbreviations. Supporting metadata stays quiet and narrow.

**Key Characteristics:**
- Minimal analyst-sheet presentation.
- Roster allocation bars carry the main meaning.
- Team matchup pills use strong team colors and legible abbreviations.
- Dense but not cramped spacing.
- System UI typography with tabular numerals.

## Colors

The selected light palette is **Sideline Ledger**: a field-neutral analyst sheet with green-tinted neutrals, restrained position accents, and full-strength NFL team colors only where team recognition matters.

The selected dark palette is **Navy Green**: an off-black analyst palette with near-black green surfaces, deep green borders, neutral text, and restrained position accents tuned for night drafting.

### Primary
- **Ink Black:** Primary text, selected controls, and the strongest structural emphasis.

### Secondary
- **QB Blue:** Quarterback allocation and position labels.
- **RB Green:** Running back allocation and position labels.
- **WR Orange:** Wide receiver allocation and position labels.
- **TE Purple:** Tight end allocation and position labels.

### Neutral
- **Sheet Background:** The extension shell behind the data modules.
- **Sheet Panel:** Primary content surface for bars, controls, and table cells.
- **Raised Sheet:** Control group background and subtle grouped surfaces.
- **Soft Sheet:** Allocation bar tracks and quiet empty states.
- **Sheet Line:** Thin dividers and table rules.
- **Muted Ink:** Secondary labels, table headings, and low-priority metadata.
- **Faint Ink:** Tertiary text only.

### Named Rules

**The Allocation Color Rule.** Position colors identify QB, RB, WR, and TE only; do not use them for unrelated decoration.

**The Team Color Rule.** Playoff matchup pills should use the opponent's real team colors prominently enough that the abbreviation is reinforced, not carrying recognition alone.

## Typography

**Display Font:** None.
**Body Font:** System UI stack with platform fallbacks.
**Label/Mono Font:** No separate mono face; tabular numerals are enabled where numbers align.

**Character:** The type should feel like a clean spreadsheet or trading sheet: compact, direct, and highly legible. Weight, alignment, and tabular numerals create hierarchy instead of decorative type choices.

### Hierarchy
- **Title** (900, 16px, 1.1): Product name only.
- **Heading** (850, 12px, 1.2): Section labels such as Draft Capital and Playoff Matchups.
- **Body** (700, 11px, 1.35): Player names, empty states, and compact explanatory text.
- **Label** (800, 10px, 1): Controls, table headings, matchup abbreviations, and metadata.

### Named Rules

**The No Extra Reading Rule.** If a bar or table already communicates the relationship, do not add a second text label explaining the same relationship.

## Layout

The overlay uses a simple vertical stack: header, controls, allocation comparison, matchup table. The layout should remain compact enough to sit inside DraftKings without forcing the draft room to feel reorganized.

Allocation belongs above playoff matchups because roster construction is the primary job. Within allocation, QB/RB/WR/TE should be directly comparable at a glance as four aligned target-based bars. Each bar track represents that position's intended maximum allocation; over-target values may visibly extend past the end of the track. The table remains dense and left-aligned, with narrow week columns.

## Elevation & Depth

Depth is minimal. The sheet shell may use one soft ambient shadow to separate it from DraftKings, but internal modules should rely on borders, spacing, and tonal contrast rather than stacked cards.

### Shadow Vocabulary
- **Overlay Lift** (`0 14px 30px rgba(16, 24, 32, 0.24)`): Used only on the injected extension shell.
- **Selected Control Lift** (`0 2px 6px rgba(16, 24, 32, 0.18)`): Used only to distinguish the selected segmented control.

### Named Rules

**The Flat Inside Rule.** Once inside the extension shell, use lines and tonal changes before shadows.

## Shapes

Shapes are compact and functional. The outer shell is gently rounded, controls use small radii, and matchup pills use pill-like compact capsules only because they must read as team markers.

## Components

### Segmented Control
- **Shape:** Compact rounded segments inside a bordered control well.
- **Selected:** Ink background with white text.
- **Unselected:** White background with muted text.
- **Focus:** Blue focus ring from the shell.

### Pick Input
- **Shape:** Small centered numeric field.
- **Style:** White background, strong border, bold tabular value.
- **Focus:** Blue focus ring.

### Allocation Bars
- **Style:** Position label, numeric capital, player count, and a horizontal bar.
- **Color:** Bar fill uses the position color; track stays neutral.
- **Behavior:** Bars are target-based and explain allocation on their own. Do not add percentages or interpretive labels like "heavy", "thin", or "ok".

### Matchup Pills
- **Style:** Compact color-endcap capsules with high-contrast abbreviations on the team's primary color and a narrow secondary-color endcap.
- **Color:** Use both opponent colors. Choose the abbreviation text color algorithmically against the primary color, using pure black or white for maximum contrast without an added backdrop.
- **State:** Hover opens the available-player tooltip.

### Tooltip
- **Style:** Compact white panel with a border and soft shadow.
- **Content:** Team name, abbreviation, top available players, positions, and ADP.

## Do's and Don'ts

### Do:
- **Do** make allocation comparison the most visually obvious part of the panel.
- **Do** use target-based bars instead of percentages or interpretive allocation labels.
- **Do** make playoff opponent colors prominent enough to recognize quickly.
- **Do** preserve dense rows and tabular alignment for live draft scanning.

### Don't:
- **Don't** add labels like "heavy", "thin", or "ok" next to allocation bars.
- **Don't** add percentage labels next to allocation bars.
- **Don't** make team-color matchup pills low-contrast or mostly neutral.
- **Don't** add decorative theme language that competes with the draft data.
- **Don't** create extra status chips when a single metadata line is enough.
