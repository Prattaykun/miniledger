import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, loadLedger, repayLoan } from '../api';
import { LoanForm } from '../components/LoanForm';
import { LoanRow } from '../components/LoanRow';
import { SummaryCard } from '../components/SummaryCard';
import { formatPhone } from '../format';
import { colors, serif } from '../theme';
import type { Loan, Session, Summary } from '../types';

type Props = {
  session: Session;
  onLogout: () => Promise<void> | void;
};

const emptySummary: Summary = {
  totalLent: '0.00',
  totalRepaid: '0.00',
  overdueAmount: '0.00',
};

export function LedgerScreen({ session, onLogout }: Props) {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await loadLedger(session.token);
    setSummary(next.summary);
    setLoans(next.loans);
    setError(null);
  }, [session.token]);

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          void onLogout();
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load the ledger');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload, onLogout]);

  useEffect(() => {
    if (!loading && loans.length === 0) setFormOpen(true);
  }, [loading, loans.length]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await onLogout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }

  async function onRepay(loan: Loan) {
    setBusyId(loan.id);
    setError(null);
    try {
      await repayLoan(session.token, loan.id);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await onLogout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not mark this as repaid');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title} accessibilityRole="header">
              MiniLedger
            </Text>
            <Text style={styles.phone}>{formatPhone(session.phone)}</Text>
          </View>
          <Pressable onPress={() => void onLogout()} accessibilityRole="button">
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : (
          <>
            <SummaryCard summary={summary} />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={() => setFormOpen((open) => !open)}
              accessibilityRole="button"
              style={styles.addToggle}
            >
              <Text style={styles.addToggleText}>{formOpen ? 'Hide form' : 'Add an entry'}</Text>
            </Pressable>

            {formOpen ? (
              <LoanForm
                token={session.token}
                onUnauthorized={() => void onLogout()}
                onSaved={async () => {
                  await reload();
                  setFormOpen(false);
                }}
              />
            ) : null}

            {loans.length === 0 ? (
              <Text style={styles.empty}>Nothing lent yet. Add the first person above.</Text>
            ) : (
              <View style={styles.list}>
                {loans.map((loan) => (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    token={session.token}
                    busy={busyId === loan.id}
                    onRepay={onRepay}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontFamily: serif,
    fontSize: 28,
    color: colors.ink,
  },
  phone: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 14,
  },
  logout: {
    color: colors.green,
    fontWeight: '700',
    paddingTop: 8,
  },
  loader: {
    marginTop: 40,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  addToggle: {
    alignSelf: 'flex-start',
  },
  addToggleText: {
    color: colors.green,
    fontWeight: '700',
    fontSize: 15,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  list: {
    gap: 10,
  },
});
