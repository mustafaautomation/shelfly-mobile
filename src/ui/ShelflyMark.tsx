import Svg, { Path, Rect } from 'react-native-svg';

import { brand } from '@/theme/tokens';

/** The Shelfly mark from the web app's app/icon.svg: three shelf boards and two copper uprights. */
export function ShelflyMark({ size = 40, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Shelfly">
      {tile ? <Rect width={32} height={32} rx={8} fill={brand.forest} /> : null}
      <Path d="M7 11h18M7 16h18M7 21h18" stroke={brand.paper} strokeWidth={1.6} />
      <Path d="M11 11v10M21 11v10" stroke={brand.copper} strokeWidth={1.6} />
    </Svg>
  );
}
