"use client";

import { useState, useEffect } from "react";
import { LANG_COOKIE, LANGS } from "@/lib/i18n-constants";

const LABELS: Record<string, string> = { en: "EN", es: "ES" };

export function LanguageToggle() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`));
    const current = match?.[1];
    if (current === "es" || current === "en") setLang(current);
  }, []);

  const cycle = () => {
    const idx = LANGS.indexOf(lang as typeof LANGS[number]);
    const next = LANGS[(idx + 1) % LANGS.length];
    document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    setLang(next);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            if (l !== lang) {
              document.cookie = `${LANG_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
              setLang(l);
              window.location.reload();
            }
          }}
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] transition-all ${
            l === lang
              ? "bg-[#d9a84e] text-black shadow-[0_2px_8px_rgba(217,168,78,.35)]"
              : "text-white/45 hover:text-white/80"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
