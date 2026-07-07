"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  passenger: { fullName: string };
  originAddress: string;
  destAddress: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  scheduledAt: string;
  serviceType: "AIRPORT" | "HOURLY" | "EVENT";
  baseFareCents: number;
  platformFeeCents: number;
  specialNotes: string | null;
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Confirmado", color: "bg-green-100 text-green-700" },
  PENDING: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  IN_PROGRESS: { label: "En curso", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completado", color: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelado", color: "bg-red-100 text-red-600" },
};

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT: "Aeropuerto",
  HOURLY: "Por hora",
  EVENT: "Evento",
};

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function DriverSchedulePage() {
  const { isSignedIn } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const r = await fetch(`/api/v1/bookings?date=${today}`);
        if (!r.ok) throw new Error("Error al cargar");
        const d = await r.json();
        setBookings(d.data ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn, today]);

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const inProgress = bookings.filter((b) => b.status === "IN_PROGRESS").length;
  const earnings = bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + b.baseFareCents, 0);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda del día</h1>
        <p className="mt-1 text-sm text-gray-500">{new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatsCard label="Confirmados hoy" value={String(confirmed)} />
        <StatsCard label="En curso" value={String(inProgress)} />
        <StatsCard label="Ingresos del día" value={formatPrice(earnings)} />
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {/* Booking cards */}
      <div className="space-y-4">
        {bookings.length === 0 && !loading && (
          <div className="rounded-xl border bg-white p-10 text-center">
            <p className="text-gray-400">No hay viajes programados para hoy.</p>
          </div>
        )}

        {bookings.map((b) => {
          const badge = STATUS_BADGE[b.status] ?? { label: b.status, color: "bg-gray-100" };

          return (
            <div key={b.id} className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900">{formatTime(b.scheduledAt)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>{badge.label}</span>
                </div>
                <span className="text-sm text-gray-500">{SERVICE_LABELS[b.serviceType] ?? b.serviceType}</span>
              </div>

              <div className="mb-3 space-y-1 text-sm">
                <p className="font-medium text-gray-800">{b.passenger.fullName}</p>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="truncate">{b.originAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="truncate">{b.destAddress}</span>
                </div>
              </div>

              {b.specialNotes && (
                <p className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-gray-600 italic">
                  Nota: {b.specialNotes}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${b.originLat},${b.originLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Origen en Maps
                </a>
                <a
                  href={`https://waze.com/ul?ll=${b.originLat},${b.originLng}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.4 2.5L12 7.9 6.6 2.5 5 4.1l5.4 5.4L5 14.9l1.6 1.6 5.4-5.4 5.4 5.4 1.6-1.6-5.4-5.4 5.4-5.4z"/></svg>
                  Origen en Waze
                </a>
                {b.destLat !== 0 && (
                  <>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${b.destLat},${b.destLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      Destino en Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${b.destLat},${b.destLng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.4 2.5L12 7.9 6.6 2.5 5 4.1l5.4 5.4L5 14.9l1.6 1.6 5.4-5.4 5.4 5.4 1.6-1.6-5.4-5.4 5.4-5.4z"/></svg>
                      Destino en Waze
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
