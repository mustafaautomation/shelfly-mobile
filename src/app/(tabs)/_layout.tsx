import { Tabs } from 'expo-router';

import { isFloorRole } from '@/domain/access';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import { LoadingBlock, Screen } from '@/ui/components';
import { ShelflyTabBar } from '@/ui/TabBar';
import { useAsync } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

/**
 * Role-aware tabs. Warehouse staff get the scanner in the bar; owners, super admins and
 * viewers get stock by location there instead. Both screens stay reachable for everyone.
 */
export default function TabsLayout() {
  const { ready, actor, repo, revision } = useWorkspace();
  const { colors } = useShelflyTheme();
  const alerts = useAsync(
    () => (actor?.activeTenantId ? repo.getDashboard().then((board) => board.unreadAlerts) : Promise.resolve(0)),
    [actor?.userId, actor?.activeTenantId, revision],
  );

  if (!ready || !actor) {
    return (
      <Screen>
        <LoadingBlock label={ready ? 'Returning to the front door' : 'Opening your shelves'} />
      </Screen>
    );
  }
  const floor = isFloorRole(actor.role);
  const unread = alerts.data ?? 0;

  return (
    <Tabs
      tabBar={(props) => <ShelflyTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="items" options={{ title: 'Items' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', href: floor ? '/scan' : null }} />
      <Tabs.Screen name="locations" options={{ title: 'Locations', href: floor ? null : '/locations' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
