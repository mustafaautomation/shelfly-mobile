import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useShelflyTheme } from '@/theme/ThemeProvider';
import type { BarcodeScannerProps } from '@/ui/BarcodeScanner.types';

/**
 * Web preview fallback. Browsers do not get the native barcode reader, so the panel explains
 * that and the screen's code field (and demo barcodes) do the same job.
 */
export function BarcodeScanner(_props: BarcodeScannerProps) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View
      accessible
      accessibilityLabel="Camera scanning runs in the phone app. Type or pick a barcode below."
      style={[styles.panel, { backgroundColor: colors.forest }]}
    >
      <View style={styles.window}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        <View style={styles.bars}>
          {[3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 2].map((width, index) => (
            <View key={index} style={{ width, height: '100%', backgroundColor: 'rgba(243,239,228,0.55)' }} />
          ))}
        </View>
      </View>
      <View style={styles.caption}>
        <Ionicons name="phone-portrait-outline" size={16} color={colors.onForest} />
        <Text style={[styles.text, { color: colors.onForest, fontFamily: fontFamily?.medium }]}>
          The camera scanner runs in the iOS and Android app. Here, type a barcode or SKU, or tap a demo barcode.
        </Text>
      </View>
    </View>
  );
}

const CORNER = 22;
const styles = StyleSheet.create({
  panel: { borderRadius: 20, padding: 18, gap: 14, alignItems: 'center' },
  window: { width: '72%', height: 96, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 3, height: 54, alignItems: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#E08A45' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  caption: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
