import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/contrast';
import {
  cardGradient,
  durations,
  gradients,
  MOTION_TIME_SCALE,
  palettes,
  resultsTimeline,
  sizes,
  spotlightCues,
  spotlightMotion,
  stage,
  stageGradients,
  typography,
} from './tokens';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('brand tokens', () => {
  it('every brand colour is a full-length hex', () => {
    for (const key of [
      'brandBright',
      'brandDeep',
      'brandSoft',
      'brandLift',
      'brandPlateTop',
      'brandPlateBottom',
    ] as const) {
      expect(palettes.dark[key], key).toMatch(HEX);
    }
  });

  it('every gradient has at least two stops, all valid hex', () => {
    for (const [name, g] of Object.entries(gradients)) {
      expect(g.colors.length, name).toBeGreaterThanOrEqual(2);
      for (const stop of g.colors) expect(stop, name).toMatch(HEX);
    }
  });

  it('every gradient start and end is inside the unit square', () => {
    for (const [name, g] of Object.entries(gradients)) {
      for (const p of [g.start, g.end]) {
        expect(p.x, name).toBeGreaterThanOrEqual(0);
        expect(p.x, name).toBeLessThanOrEqual(1);
        expect(p.y, name).toBeGreaterThanOrEqual(0);
        expect(p.y, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the wordmark uses the ExtraBold family', () => {
    expect(typography.wordmark.fontFamily).toBe('Inter-ExtraBold');
  });
});

// Hex or rgba(). Catches a truncated hex like '#12141', which is a valid
// string and a silently wrong colour — neither TypeScript nor the compiler
// can see the difference.
const COLOR = /^(#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/;

// `contrastRatio` measures opaque #rrggbb only, so a translucent role is
// blended over what it sits on first, in sRGB, as the screen paints it.
function blend(role: string, over: string): string {
  const rgba = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(role.replace(/\s/g, ''));
  if (!rgba) return role;
  const [r = 0, g = 0, b = 0, alpha = 1] = rgba.slice(1).map(Number);
  const mixed = [r, g, b].map((v, i) =>
    Math.round(v * alpha + parseInt(over.slice(1 + i * 2, 3 + i * 2), 16) * (1 - alpha)),
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('palettes', () => {
  it('expose identical key sets', () => {
    expect(new Set(Object.keys(palettes.light))).toEqual(new Set(Object.keys(palettes.dark)));
  });

  it('hold a well-formed colour in every role, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      Object.entries(palettes[name]).forEach(([role, value]) => {
        expect(value.replace(/\s/g, ''), `${name}.${role}`).toMatch(COLOR);
      });
    });
  });
});

describe('text contrast', () => {
  // AA for body text. `textMuted` carries captions, stat labels and the photo
  // credit, so it is held to the body-copy bar on the grounds it sits on.
  it('textMuted reaches 4.5:1 on background and surface, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const ground of ['background', 'surface'] as const) {
        expect(
          contrastRatio(p.textMuted, p[ground]),
          `${name}.textMuted on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  // Results sets small text in `successText` (the 10/10 label) and `error` (the
  // fail label). `success` carries only large text and graphics there.
  it('successText reaches 4.5:1 on background and surface, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const ground of ['background', 'surface'] as const) {
        expect(
          contrastRatio(p.successText, p[ground]),
          `${name}.successText on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('error reaches 4.5:1 on background, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      expect(contrastRatio(p.error, p.background), `${name}.error`).toBeGreaterThanOrEqual(4.5);
    });
  });

  // The share text's URL, drawn in `link` inside the preview's bubble, which
  // sits on `surfaceRaised`.
  it('link reaches 4.5:1 on surfaceRaised, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      expect(
        contrastRatio(p.link, p.surfaceRaised),
        `${name}.link on surfaceRaised`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  // A player card's line sits at the foot of the card, on the gradient's last
  // stop, so it is held to AA there over the worst photo: pure white.
  it('cardLine reaches 4.5:1 under the last cardGradient stop over a white photo', () => {
    const last = cardGradient.colors[cardGradient.colors.length - 1] ?? '';
    const ground = blend(last, '#ffffff');
    (['dark', 'light'] as const).forEach((name) => {
      expect(
        contrastRatio(palettes[name].cardLine, ground),
        `${name}.cardLine`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  // Study's card line and its "Tap to reveal" label are translucent whites, so
  // each is blended over the same worst-case ground before it is measured.
  it('revealText and onPhotoMuted reach 4.5:1 under the last cardGradient stop over a white photo', () => {
    const last = cardGradient.colors[cardGradient.colors.length - 1] ?? '';
    const ground = blend(last, '#ffffff');
    (['dark', 'light'] as const).forEach((name) => {
      for (const role of ['revealText', 'onPhotoMuted'] as const) {
        expect(
          contrastRatio(blend(palettes[name][role], ground), ground),
          `${name}.${role}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  // The list rows' affiliation line and position chip are `textSecondary`;
  // `textMuted` is covered above.
  it('textSecondary reaches 4.5:1 on background, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      expect(
        contrastRatio(p.textSecondary, p.background),
        `${name}.textSecondary`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('spotlight stage', () => {
  // These sit on the player photo or on the team's own colours, neither of
  // which changes with the theme.
  it('shares the photo-side roles between themes', () => {
    for (const role of [
      'heat',
      'heatBg',
      'heatLine',
      'heatText',
      'glass',
      'glassLine',
      'veilInk',
      'onPhoto',
      'onPhotoMuted',
      'photoTrack',
      'photoSuccess',
      'photoError',
      'stageShimmer',
      'stageShimmerEdge',
      'cardLine',
      'revealLine',
      'revealText',
    ] as const) {
      expect(palettes.dark[role], role).toBeDefined();
      expect(palettes.light[role], role).toBe(palettes.dark[role]);
    }
  });

  // contrastRatio measures opaque #rrggbb only, so the role the veil is sized
  // against must be one.
  it('keeps onPhoto opaque, so the veil can be measured against it', () => {
    expect(palettes.dark.onPhoto).toMatch(HEX);
  });

  it('gives each theme a stage gradient that ends in its own ground', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const g = stageGradients[name];
      expect(g.locations.length, name).toBe(g.colors.length);
      g.colors.forEach((c) => expect(c, name).toMatch(COLOR));
      g.locations.forEach((at, i) => {
        expect(at, `${name}[${i}]`).toBeGreaterThanOrEqual(0);
        expect(at, `${name}[${i}]`).toBeLessThanOrEqual(1);
        if (i > 0) expect(at, `${name}[${i}]`).toBeGreaterThan(g.locations[i - 1] ?? 1);
      });
      expect(g.colors.at(-1), name).toBe(palettes[name].background);
    });
  });

  it('veils the no-photo bands harder on dark than on light', () => {
    for (const name of ['dark', 'light'] as const) {
      expect(stage.veil[name], name).toBeGreaterThan(0);
      expect(stage.veil[name], name).toBeLessThan(1);
    }
    expect(stage.veil.dark).toBeGreaterThan(stage.veil.light);
  });
});

describe('motion budget', () => {
  // Not animations: a shimmer's loop period, and the pause after a correct
  // answer before the round moves on (spec §2.4).
  const NOT_ANIMATIONS = new Set(['skeleton', 'autoAdvance']);
  const animations = Object.entries(durations).filter(([name]) => !NOT_ANIMATIONS.has(name));

  it('keeps every mid-round animation within 300 ms', () => {
    for (const [name, ms] of animations) expect(ms, name).toBeLessThanOrEqual(300);
  });

  it('waits longer after a correct answer than any animation runs', () => {
    expect(durations.autoAdvance).toBeGreaterThan(Math.max(...animations.map(([, ms]) => ms)));
  });
});

describe('spotlight sizes', () => {
  it('gives the photo more of a short screen, not less', () => {
    expect(sizes.stage.ratioCompact).toBeGreaterThan(sizes.stage.ratio);
    expect(sizes.stage.ratioCompact).toBeLessThan(1);
  });

  it('shrinks every answer tile and the main button when compact', () => {
    for (const [grid, h] of Object.entries(sizes.answerTile)) {
      expect(h.compact, grid).toBeLessThan(h.normal);
    }
    expect(sizes.cta.compact).toBeLessThan(sizes.cta.normal);
  });

  // Apple's minimum tap target. The 36 pt glass button gets there with
  // hitSlop at its call site, so it is not checked here.
  it('keeps every answer tile and the main button at least 44 pt tall', () => {
    for (const [grid, h] of Object.entries(sizes.answerTile)) {
      expect(h.compact, grid).toBeGreaterThanOrEqual(44);
    }
    expect(sizes.cta.compact).toBeGreaterThanOrEqual(44);
  });
});

describe('Archivo display type', () => {
  it('sets each compact style smaller, in the same face', () => {
    const pairs = [
      [typography.shirtNumber, typography.shirtNumberCompact],
      [typography.prompt, typography.promptCompact],
    ] as const;
    for (const [normal, compact] of pairs) {
      expect(compact.fontFamily).toBe(normal.fontFamily);
      expect(compact.fontSize).toBeLessThan(normal.fontSize);
    }
  });

  // Each cut is a single weight, so the family name alone selects it. A
  // fontWeight of 700 or more makes Android look up a bold variant that a
  // runtime-loaded font does not have, and fall back to the system font.
  it('leaves fontWeight off every Archivo style', () => {
    const archivo = Object.entries(typography).filter(([, style]) =>
      style.fontFamily.startsWith('Archivo-'),
    );
    expect(archivo).toHaveLength(16);
    for (const [name, style] of archivo) {
      expect(style, name).not.toHaveProperty('fontWeight');
    }
  });
});

describe('spotlight screen text contrast', () => {
  // Opaque text roles on the stage's ground, held to AA (4.5:1) against the
  // theme's background. Translucent roles composite at render time and are
  // checked on the design board instead.
  const TEXT_ROLES = [
    'onStage',
    'chipPendingText',
    'onStageMuted',
    'stageSuccessText',
    'stageErrorText',
    'nextText',
    'tileSub',
  ] as const;

  it('reaches 4.5:1 on the ground wherever the role is opaque', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      for (const role of TEXT_ROLES) {
        const value = p[role];
        if (!value.startsWith('#')) continue;
        expect(contrastRatio(value, p.background), `${name}.${role}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  // The checks above see only the background. These text roles sit on a wash of
  // their own, which moves the ground under them.
  it('reaches 4.5:1 on the wash each text role sits on, in both themes', () => {
    (['dark', 'light'] as const).forEach((name) => {
      const p = palettes[name];
      const wash = (role: 'stageAnswerBg' | 'chipBg' | 'nextBg') => blend(p[role], p.background);
      const pairs = [
        ['stageSuccessText', 'stageAnswerBg'],
        ['chipPendingText', 'chipBg'],
        ['onStageMuted', 'chipBg'],
        ['nextText', 'nextBg'],
      ] as const;
      for (const [text, ground] of pairs) {
        const under = wash(ground);
        expect(
          contrastRatio(blend(p[text], under), under),
          `${name}.${text} on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('spotlight motion', () => {
  it('cues every mid-round moment within the 300 ms budget', () => {
    for (const [cue, ms] of Object.entries(spotlightCues)) {
      expect(ms, cue).toBeGreaterThanOrEqual(0);
      expect(ms, cue).toBeLessThanOrEqual(300);
    }
  });

  it('keeps scales near 1 and distances small', () => {
    for (const key of [
      'pressScale',
      'streakOutScale',
      'ballStartScale',
      'rosterInScale',
    ] as const) {
      expect(spotlightMotion[key], key).toBeLessThan(1);
    }
    for (const key of ['popScale', 'answerPopScale', 'pulseScale', 'streakPopScale'] as const) {
      expect(spotlightMotion[key], key).toBeGreaterThan(1);
      expect(spotlightMotion[key], key).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('results motion', () => {
  // Spec §6 gives the Results timings at MOTION_TIME_SCALE 1.
  it('runs at the shipped time scale', () => {
    expect(MOTION_TIME_SCALE).toBe(1);
  });

  it('fills the round strip by the time the pass beat starts', () => {
    const stripEnd = 9 * resultsTimeline.segmentStagger + resultsTimeline.segmentFill;
    expect(stripEnd).toBeLessThanOrEqual(resultsTimeline.passBeat);
    expect(resultsTimeline.failBeat).toBeLessThan(resultsTimeline.passBeat);
  });
});

describe('cardGradient', () => {
  it('has as many locations as colours, ascending, within the card', () => {
    expect(cardGradient.locations.length).toBe(cardGradient.colors.length);
    cardGradient.colors.forEach((c) => expect(c).toMatch(COLOR));
    cardGradient.locations.forEach((at, i) => {
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThanOrEqual(1);
      if (i > 0) expect(at).toBeGreaterThan(cardGradient.locations[i - 1] ?? 1);
    });
  });
});
