import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useShelflyTheme } from '@/theme/ThemeProvider';
import { Body, Button } from '@/ui/components';
import type { BarcodeScannerProps } from '@/ui/BarcodeScanner.types';

const BARCODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'];

/** Live camera scanner for iOS and Android. The web build uses BarcodeScanner.tsx instead. */
export function BarcodeScanner({ onCode, continuous = false, height = 260 }: BarcodeScannerProps) {
  const { colors, fontFamily } = useShelflyTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const [paused, setPaused] = useState(false);

  if (!permission) {
    return <Body>Checking camera access…</Body>;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.ask, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Ionicons name="camera-outline" size={28} color={colors.ink} />
        <Body muted={false}>Shelfly needs the camera to read barcodes on shelves and cartons.</Body>
        {permission.canAskAgain ? (
          <Button label="Allow camera" icon="camera" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open Settings" variant="secondary" icon="settings-outline" onPress={() => void Linking.openSettings()} />
        )}
        <Body>You can always type the barcode or SKU below.</Body>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODES }}
        onBarcodeScanned={
          paused
            ? undefined
            : ({ data }) => {
                const now = Date.now();
                // Ignore the same code for 1.5 s so one carton is not counted ten times.
                if (last.current && last.current.code === data && now - last.current.at < 1500) return;
                last.current = { code: data, at: now };
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                if (!continuous) setPaused(true);
                onCode(data);
              }
        }
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.window}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Turn the light off' : 'Turn the light on'}
          onPress={() => setTorch((value) => !value)}
          style={styles.control}
        >
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color="#fff" />
        </Pressable>
        {paused ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Scan again" onPress={() => setPaused(false)} style={[styles.control, styles.again]}>
            <Ionicons name="scan" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: fontFamily?.semibold }}>Scan again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  ask: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  frame: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  window: { width: '78%', height: '52%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#E08A45' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  controls: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  control: { minWidth: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  again: { flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
});
