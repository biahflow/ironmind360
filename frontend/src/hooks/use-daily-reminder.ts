import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import { api } from "@/src/lib/api";

// Notificação local matinal ("resumo do dia"). Diferente do push remoto
// (Celery/Expo), esta é agendada no próprio dispositivo — funciona offline e
// dispara mesmo com o app fechado, sem depender do backend.
//
// Como é agendada com antecedência, o conteúdo reflete o estado mais recente
// conhecido (última vez que o app foi aberto). Reagenda a cada abertura para
// manter o resumo atualizado.
const REMINDER_ID = "ironmind-daily-reminder";
const HOUR = 7;
const MINUTE = 30;

const FALLBACK = [
  "Bom dia! Vamos fechar mais um dia de disciplina? 🔥",
  "Novo dia, nova chance de não quebrar a corrente. 💪",
  "Consistência vence talento. Comece pelo próximo pequeno passo.",
];

// Monta o corpo do resumo a partir do estado atual (prontidão, combustível do
// dia e próxima prova). Best-effort: qualquer falha cai no fallback.
async function buildBriefing(): Promise<string> {
  const bits: string[] = [];
  try {
    const [dash, fuel, raceList] = await Promise.all([
      api.get("/dashboard").catch(() => null),
      api.get("/nutrition/today-target").catch(() => null),
      api.get("/races").catch(() => null),
    ]);

    const rd = dash?.readiness;
    if (rd?.score != null) {
      const level = rd.level === "green" ? "alta" : rd.level === "yellow" ? "moderada" : "baixa";
      bits.push(`Prontidão ${Math.round(rd.score)}/100 (${level})`);
    }

    if (fuel?.context === "race") bits.push("dia de prova — carbo e hidratação");
    else if (fuel?.context === "training") bits.push("dia de treino — capriche no carbo");
    else if (fuel?.context === "recovery") bits.push("dia de recuperação — proteína e sono");

    const races: any[] = Array.isArray(raceList) ? raceList : raceList?.races || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = races
      .map((r) => ({ r, days: Math.ceil((new Date(String(r.date) + "T00:00:00").getTime() - today.getTime()) / 86400000) }))
      .filter((x) => x.days >= 0 && !isNaN(x.days))
      .sort((a, b) => a.days - b.days);
    const target = upcoming.find((x) => x.r.priority === "A") || upcoming[0];
    if (target && target.days <= 30) {
      bits.push(target.days === 0 ? "é hoje a prova! 🏁" : `faltam ${target.days} dias pra prova`);
    }
  } catch {
    // ignora — usa fallback abaixo
  }

  if (bits.length === 0) {
    return FALLBACK[new Date().getDate() % FALLBACK.length];
  }
  return `Bom dia! ${bits.join(" · ")}.`;
}

/**
 * Agenda (idempotente) um lembrete local diário quando o usuário está logado.
 * Reagenda a cada login para atualizar o resumo. Silencioso se a permissão não
 * estiver concedida (o registro de permissão vive no use-push-registration).
 */
export function useDailyReminder(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== "granted") return; // sem permissão: não agenda

        const body = await buildBriefing();
        if (cancelled) return;

        // Evita duplicatas: remove o lembrete anterior antes de reagendar.
        await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
        if (cancelled) return;

        await Notifications.scheduleNotificationAsync({
          identifier: REMINDER_ID,
          content: { title: "IronMind 360", body, sound: true },
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
