import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useBrand } from '@/lib/theme';

export interface TableColumn<Row> {
  title: string;
  flex: number;
  align?: 'left' | 'right';
  render: (row: Row) => ReactNode;
}

function columnStyle(column: { flex: number; align?: 'left' | 'right' }): ViewStyle {
  return { flex: column.flex, alignItems: column.align === 'right' ? 'flex-end' : 'flex-start' };
}

function TableRow({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { colors } = useBrand();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        styles.bodyRow,
        { borderTopColor: colors.tile },
        (pressed || hovered) && { backgroundColor: colors.background },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Le tableau défile dans sa boîte quand la colonne est trop étroite : jamais la page entière. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowLabel,
  onPressRow,
  minWidth,
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowLabel: (row: Row) => string;
  onPressRow: (row: Row) => void;
  minWidth: number;
}) {
  const { colors, fonts } = useBrand();
  return (
    <ScrollView horizontal contentContainerStyle={styles.scroller}>
      <View style={[styles.table, { minWidth }]}>
        <View style={styles.row}>
          {columns.map((column) => (
            <View key={column.title} style={columnStyle(column)}>
              <Text style={[styles.headerText, { color: colors.inkMuted, fontFamily: fonts.semiBold }]}>
                {column.title}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} label={rowLabel(row)} onPress={() => onPressRow(row)}>
            {columns.map((column) => (
              <View key={column.title} style={columnStyle(column)}>
                {column.render(row)}
              </View>
            ))}
          </TableRow>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 1 },
  table: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 8, paddingVertical: 10 },
  bodyRow: { minHeight: 44, paddingVertical: 12, borderTopWidth: 1 },
  headerText: { fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
});
