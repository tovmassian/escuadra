import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LICENCES } from '../scripts/licences';
import { LICENCE_TEXTS, PACKAGES, UNICODE_LICENSE } from './licences.generated';
import { licenceParagraphs, packageKey } from './licencesView';

describe('licenceParagraphs', () => {
  it('joins hard-wrapped lines and splits on blank lines', () => {
    const text =
      'MIT License\n\nCopyright (c) 2020 Someone\n\nPermission is hereby\ngranted, free of charge.\n';
    expect(licenceParagraphs(text)).toEqual([
      'MIT License',
      'Copyright (c) 2020 Someone',
      'Permission is hereby granted, free of charge.',
    ]);
  });

  it('treats CRLF, indentation and whitespace-only lines like plain breaks', () => {
    const text = '   Apache License\r\n   Version 2.0\r\n  \r\n  1. Definitions.\r\n';
    expect(licenceParagraphs(text)).toEqual(['Apache License Version 2.0', '1. Definitions.']);
  });

  it('keeps every word: the paragraphs rejoined equal the text with its whitespace collapsed', () => {
    const text = 'A b\nc\n\n\n d  e \n';
    const collapse = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');
    expect(licenceParagraphs(text).join(' ')).toBe(collapse(text));
  });
});

it('keys a package by name and version', () => {
  expect(packageKey({ name: '@scope/a', version: '1.2.3' })).toBe('@scope/a@1.2.3');
});

describe('lib/licences.generated.ts', () => {
  it('resolves every text index, and gives every package a copyright and a text', () => {
    for (const p of PACKAGES) {
      expect(p.copyright, p.name).not.toBe('');
      expect(p.texts.length, p.name).toBeGreaterThan(0);
      for (const i of p.texts) expect(LICENCE_TEXTS[i], `${p.name} → ${i}`).toBeTypeOf('string');
    }
  });

  it('allows only the licences on the allowlist', () => {
    for (const p of PACKAGES) {
      expect(ALLOWED_LICENCES, `${p.name} ${p.licence}`).toContain(p.licence);
    }
  });

  it('lists each package once, by name then version', () => {
    const keys = PACKAGES.map(packageKey);
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...PACKAGES].sort((a, b) =>
      a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : a.version < b.version
            ? -1
            : a.version > b.version
              ? 1
              : 0,
    );
    expect(PACKAGES.map(packageKey)).toEqual(sorted.map(packageKey));
  });

  it('carries the Unicode notice from its first line on, verbatim', () => {
    const file = readFileSync(path.resolve(__dirname, '../i18n/UNICODE-LICENSE.txt'), 'utf8');
    expect(UNICODE_LICENSE.startsWith('UNICODE LICENSE V3')).toBe(true);
    expect(file.trim().endsWith(UNICODE_LICENSE)).toBe(true);
  });

  it('includes react-native', () => {
    expect(PACKAGES.some((p) => p.name === 'react-native')).toBe(true);
  });
});
