import { getResend } from "../lib/resend";
import { APP_NAME } from "../constants";
import { formatCentsToDisplay } from "../utils";

type BookingConfirmationInput = {
  passengerName: string;
  passengerEmail: string;
  originAddress: string;
  destAddress: string;
  scheduledAt: string;
  serviceType: string;
  totalCents: number;
  bookingId: string;
};

type DriverAssignmentInput = {
  driverName: string;
  driverEmail: string;
  passengerName: string;
  originAddress: string;
  destAddress: string;
  scheduledAt: string;
  serviceType: string;
  bookingId: string;
};

const serviceLabels: Record<string, string> = {
  AIRPORT: "Traslado al aeropuerto",
  HOURLY: "Servicio por hora",
  EVENT: "Evento especial",
};

export async function sendBookingConfirmation(
  input: BookingConfirmationInput
): Promise<void> {
  const resend = getResend();

  const html = buildConfirmationHtml(input);

  if (!resend) {
    console.log("[Email] Booking confirmation (no Resend key configured):");
    console.log("  To:", input.passengerEmail);
    console.log("  Subject: Reserva confirmada —", APP_NAME);
    console.log("  Booking:", input.bookingId);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: input.passengerEmail,
    subject: `Reserva confirmada — ${APP_NAME}`,
    html,
  });
}

export async function sendDriverAssignment(
  input: DriverAssignmentInput
): Promise<void> {
  const resend = getResend();

  const html = buildAssignmentHtml(input);

  if (!resend) {
    console.log("[Email] Driver assignment (no Resend key configured):");
    console.log("  To:", input.driverEmail);
    console.log("  Subject: Nuevo viaje asignado —", APP_NAME);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: input.driverEmail,
    subject: `Nuevo viaje asignado — ${APP_NAME}`,
    html,
  });
}

function buildConfirmationHtml(input: BookingConfirmationInput): string {
  const date = new Date(input.scheduledAt).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = new Date(input.scheduledAt).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#000;color:#fff;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:24px">${APP_NAME}</h1>
    <p style="margin:8px 0 0;opacity:0.8">Reserva confirmada</p>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p style="font-size:16px">Hola <strong>${input.passengerName}</strong>,</p>
    <p>Tu reserva ha sido confirmada. Aquí están los detalles:</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 0;color:#666">Servicio</td>
        <td style="padding:8px 0;font-weight:bold">${serviceLabels[input.serviceType] ?? input.serviceType}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Fecha</td>
        <td style="padding:8px 0;font-weight:bold">${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Hora</td>
        <td style="padding:8px 0;font-weight:bold">${time}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Origen</td>
        <td style="padding:8px 0;font-weight:bold">${input.originAddress}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Destino</td>
        <td style="padding:8px 0;font-weight:bold">${input.destAddress}</td>
      </tr>
      <tr style="border-top:1px solid #e5e5e5">
        <td style="padding:16px 0 0;color:#666">Total</td>
        <td style="padding:16px 0 0;font-size:20px;font-weight:bold">${formatCentsToDisplay(input.totalCents)}</td>
      </tr>
    </table>

    <p style="margin-top:24px;font-size:14px;color:#888">Reserva #${input.bookingId}</p>

    <p style="margin-top:24px;font-size:14px;color:#666">
      Si necesitas modificar o cancelar tu reserva, contáctanos.
    </p>
  </div>
  <div style="text-align:center;padding:16px;font-size:12px;color:#aaa">
    ${APP_NAME} — Transporte de lujo
  </div>
</body>
</html>`;
}

function buildAssignmentHtml(input: DriverAssignmentInput): string {
  const date = new Date(input.scheduledAt).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = new Date(input.scheduledAt).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#000;color:#fff;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:24px">${APP_NAME}</h1>
    <p style="margin:8px 0 0;opacity:0.8">Nuevo viaje asignado</p>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p style="font-size:16px">Hola <strong>${input.driverName}</strong>,</p>
    <p>Se te ha asignado un nuevo viaje:</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 0;color:#666">Pasajero</td>
        <td style="padding:8px 0;font-weight:bold">${input.passengerName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Servicio</td>
        <td style="padding:8px 0;font-weight:bold">${serviceLabels[input.serviceType] ?? input.serviceType}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Fecha</td>
        <td style="padding:8px 0;font-weight:bold">${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Hora</td>
        <td style="padding:8px 0;font-weight:bold">${time}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Origen</td>
        <td style="padding:8px 0;font-weight:bold">${input.originAddress}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#666">Destino</td>
        <td style="padding:8px 0;font-weight:bold">${input.destAddress}</td>
      </tr>
    </table>

    <p style="margin-top:24px;font-size:14px;color:#888">Reserva #${input.bookingId}</p>
  </div>
  <div style="text-align:center;padding:16px;font-size:12px;color:#aaa">
    ${APP_NAME} — Transporte de lujo
  </div>
</body>
</html>`;
}
