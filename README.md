# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/kornztt/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/kornztt/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar, model radar-4: 198 pre-token protocols ranked by implied value from the sealed 2026-11-14 DefiLlama snapshot, with a farm plan for each. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Revision (radar-4)

- Unknown age now uses the board's own median known age, 418 days, instead of an arbitrary 365. Seven rows carry no listed date; their implied values rise about 3%, 17 rows shift rank by at most four places (Plasma One 85 → 81), top ten unchanged.
- Every row now shows why it ranks where it does: a drivers bar in the table splits the gap between its TVL base and its implied value into the week's slice and the age's slice, and the detail view spells the same split out in dollars.
- Two charts above the board: implied value against TVL on log scales (with the TVL-only base as a dashed line), and the week's moves across the board as a histogram (140 of 198 rows had a negative week).
- Fixed: the weekly-yield farm step read differently in the board and in the page; both now read "the week's yield".
- Mobile: charts stack to one column under 900px and the lede heading drops to 24px.
- Growth term unchanged (weight 0.8, cap 100): the floor and cap bind only four board rows, so no further damping is justified.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

Entered on [make.fun](https://make.fun/?ref=werh0je7&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
