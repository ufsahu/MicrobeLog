import { describe, expect, it } from "vitest";
import { firstIsolates, resistanceFor, quantityZone, type Isolate } from "@/lib/data";

const iso = (p: number, t: number, sus: string, org = 0, spec = 0, year = 2025) => ({ p, t, no: 1, org, spec, year, sus }) as unknown as Isolate;

describe("surveillance rules", () => {
  it("keeps only the first isolate per patient/species/specimen/period", () => {
    const l = [iso(1, 2, "S"), iso(1, 1, "R"), iso(1, 3, "S", 0, 1), iso(2, 1, "S")];
    const f = firstIsolates(l, (i) => i.year);
    expect(f.length).toBe(3);
    expect(f.find((i) => i.p === 1 && i.spec === 0)!.sus).toBe("R");
  });
  it("hides the percentage below 30 isolates", () => {
    expect(resistanceFor(Array.from({ length: 29 }, (_, i) => iso(i, 1, "R")), 0).pct).toBeNull();
    expect(resistanceFor([...Array.from({ length: 15 }, (_, i) => iso(i, 1, "R")), ...Array.from({ length: 15 }, (_, i) => iso(i, 1, "S"))], 0).pct).toBe(50);
  });
  it("assigns quantity zones", () => {
    expect(quantityZone(">=10^5", 0)).toBe("high");
    expect(quantityZone("10^4", 0)).toBe("mid");
    expect(quantityZone("10^3", 0)).toBe("low");
    expect(quantityZone("+++", 2)).toBe("high");
    expect(quantityZone("", 1)).toBe("high");
  });
});
