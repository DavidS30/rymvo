import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AdminNav } from "@/components/AdminNav";

async function AdminGate({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="rymvo-shell flex min-h-screen items-center justify-center">
        <div className="rymvo-card max-w-md p-8 text-center">
          <p className="rymvo-eyebrow">Rymvo control</p><h2 className="mt-4 text-xl font-bold text-[#d9a84e]">Acceso denegado</h2>
          <p className="mt-2 text-white/50">Solo administradores pueden acceder a esta sección.</p>
          <Link href="/" className="mt-5 inline-block text-xs font-bold uppercase tracking-[.16em] text-[#d9a84e] hover:text-white">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="rymvo-shell flex min-h-screen flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="flex w-full flex-shrink-0 flex-col border-b border-white/10 bg-rymvo-panel lg:w-56 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-5 py-5">
            <Link href="/" className="text-lg font-semibold tracking-[.18em] text-white">RYMVO</Link>
            <p className="rymvo-eyebrow mt-2">Admin control</p>
          </div>
          <AdminNav />
          <div className="border-t border-white/10 p-3">
            <ThemeToggle />
            <LanguageToggle />
            <div className="flex items-center gap-2">
              <UserButton />
              <span className="text-xs uppercase tracking-[.15em] text-white/40">Admin</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AdminGate>
  );
}
