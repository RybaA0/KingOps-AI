import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, AppState, View } from "react-native";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./src/auth";
import AuthScreen from "./src/screens/AuthScreen";
import Tabs from "./src/Tabs";
import { registerForPush } from "./src/push";
import { C } from "./src/theme";

function Root() {
  const { ready, user } = useAuth();
  const badge = useRef(0);
  useEffect(() => { if (user) registerForPush(); }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps
  // App-icon badge: +1 for each notification received, cleared whenever the app is opened/foregrounded.
  useEffect(() => {
    const clear = () => { badge.current = 0; Notifications.setBadgeCountAsync(0).catch(() => {}); };
    const recv = Notifications.addNotificationReceivedListener(() => { badge.current += 1; Notifications.setBadgeCountAsync(badge.current).catch(() => {}); });
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active") clear(); });
    clear();
    return () => { recv.remove(); appSub.remove(); };
  }, []);
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }
  return user ? <Tabs /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}
