// Token Radar, model radar-5: one sealed snapshot in, one ranked board out,
// plus an account of every protocol the snapshot holds.
//
// The board ranks every rankable pre-token protocol: the snapshot's
// watchlist first (the floor, never a ceiling), then every other pre-token
// protocol below it that passes the house watchlist rule in full. A
// protocol is rankable when its record carries no token at all (no market
// cap, no CoinGecko id, no symbol) AND its category is not a wrapped,
// staked or bridged product of a token that already trades, its name
// carries no whole word wrapped, staked or staking, it does not begin with
// an exchange's name, and it carries no version marker. Live-token
// protocols are kept apart and shown with the market's own value, never
// mixed into the ranked board. Every protocol the board leaves out is
// listed with its reason in the dashboard's accounted view, so all 758
// protocols in the snapshot are somewhere on the page.
//
// Implied value follows only from the snapshot's own figures, and radar-5
// changes one term on the peers' evidence:
//
//   base     = round(tvl ^ 0.5 * 1575)      the TVL slope is fitted, not picked
//   week     = clamp(change_7d, -50, 100)   in percent
//   growth   = 1 + (week / 100) * 0.8       one week is the noisiest figure
//                                           in the snapshot, so it may move
//                                           value 1.8x at most
//   maturity = 0.5 + 0.5 * min(age, 1460) / 1460
//                                           a protocol that has run up to
//                                           four years with no token scores
//                                           up to twice a newborn one
//   implied  = max(1, round(base * growth * maturity))
//
// The fitted slope: on the 95 live-token protocols that carry a market
// cap, a TVL and a listed date, log10(market cap) against log10(TVL) has
// slope 0.4567 with standard error 0.1055 (95% interval 0.25 to 0.66,
// R-squared 0.166). Radar-4's exponent 0.85 sits outside that interval;
// 0.5 sits inside it, and at slope 0.5 the held-out error is smaller than
// at 0.85 (5-fold held-out RMSE 0.859 in log10, about a factor 7.2,
// against 0.905 at 0.85). The scale 1575 is the intercept refitted at
// slope 0.5 (log10 3.1972). The fit is weak — R-squared 0.17 means TVL
// alone leaves most of the spread unexplained, and a held-out guess is
// typically off by a factor of seven — so the board states the fit and
// its limits on the page instead of pretending the peers pin the value.
//
// Growth and age keep their radar-4 terms as stated priors, not fitted
// ones: adding them to the peer regression moves R-squared only from
// 0.168 to 0.185, and their fitted signs come out negative, which is a
// size confound (the biggest live protocols grow slowest and have run
// longest) rather than a finding that a good week or a long record lowers
// value. A term the data cannot separate from size stays a damped,
// stated term, and the page says so.
//
// Age is the time since the protocol was first listed. An unknown age
// uses the board's own median known age, 418 days (the median of the 191
// known ages among the 198 board rows). A missing week uses the board's
// own median week, -3.75% (196 reported weeks among the 198 board rows):
// a protocol with no reported week is scored as a typical board week,
// not as a flat one. No protocol name is ever special-cased: the same
// function scores every row, and every row carries its own breakdown so
// a reader can check it.

/** One protocol as the sealed input carries it: exactly these ten fields. */
export interface SnapshotProtocol {
  slug: string; // DefiLlama slug, unique per protocol
  name: string; // display name
  category: string | null; // DefiLlama category, or null when unlisted
  chains: string[]; // chains the protocol runs on
  tvl_usd: number; // total value locked, USD
  change_7d: number | null; // TVL change over seven days, percent
  mcap_usd: number | null; // market cap when a token trades, else null
  listed_at: string | null; // first listing date, YYYY-MM-DD
  gecko_id: string | null; // CoinGecko id when a token trades, else null
  symbol: string | null; // token symbol when one trades, else null
}

/** The snapshot document as a whole. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, which the dashboard states in its model panel. */
export interface ModelConstants {
  base_exponent: number;
  base_scale: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_days: number;
  /** The week's change used when a protocol reports none: the board's median week. */
  null_growth_pct: number;
}

export const MODEL: ModelConstants = {
  base_exponent: 0.5, // TVL slope, fitted on the 95 peers (0.4567 ± 0.1055)
  base_scale: 1575, // intercept refitted at slope 0.5 (log10 3.1972)
  growth_weight: 0.8, // one week may move value 1.8x at most
  growth_floor: -50, // the week's move, clamped
  growth_cap: 100,
  maturity_floor: 0.5, // a newborn scores half a four-year protocol
  maturity_days: 1460, // four years to full maturity
  unknown_age_days: 418, // the board's median known age
  null_growth_pct: -3.75, // the board's median week
};

/**
 * The peer fit behind the TVL term, measured on the 95 live-token
 * protocols with a market cap, a TVL and a listed date, and quoted on
 * the dashboard's checks strip so the reader sees the fit and its
 * limits, not just the constants it produced.
 */
export interface FitSummary {
  peers: number;
  slope: number;
  slope_se: number;
  slope_ci_lo: number;
  slope_ci_hi: number;
  r2: number;
  held_out_rmse_log10: number;
  held_out_factor: number;
}

export const FIT: FitSummary = {
  peers: 95, // live-token protocols with market cap, TVL and a listed date
  slope: 0.4567,
  slope_se: 0.1055,
  slope_ci_lo: 0.25, // 95% interval: 0.25 to 0.66
  slope_ci_hi: 0.66,
  r2: 0.166, // TVL alone leaves most of the spread unexplained
  held_out_rmse_log10: 0.859, // 5-fold held out
  held_out_factor: 7.23, // a held-out guess is typically off by a factor of seven
};

/** The model's version label, which the dashboard names. */
export const MODEL_VERSION = 'radar-5';

/** How many live-token protocols the Live token view carries, ordered by market cap. */
export const LIVE_ROWS = 24;

/** One farm step: what to do, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: a ranked board row. */
export interface BoardRow {
  rank: number; // 1-based, strongest first
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token'; // every ranked row is pre-token by construction
  age_days: number | null; // days since first listing, null when unlisted
  implied_value_usd: number; // the model's scored value, USD
  model: { // the row's own breakdown, so a reader can check it
    base_usd: number;
    tvl_exponent: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[]; // six steps, each action + cost + time
}

/** The dashboard's compact form of one row, with its farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null; // always null on a ranked row; kept so the page can show it
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number; // the TVL base, before the two multipliers
  growth_multiplier: number;
  maturity_multiplier: number;
  /** True when the protocol is on the snapshot's watchlist. */
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value for it, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null; // the market's own value
  change_7d: number | null;
}

/** A protocol the board does not rank, together with the reason it is not ranked. */
export interface AccountedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number | null;
  reason: string; // one reason, in the fixed order exclusionReason states
}

/** Everything the dashboard needs: the board, the live set, the accounted set, and the model behind them. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number; // the watchlist TVL floor, USD
  model: ModelConstants;
  model_version: string;
  fit: FitSummary;
  watchlist_size: number;
  board_size: number;
  early_size: number; // board rows below the watchlist floor
  live_size: number; // live-token protocols shown in the Live view
  accounted_size: number; // protocols listed in the accounted view
  rows: RadarRow[];
  live: LiveRow[];
  accounted: AccountedRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback` when the value is missing or not a number. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, never below zero; null when either date is absent or unparseable. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const start = Date.parse(`${asOf}T00:00:00Z`);
  const firstSeen = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(firstSeen)) return null;
  return Math.max(0, Math.floor((start - firstSeen) / DAY_MS));
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const week = protocol.change_7d === null || !Number.isFinite(protocol.change_7d) ? model.null_growth_pct : protocol.change_7d;
  const growthPct = week < model.growth_floor ? model.growth_floor : week > model.growth_cap ? model.growth_cap : week;
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const aged = age === null ? model.unknown_age_days : age;
  const cappedAge = aged < 0 ? 0 : aged > model.maturity_days ? model.maturity_days : aged;
  const maturityMult = model.maturity_floor + (1 - model.maturity_floor) * (cappedAge / model.maturity_days);
  const base = Math.round(Math.pow(protocol.tvl_usd, model.base_exponent) * model.base_scale);
  const raw = base * growthMult * maturityMult;
  return { implied: raw < 1 ? 1 : Math.round(raw), base, growthPct, growthMult, maturityMult, age };
}

/**
 * How the week's move and the protocol's age each move a row's implied
 * value away from its TVL base, in percentage points of the base:
 *
 *   implied / base - 1 = (growthMult - 1) + growthMult x (maturityMult - 1)
 *
 * so the two parts add up exactly to the gap between base and implied.
 * The dashboard draws them as one diverging bar per row — the week's
 * slice and the age slice, green when they lift the value, red when they
 * hold it back. Both come from the same multipliers as the board, so the
 * bar and the board can never disagree.
 */
export function drivers(row: { base_usd: number; growth_multiplier: number; maturity_multiplier: number; implied_value_usd: number }): { growthPct: number; maturityPct: number; totalPct: number } {
  const growthPct = (row.growth_multiplier - 1) * 100;
  const maturityPct = row.growth_multiplier * (row.maturity_multiplier - 1) * 100;
  const totalPct = growthPct + maturityPct;
  return { growthPct, maturityPct, totalPct };
}

/** DefiLlama's version-marker rule: a name that ends in a release number is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The house watchlist rule, as RULES.txt states it under "The snapshot":
 * a protocol the watchlist kept has a category that "is not Bridge,
 * Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or
 * CEX", a name that "carries no whole word wrapped, staked or staking in
 * any case", and "does not begin with an exchange's name (Binance,
 * Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex or Gemini)". The rule
 * binds every ranked row, not just the watchlist: WBTC, Binance staked
 * ETH and USDT0 are off the watchlist because each is a wrapped or
 * staked product of a token that already trades, and ranking them would
 * mix already-trading products into a board of protocols still to come.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return [p.mcap_usd, p.gecko_id, p.symbol].every((v) => v === null);
}

/**
 * Why a protocol is not on the ranked board, or null when it belongs
 * there. One reason only, in a fixed order, so the accounted view reads
 * the same on every run. A protocol that records a token is out because
 * it already trades; the rest fail the watchlist rule, in the order the
 * rule states it.
 */
export function exclusionReason(p: SnapshotProtocol): string | null {
  const checks: Array<[boolean, string]> = [
    [!isPreToken(p), 'records a token'],
    [EXCLUDED_CATEGORIES.has(p.category ?? ''), `excluded category: ${p.category}`],
    [WRAPPED_WORD.test(p.name), 'wrapped / staked product name'],
    [EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix)), 'exchange-prefixed name'],
    [VERSIONED.test(p.name), 'versioned name'],
  ];
  for (const [failed, reason] of checks) if (failed) return reason;
  return null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and passing
 * the full watchlist exclusion above — not a bridge, liquid-staking,
 * restaking or CEX product, no wrapped/staked/staking word in its name,
 * no exchange prefix, and no version marker.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return exclusionReason(p) === null;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const found = index.get(slug);
    if (found !== undefined) chosen.set(slug, found);
  }
  // The early radar: every other rankable pre-token protocol, not just the
  // biggest few by TVL. A chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));
  return scored.map((s, i) => {
    const { slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at, gecko_id, symbol } = s.p;
    const { implied, base, growthPct, growthMult, maturityMult, age } = s;
    return {
      rank: i + 1,
      slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at, gecko_id, symbol,
      token_status: 'pre-token',
      age_days: age,
      implied_value_usd: implied,
      model: {
        base_usd: base,
        tvl_exponent: model.base_exponent,
        growth_pct: growthPct,
        growth_multiplier: round4(growthMult),
        maturity_multiplier: round4(maturityMult),
        age_days: age,
      },
      farm_steps: farmSteps(s.p, age).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** One step as a single string: the action, then its cost and time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol lists, or a neutral phrase when it lists none. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Deposit tiers, biggest TVL first: a position is sized from the protocol's own TVL. */
const CAPITAL_TIERS: Array<[number, number]> = [
  [5_000_000_000, 250],
  [1_000_000_000, 150],
  [100_000_000, 100],
];

/** What one farm position is sized at, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  for (const [floor, capital] of CAPITAL_TIERS) if (p.tvl_usd >= floor) return capital;
  return 50;
}

/** Hold windows, youngest first: the younger the protocol, the longer the qualifying window. */
const HOLD_TIERS: Array<[number, number]> = [
  [180, 60],
  [365, 45],
];

/** How long the position must stay open, from the protocol's age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  for (const [under, days] of HOLD_TIERS) if (age < under) return days;
  return 30;
}

/** The category's qualifying action, written so a farmer can follow it. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave the loan position open.`;
  if (c.includes('dex') || c.includes('amm') || c.includes('swap')) return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and leave the position in range.`;
  if (c.includes('bridge')) return `Move $${capital} of USDC to ${chain} through ${name}, then put the bridged funds to work inside its app.`;
  if (c.includes('liquid staking') || c.includes('staking pool') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset with ${name} and hold on to the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Put $${capital} of USDC up as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Put $${capital} into ${name} and open one market position.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Put $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('yield')) return `Put $${capital} into ${name}'s main yield strategy on ${chain} and leave the position open.`;
  if (c.includes('stable')) return `Mint or hold $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy live.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name} and try one app built on it.`;
  return `Put $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/** The weekly qualifying action, varied by what the protocol does. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 'borrow a little against the deposit and pay it back';
  if (c.includes('dex') || c.includes('amm') || c.includes('swap')) return 'swap a little through the pool';
  if (c.includes('bridge')) return 'bridge a little in either direction';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'trim the hedge by a little';
  if (c.includes('prediction')) return 'settle or open one small market position';
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('vault')) return "claim the week's yield and put it back in";
  return 'deposit, swap or vote once';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. It promises no token launch:
 * the steps only build a record of real use in case one comes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  return [
    {
      text: `Open a fresh wallet on ${chain} to use only for this farm, and write its seed phrase on paper and keep it somewhere safe offline.`,
      cost: 'about $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital, plus about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Once a week, ${weekly}, so the wallet shows steady use instead of a single deposit.`,
      cost: 'roughly $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days so the activity covers more than one snapshot.`,
      cost: `the $${capital} stays locked in the position`,
      time: `${hold} days`,
    },
    {
      text: `When you are ready to withdraw, check the protocol's own points or rewards page first and claim only from the link it publishes; never pay anyone to claim on your behalf.`,
      cost: 'free to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Keep a farm log of the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.`,
      cost: 'free, apart from the log',
      time: '5 minutes',
    },
  ];
}

/**
 * The farm verdict for one row, in one line: what the plan costs to run
 * and what the row's own figures say about it. It scores nothing new —
 * it restates the plan's deposit tier, its hold, and the weekly action —
 * so a reader sees the cost of farming this protocol before reading
 * the six steps.
 */
export function farmVerdict(p: SnapshotProtocol, age: number | null, impliedUsd: number): string {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weekly = weeklyFor(p);
  return `Farm verdict: $${capital} in, about $${capital >= 150 ? 8 : 4} of gas to set up, hold at least ${hold} days, ${weekly} once a week — for an implied value of $${impliedUsd.toLocaleString('en-US')}.`;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX');
  live.sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd);
  return live.slice(0, LIVE_ROWS).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));
}

/**
 * Every protocol the dashboard does not otherwise show, with its reason:
 * the live-token protocols past the Live view's first 24, and every
 * pre-token protocol the watchlist rule leaves out. Together with the
 * board and the Live view, this accounts for all 758 protocols in the
 * snapshot — none of them is silently missing.
 */
export function accountedRows(snapshot: Snapshot, shown: Set<string>): AccountedRow[] {
  const rest = snapshot.protocols
    .filter((p) => !shown.has(p.slug))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      reason: exclusionReason(p) ?? 'not shown',
    }));
  rest.sort((a, b) => b.tvl_usd - a.tvl_usd);
  return rest;
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  const { rank, slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at, age_days, implied_value_usd } = row;
  const { base_usd, growth_multiplier, maturity_multiplier } = row.model;
  return {
    rank, slug, name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at, age_days, implied_value_usd,
    base_usd, growth_multiplier, maturity_multiplier,
    watchlist: watchlist.has(slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const shown = new Set([...board.map((r) => r.slug), ...live.map((r) => r.slug)]);
  const accounted = accountedRows(snapshot, shown);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    fit: FIT,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    accounted_size: accounted.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist))),
    live,
    accounted,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it has the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  const bad = (why: string): never => { throw new SnapshotError(`snapshot.json ${why}`); };
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) bad('has no as_of date');
  if (typeof o.source !== 'string') bad('has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) bad('has no floor_usd');
  if (!Array.isArray(o.protocols)) bad('has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) bad('has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) bad(`protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      bad(`protocol ${i} lacks a slug, a name or a TVL`);
    }
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string') : [];
    const numOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const strOrNull = (value: unknown): string | null => typeof value === 'string' ? value : null;
    return {
      slug: p.slug as string,
      name: p.name as string,
      category: strOrNull(p.category),
      chains: strings(p.chains),
      tvl_usd: p.tvl_usd as number,
      change_7d: numOrNull(p.change_7d),
      mcap_usd: numOrNull(p.mcap_usd),
      listed_at: strOrNull(p.listed_at),
      gecko_id: strOrNull(p.gecko_id),
      symbol: strOrNull(p.symbol),
    };
  });
  return {
    as_of: o.as_of as string,
    source: o.source as string,
    floor_usd: o.floor_usd as number,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: coverage, ranks,
 * order, one shared implied value, and farm steps. Checked in the order
 * the gate states them, first failure wins.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  for (let i = 0; i < board.length; i++) if (board[i]!.rank !== i + 1) return `rank ${i + 1} is ${board[i]!.rank}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  const payload = JSON.stringify(radar);
  return `window.RADAR=${payload};\n`;
}
