import { storage } from "@/src/utils/storage";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BASE}/api`;
export const TOKEN_KEY = "ironmind_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res: Response) {
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { detail: text };
  }
  if (!res.ok) {
    throw new Error(body?.detail || "Algo deu errado. Tente novamente.");
  }
  return body;
}

export const api = {
  async get(path: string) {
    const res = await fetch(`${API_URL}${path}`, { headers: { ...(await authHeaders()) } });
    return handle(res);
  },
  async post(path: string, data?: any) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handle(res);
  },
  async put(path: string, data?: any) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handle(res);
  },
  async del(path: string) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: { ...(await authHeaders()) },
    });
    return handle(res);
  },
  async uploadPhoto(path: string, uri: string, mealType: string) {
    const form = new FormData();
    const name = `meal_${Date.now()}.jpg`;
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type: "image/jpeg" } as any);
    }
    form.append("meal_type", mealType);
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { ...(await authHeaders()) },
      body: form,
    });
    return handle(res);
  },
};

export function fileUrl(photoPath: string): string {
  // photoPath already like /api/files/....
  return `${BASE}${photoPath}`;
}
