import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import { toYaml } from '../../lib/yaml.ts';

describe('toYaml', () => {
  it('writes maps and lists in block style', () => {
    const yaml = toYaml({
      name: 'x',
      tags: ['a', 'b'],
      context: { scaffold_script: 'scaffold.sh' },
      graders: [{ type: 'regex', weight: 3 }],
      env: {},
      empty: [],
      on: true,
    });
    expect(yaml).toBe(
      [
        'name: "x"',
        'tags:',
        '  - "a"',
        '  - "b"',
        'context:',
        '  scaffold_script: "scaffold.sh"',
        'graders:',
        '  - type: "regex"',
        '    weight: 3',
        'env: {}',
        'empty: []',
        'on: true',
        '',
      ].join('\n'),
    );
  });

  it('quotes every string as JSON does, which YAML reads the same way', () => {
    expect(toYaml({ s: 'a: "b"\n- c #d' })).toBe('s: "a: \\"b\\"\\n- c #d"\n');
  });

  it('writes YAML that Prettier parses', async () => {
    const yaml = toYaml({ execution: { prompt: 'Pick up #126.\nThen stop.', max_turns: 40 } });
    await expect(format(yaml, { parser: 'yaml' })).resolves.toContain('max_turns: 40');
  });

  it('refuses a key that is not a plain name', () => {
    expect(() => toYaml({ 'a b': 1 })).toThrow(/plain name/);
  });
});
