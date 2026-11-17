import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, List, Portal, Searchbar, TextInput } from 'react-native-paper';
import type { ProviderSummary } from '@subtracker/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { Muted, styles } from './ui';

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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: providers = [] } = useQuery({ queryKey: queryKeys.providers(), queryFn: () => api.providers() });
  const matchingProviders = providers.filter((provider) =>
    provider.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <View style={{ gap: 8 }}>
      {value.provider ? (
        <Chip
          icon="store"
          onClose={() => onChange({ provider: null, customName: '' })}
          style={{ alignSelf: 'flex-start' }}
        >
          {value.provider.name}
        </Chip>
      ) : (
        <TextInput
          label="Fournisseur (nom libre, facultatif)"
          mode="outlined"
          value={value.customName}
          onChangeText={(customName) => onChange({ provider: null, customName })}
        />
      )}
      <Button
        mode="outlined"
        icon="format-list-bulleted"
        onPress={() => setCatalogOpen(true)}
        style={{ alignSelf: 'flex-start' }}
      >
        {value.provider ? 'Changer de fournisseur' : 'Choisir dans le catalogue'}
      </Button>
      <Portal>
        <Dialog
          visible={catalogOpen}
          onDismiss={() => setCatalogOpen(false)}
          style={[styles.dialog, { maxWidth: 520 }]}
        >
          <Dialog.Title>Fournisseur</Dialog.Title>
          <Dialog.Content>
            <Searchbar placeholder="Rechercher" value={search} onChangeText={setSearch} />
          </Dialog.Content>
          <Dialog.ScrollArea style={{ maxHeight: 360, paddingHorizontal: 0 }}>
            <ScrollView>
              {matchingProviders.map((provider) => (
                <List.Item
                  key={provider.id}
                  title={provider.name}
                  onPress={() => {
                    onChange({ provider, customName: '' });
                    setCatalogOpen(false);
                  }}
                  left={(props) => <List.Icon {...props} icon="store-outline" />}
                />
              ))}
              {matchingProviders.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Muted>Introuvable ? Fermez et saisissez un nom libre.</Muted>
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setCatalogOpen(false)}>Fermer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
