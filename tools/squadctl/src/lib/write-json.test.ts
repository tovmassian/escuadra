import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatAndWrite } from './write-json.ts';

const made: string[] = [];
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'squadctl-'));
  made.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('formatAndWrite', () => {
  // The first club in a league writes into a folder that does not exist yet:
  // data/squads/club/bundesliga/ is created by the team that needs it.
  it('creates missing parent directories', async () => {
    const root = scratch();
    const target = path.join(root, 'data', 'squads', 'club', 'bundesliga', 'bay.json');
    await formatAndWrite(target, JSON.stringify({ id: 'bay' }));
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ id: 'bay' });
  });

  it('formats through prettier so output matches the repo style', async () => {
    const root = scratch();
    const target = path.join(root, 'out.json');
    await formatAndWrite(target, '{"b":2,"a":1}');
    expect(readFileSync(target, 'utf8')).toBe('{ "b": 2, "a": 1 }\n');
  });
});
