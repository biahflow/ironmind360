import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { API_URL, authHeaders } from "@/src/lib/api";

/**
 * Baixa o relatório PDF do backend (autenticado) e abre o compartilhamento
 * nativo. Na web, abre o PDF em nova aba.
 */
export async function exportReportPdf(days = 28): Promise<void> {
  const headers = await authHeaders();
  const url = `${API_URL}/reports/pdf?days=${days}`;

  if (Platform.OS === "web") {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Falha ao gerar o relatório.");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    if (typeof window !== "undefined") window.open(href, "_blank");
    return;
  }

  const dest = `${FileSystem.cacheDirectory}ironmind360_relatorio_${days}d.pdf`;
  const out = await FileSystem.downloadAsync(url, dest, { headers });
  if (out.status !== 200) throw new Error("Falha ao gerar o relatório.");

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Relatório IronMind 360",
      UTI: "com.adobe.pdf",
    });
  }
}
