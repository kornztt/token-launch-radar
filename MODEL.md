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

## Radar-4 (2026-11-19): per-row drivers, two charts, one principled model change

### The model change: unknown age 365 -> 418 days

The only model change, and it comes from the snapshot's own figures. An
unlisted age used an arbitrary 365 days. The board's own known ages say
otherwise: among the 198 board rows, 191 carry a listed date and their
median is 418 days (mean 470, p25 178, p75 649). Radar-4 scores an
unlisted protocol as a typical board protocol, not a young one. Only
seven rows carry no listed date, so the effect is small and measured:
their implied values rise about 3%, 17 rows shift rank by at most four
places (Plasma One 85 -> 81), and the top ten do not change.

### What was deliberately not changed

- Growth weight 0.8, cap 100, floor -50: the floor and cap bind only
  four board rows (one below -50%, three above +100%), and 140 of 198
  rows had a negative week (median -3.75%), so the term mostly holds
  rows back already. No further damping is justified.
- Maturity cap 1460 days: only five board rows are older than four
  years (oldest 1845 days). Extending the cap would hand those five
  rows up to 13% more for age alone, which is exactly what the cap
  exists to stop.
- TVL exponent 0.85: the scatter chart (below) shows the base line
  fits the board's shape — the dots cluster around it, and the scatter
  off it is what growth and age explain. No exponent change is
  justified by the figures.

### Per-row drivers, visible in the table

Each row now carries a drivers bar in a "Why this rank" column: the
week's slice and the age's slice of the gap between its TVL base and
its implied value, on a fixed -100% to +100% scale, green when they
lift the value and red when they hold it back. The split is exact:
implied / base - 1 = (growthMult - 1) + growthMult x (maturityMult - 1),
so the two slices always add up to the gap. The same split is spelled
out in dollars in the detail view ("Base $59.2M +4.5% from the week
-32.8% from age = $42.5M implied"), and the rank reason in the detail
view now uses the slices instead of the raw multipliers. The age slice
is always zero or negative — the base assumes a fully mature four-year
record — so the reason text only calls a protocol's age out on its own
when it is very young (under 180 days) or fully mature (1460 days or
more); anything in between is reported as TVL doing the work. The bar and
the board share one function (drivers() in lib/model.ts), so they
cannot disagree.

### Two charts above the board

- Implied value against TVL, both on log scales: one dot per row
  (indigo watchlist, amber early radar) with the TVL-only base
  (implied = TVL^0.85 x 0.9) as a dashed line. A dot above the line
  was lifted by a good week or a long record; a dot below it was held
  back. Both charts are drawn from data.js at render time, so they
  always show the board that was scored.
- The week's moves across the board, as a histogram in nine bins:
  4 / 40 / 35 / 61 / 33 / 9 / 7 / 1 / 6 rows from under -25% to over
  +50%. The caption states the fact the chart shows: 140 of 198 rows
  had a negative week, which is why the growth term is damped.

### A wording slip fixed

The weekly-yield farm step read "the weekly yield" in board.json and
"the week's yield" in the page. Both now read "the week's yield", so
the board and the page agree word for word. (Found by diffing the two
derivations while rewriting them; the strings are otherwise identical.)

### Mobile and UX

- The charts stack to one column under 900px and scale by viewBox, so
  they stay legible on a phone.
- The lede heading drops to 24px under 900px (it was 30px at every
  width and crowded the first screen).
- The drivers column adds width to the table; the table already
  scrolls horizontally inside its panel, so nothing overflows.

## Validation (radar-4, rebuilt 2026-11-19)

- Board: 198 rows, watchlist 40/40, implied strictly non-increasing,
  farm steps 3-12 per row, 20-600 characters each (observed 124-210),
  no violations. Top 5 unchanged from radar-3.
- Dossier 1,473,939 bytes (cap 1,572,864); dashboard source 55,881
  bytes (text cap 65,536); screenshots 325,045 / 411,735 / 325,398
  bytes (each under the 512 KiB cap), 1440x1440, retaken from the
  rebuilt dashboard with headed Firefox under Xvfb.
- Browser verification (retake-shots-r4.js, 11 checks, all passed):
  198 rows rendered, 198 scatter dots, 9 histogram bars, 198 driver
  cells, rank-1 drivers text "G -1.7% · M -30.9%", detail driver line
  "Base $95.1M -1.7% from the week -30.9% from age = $64.1M implied",
  the page's six farm steps byte-identical to board.json for the
  opened row, 34 rows under the Risk Curators filter, zero page errors.
  One fix found by viewing the shots: the histogram's bin labels ran
  together ("-25 to -10 to -5 ..."), so they now read "-25–-10" and
  the shots were retaken.
- Kit check: the parent runs it from this session's bundle.
