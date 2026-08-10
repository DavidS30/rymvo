"use client";

import { useMemo } from "react";
import en from "@/dictionaries/en";
import es from "@/dictionaries/es";
import { LANG_COOKIE } from "@/lib/i18n-constants";
import type { Dictionary } from "@/dictionaries/types";

let cachedLang = "en";

export function useDictionary(): Dictionary {
  const lang = useMemo(() => {
    if (typeof window !== "undefined") {
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`));
      return match?.[1] === "es" ? "es" : "en";
    }
    return cachedLang;
  }, []);

  cachedLang = lang;
  return lang === "es" ? es : en;
}
