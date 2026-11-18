import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Portal, TextInput } from 'react-native-paper';
import { formatDate } from '@/lib/format';
import { useAppTheme } from '@/lib/theme';
import { AppButton, DialogActions } from './AppButton';
import { parseCivilDate, toCivilDate, type DateFieldProps } from './DateField.shared';
import { controlStyles, styles as uiStyles } from './ui';

/** Champ en lecture seule qui ouvre le calendrier natif : la date s'affiche en toutes lettres, en français. */
export function DateField({ label, value, onChange, clearable, error }: DateFieldProps) {
  const theme = useAppTheme();
  const [iosDraft, setIosDraft] = useState<Date | null>(null);
  const displayedDate = value ? formatDate(value) : '';

  const openPicker = () => {
    const initialDate = value ? parseCivilDate(value) : new Date();
    if (Platform.OS !== 'android') return setIosDraft(initialDate);
    DateTimePickerAndroid.open({
      value: initialDate,
      mode: 'date',
      positiveButton: { label: 'Valider' },
      negativeButton: { label: 'Annuler' },
      neutralButton: clearable ? { label: 'Effacer' } : undefined,
      onValueChange: (_event, date) => onChange(toCivilDate(date)),
      onNeutralButtonPress: () => onChange(''),
    });
  };
  const closeIosPicker = () => setIosDraft(null);

  return (
    <>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${displayedDate || 'aucune date'}`}
        accessibilityHint="Ouvre le calendrier"
      >
        <View style={fieldStyles.readOnly}>
          <TextInput
            label={label}
            mode="outlined"
            outlineStyle={controlStyles.fieldOutline}
            value={displayedDate}
            editable={false}
            error={error}
            right={<TextInput.Icon icon="calendar-month-outline" />}
          />
        </View>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Portal>
          <Dialog visible={iosDraft !== null} onDismiss={closeIosPicker} style={uiStyles.dialog}>
            <Dialog.Title>{label}</Dialog.Title>
            <Dialog.Content>
              <DateTimePicker
                value={iosDraft ?? new Date()}
                mode="date"
                display="inline"
                locale="fr-FR"
                themeVariant={theme.dark ? 'dark' : 'light'}
                accentColor={theme.brand.colors.action}
                onValueChange={(_event, date) => setIosDraft(date)}
              />
            </Dialog.Content>
            <DialogActions>
              {clearable && value ? (
                <AppButton
                  variant="destructiveGhost"
                  onPress={() => {
                    onChange('');
                    closeIosPicker();
                  }}
                >
                  Effacer
                </AppButton>
              ) : null}
              <AppButton variant="ghost" onPress={closeIosPicker}>
                Annuler
              </AppButton>
              <AppButton
                onPress={() => {
                  if (iosDraft) onChange(toCivilDate(iosDraft));
                  closeIosPicker();
                }}
              >
                Valider
              </AppButton>
            </DialogActions>
          </Dialog>
        </Portal>
      ) : null}
    </>
  );
}

const fieldStyles = StyleSheet.create({
  readOnly: { pointerEvents: 'none' },
});
