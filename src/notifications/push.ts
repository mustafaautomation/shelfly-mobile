import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface PushRegistration {
  token: string;
  mode: 'device' | 'simulated';
  detail: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(): Promise<PushRegistration> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('low-stock', { name: 'Low stock', importance: 4 });
  }
  if (!Device.isDevice) {
    return {
      token: 'ExponentPushToken[simulator]',
      mode: 'simulated',
      detail: 'This simulator shows low-stock alerts as local notifications. A phone registers with Expo push.',
    };
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (granted.status !== 'granted') {
    return {
      token: 'ExponentPushToken[permission-denied]',
      mode: 'simulated',
      detail: 'Notifications are off for Shelfly in Settings. Alerts still collect in the Alerts tab.',
    };
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return { token: token.data, mode: 'device', detail: 'This phone gets a push when a SKU drops to its reorder point.' };
  } catch {
    return {
      token: 'ExponentPushToken[local]',
      mode: 'simulated',
      detail: 'Expo could not issue a push token here (no EAS project yet). Low-stock alerts still show as local notifications.',
    };
  }
}

/** Shows a local notification. Tapping it opens `url` inside Shelfly. */
export async function presentLocalAlert(title: string, body: string, url?: string): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: url ? { url } : {} }, trigger: null });
    return true;
  } catch {
    return false;
  }
}

/** Routes taps on Shelfly notifications to the screen named in `data.url`. Returns an unsubscribe. */
export function startNotificationRouting(open: (url: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) open(url);
  });
  return () => subscription.remove();
}
