# Rymvo — MVP (Fase 1)

Plataforma de reserva de transporte de lujo. Monorepo Turborepo con Next.js 16 (App Router).

## Regla crítica de arquitectura

**Toda la lógica de negocio vive en `packages/core/` o en `app/api/v1/`, NUNCA dentro de Server Components, layouts o pages.**
Esto garantiza que Go pueda reemplazar las API Routes en Fase 3 sin tocar el frontend.

```ts
// ✅ packages/core/services/bookingService.ts
export async function createBooking(data: CreateBookingInput): Promise<Booking> { /* lógica aquí */ }

// ✅ app/api/v1/bookings/route.ts — solo orquesta
import { createBooking } from '@repo/core/services/bookingService'
export async function POST(req: Request) {
  const body = await req.json()
  return Response.json(await createBooking(body))
}
```

## Stack tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 15.5 (App Router) |
| Lenguaje | TypeScript 5+ strict |
| Auth | Clerk (`@clerk/nextjs`) |
| ORM | Prisma 5+ |
| DB | PostgreSQL (Neon) |
| Pagos | Stripe |
| Email | Resend |
| UI | shadcn/ui + Tailwind CSS |
| Mapas | Google Places API |
| Deploy | Vercel |

## Estructura del proyecto

```

apps/web/          ← Next.js 16 (App Router) — única app en Fase 1
  app/
    (public)/      ← landing, login, signup
    (passenger)/   ← rutas del pasajero autenticado
    (driver)/      ← portal del conductor
    (admin)/       ← backoffice admin
    api/v1/        ← todos los endpoints REST
  components/      ← componentes UI exclusivos de web
  middleware.ts    ← Clerk auth middleware (Next.js 15 usa middleware.ts)

packages/
  core/            ← lógica compartida (hooks, services, types, utils, constants)
  db/              ← Prisma schema + cliente singleton
  ui-web/          ← Design system (shadcn/ui + Tailwind)
```

## Uso de skills

Antes de implementar cambios, revisar las skills instaladas en `.agents/skills/` y aplicar las que correspondan al stack y al problema: Next.js, React, Tailwind, accesibilidad, SEO, Clerk, Prisma, Stripe y Turborepo. Las skills son una guía de decisión y verificación, no sustituyen la revisión del código existente; validar siempre permisos en servidor, límites entre Server y Client Components, responsive design, accesibilidad y los comandos de build/typecheck.

## Variables de entorno (.env)

```
DATABASE_URL=postgresql://user:pass@neon.tech/rymvo
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_PLACES_API_KEY=AIza...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tudominio.com
NEXT_PUBLIC_APP_URL=https://tudominio.com
```

## Comandos

```bash
pnpm install          # Instalar dependencias
pnpm dev              # Iniciar desarrollo (Turborepo)
pnpm build            # Build de todos los packages
pnpm lint             # Lint de todos los packages
pnpm typecheck        # TypeScript check
```

## Orden de construcción (15 pasos)

Seguir este orden EXACTO. No avanzar sin completar el paso anterior.

- [x] **Paso 1**: Inicializar monorepo Turborepo + pnpm workspaces (apps/web, packages/core, packages/db, packages/ui-web)
- [x] **Paso 2**: Definir `packages/db/prisma/schema.prisma` completo y correr migración inicial
- [x] **Paso 3**: Generar cliente Prisma y exponerlo como singleton en `packages/db/index.ts`
- [x] **Paso 4**: Construir `packages/core`: types/ → utils/ (calcFare) → services/ (bookingService, quoteService)
- [x] **Paso 5**: Configurar Clerk en `apps/web`: SDK, variables de entorno, `middleware.ts`
- [x] **Paso 6**: Implementar `POST /api/v1/clerk-webhook` para sincronizar usuarios
- [x] **Paso 7**: Implementar `GET /api/v1/quotes` y `GET /api/v1/availability`
- [x] **Paso 8**: Implementar `POST /api/v1/bookings` + Stripe PaymentIntent
- [x] **Paso 9**: Implementar `POST /api/v1/stripe-webhook` con verificación de firma
- [x] **Paso 10**: Integrar Resend para emails de confirmación
- [x] **Paso 11**: Construir UI del pasajero (`/passenger/book`)
- [x] **Paso 12**: Construir portal del conductor (`/driver/schedule`)
- [x] **Paso 13**: Construir backoffice admin (`/admin/bookings`)
- [ ] **Paso 14**: Pruebas end-to-end con Stripe modo test
- [ ] **Paso 15**: Deploy a Vercel

Pasos 1-10 son backend puro y pueden probarse con curl/Postman antes de cualquier UI.

## Referencia de arquitectura completa

Para detalles de schema Prisma, contratos de API, wireframes y lógica de negocio, leer:
`@arquitectura_transporte_mvp.md`
