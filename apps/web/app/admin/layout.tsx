import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

async function AdminGate({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-red-600">Acceso denegado</h2>
          <p className="mt-2 text-gray-500">Solo administradores pueden acceder a esta sección.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-black hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const NAV_ITEMS = [
  { label: "Reservas", href: "/admin/bookings", active: true },
  { label: "Conductores", href: "#", active: false },
  { label: "Tarifas", href: "#", active: false },
  { label: "Reportes", href: "#", active: false },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r bg-white">
          <div className="border-b px-5 py-4">
            <Link href="/" className="text-lg font-bold text-black">Rymvo</Link>
            <p className="text-xs text-gray-400">Admin</p>
          </div>
          <nav className="flex-1 space-y-0.5 p-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-black text-white"
                    : "text-gray-400 cursor-not-allowed pointer-events-none"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <UserButton />
              <span className="text-xs text-gray-500">Admin</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AdminGate>
  );
}
