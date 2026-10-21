import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, createLoan } from '../api';
import { card, colors } from '../theme';

type Props = {
  token: string;
  onSaved: () => Promise<void>;
  onUnauthorized: () => void;
};

export function LoanForm({ token, onSaved, onUnauthorized }: Props) {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to attach a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return;
    setReceipt(result.assets[0] ?? null);
    setError(null);
  }

  async function save() {
    const cleanedAmount = amount.replace(/[₹,\s]/g, '');
    const problem = validate(friendName, cleanedAmount, dueDate);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createLoan(token, {
        friendName: friendName.trim(),
        amount: cleanedAmount,
        dueDate: dueDate.trim(),
        receipt,
      });
      setFriendName('');
      setAmount('');
      setDueDate('');
      setReceipt(null);
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not save the entry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={card}>
      <Text style={styles.heading}>New entry</Text>
      <Field label="Friend's name">
        <TextInput
          testID="friend-name"
          value={friendName}
          onChangeText={setFriendName}
          placeholder="Asha Sharma"
          placeholderTextColor={colors.muted}
          maxLength={80}
          style={styles.input}
          editable={!busy}
        />
      </Field>
      <Field label="Amount (₹)">
        <TextInput
          testID="amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="1500"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          maxLength={12}
          style={styles.input}
          editable={!busy}
        />
      </Field>
      <Field label="Due date">
        <TextInput
          testID="due-date"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="2026-11-15"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          style={styles.input}
          editable={!busy}
        />
      </Field>
      <Text style={styles.hint}>YYYY-MM-DD. A past date is kept and shown as overdue.</Text>

      {receipt ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: receipt.uri }} style={styles.preview} />
          <Pressable onPress={() => setReceipt(null)} disabled={busy} accessibilityRole="button">
            <Text style={styles.link}>Remove photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={pickReceipt} disabled={busy} accessibilityRole="button" testID="attach-receipt">
          <Text style={styles.link}>Attach receipt photo (optional)</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        testID="save-entry"
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={save}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save entry</Text>}
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function validate(friendName: string, amount: string, dueDate: string): string | null {
  if (!friendName.trim()) return 'Friend name is required';
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return 'Enter an amount like 1500 or 1500.50';
  }
  if (!isRealDate(dueDate.trim())) return 'Enter a real due date as YYYY-MM-DD';
  return null;
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  field: {
    gap: 6,
    marginTop: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  hint: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  link: {
    marginTop: 12,
    color: colors.green,
    fontSize: 14,
    fontWeight: '600',
  },
  previewRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.paper,
  },
  error: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 14,
  },
  button: {
    marginTop: 14,
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
