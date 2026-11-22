import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, AppState, View } from "react-native";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./src/auth";
import AuthScreen from "./src/screens/AuthScreen";
import Tabs from "./src/Tabs";
import { registerForPush } from "./src/push";
import { initPrefs, usePrefs } from "./src/store";
import { ThemeProvider, useTheme } from "./src/theme";

function Root() {
  const { ready, user } = useAuth();
  const { c, dark } = useTheme();
  const { notifications } = usePrefs();
  const badge = useRef(0);

  useEffect(() => { if (user && notifications) registerForPush(); }, [user?.email, notifications]); // eslint-disable-line react-hooks/exhaustive-deps

  // App-icon badge: +1 for each notification received, cleared whenever the app is opened/foregrounded.
  useEffect(() => {
    const clear = () => { badge.current = 0; Notifications.setBadgeCountAsync(0).catch(() => {}); };
    const recv = Notifications.addNotificationReceivedListener(() => { badge.current += 1; Notifications.setBadgeCountAsync(badge.current).catch(() => {}); });
    const appSub = AppState.addEventListener("change", (st) => { if (st === "active") clear(); });
    clear();
    return () => { recv.remove(); appSub.remove(); };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      {user ? <Tabs /> : <AuthScreen />}
    </>
  );
}

export default function App() {
  useEffect(() => { initPrefs(); }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  );
}
