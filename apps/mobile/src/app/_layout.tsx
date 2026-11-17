import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { darkTheme, lightTheme, navigationDark, navigationLight } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  return (
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
  );
}

/** Les routes protégées ne sont accessibles qu'avec une session ; les liens profonds redirigent vers la connexion. */
function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
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
