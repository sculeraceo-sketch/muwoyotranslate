import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { theme } from '../src/theme';
import { supabase } from '../src/supabase';
import { useAppStore } from '../src/store';

export default function RootLayout() {
  const hydrateSession = useAppStore((state) => state.hydrateSession);
  const { isAuthenticated, authReady } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    hydrateSession();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      hydrateSession();
    });
    return () => listener.subscription.unsubscribe();
  }, [hydrateSession]);

  useEffect(() => {
    if (!authReady) return;
    const publicRoutes = ['/', '/splash', '/onboarding', '/welcome', '/create-account', '/email-confirmation'];
    const isPublicRoute = publicRoutes.includes(pathname);
    if (!isAuthenticated && !isPublicRoute) router.replace('/welcome');
    if (isAuthenticated && isPublicRoute) router.replace('/(tabs)/translate');
  }, [authReady, isAuthenticated, pathname, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
