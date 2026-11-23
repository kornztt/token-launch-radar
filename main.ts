// Token Radar, model radar-5 (Node 22, standard library only).
//
// main.ts reads the sealed snapshot, scores it with lib/model.ts, and
// writes everything the dashboard and the gate need into the output
// directory: board.json, data.js, the dashboard files, the screenshots,
// and dossier.json (written last, from the finished /output).
//
//   node main.ts --input <snapshot.json|directory> [--output <dir>]
//
// With no --output, the output directory is $MAKEFUN_OUTPUT_DIR, or
// /output when that is unset. In the grader's container the snapshot
// lives at /input/snapshot.json and the output at /output; locally,
// point --input at the kit's input/snapshot.json and set
// MAKEFUN_OUTPUT_DIR to a scratch directory.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's caps for the dossier: the text cap shapes it, the rest refuse. */
const TEXT_CAP_BYTES = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read `--name value` or `--name=value` from argv, else `fallback`. */
function flag(name: string, fallback: string): string {
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]!;
    if (a === `--${name}` && i + 1 < process.argv.length) return process.argv[i + 1]!;
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return fallback;
}

const inputPath = flag('input', '/input');
const snapshotPath = inputPath.endsWith('.json') ? inputPath : join(inputPath, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  process.stderr.write(`token radar: cannot find a snapshot at ${snapshotPath} — pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) {
  process.stderr.write(`token radar: refusing to write a board the gate rejects: ${problem}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy a directory's plain files into `dest`, skipping dot-names, and return what was copied. */
function copyDir(src: string, dest: string): string[] {
  if (!existsSync(src)) return [];
  mkdirSync(dest, { recursive: true });
  const done: string[] = [];
  for (const name of readdirSync(src)) {
    if (name.startsWith('.')) continue;
    const from = join(src, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(dest, name));
    done.push(name);
  }
  return done;
}

copyDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'} — hand in 3: the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name} — a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// Dossier last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, { text_max_bytes: TEXT_CAP_BYTES, screenshots: SHOT_CAP, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols in, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside, ${radar.accounted_size} accounted for)\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')}, ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
