import { cookies } from "next/headers";
import en from "@/dictionaries/en";
import es from "@/dictionaries/es";
import { LANG_COOKIE } from "@/lib/i18n-constants";

export type { Dictionary } from "@/dictionaries/types";

export async function getLangCookie(): Promise<string> {
  const cookieStore = await cookies();
  const lang = cookieStore.get(LANG_COOKIE)?.value;
  return lang === "es" ? "es" : "en";
}

export function getDictionary(lang: string) {
  return lang === "es" ? es : en;
}

export async function getDict() {
  return getDictionary(await getLangCookie());
}
