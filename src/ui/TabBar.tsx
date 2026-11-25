import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { roleLabel } from '@/domain/access';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import { ShelflyMark } from '@/ui/ShelflyMark';
import { useWide, type IconName } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export interface ShelflyTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; href?: string | null; tabBarBadge?: string | number } }>;
  navigateToTab: (routeKey: string) => void;
}

const ICONS: Record<string, [IconName, IconName]> = {
  home: ['home-outline', 'home'],
  items: ['cube-outline', 'cube'],
  scan: ['scan-outline', 'scan'],
  locations: ['grid-outline', 'grid'],
  orders: ['clipboard-outline', 'clipboard'],
  alerts: ['notifications-outline', 'notifications'],
  more: ['person-circle-outline', 'person-circle'],
};

export function ShelflyTabBar({ state, descriptors, navigateToTab }: ShelflyTabBarProps) {
  const { colors, fontFamily } = useShelflyTheme();
  const { actor, activeWorkspace } = useWorkspace();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const routes = state.routes.filter((route) => descriptors[route.key]?.options?.href !== null);

  const items = routes.map((route) => {
    const focused = state.routes[state.index]?.key === route.key;
    const options = descriptors[route.key]?.options;
    const label = options?.title ?? route.name;
    const badge = options?.tabBarBadge;
    const [icon, iconActive] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
        accessibilityState={{ selected: focused }}
        testID={`tab-${route.name}`}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={[styles.item, wide && styles.itemWide, wide && focused && { backgroundColor: colors.forestSoft }]}
      >
        <View>
          <Ionicons name={focused ? iconActive : icon} size={22} color={focused ? colors.primary : colors.muted} />
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.primaryFill, borderColor: colors.surface }]}>
              <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, wide && styles.labelWide, { color: focused ? colors.ink : colors.muted, fontFamily: focused ? fontFamily?.semibold : fontFamily?.medium }]}>
          {label}
        </Text>
      </Pressable>
    );
  });

  if (wide) {
    return (
      <View style={[styles.rail, { backgroundColor: colors.surface, borderRightColor: colors.line, paddingTop: insets.top + 20 }]}>
        <View style={styles.brandRow}>
          <ShelflyMark size={34} />
          <Text style={[styles.wordmark, { color: colors.ink, fontFamily: fontFamily?.display }]}>Shelfly</Text>
        </View>
        {activeWorkspace ? (
          <View style={styles.railWorkspace}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontFamily: fontFamily?.semibold }}>
              {activeWorkspace.tenantName}
            </Text>
            <Text style={{ color: colors.muted, fontFamily: fontFamily?.body, fontSize: 13 }}>{roleLabel(actor?.role)}</Text>
          </View>
        ) : null}
        {items}
      </View>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 248, borderRightWidth: 1, paddingHorizontal: 14, gap: 4, zIndex: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 14 },
  wordmark: { fontSize: 26 },
  railWorkspace: { paddingHorizontal: 10, marginBottom: 14, gap: 2 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingHorizontal: 4 },
  item: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 14 },
  itemWide: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  label: { fontSize: 11 },
  labelWide: { fontSize: 15 },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
