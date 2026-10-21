import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { clearSession, loadSession, saveSession } from './src/session';
import { colors } from './src/theme';
import type { Session } from './src/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((stored) => {
        if (!cancelled) setSession(stored);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.frame}>
        <View style={styles.phone}>
          {booting ? (
            <View style={styles.boot}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : session ? (
            <LedgerScreen session={session} onLogout={logout} />
          ) : (
            <LoginScreen
              onLoggedIn={async (next) => {
                await saveSession(next);
                setSession(next);
              }}
            />
          )}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.frame,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.paper,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
