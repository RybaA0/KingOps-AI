import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "./api";

// Show notifications while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks for permission, gets the Expo push token and registers it with the backend. Safe to call repeatedly; never throws. */
export async function registerForPush(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    // Without an EAS projectId (before `eas init`) this throws on a build — ignored.
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (res?.data) await registerPushToken(res.data, Platform.OS);
  } catch {
    /* no device / no projectId / simulator — push just stays off */
  }
}
