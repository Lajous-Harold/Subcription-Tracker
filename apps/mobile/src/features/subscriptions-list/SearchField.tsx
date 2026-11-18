import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, useBrand } from '@/lib/theme';

/** Le contour du champ porte la mise au point : le liseré du navigateur ferait double emploi. */
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'solid', outlineWidth: 0 } as const) : null;

/** Champ de recherche des tableaux : la loupe est décorative, seul le champ est annoncé. */
export function SearchField({
  value,
  onChangeText,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, fonts } = useBrand();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        { borderColor: focused ? colors.action : colors.controlBorder, backgroundColor: colors.surface },
        style,
      ]}
    >
      <View aria-hidden>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.inkMuted} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Rechercher"
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel="Rechercher un abonnement"
        inputMode="search"
        autoCorrect={false}
        style={[styles.input, WEB_NO_OUTLINE, { color: colors.ink, fontFamily: fonts.regular }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: radii.control,
  },
  input: { flex: 1, alignSelf: 'stretch', fontSize: 14, minWidth: 0, paddingVertical: 0 },
});
