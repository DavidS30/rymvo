export interface Dictionary {
  nav: {
    services: string;
    philosophy: string;
    contact: string;
    signIn: string;
    createAccount: string;
    dashboard: string;
  };
  hero: {
    tagline: string;
    titlePart1: string;
    titlePart2: string;
    subtitle: string;
    cta: string;
    secondary: string;
    watermark: string;
  };
  services: {
    heading: string;
    titlePart1: string;
    titlePart2: string;
    subtitle: string;
    transferTitle: string;
    transferDesc: string;
    airportTitle: string;
    airportDesc: string;
    tailoredTitle: string;
    tailoredDesc: string;
  };
  philosophy: {
    tagline: string;
    titlePart1: string;
    titlePart2: string;
    body: string;
  };
  footer: {
    copyright: string;
    tagline: string;
  };
  theme: {
    dark: string;
    light: string;
  };
  language: {
    label: string;
  };
  driver: {
    title: string;
    subtitle: string;
    availability: string;
    available: string;
    unavailable: string;
    availableBtn: string;
    unavailableBtn: string;
    confirmedToday: string;
    inProgress: string;
    dailyEarnings: string;
    noTrips: string;
    note: string;
    originOnMaps: string;
    destOnMaps: string;
    originOnWaze: string;
    destOnWaze: string;
    agenda: string;
    driverPortal: string;
  };
  passenger: {
    title: string;
    subtitle: string;
    airport: string;
    airportDesc: string;
    hourly: string;
    hourlyDesc: string;
    event: string;
    eventDesc: string;
    duration: string;
    hours: string;
    originLabel: string;
    originPlaceholder: string;
    originPlaceholderHourly: string;
    destLabel: string;
    destPlaceholder: string;
    date: string;
    time: string;
    selectTime: string;
    loading: string;
    notes: string;
    notesPlaceholder: string;
    quote: string;
    quotePlaceholder: string;
    fare: string;
    fee: string;
    distance: string;
    total: string;
    confirmAndPay: string;
    creatingBooking: string;
    back: string;
    summary: string;
    service: string;
    summaryDate: string;
    securePayment: string;
    payAndConfirm: string;
    processingPayment: string;
    reservationId: string;
    bookingConfirmed: string;
    confirmationEmail: string;
    devMode: string;
    devModeMsg: string;
    devModeBtn: string;
    paymentError: string;
  };
  status: {
    CONFIRMED: string;
    PENDING: string;
    IN_PROGRESS: string;
    COMPLETED: string;
    CANCELLED: string;
    all: string;
    today: string;
    thisWeek: string;
    thisMonth: string;
    allDates: string;
  };
  admin: {
    denied: string;
    deniedMsg: string;
    backHome: string;
    control: string;
    sideBookings: string;
    sideUsers: string;
    sideDrivers: string;
    sideTariffs: string;
    sideReports: string;
  };
  common: {
    error: string;
    retry: string;
  };
}
