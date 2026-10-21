import { StyleSheet, Text, View } from 'react-native';
import { formatRupees } from '../format';
import { card, colors, serif } from '../theme';
import type { Summary } from '../types';

export function SummaryCard({ summary }: { summary: Summary }) {
  const overdue = summary.overdueAmount !== '0.00';
  return (
    <View style={card}>
      <Text style={styles.kicker}>This ledger</Text>
      <View style={styles.row}>
        <Figure testID="summary-lent" label="Lent" value={summary.totalLent} />
        <Figure testID="summary-repaid" label="Repaid" value={summary.totalRepaid} />
        <Figure
          testID="summary-overdue"
          label="Overdue"
          value={summary.overdueAmount}
          emphasize={overdue}
        />
      </View>
    </View>
  );
}

function Figure({
  label,
  value,
  emphasize = false,
  testID,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.figure} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, emphasize && styles.overdue]} numberOfLines={1}>
        {formatRupees(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  figure: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: colors.muted,
  },
  value: {
    fontFamily: serif,
    fontSize: 18,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  overdue: {
    color: colors.overdue,
  },
});
