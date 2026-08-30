jest.mock("@/src/utils/storage", () => ({
  storage: {
    secureGet: jest.fn(async () => "tok"),
    secureSet: jest.fn(async () => undefined),
    secureRemove: jest.fn(async () => undefined),
  },
}));

import { api, setAuthLostHandler } from "@/src/lib/api";

function jsonRes(body: any, ok = true, status = 200) {
  return { ok, status, text: async () => JSON.stringify(body), json: async () => body };
}

describe("api client", () => {
  afterEach(() => {
    setAuthLostHandler(null);
    jest.clearAllMocks();
  });

  it("no 401 tenta refresh e refaz a requisição", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" }) // GET inicial
      .mockResolvedValueOnce(jsonRes({ access_token: "a", refresh_token: "b" })) // refresh
      .mockResolvedValueOnce(jsonRes({ ok: true })); // retry
    (global as any).fetch = fetchMock;

    const res = await api.get("/x");
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("dispara authLost quando o refresh falha", async () => {
    const handler = jest.fn();
    setAuthLostHandler(handler);
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" }) // GET
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" }); // refresh falha

    await expect(api.get("/y")).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
