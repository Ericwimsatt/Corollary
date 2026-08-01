# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Corollary is for degen best ball drafters using DraftKings or Underdog draft rooms. Users are actively drafting, scanning quickly, and trying to make better picks under time pressure.

## Product Purpose

Corollary is a Chrome browser extension overlay for best ball drafts. It combines roster construction, external ranking signals, draft capital, available-player context, and playoff schedule/correlation information so drafters can build the best possible team while the draft is in progress.

## Positioning

Corollary combines live draft-page data with opinionated fantasy-football decision layers: roster construction clarity first, ranking edges second, and playoff stack or correlation edges third.

## Operating Context

The extension runs directly on DraftKings and Underdog draft pages as a compact analyst overlay. It reads the live draft-room DOM, tracks the user's roster and available players, annotates rows with external ranking and stack information, and shows draft capital by position plus playoff opponent context.

## Capabilities and Constraints

- Manifest V3 Chrome extension built with React, TypeScript, Vite, and Effect.
- Shows draft metadata, user pick number, ADP capital, draft capital bars by QB/RB/WR/TE, and a playoff schedule table for rostered players.
- Annotates player rows with external rankings and stack labels.
- No backend or official platform API; draft data remains local in the browser.
- No customer claims, performance benchmarks, testimonials, logos, or official DraftKings partnership claims are established.

## Brand Commitments

The product name is Corollary. The product itself is minimal, no-nonsense, organized, and obvious about what is being shown. This landing page may be louder and more playful than the extension UI, but it must remain credible and honest.

## Evidence on Hand

- Extension implementation in `app/`
- Product documentation in `app/README.md`
- Existing draft-room screenshot at `app/docs/corollary-draft-room.png`

## Product Principles

- Make the next draft decision easier to understand in seconds.
- Prefer useful signal over decorative space in the product.
- Keep roster construction as the primary lens.
- Use ranking and correlation data as decision aids, not distractions.
- Keep marketing claims grounded in the product's actual mechanisms.
