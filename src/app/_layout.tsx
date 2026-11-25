import '../global.css';

import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startNotificationRouting } from '@/notifications/push';
import { ThemeProvider, useShelflyTheme } from '@/theme/ThemeProvider';
import { WorkspaceProvider, useWorkspace } from '@/workspace/WorkspaceProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const PUBLIC = ['/', '/sign-in', '/magic', '/demo'];

function isPublic(pathname: string): boolean {
  return PUBLIC.includes(pathname) || pathname.startsWith('/auth');
}

/**
 * Sends signed-out people to the front door and signed-in people into the workspace.
 * A deep link opened while signed out (say shelfly://po/po_nw_1044) is remembered and
 * opened right after sign-in.
 */
function SessionGate() {
  const { ready, actor } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!actor && !isPublic(pathname)) {
      pending.current = pathname;
      router.replace('/');
      return;
    }
    if (actor && isPublic(pathname) && !pathname.startsWith('/auth')) {
      const target = pending.current ?? '/home';
      pending.current = null;
      router.replace(target as never);
    }
  }, [actor, pathname, ready, router]);

  useEffect(() => startNotificationRouting((url) => router.push(url as never)), [router]);

  return null;
}

function RootStack() {
  const { colors, fontsReady, scheme } = useShelflyTheme();
  const { ready } = useWorkspace();

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady, ready]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SessionGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <WorkspaceProvider>
          <RootStack />
        </WorkspaceProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
