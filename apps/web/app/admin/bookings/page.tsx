"use client";

import { useState, useEffect, useCallback } from "react";

type BookingRow = {
  id: string;
  status: string;
  passengerName: string;
  originAddress: string;
  destAddress: string;
  scheduledAt: string;
  serviceType: string;
  baseFareCents: number;
  platformFeeCents: number;
  driverId: string | null;
  driverName: string | null;
};
type Driver = { id: string; fullName: string; email: string };

type PaginatedData = {
  data: BookingRow[];
  page: number;
  limit: number;
  total: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "COMPLETED", label: "Completado" },
  { value: "CANCELLED", label: "Cancelado" },
];

const DATE_OPTIONS = [
  { value: "", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
];

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  CONFIRMED: { label: "Confirmado", style: "bg-green-100 text-green-700" },
  PENDING: { label: "Pendiente", style: "bg-amber-100 text-amber-700" },
  IN_PROGRESS: { label: "En curso", style: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completado", style: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelado", style: "bg-red-100 text-red-600" },
};

const SERVICE_LABELS: Record<string, string> = {
  AIRPORT: "Aeropuerto",
  HOURLY: "Por hora",
  EVENT: "Evento",
};

function getDateRange(value: string): string | undefined {
  const now = new Date();
  const start = new Date(now);

  switch (value) {
    case "today":
      return now.toISOString().split("T")[0];
    case "week":
      start.setDate(now.getDate() - now.getDay());
      return start.toISOString().split("T")[0];
    case "month":
      start.setDate(1);
      return start.toISOString().split("T")[0];
    default:
      return undefined;
  }
}

export default function AdminBookingsPage() {
  const [data, setData] = useState<PaginatedData>({ data: [], page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/drivers").then((r) => r.ok ? r.json() : null).then((d) => setDrivers(d?.data ?? [])).catch(() => setDrivers([]));
  }, []);

  const assignDriver = async (bookingId: string, driverId: string) => {
    setAssigning(bookingId);
    try {
      const r = await fetch(`/api/v1/admin/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driverId: driverId || null }) });
      if (!r.ok) throw new Error("No se pudo asignar el conductor");
      await fetchBookings();
    } catch (e) { setError((e as Error).message); } finally { setAssigning(null); }
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const dateStr = getDateRange(dateFilter);
      if (dateStr) params.set("date", dateStr);

      const r = await fetch(`/api/v1/bookings?${params}`);
      if (!r.ok) throw new Error("Error al cargar");
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFilter, search]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Debounce for search
  useEffect(() => {
    if (!search) return;
    const t = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  const updateStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const updateDate = (v: string) => { setDateFilter(v); setPage(1); };
  const updateSearch = (v: string) => { setSearch(v); };

  useEffect(() => {
    fetchBookings();
  }, [page]);

  const totalPages = Math.ceil(data.total / data.limit);
  const formatPrice = (c: number) => `$${(c / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <p className="mt-1 text-sm text-gray-500">{data.total} reservas en total</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Estado</span>
          <select value={statusFilter} onChange={e => updateStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Fecha</span>
          <select value={dateFilter} onChange={e => updateDate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black">
            {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500">Buscar pasajero</span>
          <input
            type="text"
            value={search}
            onChange={e => updateSearch(e.target.value)}
            placeholder="Nombre del pasajero..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </label>

        <button onClick={fetchBookings} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#d9a84e] hover:bg-gray-50">
          Actualizar
        </button>
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[860px] w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3">Pasajero</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Conductor</th><th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></td>
                  ))}
                </tr>
              ))
            )}

            {!loading && data.data.length === 0 && (
              <tr>
                 <td colSpan={6} className="px-4 py-12 text-center text-gray-400">No se encontraron reservas.</td>
              </tr>
            )}

            {!loading && data.data.map((row) => {
              const badge = STATUS_BADGE[row.status] ?? { label: row.status, style: "bg-gray-100" };
              return (
                <tr key={row.id} className="border-b transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.passengerName}</td>
                  <td className="px-4 py-3 text-gray-600">{SERVICE_LABELS[row.serviceType] ?? row.serviceType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(row.scheduledAt)}<br />
                    <span className="text-xs text-gray-400">{formatTime(row.scheduledAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.style}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3"><select aria-label={`Conductor para ${row.passengerName}`} value={row.driverId ?? ""} disabled={assigning === row.id} onChange={(e) => assignDriver(row.id, e.target.value)} className="rymvo-select max-w-44 rounded-lg border bg-white px-3 py-2 text-xs font-medium"><option value="">Sin asignar</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.fullName}</option>)}</select></td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPrice(row.baseFareCents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
            <span className="text-xs text-gray-500">Página {data.page} de {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded border px-3 py-1 text-xs font-medium disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded border px-3 py-1 text-xs font-medium disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
