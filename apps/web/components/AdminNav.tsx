"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Reservas", "/admin/bookings"],
  ["Usuarios y roles", "/admin/users"],
  ["Conductores", "/admin/drivers"],
  ["Tarifas", "/admin/tariffs"],
  ["Reportes", "/admin/reports"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-1">{items.map(([label, href]) => <Link prefetch key={href} href={href} className={`flex shrink-0 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${pathname.startsWith(href) ? "bg-[#d9a84e] text-black shadow-[0_6px_18px_rgba(217,168,78,.18)]" : "text-white/55 hover:bg-white/10 hover:text-[#d9a84e]"}`}>{label}</Link>)}</nav>;
}
