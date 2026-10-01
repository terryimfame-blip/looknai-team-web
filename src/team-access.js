// Change only this verifier when rotating the convenience team PIN. It is not
// authentication: a four-digit client-side PIN can be brute-forced.
export const TEAM_ACCESS = Object.freeze({
  salt: 'YEP_TEAM_PIN_V1',
  verifier: '3012c66a25d96ad28c85df46e0f4e813c334f10160b8e40a5a094c9e6a8b45f0',
  sessionKey: 'yep-team-access-v1',
});

function hex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyTeamPin(pin) {
  if (typeof pin !== 'string' || !globalThis.crypto?.subtle) return false;
  const message = new TextEncoder().encode(`${TEAM_ACCESS.salt}:${pin}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', message);
  return hex(new Uint8Array(digest)) === TEAM_ACCESS.verifier;
}

export function hasTeamAccess(storage = globalThis.sessionStorage) {
  return storage?.getItem(TEAM_ACCESS.sessionKey) === 'granted';
}

export function grantTeamAccess(storage = globalThis.sessionStorage) {
  storage?.setItem(TEAM_ACCESS.sessionKey, 'granted');
}
