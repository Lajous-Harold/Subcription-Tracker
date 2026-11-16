import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, List, Portal, Searchbar, TextInput } from 'react-native-paper';
import type { ProviderSummary } from '@subtracker/contracts';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { Muted } from './ui';

export interface ProviderValue {
  provider: ProviderSummary | null;
  customName: string;
}

/** Fournisseur connu (catalogue) ou nom libre : l'un ou l'autre. */
export function ProviderPicker({
  value,
  onChange,
}: {
  value: ProviderValue;
  onChange: (value: ProviderValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: providers = [] } = useQuery({ queryKey: keys.providers(), queryFn: () => api.providers() });
  const filtered = providers.filter((provider) => provider.name.toLowerCase().includes(query.trim().toLowerCase()));

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
        onPress={() => setOpen(true)}
        style={{ alignSelf: 'flex-start' }}
      >
        {value.provider ? 'Changer de fournisseur' : 'Choisir dans le catalogue'}
      </Button>
      <Portal>
        <Dialog
          visible={open}
          onDismiss={() => setOpen(false)}
          style={{ maxWidth: 520, alignSelf: 'center', width: '92%' }}
        >
          <Dialog.Title>Fournisseur</Dialog.Title>
          <Dialog.Content>
            <Searchbar placeholder="Rechercher" value={query} onChangeText={setQuery} />
          </Dialog.Content>
          <Dialog.ScrollArea style={{ maxHeight: 360, paddingHorizontal: 0 }}>
            <ScrollView>
              {filtered.map((provider) => (
                <List.Item
                  key={provider.id}
                  title={provider.name}
                  onPress={() => {
                    onChange({ provider, customName: '' });
                    setOpen(false);
                  }}
                  left={(props) => <List.Icon {...props} icon="store-outline" />}
                />
              ))}
              {filtered.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Muted>Introuvable ? Fermez et saisissez un nom libre.</Muted>
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Fermer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
