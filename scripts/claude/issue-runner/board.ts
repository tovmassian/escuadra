// Moves an issue's item on the Escuadra board (Projects v2, number 1) to a Status, with
// the item-edit flow escuadra-issue-creator uses for Size. `Done` is the merge's, never a
// session's.
import { runJson, runOk, type Runner } from '../../ci/flows/runner.ts';

export const REPO = 'tovmassian/escuadra';
const OWNER = 'tovmassian';
const BOARD = '1';

interface Field {
  id: string;
  name: string;
  options?: { id: string; name: string }[];
}

export async function setStatus(runner: Runner, issue: number, status: string): Promise<void> {
  if (status === 'Done') throw new Error('Done is set by the merge, not by a session');
  const { fields } = await runJson<{ fields: Field[] }>(runner, 'gh', [
    'project',
    'field-list',
    BOARD,
    '--owner',
    OWNER,
    '--format',
    'json',
  ]);
  const field = fields.find((candidate) => candidate.name === 'Status');
  const choices = (field?.options ?? []).filter((option) => option.name !== 'Done');
  const option = choices.find((candidate) => candidate.name === status);
  if (!field || !option) {
    throw new Error(
      `No Status "${status}" on the board: use one of ${choices.map((choice) => choice.name).join(', ')}`,
    );
  }
  const board = await runJson<{ id: string }>(runner, 'gh', [
    'project',
    'view',
    BOARD,
    '--owner',
    OWNER,
    '--format',
    'json',
  ]);
  // item-add returns the existing item when the issue is already on the board.
  const item = await runJson<{ id: string }>(runner, 'gh', [
    'project',
    'item-add',
    BOARD,
    '--owner',
    OWNER,
    '--url',
    `https://github.com/${REPO}/issues/${issue}`,
    '--format',
    'json',
  ]);
  await runOk(runner, 'gh', [
    'project',
    'item-edit',
    '--id',
    item.id,
    '--project-id',
    board.id,
    '--field-id',
    field.id,
    '--single-select-option-id',
    option.id,
  ]);
}
