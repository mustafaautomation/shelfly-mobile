import { useState } from 'react';
import { View } from 'react-native';

import { BarcodeScanner } from '@/ui/BarcodeScanner';
import { Button, Chip, ChipRow, Small, TextField } from '@/ui/components';

export interface DemoCode {
  label: string;
  code: string;
}

/**
 * Camera (native) or explainer (web) plus a typed fallback. Gloves, a torn label or a dead
 * camera never block the floor: every code the camera reads can also be typed.
 */
export function ScanPanel({
  onCode,
  continuous,
  demoCodes,
  submitLabel = 'Look up',
  busy,
  placeholder = 'Barcode or SKU',
}: {
  onCode: (code: string) => void;
  continuous?: boolean;
  demoCodes?: DemoCode[];
  submitLabel?: string;
  busy?: boolean;
  placeholder?: string;
}) {
  const [code, setCode] = useState('');
  const submit = () => {
    if (!code.trim()) return;
    onCode(code.trim());
    setCode('');
  };
  return (
    <View style={{ gap: 12 }}>
      <BarcodeScanner onCode={onCode} continuous={continuous} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Barcode or SKU"
            hideLabel
            icon="barcode-outline"
            value={code}
            onChangeText={setCode}
            placeholder={placeholder}
            autoCapitalize="characters"
            onSubmitEditing={submit}
            testID="code-input"
          />
        </View>
        <Button label={submitLabel} onPress={submit} disabled={!code.trim()} busy={busy} compact />
      </View>
      {demoCodes && demoCodes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Small>Demo barcodes, as if the camera read the label</Small>
          <ChipRow>
            {demoCodes.map((demo) => (
              <Chip
                key={demo.code}
                label={demo.label}
                sub={demo.code}
                selected={false}
                action
                accessibilityLabel={`Scan ${demo.label}`}
                onPress={() => onCode(demo.code)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </View>
  );
}
