import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestOtp, verifyOtp, ApiError } from '../api';
import { colors, serif } from '../theme';
import type { Session } from '../types';

type Props = {
  onLoggedIn: (session: Session) => Promise<void> | void;
};

export function LoginScreen({ onLoggedIn }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(phone);
      setStep('code');
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const session = await verifyOtp(phone, code);
      await onLoggedIn({ token: session.token, phone: session.phone });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.mark}>
        <Text style={styles.markText}>₹</Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">
        MiniLedger
      </Text>
      <Text style={styles.subtitle}>Track money lent to friends.</Text>

      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            testID="phone-input"
            value={phone}
            onChangeText={setPhone}
            placeholder="9876543210"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
            style={styles.input}
            editable={!busy}
          />
          <Text style={styles.hint}>
            No SMS is sent. The 6-digit code is printed in the backend terminal.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            testID="send-otp"
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={sendCode}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Code from the backend log</Text>
          <TextInput
            testID="otp-input"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            style={styles.input}
            editable={!busy}
          />
          <Text style={styles.hint}>
            Look for a line that starts with [miniledger] OTP. It expires in 5 minutes.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            testID="verify-otp"
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={verify}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Verify and continue</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setStep('phone');
              setCode('');
              setError(null);
            }}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function messageFrom(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong';
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  markText: {
    color: colors.white,
    fontFamily: serif,
    fontSize: 28,
  },
  title: {
    fontFamily: serif,
    fontSize: 36,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.muted,
    marginBottom: 28,
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: colors.ink,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 48,
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
  link: {
    textAlign: 'center',
    color: colors.green,
    fontSize: 14,
    marginTop: 8,
  },
});
