import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lockedReason } from '@/domain/access';
import { initials } from '@/domain/format';
import type { SeatRole } from '@/domain/model';
import { stockLevelRatio } from '@/domain/stock';
import { useShelflyTheme } from '@/theme/ThemeProvider';
import { toneColors, type Tone } from '@/theme/tokens';
import type { AsyncState } from '@/ui/useAsync';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function useWide(): boolean {
  return useWindowDimensions().width >= 960;
}

export function Screen({
  children,
  footer,
  scroll = true,
  testID,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const { colors } = useShelflyTheme();
  const { online, stale, actor } = useWorkspace();
  const insets = useSafeAreaInsets();
  const wide = useWide() && Boolean(actor);
  const banner = !online
    ? 'You are offline. Shelfly is showing the last saved copy of these shelves. Stock changes wait for a connection.'
    : stale
      ? 'Showing the last saved copy. The live books did not answer.'
      : null;
  const body = (
    <View style={[styles.column, { paddingBottom: footer ? 16 : insets.bottom + 32 }]}>
      {banner ? <Notice tone="warn">{banner}</Notice> : null}
      {children}
    </View>
  );
  return (
    <View testID={testID} style={[styles.fill, { backgroundColor: colors.bg, paddingLeft: wide ? 248 : 0 }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>{body}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function goBack(fallback = '/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function StackHeader({ title, subtitle, right, fallback }: { title: string; subtitle?: string; right?: ReactNode; fallback?: string }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => goBack(fallback)}
        hitSlop={8}
        style={({ pressed }) => [styles.back, { borderColor: colors.line, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </Pressable>
      <View style={styles.fill}>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.ink, fontFamily: fontFamily?.semibold }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.headerSub, { color: colors.muted, fontFamily: fontFamily?.body }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Eyebrow({ children, color }: { children: string; color?: string }) {
  const { colors, fontFamily } = useShelflyTheme();
  return <Text style={[styles.eyebrow, { color: color ?? colors.primary, fontFamily: fontFamily?.semibold }]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: colors.ink, fontFamily: fontFamily?.display }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = true, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { colors, fontFamily } = useShelflyTheme();
  return <Text style={[styles.body, { color: muted ? colors.muted : colors.ink, fontFamily: fontFamily?.body }, style]}>{children}</Text>;
}

export function Label({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.label, { color: colors.ink, fontFamily: fontFamily?.semibold }, style]}>
      {children}
    </Text>
  );
}

export function Small({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.small, { color: colors.muted, fontFamily: fontFamily?.body }, style]}>
      {children}
    </Text>
  );
}

export function Code({ children }: { children: ReactNode }) {
  const { colors } = useShelflyTheme();
  return <Text style={[styles.code, { color: colors.muted }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  testID,
  accessibilityLabel,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'forest';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  const palette = {
    primary: { bg: colors.primaryFill, fg: colors.onPrimary, border: colors.primaryFill },
    forest: { bg: colors.forest, fg: colors.onForest, border: colors.forest },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 16 : 18} color={palette.fg} />
      ) : null}
      <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.fg, fontFamily: fontFamily?.semibold }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  testID?: string;
}) {
  const { colors } = useShelflyTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      onPress={onPress}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primaryFill }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  multiline = false,
  autoCapitalize = 'none',
  keyboardType,
  onSubmitEditing,
  testID,
  autoFocus,
  hideLabel = false,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions;
  onSubmitEditing?: () => void;
  testID?: string;
  autoFocus?: boolean;
  hideLabel?: boolean;
  icon?: IconName;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={styles.field}>
      {hideLabel ? null : <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily?.semibold }]}>{label}</Text>}
      <View style={[styles.inputWrap, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.faint} style={{ marginLeft: 14 }} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          secureTextEntry={secure}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          returnKeyType={onSubmitEditing ? 'go' : undefined}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
          testID={testID}
          style={[styles.input, multiline && styles.multiline, { color: colors.ink, fontFamily: fontFamily?.body }]}
        />
      </View>
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors, fontFamily } = useShelflyTheme();
  const palette = toneColors(colors, tone);
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={palette.fg} /> : null}
      <Text numberOfLines={1} style={[styles.pillText, { color: palette.fg, fontFamily: fontFamily?.semibold }]}>
        {label}
      </Text>
    </View>
  );
}

export function Card({
  children,
  onPress,
  testID,
  label,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useShelflyTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style];
  if (!onPress)
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [...base, pressed && { opacity: 0.88 }]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[styles.section, { color: colors.ink, fontFamily: fontFamily?.display }]}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary, fontFamily: fontFamily?.semibold }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  const { colors } = useShelflyTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Small>{label}</Small>
    </View>
  );
}

export function EmptyBlock({
  title,
  body,
  icon = 'file-tray-outline',
  action,
}: {
  title: string;
  body: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}>
        <Ionicons name={icon} size={22} color={colors.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.ink, fontFamily: fontFamily?.display }]}>{title}</Text>
      <Body>{body}</Body>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} compact /> : null}
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyBlock icon="cloud-offline-outline" title="This did not open" body={message} action={{ label: 'Try again', onPress: onRetry }} />;
}

export function QueryState<T>({
  query,
  loading,
  empty,
  isEmpty,
  children,
}: {
  query: AsyncState<T>;
  loading: string;
  empty?: { title: string; body: string; icon?: IconName };
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  // Keep showing the previous data while a refresh after a write is in flight.
  if (query.status === 'loading' && query.data === undefined) return <LoadingBlock label={loading} />;
  if (query.status === 'error' || query.data === undefined) {
    return <ErrorBlock message={query.error?.message ?? 'Try again in a moment.'} onRetry={query.reload} />;
  }
  if (empty && isEmpty?.(query.data)) return <EmptyBlock title={empty.title} body={empty.body} icon={empty.icon} />;
  return <>{children(query.data)}</>;
}

export function Notice({ children, tone = 'primary', icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  const { colors, fontFamily } = useShelflyTheme();
  const palette = toneColors(colors, tone);
  const glyph: IconName =
    icon ?? (tone === 'good' ? 'checkmark-circle' : tone === 'danger' ? 'alert-circle' : tone === 'warn' ? 'warning' : 'information-circle');
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'text'} style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Ionicons name={glyph} size={18} color={palette.fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText, { color: tone === 'neutral' ? colors.ink : palette.fg, fontFamily: fontFamily?.medium }]}>{children}</Text>
    </View>
  );
}

export function LockedNote({ role }: { role: SeatRole | null | undefined }) {
  return (
    <Notice tone="neutral" icon="lock-closed">
      {lockedReason(role)}
    </Notice>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }]}
          >
            <Text style={[styles.segmentText, { color: selected ? colors.ink : colors.muted, fontFamily: fontFamily?.semibold }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  sub,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  action = false,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  /** An action chip (a demo barcode) is a button; a choice chip is a radio. */
  action?: boolean;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <Pressable
      accessibilityRole={action ? 'button' : 'radio'}
      accessibilityLabel={accessibilityLabel ?? (sub ? `${label}, ${sub}` : label)}
      accessibilityState={action ? undefined : { selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.forest : colors.surface,
          borderColor: selected ? colors.forest : colors.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onForest : colors.ink, fontFamily: fontFamily?.semibold }]}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, { color: selected ? colors.onForest : colors.muted, fontFamily: fontFamily?.body }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max,
  label,
  testID,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  testID?: string;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  const clamp = (next: number) => Math.max(min, max === undefined ? next : Math.min(max, next));
  const step = (delta: number) => onChange(clamp(value + delta));
  return (
    <View style={[styles.stepper, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityState={{ disabled: value <= min }}
        disabled={value <= min}
        onPress={() => step(-1)}
        style={[styles.stepButton, { opacity: value <= min ? 0.35 : 1 }]}
      >
        <Ionicons name="remove" size={20} color={colors.ink} />
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        value={String(value)}
        keyboardType="number-pad"
        selectTextOnFocus
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '');
          onChange(clamp(digits ? Number(digits) : 0));
        }}
        style={[styles.stepValue, { color: colors.ink, fontFamily: fontFamily?.semibold }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityState={{ disabled: max !== undefined && value >= max }}
        disabled={max !== undefined && value >= max}
        onPress={() => step(1)}
        style={[styles.stepButton, { opacity: max !== undefined && value >= max ? 0.35 : 1 }]}
      >
        <Ionicons name="add" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export function ProgressBar({ value, tone = 'forest', label }: { value: number; tone?: 'forest' | 'primary' | 'danger' | 'good'; label?: string }) {
  const { colors } = useShelflyTheme();
  const fill = { forest: colors.forest, primary: colors.primaryFill, danger: colors.danger, good: colors.good }[tone];
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { backgroundColor: colors.surface2 }]}
    >
      <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: fill }]} />
    </View>
  );
}

export function StockBar({ onHand, reorderPoint }: { onHand: number; reorderPoint: number }) {
  const { colors } = useShelflyTheme();
  const low = onHand <= reorderPoint;
  return (
    <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
      <View style={[styles.trackFill, { width: `${Math.round(stockLevelRatio(onHand, reorderPoint) * 100)}%`, backgroundColor: low ? colors.danger : colors.forest }]} />
      <View style={[styles.reorderTick, { backgroundColor: colors.muted }]} />
    </View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onPress,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
  icon: IconName;
}) {
  const { colors, fontFamily } = useShelflyTheme();
  const palette = toneColors(colors, tone);
  const content = (
    <>
      <View style={[styles.statIcon, { backgroundColor: palette.bg }]}>
        <Ionicons name={icon} size={16} color={palette.fg} />
      </View>
      <Text style={[styles.statValue, { color: colors.ink, fontFamily: fontFamily?.display }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.muted, fontFamily: fontFamily?.medium }]} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Small numberOfLines={1}>{hint}</Small> : null}
    </>
  );
  const style = [styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.88 }]}>
      {content}
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  leading,
  onPress,
  label,
  testID,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  leading?: ReactNode;
  onPress?: () => void;
  label?: string;
  testID?: string;
  children?: ReactNode;
}) {
  const { colors } = useShelflyTheme();
  const inner = (
    <View style={styles.rowInner}>
      {leading}
      <View style={[styles.fill, { gap: 3 }]}>
        <Label numberOfLines={2}>{title}</Label>
        {subtitle ? <Small numberOfLines={2}>{subtitle}</Small> : null}
        {children}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null}
    </View>
  );
  const style = [styles.row, { borderBottomColor: colors.line }];
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [...style, pressed && { backgroundColor: colors.surface2 }]}
    >
      {inner}
    </Pressable>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  const { colors } = useShelflyTheme();
  return <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors, fontFamily } = useShelflyTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.onForest, fontFamily: fontFamily?.semibold, fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Qty({ value, unit, tone }: { value: string; unit?: string; tone?: 'danger' | 'good' }) {
  const { colors, fontFamily } = useShelflyTheme();
  const color = tone === 'danger' ? colors.danger : tone === 'good' ? colors.good : colors.ink;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ color, fontFamily: fontFamily?.semibold, fontSize: 17, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {unit ? <Small>{unit}</Small> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, gap: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 12 },
  footerInner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18 },
  headerSub: { fontSize: 13, marginTop: 1 },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 34, lineHeight: 40 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 16, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  code: { fontFamily: 'Menlo', fontSize: 13, letterSpacing: 0.3 },
  button: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonCompact: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, alignSelf: 'flex-start' },
  buttonText: { fontSize: 16 },
  buttonTextCompact: { fontSize: 14 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { fontSize: 12, letterSpacing: 0.2 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  section: { fontSize: 22 },
  sectionAction: { fontSize: 14 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 10 },
  empty: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 8, alignItems: 'flex-start' },
  emptyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, lineHeight: 28 },
  notice: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 14 },
  chipSub: { fontSize: 12, marginTop: 1 },
  chipRow: { gap: 8, paddingRight: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, alignSelf: 'flex-start' },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepValue: { width: 76, height: 48, textAlign: 'center', fontSize: 20, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', width: '100%' },
  trackFill: { height: '100%', borderRadius: 3 },
  reorderTick: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, opacity: 0.5 },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13 },
  listCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
