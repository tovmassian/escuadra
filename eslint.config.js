// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// User-visible text lives in i18n/ (#142). jsx-no-literals catches JSX text
// and string children; its own attribute option can't tell a label from an
// enum, so attributes go through no-restricted-syntax: a lettered string in
// any prop fails unless the prop is on this list of props that are never
// shown or spoken. A new enum prop fails until it is added here — on purpose.
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
const branch = ':matches(ConditionalExpression, LogicalExpression)';
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
        {
          selector: `${shownProp} > JSXExpressionContainer > ${branch} > ${wordy}`,
          message: useCatalog,
        },
        {
          selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${branch} > ${wordy}`,
          message: useCatalog,
        },
      ],
    },
  },
]);
