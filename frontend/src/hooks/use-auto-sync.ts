import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

import { api } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

const LAST_SYNC_KEY = "ironmind_last_intervals_sync";
// O intervals.icu atualiza os dados do relógio ~1x/dia, então não faz sentido
// puxar a cada abertura. 4h cobre o "abriu de manhã / abriu à noite" sem excesso.
const THROTTLE_MS = 4 * 60 * 60 * 1000;

/**
 * Sincroniza treinos + wellness do intervals.icu automaticamente ao abrir o app
 * (e ao voltar do background), quando o usuário está logado. É best-effort e
 * throttled: se o intervals não estiver conectado, o backend responde 4xx e a
 * falha é ignorada em silêncio. Não bloqueia nenhuma tela — roda em segundo plano.
 */
export function useAutoSync(isLoggedIn: boolean) {
  const running = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    const maybeSync = async () => {
      if (running.current) return;
      const last = (await storage.getItem<number>(LAST_SYNC_KEY, 0)) ?? 0;
      if (Date.now() - last < THROTTLE_MS) return;

      running.current = true;
      // Marca antes de começar para não disparar várias vezes se o app for
      // ativado em sequência; em caso de falha o throttle apenas adia a próxima.
      await storage.setItem(LAST_SYNC_KEY, Date.now());
      try {
        await api.post("/intervals/sync");
        try { await api.post("/intervals/sync-wellness?days=30"); } catch {}
      } catch {
        // intervals não conectado ou indisponível — ignora.
      } finally {
        running.current = false;
      }
    };

    // Ao abrir o app.
    maybeSync();

    // Ao voltar do background para primeiro plano.
    const onChange = (state: AppStateStatus) => {
      if (state === "active") maybeSync();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [isLoggedIn]);
}
