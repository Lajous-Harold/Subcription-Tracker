import type { ReactNode } from 'react';
import { Dialog, Portal, Text } from 'react-native-paper';
import { AppButton, DialogActions } from './AppButton';
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
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={{ gap: 8 }}>
          <Text variant="bodyMedium">{message}</Text>
          {children}
        </Dialog.Content>
        <DialogActions>
          <AppButton variant="ghost" onPress={onDismiss}>
            Annuler
          </AppButton>
          <AppButton variant={destructive ? 'destructiveGhost' : 'ghost'} onPress={onConfirm} loading={loading}>
            {confirmLabel}
          </AppButton>
        </DialogActions>
      </Dialog>
    </Portal>
  );
}
