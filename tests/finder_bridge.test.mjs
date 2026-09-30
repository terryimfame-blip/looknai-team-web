import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('public copies use only the frozen three-field contract and render every valid copy', () => {
  assert.match(source, /copyRef: copy\.copyRef, driveDisplayName: copy\.driveDisplayName, relativeDisplayPath: copy\.relativeDisplayPath/);
  assert.match(source, /validCopies\.map\(copy =>/);
  assert.match(source, /text\(copy\.driveDisplayName\)/);
  assert.match(source, /text\(copy\.relativeDisplayPath\)/);
  assert.match(source, /ตำแหน่งที่บันทึกไว้/);
});

test('Finder scheme accepts only UUID ClipID and opaque public CopyRef, and never includes a path', () => {
  assert.match(source, /CLIP_ID_PATTERN = \//);
  assert.match(source, /COPY_REF_PATTERN = \/\^CP-\[0-9a-f\]\{32\}\$/);
  assert.match(source, /if \(!isValidClipId\(clipId\) \|\| !isValidCopyRef\(copyRef\)\) return ''/);
  assert.match(source, /looknai:\/\/open\?v=1&clip=\$\{encodeURIComponent\(clipId\)\}&copy=\$\{encodeURIComponent\(copyRef\)\}/);
  assert.doesNotMatch(source.slice(source.indexOf('export function finderUrl'), source.indexOf('function isMac')), /relativeDisplayPath|driveDisplayName|path=/);
  assert.match(source, /text\(url\)/);
});

test('missing or invalid copy metadata shows the published-location fallback without a local API', () => {
  assert.match(source, /if \(!validCopies\.length\) return '<p class="note-text">ยังไม่มีข้อมูลตำแหน่งสำเนาที่เผยแพร่/);
  assert.doesNotMatch(source, /127\.0\.0\.1|localhost|\/api\/team\//);
});

test('non-Mac users retain copy details and see the Mac Helper explanation', () => {
  assert.match(source, /ใช้ได้บน Mac ที่ติดตั้ง LookNai Helper/);
  assert.match(source, /HELPER_DOWNLOAD_URL = 'https:\/\/github\.com\/terryimfame-blip\/looknai-team-web\/releases\/download\/v0\.1\.0\/LookNai-Helper-v0\.1\.0\.zip'/);
  assert.match(source, /ลากแอปไปที่ Applications/);
  assert.match(styles, /\.copy-card/);
  assert.match(styles, /\.finder-button/);
  assert.match(styles, /\.helper-install/);
});

test('existing catalog controls and bounded pagination remain in place', () => {
  assert.match(source, /id="query"/);
  assert.match(source, /id="project"/);
  assert.match(source, /id="lot"/);
  assert.match(source, /PAGE_SIZE = 24/);
  assert.match(source, /visiblePage\(matches, state\.demoPage, PAGE_SIZE\)/);
  assert.match(source, /collection\(db, 'public_clips'\)/);
});
