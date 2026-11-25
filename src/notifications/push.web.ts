export interface PushRegistration {
  token: string;
  mode: 'device' | 'simulated';
  detail: string;
}

export async function registerForPush(): Promise<PushRegistration> {
  return {
    token: 'ExponentPushToken[web-preview]',
    mode: 'simulated',
    detail: 'The web preview keeps low-stock alerts in the Alerts tab. The phone app adds push notifications.',
  };
}

export async function presentLocalAlert(_title: string, _body: string, _url?: string): Promise<boolean> {
  return false;
}

export function startNotificationRouting(_open: (url: string) => void): () => void {
  return () => undefined;
}
