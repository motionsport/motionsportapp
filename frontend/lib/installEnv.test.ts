import { describe, expect, it } from "vitest";
import { installEnv } from "./installEnv";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

describe("installEnv", () => {
  it("opened from the home screen icon: installed", () => {
    expect(installEnv(IPHONE, true)).toBe("installed");
  });
  it("iPhone Safari and Android Chrome", () => {
    expect(installEnv(IPHONE, false)).toBe("ios");
    expect(installEnv(ANDROID, false)).toBe("android");
  });
  it("a messenger's own browser can't install", () => {
    expect(installEnv(`${IPHONE} Instagram 312.0`, false)).toBe("inApp");
    expect(installEnv(`${ANDROID} Viber/22.0`, false)).toBe("inApp");
    expect(installEnv(ANDROID.replace("Pixel 8)", "Pixel 8; wv)"), false)).toBe("inApp");
  });
  it("a computer; an iPad says Mac but has touch", () => {
    expect(installEnv(MAC, false)).toBe("desktop");
    expect(installEnv(MAC, false, 5)).toBe("ios");
  });
});
