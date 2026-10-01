import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { NotificationSettings } from '../../types';

// 只取型別，不在載入此檔時執行 expo-notifications
type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications@57.x 在 Android 的 Expo Go 裡「一 import 就丟錯」，App 會直接紅畫面
 * （expo/expo#49044，58.x 才修好）。所以改成延遲載入，並在不支援的環境直接略過：
 * Android Expo Go 上不排程提醒，iOS Expo Go 與正式 build 不受影響。
 */
const unsupported = Platform.OS === 'web' || (Platform.OS === 'android' && isRunningInExpoGo());

let modulePromise: Promise<NotificationsModule> | null = null;

function getNotifications(): Promise<NotificationsModule | null> {
  if (unsupported) return Promise.resolve(null);
  if (!modulePromise) {
    modulePromise = import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      return Notifications;
    });
  }
  return modulePromise;
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeightReminder(hour: number, minute: number): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync('weight-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'weight-reminder',
    content: {
      title: '⚖️ 記錄今日體重',
      body: '每天量測體重，讓 AI 分析更準確！',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelWeightReminder(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync('weight-reminder').catch(() => {});
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export async function scheduleWorkoutReminders(
  days: number[],
  hour: number,
  minute: number
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  // Cancel existing workout reminders
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith('workout-reminder-')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }

  for (const day of days) {
    await Notifications.scheduleNotificationAsync({
      identifier: `workout-reminder-${day}`,
      content: {
        title: '💪 今天是訓練日！',
        body: `星期${DAY_LABELS[day]} 的訓練等你來完成！`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1, // expo: 1=Sun ... 7=Sat
        hour,
        minute,
      },
    });
  }
}

export async function cancelWorkoutReminders(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith('workout-reminder-')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
  }
}

export async function rescheduleAll(settings: NotificationSettings): Promise<void> {
  if (settings.weightReminderEnabled) {
    await scheduleWeightReminder(settings.weightReminderHour, settings.weightReminderMinute);
  } else {
    await cancelWeightReminder();
  }

  if (settings.workoutReminderEnabled && settings.workoutReminderDays.length > 0) {
    await scheduleWorkoutReminders(
      settings.workoutReminderDays,
      settings.workoutReminderHour,
      settings.workoutReminderMinute
    );
  } else {
    await cancelWorkoutReminders();
  }
}
