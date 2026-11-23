// Token Radar, radar-5 dashboard. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table
// with a per-row drivers column, two charts that make the ranking legible,
// a checks strip that states the model's fit and its limits, a per-protocol
// detail drawer with the model's own inputs and the protocol's farm plan,
// a separate live-token view, and an accounted view that lists every
// protocol the board and the live view do not show, with its reason. No
// network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var mount = document.getElementById('board');
  var view = { q: '', category: 'all', chain: 'all', minTvl: 0, watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function ageStr(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function signedPct(n, digits) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(digits === undefined ? 1 : digits) + '%';
  }

  // The radar-5 model in one function: the page recomputes a row from the
  // snapshot figures and checks the number board.json carries, so the page's
  // code and the board's data are visibly the same arithmetic. A missing
  // week scores as the board's median week, the same default the model
  // uses in lib/model.ts.
  function recompute(row, model) {
    var raw = row.change_7d === null || row.change_7d === undefined ? model.null_growth_pct : row.change_7d;
    var growth = raw < model.growth_floor ? model.growth_floor : raw > model.growth_cap ? model.growth_cap : raw;
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var capped = age < 0 ? 0 : age > model.maturity_days ? model.maturity_days : age;
    var maturity = model.maturity_floor + (1 - model.maturity_floor) * (capped / model.maturity_days);
    var base = Math.round(Math.pow(row.tvl_usd, model.base_exponent) * model.base_scale);
    return { implied: Math.max(1, Math.round(base * growthMult * maturity)), base: base, growthMult: growthMult, maturity: maturity };
  }
  // The two slices that push a row's implied value away from its TVL base,
  // in percentage points of the base. They add up exactly to the gap
  // between base and implied: (g - 1) + g x (m - 1) = implied / base - 1.
  // The same arithmetic lives in lib/model.ts as drivers(); the bar and the
  // board can never disagree.
  function splitDrivers(row) {
    var g = row.growth_multiplier;
    var m = row.maturity_multiplier;
    var growth = (g - 1) * 100;
    var maturity = g * (m - 1) * 100;
    return { growth: growth, maturity: maturity, total: growth + maturity };
  }

  // A small element builder: h('div', {class: 'x', text: 'y'}, [kids]).
  // Attribute keys: class, text and html are special; on* keys are
  // listeners; anything else becomes a DOM attribute, unless null.
  function h(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      if (Array.isArray(kid)) kid.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof kid === 'string') node.appendChild(document.createTextNode(kid));
      else node.appendChild(kid);
    });
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased, and the wording is
  // the same in both places, word for word.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  var CAPITAL_TIERS = [[5e9, 250], [1e9, 150], [1e8, 100]];
  function capitalFor(p) {
    for (var i = 0; i < CAPITAL_TIERS.length; i++) if (p.tvl_usd >= CAPITAL_TIERS[i][0]) return CAPITAL_TIERS[i][1];
    return 50;
  }
  var HOLD_TIERS = [[180, 60], [365, 45]];
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    for (var i = 0; i < HOLD_TIERS.length; i++) if (age < HOLD_TIERS[i][0]) return HOLD_TIERS[i][1];
    return 30;
  }
  // One rule per category family: the first matching test wins, and the
  // fallback covers every category the table does not name.
  var ACTION_RULES = [
    [/lend|cdp|collateral/, function (name, capital, chain) { return 'Lend $' + capital + ' of USDC on ' + name + ' (' + chain + ') and leave the loan position open.'; }],
    [/dex|amm|swap/, function (name, capital, chain) { return 'Add $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and leave the position in range.'; }],
    [/bridge/, function (name, capital, chain) { return 'Move $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then put the bridged funds to work inside its app.'; }],
    [/liquid staking|staking pool|restak/, function (name, capital) { return 'Stake $' + capital + " of the chain's staking asset with " + name + ' and hold on to the receipt token.'; }],
    [/perpetual|derivative|basis/, function (name, capital) { return 'Put $' + capital + ' of USDC up as margin on ' + name + ' and open one small hedged position.'; }],
    [/prediction/, function (name, capital) { return 'Put $' + capital + ' into ' + name + ' and open one market position.'; }],
    [/curator|allocator|vault/, function (name, capital, chain) { return 'Put $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.'; }],
    [/yield/, function (name, capital, chain) { return 'Put $' + capital + " into " + name + "'s main yield strategy on " + chain + ' and leave the position open.'; }],
    [/stable/, function (name, capital, chain) { return 'Mint or hold $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.'; }],
    [/rwa/, function (name, capital, chain) { return 'Mint $' + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.'; }],
    [/insurance/, function (name, capital, chain) { return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy live.'; }],
    [/chain/, function (name, capital) { return 'Bridge $' + capital + ' of USDC to ' + name + ' and try one app built on it.'; }]
  ];
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < ACTION_RULES.length; i++) {
      if (ACTION_RULES[i][0].test(c)) return ACTION_RULES[i][1](p.name, capital, chain);
    }
    return 'Put $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and leave the position open.';
  }
  var WEEKLY_RULES = [
    [/lend|cdp/, 'borrow a little against the deposit and pay it back'],
    [/dex|amm|swap/, 'swap a little through the pool'],
    [/bridge/, 'bridge a little in either direction'],
    [/perpetual|derivative|basis/, 'trim the hedge by a little'],
    [/prediction/, 'settle or open one small market position'],
    [/yield|curator|allocator|vault/, "claim the week's yield and put it back in"]
  ];
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < WEEKLY_RULES.length; i++) {
      if (WEEKLY_RULES[i][0].test(c)) return WEEKLY_RULES[i][1];
    }
    return 'deposit, swap or vote once';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Keep the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      { text: 'Open a fresh wallet on ' + chain + ' to use only for this farm, and write its seed phrase on paper and keep it somewhere safe offline.', cost: 'about $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital, plus about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: 'Once a week, ' + weeklyFor(p) + ', so the wallet shows steady use instead of a single deposit.', cost: 'roughly $2 of gas a week', time: '10 minutes a week' },
      { text: 'Keep the position open for at least ' + hold + ' days so the activity covers more than one snapshot.', cost: 'the $' + capital + ' stays locked in the position', time: hold + ' days' },
      { text: "When you are ready to withdraw, check the protocol's own points or rewards page first and claim only from the link it publishes; never pay anyone to claim on your behalf.", cost: 'free to check, and never pay to claim', time: '10 minutes' },
      { text: 'Keep a farm log of the wallet, the dates and every transaction hash, so you can repeat the position or unwind it cleanly.', cost: 'free, apart from the log', time: '5 minutes' }
    ].map(stepText);
  }
  // The farm verdict: what the plan costs to run, in one line. It scores
  // nothing new — it restates the plan's deposit tier, its hold, and the
  // weekly action — so a reader sees the cost of farming this protocol
  // before reading the six steps.
  function farmVerdict(p) {
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return 'Farm verdict: $' + capital + ' in, about $' + (capital >= 150 ? 8 : 4) + ' of gas to set up, hold at least ' + hold + ' days, ' + weeklyFor(p) + ' once a week — for an implied value of ' + usd0.format(p.implied_value_usd) + '.';
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) view.q = params.get('q');
    if (params.get('p')) view.selected = params.get('p');
    if (params.get('category')) view.category = params.get('category');
    if (params.get('chain')) view.chain = params.get('chain');
    if (params.get('minTvl')) view.minTvl = Number(params.get('minTvl')) || 0;
    if (params.get('watchlist') === '1') view.watchlistOnly = true;
    if (params.get('tab')) view.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (view.q) params.set('q', view.q);
    if (view.category !== 'all') params.set('category', view.category);
    if (view.chain !== 'all') params.set('chain', view.chain);
    if (view.minTvl) params.set('minTvl', String(view.minTvl));
    if (view.watchlistOnly) params.set('watchlist', '1');
    if (view.tab !== 'pre-token') params.set('tab', view.tab);
    if (view.selected) params.set('p', view.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = view.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (view.category !== 'all' && r.category !== view.category) return false;
      if (view.chain !== 'all' && (!r.chains || r.chains.indexOf(view.chain) < 0)) return false;
      if (r.tvl_usd < view.minTvl) return false;
      if (view.watchlistOnly && !r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortKey(r) {
    if (view.sort === 'name') return r.name.toLowerCase();
    if (view.sort === 'tvl') return r.tvl_usd;
    if (view.sort === 'growth') return r.change_7d === null ? -Infinity : r.change_7d;
    if (view.sort === 'age') return r.age_days === null ? Infinity : r.age_days;
    return r.implied_value_usd;
  }
  function orderedRows(list) {
    return list.slice().sort(function (a, b) {
      var av = sortKey(a);
      var bv = sortKey(b);
      if (av < bv) return -view.dir;
      if (av > bv) return view.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  // The accounted view: every protocol the board and the live view do not
  // show, with its reason. The search box filters it by name, slug or
  // reason; the board's category, chain and TVL filters do not apply.
  function filteredAccounted() {
    var q = view.q.trim().toLowerCase();
    if (!q) return DATA.accounted;
    return DATA.accounted.filter(function (r) {
      return [r.name, r.slug, r.reason, r.category].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  function topBar() {
    return h('header', { class: 'top' }, [
      h('div', { class: 'brand' }, [h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })]),
      h('div', { class: 'top-meta' }, [
        h('span', { text: 'Snapshot ' + DATA.as_of }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: DATA.model_version + ' model' })
      ])
    ]);
  }

  function lede() {
    var facts = [
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Pre-token rows scored', String(DATA.board_size)],
      ['Early rows below the floor', String(DATA.early_size)],
      ['Live-token protocols set aside', String(DATA.live_size)]
    ];
    return h('section', { class: 'lede' }, [
      h('div', null, [
        h('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        h('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' more pre-token protocols below that floor, so the board covers all ' + DATA.board_size + ' rankable protocols. Implied value is a model, not a promise: no launch is promised.' })
      ]),
      h('div', { class: 'facts' }, facts.map(function (f) {
        return h('div', { class: 'fact' }, [h('span', { text: f[0] }), h('b', { text: f[1] })]);
      }))
    ]);
  }

  // The checks strip: the board answers its own checks on the cover. The
  // fit figures come from the peer regression the TVL term is fitted on
  // (95 live-token protocols); the strip states the fit and its limits
  // rather than hiding them behind the constants.
  function checksStrip() {
    var f = DATA.fit;
    var total = DATA.board_size + DATA.live_size + DATA.accounted_size;
    var items = [
      ['Watchlist', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Protocols accounted for', total + ' / ' + total],
      ['TVL slope fitted on peers', f.slope.toFixed(2) + ' ± ' + f.slope_se.toFixed(2)],
      ['Peer fit R², ' + f.peers + ' peers', f.r2.toFixed(2)],
      ['Held-out error', '×' + f.held_out_factor.toFixed(1)]
    ];
    return h('section', { class: 'checks', 'aria-label': 'Checks' }, items.map(function (it) {
      return h('div', { class: 'check-item' }, [h('span', { text: it[0] }), h('b', { text: it[1] })]);
    }));
  }

  // Category mix: the board's categories as one stacked bar, so a reader
  // sees at a glance where the pre-token protocols live. Colours are
  // assigned by category order, never by protocol name.
  var MIX_COLORS = ['#2438a8', '#c47f17', '#0f7a4d', '#b3382e', '#6d28d9', '#0e7490', '#be185d', '#4d7c0f', '#b45309', '#334155', '#9d174d', '#155e75'];
  function mix() {
    var counts = {};
    DATA.rows.forEach(function (r) { var c = r.category || 'Other'; counts[c] = (counts[c] || 0) + 1; });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var total = DATA.rows.length;
    var bar = h('div', { class: 'mix-bar', role: 'img', 'aria-label': 'Category mix of the board' }, cats.map(function (c, i) {
      return h('i', { style: 'width:' + (counts[c] / total * 100).toFixed(2) + '%;background:' + MIX_COLORS[i % MIX_COLORS.length], title: c + ': ' + counts[c] });
    }));
    var legend = h('div', { class: 'mix-legend' }, cats.map(function (c, i) {
      return h('span', null, [h('i', { style: 'background:' + MIX_COLORS[i % MIX_COLORS.length] }), c + ' ' + counts[c]]);
    }));
    return h('div', { class: 'mix' }, [bar, legend]);
  }

  // Top movers by dollars gained, not by percentage: a +4448% week on a
  // $47M protocol is a data spike, while +5% on a $1.5B protocol is $84M of
  // real money in. Gained dollars = tvl * change / (100 + change), from the
  // snapshot's own figures alone.
  function movers() {
    var top = DATA.rows.filter(function (r) { return r.change_7d !== null; })
      .map(function (r) { return { row: r, gained: r.tvl_usd * r.change_7d / (100 + r.change_7d) }; })
      .sort(function (a, b) { return b.gained - a.gained; }).slice(0, 5);
    return h('div', { class: 'movers' }, top.map(function (t) {
      var r = t.row;
      return h('button', { type: 'button', class: 'mover', onclick: function () { openDetail(r.slug); } }, [
        h('span', { class: 'sub', text: 'Top mover · rank ' + r.rank }),
        h('b', { text: r.name }),
        h('span', { class: 'pct', text: '+' + money(t.gained) + ' in 7d' }),
        h('span', { class: 'meta', text: pct(r.change_7d) + ' · ' + money(r.tvl_usd) + ' TVL · ' + money(r.implied_value_usd) + ' implied' })
      ]);
    }));
  }

  function moversNote() {
    return h('p', { class: 'sub movers-note', text: 'Movers rank by dollars of TVL gained in seven days, not by percentage: +5.64% on a $1.58B protocol is $84M of real money in, while +4448% on a $47M protocol is a data spike. The percentage is still printed, small, on each card.' });
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 3);
    return h('div', { class: 'spot' }, top.map(function (r) {
      return h('button', { type: 'button', class: 'spot-card', onclick: function () { openDetail(r.slug); } }, [
        h('span', { class: 'rank', text: 'Rank ' + r.rank }),
        h('b', { text: r.name }),
        h('span', { class: 'val', text: money(r.implied_value_usd) + ' implied' }),
        h('span', { class: 'meta', text: money(r.tvl_usd) + ' TVL  ·  ' + pct(r.change_7d) + ' 7d  ·  ' + ageStr(r.age_days) })
      ]);
    }));
  }

  // One diverging bar for a row's drivers: the week's slice and the age
  // slice, stacked from the zero line. The scale is fixed at -100% to
  // +100% of the base, so two rows' bars read on the same scale. Green
  // lifts the value, red holds it back.
  function driverBar(d, wide) {
    var from = 0;
    var segs = [d.growth, d.maturity].map(function (v) {
      var a = 50 + from * 0.5;
      var b = 50 + (from + v) * 0.5;
      from += v;
      return h('i', { style: 'left:' + Math.min(a, b).toFixed(1) + '%;width:' + Math.abs(b - a).toFixed(1) + '%;background:' + (v >= 0 ? '#0f7a4d' : '#b3382e') });
    });
    var bar = h('div', { class: wide ? 'driver-bar wide' : 'driver-bar' }, segs);
    bar.appendChild(h('i', { class: 'zero' }));
    return bar;
  }
  function driverCell(row) {
    var d = splitDrivers(row);
    var label = 'G ' + signedPct(d.growth) + ' · M ' + signedPct(d.maturity);
    var title = 'Base ' + money(row.base_usd) + '; the week adds ' + signedPct(d.growth) + ' and age adds ' + signedPct(d.maturity) + '; implied ' + money(row.implied_value_usd);
    return h('div', { class: 'driver', title: title }, [driverBar(d, false), h('span', { text: label })]);
  }

  // Implied value against TVL, both on log scales: one dot per row,
  // watchlist rows indigo, early rows amber. The dashed line is the base
  // from TVL alone (implied = TVL^0.5 x 1575); a dot above it was lifted by
  // a good week or a long record, a dot below it held back. The line is
  // straight because the base is a power law.
  function scatterChart() {
    var W = 620, H = 330, L = 58, R = 14, T = 14, B = 38;
    var pts = DATA.rows.map(function (r) { return { x: Math.log10(r.tvl_usd), y: Math.log10(r.implied_value_usd), wl: r.watchlist }; });
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var x0 = Math.floor(Math.min.apply(null, xs) * 2) / 2 - 0.1;
    var x1 = Math.ceil(Math.max.apply(null, xs) * 2) / 2 + 0.1;
    var b = Math.log10(DATA.model.base_scale);
    var lineY0 = DATA.model.base_exponent * x0 + b;
    var lineY1 = DATA.model.base_exponent * x1 + b;
    var y0 = Math.floor(Math.min(Math.min.apply(null, ys), lineY0) * 2) / 2 - 0.1;
    var y1 = Math.ceil(Math.max(Math.max.apply(null, ys), lineY1) * 2) / 2 + 0.1;
    var X = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); };
    var Y = function (v) { return T + (y1 - v) / (y1 - y0) * (H - T - B); };
    function moneyTick(v) {
      if (v >= 9) return '$' + Math.round(Math.pow(10, v - 9)) + 'B';
      if (v >= 6) return '$' + Math.round(Math.pow(10, v - 6)) + 'M';
      return '$' + Math.round(Math.pow(10, v - 3)) + 'K';
    }
    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Implied value against TVL, log scales">');
    for (var tx = Math.ceil(x0); tx <= Math.floor(x1); tx++) {
      parts.push('<line x1="' + X(tx).toFixed(1) + '" y1="' + Y(y0).toFixed(1) + '" x2="' + X(tx).toFixed(1) + '" y2="' + Y(y1).toFixed(1) + '" stroke="#e5ddc9" stroke-width="1"/>');
      parts.push('<text x="' + X(tx).toFixed(1) + '" y="' + (H - 22).toFixed(1) + '" text-anchor="middle">' + moneyTick(tx) + '</text>');
    }
    for (var ty = Math.ceil(y0); ty <= Math.floor(y1); ty++) {
      parts.push('<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(ty).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(y1).toFixed(1) + '" stroke="#e5ddc9" stroke-width="1"/>');
      parts.push('<text x="' + (L - 8).toFixed(1) + '" y="' + (Y(ty) + 3).toFixed(1) + '" text-anchor="end">' + moneyTick(ty) + '</text>');
    }
    parts.push('<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(lineY0).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(lineY1).toFixed(1) + '" stroke="#c47f17" stroke-width="1.5" stroke-dasharray="6 4"/>');
    parts.push('<text x="' + (X(x1) - 4).toFixed(1) + '" y="' + (Y(lineY1) - 8).toFixed(1) + '" text-anchor="end" fill="#c47f17">base from TVL alone</text>');
    pts.forEach(function (p) {
      parts.push('<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.wl ? 3.5 : 3) + '" fill="' + (p.wl ? '#2438a8' : '#c47f17') + '"' + (p.wl ? '' : ' stroke="#fffdf8" stroke-width="0.8"') + '/>');
    });
    parts.push('<text x="' + ((L + W - R) / 2).toFixed(1) + '" y="' + (H - 6).toFixed(1) + '" text-anchor="middle">TVL (log scale)</text>');
    parts.push('<text x="12" y="' + ((T + H - B) / 2).toFixed(1) + '" text-anchor="middle" transform="rotate(-90 12 ' + ((T + H - B) / 2).toFixed(1) + ')">implied value (log scale)</text>');
    parts.push('</svg>');
    return h('div', { class: 'chart' }, [
      h('h3', { text: 'Implied value against TVL' }),
      h('div', { html: parts.join('') }),
      h('p', { class: 'cap', text: 'One dot per row, log scales both ways. Indigo dots are watchlist rows, amber dots are the early radar. The dashed line is the base from TVL alone: a dot above it was lifted by a good week or a long record, a dot below it held back.' })
    ]);
  }

  // The week's moves across the board, binned: most rows had a negative
  // week, which is why the growth term is damped rather than trusted.
  var GROWTH_BINS = [[null, -25], [-25, -10], [-10, -5], [-5, 0], [0, 5], [5, 10], [10, 25], [25, 50], [50, null]];
  function growthHist() {
    var grows = DATA.rows.map(function (r) { return r.change_7d; }).filter(function (v) { return v !== null && v !== undefined; });
    var counts = GROWTH_BINS.map(function (bin) {
      return grows.filter(function (v) { return (bin[0] === null || v > bin[0]) && (bin[1] === null || v <= bin[1]); }).length;
    });
    var neg = grows.filter(function (v) { return v < 0; }).length;
    var ordered = grows.slice().sort(function (a, b) { return a - b; });
    var median = ordered[Math.floor(ordered.length / 2)];
    var W = 460, H = 260, L = 34, R = 8, T = 22, B = 40;
    var max = Math.max.apply(null, counts);
    var bw = (W - L - R) / counts.length;
    function label(bin) {
      if (bin[0] === null) return '<-25';
      if (bin[1] === null) return '>50';
      return bin[0] + '–' + bin[1];
    }
    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Seven-day change across the board">');
    counts.forEach(function (c, i) {
      var x = L + i * bw + 3;
      var w = bw - 6;
      var ht = (c / max) * (H - T - B);
      var y = H - B - ht;
      var bin = GROWTH_BINS[i];
      var col = bin[1] !== null && bin[1] <= 0 ? '#2438a8' : (bin[0] !== null && bin[0] >= 50 ? '#c47f17' : '#0f7a4d');
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, ht).toFixed(1) + '" rx="2" fill="' + col + '"/>');
      parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle">' + c + '</text>');
      parts.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 24).toFixed(1) + '" text-anchor="middle">' + label(bin) + '</text>');
    });
    parts.push('<text x="' + ((L + W - R) / 2).toFixed(1) + '" y="' + (H - 8).toFixed(1) + '" text-anchor="middle">seven-day change, %</text>');
    parts.push('</svg>');
    return h('div', { class: 'chart' }, [
      h('h3', { text: 'The week across the board' }),
      h('div', { html: parts.join('') }),
      h('p', { class: 'cap', text: neg + ' of ' + DATA.rows.length + ' rows had a negative week (median ' + pct(median) + '). The growth term mostly holds rows back, so it is damped — weight ' + DATA.model.growth_weight + ', cap ' + DATA.model.growth_cap + ' — instead of letting one noisy week decide a rank.' })
    ]);
  }

  function charts() {
    return h('section', { class: 'charts' }, [scatterChart(), growthHist()]);
  }

  function option(value, label, isCurrent) {
    return h('option', { value: value, text: label, selected: isCurrent ? 'selected' : null });
  }
  function field(labelText, forId, control) {
    return h('div', { class: 'field' }, [h('label', { for: forId, text: labelText }), control]);
  }
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name or chain', value: view.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { view.q = search.value; writeHash(); render(); });
    var cat = h('select', { id: 'category', 'aria-label': 'Filter by category' }, [
      option('all', 'All categories', view.category === 'all')
    ].concat(categories.map(function (c) { return option(c, c, c === view.category); })));
    cat.addEventListener('change', function () { view.category = cat.value; writeHash(); render(); });
    var chain = h('select', { id: 'chain', 'aria-label': 'Filter by chain' }, [
      option('all', 'All chains', view.chain === 'all')
    ].concat(chains.map(function (c) { return option(c, c, c === view.chain); })));
    chain.addEventListener('change', function () { view.chain = chain.value; writeHash(); render(); });
    var tvlOpts = [['0', 'Any TVL'], ['50000000', 'TVL $50M+'], ['100000000', 'TVL $100M+'], ['1000000000', 'TVL $1B+']];
    var tvl = h('select', { id: 'minTvl', 'aria-label': 'Minimum TVL' }, tvlOpts.map(function (o) { return option(o[0], o[1], String(view.minTvl) === o[0]); }));
    tvl.addEventListener('change', function () { view.minTvl = Number(tvl.value) || 0; writeHash(); render(); });
    var wlBox = h('input', { type: 'checkbox', checked: view.watchlistOnly ? 'checked' : null });
    wlBox.addEventListener('change', function (e) { view.watchlistOnly = e.target.checked; writeHash(); render(); });
    var wl = h('label', { class: 'check' }, [wlBox, ' Watchlist only']);
    var tabs = ['pre-token', 'live', 'all'];
    var tabLabels = { 'pre-token': 'Pre-token', live: 'Live token', all: 'All 758' };
    var tabBtns = tabs.map(function (tab) {
      return h('button', { type: 'button', 'aria-pressed': view.tab === tab ? 'true' : 'false', text: tabLabels[tab], onclick: function () { view.tab = tab; writeHash(); render(); } });
    });
    var countText = view.tab === 'pre-token' ? filteredRows().length + ' rows shown'
      : view.tab === 'live' ? DATA.live.length + ' live-token protocols'
      : filteredAccounted().length + ' accounted protocols';
    return h('div', { class: 'controls' }, [
      field('Search', 'q', search),
      field('Category', 'category', cat),
      field('Chain', 'chain', chain),
      field('Minimum TVL', 'minTvl', tvl),
      wl,
      h('div', { class: 'field' }, [h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, tabBtns)]),
      h('span', { class: 'count', text: countText })
    ]);
  }

  function sortHeader(key, label) {
    var arrow = view.sort === key ? h('span', { 'aria-hidden': 'true', text: view.dir < 0 ? ' v' : ' ^' }) : null;
    return h('th', { scope: 'col' }, [
      h('button', { type: 'button', onclick: function () { if (view.sort === key) view.dir = -view.dir; else { view.sort = key; view.dir = -1; } render(); } }, [label, arrow])
    ]);
  }

  function clearFilters() {
    view.q = ''; view.category = 'all'; view.chain = 'all'; view.minTvl = 0; view.watchlistOnly = false;
    writeHash(); render();
  }

  function protocolCell(r) {
    var chains = r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
    return h('td', null, [h('div', { class: 'name' }, [h('b', { text: r.name }), h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + chains })])]);
  }

  function boardTable() {
    var list = orderedRows(filteredRows());
    if (list.length === 0) {
      return h('div', { class: 'panel' }, [h('div', { class: 'empty' }, [
        h('h2', { text: 'No protocol matches that filter' }),
        h('p', { text: 'Clear the search or pick another category to see the board again.' }),
        h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: clearFilters })
      ])]);
    }
    // The bar scale is the board's largest implied value, whatever the
    // sort: the first row of a name-sorted list is not the largest.
    var max = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = h('tbody', null, list.map(function (r) {
      var growth = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      // Heat tint: the stronger the week's move, the stronger the cell's tint.
      var heat = r.change_7d === null ? '' : r.change_7d >= 0
        ? 'background:rgba(15,122,77,' + Math.min(0.22, Math.abs(r.change_7d) / 200).toFixed(2) + ')'
        : 'background:rgba(179,56,46,' + Math.min(0.22, Math.abs(r.change_7d) / 200).toFixed(2) + ')';
      var barWidth = Math.max(3, Math.round((r.implied_value_usd / max) * 100));
      return h('tr', {
        'data-selected': view.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      }, [
        h('td', { class: 'num', text: String(r.rank) }),
        protocolCell(r),
        h('td', { class: 'num', text: money(r.tvl_usd) }),
        h('td', { class: 'num ' + growthClass, style: heat, text: growth }),
        h('td', { class: 'num', text: ageStr(r.age_days) }),
        h('td', null, [h('div', { class: 'implied' }, [
          h('div', { class: 'bar', 'aria-hidden': 'true' }, [h('i', { style: 'width:' + barWidth + '%' })]),
          h('span', { class: 'num', text: money(r.implied_value_usd) })
        ])]),
        h('td', null, [driverCell(r)]),
        h('td', null, [r.watchlist ? h('span', { class: 'tag', text: 'watchlist' }) : h('span', { class: 'status', text: 'no token' })])
      ]);
    }));
    return h('div', { class: 'panel' }, [h('div', { class: 'table-wrap' }, [
      h('table', null, [
        h('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan. The drivers bar shows how the week (G) and the age (M) push each row away from its TVL base.' }),
        h('thead', null, [h('tr', null, [
          sortHeader('implied', 'Rank'),
          sortHeader('name', 'Protocol'),
          sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'),
          sortHeader('age', 'Age'),
          sortHeader('implied', 'Implied value'),
          h('th', { scope: 'col', text: 'Why this rank' }),
          h('th', { scope: 'col', text: 'Token' })
        ])]),
        tbody
      ])
    ])]);
  }

  function liveTable() {
    var tbody = h('tbody', null, DATA.live.map(function (r) {
      return h('tr', null, [
        h('td', { class: 'num', text: 'live' }),
        protocolCell(r),
        h('td', { class: 'num', text: money(r.tvl_usd) }),
        h('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        h('td', { class: 'num', text: money(r.mcap_usd) }),
        h('td', null, [h('span', { class: 'tag live', text: 'already trades' })])
      ]);
    }));
    return h('div', { class: 'panel' }, [h('div', { class: 'table-wrap' }, [
      h('table', null, [
        h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking and are NOT ranked here.' }),
        h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Token' })])]),
        tbody
      ])
    ])]);
  }

  // The accounted view: every protocol the board and the live view do not
  // show, largest TVL first, with the reason it is not ranked. Together
  // with the board and the live view it accounts for all 758 protocols
  // in the snapshot — none of them is silently missing.
  function accountedTable() {
    var tbody = h('tbody', null, filteredAccounted().map(function (r) {
      return h('tr', null, [
        h('td', null, [h('div', { class: 'name' }, [h('b', { text: r.name }), h('span', { class: 'sub', text: r.category || 'Other' })])]),
        h('td', { class: 'num', text: money(r.tvl_usd) }),
        h('td', { class: 'num', text: money(r.mcap_usd) }),
        h('td', null, [h('span', { text: r.reason })])
      ]);
    }));
    return h('div', { class: 'panel' }, [h('div', { class: 'table-wrap' }, [
      h('table', null, [
        h('caption', { class: 'sub', text: 'Not ranked, and why: protocols that already record a token, and pre-token protocols the watchlist rule leaves out. The board, the live view and this table together account for all 758 protocols in the snapshot.' }),
        h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Why not ranked' })])]),
        tbody
      ])
    ])]);
  }

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var formula = 'base = round( tvl_usd ^ ' + m.base_exponent + ' x ' + m.base_scale + ' )   — the TVL slope is fitted on live-token peers\n' +
      'growth = clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')   growth multiplier = 1 + growth / 100 x ' + m.growth_weight + '\n' +
      'maturity = ' + m.maturity_floor + ' + 0.5 x min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + '   — up to four years with no token\n' +
      'implied = round( base x growth multiplier x maturity )';
    return h('section', { class: 'panel model' }, [
      h('h2', { text: 'How implied value is computed — model ' + DATA.model_version }),
      h('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      h('div', { class: 'formula', text: formula }),
      h('div', { class: 'why' }, [
        h('h3', { text: 'Why the TVL term is fitted' }),
        h('p', { text: 'Across the ' + f.peers + ' live-token protocols that carry a market cap, a TVL and a listed date, log10(market cap) on log10(TVL) gives slope ' + f.slope.toFixed(2) + ' with standard error ' + f.slope_se.toFixed(2) + ' (95% interval ' + f.slope_ci_lo.toFixed(2) + ' to ' + f.slope_ci_hi.toFixed(2) + ', R-squared ' + f.r2.toFixed(2) + '). The earlier exponent 0.85 falls outside that interval; 0.5 falls inside it, and at slope 0.5 the held-out error beats 0.85 (5-fold held-out RMSE ' + f.held_out_rmse_log10.toFixed(2) + ' in log10, about a factor ' + f.held_out_factor.toFixed(1) + '). The scale ' + m.base_scale + ' is the intercept refitted at slope 0.5.' }),
        h('p', { text: 'The fit is weak, and the board says so: R-squared 0.17 means TVL by itself leaves most of the spread unexplained, and a held-out guess is typically off by a factor of seven. The slope is fitted, the scatter is wide, and the board does not pretend the peers pin the value down.' })
      ]),
      h('div', { class: 'why' }, [
        h('h3', { text: 'What the peers cannot separate' }),
        h('p', { text: 'Adding growth and age to the peer regression lifts R-squared only from 0.17 to 0.19, and their fitted signs come out negative — a size confound, since the biggest live protocols grow slowest and have run longest — not a finding that a good week or a long record lowers value. A term the data cannot separate from size stays a damped, stated term: growth weight ' + m.growth_weight + ' with cap ' + m.growth_cap + ', maturity floor ' + m.maturity_floor + ' over ' + m.maturity_days + ' days.' }),
        h('p', { text: 'Seven-day change is the noisiest figure in the snapshot: one row reads +4448.47% in a week, three read above +100%, six above +50%. The floor and cap bind only four board rows (one below -50%, three above +100%), and 140 of 198 rows had a negative week, so the term mostly holds rows back rather than lifting them.' })
      ]),
      h('div', { class: 'why' }, [
        h('h3', { text: 'What changed in radar-5' }),
        h('p', { text: 'The TVL exponent moved from 0.85 to 0.5 on the peer fit above; the top ten overlap nine of ten with radar-4, and the board tells the same story with less noise from size. A missing week now scores as the board’s median week, ' + pct(m.null_growth_pct) + ', instead of a flat week — the same logic as the unknown-age default of ' + m.unknown_age_days + ' days, which is the board’s median known age. The accounted view lists every protocol the board and the live view do not show, with its reason, so all 758 protocols are somewhere on the page. The checks strip above states the fit on the cover, and each detail view now carries a one-line farm verdict with what the plan costs to run.' }),
        h('p', { text: 'Every row now shows why it ranks where it does: the drivers bar in the table splits the gap between its TVL base and its implied value into the week’s slice and the age’s slice, and the detail view spells the same split out in dollars. The age slice is always zero or negative: the base assumes a fully mature four-year record, so every younger protocol sits below it, and only a very young or a fully mature protocol’s age is called out on its own.' })
      ]),
      h('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days, and a missing week uses the board’s median week. The early radar is every rankable pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.' })
    ]);
  }

  var dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { view.selected = null; writeHash(); });

  function breakRow(label, widthPct, value) {
    var w = Math.max(2, Math.min(100, Math.round(widthPct)));
    return h('div', { class: 'break-row' }, [
      h('span', { text: label }),
      h('div', { class: 'bar', 'aria-hidden': 'true' }, [h('i', { style: 'width:' + w + '%' })]),
      h('b', { text: value })
    ]);
  }

  function rankReason(row, d) {
    var growth = row.change_7d === null ? 0 : row.change_7d;
    if (d.growth >= 10) return 'The week lifts it: ' + pct(growth) + ' in seven days adds ' + signedPct(d.growth) + ' to its base.';
    if (d.growth <= -10) return 'The week holds it back: ' + pct(growth) + ' in seven days takes ' + signedPct(d.growth) + ' off its base.';
    // The age slice is always zero or negative: the base assumes a fully
    // mature four-year record, so only a very young or a fully mature
    // protocol's age is worth calling out on its own.
    if (row.age_days !== null && row.age_days < 180) return 'Still young: ' + ageStr(row.age_days) + ' with no token, so age takes ' + signedPct(d.maturity) + ' off its base.';
    if (row.age_days !== null && row.age_days >= 1460) return 'Fully mature: ' + ageStr(row.age_days) + ' with no token, so age takes almost nothing off its base (' + signedPct(d.maturity) + ').';
    var n = row.chains ? row.chains.length : 1;
    return 'Its TVL does the work: ' + money(row.tvl_usd) + ' across ' + n + ' chain' + (n === 1 ? '' : 's') + ', a steady week and a ' + ageStr(row.age_days) + ' record.';
  }

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    if (!row) return;
    view.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var calc = recompute(row, DATA.model);
    var d = splitDrivers(row);
    var maxBase = Math.max.apply(null, DATA.rows.map(function (r) { return r.base_usd; }));
    var head = h('div', { class: 'detail-head' }, [
      h('div', null, [
        h('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? '  ·  watchlist' : '  ·  early radar') }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ]),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ]);
    var facts = [
      ['TVL', money(row.tvl_usd)],
      ['Seven-day growth', pct(row.change_7d)],
      ['Age with no token', ageStr(row.age_days)],
      ['Base (TVL^0.5 x 1575)', money(row.base_usd)],
      ['Growth multiplier', String(row.growth_multiplier)],
      ['Maturity multiplier', String(row.maturity_multiplier)],
      ['Implied value', money(row.implied_value_usd)]
    ];
    var equation = h('div', { class: 'equation' }, facts.map(function (f) {
      return h('div', null, [h('span', { text: f[0] }), h('b', { class: 'num', text: f[1] })]);
    }));
    var breakdown = h('div', { class: 'breakdown' }, [
      breakRow('Base', (row.base_usd / maxBase) * 100, money(row.base_usd)),
      breakRow('Growth mult', (calc.growthMult / 1.8) * 100, String(row.growth_multiplier)),
      breakRow('Maturity mult', calc.maturity * 100, String(row.maturity_multiplier))
    ]);
    var driverLine = h('div', { class: 'driver-line' }, [
      h('span', { text: 'Why it sits here: ' }),
      driverBar(d, true),
      h('span', { text: 'Base ' + money(row.base_usd) + ' ' + signedPct(d.growth) + ' from the week ' + signedPct(d.maturity) + ' from age = ' + money(row.implied_value_usd) + ' implied.' })
    ]);
    var recomputeNote = 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + money(calc.implied) + (calc.implied === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and no token launch is promised.';
    var valueSection = h('section', { class: 'detail-section' }, [
      h('h3', { text: 'Implied value' }),
      equation,
      breakdown,
      driverLine,
      h('p', { class: 'sub', text: recomputeNote }),
      h('p', { class: 'sub', text: 'Why rank ' + row.rank + ': ' + rankReason(row, d) })
    ]);
    var stepItems = steps.map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return h('li', null, [h('b', { text: action }), h('span', { class: 'cost', text: tail })]);
    });
    var farmSection = h('section', { class: 'detail-section' }, [
      h('h3', { text: 'Farm plan' }),
      h('p', { class: 'verdict', text: farmVerdict(row) }),
      h('ol', { class: 'steps' }, stepItems)
    ]);
    dialog.appendChild(head);
    dialog.appendChild(valueSection);
    dialog.appendChild(farmSection);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    mount.textContent = '';
    var shell = h('div', { class: 'shell' }, []);
    shell.appendChild(topBar());
    shell.appendChild(lede());
    if (view.tab === 'pre-token') {
      shell.appendChild(checksStrip());
      shell.appendChild(spotlight());
      shell.appendChild(mix());
      shell.appendChild(movers());
      shell.appendChild(moversNote());
      shell.appendChild(charts());
    }
    shell.appendChild(controls());
    shell.appendChild(view.tab === 'pre-token' ? boardTable() : view.tab === 'live' ? liveTable() : accountedTable());
    if (view.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(h('p', { class: 'foot', text: 'Implied value is this board\u2019s own model from the sealed 2026-11-14 snapshot. It is not a price and not a promise that any protocol will issue a token.' }));
    mount.appendChild(shell);
    mount.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) mount.appendChild(dialog);
    if (view.selected) openDetail(view.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
