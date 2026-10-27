// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// User-visible text lives in i18n/ (#142). jsx-no-literals catches JSX text
// and string children; its own attribute option can't tell a label from an
// enum, so attributes go through no-restricted-syntax: a lettered string in
// any prop fails unless the prop is on this list of props that are never
// shown or spoken. A new enum prop fails until it is added here — on purpose.
//
// Escapes that remain, by design of a lint rule: call arguments
// (`fn('Hello')`); object-valued props (`accessibilityValue={{ text }}`);
// strings built outside JSX and passed by variable; attributes whose letters
// are all non-ASCII (the regex is [A-Za-z]). Flat config replaces rule
// options, so any future `no-restricted-syntax` entry for these files must
// merge in these selectors, or it silently switches the guard off.
const SILENT_PROPS = [
  'key',
  'testID',
  'nativeID',
  'accessibilityRole',
  'accessibilityLabelledBy',
  'accessibilityLiveRegion',
  'importantForAccessibility',
  'pointerEvents',
  'style',
  'variant',
  'size',
  'contentFit',
  'cachePolicy',
  'keyboardShouldPersistTaps',
  'autoCapitalize',
  'returnKeyType',
  'decelerationRate',
  'animationType',
  'gradient',
  'lineTone',
  'gridKey',
];
const shownProp = `JSXAttribute:not([name.name=/^(${SILENT_PROPS.join('|')})$/])`;
const wordy =
  ':matches(Literal[value=/[A-Za-z]/], TemplateLiteral:has(TemplateElement[value.raw=/[A-Za-z]/]))';
const wrap =
  ':matches(ConditionalExpression, LogicalExpression, TSAsExpression, TSSatisfiesExpression)';
const host = `:matches(JSXElement, JSXFragment, ${shownProp}) > JSXExpressionContainer`;
const useCatalog = 'User-visible text comes from the i18n catalog: `const t = useT()`.';

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Reduce Motion is read live, through one hook (#227).
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    ignores: ['hooks/useReduceMotion.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-reanimated',
              importNames: ['useReducedMotion'],
              message:
                "It reads Reduce Motion once, as the app starts: use `useReduceMotion` from '@/hooks/useReduceMotion'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: ['·', '›', '‹', '/', '—', '?'] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `${shownProp} > Literal[value=/[A-Za-z]/]`, message: useCatalog },
        { selector: `${shownProp} > JSXExpressionContainer > ${wordy}`, message: useCatalog },
        { selector: `${host} > ${wrap} > ${wordy}`, message: useCatalog },
        { selector: `${host} > ${wrap} > ${wrap} > ${wordy}`, message: useCatalog },
        { selector: `${host} > BinaryExpression[operator='+'] ${wordy}`, message: useCatalog },
        {
          selector: `${host} > CallExpression[callee.property.name='join'] > MemberExpression.callee > ArrayExpression > ${wordy}`,
          message: useCatalog,
        },
      ],
    },
  },
]);
