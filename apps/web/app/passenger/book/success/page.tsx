export default function SuccessPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4">
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">¡Pago exitoso!</h2>
        <p className="mt-2 text-gray-600">Tu reserva ha sido confirmada.</p>
        <p className="mt-1 text-sm text-gray-400">
          Recibirás un email con los detalles de tu viaje.
        </p>
      </div>
    </main>
  );
}
