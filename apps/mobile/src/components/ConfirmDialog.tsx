import type { ReactNode } from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useBrand } from '@/lib/theme';
import { styles } from './ui';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onDismiss,
  children,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  const brand = useBrand();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={{ gap: 8 }}>
          <Text variant="bodyMedium">{message}</Text>
          {children}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
            textColor={destructive ? brand.colors.destructive : undefined}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
