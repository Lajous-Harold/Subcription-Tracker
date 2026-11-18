import { useState, type CSSProperties } from 'react';
import { StyleSheet, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useAppTheme } from '@/lib/theme';
import type { DateFieldProps } from './DateField.shared';
import { controlStyles } from './ui';

type PaperFocusHandler = NonNullable<TextInputProps['onFocus']>;
type PaperFocusEvent = Parameters<PaperFocusHandler>[0];

const NUMERIC_INPUT_STYLE_KEYS = [
  'height',
  'minWidth',
  'fontSize',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
] as const;

/** Paper transmet des styles React Native au champ ; un `<input>` du DOM n'en comprend qu'une partie. */
function toInputCss(style: StyleProp<TextStyle>): CSSProperties {
  const flat = StyleSheet.flatten(style) ?? {};
  const css: CSSProperties = {};
  for (const key of NUMERIC_INPUT_STYLE_KEYS) {
    const value = flat[key];
    if (typeof value === 'number') css[key] = value;
  }
  if (typeof flat.paddingHorizontal === 'number') {
    css.paddingLeft ??= flat.paddingHorizontal;
    css.paddingRight ??= flat.paddingHorizontal;
  }
  if (typeof flat.color === 'string') css.color = flat.color;
  css.fontFamily = flat.fontFamily;
  return css;
}

/**
 * Champ `<input type="date">` habillé par le contour de Paper : le calendrier et l'affichage de la date suivent
 * la langue du navigateur. Vide et sans focus, son gabarit « jj/mm/aaaa » est masqué pour ne pas chevaucher le libellé.
 */
export function DateField({ label, value, onChange, clearable, error }: DateFieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const hidesTemplate = !value && !focused;

  return (
    <TextInput
      label={label}
      mode="outlined"
      outlineStyle={controlStyles.fieldOutline}
      value={value}
      error={error}
      right={
        clearable && value ? (
          <TextInput.Icon icon="close" accessibilityLabel={`Effacer : ${label}`} onPress={() => onChange('')} />
        ) : undefined
      }
      render={({ style, onFocus, onBlur, onLayout }) => (
        // Paper mesure le champ par `onLayout` pour dimensionner son libellé ; un `<input>` du DOM ne l'émet pas.
        <View onLayout={onLayout} style={fieldStyles.inputBox}>
          <input
            type="date"
            lang="fr-FR"
            aria-label={label}
            aria-invalid={error}
            required={!clearable}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onClick={(event) => {
              try {
                event.currentTarget.showPicker();
              } catch {
                // Navigateur sans `showPicker` : la saisie au clavier reste possible.
              }
            }}
            // Paper n'exploite pas l'événement : il ne lui sert qu'à basculer l'état « focus » du contour.
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event as unknown as PaperFocusEvent);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event as unknown as PaperFocusEvent);
            }}
            style={{
              ...toInputCss(style),
              ...(hidesTemplate ? { color: 'transparent' } : null),
              width: '100%',
              margin: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              boxSizing: 'border-box',
              cursor: 'pointer',
              colorScheme: theme.dark ? 'dark' : 'light',
            }}
          />
        </View>
      )}
    />
  );
}

const fieldStyles = StyleSheet.create({
  inputBox: { flexGrow: 1 },
});
