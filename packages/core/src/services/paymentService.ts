import type { PaymentIntentResponse } from "../types";

export async function createPaymentIntent(
  bookingId: string,
  totalCents: number
): Promise<PaymentIntentResponse> {
  // Paso 8: Integrar Stripe aquí
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: totalCents,
  //   currency: "usd",
  //   metadata: { bookingId },
  // });
  // await prisma.payment.update({
  //   where: { bookingId },
  //   data: { stripePaymentIntentId: paymentIntent.id },
  // });
  // return { bookingId, status: "PENDING", stripeClientSecret: paymentIntent.client_secret! };

  throw new Error("Stripe no configurado aún — Paso 8");
}

export async function handlePaymentSucceeded(
  stripePaymentIntentId: string
): Promise<void> {
  // Paso 9: Actualizar Payment + Booking al recibir webhook de Stripe
  throw new Error("Stripe webhook no implementado aún — Paso 9");
}

export async function handlePaymentFailed(
  stripePaymentIntentId: string
): Promise<void> {
  // Paso 9: Marcar como FAILED al recibir webhook de Stripe
  throw new Error("Stripe webhook no implementado aún — Paso 9");
}
