"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function PassengerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <Link href="/" className="text-xl font-bold text-black">
          Rymvo
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/passenger/book" className="text-sm font-medium text-gray-700 hover:text-black">
            Reservar
          </Link>
          <UserButton />
        </div>
      </nav>
      {children}
    </div>
  );
}
