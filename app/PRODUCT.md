# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Corollary is for the creator and other fantasy football drafters using DraftKings best ball draft rooms. Users are actively drafting, scanning quickly, and trying to make better picks under time pressure.

## Product Purpose

Corollary is a Chrome browser extension overlay for DraftKings best ball drafts. It combines roster construction, external ranking signals, draft capital, available-player context, and playoff schedule/correlation information so drafters can build the best possible team while the draft is in progress.

Success means the drafter can understand their roster shape and key decision signals at a glance without leaving the draft room or doing manual cross-checking.

## Positioning

Corollary's useful mechanism is the combination of live DraftKings and Underdog page data with opinionated fantasy-football decision layers: roster construction clarity first, ranking edges second, and playoff stack or correlation edges third.

## Operating Context

The extension runs directly on DraftKings and UnderDog draft pages as a compact analyst overlay. It reads the live draft room DOM, tracks the user's roster and available players, annotates rows with external ranking and stack information, and shows draft capital by position plus playoff opponent context.

The product is used during an active draft, where glanceability, density, and fast comparison matter more than onboarding or broad explanation.

## Capabilities and Constraints

- Existing implementation is a Manifest V3 Chrome extension built with React, TypeScript, Vite, and Effect.
- The panel currently shows draft metadata, user pick number, an ADP capital toggle, draft capital bars by QB/RB/WR/TE, and a playoff schedule table for rostered players.
- The extension also annotates DraftKings player rows with external rankings and stack labels.
- The UI must remain compact, legible, and low-friction inside the host DraftKings draft room.
- It should feel like a separate analyst overlay rather than a DraftKings-native component.
- Explicit priority order: roster construction clarity, ranking edges, then playoff stack and correlation edges.
- Positional allocation should be communicated visually through comparative bars rather than extra interpretive labels such as "heavy", "thin", or "ok".
- Playoff matchup cells must make the opponent team obvious at a glance. Team colors should be prominent, and matchup text must maintain high contrast against those colors.
- The interface should be no-nonsense and minimal. A spreadsheet-like or analyst-sheet style is acceptable when it improves clarity.

## Brand Commitments

The product name is Corollary. The desired personality is minimal, no-nonsense, organized, and exceedingly obvious about what is being shown. Visual theme is allowed only when it supports clarity; decorative or overly playful treatment should not compete with the data.

## Evidence on Hand

- Extension manifest: `manifest.json`
- Main injected panel: `src/content/index.tsx`
- Panel app: `src/panels/App.tsx`
- Draft capital display: `src/panels/CapitalChart.tsx`
- Playoff schedule display: `src/panels/OpponentsTable.tsx`
- External rankings data: `src/data/rankings.ts`
- Schedule data: `src/data/schedule.json`

No customer claims, performance benchmarks, testimonials, logos, or official DraftKings partnership claims are established.

## Product Principles

- Make the next draft decision easier to understand in seconds.
- Prefer minimal, organized signal over decorative space.
- Keep roster construction as the primary lens for every display.
- Use ranking and correlation data as decision aids, not distractions.
- Fit comfortably over the draft room while retaining a clearly separate analyst-tool identity.
- Let visual comparisons carry meaning before explanatory labels do.
