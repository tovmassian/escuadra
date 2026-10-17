import { useT } from '@/i18n/useT';
import { creditParts } from '@/lib/photos';
import type { PhotoCredit } from '@/types/squad';
import { openBrowserAsync } from 'expo-web-browser';
import { Text, type StyleProp, type TextStyle } from 'react-native';

// A photo's credit as linked text — author · licence · cropped — to nest
// inside a screen's own <Text>, which sets the type and colour. The one
// rendering of a licence obligation (`creditParts` says what each part is),
// so the question screen and the results list cannot credit the same photo
// differently.
export function PhotoCreditText({
  credit,
  linkStyle,
}: {
  credit: PhotoCredit;
  linkStyle: StyleProp<TextStyle>;
}) {
  const t = useT();
  const { author, licence, change } = creditParts(credit, t);
  // A link that fails to open has nothing to recover; the credit stays shown.
  const open = (url: string) => () => {
    openBrowserAsync(url).catch(() => {});
  };

  return (
    <>
      <Text style={linkStyle} accessibilityRole="link" onPress={open(author.url)}>
        {author.text}
      </Text>
      {' · '}
      <Text style={linkStyle} accessibilityRole="link" onPress={open(licence.url)}>
        {licence.text}
      </Text>
      {` · ${change}`}
    </>
  );
}
