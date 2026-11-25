import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { Chip, QtyStepper } from '@/ui/components';
import { ScanPanel } from '@/ui/ScanPanel';

jest.mock('@/ui/BarcodeScanner', () => ({
  BarcodeScanner: () => null,
}));

function Stepper({ max }: { max?: number }) {
  const [value, setValue] = useState(1);
  return <QtyStepper label="Quantity" value={value} onChange={setValue} min={1} max={max} />;
}

describe('QtyStepper', () => {
  it('steps, clamps typed values, and disables at the edges', async () => {
    await render(
      <ThemeProvider>
        <Stepper max={3} />
      </ThemeProvider>,
    );
    const input = await screen.findByLabelText('Quantity');
    expect(screen.getByRole('button', { name: 'Decrease Quantity' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    expect(input.props.value).toBe('2');
    await fireEvent.changeText(input, '12');
    expect(input.props.value).toBe('3');
    expect(screen.getByRole('button', { name: 'Increase Quantity' })).toBeDisabled();
    await fireEvent.changeText(input, 'abc');
    expect(input.props.value).toBe('1');
  });
});

describe('ScanPanel', () => {
  it('sends a typed code and a tapped demo barcode', async () => {
    const onCode = jest.fn();
    await render(
      <ThemeProvider>
        <ScanPanel onCode={onCode} demoCodes={[{ label: '12oz Kraft Bags', code: '840011000017' }]} />
      </ThemeProvider>,
    );
    const lookUp = await screen.findByRole('button', { name: 'Look up' });
    expect(lookUp).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Barcode or SKU'), '  nw-pk-12 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
    expect(onCode).toHaveBeenLastCalledWith('nw-pk-12');
    expect(screen.getByLabelText('Barcode or SKU').props.value).toBe('');
    await fireEvent.press(screen.getByRole('button', { name: 'Scan 12oz Kraft Bags' }));
    expect(onCode).toHaveBeenLastCalledWith('840011000017');
  });
});

describe('Chip', () => {
  it('is a radio when it is a choice and a button when it is an action', async () => {
    await render(
      <ThemeProvider>
        <Chip label="Pick Aisle" selected onPress={() => undefined} />
        <Chip label="Use Lena" selected={false} action onPress={() => undefined} />
      </ThemeProvider>,
    );
    expect(await screen.findByRole('radio', { name: 'Pick Aisle' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Use Lena' })).toBeTruthy();
  });
});
