export const PAGE_SIZE = 24;
export const INITIAL_THUMBNAIL_LIMIT = 16;

export function filenameSearchKey(value = '') {
  return String(value).normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function visiblePage(records, page = 0, pageSize = PAGE_SIZE) {
  const start = Math.max(0, page) * pageSize;
  return records.slice(start, start + pageSize);
}

export function filterPublicRecords(records, { search = '', project = '', lot = '' } = {}) {
  const key = filenameSearchKey(search);
  return records.filter(record => record.published === true &&
    (!key || filenameSearchKey(record.filename).startsWith(key)) &&
    (!project || record.project === project) &&
    (!lot || record.lot === lot));
}

export function projectOptions(allClips) {
  return [...new Set(allClips.map(clip => clip.project).filter(Boolean))].sort();
}

export function lotOptions(allClips, selectedProject = '') {
  return [...new Set(allClips.filter(clip => !selectedProject || clip.project === selectedProject)
    .map(clip => clip.lot).filter(Boolean))].sort();
}

export function selectProject(selection, project) {
  return { ...selection, project, lot: '' };
}

export function lazyRequestPaths(paths, limit = INITIAL_THUMBNAIL_LIMIT) {
  return [...new Set(paths.filter(Boolean))].slice(0, limit);
}

export function approvedThumbnailUrl(record) {
  const id = record?.id;
  const version = record?.thumbnailVersion;
  if (record?.published !== true || typeof id !== 'string' ||
      !/^[0-9a-fA-F-]{36}$/.test(id) || typeof version !== 'string' ||
      !/^[0-9a-f]{16}$/.test(version) ||
      record.thumbnailPath !== `thumbnails/${id}/v${version}.webp`) return '';
  return record.thumbnailPath;
}
