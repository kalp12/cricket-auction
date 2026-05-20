const ENABLED_KEY = 'auction_notifications'

export function isNotificationSupported(): boolean {
  return 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function areNotificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')
}

export async function notify(title: string, body: string, tag?: string) {
  if (!areNotificationsEnabled()) return
  if (getNotificationPermission() !== 'granted') return
  if (document.hasFocus()) return // skip if user is already viewing

  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag,
  })
  n.onclick = () => {
    window.focus()
    n.close()
  }
}
