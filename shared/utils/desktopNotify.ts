/**
 * desktopNotify — masaüstü (Web Notifications API) bildirim yardımcıları.
 *
 * ŞİMDİ sayacının otomatik duraklatma / devam / süre aşımı uyarılarını
 * tarayıcı dışına (masaüstüne) taşır. İzin verilmemişse sessizce no-op olur.
 */

const ICON = '/images/intibalogo.svg';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * İzni garanti altına al. Daha önce reddedilmişse tekrar sormaz (tarayıcı kuralı).
 * Sadece 'default' durumunda izin penceresi açılır.
 */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface ShowOptions extends NotificationOptions {
  focusOnClick?: boolean;   // tıklayınca pencereyi öne getir (default: true)
}

/**
 * Bildirim göster. İzin yoksa null döner.
 * Aynı `tag` ile gönderilen bildirimler birbirini değiştirir (yığılmaz).
 */
export function showDesktopNotification(
  title: string,
  options: ShowOptions = {}
): Notification | null {
  if (!notificationsSupported() || Notification.permission !== 'granted') return null;
  try {
    const { focusOnClick = true, ...rest } = options;
    const n = new Notification(title, { icon: ICON, ...rest });
    if (focusOnClick) {
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* no-op */
        }
        n.close();
      };
    }
    return n;
  } catch {
    return null;
  }
}
