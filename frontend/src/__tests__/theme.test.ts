import { themes, spacing, radius, controlHeight, type } from "@/src/theme";

describe("theme tokens", () => {
  it("dark e light têm os tokens principais", () => {
    (["dark", "light"] as const).forEach((mode) => {
      const c = themes[mode] as Record<string, string>;
      [
        "bg", "surface", "elevated", "text", "textSecondary", "border",
        "accent", "accentMuted", "onAccent",
        "successMuted", "warningMuted", "errorMuted",
        "macroProtein", "macroCarbs", "macroFat",
      ].forEach((key) => {
        expect(c[key]).toBeTruthy();
      });
    });
  });

  it("escalas de spacing/radius/controlHeight", () => {
    expect(spacing.xl).toBe(20);
    expect(radius.card).toBe(20);
    expect(radius.cardLarge).toBe(24);
    expect(radius.hero).toBe(28);
    expect(controlHeight).toBe(56);
  });

  it("tipografia tem tamanhos base", () => {
    expect(type.body.fontSize).toBeGreaterThan(0);
    expect(type.caption.fontSize).toBeGreaterThan(0);
  });
});
