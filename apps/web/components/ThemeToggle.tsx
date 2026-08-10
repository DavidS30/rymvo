"use client";

import { useEffect, useState } from "react";
import { useDictionary } from "@/lib/useDictionary";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  const dict = useDictionary();

  useEffect(() => {
    const saved = window.localStorage.getItem("rymvo-theme");
    const isLight = saved === "light";
    document.documentElement.dataset.theme = isLight ? "light" : "dark";
    setLight(isLight);
  }, []);

  const toggle = () => {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("rymvo-theme", next);
    setLight(!light);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? dict.theme.dark : dict.theme.light}
      className="rymvo-theme-toggle"
    >
      <span aria-hidden="true">{light ? "☾" : "☼"}</span>
      <span className="hidden sm:inline">{light ? dict.theme.dark : dict.theme.light}</span>
    </button>
  );
}
