import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { api } from "@/src/lib/api";

// Como as notificações aparecem com o app em primeiro plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registra o token de push do dispositivo no backend quando o usuário está
 * logado. O backend (Celery) usa esse token para enviar lembretes conforme as
 * preferências de notificação.
 *
 * Observação: push remoto NÃO funciona no Expo Go (SDK 53+). Em Expo Go a
 * obtenção do token falha silenciosamente; funciona em dev/production build.
 */
export function usePushRegistration(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted") return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenResponse.data;
        if (cancelled || !token) return;

        const platform = Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios";
        await api.post("/push-token", { token, platform });
      } catch {
        // Silencioso: Expo Go não suporta push remoto; ignora.
      }
    })();

    return () => { cancelled = true; };
  }, [isLoggedIn]);
}
