import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_ACCESS, verifyTeamPin } from '../src/team-access.js';

test('the convenience PIN is checked through an isolated derived verifier', async () => {
  assert.equal(await verifyTeamPin('0000'), true);
  assert.equal(await verifyTeamPin('9999'), false);
  assert.match(TEAM_ACCESS.verifier, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(readFileSync(new URL('../src/team-access.js', import.meta.url), 'utf8'), /password\s*=\s*["']0000/i);
});

test('the catalog starts only after session access is present', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /if \(hasTeamAccess\(\)\) startTeamWeb\(\); else renderGate\(\);/);
  assert.match(source, /await initializeCatalog\(\);/);
  assert.match(source, /import\('firebase\/firestore'\)/);
});
