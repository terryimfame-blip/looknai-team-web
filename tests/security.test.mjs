import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../src/safety.js';

test('untrusted catalog text remains visible text, not HTML', () => {
  const input = `<img src=x onerror="alert('x')"> & งานไทย`;
  assert.equal(escapeHtml(input), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; งานไทย');
  assert.equal(escapeHtml(null), '');
});

test('Team Web reads only public Firebase data without auth, writes, or localhost API', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /collection\(db, 'public_clips'\)/);
  assert.doesNotMatch(source, /published_clips|\/api\/team\/|127\.0\.0\.1|localhost/);
  assert.match(source, /from 'firebase\/firestore'/);
  assert.doesNotMatch(source, /firebase\/storage|getStorage|getBlob/);
  assert.doesNotMatch(source, /signInWithPopup|GoogleAuthProvider|onAuthStateChanged|signOut/);
  assert.doesNotMatch(source, /\b(?:setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\b/);
  assert.doesNotMatch(source, /firebase-admin|service-account|LOOKNAI_FIREBASE_PROJECT|sqlite/i);
});
