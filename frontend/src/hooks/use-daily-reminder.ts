import { useEffect } from "react";
import * as Notifications from "expo-notifications";

// Notificação local matinal ("resumo do dia"). Diferente do push remoto
// (Celery/Expo), esta é agendada no próprio dispositivo — funciona offline e
// dispara mesmo com o app fechado, sem depender do backend.
const REMINDER_ID = "ironmind-daily-reminder";
const HOUR = 7;
const MINUTE = 30;

const MESSAGES = [
  "Bom dia! Vamos fechar mais um dia de disciplina? 🔥",
  "Novo dia, nova chance de não quebrar a corrente. 💪",
  "Comandante na área: cheque sua prontidão e o foco de hoje.",
  "Hidratação, movimento e sono. Bora manter o ritmo. 🏃",
  "Consistência vence talento. Comece pelo próximo pequeno passo.",
];

/**
 * Agenda (idempotente) um lembrete local diário quando o usuário está logado.
 * Reagenda a cada login para garantir uma única entrada. Silencioso se a
 * permissão não estiver concedida (o registro de permissão vive no
 * use-push-registration).
 */
export function useDailyReminder(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== "granted") return; // sem permissão: não agenda

        // Evita duplicatas: remove o lembrete anterior (se houver) antes.
        await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
        if (cancelled) return;

        const body = MESSAGES[new Date().getDate() % MESSAGES.length];
        await Notifications.scheduleNotificationAsync({
          identifier: REMINDER_ID,
          content: {
            title: "IronMind 360",
            body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: HOUR,
            minute: MINUTE,
          },
        });
      } catch {
        // Expo Go pode limitar agendamento; ignora silenciosamente.
      }
    })();

    return () => { cancelled = true; };
  }, [isLoggedIn]);
}
