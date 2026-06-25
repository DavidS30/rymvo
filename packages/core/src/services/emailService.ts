export async function sendBookingConfirmation(
  toEmail: string,
  bookingDetails: {
    passengerName: string;
    originAddress: string;
    destAddress: string;
    scheduledAt: string;
    serviceType: string;
  }
): Promise<void> {
  // Paso 10: Integrar Resend aquí
  // await resend.emails.send({
  //   from: process.env.RESEND_FROM_EMAIL!,
  //   to: toEmail,
  //   subject: "Reserva confirmada — Rymvo",
  //   html: generateConfirmationHtml(bookingDetails),
  // });

  // Por ahora solo logueamos
  console.log("[Email] Booking confirmation would be sent to:", toEmail);
  console.log("[Email] Details:", bookingDetails);
}

export async function sendDriverAssignment(
  toEmail: string,
  bookingDetails: {
    driverName: string;
    passengerName: string;
    originAddress: string;
    destAddress: string;
    scheduledAt: string;
    serviceType: string;
  }
): Promise<void> {
  // Paso 10: Integrar Resend aquí
  console.log("[Email] Driver assignment would be sent to:", toEmail);
  console.log("[Email] Details:", bookingDetails);
}
