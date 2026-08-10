import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

async function DriverGate({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } });
  if (!user || (user.role !== "DRIVER" && user.role !== "ADMIN")) {
    return (
      <div className="rymvo-shell flex min-h-screen items-center justify-center">
        <div className="rymvo-card max-w-md p-8 text-center">
          <p className="rymvo-eyebrow">Rymvo driver</p>
          <h2 className="mt-4 text-xl font-bold text-[#d9a84e]">Acceso denegado</h2>
          <p className="mt-2 text-white/50">Solo conductores pueden acceder a esta sección.</p>
          <Link href="/" className="mt-5 inline-block text-xs font-bold uppercase tracking-[.16em] text-[#d9a84e] hover:text-white">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverGate>
      <div className="rymvo-shell">
        <nav className="rymvo-topbar flex items-center justify-between border-b px-6 py-4 lg:px-10">
          <Link href="/" className="text-xl font-semibold tracking-[.18em] text-white">RYMVO</Link>
          <div className="flex items-center gap-4">
            <LanguageToggle /><ThemeToggle /><span className="hidden text-xs uppercase tracking-[.2em] text-white/40 sm:block">Driver portal</span>
            <Link href="/driver/schedule" className="text-xs font-semibold uppercase tracking-[.16em] text-[#d9a84e]">Agenda</Link>
            <UserButton />
          </div>
        </nav>
        {children}
      </div>
    </DriverGate>
  );
}