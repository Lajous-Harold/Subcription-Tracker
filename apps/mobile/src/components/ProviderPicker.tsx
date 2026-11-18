import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, List, Portal, Text, TextInput } from 'react-native-paper';
import type { ProviderSummary } from '@subtracker/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useBrand } from '@/lib/theme';
import { AppButton, DialogActions } from './AppButton';
import { controlStyles, Muted, ServiceMonogram, styles as uiStyles } from './ui';

export interface ProviderValue {
  provider: ProviderSummary | null;
  customName: string;
}

export function ProviderPicker({
  value,
  onChange,
}: {
  value: ProviderValue;
  onChange: (value: ProviderValue) => void;
}) {
  const brand = useBrand();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: providers = [] } = useQuery({ queryKey: queryKeys.providers(), queryFn: () => api.providers() });
  const matchingProviders = providers.filter((provider) =>
    provider.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <View style={styles.picker}>
      {value.provider ? (
        <View style={[styles.selected, { borderColor: brand.colors.border, borderRadius: brand.radii.control }]}>
          <ServiceMonogram name={value.provider.name} size={32} />
          <Text variant="bodyLarge" numberOfLines={1} style={styles.selectedName}>
            {value.provider.name}
          </Text>
          <AppButton
            variant="ghost"
            onPress={() => onChange({ provider: null, customName: '' })}
            accessibilityLabel={`Retirer le fournisseur ${value.provider.name}`}
          >
            Retirer
          </AppButton>
        </View>
      ) : (
        <TextInput
          label="Fournisseur (facultatif)"
          mode="outlined"
          outlineStyle={controlStyles.fieldOutline}
          value={value.customName}
          onChangeText={(customName) => onChange({ provider: null, customName })}
        />
      )}
      <AppButton
        variant="secondary"
        icon="format-list-bulleted"
        onPress={() => setCatalogOpen(true)}
        style={styles.catalogButton}
      >
        {value.provider ? 'Changer de fournisseur' : 'Choisir dans le catalogue'}
      </AppButton>
      <Portal>
        <Dialog visible={catalogOpen} onDismiss={() => setCatalogOpen(false)} style={[uiStyles.dialog, styles.dialog]}>
          <Dialog.Title>Fournisseur</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Rechercher"
              mode="outlined"
              outlineStyle={controlStyles.fieldOutline}
              left={<TextInput.Icon icon="magnify" />}
              value={search}
              onChangeText={setSearch}
            />
          </Dialog.Content>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              {matchingProviders.map((provider) => (
                <List.Item
                  key={provider.id}
                  title={provider.name}
                  style={styles.option}
                  onPress={() => {
                    onChange({ provider, customName: '' });
                    setCatalogOpen(false);
                  }}
                  left={() => <ServiceMonogram name={provider.name} size={32} />}
                />
              ))}
              {matchingProviders.length === 0 ? (
                <View style={styles.notFound}>
                  <Muted>Introuvable ? Fermez et saisissez un nom libre.</Muted>
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <DialogActions>
            <AppButton variant="ghost" onPress={() => setCatalogOpen(false)}>
              Fermer
            </AppButton>
          </DialogActions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 8 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, paddingLeft: 12 },
  selectedName: { flex: 1 },
  catalogButton: { alignSelf: 'flex-start' },
  dialog: { maxWidth: 520 },
  scrollArea: { maxHeight: 360, paddingHorizontal: 0 },
  option: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' },
  notFound: { padding: 16 },
});
