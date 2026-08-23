#!/usr/bin/env node
/**
 * Produce a PRODUCTION bundle of the fork and deploy it to Home Assistant.
 *
 * Replicates what upstream's release workflow does before building:
 *   consts.ts        Dev = true      -> Dev = false     (drops the -test element postfix)
 *   rollup.config    var dev = true  -> var dev = false (minifies, outputs to ./release)
 *
 * Both edits are reverted afterwards, unconditionally, so the working tree is never left
 * in release state — a half-reverted tree would silently poison the next dev build.
 *
 * The output registers as `hue-like-light-card`, exactly like the HACS-installed stock
 * card, so the two must never be loaded together. The stock Lovelace resource has to be
 * removed for this one to take over; that swap is what makes the change reversible.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = '/Users/alexpfau/Documents/Tech/GitHub/lovelace-hue-like-light-card';
const OUT = path.join(REPO, 'release', 'hue-like-light-card.js');
const DEST_DIR = '/Volumes/config/www/community/hue-like-light-card-alexpfau';
const DEST = path.join(DEST_DIR, 'hue-like-light-card.js');

const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 12);

let flipped = false;
try {
  console.log('→ switching to release mode…');
  sh(`sed -i '' "s/ Dev = true;/ Dev = false;/g" src/types/consts.ts`);
  sh(`sed -i '' "s/var dev = true;/var dev = false;/g" rollup.config.mjs`);
  flipped = true;

  // prove the flip landed, rather than trusting sed silently matching nothing
  const consts = readFileSync(path.join(REPO, 'src/types/consts.ts'), 'utf8');
  if (!/Dev = false;/.test(consts)) throw new Error('Dev flag was not flipped in consts.ts');

  console.log('→ building release…');
  sh('npx rollup -c');
  if (!existsSync(OUT)) throw new Error(`no release output at ${OUT}`);

  const built = readFileSync(OUT, 'utf8');
  if (built.includes("'-test'") && /ElementPostfix = '-test'/.test(built)) {
    throw new Error('release bundle still carries the -test postfix');
  }
  console.log(`  release ${sha(OUT)} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);

  if (!existsSync('/Volumes/config')) throw new Error('/Volumes/config is not mounted');
  mkdirSync(DEST_DIR, { recursive: true });
  copyFileSync(OUT, DEST);
  if (sha(DEST) !== sha(OUT)) throw new Error('copy did not land on the share');
  console.log(`✓ deployed -> ${DEST}`);
}
finally {
  if (flipped) {
    sh('git checkout -- src/types/consts.ts rollup.config.mjs');
    const back = readFileSync(path.join(REPO, 'src/types/consts.ts'), 'utf8');
    console.log(
      /Dev = true;/.test(back)
        ? '↩ reverted to dev mode'
        : '✗ WARNING: working tree not restored to dev mode — check consts.ts',
    );
  }
}
