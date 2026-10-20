import { describe, expect, it } from 'vitest';
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
