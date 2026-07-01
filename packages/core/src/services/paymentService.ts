import { prisma } from "@repo/db";
import { getStripe } from "../lib/stripe";
import { sendBookingConfirmation } from "./emailService";
import type { PaymentIntentResponse } from "../types";

export async function createPaymentIntent(
  bookingId: string,
  totalCents: number
): Promise<PaymentIntentResponse> {
  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amountCents: totalCents,
      stripePaymentIntentId: "pending",
    },
  });

  const stripe = getStripe();

  if (!stripe) {
    return {
      bookingId,
      status: "PENDING",
      stripeClientSecret: `dev_secret_${bookingId}`,
    };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    metadata: { bookingId, paymentId: payment.id },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return {
    bookingId,
    status: "PENDING",
    stripeClientSecret: paymentIntent.client_secret!,
  };
}

export async function handlePaymentSucceeded(
  stripePaymentIntentId: string
): Promise<void> {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId },
    data: { status: "SUCCEEDED", paidAt: new Date() },
  });

  const booking = await prisma.booking.findFirst({
    where: { payment: { stripePaymentIntentId } },
    include: { passenger: true },
  });

  if (booking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });

    try {
      await sendBookingConfirmation({
        passengerName: booking.passenger.fullName,
        passengerEmail: booking.passenger.email,
        originAddress: booking.originAddress,
        destAddress: booking.destAddress,
        scheduledAt: booking.scheduledAt.toISOString(),
        serviceType: booking.serviceType,
        totalCents: booking.baseFareCents + booking.platformFeeCents,
        bookingId: booking.id,
      });
    } catch (error) {
      console.error("[payment] Failed to send confirmation email:", error);
    }
  }
}

export async function handlePaymentFailed(
  stripePaymentIntentId: string
): Promise<void> {
  await prisma.payment.updateMany({
    where: { stripePaymentIntentId },
    data: { status: "FAILED" },
  });

  const booking = await prisma.booking.findFirst({
    where: { payment: { stripePaymentIntentId } },
  });

  if (booking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
  }
}
