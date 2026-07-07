"use client";

import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import Script from "next/script";

import type { LocationMapProps } from "@/components/LocationMap";

const LocationMap = dynamic<LocationMapProps>(() => import("@/components/LocationMap").then((m) => m.LocationMap), { ssr: false });

const SERVICE_TYPES = [
  { id: "AIRPORT" as const, label: "Aeropuerto", desc: "Traslados al aeropuerto" },
  { id: "HOURLY" as const, label: "Por hora", desc: "Servicio por hora" },
  { id: "EVENT" as const, label: "Evento", desc: "Eventos especiales" },
];

const DEFAULT_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

type PlaceInfo = { address: string; lat: number; lng: number };
type QuoteData = { fareCents: number; platformFeeCents: number; totalCents: number; distanceKm: number; durationMin: number; } | null;
type BookingResult = { bookingId: string; status: string; stripeClientSecret: string; } | null;

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === "pk_test_placeholder") return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

function StripePaymentForm({ clientSecret, bookingId, onSuccess }: { clientSecret: string; bookingId: string; onSuccess: (pi: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${location.origin}/passenger/book/success` }, redirect: "if_required" });
    if (r.error) { setErr(r.error.message ?? "Error de pago"); setBusy(false); }
    else onSuccess(r.paymentIntent.id);
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Pago seguro</h3>
      <PaymentElement />
      {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</p>}
      <button onClick={pay} disabled={!stripe || busy} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50">
        {busy ? "Procesando pago..." : "Pagar y confirmar"}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">Reserva #{bookingId.slice(0, 8)}</p>
    </div>
  );
}

const Input = forwardRef<HTMLInputElement, { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ label, error, ...p }, ref) {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
        <input ref={ref} {...p} className={`w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-black/10 ${error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`} />
        {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
      </label>
    );
  }
);

export default function BookPage() {
  const { isSignedIn } = useAuth();

  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [svc, setSvc] = useState<"AIRPORT"|"HOURLY"|"EVENT">("AIRPORT");
  const [origin, setOrigin] = useState<PlaceInfo | null>(null);
  const [dest, setDest] = useState<PlaceInfo | null>(null);
  const [hours, setHours] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<QuoteData>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [result, setResult] = useState<BookingResult>(null);
  const [bookErr, setBookErr] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [useMap, setUseMap] = useState(true);

  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  const initGoogle = useCallback(() => {
    const w = window as any;
    if (!w.google?.maps?.places) return;
    if (!originRef.current || !destRef.current) return;

    const oa = new w.google.maps.places.Autocomplete(originRef.current, { types: ["establishment", "geocode"] });
    oa.addListener("place_changed", () => { const p = oa.getPlace(); if (p.formatted_address && p.geometry?.location) setOrigin({ address: p.formatted_address, lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }); });

    const da = new w.google.maps.places.Autocomplete(destRef.current, { types: ["establishment", "geocode"] });
    da.addListener("place_changed", () => { const p = da.getPlace(); if (p.formatted_address && p.geometry?.location) setDest({ address: p.formatted_address, lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }); });
  }, []);

  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const hasRealGoogleKey = googleKey && googleKey !== "placeholder";

  const handleOriginChange = useCallback((p: { lat: number; lng: number; address: string }) => {
    setOrigin(p);
  }, []);

  const handleDestChange = useCallback((p: { lat: number; lng: number; address: string }) => {
    setDest(p);
  }, []);

  // Quotes debounce
  useEffect(() => {
    if (svc === "HOURLY") {
      const t = setTimeout(async () => {
        setQuoteLoading(true); setQuoteError("");
        try {
          const qs = new URLSearchParams({ originLat: "0", originLng: "0", destLat: "0", destLng: "0", serviceType: "HOURLY", hours: String(hours) });
          const r = await fetch(`/api/v1/quotes?${qs}`);
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "Error");
          setQuote(d);
        } catch (e) { setQuoteError((e as Error).message); setQuote(null); }
        finally { setQuoteLoading(false); }
      }, 300);
      return () => clearTimeout(t);
    }

    if (!origin || !dest || origin.lat === 0 || dest.lat === 0) return;

    const t = setTimeout(async () => {
      setQuoteLoading(true); setQuoteError("");
      try {
        const qs = new URLSearchParams({ originLat: String(origin.lat), originLng: String(origin.lng), destLat: String(dest.lat), destLng: String(dest.lng), serviceType: svc });
        const r = await fetch(`/api/v1/quotes?${qs}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Error");
        setQuote(d);
      } catch (e) { setQuoteError((e as Error).message); setQuote(null); }
      finally { setQuoteLoading(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [origin, dest, svc, hours]);

  // Availability
  useEffect(() => {
    if (!date) return;
    (async () => {
      setSlotsLoading(true);
      try {
        const r = await fetch(`/api/v1/availability?date=${date}`);
        const d = await r.json();
        if (r.ok && d.availableSlots) setSlots(d.availableSlots);
        else setSlots(DEFAULT_SLOTS);
      } catch { setSlots(DEFAULT_SLOTS); }
      finally { setSlotsLoading(false); }
    })();
  }, [date]);

  const handleBook = async () => {
    if (!date || !time) return;
    if (svc === "HOURLY" && !hours) return;

    if (svc === "HOURLY") {
      if (!origin) return;
      setBookLoading(true); setBookErr("");
      try {
        const r = await fetch("/api/v1/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originAddress: origin.address, originLat: 0, originLng: 0,
            destAddress: `Servicio por hora (${hours}h)`, destLat: 0, destLng: 0,
            scheduledAt: `${date}T${time}:00`, serviceType: "HOURLY",
            specialNotes: notes ? `${notes} | ${hours} horas` : `${hours} horas`,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Error");
        setResult(d); setStep("pay");
      } catch (e) { setBookErr((e as Error).message); }
      finally { setBookLoading(false); }
      return;
    }

    if (!origin || !dest) { setBookErr("Marcá origen y destino en el mapa"); return; }

    setBookLoading(true); setBookErr("");
    try {
      const r = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originAddress: origin.address, originLat: origin.lat, originLng: origin.lng, destAddress: dest.address, destLat: dest.lat, destLng: dest.lng, scheduledAt: `${date}T${time}:00`, serviceType: svc, specialNotes: notes || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Error");
      setResult(d); setStep("pay");
    } catch (e) { setBookErr((e as Error).message); }
    finally { setBookLoading(false); }
  };

  if (step === "done") return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4">
      <div className="w-full rounded-2xl border bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
        <h2 className="text-2xl font-bold text-gray-800">¡Reserva confirmada!</h2>
        <p className="mt-2 text-gray-500">Recibirás un email con los detalles del viaje.</p>
        {result && <p className="mt-3 text-sm text-gray-400">Reserva #{result.bookingId.slice(0, 8)}</p>}
      </div>
    </main>
  );

  const formOk = date && time && (
    svc === "HOURLY" ? origin : (origin && dest)
  );

  return (
    <>
      {hasRealGoogleKey && <Script src={`https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places`} onLoad={initGoogle} />}
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reservar un viaje</h1>
          <p className="mt-1.5 text-gray-500">Completá los datos y recibí tu cotización al instante.</p>
        </div>

        {step === "form" && (
          <div className="space-y-8">
            {/* Service type */}
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-gray-700">Tipo de servicio</legend>
              <div className="grid grid-cols-3 gap-3">
                {SERVICE_TYPES.map(s => (
                  <button key={s.id} onClick={() => { setSvc(s.id); setQuote(null); setQuoteError(""); }} className={`rounded-xl border px-4 py-3.5 text-left transition-all ${svc === s.id ? "border-black bg-black text-white shadow-md" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"}`}>
                    <div className="font-semibold">{s.label}</div>
                    <div className={`text-xs mt-0.5 ${svc === s.id ? "text-gray-300" : "text-gray-400"}`}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Hours — solo HOURLY */}
            {svc === "HOURLY" && (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-gray-700">Duración del servicio</legend>
                <div className="flex items-center gap-4">
                  <button onClick={() => setHours(Math.max(1, hours - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border text-lg hover:bg-gray-50">−</button>
                  <span className="min-w-[4rem] text-center text-xl font-bold">{hours}</span>
                  <button onClick={() => setHours(Math.min(24, hours + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border text-lg hover:bg-gray-50">+</button>
                  <span className="text-sm text-gray-500">horas</span>
                </div>
              </fieldset>
            )}

            {/* Map or text inputs */}
            {svc !== "HOURLY" && (
              <fieldset>
                <div className="mb-3 flex items-center justify-between">
                  <legend className="text-sm font-semibold text-gray-700">
                    {useMap ? "Seleccioná en el mapa" : "Direcciones"}
                  </legend>
                  <button onClick={() => setUseMap(!useMap)} className="text-xs font-medium text-gray-500 hover:text-black">
                    {useMap ? "Usar búsqueda por texto" : "Usar mapa interactivo"}
                  </button>
                </div>

                {useMap ? (
                  <LocationMap onOriginChange={handleOriginChange} onDestChange={handleDestChange} />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Input ref={originRef} label="Dirección de origen" placeholder="Dirección de recogida" onChange={e => setOrigin({ address: e.target.value, lat: 0, lng: 0 })} />
                      {origin && <p className="mt-1 text-xs text-green-600">✓ {origin.address}</p>}
                    </div>
                    <div>
                      <Input ref={destRef} label="Dirección de destino" placeholder="Dirección de destino" onChange={e => setDest({ address: e.target.value, lat: 0, lng: 0 })} />
                      {dest && <p className="mt-1 text-xs text-green-600">✓ {dest.address}</p>}
                    </div>
                    {!hasRealGoogleKey && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="mb-2 text-xs font-medium text-amber-800">Sin Google Places, necesitás coordenadas manuales:</p>
                        <div className="grid grid-cols-4 gap-2">
                          <input type="number" step="any" placeholder="Lat origen" className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs" onChange={e => setOrigin(p => p ? { ...p, lat: parseFloat(e.target.value) || 0 } : { address: "", lat: parseFloat(e.target.value) || 0, lng: 0 })} />
                          <input type="number" step="any" placeholder="Lng origen" className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs" onChange={e => setOrigin(p => p ? { ...p, lng: parseFloat(e.target.value) || 0 } : { address: "", lat: 0, lng: parseFloat(e.target.value) || 0 })} />
                          <input type="number" step="any" placeholder="Lat destino" className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs" onChange={e => setDest(p => p ? { ...p, lat: parseFloat(e.target.value) || 0 } : { address: "", lat: parseFloat(e.target.value) || 0, lng: 0 })} />
                          <input type="number" step="any" placeholder="Lng destino" className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs" onChange={e => setDest(p => p ? { ...p, lng: parseFloat(e.target.value) || 0 } : { address: "", lat: 0, lng: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>
            )}

            {/* Origin only for HOURLY */}
            {svc === "HOURLY" && (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-gray-700">Punto de recogida</legend>
                {useMap ? (
                  <LocationMap onOriginChange={handleOriginChange} onDestChange={() => {}} hideDest initialCenter={[19.4326, -99.1332]} />
                ) : (
                  <div>
                    <Input ref={originRef} label="Dirección" placeholder="¿Dónde te recogemos?" onChange={e => setOrigin({ address: e.target.value, lat: 0, lng: 0 })} />
                    {origin && <p className="mt-1 text-xs text-green-600">✓ {origin.address}</p>}
                    <button onClick={() => setUseMap(true)} className="mt-2 text-xs font-medium text-gray-500 hover:text-black">Usar mapa</button>
                  </div>
                )}
              </fieldset>
            )}

            {/* Date & Time */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Input type="date" label="Fecha" min={today} value={date} onChange={e => { setDate(e.target.value); setTime(""); }} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Hora</span>
                <select value={time} onChange={e => setTime(e.target.value)} disabled={!date || slotsLoading} className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-black/10 disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">{slotsLoading ? "Cargando..." : "Seleccionar horario"}</option>
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            {/* Notes */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Notas <span className="font-normal text-gray-400">(opcional, {280 - notes.length} caracteres)</span></span>
              <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 280))} placeholder="Silla para bebé, equipaje extra, mascota..." rows={3} maxLength={280} className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-black/10" />
            </label>

            {/* Quote */}
            <div className="rounded-xl border bg-gray-50/80 p-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Cotización</h3>
              {!origin && svc !== "HOURLY" && <p className="text-sm text-gray-400">{useMap ? "Marcá origen y destino en el mapa para ver el precio." : "Ingresá origen y destino para ver el precio."}</p>}
              {quoteLoading && <div className="space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-gray-200"/><div className="h-3 w-40 animate-pulse rounded bg-gray-200"/></div>}
              {quoteError && <p className="text-sm text-red-500">{quoteError}</p>}
              {quote && <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Tarifa</span><span>{formatPrice(quote.fareCents)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Fee de plataforma</span><span>{formatPrice(quote.platformFeeCents)}</span></div>
                {svc !== "HOURLY" && <div className="flex justify-between"><span className="text-gray-500">Distancia</span><span>{quote.distanceKm} km (~{quote.durationMin} min)</span></div>}
                {svc === "HOURLY" && <div className="flex justify-between"><span className="text-gray-500">Duración</span><span>{hours} horas</span></div>}
                <hr className="border-gray-200" />
                <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{formatPrice(quote.totalCents)}</span></div>
              </div>}
            </div>

            {/* Submit */}
            <button onClick={handleBook} disabled={!formOk || bookLoading} className="w-full rounded-xl bg-black px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
              {bookLoading ? "Creando reserva..." : "Confirmar y pagar"}
            </button>
            {bookErr && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{bookErr}</p>}
          </div>
        )}

        {/* Step 2: Payment */}
        {step === "pay" && result && (
          <div className="space-y-6">
            <button onClick={() => setStep("form")} className="text-sm text-gray-500 hover:text-black">&larr; Volver</button>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Resumen</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Servicio</span><span>{SERVICE_TYPES.find(s=>s.id===svc)?.label}{svc==="HOURLY" ? ` (${hours}h)` : ""}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Origen</span><span className="text-right max-w-[60%] truncate">{origin?.address}</span></div>
                {svc !== "HOURLY" && <div className="flex justify-between"><span className="text-gray-500">Destino</span><span className="text-right max-w-[60%] truncate">{dest?.address}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span>{date} a las {time}</span></div>
              </div>
            </div>

            {result.stripeClientSecret.startsWith("dev_secret_") ? (
              <div className="rounded-xl border bg-amber-50 p-8 text-center">
                <p className="font-semibold text-amber-800">Modo desarrollo</p>
                <p className="mt-1 text-sm text-amber-600">Stripe no está configurado. La reserva fue creada.</p>
                <button onClick={() => setStep("done")} className="mt-5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700">Simular pago exitoso</button>
              </div>
            ) : getStripe() ? (
              <Elements stripe={getStripe()!} options={{ clientSecret: result.stripeClientSecret }}>
                <StripePaymentForm clientSecret={result.stripeClientSecret} bookingId={result.bookingId} onSuccess={() => setStep("done")} />
              </Elements>
            ) : (
              <p className="text-sm text-red-500">Stripe no configurado.</p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
