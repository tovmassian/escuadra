import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderSite } from '../src/build.mjs';

test('every generated page on disk is what the generator renders: run `node src/build.mjs`', () => {
  for (const [path, html] of renderSite()) {
    assert.equal(readFileSync(path, 'utf8'), html, `${path} is out of date with its text file`);
  }
});
