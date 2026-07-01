"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import Script from "next/script";

const SERVICE_TYPES = [
  { id: "AIRPORT" as const, label: "Aeropuerto", desc: "Traslados al aeropuerto" },
  { id: "HOURLY" as const, label: "Por hora", desc: "Servicio por hora" },
  { id: "EVENT" as const, label: "Evento", desc: "Eventos especiales" },
];

const TIME_SLOTS_BASE = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

type PlaceInfo = {
  address: string;
  lat: number;
  lng: number;
};

type QuoteData = {
  fareCents: number;
  platformFeeCents: number;
  totalCents: number;
  distanceKm: number;
  durationMin: number;
} | null;

type BookingResult = {
  bookingId: string;
  status: string;
  stripeClientSecret: string;
} | null;

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === "pk_test_placeholder") return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

function StripePaymentForm({
  clientSecret,
  bookingId,
  onSuccess,
}: {
  clientSecret: string;
  bookingId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/passenger/book/success`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Error al procesar el pago");
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Pago</h3>
      <PaymentElement />
      {error && (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!stripe || loading}
        className="mt-4 w-full rounded-md bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Procesando..." : `Pagar y confirmar`}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">Reserva #{bookingId}</p>
    </div>
  );
}

export default function BookPage() {
  const { isSignedIn } = useAuth();

  const [serviceType, setServiceType] = useState<"AIRPORT" | "HOURLY" | "EVENT">("AIRPORT");
  const [origin, setOrigin] = useState<PlaceInfo | null>(null);
  const [dest, setDest] = useState<PlaceInfo | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<QuoteData>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS_BASE);
  const [bookingResult, setBookingResult] = useState<BookingResult>(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [placesLoaded, setPlacesLoaded] = useState(false);

  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);

  const originAutocomplete = useRef<any>(null);
  const destAutocomplete = useRef<any>(null);

  // Init Google Places Autocomplete
  const initAutocomplete = useCallback(() => {
    if (!(window as any).google?.maps?.places) return;

    if (originRef.current && !originAutocomplete.current) {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(originRef.current, {
        types: ["establishment", "geocode"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.geometry?.location) {
          setOrigin({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
      originAutocomplete.current = autocomplete;
    }

    if (destRef.current && !destAutocomplete.current) {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(destRef.current, {
        types: ["establishment", "geocode"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.geometry?.location) {
          setDest({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
      destAutocomplete.current = autocomplete;
    }

    setPlacesLoaded(true);
  }, []);

  // Fetch quote with debounce
  useEffect(() => {
    if (!origin || !dest || !serviceType) return;

    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError("");

      try {
        const params = new URLSearchParams({
          originLat: origin.lat.toString(),
          originLng: origin.lng.toString(),
          destLat: dest.lat.toString(),
          destLng: dest.lng.toString(),
          serviceType,
        });

        const res = await fetch(`/api/v1/quotes?${params}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Error al cotizar");
        }
        const data = await res.json();
        setQuote(data);
      } catch (err) {
        setQuoteError((err as Error).message);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [origin, dest, serviceType]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!date || !isSignedIn) return;

    (async () => {
      try {
        const res = await fetch(`/api/v1/availability?date=${date}`);
        if (!res.ok) {
          setAvailableSlots(TIME_SLOTS_BASE);
          return;
        }
        const data = await res.json();
        setAvailableSlots(data.availableSlots ?? TIME_SLOTS_BASE);
      } catch {
        setAvailableSlots(TIME_SLOTS_BASE);
      }
    })();
  }, [date, isSignedIn]);

  const isFormComplete = origin && dest && date && time && serviceType;

  const handleBook = async () => {
    if (!isFormComplete) return;
    setBookingLoading(true);
    setBookingError("");

    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAddress: origin.address,
          originLat: origin.lat,
          originLng: origin.lng,
          destAddress: dest.address,
          destLat: dest.lat,
          destLng: dest.lng,
          scheduledAt: `${date}T${time}:00`,
          serviceType,
          specialNotes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear reserva");

      setBookingResult(data);
    } catch (err) {
      setBookingError((err as Error).message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0];

  // Format cents for display
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (paymentSuccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">¡Reserva confirmada!</h2>
          <p className="mt-2 text-gray-600">
            Recibirás un email con los detalles de tu viaje.
          </p>
          {bookingResult && (
            <p className="mt-1 text-sm text-gray-400">Reserva #{bookingResult.bookingId}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? ""}&libraries=places`}
        onLoad={initAutocomplete}
        strategy="lazyOnload"
      />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold">Reservar un viaje</h1>

        {/* Service Type */}
        <section className="mb-8">
          <label className="mb-3 block text-sm font-medium text-gray-700">Tipo de servicio</label>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_TYPES.map((st) => (
              <button
                key={st.id}
                onClick={() => setServiceType(st.id)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  serviceType === st.id
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white hover:border-gray-400"
                }`}
              >
                <div className="font-semibold">{st.label}</div>
                <div className={`text-xs ${serviceType === st.id ? "text-gray-300" : "text-gray-500"}`}>
                  {st.desc}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Origin */}
        <section className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">Origen</label>
          <input
            ref={originRef}
            type="text"
            placeholder="Dirección de recogida"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          {origin && (
            <p className="mt-1 text-xs text-green-700">{origin.address}</p>
          )}
        </section>

        {/* Destination */}
        <section className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">Destino</label>
          <input
            ref={destRef}
            type="text"
            placeholder="Dirección de destino"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          {dest && (
            <p className="mt-1 text-xs text-green-700">{dest.address}</p>
          )}
        </section>

        {/* Date and Time */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <section>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => { setDate(e.target.value); setTime(""); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </section>
          <section>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hora</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!date}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-100"
            >
              <option value="">Seleccionar</option>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </section>
        </div>

        {/* Notes */}
        <section className="mb-8">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notas especiales <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 280))}
            placeholder="Ej: Necesito silla para bebé, llevo equipaje extra..."
            rows={3}
            maxLength={280}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{notes.length}/280</p>
        </section>

        {/* Quote */}
        {(quoteLoading || quote || quoteError) && (
          <section className="mb-8 rounded-lg border bg-gray-50 p-6">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Cotización</h3>
            {quoteLoading && (
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
              </div>
            )}
            {quoteError && (
              <p className="text-sm text-red-600">{quoteError}</p>
            )}
            {quote && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarifa base</span>
                  <span>{formatPrice(quote.fareCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarifa de plataforma</span>
                  <span>{formatPrice(quote.platformFeeCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Distancia</span>
                  <span>{quote.distanceKm} km (~{quote.durationMin} min)</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatPrice(quote.totalCents)}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Book button or Stripe form */}
        {!bookingResult ? (
          <>
            <button
              onClick={handleBook}
              disabled={!isFormComplete || bookingLoading}
              className="w-full rounded-md bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bookingLoading ? "Creando reserva..." : "Confirmar y pagar"}
            </button>
            {bookingError && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{bookingError}</p>
            )}
          </>
        ) : (
          <>
            {bookingResult.stripeClientSecret.startsWith("dev_secret_") ? (
              <div className="rounded-lg border bg-amber-50 p-6 text-center">
                <p className="font-medium text-amber-800">Modo desarrollo</p>
                <p className="mt-1 text-sm text-amber-600">
                  Stripe no está configurado. La reserva #{bookingResult.bookingId} fue creada sin pago real.
                </p>
                <button
                  onClick={() => setPaymentSuccess(true)}
                  className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Simular pago exitoso
                </button>
              </div>
            ) : getStripe() ? (
              <Elements stripe={getStripe()!} options={{ clientSecret: bookingResult.stripeClientSecret }}>
                <StripePaymentForm
                  clientSecret={bookingResult.stripeClientSecret}
                  bookingId={bookingResult.bookingId}
                  onSuccess={() => setPaymentSuccess(true)}
                />
              </Elements>
            ) : (
              <div className="rounded-lg border bg-red-50 p-6 text-center">
                <p className="text-sm text-red-600">
                  Error: Stripe no está configurado correctamente.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
