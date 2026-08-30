import { storage } from "@/src/utils/storage";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BASE}/api/v1`;
export const TOKEN_KEY = "ironmind_token";
export const REFRESH_TOKEN_KEY = "ironmind_refresh_token";

export async function authHeaders(): Promise<Record<string, string>> {
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
    throw new Error(body?.error?.message || body?.detail || "Algo deu errado. Tente novamente.");
  }
  return body;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await storage.secureGet<string>(REFRESH_TOKEN_KEY, "");
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove(REFRESH_TOKEN_KEY);
    return false;
  }
  const tokens = await response.json();
  await storage.secureSet(TOKEN_KEY, tokens.access_token);
  await storage.secureSet(REFRESH_TOKEN_KEY, tokens.refresh_token);
  return true;
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<any> {
  const headers = { ...(init.headers || {}), ...(await authHeaders()) };
  let response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && path !== "/auth/refresh" && (await refreshAccessToken())) {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), ...(await authHeaders()) },
    });
  }
  return handle(response);
}

export const api = {
  async get(path: string) {
    return request(path);
  },
  async post(path: string, data?: any) {
    return request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  async put(path: string, data?: any) {
    return request(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  async del(path: string) {
    return request(path, { method: "DELETE" });
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
    return request(path, {
      method: "POST",
      body: form,
    });
  },
  async uploadFile(path: string, uri: string, fileName: string, mimeType: string, extra?: Record<string, string>) {
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, fileName);
    } else {
      form.append("file", { uri, name: fileName, type: mimeType } as any);
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        form.append(k, v);
      }
    }
    return request(path, {
      method: "POST",
      body: form,
    });
  },
  async patch(path: string, data?: any) {
    return request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  async uploadImage(path: string, uri: string, method: "POST" | "PUT" = "PUT") {
    const form = new FormData();
    const name = `image_${Date.now()}.jpg`;
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type: "image/jpeg" } as any);
    }
    return request(path, { method, body: form });
  },
};

export function fileUrl(photoPath: string): string {
  // photoPath is a versioned, authenticated API path.
  return `${BASE}${photoPath}`;
}
