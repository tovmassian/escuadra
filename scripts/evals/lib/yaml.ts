// A YAML writer for the few shapes a case.yaml holds: maps, lists, strings,
// numbers and booleans. Strings are always double-quoted the way JSON writes
// them, which YAML reads the same way; keys are plain names, written bare.
// The generator then formats the result with Prettier.

export type YamlValue = string | number | boolean | YamlValue[] | YamlMap;
export interface YamlMap {
  [key: string]: YamlValue;
}

const PLAIN_KEY = /^[A-Za-z_][\w-]*$/;

export function toYaml(value: YamlValue): string {
  return `${render(value, 0).join('\n')}\n`;
}

function isScalar(value: YamlValue): value is string | number | boolean {
  return typeof value !== 'object';
}

function scalar(value: string | number | boolean): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function render(value: YamlValue, indent: number): string[] {
  const pad = ' '.repeat(indent);
  if (isScalar(value)) return [pad + scalar(value)];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    return value.flatMap((item) => {
      if (isScalar(item)) return [`${pad}- ${scalar(item)}`];
      const [head = '', ...rest] = render(item, indent + 2);
      return [`${pad}- ${head.trimStart()}`, ...rest];
    });
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return [`${pad}{}`];
  return entries.flatMap(([key, item]) => {
    if (!PLAIN_KEY.test(key)) throw new Error(`toYaml: key "${key}" is not a plain name`);
    if (isScalar(item)) return [`${pad}${key}: ${scalar(item)}`];
    if (Array.isArray(item) && item.length === 0) return [`${pad}${key}: []`];
    if (!Array.isArray(item) && Object.keys(item).length === 0) return [`${pad}${key}: {}`];
    return [`${pad}${key}:`, ...render(item, indent + 2)];
  });
}
