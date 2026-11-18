import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { radii, useAppTheme, type BrandColors } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** `destructive` porte un contour rouge ; `destructiveGhost` n'en garde que le texte (dialogues, actions discrètes). */
export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructiveGhost';

type InteractionState = 'idle' | 'hovered' | 'pressed';

interface VariantLook {
  background: string;
  border: string;
  text: string;
  /** Voile posé au survol et à la pression : il assombrit le plein, il éclaire légèrement les autres en sombre. */
  overlay: Record<InteractionState, string>;
}

function variantLook(variant: AppButtonVariant, colors: BrandColors, dark: boolean): VariantLook {
  const darkenOverlay = { idle: 'transparent', hovered: 'rgba(0, 0, 0, 0.08)', pressed: 'rgba(0, 0, 0, 0.16)' };
  const neutralOverlay = dark
    ? { idle: 'transparent', hovered: 'rgba(255, 255, 255, 0.06)', pressed: 'rgba(255, 255, 255, 0.12)' }
    : { idle: 'transparent', hovered: 'rgba(14, 17, 22, 0.04)', pressed: 'rgba(14, 17, 22, 0.08)' };
  switch (variant) {
    case 'primary':
      return {
        background: colors.actionFill,
        border: colors.actionFill,
        text: colors.onActionFill,
        overlay: darkenOverlay,
      };
    case 'secondary':
      return { background: colors.surface, border: colors.controlBorder, text: colors.ink, overlay: neutralOverlay };
    case 'ghost':
      return { background: 'transparent', border: 'transparent', text: colors.action, overlay: neutralOverlay };
    case 'destructive':
      return {
        background: 'transparent',
        border: colors.destructive,
        text: colors.destructive,
        overlay: neutralOverlay,
      };
    case 'destructiveGhost':
      return { background: 'transparent', border: 'transparent', text: colors.destructive, overlay: neutralOverlay };
  }
}

function useInteraction(props: Pick<PressableProps, 'onHoverIn' | 'onHoverOut' | 'onPressIn' | 'onPressOut'>) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const state: InteractionState = pressed ? 'pressed' : hovered ? 'hovered' : 'idle';
  const handlers: Pick<PressableProps, 'onHoverIn' | 'onHoverOut' | 'onPressIn' | 'onPressOut'> = {
    onHoverIn: (event) => {
      setHovered(true);
      props.onHoverIn?.(event);
    },
    onHoverOut: (event) => {
      setHovered(false);
      props.onHoverOut?.(event);
    },
    onPressIn: (event) => {
      setPressed(true);
      props.onPressIn?.(event);
    },
    onPressOut: (event) => {
      setPressed(false);
      props.onPressOut?.(event);
    },
  };
  return { state, handlers };
}

const BUTTON_HEIGHTS = { medium: 48, large: 56 } as const;
const PRESSED_SCALE = 0.98;
const DISABLED_OPACITY = 0.45;

interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: string;
  variant?: AppButtonVariant;
  size?: keyof typeof BUTTON_HEIGHTS;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  /** Raccourci clavier affiché en retrait après le libellé (web large). */
  shortcutHint?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'start',
  shortcutHint,
  loading = false,
  disabled,
  style,
  accessibilityLabel,
  ...pressableProps
}: AppButtonProps) {
  const theme = useAppTheme();
  const { colors, fonts } = theme.brand;
  const reduceMotion = useReducedMotion();
  const { state, handlers } = useInteraction(pressableProps);
  const look = variantLook(variant, colors, theme.dark);
  const inactive = Boolean(disabled) || loading;
  const isGhost = variant === 'ghost' || variant === 'destructiveGhost';
  const fontSize = size === 'large' ? 16 : 15;

  const iconNode = loading ? (
    <ActivityIndicator size="small" color={look.text} />
  ) : icon ? (
    <MaterialCommunityIcons name={icon} size={20} color={look.text} />
  ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      {...pressableProps}
      {...handlers}
      style={[
        styles.button,
        {
          minHeight: BUTTON_HEIGHTS[size],
          paddingHorizontal: isGhost ? 16 : 22,
          backgroundColor: look.background,
          borderColor: look.border,
        },
        state === 'pressed' && !reduceMotion && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: look.overlay[state] }]} />
      {iconPosition === 'start' ? iconNode : null}
      <Text style={[styles.label, { color: look.text, fontFamily: fonts.semiBold, fontSize }]} numberOfLines={2}>
        {children}
        {shortcutHint ? <Text style={styles.shortcutHint}>{`  ${shortcutHint}`}</Text> : null}
      </Text>
      {iconPosition === 'end' ? iconNode : null}
    </Pressable>
  );
}

const ROUND_BUTTON_ICON_SIZES = { 48: 22, 64: 30 } as const;

interface AppRoundButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  accessibilityLabel: string;
  variant?: Extract<AppButtonVariant, 'primary' | 'secondary'>;
  size?: keyof typeof ROUND_BUTTON_ICON_SIZES;
  style?: StyleProp<ViewStyle>;
}

/** Bouton rond à icône seule : le libellé accessible est obligatoire, faute de texte visible. */
export function AppRoundButton({
  icon,
  variant = 'secondary',
  size = 64,
  disabled,
  style,
  ...pressableProps
}: AppRoundButtonProps) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const { state, handlers } = useInteraction(pressableProps);
  const look = variantLook(variant, theme.brand.colors, theme.dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      {...pressableProps}
      {...handlers}
      style={[
        styles.round,
        { width: size, height: size, backgroundColor: look.background, borderColor: look.border },
        state === 'pressed' && !reduceMotion && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: look.overlay[state] }]} />
      <MaterialCommunityIcons name={icon} size={ROUND_BUTTON_ICON_SIZES[size]} color={look.text} />
    </Pressable>
  );
}

/** Rangée d'actions de dialogue, alignée à droite et repliée sur plusieurs lignes à 320 px. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <View style={styles.dialogActions}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.control,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  label: { textAlign: 'center', letterSpacing: 0, flexShrink: 1 },
  shortcutHint: { opacity: 0.7 },
  pressed: { transform: [{ scale: PRESSED_SCALE }] },
  disabled: { opacity: DISABLED_OPACITY },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dialogActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
