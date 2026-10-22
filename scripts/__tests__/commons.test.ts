import { commonsFileUrl, fileKey } from '../commons.ts';
import { describe, expect, it } from 'vitest';

// Each pair is a file name and the page URL Commons itself gave for it
// (imageinfo `descriptionurl`), chosen for the characters MediaWiki encodes
// differently from encodeURIComponent.
const COMMONS_GIVEN: [string, string][] = [
  [
    'Pedri France v Spain 7.24.26-245.jpg',
    'https://commons.wikimedia.org/wiki/File:Pedri_France_v_Spain_7.24.26-245.jpg',
  ],
  [
    "Uzbekistan vs. Spain, 2024 Summer Olympic men's association football, 2024-07-24 (449) - Adrián Bernabé.jpg",
    'https://commons.wikimedia.org/wiki/File:Uzbekistan_vs._Spain,_2024_Summer_Olympic_men%27s_association_football,_2024-07-24_(449)_-_Adri%C3%A1n_Bernab%C3%A9.jpg',
  ],
  [
    'Borussia+Moenchengladbach+Team+Presentation+AY1wDwUEVZBx (cropped).jpg',
    'https://commons.wikimedia.org/wiki/File:Borussia%2BMoenchengladbach%2BTeam%2BPresentation%2BAY1wDwUEVZBx_(cropped).jpg',
  ],
  [
    'Zen-Slovan (1; cropped).jpg',
    'https://commons.wikimedia.org/wiki/File:Zen-Slovan_(1;_cropped).jpg',
  ],
  [
    '밀워키 이달의 선수 5월 - 이태석 인터뷰 & 제품 언박싱까지! 0s.jpg',
    'https://commons.wikimedia.org/wiki/File:%EB%B0%80%EC%9B%8C%ED%82%A4_%EC%9D%B4%EB%8B%AC%EC%9D%98_%EC%84%A0%EC%88%98_5%EC%9B%94_-_%EC%9D%B4%ED%83%9C%EC%84%9D_%EC%9D%B8%ED%84%B0%EB%B7%B0_%26_%EC%A0%9C%ED%92%88_%EC%96%B8%EB%B0%95%EC%8B%B1%EA%B9%8C%EC%A7%80!_0s.jpg',
  ],
];

describe('commonsFileUrl', () => {
  it.each(COMMONS_GIVEN)('derives the page Commons gives for %s', (file, url) => {
    expect(commonsFileUrl(file)).toBe(url);
  });

  it('keeps the characters MediaWiki leaves bare', () => {
    expect(commonsFileUrl('a;b@c$d!e*f(g)h,i/j~k:l.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:a;b@c$d!e*f(g)h,i/j~k:l.jpg',
    );
  });
});

describe('fileKey', () => {
  it('gives pageimages, Wikidata and Commons spellings of one file the same key', () => {
    expect(fileKey('Pedri_2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('File:Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
    expect(fileKey('Pedri 2021.jpg')).toBe('Pedri 2021.jpg');
  });
});
