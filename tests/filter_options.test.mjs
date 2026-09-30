import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterPublicRecords, projectOptions, lotOptions, selectProject } from '../src/catalog-utils.js';

const allClips = [
  ...Array.from({ length: 33 }, (_, index) => ({ published: true, filename: `Fayda_${index}.MP4`, project: 'Fayda', lot: 'L02_2/6' })),
  ...Array.from({ length: 116 }, (_, index) => ({ published: true, filename: `Derma_${index}.MP4`, project: 'Derma-Innovation', lot: 'L01' })),
];
const allProjects = ['Derma-Innovation', 'Fayda'];
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('initial Project select lists all projects from the complete catalog', () => {
  assert.deepEqual(projectOptions(allClips), allProjects);
  assert.match(source, /<select id="project">/);
  assert.match(source, /projectOptions\(source\)/);
  assert.doesNotMatch(source, /<datalist/);
});

test('selecting Fayda leaves both projects available', () => {
  assert.deepEqual(projectOptions(allClips), allProjects);
  assert.deepEqual(lotOptions(allClips, 'Fayda'), ['L02_2/6']);
});

test('Fayda and L02_2/6 yields 33 cards without shrinking Project options', () => {
  assert.equal(filterPublicRecords(allClips, { project: 'Fayda', lot: 'L02_2/6' }).length, 33);
  assert.deepEqual(projectOptions(allClips), allProjects);
});

test('switching Fayda to Derma clears the old Lot and shows Derma results', () => {
  const next = selectProject({ project: 'Fayda', lot: 'L02_2/6' }, 'Derma-Innovation');
  assert.deepEqual(next, { project: 'Derma-Innovation', lot: '' });
  assert.deepEqual(lotOptions(allClips, next.project), ['L01']);
  assert.equal(filterPublicRecords(allClips, next).length, 116);
  assert.match(source, /selectProject\(state, event\.target\.value\)/);
});

test('switching Derma back to Fayda still works', () => {
  const next = selectProject({ project: 'Derma-Innovation', lot: 'L01' }, 'Fayda');
  assert.equal(next.lot, '');
  assert.equal(filterPublicRecords(allClips, next).length, 33);
});

test('search narrows cards without shrinking Project options', () => {
  assert.equal(filterPublicRecords(allClips, { search: 'Fayda_1' }).length, 11);
  assert.deepEqual(projectOptions(allClips), allProjects);
});

test('zero results never collapse Project options', () => {
  assert.equal(filterPublicRecords(allClips, { project: 'Fayda', lot: 'L01' }).length, 0);
  assert.deepEqual(projectOptions(allClips), allProjects);
});
