export type ServiceType = "AIRPORT" | "HOURLY" | "EVENT";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentStatus =
  | "REQUIRES_PAYMENT"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED";
export type Role = "PASSENGER" | "DRIVER" | "ADMIN";

export type FareRule = {
  id: string;
  serviceType: ServiceType;
  baseFareCents: number;
  pricePerKmCents: number;
  pricePerHourCents?: number;
  platformFeePct: number;
  isActive: boolean;
};

export type Payment = {
  id: string;
  bookingId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
  receiptUrl?: string;
};

export type Booking = {
  id: string;
  passengerId: string;
  driverId?: string;
  originAddress: string;
  destAddress: string;
  scheduledAt: Date;
  serviceType: ServiceType;
  status: BookingStatus;
  baseFareCents: number;
  platformFeeCents: number;
  distanceKm: number;
  specialNotes?: string;
  createdAt: Date;
  payment?: Payment;
};

export type CreateBookingInput = {
  originAddress: string;
  originLat: number;
  originLng: number;
  destAddress: string;
  destLat: number;
  destLng: number;
  scheduledAt: string;
  serviceType: ServiceType;
  specialNotes?: string;
};

export type QuoteInput = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  serviceType: ServiceType;
  hours?: number;
};

export type QuoteResponse = {
  fareCents: number;
  platformFeeCents: number;
  totalCents: number;
  distanceKm: number;
  durationMin: number;
};

export type AvailabilityResponse = {
  availableSlots: string[];
};

export type BookingResponse = {
  id: string;
  status: BookingStatus;
  totalCents: number;
  scheduledAt: string;
  serviceType: ServiceType;
  originAddress: string;
  destAddress: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export type UserSession = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
};

export type BookingFilter = {
  status?: BookingStatus;
  driverId?: string;
  passengerId?: string;
  date?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type PaymentIntentResponse = {
  bookingId: string;
  status: "PENDING";
  stripeClientSecret: string;
};
