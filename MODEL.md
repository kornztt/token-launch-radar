# Token Radar — model radar-3 design record

Radar-3 is the second revision of this entry (radar-2 was the submitted
version). Every change below is derived from the sealed 2026-11-14
snapshot's own figures; no protocol name is special-cased, no outside
data was fetched, and the snapshot itself was not modified.

## The model

implied = round(TVL^0.85 x 0.9 x growthMult x maturityMult)

- base = round(TVL^0.85 x 0.9). Sub-linear, so TVL alone does not
  decide the rank. Unchanged from radar-2.
- growth = clamp(change_7d, -50, 100); growthMult = 1 + growth/100 x 0.8.
  Radar-2 used weight 1.2 and cap 150, so one week could move implied
  value 2.8x up or 0.4x down — a 7x spread from the snapshot's noisiest
  figure. The board's own data shows why that is too much: one row
  reads +4448.47% in seven days, three rows read above +100%, six above
  +50%. A single week is a data spike as often as a trend. Radar-3 caps
  the swing at 1.8x / 0.6x (a 3x spread): growth still counts, it just
  cannot dominate TVL and age any more.
- maturity = 0.5 + 0.5 x min(age_days, 1460) / 1460. A protocol that has
  run up to four years with no token scores up to twice a newborn one.
  Unchanged. Unknown age still uses 365 days.

## What the damping does to the board

Top 5 unchanged in identity and order: Steakhouse Financial $64.1M,
Sentora Curator $62.0M, Gauntlet $42.5M, Veda $39.3M, USDD $29.2M.
Top 10 identical, top 20 overlap 19/20. The rows that fall are exactly
the extreme-growth ones: Monolith Market 106 -> 145 (+162.86% on $7.2M
TVL), NUVA 63 -> 92 (+160.80%), Shift DeFi 33 -> 44 (+4448.47%).
Anemoy Capital rises 148 -> 117: its negative week is punished less.
The board's story is the same; its noise is lower.

## Top movers: dollars gained, not percentage

The strip ranked by change_7d and headlined Shift DeFi at +4448.47%.
Radar-3 ranks by absolute TVL gained in seven days:
gained = TVL x change_7d / (100 + change_7d). The new top five are
Gauntlet +$84.3M, Sentora Curator +$63.8M, Shift DeFi +$46.6M,
Upshift +$38.3M, Figure Markets Prime +$29.1M. Shift DeFi's gain is
real money and stays on the strip — it just no longer headlines it
ahead of an $84M move, and the percentage is still printed small.

## Farm plans and the page

- Farm plan step 1 names the protocol's main chain ("Open a fresh
  wallet on Base ..."), so the first step is no longer identical on
  all 198 rows. The step text in board.json and the page's own
  derivation were changed together, so they still agree.
- Mobile: the movers strip had no rule under 900px and squeezed five
  cards side by side on a phone. It now stacks to one column.
- README: it still said 289 rows from the first build; the board has
  been 198 rows since the full watchlist exclusion was applied.

## Validation (radar-3, rebuilt 2026-11-17)

- Board: 198 rows, watchlist 40/40, implied strictly non-increasing,
  farm steps 3-12 per row, 20-600 characters each, no violations.
- Dossier 1,354,683 bytes (cap 1,572,864); dashboard source 40,531
  bytes (text cap 65,536); screenshots 301,995 / 376,806 / 305,701
  bytes (each under the 512 KiB cap), 1440x1440, retaken from the
  rebuilt dashboard with headed Firefox under Xvfb.
- Kit check: 13 passed, 0 failed (thinking_reproduces 486/1430 lines,
  33.9%, main.ts 12 authored lines). Lesson learned on the way: the
  check reads the COMMITTED state, not the working tree — the first
  two check runs failed at 28.9% because radar-3 was uncommitted, and
  the same bundle passed once commit 179e4c9 existed. Always commit
  before running check. The resubmission bundle must be rebuilt from
  this session before the parent submits, so the v2 agent's usage row
  attaches (it is written only when this session completes).
