import './styles.css';
import { escapeHtml } from './safety.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, documentId, limit, startAfter } from 'firebase/firestore';
import { filenameSearchKey, visiblePage, filterPublicRecords, projectOptions, lotOptions, selectProject } from './catalog-utils.js';

export const PAGE_SIZE = 24;
export const SEARCH_DEBOUNCE_MS = 300;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const configured = Object.values(firebaseConfig).every(value => value && !value.startsWith('replace-with-'));
const firebaseApp = configured ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const app = document.querySelector('#app');
const demoMode = import.meta.env.VITE_LOOKNAI_DEMO === '1';
const state = { records: [], allRecords: null, currentPage: 0, filterOptions: null, project: '', lot: '', query: '', offset: 0, hasMore: false, loading: false, requestGeneration: 0, demoPage: 0, searchTimer: null };
const text = escapeHtml;
const pick = (record, ...keys) => keys.map(key => record[key]).find(item => item !== undefined && item !== null && item !== '');
function formatDate(raw) { if (!raw) return 'ไม่ระบุวันที่'; const date = new Date(raw); return Number.isNaN(date.getTime()) ? 'ไม่ระบุวันที่' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(date); }
function fileType(filename = '') { const ext = filename.split('.').pop().toLowerCase(); if (['mp4','mov','mxf','avi','mkv','webm'].includes(ext)) return ['video', 'วิดีโอ']; if (['wav','mp3','m4a','aac','aif'].includes(ext)) return ['audio', 'เสียง']; if (['jpg','jpeg','png','webp','heic'].includes(ext)) return ['image', 'ภาพ']; if (['prproj','aep','fcpxml'].includes(ext)) return ['project', 'โปรเจกต์']; return ['file', 'ไฟล์']; }
const CLIP_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COPY_REF_PATTERN = /^CP-[0-9a-f]{32}$/;
const HELPER_DOWNLOAD_URL = 'https://github.com/terryimfame-blip/looknai-team-web/releases/download/v0.1.0/LookNai-Helper-v0.1.0.zip';
export function isValidClipId(value) { return typeof value === 'string' && CLIP_ID_PATTERN.test(value); }
export function isValidCopyRef(value) { return typeof value === 'string' && COPY_REF_PATTERN.test(value); }
export function finderUrl(clipId, copyRef) { if (!isValidClipId(clipId) || !isValidCopyRef(copyRef)) return ''; return `looknai://open?v=1&clip=${encodeURIComponent(clipId)}&copy=${encodeURIComponent(copyRef)}`; }
function isMac() { return /Macintosh|MacIntel|MacPPC|Mac68K|Mac OS X/.test(`${navigator.userAgent || ''} ${navigator.platform || ''}`); }
function normalizeRecord(data) { const copies = Array.isArray(data.copies) ? data.copies.filter(copy => copy && typeof copy === 'object').map(copy => ({ copyRef: copy.copyRef, driveDisplayName: copy.driveDisplayName, relativeDisplayPath: copy.relativeDisplayPath })) : []; const id = data.clip_id || data.id; const filename = pick(data, 'display_filename', 'file_name', 'filename') || id; return { id, project: data.project || 'ไม่ระบุ Project', lot: data.lot || 'ไม่ระบุ Lot', shootDate: pick(data, 'shoot_date', 'shootDate'), filename, copies, locations: copies.map(copy => ({ drive_label: copy.driveDisplayName, relative_path: copy.relativeDisplayPath })), knownCopies: Number((data.knownCopyCount ?? data.known_copies ?? data.copy_count ?? copies.length) || 0), thumbnailPath: data.thumbnail_path, thumbnailVersion: data.thumbnail_version, published: data.published === true, notes: data.notes || '' }; }
function renderShell() { app.innerHTML = `<header class="topbar"><a class="brand" href="#top" aria-label="LookNai Team home"><span class="brand-mark">L</span><span>LookNai <em>Team</em></span></a><div class="account" id="account"></div></header><main id="top"><section class="hero"><div><p class="eyebrow">Media library</p><h1>Find the footage.<br><span>Know every copy.</span></h1><p class="lead">ค้นหา Footage และดูว่าไฟล์อยู่ Drive ไหน</p></div><div class="hero-mark">LOOK<br>NAI</div></section><section class="toolbar" aria-label="Catalog filters"><label>ค้นหา Footage<input id="query" type="search" placeholder="ค้นหาชื่อไฟล์..." autocomplete="off"></label><label>Project<select id="project"><option value="">ทุก Project</option></select></label><label>Lot<select id="lot"><option value="">ทุก Lot</option></select></label></section><div class="catalog-meta"><span id="meta">กำลังโหลด Catalog...</span><span class="read-only">READ ONLY</span></div><section id="catalog" class="catalog" aria-live="polite"></section><div class="load-more-wrap"><button id="loadMore" class="button quiet" hidden>โหลดเพิ่ม</button></div></main><div id="drawer" class="drawer-backdrop" hidden></div><footer>LookNai Team · Curated catalog only · Source media remains on its original drives</footer>`; document.querySelector('#query').addEventListener('input', event => { state.query = event.target.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => { state.requestGeneration += 1; state.offset = 0; loadCatalog(false); }, SEARCH_DEBOUNCE_MS); }); document.querySelector('#project').addEventListener('change', event => { ({ project: state.project, lot: state.lot } = selectProject(state, event.target.value)); state.requestGeneration += 1; state.offset = 0; loadCatalog(false); }); document.querySelector('#lot').addEventListener('change', event => { state.lot = event.target.value; state.requestGeneration += 1; state.offset = 0; loadCatalog(false); }); document.querySelector('#loadMore').addEventListener('click', () => loadCatalog(true)); }
function populateFilters() { const source = state.allRecords || []; const projects = projectOptions(source); const lots = lotOptions(source, state.project); document.querySelector('#project').innerHTML = `<option value="">ทุก Project</option>` + projects.map(item => `<option value="${text(item)}">${text(item)}</option>`).join(''); document.querySelector('#lot').innerHTML = `<option value="">ทุก Lot</option>` + lots.map(item => `<option value="${text(item)}">${text(item)}</option>`).join(''); document.querySelector('#project').value = state.project; document.querySelector('#lot').value = state.lot; }
function filteredRecords() { return state.records.filter(record => (!state.project || record.project === state.project) && (!state.lot || record.lot === state.lot)); }
function copyBadge(count) { const n = Math.max(0, Number(count) || 0); return `${'●'.repeat(Math.min(n, 3)) || '○'} ${n} สำเนา`; }
function icon(type) { return ({ video: '▣', audio: '♫', image: '▧', project: '◇', file: '□' })[type] || '□'; }
function card(record) { const [type, label] = fileType(record.filename); const thumb = `<span class="media-placeholder" aria-label="${label}">${icon(type)}</span>`; return `<article class="media-card" tabindex="0" data-id="${text(record.id)}"><div class="thumb">${thumb}<span class="type-chip">${icon(type)} ${label}</span></div><div class="card-body"><h2 title="${text(record.filename)}">${text(record.filename)}</h2><p>◷ ${text(formatDate(record.shootDate))}</p><p>▣ ${text(record.locations[0]?.drive_label || 'ไม่ระบุ Drive')}</p><p>▤ ${text(record.locations[0]?.folder_name || record.locations[0]?.relative_path || record.lot)}</p><button class="copy-badge" type="button" data-open="${text(record.id)}">${copyBadge(record.knownCopies)} <b>›</b></button></div></article>`; }
function renderCatalog() { const records = filteredRecords(); const catalog = document.querySelector('#catalog'); document.querySelector('#meta').textContent = `${records.length} Footage${state.hasMore ? ' · มีรายการเพิ่มเติม' : ''}`; document.querySelector('#loadMore').hidden = !state.hasMore; if (!records.length) { catalog.innerHTML = state.query.trim() ? '<div class="empty"><strong>ยังไม่พบ Footage</strong><span>รายการเก่าบางรายการอาจยังไม่มี filename_search ลอง Browse จาก Project/Lot</span></div>' : '<div class="empty"><strong>ยังไม่พบ Footage</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div>'; return; } catalog.innerHTML = records.map(card).join(''); catalog.querySelectorAll('.media-card').forEach(item => item.addEventListener('click', () => openDrawer(records.find(record => record.id === item.dataset.id)))); catalog.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openDrawer(records.find(record => record.id === button.dataset.open)); })); catalog.querySelectorAll('.media-card').forEach(item => item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDrawer(records.find(record => record.id === item.dataset.id)); } })); }
function copiesPanel(record) { const validCopies = (record.copies || []).filter(copy => isValidCopyRef(copy.copyRef) && typeof copy.driveDisplayName === 'string' && copy.driveDisplayName.trim() && typeof copy.relativeDisplayPath === 'string' && copy.relativeDisplayPath.trim()); if (!validCopies.length) return '<p class="note-text">ยังไม่มีข้อมูลตำแหน่งสำเนาที่เผยแพร่</p>'; const cards = validCopies.map(copy => { const url = finderUrl(record.id, copy.copyRef); const action = !isValidClipId(record.id) ? '' : isMac() ? `<a class="finder-button" href="${text(url)}">เปิดใน Finder</a>` : '<span class="finder-unavailable">ใช้ได้บน Mac ที่ติดตั้ง LookNai Helper</span>'; return `<section class="copy-card"><strong class="copy-drive">▣ ${text(copy.driveDisplayName)}</strong><p class="copy-path">${text(copy.relativeDisplayPath)}</p><p class="saved-location">ตำแหน่งที่บันทึกไว้</p>${action}</section>`; }).join(''); return `${cards}<section class="helper-install"><a href="${HELPER_DOWNLOAD_URL}">ติดตั้ง LookNai Helper</a><ol><li>ดาวน์โหลดไฟล์</li><li>ลากแอปไปที่ Applications</li><li>เปิดแอปหนึ่งครั้ง</li><li>กลับมาเปิด Finder จาก Team Web</li></ol></section>`; }
function openDrawer(record) { if (!record) return; const drawer = document.querySelector('#drawer'); const [type] = fileType(record.filename); drawer.hidden = false; drawer.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="${text(record.filename)}"><button class="drawer-close" aria-label="ปิด">×</button><div class="drawer-head"><div class="drawer-thumb">${icon(type)}</div><div><p class="eyebrow">${text(record.project)} / ${text(record.lot)}</p><h2>${text(record.filename)}</h2></div></div><div class="tabs" role="tablist"><button class="active" data-tab="copies">สำเนา (${record.knownCopies})</button><button data-tab="info">ข้อมูล</button></div><div class="tab-panel" id="tab-panel">${copiesPanel(record)}</div></aside>`; drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer); drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); }); drawer.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => { drawer.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === tab)); drawer.querySelector('#tab-panel').innerHTML = tab.dataset.tab === 'copies' ? copiesPanel(record) : tab.dataset.tab === 'info' ? `<dl class="info-list"><dt>Project</dt><dd>${text(record.project)}</dd><dt>Lot</dt><dd>${text(record.lot)}</dd><dt>Shoot date</dt><dd>${text(formatDate(record.shootDate))}</dd></dl>` : ''; })); }
function closeDrawer() { const drawer = document.querySelector('#drawer'); drawer.hidden = true; drawer.replaceChildren(); }
function renderAccount() { document.querySelector('#account').innerHTML = '<span class="read-only">FIREBASE CATALOG · READ ONLY</span>'; }
function showError(error) { document.querySelector('#catalog').innerHTML = `<div class="empty error"><strong>เปิด Catalog ไม่ได้</strong><span>${text(error?.message || 'เชื่อมต่อ Catalog ไม่ได้')}</span></div>`; }
function showSearchLimitation() { document.querySelector('#catalog').innerHTML = '<div class="empty"><strong>ยังค้นหารายการนี้ไม่ได้</strong><span>รายการเก่าบางส่วนยังไม่มีดัชนีชื่อไฟล์ ลองค้นหาคำอื่นหรือ Browse จาก Project/Lot</span></div>'; }
async function fetchPublishedCatalog() {
  if (!db) throw new Error('ยังไม่ได้ตั้งค่า Firebase Web app');
  const records = [];
  let cursor = null;
  do {
    const constraints = [where('published', '==', true), orderBy(documentId()), limit(200)];
    if (cursor) constraints.push(startAfter(cursor));
    const page = await getDocs(query(collection(db, 'public_clips'), ...constraints));
    records.push(...page.docs.map(snapshot => normalizeRecord({ ...snapshot.data(), clip_id: snapshot.id })).filter(record => record.published));
    cursor = page.docs.length === 200 ? page.docs.at(-1) : null;
  } while (cursor);
  return records;
}
async function loadCatalog(nextPage = false) {
  if (demoMode) { renderDemo(nextPage); return; }
  if (state.loading) return;
  state.loading = true;
  const button = document.querySelector('#loadMore'); button.disabled = true;
  try {
    if (!state.allRecords) state.allRecords = await fetchPublishedCatalog();
    state.currentPage = nextPage ? state.currentPage + 1 : 0;
    const matches = filterPublicRecords(state.allRecords,
      { search: state.query, project: state.project, lot: state.lot });
    state.records = matches.slice(0, (state.currentPage + 1) * PAGE_SIZE);
    state.hasMore = (state.currentPage + 1) * PAGE_SIZE < matches.length;
    populateFilters(); renderCatalog();
  } catch (error) { showError(error); }
  finally { state.loading = false; button.disabled = false; }
}
export function createFixture(count = 1000) { return Array.from({ length: count }, (_, index) => { const copies = Array.from({ length: index % 3 + 1 }, (_, copy) => ({ copyRef: `CP-${(BigInt(index + 1) * 4n + BigInt(copy)).toString(16).padStart(32, '0')}`, driveDisplayName: copy === 0 ? 'FOUR SSD' : 'Copy ' + (copy + 1), relativeDisplayPath: `Card ${copy + 1}/Derma/L01/YEP_${String(index + 1).padStart(4, '0')}.MP4` })); return { id: `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`, filename: `YEP_${String(index + 1).padStart(4, '0')}.MP4`, project: 'Fixture', lot: 'Lot 1', shootDate: '2026-08-21', copies, locations: copies.map(copy => ({ drive_label: copy.driveDisplayName, relative_path: copy.relativeDisplayPath })), knownCopies: copies.length }; }); }
function renderDemo(nextPage = false) { const fixture = state.allRecords || (state.allRecords = createFixture()); const needle = filenameSearchKey(state.query); const matches = fixture.filter(record => (!needle || filenameSearchKey(record.filename).startsWith(needle)) && (!state.project || record.project === state.project) && (!state.lot || record.lot === state.lot)); if (!nextPage) state.demoPage = 0; else state.demoPage += 1; const start = state.demoPage * PAGE_SIZE; state.records = visiblePage(matches, state.demoPage, PAGE_SIZE); state.hasMore = start + PAGE_SIZE < matches.length; populateFilters(); renderCatalog(); }
renderShell();
renderAccount();
if (demoMode) { const queryInput = document.querySelector('#query'); queryInput.addEventListener('input', () => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(renderDemo, SEARCH_DEBOUNCE_MS); }); renderDemo(); } else { state.requestGeneration += 1; loadCatalog(); }
