import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, json, ok, type Call } from '../../../ci/__tests__/fake-runner.ts';
import { setStatus } from '../../issue-runner/board.ts';

const STATUS = {
  id: 'PVTSSF_status',
  name: 'Status',
  options: [
    { id: 'opt-backlog', name: 'Backlog' },
    { id: 'opt-progress', name: 'In progress' },
    { id: 'opt-review', name: 'In review' },
    { id: 'opt-done', name: 'Done' },
  ],
};

function board(overrides: (call: Call) => ReturnType<typeof ok> | undefined = () => undefined) {
  return fakeRunner((call) => {
    const override = overrides(call);
    if (override) return override;
    const [group, sub] = call.args;
    if (call.tool !== 'gh' || group !== 'project') return undefined;
    if (sub === 'item-add') return json({ id: 'PVTI_item' });
    if (sub === 'view') return json({ id: 'PVT_board', title: 'Escuadra' });
    if (sub === 'field-list') return json({ fields: [{ id: 'size', name: 'Size' }, STATUS] });
    if (sub === 'item-edit') return ok();
    return undefined;
  });
}

describe('setStatus', () => {
  it("moves the issue's board item to the named Status", async () => {
    const runner = board();
    await setStatus(runner, 207, 'In review');
    const add = runner.calls.find((call) => call.args[1] === 'item-add');
    expect(add?.args).toEqual(
      expect.arrayContaining([
        '1',
        '--owner',
        'tovmassian',
        '--url',
        'https://github.com/tovmassian/escuadra/issues/207',
      ]),
    );
    const edit = runner.calls.find((call) => call.args[1] === 'item-edit');
    expect(edit?.args).toEqual([
      'project',
      'item-edit',
      '--id',
      'PVTI_item',
      '--project-id',
      'PVT_board',
      '--field-id',
      'PVTSSF_status',
      '--single-select-option-id',
      'opt-review',
    ]);
  });

  it('refuses Done, which belongs to the merge, before any call', async () => {
    const runner = board();
    await expect(setStatus(runner, 207, 'Done')).rejects.toThrow(/merge/);
    expect(runner.calls).toEqual([]);
  });

  it('names the board options when the Status is not one of them, and edits nothing', async () => {
    const runner = board();
    await expect(setStatus(runner, 207, 'Reviewing')).rejects.toThrow(
      /Backlog, In progress, In review/,
    );
    expect(runner.calls.some((call) => call.args[1] === 'item-edit')).toBe(false);
  });

  it('reports a failed gh call with its error', async () => {
    const runner = board((call) =>
      call.args[1] === 'item-add' ? fail(1, 'Could not resolve to an issue') : undefined,
    );
    await expect(setStatus(runner, 9999, 'In progress')).rejects.toThrow(
      /Could not resolve to an issue/,
    );
  });
});
