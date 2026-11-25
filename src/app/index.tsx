import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { brand } from '@/theme/tokens';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import { ShelflyMark } from '@/ui/ShelflyMark';
import { Body, Button, LoadingBlock, Screen } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

const POINTS = [
  ['scan-outline', 'Scan a carton, see every bin it sits in'],
  ['swap-vertical-outline', 'Adjust and transfer with a reason on the ledger'],
  ['clipboard-outline', 'Receive purchase orders in full or in part'],
  ['notifications-outline', 'Low-stock alerts the moment a SKU hits its reorder point'],
] as const;

export default function WelcomeScreen() {
  const { ready, actor, mode } = useWorkspace();
  const { fontFamily } = useShelflyTheme();

  if (!ready || actor) {
    return (
      <Screen>
        <LoadingBlock label={actor ? 'Opening your shelves' : 'Opening Shelfly'} />
      </Screen>
    );
  }

  return (
    <Screen testID="welcome">
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <ShelflyMark size={44} tile={false} />
          <Text style={[styles.wordmark, { fontFamily: fontFamily?.display }]}>Shelfly</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.headline, { fontFamily: fontFamily?.display }]}>
          The warehouse floor, in your pocket.
        </Text>
        <Text style={[styles.lede, { fontFamily: fontFamily?.body }]}>
          The mobile side of Shelfly inventory. Same workspaces, same books, same rules as the web app.
        </Text>
        <View style={styles.points}>
          {POINTS.map(([, text]) => (
            <View key={text} style={styles.point}>
              <View style={styles.dot} />
              <Text style={[styles.pointText, { fontFamily: fontFamily?.medium }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <Button label="Try the demo" icon="play-circle-outline" onPress={() => router.push('/demo')} testID="try-demo" />
      <Button label="Sign in" variant="secondary" icon="log-in-outline" onPress={() => router.push('/sign-in')} />
      <Button label="Email me a sign-in link" variant="ghost" icon="mail-outline" onPress={() => router.push('/magic')} />
      <Body style={{ textAlign: 'center', fontSize: 13 }}>
        {mode === 'mock'
          ? 'Running the Northwind and Harbor demo books on this device. Add Supabase keys to use your live workspace.'
          : 'Connected to your Shelfly workspace.'}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: brand.forest, borderRadius: 26, padding: 22, gap: 14, marginTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { color: brand.paper, fontSize: 26 },
  headline: { color: brand.paper, fontSize: 36, lineHeight: 42 },
  lede: { color: 'rgba(243,239,228,0.82)', fontSize: 16, lineHeight: 23 },
  points: { gap: 10, marginTop: 4 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 2, backgroundColor: brand.copper },
  pointText: { color: brand.paper, fontSize: 15, flex: 1 },
});
