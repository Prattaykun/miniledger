import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchReceiptObjectUrl, receiptUrl } from '../api';
import { formatDate, formatRupees, formatTimestamp } from '../format';
import { colors } from '../theme';
import type { Loan } from '../types';

type Props = {
  loan: Loan;
  token: string;
  busy: boolean;
  onRepay: (loan: Loan) => void;
};

export function LoanRow({ loan, token, busy, onRepay }: Props) {
  const repaid = loan.repaidAt !== null;
  return (
    <View
      style={[
        styles.row,
        loan.overdue && styles.overdue,
        repaid && styles.repaid,
      ]}
    >
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, repaid && styles.muted]}>{loan.friendName}</Text>
          <Text style={styles.due}>
            {repaid && loan.repaidAt
              ? `Repaid ${formatTimestamp(loan.repaidAt)}`
              : loan.overdue
                ? `Was due ${formatDate(loan.dueDate)}`
                : `Due ${formatDate(loan.dueDate)}`}
          </Text>
        </View>
        <Text style={[styles.amount, loan.overdue && styles.overdueText, repaid && styles.muted]}>
          {formatRupees(loan.amount)}
        </Text>
      </View>

      <View style={styles.bottom}>
        {loan.overdue ? <Text style={styles.pill}>Overdue</Text> : null}
        {repaid ? <Text style={styles.quietPill}>Repaid</Text> : null}
        {loan.hasReceipt ? <ReceiptThumb loanId={loan.id} token={token} /> : null}
        <View style={styles.spacer} />
        {!repaid ? (
          <Pressable
            testID={`repay-${loan.id}`}
            onPress={() => onRepay(loan)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${loan.friendName} as repaid`}
            style={styles.repay}
          >
            {busy ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <Text style={styles.repayText}>Mark repaid</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ReceiptThumb({ loanId, token }: { loanId: string; token: string }) {
  const [uri, setUri] = useState<string | null>(Platform.OS === 'web' ? null : receiptUrl(loanId));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let alive = true;
    let objectUrl = '';
    fetchReceiptObjectUrl(loanId, token)
      .then((url) => {
        objectUrl = url;
        if (alive) setUri(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loanId, token]);

  if (!uri) return null;
  return (
    <Image
      source={
        Platform.OS === 'web'
          ? { uri }
          : { uri, headers: { Authorization: `Bearer ${token}` } }
      }
      style={styles.thumb}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.green,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  overdue: {
    backgroundColor: colors.overdueSoft,
    borderColor: '#F3C7BA',
    borderLeftColor: colors.overdue,
  },
  repaid: {
    backgroundColor: '#F7F4EE',
    borderLeftColor: '#C8C0B4',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  due: {
    fontSize: 13,
    color: colors.muted,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  overdueText: {
    color: colors.overdue,
  },
  muted: {
    color: colors.muted,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    overflow: 'hidden',
    backgroundColor: colors.overdue,
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  quietPill: {
    overflow: 'hidden',
    backgroundColor: '#E7E1D6',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  repay: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  repayText: {
    color: colors.green,
    fontWeight: '700',
    fontSize: 14,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.paper,
  },
});
