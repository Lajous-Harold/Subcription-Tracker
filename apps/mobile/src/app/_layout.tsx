import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { darkTheme, fontAssets, lightTheme, navigationDark, navigationLight } from '@/lib/theme';
import { useIsDarkTheme } from '@/lib/theme-preference';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isDark = useIsDarkTheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider
            theme={isDark ? darkTheme : lightTheme}
            settings={{ icon: (props) => <MaterialCommunityIcons {...(props as object)} name={props.name as never} /> }}
          >
            <ThemeProvider value={isDark ? navigationDark : navigationLight}>
              <ToastProvider>
                <AuthProvider>
                  <RootNavigator />
                </AuthProvider>
              </ToastProvider>
            </ThemeProvider>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Les routes protégées ne sont accessibles qu'avec une session ; les liens profonds redirigent vers la connexion. */
function RootNavigator() {
  const { status } = useAuth();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Une police introuvable ne doit pas bloquer l'app : on retombe alors sur la police système.
  const fontsSettled = fontsLoaded || fontError !== null;
  const ready = status !== 'loading' && fontsSettled;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
