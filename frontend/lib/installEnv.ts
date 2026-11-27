// Where an invite link was opened, to say how to install the app (pure: the page passes navigator / matchMedia in)
export type InstallEnv = "installed" | "inApp" | "ios" | "android" | "desktop";

// Messengers and social apps open links in their own browser, which can't install a web app
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Viber|Telegram|TikTok|Snapchat|; wv\)/i;

export function installEnv(userAgent: string, standalone: boolean, touchPoints = 0): InstallEnv {
  if (standalone) return "installed";
  if (IN_APP.test(userAgent)) return "inApp";
  // iPadOS reports itself as a Mac with touch
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
