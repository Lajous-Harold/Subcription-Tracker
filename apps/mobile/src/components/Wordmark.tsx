import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useBrand } from '@/lib/theme';

/** La boucle évoque le prélèvement qui revient ; le point signale ce qui demande l'attention. */
export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  const brand = useBrand();
  const stroke = color ?? brand.colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M52 36a16 16 0 1 1-6.2-12.6" fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round" />
      <Path
        d="M44 16l4 8-8.6 1.6"
        fill="none"
        stroke={stroke}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={52} cy={50} r={6} fill={brand.colors.signal} />
    </Svg>
  );
}

export function Wordmark({ size = 28, withLogo = true }: { size?: number; withLogo?: boolean }) {
  const brand = useBrand();
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="abo">
      {withLogo ? <LogoMark size={Math.round(size * 1.15)} /> : null}
      <Text
        style={{
          fontFamily: brand.fonts.displayBold,
          fontSize: size,
          lineHeight: Math.round(size * 1.15),
          letterSpacing: -size / 28,
          color: brand.colors.ink,
        }}
      >
        abo<Text style={{ color: brand.colors.signal }}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
