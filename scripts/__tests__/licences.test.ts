import { describe, expect, it } from 'vitest';
import {
  buildLicenceData,
  collectPackageFolders,
  copyrightLines,
  isLicenceFile,
  orderLicenceFiles,
  packageFolderFromSource,
  type PackageRead,
} from '../licences';

const MIT = (holder: string) =>
  `MIT License\n\nCopyright (c) 2020 ${holder}\n\nPermission is hereby granted, free of charge.\n`;
const pkg = (over: Partial<PackageRead> = {}): PackageRead => ({
  name: 'a',
  version: '1.0.0',
  licence: 'MIT',
  files: [{ name: 'LICENSE', text: MIT('A') }],
  ...over,
});

describe('packageFolderFromSource', () => {
  it('reduces a source path to its package folder', () => {
    expect(packageFolderFromSource('/node_modules/zustand/esm/index.mjs')).toBe(
      'node_modules/zustand',
    );
  });
  it('keeps a scoped name whole', () => {
    expect(packageFolderFromSource('/node_modules/@telemetrydeck/sdk/dist/x.js')).toBe(
      'node_modules/@telemetrydeck/sdk',
    );
  });
  it('resolves a nested package to its own folder', () => {
    expect(
      packageFolderFromSource(
        '/node_modules/react-native-reanimated/node_modules/semver/classes/range.js',
      ),
    ).toBe('node_modules/react-native-reanimated/node_modules/semver');
  });
  it('ignores the app’s own files', () => {
    expect(packageFolderFromSource('/app/about.tsx')).toBeNull();
  });
});

it('collects unique folders, sorted', () => {
  expect(
    collectPackageFolders([
      '/node_modules/b/x.js',
      '/node_modules/a/y.js',
      '/node_modules/b/z.js',
      '/lib/q.ts',
    ]),
  ).toEqual(['node_modules/a', 'node_modules/b']);
});

it('orders licence files: primary first, then the rest, and drops the others', () => {
  expect(
    orderLicenceFiles(['README.md', 'NOTICE', 'LICENSE_FONT', 'package.json', 'LICENSE.md']),
  ).toEqual(['LICENSE.md', 'LICENSE_FONT', 'NOTICE']);
});

describe('isLicenceFile', () => {
  it('accepts the names licence files carry', () => {
    for (const name of [
      'LICENSE',
      'LICENCE',
      'license.md',
      'LICENSE.txt',
      'LICENSE_FONT',
      'LICENSE-MIT.txt',
      'COPYING',
      'NOTICE',
    ]) {
      expect(isLicenceFile(name), name).toBe(true);
    }
  });
  it('refuses source files, other extensions and folders named like a licence', () => {
    for (const name of [
      'license.js',
      'LICENSE.closure-compiler',
      'LICENSES',
      'licenser.ts',
      'NOTICE.json',
      'README.md',
    ]) {
      expect(isLicenceFile(name), name).toBe(false);
    }
  });
});

describe('copyrightLines', () => {
  it('takes the copyright lines verbatim, trimmed', () => {
    expect(copyrightLines('X\n  Copyright (c) 2019 Paul Henschel\nY')).toEqual([
      'Copyright (c) 2019 Paul Henschel',
    ]);
  });
  it('takes several', () => {
    expect(copyrightLines('Copyright (c) A,\nCopyright (c) B,\n')).toEqual([
      'Copyright (c) A,',
      'Copyright (c) B,',
    ]);
  });
  it('accepts © lines', () => {
    expect(copyrightLines('© 2024 Someone')).toEqual(['© 2024 Someone']);
  });
  it('refuses the MIT boilerplate and Apache’s template line', () => {
    expect(
      copyrightLines(
        'The above copyright notice and this permission notice…\n   Copyright [yyyy] [name of copyright owner]',
      ),
    ).toEqual([]);
  });
  it('refuses Apache-2.0 body lines that begin with copyright or (c)', () => {
    expect(
      copyrightLines(
        [
          '   copyright notice that is included in or attached to the work',
          '   copyright license to reproduce, prepare Derivative Works of, publicly display',
          '(c) You must retain, in the Source form of any Derivative Works that You distribute,',
          '   Copyright [yyyy] [name of copyright owner]',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
  it('keeps the copyright lines real packages ship, with or without a year', () => {
    const lines = [
      'Copyright (c) Meta Platforms, Inc. and affiliates.',
      'Copyright (c) Isaac Z. Schlueter and Contributors',
      'Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>',
      '© 2024 Someone',
    ];
    expect(copyrightLines(lines.join('\n'))).toEqual(lines);
  });
});

describe('buildLicenceData', () => {
  it('lists packages sorted by name then version, with deduplicated texts', () => {
    const data = buildLicenceData(
      [
        pkg({ name: 'b' }),
        pkg({ name: 'a', version: '2.0.0' }),
        pkg({ name: 'a', version: '1.0.0' }),
      ],
      {},
    );
    expect(data.packages.map((p) => `${p.name}@${p.version}`)).toEqual([
      'a@1.0.0',
      'a@2.0.0',
      'b@1.0.0',
    ]);
    expect(data.texts).toHaveLength(1);
    expect(data.packages.every((p) => p.texts[0] === 0)).toBe(true);
    expect(data.packages[0]).toMatchObject({ licence: 'MIT', copyright: 'Copyright (c) 2020 A' });
  });

  it('dedupes texts that differ only in line endings and trailing space', () => {
    const data = buildLicenceData(
      [
        pkg({ name: 'a' }),
        pkg({
          name: 'b',
          files: [{ name: 'LICENSE', text: MIT('A').replace(/\n/g, '\r\n') + '  ' }],
        }),
      ],
      {},
    );
    expect(data.texts).toHaveLength(1);
  });

  it('keeps every licence file, primary first', () => {
    const data = buildLicenceData(
      [
        pkg({
          licence: 'MIT AND OFL-1.1',
          files: [
            { name: 'LICENSE', text: MIT('Expo') },
            { name: 'LICENSE_FONT', text: 'SIL OPEN FONT LICENSE' },
          ],
        }),
      ],
      {},
    );
    expect(data.packages[0]?.texts).toEqual([0, 1]);
    expect(data.texts[1]).toBe('SIL OPEN FONT LICENSE');
  });

  it('collapses the same name and version found in two folders', () => {
    expect(buildLicenceData([pkg(), pkg()], {}).packages).toHaveLength(1);
  });

  it('keeps the copy that ships a licence file when a name and version is found twice', () => {
    const data = buildLicenceData([pkg(), pkg({ files: [] })], {});
    expect(data.packages).toHaveLength(1);
    expect(data.packages[0]?.copyright).toBe('Copyright (c) 2020 A');
  });

  it('uses a sourced licence for a package that ships none', () => {
    const data = buildLicenceData([pkg({ name: 'expo-router', files: [] })], {
      'expo-router': [{ name: 'LICENSE', text: MIT('650 Industries') }],
    });
    expect(data.packages[0]?.copyright).toBe('Copyright (c) 2020 650 Industries');
  });

  it('puts a sourced primary licence before the package’s own non-primary files', () => {
    const data = buildLicenceData(
      [
        pkg({
          name: 'expo-font',
          licence: 'MIT AND OFL-1.1',
          files: [{ name: 'LICENSE_FONT', text: 'SIL OPEN FONT LICENSE' }],
        }),
      ],
      { 'expo-font': [{ name: 'LICENSE', text: MIT('650 Industries') }] },
    );
    expect(data.packages[0]).toMatchObject({
      copyright: 'Copyright (c) 2020 650 Industries',
      texts: [0, 1],
    });
    expect(data.texts[0]).toContain('Copyright (c) 2020 650 Industries');
    expect(data.texts[1]).toBe('SIL OPEN FONT LICENSE');
  });

  it('takes the copyright and the text of every sourced primary file, in order', () => {
    const data = buildLicenceData([pkg({ name: 'expo-router', files: [] })], {
      'expo-router': [
        { name: 'LICENSE', text: MIT('650 Industries') },
        { name: 'LICENSE', text: MIT('React Navigation Contributors') },
      ],
    });
    expect(data.packages[0]?.copyright).toBe(
      'Copyright (c) 2020 650 Industries\nCopyright (c) 2020 React Navigation Contributors',
    );
    expect(data.packages[0]?.texts).toEqual([0, 1]);
    expect(data.texts[0]).toContain('650 Industries');
    expect(data.texts[1]).toContain('React Navigation Contributors');
  });

  it('needs a copyright line in only one of a package’s primary files', () => {
    const data = buildLicenceData([pkg({ name: 'expo-router', files: [] })], {
      'expo-router': [
        { name: 'LICENSE', text: 'Permission is hereby granted.' },
        { name: 'LICENSE', text: MIT('React Navigation Contributors') },
      ],
    });
    expect(data.packages[0]?.copyright).toBe('Copyright (c) 2020 React Navigation Contributors');
  });

  it('reports a sourced entry for a package that ships its own licence file', () => {
    expect(() =>
      buildLicenceData([pkg({ name: 'a' })], {
        a: [{ name: 'LICENSE', text: MIT('G') }],
      }),
    ).toThrow(
      /a: scripts\/licence-sources\.json has an entry, but the package ships its own licence file/,
    );
  });

  it('reports every problem at once', () => {
    const run = () =>
      buildLicenceData(
        [
          pkg({ name: 'gpl', licence: 'GPL-3.0' }),
          pkg({ name: 'bare', files: [] }),
          pkg({
            name: 'anon',
            files: [{ name: 'LICENSE', text: 'Permission is hereby granted.' }],
          }),
          pkg({ name: 'fontonly', files: [{ name: 'LICENSE_FONT', text: MIT('X') }] }),
        ],
        { gone: [{ name: 'LICENSE', text: MIT('G') }] },
      );
    expect(run).toThrow(/gpl@1\.0\.0: licence "GPL-3\.0" is not on the allowlist/);
    expect(run).toThrow(
      /bare@1\.0\.0: no licence file, and no entry in scripts\/licence-sources\.json/,
    );
    expect(run).toThrow(/anon@1\.0\.0: its licence file has no copyright line/);
    expect(run).toThrow(/fontonly@1\.0\.0: its licence file has no copyright line/);
    expect(run).toThrow(
      /gone: scripts\/licence-sources\.json names a package the bundle no longer contains/,
    );
  });

  it('reports a missing licence field', () => {
    expect(() => buildLicenceData([pkg({ licence: undefined })], {})).toThrow(
      /licence "\(none\)" is not on the allowlist/,
    );
  });
});
