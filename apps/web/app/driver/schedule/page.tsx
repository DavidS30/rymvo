"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDictionary } from "@/lib/useDictionary";

type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  passengerName: string;
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

const BADGE_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
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
  const dict = useDictionary();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  const dateLocale = typeof document !== "undefined" ? (document.cookie.match(/rymvo-lang=es/) ? "es-MX" : "en-US") : "en-US";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const r = await fetch("/api/v1/bookings?limit=100");
        if (!r.ok) throw new Error("Error al cargar");
        const d = await r.json();
        setBookings(d.data ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/v1/driver/availability").then((r) => r.json()).then((data) => setIsAvailable(data.isAvailable === true)).finally(() => setAvailabilityLoading(false));
  }, [isSignedIn]);

  const toggleAvailability = async () => {
    const next = !isAvailable;
    setAvailabilityLoading(true);
    try {
      const response = await fetch("/api/v1/driver/availability", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAvailable: next }) });
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error ?? "No se pudo actualizar la disponibilidad"); }
      setIsAvailable(next);
    } catch (e) { setError((e as Error).message); } finally { setAvailabilityLoading(false); }
  };

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const inProgress = bookings.filter((b) => b.status === "IN_PROGRESS").length;
  const earnings = bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + b.baseFareCents, 0);

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
        <h1 className="text-2xl font-bold text-gray-900">{dict.driver.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{dict.driver.subtitle}</p>
      </div>
      <div className="mb-8 flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-gray-500">{dict.driver.availability}</p><p className="mt-1 text-sm text-gray-600">{isAvailable ? dict.driver.available : dict.driver.unavailable}</p></div><button type="button" onClick={toggleAvailability} disabled={availabilityLoading} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[.12em] transition ${isAvailable ? "bg-green-600 text-white hover:bg-green-700" : "border border-gray-300 text-gray-600 hover:border-[#d9a84e]"}`}>{availabilityLoading ? "..." : isAvailable ? dict.driver.availableBtn : dict.driver.unavailableBtn}</button></div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatsCard label={dict.driver.confirmedToday} value={String(confirmed)} />
        <StatsCard label={dict.driver.inProgress} value={String(inProgress)} />
        <StatsCard label={dict.driver.dailyEarnings} value={formatPrice(earnings)} />
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {/* Booking cards */}
      <div className="space-y-4">
        {bookings.length === 0 && !loading && (
          <div className="rounded-xl border bg-white p-10 text-center">
            <p className="text-gray-400">{dict.driver.noTrips}</p>
          </div>
        )}

        {bookings.map((b) => {
          const badgeLabel = dict.status[b.status as keyof typeof dict.status] ?? b.status;
          const badgeColor = BADGE_COLORS[b.status] ?? "bg-gray-100 text-gray-600";

          return (
            <div key={b.id} className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold capitalize text-gray-900">{formatDate(b.scheduledAt)}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm text-gray-500">{formatTime(b.scheduledAt)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>{badgeLabel}</span>
                  </div>
                </div>
                <span className="text-sm text-gray-500">{b.serviceType === "AIRPORT" ? dict.passenger.airport : b.serviceType === "HOURLY" ? dict.passenger.hourly : b.serviceType === "EVENT" ? dict.passenger.event : b.serviceType}</span>
              </div>

              <div className="mb-3 space-y-1 text-sm">
                <p className="font-medium text-gray-800">{b.passengerName}</p>
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
                  {dict.driver.note}: {b.specialNotes}
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
                  {dict.driver.originOnMaps}
                </a>
                <a
                  href={`https://waze.com/ul?ll=${b.originLat},${b.originLng}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                >
                  <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full bg-[#33ccff] text-[9px] font-black leading-none text-[#072b3d]">W</span>
                  {dict.driver.originOnWaze}
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
                       {dict.driver.destOnMaps}
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${b.destLat},${b.destLng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-black"
                    >
                       <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full bg-[#33ccff] text-[9px] font-black leading-none text-[#072b3d]">W</span>
                       {dict.driver.destOnWaze}
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
