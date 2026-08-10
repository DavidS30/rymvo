"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@clerk/nextjs";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";

import type { GoogleLocationMapProps } from "@/components/GoogleLocationMap";
import { PlacesAutocompleteInput } from "@/components/PlacesAutocompleteInput";

const LocationMap = dynamic<GoogleLocationMapProps>(() => import("@/components/GoogleLocationMap").then((m) => m.GoogleLocationMap), { ssr: false });

const SERVICE_TYPES = [
  { id: "AIRPORT" as const, label: "Aeropuerto", desc: "Traslados al aeropuerto" },
  { id: "HOURLY" as const, label: "Por hora", desc: "Servicio por hora" },
  { id: "EVENT" as const, label: "Evento", desc: "Eventos especiales" },
];

const DEFAULT_SLOTS = ["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

type PlaceInfo = { address: string; lat: number; lng: number };
type QuoteData = { fareCents: number; platformFeeCents: number; totalCents: number; distanceKm: number; durationMin: number } | null;
type BookingResult = { bookingId: string; status: string; stripeClientSecret: string } | null;

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() { const k = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; if (!k || k === "pk_test_placeholder") return null; if (!stripePromise) stripePromise = loadStripe(k); return stripePromise; }
const formatPrice = (c: number) => `$${(c / 100).toFixed(2)}`;
const today = new Date().toISOString().split("T")[0];

function StripePaymentForm({ clientSecret, bookingId, onSuccess }: { clientSecret: string; bookingId: string; onSuccess: (pi: string) => void }) {
  const stripe = useStripe(); const elements = useElements(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const pay = async () => { if (!stripe || !elements) return; setBusy(true); setErr(""); const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${location.origin}/passenger/book/success` }, redirect: "if_required" }); if (r.error) { setErr(r.error.message ?? "Error de pago"); setBusy(false); } else onSuccess(r.paymentIntent.id); };
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-800">Pago seguro</h3><PaymentElement />
      {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</p>}
      <button onClick={pay} disabled={!stripe || busy} className="rymvo-button mt-4 w-full rounded-lg border border-[#d9a84e] px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Procesando pago..." : "Pagar y confirmar"}</button>
      <p className="mt-2 text-center text-xs text-gray-400">Reserva #{bookingId.slice(0, 8)}</p>
    </div>);
}

export default function BookPage() {
  const { isSignedIn } = useAuth();
  const [svc, setSvc] = useState<"AIRPORT"|"HOURLY"|"EVENT">("AIRPORT");
  const [origin, setOrigin] = useState<PlaceInfo | null>(null);
  const [dest, setDest] = useState<PlaceInfo | null>(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [hours, setHours] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<QuoteData>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [result, setResult] = useState<BookingResult>(null);
  const [bookErr, setBookErr] = useState("");
  const [bookLoading, setBookLoading] = useState(false);

  const handleOriginPlace = (p: PlaceInfo) => { setOrigin(p); setOriginText(p.address); };
  const handleDestPlace = (p: PlaceInfo) => { setDest(p); setDestText(p.address); };
  const handleOriginMap = (p: PlaceInfo) => { setOrigin(p); setOriginText(p.address); };
  const handleDestMap = (p: PlaceInfo) => { setDest(p); setDestText(p.address); };
  const handleOriginText = (val: string) => { setOriginText(val); setOrigin({ address: val, lat: 0, lng: 0 }); };
  const handleDestText = (val: string) => { setDestText(val); setDest({ address: val, lat: 0, lng: 0 }); };

  // Quotes
  useEffect(() => {
    if (svc === "HOURLY") { const t = setTimeout(async () => { setQuoteLoading(true); setQuoteError(""); try { const r = await fetch(`/api/v1/quotes?${new URLSearchParams({ originLat:"0", originLng:"0", destLat:"0", destLng:"0", serviceType:"HOURLY", hours:String(hours) })}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); setQuote(d); } catch(e) { setQuoteError((e as Error).message); setQuote(null); } finally { setQuoteLoading(false); } }, 300); return () => clearTimeout(t); }
    if (!origin || !dest || origin.lat === 0 || dest.lat === 0) return;
    const t = setTimeout(async () => { setQuoteLoading(true); setQuoteError(""); try { const r = await fetch(`/api/v1/quotes?${new URLSearchParams({ originLat: String(origin.lat), originLng: String(origin.lng), destLat: String(dest.lat), destLng: String(dest.lng), serviceType: svc })}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); setQuote(d); } catch(e) { setQuoteError((e as Error).message); setQuote(null); } finally { setQuoteLoading(false); } }, 600); return () => clearTimeout(t);
  }, [origin, dest, svc, hours]);

  // Slots
  useEffect(() => { if (!date) return; (async () => { setSlotsLoading(true); try { const r = await fetch(`/api/v1/availability?date=${date}`); const d = await r.json(); if (r.ok && d.availableSlots) setSlots(d.availableSlots); else setSlots(DEFAULT_SLOTS); } catch { setSlots(DEFAULT_SLOTS); } finally { setSlotsLoading(false); } })(); }, [date]);

  const handleBook = async () => {
    if (!date || !time) return;
    if (svc === "HOURLY") { if (!origin) return; setBookLoading(true); setBookErr(""); try { const r = await fetch("/api/v1/bookings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ originAddress:origin.address, originLat:0, originLng:0, destAddress:`Servicio por hora (${hours}h)`, destLat:0, destLng:0, scheduledAt:`${date}T${time}:00`, serviceType:"HOURLY", specialNotes: notes ? `${notes} | ${hours} horas` : `${hours} horas` }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setResult(d); setStep("pay"); } catch(e) { setBookErr((e as Error).message); } finally { setBookLoading(false); } return; }
    if (!origin || !dest) { setBookErr("Completá origen y destino"); return; }
    setBookLoading(true); setBookErr(""); try { const r = await fetch("/api/v1/bookings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ originAddress:origin.address, originLat:origin.lat, originLng:origin.lng, destAddress:dest.address, destLat:dest.lat, destLng:dest.lng, scheduledAt:`${date}T${time}:00`, serviceType:svc, specialNotes:notes||undefined }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setResult(d); setStep("pay"); } catch(e) { setBookErr((e as Error).message); } finally { setBookLoading(false); }
  };

  if (step === "done") return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4"><div className="w-full rounded-2xl border bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"><svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div><h2 className="text-2xl font-bold text-gray-800">¡Reserva confirmada!</h2><p className="mt-2 text-gray-500">Recibirás un email con los detalles del viaje.</p>{result&&<p className="mt-3 text-sm text-gray-400">Reserva #{result.bookingId.slice(0,8)}</p>}</div></main>
  );

  const formOk = date && time && (svc === "HOURLY" ? origin : (origin && dest));

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden px-3 py-5 sm:px-4 sm:py-8">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Reservar un viaje</h1><p className="mt-1 text-sm text-gray-500">Completá los datos y recibí tu cotización al instante.</p></div>

      {step === "form" && (
        <div className="space-y-6">
          {/* Service type */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {SERVICE_TYPES.map(s => (<button key={s.id} onClick={()=>{setSvc(s.id);setQuote(null);setQuoteError("");}} className={`rounded-xl border px-3 py-2.5 text-left transition-all ${svc===s.id?"border-black bg-black text-white shadow-md":"border-gray-200 bg-white text-gray-700 hover:border-gray-400"}`}><div className="text-sm font-semibold">{s.label}</div></button>))}
          </div>

          {/* Hours for HOURLY */}
          {svc === "HOURLY" && <div className="flex items-center gap-4"><span className="text-sm font-medium text-gray-700">Duración:</span><button onClick={()=>setHours(Math.max(1,hours-1))} className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm hover:bg-gray-50">−</button><span className="min-w-[3rem] text-center text-lg font-bold">{hours}</span><button onClick={()=>setHours(Math.min(24,hours+1))} className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm hover:bg-gray-50">+</button><span className="text-sm text-gray-500">horas</span></div>}

          {/* Map - always visible for non-HOURLY */}
          {svc !== "HOURLY" && (
            <LocationMap onOriginChange={handleOriginMap} onDestChange={handleDestMap} externalOrigin={origin} externalDest={dest} autoLocateOrigin />
          )}

          {svc === "HOURLY" && (
            <LocationMap onOriginChange={handleOriginMap} onDestChange={()=>{}} hideDest externalOrigin={origin} initialCenter={[19.4326,-99.1332]} autoLocateOrigin />
          )}

          {/* Address inputs with autocomplete - always visible below map */}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <PlacesAutocompleteInput id="origin" label="Dirección de origen" placeholder={svc==="HOURLY"?"¿Dónde te recogemos?":"Punto de partida"} value={originText} onChange={handleOriginText} onPlaceSelected={handleOriginPlace} />
            {svc !== "HOURLY" && <PlacesAutocompleteInput id="dest" label="Dirección de destino" placeholder="Punto de llegada" value={destText} onChange={handleDestText} onPlaceSelected={handleDestPlace} />}
          </div>

          {/* Date & Time */}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0"><span className="mb-1 block text-sm font-medium text-gray-700">Fecha</span><div className="min-w-0 max-w-full overflow-hidden"><input type="date" min={today} value={date} onChange={e=>{setDate(e.target.value);setTime("");}} className="rymvo-date-input block w-full min-w-0 max-w-full rounded-lg border px-3 py-2.5 text-sm" /></div></label>
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Hora</span><select value={time} onChange={e=>setTime(e.target.value)} disabled={!date||slotsLoading} className="rymvo-select w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-50"><option value="">{slotsLoading?"Cargando...":"Seleccionar una hora"}</option>{slots.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          </div>

          {/* Notes */}
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Notas <span className="font-normal text-gray-400">(opcional, {280-notes.length})</span></span><textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,280))} rows={3} maxLength={280} placeholder="Silla para bebé, equipaje extra..." className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black" /></label>

          {/* Quote */}
           <div className="min-w-0 rounded-xl border bg-gray-50 p-4 sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Cotización</h3>
            {!origin && svc!=="HOURLY" && <p className="text-sm text-gray-400">Buscá o marcá el origen y destino para ver el precio.</p>}
            {quoteLoading && <div className="space-y-2"><div className="h-3 w-24 animate-pulse rounded bg-gray-200"/></div>}
            {quoteError && <p className="text-sm text-red-500">{quoteError}</p>}
            {quote && <div className="space-y-1 text-sm"><div className="flex justify-between"><span className="text-gray-500">Tarifa</span><span>{formatPrice(quote.fareCents)}</span></div><div className="flex justify-between"><span className="text-gray-500">Fee</span><span>{formatPrice(quote.platformFeeCents)}</span></div>{svc!=="HOURLY"&&<div className="flex justify-between"><span className="text-gray-500">Distancia</span><span>{quote.distanceKm} km</span></div>}<hr className="border-gray-200 my-1"/><div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatPrice(quote.totalCents)}</span></div></div>}
          </div>

          {/* Submit */}
           <button onClick={handleBook} disabled={!formOk||bookLoading} className="rymvo-button w-full rounded-xl border border-[#d9a84e] px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">{bookLoading?"Creando reserva...":"Confirmar y pagar"}</button>
          {bookErr && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{bookErr}</p>}
        </div>
      )}

      {step === "pay" && result && (
        <div className="space-y-6">
          <button onClick={()=>setStep("form")} className="text-sm text-gray-500 hover:text-black">&larr; Volver</button>
           <div className="min-w-0 rounded-xl border bg-white p-4 text-sm shadow-sm sm:p-5"><h3 className="mb-2 font-semibold text-gray-700">Resumen</h3><div className="space-y-1"><div className="flex justify-between gap-4"><span className="text-gray-500">Servicio</span><span>{SERVICE_TYPES.find(s=>s.id===svc)?.label}{svc==="HOURLY"?` (${hours}h)`:""}</span></div><div className="flex justify-between gap-4"><span className="text-gray-500">Origen</span><span className="min-w-0 max-w-[60%] truncate">{origin?.address}</span></div>{svc!=="HOURLY"&&<div className="flex justify-between gap-4"><span className="text-gray-500">Destino</span><span className="min-w-0 max-w-[60%] truncate">{dest?.address}</span></div>}<div className="flex justify-between gap-4"><span className="text-gray-500">Fecha</span><span className="text-right">{date} a las {time}</span></div></div></div>
          {result.stripeClientSecret.startsWith("dev_secret_") ? <div className="rounded-xl border bg-amber-50 p-8 text-center"><p className="font-semibold text-amber-800">Modo desarrollo</p><p className="mt-1 text-sm text-amber-600">Stripe no está configurado.</p><button onClick={()=>setStep("done")} className="mt-5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700">Simular pago exitoso</button></div> : getStripe() ? <Elements stripe={getStripe()!} options={{clientSecret:result.stripeClientSecret}}><StripePaymentForm clientSecret={result.stripeClientSecret} bookingId={result.bookingId} onSuccess={()=>setStep("done")} /></Elements> : <p className="text-sm text-red-500">Stripe no configurado.</p>}
        </div>)}
    </main>
  );
}
