import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visiblePage, filterPublicRecords, filenameSearchKey, approvedThumbnailUrl } from '../src/catalog-utils.js';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('media catalog keeps the initial page small and debounces search', () => {
  assert.match(source, /PAGE_SIZE = 24/);
  assert.match(source, /SEARCH_DEBOUNCE_MS = 300/);
  assert.match(source, /requestGeneration/);
  assert.match(source, /collection\(db, 'public_clips'\)/);
  assert.match(source, /where\('published', '==', true\)/);
});

test('Spark release shows media placeholders without Firebase Storage calls', () => {
  assert.match(source, /media-placeholder/);
  assert.match(source, /fileType\(record\.filename\)/);
  assert.doesNotMatch(source, /firebase\/storage|getStorage|getBlob|resolveThumbnail/);
  assert.doesNotMatch(source, /<video|base64/);
});

test('fixture and responsive preview card UI are present', () => {
  assert.match(source, /createFixture\(count = 1000\)/);
  assert.match(source, /data-open/);
  assert.match(source, /data-tab="copies"/);
  assert.match(styles, /grid-template-columns:repeat\(4/);
  assert.match(styles, /@media\(max-width:700px\)/);
});

test('demo pagination and production pages stay bounded to 24 cards', () => {
  assert.match(source, /demoPage/);
  assert.match(source, /visiblePage\(matches, state\.demoPage, PAGE_SIZE\)/);
  assert.match(source, /matches\.slice\(0, \(state\.currentPage \+ 1\) \* PAGE_SIZE\)/);
  assert.match(source, /if \(demoMode\) \{ renderDemo\(nextPage\); return; \}/);
});

test('fixture behavior: initial page is 24 and YEP_0884 narrows to one card', () => {
  const fixture = Array.from({ length: 1000 }, (_, index) => ({ filename: `YEP_${String(index + 1).padStart(4, '0')}.MP4`, knownCopies: index % 3 + 1 }));
  assert.equal(fixture.length, 1000);
  assert.equal(visiblePage(fixture, 0).length, 24);
  const results = fixture.filter(record => filenameSearchKey(record.filename).startsWith(filenameSearchKey('YEP_0884')));
  assert.equal(results.length, 1);
  assert.equal(fixture[1].knownCopies, 2);
});

test('search normalization strips punctuation consistently', () => {
  assert.equal(filenameSearchKey('YEP-0884.MP4'), 'yep0884mp4');
  assert.match(readFileSync(new URL('../src/catalog-utils.js', import.meta.url), 'utf8'), /normalize\('NFKC'\)/);
  assert.match(source, /filterPublicRecords\(state\.allRecords/);
});

test('public search, project, and lot filters use only published records', () => {
  const rows = [
    { published: true, filename: 'YEP!_8842.MP4', project: 'Derma', lot: 'L01' },
    { published: true, filename: 'YEP!_8843.MP4', project: 'Derma', lot: 'L02' },
    { published: false, filename: 'YEP!_8842.MP4', project: 'Derma', lot: 'L01' },
    { published: true, filename: 'YEP!_8842.MP4', project: 'Fayda', lot: 'L01' },
  ];
  assert.equal(filterPublicRecords(rows, { search: 'YEP 8842', project: 'Derma', lot: 'L01' }).length, 1);
  assert.equal(filterPublicRecords(rows, { project: 'Derma' }).length, 2);
  assert.equal(filterPublicRecords(rows).length, 3);
});

test('published-only preview requires exact ClipID and version; local-only and broken refs stay placeholders', () => {
  const id = '01234567-89ab-4cde-8123-456789abcdef';
  const ref = { id, published: true, thumbnailVersion: '0123456789abcdef',
    thumbnailPath: `thumbnails/${id}/v0123456789abcdef.webp` };
  assert.equal(approvedThumbnailUrl(ref), ref.thumbnailPath);
  assert.equal(approvedThumbnailUrl({ ...ref, published: false }), '');
  assert.equal(approvedThumbnailUrl({ ...ref, thumbnailPath: '' }), '');
  assert.equal(approvedThumbnailUrl({ ...ref, thumbnailPath: 'thumbnails/other/v0123456789abcdef.webp' }), '');
  assert.equal(approvedThumbnailUrl({ ...ref, id: 'not-a-clip-id' }), '');
});
