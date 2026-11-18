import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radii, useBrand } from '@/lib/theme';

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Choix unique en pastilles : l'option retenue passe sur fond encre, lisible sans la couleur. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { colors } = useBrand();
  return (
    <View style={optionStyles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              optionStyles.option,
              {
                backgroundColor: selected ? colors.ink : pressed ? colors.tile : colors.surface,
                borderColor: selected ? colors.ink : colors.border,
              },
            ]}
          >
            <Text variant="labelLarge" style={{ color: selected ? colors.surface : colors.ink }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const optionStyles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
