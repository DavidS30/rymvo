# Apoyo Técnico — Rymvo MVP

Documento personal de referencia para entender los conceptos técnicos usados en el proyecto.

---

## 1. ¿Qué es Turborepo?

**Turborepo** es un orquestador de tareas para monorepos. Un monorepo es un solo repositorio Git que contiene **múltiples proyectos** (packages y aplicaciones) en lugar de tener un repo por cada uno.

### ¿Qué problema resuelve?

Sin Turborepo, si tenés 4 proyectos en un monorepo y ejecutás `pnpm build`, cada proyecto se construye de forma secuencial y sin caché, repitiendo trabajo innecesario. Turborepo:

| Funcionalidad | Explicación |
|---|---|
| **Ejecución en paralelo** | Ejecuta tareas de múltiples packages al mismo tiempo cuando son independientes |
| **Caché inteligente** | Si un package no cambió ni sus dependencias, usa el resultado cacheado de la build anterior en vez de re-ejecutar |
| **Grafo de dependencias** | Entiende qué package depende de cuál, y construye en el orden correcto (ej: `core` depende de `db`, entonces `db` se construye primero) |
| **Pipeline definible** | En `turbo.json` declarás qué tareas dependen de qué otras. Ej: `build` depende de `^build` (build de dependencias primero) |

### Ejemplo concreto de este proyecto

Cuando ejecutás `pnpm build`:
```
turbo.json dice: "build" → dependsOn: ["^build"]

Turborepo analiza:
  @repo/ui-web → no depende de nadie → build primero (en paralelo)
  @repo/db     → no depende de nadie → build primero (en paralelo)
  @repo/core   → depende de @repo/db  → build DESPUÉS de que @repo/db termine
  @repo/web    → depende de @repo/core, @repo/db, @repo/ui-web → build AL FINAL

Turborepo cachea: si @repo/db no cambió, no lo recompila, usa caché.
```

---

## 2. ¿Por qué separar en packages?

La arquitectura define 4 packages con responsabilidades estrictas:

| Package | Responsabilidad | Puede importar de |
|---|---|---|
| `@repo/db` | Prisma schema + cliente singleton | Solo dependencias externas |
| `@repo/core` | Lógica de negocio pura (servicios, tipos, utilidades) | `@repo/db` |
| `@repo/ui-web` | Componentes visuales (shadcn/ui + Tailwind) | Solo React y dependencias visuales |
| `@repo/web` | App Next.js (rutas, layouts, API routes) | `@repo/core`, `@repo/db`, `@repo/ui-web` |

### Ventajas de esta separación:

1. **Código reutilizable**: en Fase 3, cuando se cree `apps/mobile` (React Native), podrá importar `@repo/core` directamente sin reescribir nada
2. **Cambiar backend sin tocar frontend**: si en Fase 3 Go reemplaza API Routes, el frontend (que consume servicios de `@repo/core`) no cambia
3. **TypeScript estricto por capa**: cada package tiene su `tsconfig.json` con reglas específicas
4. **Builds más rápidos**: solo se recompila lo que cambió

### La regla de oro

> **NUNCA pongas lógica de negocio en Server Components, layouts o pages.**
> Solo en `packages/core/services/` o en `app/api/v1/`.

Ejemplo de lo CORRECTO:
```ts
// packages/core/services/bookingService.ts — lógica real
export async function createBooking(data) { ... }

// app/api/v1/bookings/route.ts — solo orquesta, cero lógica
import { createBooking } from '@repo/core/services/bookingService'
export async function POST(req: Request) {
  return Response.json(await createBooking(await req.json()))
}
```

Ejemplo de lo INCORRECTO:
```ts
// ❌ app/(passenger)/book/page.tsx
// NO hacer esto — la lógica de negocio NO va en Server Components
async function BookPage() {
  const booking = await prisma.booking.create(...)
  return <div>...</div>
}
```

---

## 3. ¿Por qué cada package tiene su propio `package.json`?

Cada package es un **módulo independiente** con sus propias dependencias, scripts y configuración de TypeScript.

### Explicación por package:

#### `packages/db/package.json`
```json
{
  "name": "@repo/db",
  "dependencies": { "@prisma/client": "^5.22.0" },
  "devDependencies": { "prisma": "^5.22.0" },
  "scripts": { "db:generate": "prisma generate", "db:migrate": "prisma migrate dev" }
}
```
- Solo necesita Prisma. No necesita React, Next.js ni nada visual.
- Exporta el cliente Prisma como singleton → cualquier package que lo importe usa la misma instancia.

#### `packages/core/package.json`
```json
{
  "name": "@repo/core",
  "dependencies": { "@repo/db": "workspace:*" }
}
```
- `"workspace:*"` le dice a pnpm: "usá la versión local de `@repo/db` que está en este monorepo".
- Solo depende de `@repo/db`, no de React ni Next.js → portable a React Native en el futuro.

#### `packages/ui-web/package.json`
```json
{
  "name": "@repo/ui-web",
  "peerDependencies": { "react": "^19.0.0" }
}
```
- Solo tiene dependencias visuales (React, Tailwind). No conoce Prisma ni Stripe.
- `peerDependencies`: no instala su propia copia de React, usa la que ya tiene `@repo/web`.

#### `apps/web/package.json`
```json
{
  "name": "@repo/web",
  "dependencies": {
    "@repo/core": "workspace:*",
    "@repo/db": "workspace:*",
    "@repo/ui-web": "workspace:*",
    "next": "^16.2.0",
    "@clerk/nextjs": "^6.9.0"
  }
}
```
- Este es el "ensamblador": junta todos los packages locales + dependencias externas.
- Es el único que necesita Next.js, Clerk, Stripe.

### ¿Cómo se conectan?

```
pnpm-workspace.yaml define qué carpetas son "packages":
  packages:
    - "apps/*"
    - "packages/*"

Cuando hacés pnpm install:
  1. pnpm escanea apps/* y packages/*
  2. Crea symlinks en node_modules/@repo/ → apuntan a cada package local
  3. Cada package puede importar otro con import { algo } from "@repo/core"
```

---

## 4. El rol de cada archivo importante

| Archivo | Propósito |
|---|---|
| `package.json` (raíz) | Define workspaces, scripts globales (`pnpm dev`, `pnpm build`), dependencias compartidas (turbo, typescript) |
| `pnpm-workspace.yaml` | Declara qué carpetas contienen packages del monorepo |
| `turbo.json` | Pipeline de tareas para Turborepo: qué depende de qué, qué se cachea |
| `tsconfig.json` (raíz) | Config base de TypeScript (strict mode, ES2022) — los packages la extienden |
| `.env` | Variables de entorno (placeholders hasta tener keys reales) |
| `pnpm-lock.yaml` | Bloquea versiones exactas de dependencias (como package-lock.json) |

---

## 5. Glosario rápido

| Término | Significado |
|---|---|
| **Monorepo** | Un solo repo Git con múltiples proyectos |
| **Workspace** | Cada carpeta declarada en pnpm-workspace.yaml es un workspace |
| **Package** | Sinónimo de workspace: un proyecto con su propio package.json |
| **Barrel export** | Un `index.ts` que re-exporta todo lo de su carpeta (`export * from "./types"`) |
| **Singleton** | Patrón donde solo existe UNA instancia de algo (ej: el cliente Prisma) |
| **`workspace:*`** | En package.json, referencia a otro package del monorepo (pnpm lo resuelve localmente) |
| **Peer dependency** | Dependencia que NO se instala automáticamente; el consumidor debe proveerla |
| **Transpile** | Convertir TypeScript a JavaScript (lo hace Turbopack/tsc) |

---

## 6. Docker para desarrollo local

### ¿Por qué Docker?

En lugar de instalar PostgreSQL directamente en tu máquina, usamos un contenedor Docker. Ventajas:
- **Aislado**: no contamina tu sistema operativo
- **Reproducible**: cualquier developer con Docker obtiene exactamente la misma versión de PostgreSQL (17)
- **Descartable**: si rompés la base de datos, borrás el volumen y empezás de cero
- **Cero configuración manual**: todo está definido en `docker-compose.yml`

### El archivo `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:17-alpine    # PostgreSQL 17, versión ligera (alpine)
    container_name: rymvo_db
    environment:
      POSTGRES_DB: rymvo       # nombre de la base de datos
      POSTGRES_USER: postgres          # usuario admin
      POSTGRES_PASSWORD: postgres      # contraseña (solo para desarrollo local)
    ports:
      - "5432:5432"                    # mapea el puerto del contenedor a tu máquina
    volumes:
      - pgdata:/var/lib/postgresql/data  # persistencia: los datos sobreviven reinicios
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]  # verifica que PostgreSQL acepte conexiones
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:  # volumen nombrado: Docker lo gestiona, no ocupa espacio en tu proyecto
```

### Comandos útiles

```bash
docker compose up -d              # levantar PostgreSQL en background
docker compose down               # detener y eliminar contenedor (datos persisten en volumen)
docker compose down -v            # detener Y eliminar volumen (borra todos los datos)
docker compose ps                 # ver estado del contenedor
docker compose logs db            # ver logs de PostgreSQL
docker compose exec db psql -U postgres -d rymvo  # conectar a la DB directamente
```

### Importante para producción

En desarrollo usamos `postgres:postgres@localhost`. En producción (Neon), la URL será:
```
postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/rymvo?sslmode=require
```

Nunca subas credenciales reales al repositorio. El `.env` está en `.gitignore`.

---

## 7. Prisma: schema, migraciones y seed

### ¿Qué es Prisma?

**Prisma** es un ORM (Object-Relational Mapper) para TypeScript/Node.js. En lugar de escribir SQL a mano, definís modelos en `schema.prisma` y Prisma genera:
1. **Cliente TypeScript** con tipos automáticos para todas tus consultas
2. **Migraciones SQL** para crear/alterar tablas de forma versionada

### El schema (`packages/db/prisma/schema.prisma`)

Define 4 modelos:

| Modelo | Tabla | Propósito |
|---|---|---|
| `User` | `users` | Usuarios sincronizados desde Clerk |
| `Booking` | `bookings` | Reservas de transporte |
| `Payment` | `payments` | Registro de pagos con Stripe |
| `FareRule` | `fare_rules` | Reglas de tarifa por tipo de servicio |

Prisma usa directivas especiales en los comentarios del modelo:
- `@id` → clave primaria
- `@unique` → valor único (email, stripePaymentIntentId)
- `@default(uuid())` → genera un UUID automáticamente
- `@map("column_name")` → mapea el campo a un nombre de columna SQL (convención snake_case)
- `@@map("table_name")` → nombre real de la tabla en la DB

### Flujo de migraciones

```bash
# 1. Modificás schema.prisma (agregar/quitar modelos o campos)
# 2. Creás y aplicás la migración:
pnpm --filter @repo/db db:migrate

# Esto ejecuta: prisma migrate dev --name nombre_de_la_migracion
# Prisma:
#   a. Compara el schema actual con la DB
#   b. Genera un archivo SQL en packages/db/prisma/migrations/
#   c. Aplica el SQL a la base de datos
#   d. Regenera el cliente Prisma con los nuevos tipos

# 3. La migración queda versionada en Git (se commitea)
```

### El cliente Prisma singleton (`packages/db/src/index.ts`)

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**¿Por qué singleton?** En desarrollo, Next.js hace hot reload y cada recarga crearía una nueva conexión a la DB. El patrón singleton guarda la instancia en `globalThis` para reutilizarla y evitar saturar PostgreSQL con conexiones duplicadas.

### Seed de datos iniciales (`packages/db/prisma/seed.ts`)

El seed inserta datos necesarios para que la app funcione desde el primer momento:

```ts
const rules = [
  { serviceType: "AIRPORT", baseFareCents: 5000, pricePerKmCents: 250, platformFeePct: 7.0 },
  { serviceType: "HOURLY",  baseFareCents: 0,    pricePerHourCents: 7500, platformFeePct: 7.0 },
  { serviceType: "EVENT",   baseFareCents: 10000, pricePerKmCents: 300, platformFeePct: 10.0 },
];
```

Usa `upsert` (update + insert): si la regla ya existe la actualiza, si no, la crea. Así el seed es idempotente (se puede correr múltiples veces sin duplicar).

---

## 8. Variables de entorno y `.env`

### Jerarquía de `.env` en el proyecto

```
rymvo/
├── .env                          ← variables globales (DATABASE_URL, keys de Clerk, Stripe, etc.)
├── packages/db/.env              ← COPIA de .env raíz (Prisma lo necesita en su directorio)
```

**¿Por qué hay dos `.env`?** Prisma CLI (`prisma migrate dev`, `prisma db seed`) busca `.env` en el directorio donde se ejecuta. Como Turborepo ejecuta el script `db:migrate` dentro de `packages/db/`, necesita encontrar las variables ahí. La solución más simple fue copiarlo.

En producción (Paso 15, Vercel), las variables se configuran en el dashboard de Vercel, no en archivos `.env`.

### Variables actuales (Pasos 1-10 completados)

| Variable | Estado | Para qué sirve |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/rymvo` ✅ | Conexión a Docker PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_c3VpdGFibGV...` ✅ | Key pública de Clerk (va al navegador) |
| `CLERK_SECRET_KEY` | `sk_test_GtPrpBGT...` ✅ | Key secreta de Clerk (solo servidor) |
| `CLERK_WEBHOOK_SECRET` | `whsec_placeholder` ❌ | Falta configurar en Clerk Dashboard |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder` ❌ | Falta obtener de Stripe Dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_placeholder` ❌ | Falta obtener de Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | `whsec_placeholder` ❌ | Falta obtener de Stripe CLI o Dashboard |
| `GOOGLE_PLACES_API_KEY` | `placeholder` ❌ | Falta para Paso 7 (distancia real) |
| `RESEND_API_KEY` | `re_placeholder` ❌ | Falta obtener de Resend Dashboard |
| `RESEND_FROM_EMAIL` | `noreply@rymvo.com` ⚠️ | Necesita dominio verificado en Resend |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` ✅ | Clerk redirige acá si no hay sesión |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` ✅ | Clerk redirige acá para registrarse |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` ✅ | Después de login, va al home |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` ✅ | Después de registro, va al home |

### ¿Por qué hay TRES archivos `.env`?

```
rymvo/
├── .env                          ← Raíz del monorepo: DATABASE_URL, keys globales (referencia centralizada)
├── apps/web/.env.local           ← Next.js: carga automáticamente desde SU directorio. Tiene precedencia sobre .env
└── packages/db/.env              ← Copia de .env raíz: Prisma CLI busca .env en su propio directorio
```

- **`.env` (raíz)**: usado por scripts globales como `pnpm install`, Docker, y como referencia centralizada. Turborepo lo lee para sus dependencias globales.
- **`apps/web/.env.local`**: Next.js **no lee `.env` de la raíz del monorepo**, solo de su propio directorio (`apps/web/`). `.env.local` tiene precedencia sobre `.env` en Next.js. Las keys con prefijo `NEXT_PUBLIC_` son las únicas que Next.js expone al navegador.
- **`packages/db/.env`**: Prisma CLI (`prisma migrate`, `prisma db seed`) busca `.env` en el directorio donde se ejecuta. Como Turborepo ejecuta desde `packages/db/`, necesita una copia. Se sincroniza manualmente con `cp .env packages/db/.env`.

---

## 9. ¿Cómo funciona Clerk? — Explicación técnica detallada

### ¿Qué es Clerk?

Clerk es un servicio de **autenticación como SaaS** (Authentication-as-a-Service). En lugar de escribir vos la lógica de registro, login, recuperación de contraseña, sesiones y OAuth, Clerk la provee como API + componentes de UI preconstruidos. Es similar a Auth0, pero con mejor integración nativa para Next.js.

### Componentes de Clerk en nuestro proyecto

| Componente | Tipo | Qué hace |
|---|---|---|
| `ClerkProvider` | React Context | Envuelve toda la app. Provee el contexto de autenticación a todos los componentes hijos. Sin esto, ningún componente de Clerk funciona. |
| `<SignIn />` | UI prebuilt | Formulario completo de login: email, password, "olvidé mi contraseña", OAuth (Google, etc.). Totalmente funcional, con validación de errores, estados de carga y diseño responsive. |
| `<SignUp />` | UI prebuilt | Formulario completo de registro: email, nombre, password, confirmación. Mismas características que SignIn. |
| `<UserButton />` | UI prebuilt | Muestra el avatar del usuario. Al hacer clic, despliega un menú con: perfil, cambiar contraseña, agregar email, y cerrar sesión. |
| `<SignInButton />` | UI prebuilt | Botón que abre el modal de SignIn. Con `mode="modal"` abre un popup en lugar de navegar a /sign-in. |
| `<SignUpButton />` | UI prebuilt | Igual pero para SignUp. |
| `auth()` | Server function | Se llama en Server Components y API routes. Es **async** (await obligatorio en Next.js 15+). Devuelve `{ userId, sessionId, ... }` o `null`. |
| `clerkMiddleware()` | Proxy/Edge | Intercepta cada request HTTP. Verifica si la ruta es pública o protegida. Si es protegida y no hay sesión, redirige al login. |

### El flujo de autenticación paso a paso

```
USUARIO                      NAVEGADOR                       SERVIDOR (Next.js)            CLERK (nube)
───────                      ─────────                       ─────────────────            ────────────
1. Visita /sign-in  ──────►  GET /sign-in ────────────────►  proxy.ts: es pública ✓
                                                             Devuelve <SignIn />          ──────────────►
                                                                                          
2. Llena formulario  ──────►  POST a Clerk API ─────────────────────────────────────────► Valida credenciales
   (email + password)                                                                     Crea sesión JWT
                                                                                          ←─── Devuelve JWT + cookies
                              
3. Clerk redirige a / ─────►  GET / ───────────────────────►  proxy.ts: verifica sesión
                                                              auth() → { userId: "user_123" }
                              
4. Ve la homepage     ◄─────  <main>
   con UserButton               <UserButton /> (sesión activa)
                               </main>
```

### ¿Qué es un JWT y cómo funciona la sesión?

Cuando Clerk autentica al usuario, crea un **JWT (JSON Web Token)**. Es un string firmado digitalmente que contiene:

```json
{
  "sub": "user_abc123",       // ID del usuario en Clerk
  "email": "usuario@email.com",
  "iat": 1719876543,           // cuándo se emitió
  "exp": 1720481343            // cuándo expira
}
```

Este JWT viaja en una **cookie HTTP-only** (`__session`). Eso significa que:
- El navegador la envía automáticamente en cada request
- JavaScript del navegador **no puede leerla** (protege contra XSS)
- `clerkMiddleware()` la verifica en cada request sin consultar a la nube de Clerk (la clave pública permite validar la firma localmente)

### `proxy.ts` — El guardián de las rutas

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Creamos un "matcher" — un detector de rutas
const isPublic = createRouteMatcher([
  "/",                          // landing page
  "/sign-in(.*)",               // login y subrutas
  "/sign-up(.*)",               // registro y subrutas
  "/api/v1/stripe-webhook",     // Stripe envía eventos aquí sin auth
  "/api/v1/clerk-webhook",      // Clerk envía eventos aquí sin auth
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();       // ← Bloquea: redirige a /sign-in si no hay sesión
  }
});

// Indica a Next.js qué rutas pasan por el proxy
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|...).*)",  // todas las rutas excepto assets
    "/__clerk/:path*",                                     // ruta interna de Clerk
  ],
};
```

**Explicación línea por línea:**
- `createRouteMatcher([...])`: crea una función que recibe un request y devuelve `true` si la URL coincide con alguno de los patrones. Usa expresiones regulares.
- `clerkMiddleware(async (auth, req) => {...})`: función que se ejecuta **antes** de que Next.js procese cualquier request. Recibe el objeto `auth` (tiene `.protect()`) y el request.
- `await auth.protect()`: si el usuario no tiene sesión, lanza una redirección HTTP 307 a `/sign-in`. El `await` es obligatorio en Next.js 15+.
- `config.matcher`: array de patrones que le dice a Next.js qué rutas pasan por el proxy. `__clerk/:path*` es una ruta interna que Clerk usa para manejar callbacks de OAuth y webhooks internos.

### `auth()` en Server Components y API Routes

```ts
// En un Server Component (app/page.tsx)
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();   // ← async obligatorio en Next 16

  if (userId) {
    return <p>Bienvenido, usuario {userId}</p>;
  }
  return <p>No has iniciado sesión</p>;
}
```

```ts
// En una API Route (app/api/v1/bookings/route.ts)
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  // userId es el clerkUserId que guardamos en nuestra tabla users
  const user = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  // ...
}
```

**Importante**: `auth()` devuelve el `userId` **de Clerk**, no el `id` de nuestra tabla `users`. Por eso en nuestra tabla tenemos el campo `clerkUserId` como puente entre Clerk y nuestra DB. Para obtener nuestro `User`, hacemos `prisma.user.findUnique({ where: { clerkUserId: userId } })`.

### ¿Cómo se instaló Clerk? (Paso 5 paso a paso)

1. **Instalación del CLI**: `npm install -g clerk` — herramienta de línea de comandos de Clerk
2. **Login**: `clerk auth login` — abrió navegador, nos autenticamos como `davidsalas3099@gmail.com`
3. **Inicialización**: `clerk init --app app_3Fbuj9vrGdUYbbCUjVDmsb2rH5m` — ejecutado desde `apps/web/` para que detectara Next.js. El CLI:
   - Detectó Next.js App Router + pnpm
   - Detectó que `@clerk/nextjs` ya estaba instalado
   - Detectó que `proxy.ts` ya tenía `clerkMiddleware()` → lo dejó intacto
   - Modificó `layout.tsx` → agregó `<ClerkProvider>` alrededor de `{children}`
   - Creó `sign-in/[[...sign-in]]/page.tsx` → `<SignIn />`
   - Creó `sign-up/[[...sign-up]]/page.tsx` → `<SignUp />`
   - Creó `apps/web/.env.local` con las keys reales
4. **Verificación**: `clerk doctor` → 7 checks pasados, solo warnings cosméticos
5. **Ajuste manual**: agregamos controles de auth a la homepage (`SignInButton`, `SignUpButton`, `UserButton`)

### El convenio `[[...sign-in]]` — ¿qué significan los corchetes?

En Next.js App Router, los segmentos de ruta con `[[...]]` son **catch-all opcionales**:
- `/sign-in` → renderiza `page.tsx` sin parámetros (el `[[...sign-in]]` es opcional)
- `/sign-in/verify-email` → renderiza `page.tsx` con `params.signIn = ["verify-email"]`

Clerk usa esto porque internamente tiene subrutas como `/sign-in/sso-callback` para OAuth. El catch-all captura todas.

---

## 10. Estado actual del proyecto (Pasos 1-10 completados)

| Paso | Qué se implementó | Archivos clave |
|------|------------------|----------------|
| **1** | Monorepo Turborepo + 4 packages | `package.json`, `turbo.json`, `pnpm-workspace.yaml`, 4 `tsconfig.json` |
| **2** | Prisma schema + migración + seed | `packages/db/prisma/schema.prisma`, 4 modelos, 3 FareRules |
| **3** | Cliente Prisma singleton | `packages/db/src/index.ts` — patrón globalThis |
| **4** | `packages/core` services | `types/` (16 tipos), `utils/` (calcFare, haversine), `services/` (5 archivos) |
| **5** | Clerk auth (login, registro, middleware) | `middleware.ts`, `sign-in/page.tsx`, `sign-up/page.tsx`, `layout.tsx` |
| **6** | Clerk webhook (sync usuarios) | `api/v1/clerk-webhook/route.ts` — verificación svix |
| **7** | API quotes + availability | `api/v1/quotes/route.ts`, `api/v1/availability/route.ts` |
| **8** | API bookings + Stripe PaymentIntent | `api/v1/bookings/route.ts`, `api/v1/bookings/[id]/route.ts`, `packages/core/src/services/paymentService.ts` |
| **9** | Stripe webhook | `api/v1/stripe-webhook/route.ts` — verificación de firma criptográfica |
| **10** | Emails con Resend | `packages/core/src/services/emailService.ts`, `packages/core/src/lib/resend.ts` |

### Lo que se puede hacer ahora mismo

```bash
pnpm dev                          # Arrancar servidor
# http://localhost:3000           # Homepage con botones de login/registro
# http://localhost:3000/sign-in   # Login funcional con Clerk
# http://localhost:3000/sign-up   # Registro funcional con Clerk

# API routes funcionales:
curl http://localhost:3000/api/v1/quotes?originLat=...&originLng=...&destLat=...&destLng=...&serviceType=AIRPORT
curl http://localhost:3000/api/v1/availability?date=2026-07-01
curl -X POST http://localhost:3000/api/v1/bookings -H 'Content-Type: application/json' -d '{...}'
curl http://localhost:3000/api/v1/bookings?status=CONFIRMED&page=1&limit=10
curl http://localhost:3000/api/v1/bookings/<uuid>
```

---

## 11. Próximos pasos técnicos

| Paso | Qué se hará | Concepto nuevo |
|---|---|---|
| Paso 11 | UI pasajero (`/passenger/book`) | Google Places Autocomplete, Stripe Elements, debounce |
| Paso 12 | Portal conductor (`/driver/schedule`) | Cards resumen, listado de viajes, badges de estado |
| Paso 13 | Backoffice admin (`/admin/bookings`) | Tabla paginada, filtros, sidebar de navegación |
| Paso 14 | Pruebas E2E | Stripe modo test, flujo completo |
| Paso 15 | Deploy a Vercel | Variables de entorno de producción, dominio |

---

## 12. Bugs encontrados y soluciones técnicas

Esta sección documenta cada bug encontrado durante el desarrollo, su causa técnica precisa y cómo se resolvió.

### Bug 1: Loop infinito de recarga en la homepage

**Síntoma**: la página `/` se recargaba constantemente en un ciclo sin fin. No se podía interactuar con la UI.

**Causa técnica**: `page.tsx` era un **Server Component asíncrono** que llamaba `await auth()` de Clerk:

```tsx
// ❌ Código problemático
export default async function HomePage() {
  const { userId } = await auth();  // ← async en servidor
  // ...
}
```

Cuando `auth()` fallaba (por cualquier razón: API de Clerk no disponible, sesión inválida, timeout de red), Next.js lanzaba una excepción en el servidor durante el renderizado. El error overlay de Next.js (pantalla roja de desarrollo) intentaba recuperarse vía **Fast Refresh**, que reiniciaba el componente → otra llamada a `auth()` → otro error → **loop infinito**.

**Solución**: convertir el componente a **Client Component** y usar el hook client-side de Clerk:

```tsx
// ✅ Código corregido
"use client";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth();
  // useAuth() corre en el navegador, no en el servidor
  // isLoaded permite mostrar un skeleton mientras se resuelve el estado de auth
}
```

**Por qué funciona**: `useAuth()` es un hook de React que corre en el navegador. Clerk maneja internamente los errores de red y reintentos. Si falla, simplemente no muestra el estado de "logueado" — pero no crashea el renderizado del servidor. La página pasó de `ƒ` (dinámica) a `○` (estática), porque el shell HTML se puede pre-renderizar sin esperar la resolución de auth.

---

### Bug 2: Turbopack panic — "Next.js package not found"

**Síntoma**: en `pnpm dev`, cada ~15 segundos aparecía un error FATAL de Turbopack:

```
FATAL: An unexpected Turbopack error occurred. A panic log has been written to /tmp/next-panic-*.log
Failed to write app endpoint /page
Caused by:
- Next.js package not found
```

**Causa técnica**: Next.js 16.2.9 **fuerza Turbopack** como bundler en modo desarrollo (no hay fallback a webpack). Turbopack, en su arquitectura interna, necesita resolver el package `next` desde el sistema de archivos para generar los assets de cada endpoint. En un **monorepo con pnpm**, los paquetes se almacenan en un *virtual store* con symlinks:

```
node_modules/.pnpm/next@16.2.9_.../node_modules/next/
node_modules/next → symlink a la ruta de arriba
```

Turbopack 16 no sigue correctamente la cadena de symlinks de pnpm cuando compila endpoints como `/page`. El error `Next.js package not found` ocurre porque Turbopack busca `next` esperando encontrarlo físicamente en `node_modules/next/`, pero pnpm lo tiene en el store.

Intentamos `node-linker=hoisted` en `.npmrc` (que fuerza a pnpm a aplanar `node_modules/` como npm), pero **no resolvió el problema** — Turbopack 16 tiene el bug a nivel de resolución de módulos, no solo de ubicación física.

**Solución definitiva**: **downgrade a Next.js 15.5.19**. Next.js 15 usa webpack por defecto en modo desarrollo (Turbopack es opt-in con `--turbo`). Webpack maneja correctamente los symlinks de pnpm porque usa el algoritmo de resolución de Node.js estándar.

Cambios necesarios:
1. `apps/web/package.json`: `"next": "^15.5.0"` en vez de `"^16.2.0"`
2. Renombrar `proxy.ts` → `middleware.ts` (Next.js 15 usa `middleware.ts`, no `proxy.ts`)
3. Eliminar `.npmrc` (ya no necesario)
4. Reinstalar dependencias: `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`

---

### Bug 3: CDN de Clerk inaccesible — NetworkError al cargar clerk.browser.js

**Síntoma**: en la consola del navegador:

```
Falló la carga de <script> con fuente "https://suitable-griffon-15.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
Uncaught (in promise) TypeError: NetworkError when attempting to fetch resource.
```

**Causa técnica**: Este fue un **efecto secundario del Bug 2**. Cuando Turbopack 16 hacía panic, mataba las conexiones HTTP activas del servidor de desarrollo (`ECONNRESET`). El navegador, al ver la conexión reseteada mientras intentaba descargar el JS de Clerk desde la CDN, interpretaba esto como un `NetworkError`. La CDN de Clerk **sí era accesible** (probado con `curl` desde el servidor con HTTP 307), pero el panic de Turbopack interrumpía la conexión del navegador.

**Intentos fallidos**:
1. Descargar `clerk.browser.js` localmente a `public/` y usar `clerkJSUrl` → **ChunkLoadError**: Clerk usa code splitting y carga chunks adicionales (`framework_clerk.browser_*.js`) que no existen localmente.
2. Agregar `__clerk(.*)` como ruta pública en `createRouteMatcher` → no resolvió porque la CDN es externa a nuestro servidor.
3. Cambiar `middleware.ts` ↔ `proxy.ts` → no resolvió porque el problema no era el middleware sino Turbopack.

**Solución definitiva**: al resolver el Bug 2 (downgrade a Next.js 15), la CDN de Clerk cargó correctamente porque webpack no mata las conexiones HTTP. Se eliminó el `clerkJSUrl` local y se volvió al comportamiento por defecto de ClerkProvider (cargar desde CDN oficial).

---

### Bug 4: Redirección infinita al cargar archivo estático local

**Síntoma**: al intentar servir `clerk.browser.js` desde `public/`, el navegador recibía HTML en vez de JavaScript:

```
Uncaught SyntaxError: expected expression, got '<'
GET /sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3000%2Fclerk.browser.js 200
```

**Causa técnica**: `clerkMiddleware` intercepta **todas** las requests según el matcher configurado:

```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Este regex excluye imágenes (svg, png, jpg, jpeg, gif, webp) pero **no excluye archivos `.js` ni `.css`**. Cuando el navegador solicitaba `/clerk.browser.js`, el middleware lo atrapaba, `auth.protect()` veía que no es una ruta pública y redirigía a `/sign-in`. El navegador recibía HTML en vez de JS → `SyntaxError`.

**Solución**: extender el regex del matcher para excluir archivos `.js` y `.css`:

```ts
"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css)$).*)"
```

---

### Bug 5: Crash de esbuild en Next.js 14 → 15

**Síntoma**: error en la instalación de dependencias relacionado con `esbuild` y `@prisma/client`.

**Causa técnica**: cuando se reinstalaron las dependencias con `pnpm install` tras actualizar el SDK de Clerk, ocurrió que `@prisma/client` no se regeneró automáticamente. El postinstall de Prisma espera encontrar el schema en la ruta por defecto, pero el schema está en `packages/db/prisma/`. Esto causó que las API routes que importan `@repo/db` fallaran en build porque el cliente no estaba inicializado.

**Solución**: ejecutar `pnpm --filter @repo/db db:generate` después de cada reinstalación de dependencias. Esto es necesario porque pnpm limpia los artifacts generados por Prisma durante la reinstalación.

---

## 13. Stripe — PaymentIntent y flujo de pago

### ¿Qué es Stripe?

Stripe es un **procesador de pagos** que maneja la infraestructura de cobro con tarjetas de crédito/débito, wallets digitales (Apple Pay, Google Pay), transferencias bancarias, etc. Es un servicio SaaS: nosotros no almacenamos ni procesamos datos de tarjetas (PCI compliance es responsabilidad de Stripe).

**Modelo de precios**: 2.9% + $0.30 por transacción exitosa. Sin costo mensual fijo.

### ¿Qué es un PaymentIntent?

Un **PaymentIntent** es el objeto central del modelo de Stripe. Representa **un intento de cobrar dinero** a un cliente. Su ciclo de vida:

```
[Creación] → requires_payment_method
               ↓ (cliente ingresa tarjeta)
            processing
               ↓           ↘
          succeeded       failed
               ↓           ↘
         [Pago exitoso]  [Pago rechazado]
```

Cada PaymentIntent tiene:
- `amount`: monto en **centavos** (ej: 5000 = $50.00)
- `currency`: "usd" en nuestro caso
- `client_secret`: token efímero que el frontend usa para montar el formulario de pago (Stripe Elements)
- `status`: indica en qué etapa del ciclo de vida está
- `metadata`: objeto JSON para guardar datos nuestros (bookingId, paymentId)

### Flujo completo en nuestro MVP

```
1. POST /api/v1/bookings (servidor)
   ├── createBooking() → Booking PENDING en DB
   └── createPaymentIntent()
       ├── Crea Payment en DB (amountCents, status=REQUIRES_PAYMENT)
       ├── stripe.paymentIntents.create({ amount, currency, metadata })
       ├── Actualiza Payment con stripePaymentIntentId real
       └── Retorna { bookingId, stripeClientSecret } (HTTP 201)

2. Frontend (navegador)
   ├── Recibe stripeClientSecret
   ├── Monta Stripe Elements (<Elements>, <PaymentElement>)
   └── Usuario ingresa tarjeta y confirma

3. Stripe (servidores de Stripe)
   ├── Procesa el pago con la red de tarjetas (Visa/Mastercard/etc.)
   ├── Si exitoso → envía POST a nuestro webhook
   └── Si falla → envía POST a nuestro webhook

4. POST /api/v1/stripe-webhook (nuestro servidor)
   ├── Verifica firma criptográfica del payload
   ├── Si payment_intent.succeeded:
   │   ├── handlePaymentSucceeded()
   │   │   ├── Payment.status = SUCCEEDED, Payment.paidAt = now()
   │   │   ├── Booking.status = CONFIRMED
   │   │   └── sendBookingConfirmation() → Resend email al pasajero
   │   └── Response 200
   └── Si payment_intent.payment_failed:
       └── handlePaymentFailed()
           ├── Payment.status = FAILED
           └── Booking.status = CANCELLED
```

### Cliente Stripe singleton

Archivo: `packages/core/src/lib/stripe.ts`

```ts
import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "../constants";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = STRIPE_SECRET_KEY;
  if (!key || key === "sk_test_placeholder") {
    return null;  // ← Modo dev: sin Stripe, usamos dev_secret_ placeholder
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-06-30.acacia",
    });
  }

  return stripeInstance;
}
```

**Patrón singleton**: igual que el cliente Prisma. Una sola instancia de `Stripe` para toda la app, creada bajo demanda. Si la API key es placeholder, devuelve `null` y el sistema opera en **modo desarrollo sin Stripe real**. En este modo, `createPaymentIntent()` retorna un `stripeClientSecret` falso (`dev_secret_<bookingId>`) para que el frontend no se rompa.

**Por qué en `@repo/core` y no en la API route**: el cliente Stripe se usa desde `paymentService.ts` (que está en `@repo/core`). Para mantener la regla de oro (lógica de negocio en `packages/core`), el singleton vive ahí. En Fase 3, si Go reemplaza las API Routes, la lógica de Stripe se reimplementaría en Go — pero nuestros tipos y contratos en `@repo/core` seguirían siendo la referencia.

### Verificación de firma en el webhook

Archivo: `apps/web/app/api/v1/stripe-webhook/route.ts`

```ts
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();  // ← CRÍTICO: usar .text(), NO .json()

  const stripe = getStripe();

  if (stripe && webhookSecret && webhookSecret !== "whsec_placeholder") {
    // Modo producción: verificar firma
    const event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    return await handleStripeEvent(event);
  }

  // Modo dev: parsear sin verificar firma
  const event = JSON.parse(body);
  return await handleStripeEvent(event);
}
```

**Por qué `req.text()` en vez de `req.json()`**: la verificación de firma de Stripe requiere el **body crudo exacto** (bytes tal cual llegaron por HTTP). Si se parsea con `.json()` primero, el objeto JSON se re-serializa y la firma criptográfica ya no coincide, porque el orden de las keys, el whitespace y el encoding pueden variar. `constructEvent()` necesita el string sin modificar.

**Encabezados necesarios**:
- `stripe-signature`: firma HMAC-SHA256 generada por Stripe con el webhook secret
- El body se concatena con el timestamp para calcular la firma: `HMAC(timestamp + "." + body, secret)`

**Ruta pública**: el endpoint está en `createRouteMatcher(["/api/v1/stripe-webhook"])` — no requiere autenticación de Clerk porque Stripe no tiene sesión de usuario.

### `paymentService.ts` — 3 funciones

| Función | Cuándo se llama | Qué hace en DB | Qué hace en Stripe |
|---------|----------------|----------------|-------------------|
| `createPaymentIntent(bookingId, totalCents)` | POST /api/v1/bookings | Crea `Payment` con `stripePaymentIntentId="pending"`, luego lo actualiza | `stripe.paymentIntents.create()` |
| `handlePaymentSucceeded(intentId)` | Webhook `payment_intent.succeeded` | `payment.status=SUCCEEDED`, `booking.status=CONFIRMED` | — (ya procesado) |
| `handlePaymentFailed(intentId)` | Webhook `payment_intent.payment_failed` | `payment.status=FAILED`, `booking.status=CANCELLED` | — (ya procesado) |

`handlePaymentSucceeded` **también envía el email de confirmación** llamando a `sendBookingConfirmation()`. Para obtener los datos del pasajero, hace una consulta con `include: { passenger: true }`:

```ts
const booking = await prisma.booking.findFirst({
  where: { payment: { stripePaymentIntentId } },
  include: { passenger: true },
});
```

**Manejo de errores**: el envío del email está en `try/catch` — si falla, se loguea el error pero **no se revierte el pago**. Un email fallido no debe desconfirmar una transacción exitosa.

### Variables de entorno necesarias

| Variable | Formato | Ejemplo | Dónde se obtiene |
|----------|---------|---------|-----------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` o `sk_live_...` | `sk_test_abc123` | Dashboard → Developers → API keys → Secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` o `pk_live_...` | `pk_test_xyz789` | Dashboard → Developers → API keys → Publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `whsec_def456` | Dashboard → Webhooks → Add endpoint → Signing secret |

### Configuración de Stripe CLI para desarrollo local

Para probar webhooks en desarrollo, se necesita exponer `localhost` a internet. Stripe provee su propio CLI que crea un túnel:

```bash
# Instalar
brew install stripe/stripe-cli/stripe

# Iniciar túnel (en otra terminal)
stripe listen --forward-to localhost:3000/api/v1/stripe-webhook
# → Ready! Your webhook signing secret is whsec_...

# En otra terminal, disparar un webhook de prueba
stripe trigger payment_intent.succeeded
```

El `stripe listen` imprime el `whsec_...` que debe copiarse a `.env.local` como `STRIPE_WEBHOOK_SECRET`.

---

## 14. Resend — Emails transaccionales

### ¿Qué es Resend?

Resend es una API REST para **envío de emails transaccionales**. A diferencia de SMTP tradicional, Resend provee un SDK TypeScript nativo con tipado completo y templates en React (opcional). Alternativa moderna a SendGrid, Mailgun, Postmark.

**Plan gratuito**: 100 emails/día. Suficiente para desarrollo y MVP.

### ¿Por qué Resend y no SendGrid?

| Característica | Resend | SendGrid |
|---|---|---|
| SDK TypeScript | Nativo, tipado completo | Librería comunitaria, tipado parcial |
| DX (experiencia de desarrollo) | Excelente | Regular |
| Precio | 100 emails/día gratis, luego $20/mes por 50k | 100 emails/día gratis, luego $20/mes por 50k |
| Templates | React Email o HTML plano | Templates en dashboard o API |
| Latencia | ~200ms promedio | ~500ms promedio |

### Cliente singleton

Archivo: `packages/core/src/lib/resend.ts`

```ts
import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_placeholder") {
    return null;  // ← Modo dev: loguea en consola en vez de enviar
  }

  if (!resendInstance) {
    resendInstance = new Resend(key);
  }

  return resendInstance;
}
```

Mismo patrón singleton que Stripe y Prisma:
- **Instancia única**: evita crear múltiples conexiones
- **Creación bajo demanda (lazy)**: solo se inicializa cuando se necesita
- **Graceful degradation**: si no hay API key, devuelve `null` y el sistema sigue funcionando (loguea en consola)

### Arquitectura de los emails

Los emails se construyen como **funciones que retornan HTML**. NO usamos React Email (dependencia extra innecesaria para el MVP). Cada función acepta un objeto tipado con los datos del email y retorna un string HTML con CSS inline.

**¿Por qué CSS inline?** Los clientes de email (Gmail, Outlook, Apple Mail) ignoran las etiquetas `<style>` y solo procesan estilos aplicados directamente con `style="..."`. Para asegurar que el email se vea correctamente en todos los clientes, cada elemento HTML lleva sus estilos en el atributo `style`.

### Templates implementados

#### `sendBookingConfirmation(input)` — Confirmación al pasajero

Archivo: `packages/core/src/services/emailService.ts`

**Input** (tipado):
```ts
type BookingConfirmationInput = {
  passengerName: string;    // "Juan Pérez"
  passengerEmail: string;   // "juan@email.com"
  originAddress: string;    // "Aeropuerto Internacional de Miami"
  destAddress: string;      // "South Beach, Miami"
  scheduledAt: string;      // ISO 8601
  serviceType: string;      // "AIRPORT" | "HOURLY" | "EVENT"
  totalCents: number;       // 7500 (centavos)
  bookingId: string;        // UUID
};
```

**Estructura del HTML**:
1. **Header**: fondo negro (`background:#000`), texto blanco, nombre de la app "Rymvo", subtítulo "Reserva confirmada"
2. **Cuerpo**: borde gris, tabla de 2 columnas con los detalles
   - Servicio → mapeado a texto legible (`AIRPORT` → "Traslado al aeropuerto")
   - Fecha → `toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })`
   - Hora → `toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })`
   - Origen → dirección completa
   - Destino → dirección completa
   - Total → `formatCentsToDisplay()` → "$75.00", con `font-size:20px`
3. **Footer**: ID de reserva, texto legal, branding de Rymvo

**Funciones de formateo**: `formatCentsToDisplay(cents)` convierte centavos a string con formato dólar. Definida en `packages/core/src/utils/index.ts`:

```ts
export function formatCentsToDisplay(cents: number): string {
  return `$${centsToDollars(cents)}`;  // centsToDollars: (cents / 100).toFixed(2)
}
```

**Mapa de tipos de servicio legibles**:
```ts
const serviceLabels: Record<string, string> = {
  AIRPORT: "Traslado al aeropuerto",
  HOURLY: "Servicio por hora",
  EVENT: "Evento especial",
};
```

#### `sendDriverAssignment(input)` — Asignación al conductor

Estructura similar pero adaptada para el conductor: incluye nombre del pasajero, origen, destino, fecha y hora. No incluye precio (el conductor ve sus ingresos en el portal).

### Cableado: cuándo se envían los emails

**Email de confirmación**: se dispara desde `handlePaymentSucceeded()` en `paymentService.ts`, **después** de confirmar el pago y el booking:

```ts
export async function handlePaymentSucceeded(stripePaymentIntentId: string) {
  // 1. Marcar Payment SUCCEEDED
  // 2. Buscar booking con include: { passenger: true }
  // 3. Marcar Booking CONFIRMED
  // 4. Enviar email (en try/catch)
  try {
    await sendBookingConfirmation({
      passengerName: booking.passenger.fullName,
      passengerEmail: booking.passenger.email,
      // ... resto de campos
    });
  } catch (error) {
    console.error("[payment] Failed to send confirmation email:", error);
    // NO relanzamos: un email fallido no debe desconfirmar el pago
  }
}
```

**Email de asignación**: se llamará cuando el webhook de Clerk sincronice un usuario con rol `DRIVER` y se le asigne un booking. Por ahora está implementado pero no cableado (no hay lógica de asignación de conductores en el MVP).

### Variables de entorno necesarias

| Variable | Formato | Ejemplo | Dónde se obtiene |
|----------|---------|---------|-----------------|
| `RESEND_API_KEY` | `re_...` | `re_abc123xyz` | [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Email verificado | `noreply@rymvo.com` | Resend requiere verificar el dominio de envío |

### Comportamiento sin API key

Si `RESEND_API_KEY` es placeholder (`re_placeholder`), `getResend()` devuelve `null`. `sendBookingConfirmation()` detecta esto y loguea en consola en vez de enviar:

```
[Email] Booking confirmation (no Resend key configured):
  To: juan@email.com
  Subject: Reserva confirmada — Rymvo
  Booking: abc-123-def
```

Esto permite desarrollar y testear el flujo completo sin una cuenta de Resend.

---

## 15. Clerk Webhook — Sincronización de usuarios

### ¿Qué es un webhook?

Un **webhook** es un callback HTTP: un servicio externo (Clerk) hace una petición POST a una URL nuestra cuando ocurre un evento. Es el mecanismo estándar para **integrar sistemas de forma reactiva** sin polling.

En nuestro caso: cuando un usuario se registra en Clerk, Clerk envía un POST a `POST /api/v1/clerk-webhook` con los datos del usuario. Nuestro endpoint crea un registro en la tabla `users` de nuestra base de datos.

### ¿Por qué necesitamos tabla `users` propia si Clerk ya tiene los usuarios?

Clerk es el **proveedor de autenticación** (identity provider). Maneja contraseñas, sesiones, OAuth, MFA. Pero nuestra app necesita datos adicionales que Clerk no maneja:
- `role`: PASSENGER, DRIVER, ADMIN (lógica de negocio nuestra)
- `stripeCustomerId`: vinculación con Stripe
- Relaciones con `Booking` (passengerId, driverId)

Nuestra tabla `users` es una **proyección local** de los datos de Clerk + nuestros campos de negocio. El campo `clerkUserId` es el puente: en `auth()` obtenemos el `userId` de Clerk, y con él buscamos nuestro `User` en la DB local.

### Verificación de firma con svix

**¿Qué es svix?** Svix es una librería de verificación de firmas para webhooks. Clerk (y otras empresas como Supabase, Resend) la usan para firmar los payloads de sus webhooks.

**¿Por qué verificar la firma?** Cualquiera podría hacer POST a nuestro endpoint y crear usuarios falsos. La firma criptográfica garantiza que el payload fue enviado por Clerk y no fue alterado en tránsito.

**Mecanismo de firma**:
1. Clerk genera un **webhook secret** (`whsec_...`) que compartimos solo entre Clerk y nuestro servidor
2. Para cada evento, Clerk calcula: `HMAC-SHA256(secret, svixId + "." + svixTimestamp + "." + body)`
3. El resultado se envía en el header `svix-signature`
4. Nuestro servidor recalcula la firma con el mismo secreto y compara
5. Si coinciden → el payload es auténtico. Si no → 401 Unauthorized

**Implementación en nuestro endpoint**:

```ts
import { Webhook } from "svix";

export async function POST(req: Request) {
  // 1. Leer headers de verificación
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // 2. Verificar firma
  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  wh.verify(body, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  });

  // 3. Procesar evento
  const event = payload as ClerkUserEvent;
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await prisma.user.upsert({ ... });
      break;
    case "user.deleted":
      await prisma.user.deleteMany({ ... });
      break;
  }
}
```

### Eventos manejados

| Evento | Acción en DB | Método Prisma |
|--------|-------------|---------------|
| `user.created` | Crear registro con clerkUserId, email, fullName, phone | `prisma.user.upsert()` |
| `user.updated` | Actualizar email, nombre, teléfono | `prisma.user.upsert()` |
| `user.deleted` | Borrar registro(s) | `prisma.user.deleteMany()` |

**¿Por qué `upsert` en vez de `create`?** Un mismo usuario puede generar múltiples eventos. `upsert` es idempotente: si el registro ya existe, lo actualiza; si no, lo crea. Esto hace que el webhook sea seguro de re-procesar.

**¿Por qué `deleteMany` en vez de `delete`?** Por si acaso hay duplicados (no debería, pero es más seguro).

### Formato del evento de Clerk

Clerk envía un JSON con esta estructura:

```json
{
  "type": "user.created",
  "data": {
    "id": "user_abc123",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email_addresses": [
      { "email_address": "juan@email.com" }
    ],
    "phone_numbers": [
      { "phone_number": "+525512345678" }
    ]
  }
}
```

Nuestro código extrae:
- `event.data.id` → `clerkUserId`
- `event.data.email_addresses[0].email_address` → `email`
- `event.data.first_name + " " + last_name` → `fullName`
- `event.data.phone_numbers[0]?.phone_number` → `phone`

### Configuración en Clerk Dashboard

Para que el webhook funcione, hay que configurarlo en Clerk Dashboard → Webhooks:

1. **URL**: `https://<dominio>/api/v1/clerk-webhook`
2. **Eventos**: `user.created`, `user.updated`, `user.deleted`
3. **Secret**: Clerk genera `whsec_...` → copiarlo a `CLERK_WEBHOOK_SECRET`

Para desarrollo local, se necesita exponer `localhost` con ngrok:

```bash
ngrok http 3000
# Forwarding: https://abc123.ngrok-free.app → http://localhost:3000
# URL del webhook: https://abc123.ngrok-free.app/api/v1/clerk-webhook
```

### Ruta pública

El endpoint está en `createRouteMatcher(["/api/v1/clerk-webhook"])` — no requiere autenticación de Clerk porque Clerk envía el evento, no un usuario autenticado.

---

## 16. API Routes implementadas — Contratos detallados

Esta sección documenta cada endpoint REST implementado en el MVP. Todos los endpoints usan el prefijo `/api/v1/` (obligatorio para migración futura a Go sin cambiar el frontend), retornan JSON con `Response.json()`, y siguen la regla de oro: la API route es un orquestador fino que delega la lógica a `packages/core/services/`.

### `GET /api/v1/quotes` — Cotización de viaje

| Aspecto | Detalle |
|---------|---------|
| **Auth** | Requerida (Clerk) |
| **Parámetros** | `originLat`, `originLng`, `destLat`, `destLng`, `serviceType` (query string) |
| **Validación** | Todos los parámetros requeridos. `serviceType` debe ser AIRPORT, HOURLY o EVENT |
| **Lógica** | `getQuote()` → busca FareRule activa → calcula distancia (Google Distance Matrix API con fallback Haversine) → `calcFare()` |
| **Respuesta 200** | `{ fareCents, platformFeeCents, totalCents, distanceKm, durationMin }` |
| **Errores** | 400: parámetros inválidos, serviceType inválido, tarifa no encontrada |
| **Archivo** | `apps/web/app/api/v1/quotes/route.ts` |
| **Servicio** | `packages/core/src/services/quoteService.ts` |

**Detalle de `getQuote()`**:
1. Busca `FareRule` activa para el `serviceType` con `prisma.fareRule.findFirst({ where: { serviceType, isActive: true } })`
2. Calcula distancia:
   - Si `GOOGLE_PLACES_API_KEY` está configurada → `fetch()` a `https://maps.googleapis.com/maps/api/distancematrix/json`
   - Si no (placeholder) → `haversineDistance(lat1, lng1, lat2, lng2)` — fórmula del semiverseno que calcula distancia en línea recta sobre la esfera terrestre
3. Calcula tarifa: `calcFare(rule, distanceKm)` — usa `baseFareCents + Math.round(distanceKm * pricePerKmCents)` y aplica `platformFeePct`

**Google Distance Matrix API**: endpoint REST de Google Maps. Parámetros: `origins=lat,lng`, `destinations=lat,lng`, `key=API_KEY`, `units=metric`. Respuesta: `{ rows[0].elements[0].distance.value, rows[0].elements[0].duration.value }` en metros y segundos. Nuestro código convierte metros a km (÷1000) y segundos a minutos (÷60).

**Fórmula de Haversine**: calcula la distancia ortodrómica (círculo máximo) entre dos puntos en una esfera. Fórmula:

```
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlng/2)
c = 2 * atan2(√a, √(1−a))
d = R * c
```

Donde R = 6371 km (radio medio de la Tierra). El resultado es en km. Esta fórmula es precisa (~0.3% de error) y no requiere API key. Es un fallback excelente para desarrollo.

---

### `GET /api/v1/availability` — Horarios disponibles

| Aspecto | Detalle |
|---------|---------|
| **Auth** | Requerida (Clerk) |
| **Parámetros** | `date` (YYYY-MM-DD) |
| **Validación** | Formato de fecha con regex `/^\d{4}-\d{2}-\d{2}$/` |
| **Lógica** | `getAvailableSlots()` → consulta bookings del día → bloquea ventanas ±2h → excluye horas pasadas si es hoy |
| **Respuesta 200** | `{ availableSlots: ["06:00", "07:00", ...] }` |
| **Archivo** | `apps/web/app/api/v1/availability/route.ts` |
| **Servicio** | `packages/core/src/services/availabilityService.ts` |

**Algoritmo de bloqueo de slots**:
1. Consulta todos los bookings NO cancelados del día (`scheduledAt` entre `00:00:00` y `23:59:59` de la fecha)
2. Para cada booking, marca como bloqueado el rango `[hora-2, hora+2]` (ej: booking a las 14:00 → bloquea 12:00, 13:00, 14:00, 15:00, 16:00)
3. Slots base: 06:00 a 22:00 cada hora en punto
4. Filtra: excluye horas bloqueadas + horas pasadas (si la fecha es hoy)

**¿Por qué ±2h?** Un viaje de lujo típico dura 1-2 horas entre recogida, traslado y llegada. El buffer de 2h evita solapamientos.

---

### `POST /api/v1/bookings` — Crear reserva + PaymentIntent

| Aspecto | Detalle |
|---------|---------|
| **Auth** | Requerida (Clerk) |
| **Body** | `{ originAddress, originLat, originLng, destAddress, destLat, destLng, scheduledAt, serviceType, specialNotes? }` |
| **Validación** | 7 campos requeridos. `serviceType` ∈ {AIRPORT, HOURLY, EVENT}. `specialNotes` ≤ 280 chars. `scheduledAt` debe ser fecha futura. |
| **Lógica** | 1. `createBooking()` → valida, verifica disponibilidad, cotiza, crea Booking PENDING. 2. `createPaymentIntent()` → crea Payment + PaymentIntent en Stripe |
| **Respuesta 201** | `{ bookingId, status: "PENDING", stripeClientSecret }` |
| **Errores** | 400: campos faltantes/inválidos, no disponible, tarifa no encontrada |
| **Archivo** | `apps/web/app/api/v1/bookings/route.ts` |
| **Servicios** | `packages/core/src/services/bookingService.ts`, `packages/core/src/services/paymentService.ts` |

**Flujo dentro de `createBooking()`** (bookingService.ts):
1. `validateScheduledAt(input.scheduledAt)` → lanza error si fecha pasada o inválida
2. Validar `originAddress` y `destAddress` no vacíos
3. `checkAvailability(input.scheduledAt)` → consulta bookings conflictantes en ventana ±3h
4. `getQuote({ originLat, originLng, destLat, destLng, serviceType })` → cotización
5. `prisma.booking.create({ data: { ... } })` → crea Booking PENDING
6. Retorna `BookingResponse` sin Payment (el payment se crea en `createPaymentIntent` aparte)

**Flujo dentro de `createPaymentIntent()`** (paymentService.ts):
1. `prisma.payment.create({ data: { bookingId, amountCents, stripePaymentIntentId: "pending" } })` → placeholder
2. Si Stripe está configurado: `stripe.paymentIntents.create({ amount, currency: "usd", metadata: { bookingId, paymentId } })`
3. Actualiza el Payment con el `stripePaymentIntentId` real
4. Si Stripe NO está configurado (placeholder keys): retorna `stripeClientSecret: "dev_secret_<bookingId>"` para desarrollo
5. Retorna `PaymentIntentResponse: { bookingId, status: "PENDING", stripeClientSecret }`

---

### `GET /api/v1/bookings` — Listar reservas

| Aspecto | Detalle |
|---------|---------|
| **Auth** | Requerida (Clerk) |
| **Parámetros** | `status?`, `passengerId?`, `driverId?`, `date?`, `page?` (default 1), `limit?` (default 20) |
| **Lógica** | `listBookings()` → construye where dinámico → `prisma.booking.findMany({ where, include: { payment, passenger }, orderBy: { scheduledAt: "asc" }, skip, take })` |
| **Respuesta 200** | `{ data: Booking[], page, limit, total }` |
| **Archivo** | `apps/web/app/api/v1/bookings/route.ts` |
| **Servicio** | `packages/core/src/services/bookingService.ts` |

**Construcción dinámica del where**: el objeto `where` se construye condicionalmente:

```ts
const where: Record<string, unknown> = {};
if (filters.status) where.status = filters.status;
if (filters.driverId) where.driverId = filters.driverId;
if (filters.passengerId) where.passengerId = filters.passengerId;
if (filters.date) {
  // Rango desde 00:00:00 hasta 23:59:59 de la fecha
  where.scheduledAt = { gte: startOfDay, lte: endOfDay };
}
```

**Paginación**: `skip = (page - 1) * limit`. Se ejecutan `findMany` y `count` en paralelo con `Promise.all()` para eficiencia.

---

### `GET /api/v1/bookings/[id]` — Detalle de reserva

| Aspecto | Detalle |
|---------|---------|
| **Auth** | Requerida (Clerk) |
| **Parámetros** | `id` en la URL (UUID del booking) |
| **Lógica** | `getBookingById()` → `prisma.booking.findUnique({ where: { id }, include: { payment, passenger, driver } })` → verifica ownership (dueño o admin) |
| **Respuesta 200** | `Booking` completo con payment, passenger, driver |
| **Errores** | 403: no autorizado (no es dueño ni admin). 404: no encontrado |
| **Archivo** | `apps/web/app/api/v1/bookings/[id]/route.ts` |
| **Servicio** | `packages/core/src/services/bookingService.ts` |

**Verificación de ownership**:
```ts
const isOwner = booking.passengerId === userId || booking.driverId === userId;
const isAdmin = userRole === "ADMIN";
if (!isOwner && !isAdmin) throw new Error("No autorizado para ver esta reserva");
```

**Next.js 15: params es async**. En Next.js 15+, los `params` de rutas dinámicas son `Promise`. Por eso se usa `const { id } = await params;` en vez de `params.id` directamente:

```ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }  // ← Promise, no objeto plano
) {
  const { id } = await params;  // ← await obligatorio
  // ...
}
```

Este es un breaking change de Next.js 15 respecto a versiones anteriores.

---

### `POST /api/v1/clerk-webhook` — Sincronización de usuarios

| Aspecto | Detalle |
|---------|---------|
| **Auth** | **Pública** (sin Clerk) — Clerk envía el evento, no un usuario |
| **Headers** | `svix-id`, `svix-timestamp`, `svix-signature` |
| **Body** | Evento de Clerk en JSON |
| **Lógica** | Verificar firma con svix → `user.created/updated` → upsert en tabla users → `user.deleted` → delete |
| **Respuesta 200** | `{ success: true }` |
| **Archivo** | `apps/web/app/api/v1/clerk-webhook/route.ts` |

---

### `POST /api/v1/stripe-webhook` — Eventos de pago

| Aspecto | Detalle |
|---------|---------|
| **Auth** | **Pública** (sin Clerk) — Stripe envía el evento |
| **Headers** | `stripe-signature` |
| **Body** | **Raw text** (no JSON — necesario para verificación de firma) |
| **Lógica** | Verificar firma con `stripe.webhooks.constructEvent()` → `payment_intent.succeeded` → confirmar booking + enviar email → `payment_intent.failed` → cancelar booking |
| **Respuesta 200** | `{ received: true }` |
| **Archivo** | `apps/web/app/api/v1/stripe-webhook/route.ts` |

---

### Convenciones de todos los endpoints

1. **Prefijo `/api/v1/`**: obligatorio. Permite que en Fase 3 Go reemplace las API routes sin cambiar las URLs.
2. **`Response.json()`**: nativo de Next.js. No usamos `res.status().json()` de Express.
3. **Errores en español**: los mensajes de error son en español porque los usuarios finales son hispanohablantes.
4. **HTTP status codes correctos**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 500 (Internal Server Error).
5. **Validación en la API route, lógica en el servicio**: la ruta valida parámetros HTTP (query string, body, auth). El servicio valida reglas de negocio (disponibilidad, fechas futuras).
6. **`auth()` siempre con `await`**: Next.js 15+ requiere `await auth()` (async request APIs).
7. **Tipos TypeScript estrictos**: cada endpoint define y valida sus tipos de entrada/salida usando los tipos de `@repo/core/types`.

---

## 17. Servicios en `packages/core` — Arquitectura completa

### Estructura actual del paquete

```
packages/core/src/
├── index.ts                 ← Barrel: re-exporta types, utils, services, hooks, constants, lib
├── types/index.ts           ← 16 tipos: Booking, Payment, FareRule, Input/Response types
├── utils/index.ts           ← 7 funciones: calcFare, calcHourlyFare, centsToDollars, haversineDistance, etc.
├── constants/index.ts       ← APP_NAME, PLATFORM_FEE_PCT, MAX_SPECIAL_NOTES_LENGTH, STRIPE_SECRET_KEY
├── lib/
│   ├── index.ts             ← Barrel: getStripe, getResend
│   ├── stripe.ts            ← Cliente Stripe singleton
│   └── resend.ts            ← Cliente Resend singleton
├── services/
│   ├── index.ts             ← Barrel: re-exporta todos los servicios
│   ├── bookingService.ts    ← createBooking, getBookingById, listBookings
│   ├── quoteService.ts      ← getQuote (Google Distance Matrix + Haversine)
│   ├── availabilityService.ts ← checkAvailability, getAvailableSlots
│   ├── paymentService.ts    ← createPaymentIntent, handlePaymentSucceeded, handlePaymentFailed
│   └── emailService.ts      ← sendBookingConfirmation, sendDriverAssignment + templates HTML
└── hooks/
    └── index.ts             ← Vacío (hooks de React se agregarán en Pasos 11-13)
```

### Dependencias entre servicios

```
emailService
    ↑ (llamado por)
paymentService
    ↑
bookingService → availabilityService
    ↑             ↑
    └─ quoteService
         ↑
    calcFare (utils)
```

- **`bookingService`** es el servicio de más alto nivel: orquesta disponibilidad + cotización + creación de booking
- **`paymentService`** crea PaymentIntents y recibe webhooks. Cuando un pago es exitoso, llama a **`emailService`**
- **`quoteService`** usa la API de Google (o Haversine) y `calcFare` para calcular tarifas
- **`availabilityService`** consulta la DB para determinar slots libres

### Patrón de los servicios

Todos los servicios exportan **funciones asíncronas puras** (`export async function`). No son clases, no tienen estado interno (excepto los clientes singleton en `lib/`). Esto los hace:
- **Testeables**: se pueden mockear las dependencias (prisma, stripe, resend)
- **Portables**: en Fase 3, Go puede reimplementar la misma interfaz
- **Tipados**: cada función tiene tipos de entrada y salida definidos en `types/index.ts`

---

## 18. Leaflet y mapa interactivo (OpenStreetMap)

### ¿Por qué Leaflet y no Google Maps?

Google Maps JavaScript API requiere **API key + billing account** (tarjeta de crédito). Aunque ofrece $200/mes en créditos gratuitos, no es ideal para desarrollo o MVP. **Leaflet** con **OpenStreetMap** es completamente gratuito, open source y no requiere registro.

| Característica | Leaflet + OSM | Google Maps JS API |
|---|---|---|
| **API Key** | ❌ No necesita | ✅ Requiere key + billing |
| **Costo** | $0 ilimitado | $200/mes crédito gratis, luego $7/1000 requests |
| **Mapa base** | OpenStreetMap (colaborativo) | Google Maps (satélite, tráfico, Street View) |
| **Marcadores** | ✅ | ✅ |
| **Líneas/rutas** | ✅ (Polyline) | ✅ |
| **Click en mapa** | ✅ (`useMapEvents`) | ✅ |
| **Geocodificación inversa** | ✅ (Nominatim, gratis) | ✅ (Google Geocoding, se paga) |
| **Tamaño bundle** | ~40 KB (leaflet) + ~10 KB (react-leaflet) | ~200 KB |
| **Instalación** | `pnpm add leaflet react-leaflet` | Tag `<script>` |

### Instalación y dependencias

```bash
pnpm add leaflet react-leaflet --filter @repo/web
pnpm add -D @types/leaflet --filter @repo/web
```

**Paquetes**:
- `leaflet`: Librería core (JavaScript vanilla, sin React). Maneja el renderizado del mapa, tiles, marcadores, eventos.
- `react-leaflet`: Wrapper de React para Leaflet. Provee componentes como `<MapContainer>`, `<Marker>`, `<TileLayer>`, `<Polyline>`.
- `@types/leaflet`: Tipos de TypeScript para Leaflet (los marcadores, íconos y eventos están tipados).

### CSS de Leaflet

Leaflet requiere su CSS para que el mapa se renderice correctamente:

```ts
import "leaflet/dist/leaflet.css";
```

Sin este import, los tiles se descuadran, los controles de zoom no se ven, y el mapa es inusable. Se importa en el componente que usa el mapa, no en el layout global, para mantenerlo encapsulado.

### Carga dinámica con `next/dynamic`

```ts
const LocationMap = dynamic<LocationMapProps>(
  () => import("@/components/LocationMap").then((m) => m.LocationMap),
  { ssr: false }
);
```

**¿Por qué `ssr: false`?** Leaflet internamente usa `window`, `document` y otras APIs del navegador. En el servidor (SSR), estas APIs no existen — el renderizado del servidor crashearía con `ReferenceError: window is not defined`. `next/dynamic` con `ssr: false` le dice a Next.js: "este componente solo se renderiza en el cliente, en el servidor poné un placeholder vacío".

**¿Por qué `.then((m) => m.LocationMap)`?** `next/dynamic` espera que el módulo importado tenga un `export default`. Nuestro componente usa `export function LocationMap` (named export). El `.then()` extrae el named export y lo envuelve en un objeto con `.default`.

**¿Por qué el type parameter `<LocationMapProps>`?** Para que TypeScript conozca las props del componente cargado dinámicamente. Sin esto, TypeScript no puede validar que las props que pasamos al `<LocationMap>` sean correctas. `LocationMapProps` es un type exportado desde el mismo archivo del componente:

```ts
// components/LocationMap.tsx
export type LocationMapProps = {
  onOriginChange: (p: { lat: number; lng: number; address: string }) => void;
  onDestChange: (p: { lat: number; lng: number; address: string }) => void;
  initialCenter?: [number, number];
  hideDest?: boolean;
};
```

### Arquitectura del componente `LocationMap`

```tsx
// Estructura simplificada
<MapContainer center={[lat, lng]} zoom={12} style={{ height: "400px" }}>
  <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
  <MapClickHandler onMapClick={handleMapClick} />
  {origin && <Marker position={[origin.lat, origin.lng]} icon={redIcon} />}
  {dest && <Marker position={[dest.lat, dest.lng]} icon={blueIcon} />}
  {origin && dest && <Polyline positions={[[origin.lat, origin.lng], [dest.lat, dest.lng]]} />}
</MapContainer>
```

**`<MapContainer>`**: Contenedor raíz del mapa. Es el equivalente al `<div id="map">`. Props clave:
- `center`: coordenadas iniciales `[lat, lng]` (por defecto Miami: `[25.7617, -80.1918]`)
- `zoom`: nivel de zoom (12 = nivel ciudad, ~5 km de ancho)
- `scrollWheelZoom={true}`: permite hacer zoom con la rueda del mouse
- `style`: DEBE tener height explícita. Leaflet necesita altura definida; sin `height`, el mapa tiene 0px y no se ve.

**`<TileLayer>`**: Capa de imágenes (tiles) del mapa. OpenStreetMap proporciona los tiles gratuitamente en `tile.openstreetmap.org`. El patrón `{z}/{x}/{y}` es reemplazado por Leaflet con las coordenadas del tile solicitado:
- `z`: nivel de zoom (0 = mundo entero, 18 = nivel calle)
- `x`, `y`: coordenadas del tile en la cuadrícula

**`<MapClickHandler>`**: Componente interno que usa el hook `useMapEvents()` de react-leaflet para escuchar clicks en el mapa. Cada click llama a `handleMapClick(lat, lng)`.

**`<Marker>`**: Marcador en una posición. Usa íconos coloreados (rojo = origen, azul = destino) desde el repo CDN de `pointhi/leaflet-color-markers`.

**`<Polyline>`**: Línea que conecta dos puntos. Se renderiza solo cuando ambos marcadores están presentes. `color="#3b82f6"` (azul Tailwind), `weight={3}`.

### Personalización de íconos de marcadores

Leaflet por defecto usa un solo ícono azul para todos los marcadores. Para diferenciar origen (rojo) y destino (azul), creamos instancias personalizadas de `L.Icon`:

```ts
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],        // ancho, alto del ícono
  iconAnchor: [12, 41],      // punto del ícono que coincide con la coordenada (punta inferior)
  popupAnchor: [1, -34],     // dónde aparece el popup relativo al ícono
  shadowSize: [41, 41],      // tamaño de la sombra
});
```

Las URLs de los íconos apuntan a CDNs públicas. En producción convendría hostearlos localmente en `public/` para evitar dependencia externa. `iconAnchor: [12, 41]` significa que la coordenada geográfica está en la punta de abajo del marcador (píxel 12 horizontal, 41 vertical desde la esquina superior izquierda).

### Reverse geocoding con Nominatim

**¿Qué es Nominatim?** Es el servicio de geocodificación de OpenStreetMap. Convierte coordenadas → dirección (reverse) y dirección → coordenadas (forward). Es completamente gratuito, con un rate limit de 1 request/segundo.

**API usada**:

```ts
function reverseGeocode(lat: number, lng: number): Promise<string> {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
  )
    .then((r) => r.json())
    .then((d) => d.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    .catch(() => `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}
```

**Parámetros**:
- `format=json`: respuesta en JSON (por defecto es XML)
- `lat`, `lon`: coordenadas a geocodificar
- `accept-language=es`: nombres de calles/ciudades en español

**Respuesta**: `{ display_name: "Avenida Reforma 222, Cuauhtémoc, Ciudad de México, 06600, México", ... }`

**Rate limiting**: Nominatim permite 1 request/segundo para uso gratuito. Como nuestro mapa solo hace reverse geocoding cuando el usuario hace click (máximo 2 veces: origen y destino), esto es más que suficiente.

**Fallback**: si Nominatim falla (sin conexión, rate limit), se muestra `lat, lng` como texto (`25.76168, -80.19180`). La reserva sigue funcionando porque las coordenadas son lo importante; la dirección es solo para mostrar al usuario.

### Flujo completo del mapa

```
1. Usuario abre /passenger/book
2. next/dynamic carga LocationMap solo en el cliente (sin SSR)
3. Se renderiza MapContainer con TileLayer de OpenStreetMap
4. Usuario hace click en un punto del mapa
   → useMapEvents detecta el evento
   → handleMapClick(lat, lng)
   → Se crea marcador rojo (origen)
   → fetch() a Nominatim para obtener la dirección
   → Se actualiza el estado origin: { lat, lng, address }
5. Usuario hace segundo click
   → Marcador azul (destino) + línea Polyline
   → Reverse geocoding para el destino
6. El useEffect de quotes detecta origin + dest cambiados
   → Debounce 600ms
   → GET /api/v1/quotes con las coordenadas
   → Se muestra la cotización
```

### Toggle mapa / búsqueda por texto

El formulario tiene un botón para alternar entre el mapa interactivo y los campos de texto tradicionales (Google Places Autocomplete + campos manuales de lat/lng):

```tsx
const [useMap, setUseMap] = useState(true);

<button onClick={() => setUseMap(!useMap)}>
  {useMap ? "Usar búsqueda por texto" : "Usar mapa interactivo"}
</button>
```

Esto permite flexibilidad: si el usuario tiene Google API key, puede usar autocomplete. Si no, el mapa funciona sin key.

### Consideraciones para producción

1. **Hostear íconos de marcadores localmente**: las URLs de GitHub (`pointhi/leaflet-color-markers`) podrían cambiar o caerse. Mover los PNGs a `public/markers/`.
2. **Usar un tile server con SSL**: `tile.openstreetmap.org` es HTTP/2 pero sin SLA. Para producción, considerar un proveedor de tiles pago (Mapbox, Stadia Maps) o cachear tiles.
3. **Nominatim tiene política de uso**: atribución requerida ("© OpenStreetMap contributors"). Ya incluida en el `attribution` del `TileLayer`.
4. **Mobile**: Leaflet soporta gestos táctiles (pinch-to-zoom, drag) nativamente. El `scrollWheelZoom` puede ser molesto en mobile; considerar deshabilitarlo con detección de dispositivo.

---

## 19. Deep links de navegación (Waze / Google Maps / Apple Maps)

### Concepto

Los **deep links** son URLs que abren directamente una aplicación nativa en el dispositivo. En lugar de que el conductor copie una dirección y la pegue manualmente en Waze, un link con el formato correcto abre Waze con la ruta ya calculada.

### Cómo funcionan

Cada app de navegación registra un **esquema de URL** en el sistema operativo. Cuando el navegador (o WebView) intenta abrir una URL con ese esquema, el SO intercepta y abre la app correspondiente:

| App | URL Scheme | Funciona en |
|-----|-----------|-------------|
| **Google Maps** | `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG` | Web, Android, iOS |
| **Waze** | `https://waze.com/ul?ll=LAT,LNG&navigate=yes` | Android, iOS (abre la app si está instalada) |
| **Apple Maps** | `https://maps.apple.com/?daddr=LAT,LNG` | iOS, macOS |
| **Coordenadas genéricas** | `https://www.google.com/maps?q=LAT,LNG` | Web (fallback universal) |

### Parámetros de Google Maps

```
https://www.google.com/maps/dir/?api=1
  &origin=LAT,LNG              ← opcional: punto de partida
  &destination=LAT,LNG          ← punto de destino
  &travelmode=driving           ← modo: driving, walking, bicycling, transit
  &dir_action=navigate          ← inicia navegación inmediatamente
```

Si no se especifica `origin`, Google Maps usa la ubicación actual del dispositivo (GPS).

### Parámetros de Waze

```
https://waze.com/ul?
  ll=LAT,LNG                    ← latitud,longitud del destino
  &navigate=yes                 ← inicia navegación
```

Waze no acepta `origin` como parámetro URL — siempre usa la ubicación actual del dispositivo como punto de partida. Esto es el comportamiento esperado para un conductor.

### Implementación en el portal del conductor (Paso 12)

Cada tarjeta de viaje mostrará links de navegación con íconos. El componente será algo como:

```tsx
function NavigationLinks({ lat, lng, address }: { lat: number; lng: number; address: string }) {
  return (
    <div className="flex gap-2">
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
         target="_blank" rel="noopener noreferrer"
         className="rounded border px-3 py-1 text-xs">
        🗺️ Google Maps
      </a>
      <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
         target="_blank" rel="noopener noreferrer"
         className="rounded border px-3 py-1 text-xs">
        🚗 Waze
      </a>
    </div>
  );
}
```

Los atributos `target="_blank"` y `rel="noopener noreferrer"` son necesarios por seguridad y UX: abren en una pestaña nueva (o en la app nativa si está instalada) sin dar acceso al `window.opener`.

### Comportamiento según dispositivo

| Dispositivo | Click en Google Maps link | Click en Waze link |
|---|---|---|
| **Desktop** (Windows/Mac/Linux) | Abre maps.google.com en navegador | Abre waze.com en navegador (web) |
| **Android con Waze instalado** | Abre Google Maps app | Abre Waze app directamente |
| **Android sin Waze** | Abre Google Maps app | Abre waze.com en navegador |
| **iOS con Waze instalado** | Abre Apple Maps o Google Maps | Abre Waze app directamente |
| **iOS sin Waze** | Abre Apple Maps | Abre App Store (pide instalar Waze) |

Los deep links son la forma estándar de integrar navegación sin usar APIs nativas ni SDKs. No requieren permisos especiales ni configuración adicional.

---

## 20. Integraciones con terceros — Guía completa de configuración

Esta sección documenta **todo** lo necesario para configurar las 4 integraciones externas del MVP: Clerk (auth), Stripe (pagos), Google Places (mapas/distancias), y Resend (emails). Cada sub-sección explica qué es la herramienta, por qué la usamos, qué plan tiene, y los pasos exactos de configuración.

### 20.1 ngrok — Túnel HTTP para desarrollo local

#### ¿Qué es ngrok y por qué lo necesitamos?

**ngrok** es un proxy inverso que crea un túnel seguro entre una URL pública en internet y tu `localhost`. Sin ngrok, los servicios externos (Clerk, Stripe) no pueden enviarte webhooks porque `localhost` no es accesible desde internet.

**Analogía**: `localhost:3000` es como una casa sin dirección postal. Nadie desde afuera puede enviarte una carta. ngrok le asigna una dirección temporal (`https://abc123.ngrok-free.app`) que redirige todo el tráfico a tu computadora.

**Flujo técnico**:

```
Internet                            Tu máquina
────────                            ──────────
HTTPS request a ──────────────►  ngrok cloud (servidores de ngrok)
  https://abc123.ngrok-free.app         │
  /api/v1/clerk-webhook          tunnel TCP encriptado ↓
                                        │
                                 ngrok client (tu máquina) → http://localhost:3000/api/v1/clerk-webhook
```

ngrok mantiene una conexión TCP persistente entre sus servidores y tu máquina. Cuando un request llega a `abc123.ngrok-free.app`, ngrok lo reenvía por ese túnel a `localhost:3000`.

**Plan gratuito**: 1 túnel simultáneo, URLs aleatorias (cambian al reiniciar), 40 conexiones/minuto, sin custom domain. Más que suficiente para desarrollo.

#### Instalación

```bash
# macOS
brew install ngrok/ngrok/ngrok

# Linux (descarga manual)
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvzf ngrok-v3-stable-linux-amd64.tgz -C /usr/local/bin

# O desde el sitio: https://ngrok.com/download
```

#### Configuración

```bash
# 1. Crear cuenta gratuita en https://ngrok.com
# 2. Obtener authtoken desde https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken TU_TOKEN_AQUI
```

#### Uso diario

```bash
# Terminal 1: Arrancar la app
pnpm dev

# Terminal 2: Arrancar ngrok
ngrok http 3000

# Output:
# Forwarding  https://abc123.ngrok-free.app → http://localhost:3000
```

**⚠️ Importante**: La URL de ngrok (`abc123`) cambia cada vez que reiniciás ngrok. Si la reiniciás, actualizá la URL en Clerk Dashboard y en el Stripe CLI.

#### Comandos útiles

```bash
ngrok http 3000                     # túnel básico
ngrok http --domain=mi-app.ngrok-free.app 3000  # con dominio fijo (requiere cuenta paga)
ngrok inspect                       # interfaz web en http://127.0.0.1:4040 para ver requests en tiempo real
```

#### Alternativas a ngrok

| Herramienta | Gratis | Dominio fijo | Notas |
|---|---|---|---|
| **ngrok** | ✅ (40 conn/min) | ❌ (aleatorio) | La más popular, mejor DX |
| **Cloudflare Tunnel** | ✅ (ilimitado) | ✅ (tu dominio) | Requiere dominio en Cloudflare |
| **localhost.run** | ✅ | ❌ | Sin instalación: `ssh -R 80:localhost:3000 localhost.run` |
| **serveo.net** | ✅ | ❌ | Sin instalación, similar a localhost.run |
| **Deploy a Vercel** | ✅ (hobby) | ✅ | No es un túnel, es deploy real a producción |

---

### 20.2 Clerk — Autenticación

#### ¿Qué es Clerk?

Clerk es un servicio de autenticación como SaaS. Maneja registro, login, recuperación de contraseña, OAuth social, sesiones JWT, y webhooks de eventos de usuario. Nosotros no almacenamos contraseñas ni manejamos sesiones — Clerk hace todo.

#### Plan usado

**Hobby (gratis)**: 50,000 usuarios mensuales (MRU), aplicaciones ilimitadas, webhooks, OAuth social (hasta 3 providers), UI prebuilt de login/registro. Sin MFA, sin quitar branding, sesiones fijas de 7 días.

Para el MVP, el plan Hobby cubre todo. Si se superan 50k MRU, el plan Pro cuesta $25/mes.

#### Variables de entorno necesarias

| Variable | Formato | Dónde se obtiene | Expuesta al cliente |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Clerk Dashboard → API Keys | ✅ Sí (prefijo `NEXT_PUBLIC_`) |
| `CLERK_SECRET_KEY` | `sk_test_...` | Clerk Dashboard → API Keys | ❌ No (solo servidor) |
| `CLERK_WEBHOOK_SECRET` | `whsec_...` | Clerk Dashboard → Webhooks | ❌ No (solo servidor) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Config manual | ✅ Sí |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Config manual | ✅ Sí |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` | Config manual | ✅ Sí |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` | Config manual | ✅ Sí |

**¿Por qué dos keys?** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` es la llave pública — identifica tu app ante Clerk y se envía al navegador. `CLERK_SECRET_KEY` es la llave privada — permite verificar sesiones y crear/actualizar usuarios desde el servidor. NUNCA se debe exponer al cliente porque permitiría a cualquiera hacerse pasar por tu aplicación.

#### Paso a paso de configuración

**1. Crear cuenta y app**

```
1. Ir a https://clerk.com
2. Sign up (gratis, sin tarjeta)
3. Create application → Nombre: "Rymvo"
4. Elegir "Next.js" como framework
5. Seleccionar App Router
```

**2. Obtener API Keys**

```
Clerk Dashboard → Configure → API Keys
  Publishable Key: pk_test_c3VpdGFibGV...  (copiar)
  Secret Key: sk_test_GtPrpBGT...          (copiar)
```

**3. Configurar URLs de sign-in/sign-up**

```
Clerk Dashboard → Configure → Paths
  Sign-in URL: /sign-in
  Sign-up URL: /sign-up
  Fallback redirect URL: /
```

**4. Configurar el webhook de Clerk**

Aquí es donde entra ngrok. Clerk necesita enviar eventos (`user.created`, `user.updated`, `user.deleted`) a una URL pública.

```
1. Arrancar ngrok en otra terminal: ngrok http 3000
   → Forwarding: https://abc123.ngrok-free.app → http://localhost:3000

2. Clerk Dashboard → Webhooks → Add Webhook
   Endpoint URL: https://abc123.ngrok-free.app/api/v1/clerk-webhook
   
3. Seleccionar eventos:
   ☑ user.created   — cuando un usuario se registra
   ☑ user.updated   — cuando un usuario actualiza su perfil
   ☑ user.deleted   — cuando un usuario se elimina

4. Click "Create"
5. Copiar el "Signing Secret" (whsec_...)
```

**5. Poner las variables en archivos .env**

```
# apps/web/.env.local (Next.js lee este)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# .env (raíz del monorepo)
CLERK_WEBHOOK_SECRET=whsec_...     # mismo valor
CLERK_SECRET_KEY=sk_test_...       # mismo valor

# packages/db/.env (copia de raíz para Prisma CLI)
cp .env packages/db/.env
```

**6. Verificar**

```bash
# 1. Registrate en http://localhost:3000/sign-up
# 2. Verificá que el webhook se disparó:
curl http://localhost:3000:4040/api/requests  # ngrok inspector

# O verificá la tabla users:
docker compose exec db psql -U postgres -d rymvo \
  -c "SELECT email, full_name, role, created_at FROM users;"

# 3. Dale rol ADMIN a tu usuario:
docker compose exec db psql -U postgres -d rymvo \
  -c "UPDATE users SET role = 'ADMIN' WHERE email = 'tu@email.com';"

# 4. Cerrá sesión y volvé a iniciar
# 5. Navegá a /admin/bookings
```

#### Cómo funciona técnicamente la sincronización

Cuando un usuario se registra en Clerk:

1. Clerk emite el evento `user.created`
2. Clerk envía POST a `https://tudominio/api/v1/clerk-webhook` con el payload
3. Nuestro endpoint (`apps/web/app/api/v1/clerk-webhook/route.ts`):
   - Verifica la firma criptográfica con svix (`svix-id`, `svix-timestamp`, `svix-signature` headers + `CLERK_WEBHOOK_SECRET`)
   - Extrae `id`, `first_name`, `last_name`, `email_addresses`, `phone_numbers`
   - Ejecuta `prisma.user.upsert()` — crea o actualiza el usuario en nuestra tabla local
4. El usuario ahora existe tanto en Clerk como en nuestra DB, con el campo `clerkUserId` como puente

---

### 20.3 Stripe — Procesamiento de pagos

#### ¿Qué es Stripe?

Stripe es una plataforma de pagos. Procesa cobros con tarjeta de crédito/débito, Apple Pay, Google Pay, y transferencias bancarias. Nosotros **no almacenamos ni procesamos** datos de tarjetas — Stripe es PCI-DSS nivel 1 (el más alto) y maneja toda la seguridad de pagos.

#### Plan usado

**Pay-as-you-go (sin costo fijo)**: 2.9% + $0.30 por transacción exitosa en EE.UU. Sin cuota mensual, sin mínimo. Solo se paga cuando se procesa un pago real. En modo test (desarrollo) es completamente gratuito.

#### Variables de entorno necesarias

| Variable | Formato | Dónde se obtiene | Expuesta al cliente |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe Dashboard → API Keys | ❌ No (solo servidor) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Stripe Dashboard → API Keys | ✅ Sí |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe CLI (`stripe listen`) o Dashboard → Webhooks | ❌ No |

**¿Por qué dos keys?** `STRIPE_SECRET_KEY` permite crear PaymentIntents, reembolsar, y acceder a datos sensibles. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` solo sirve para tokenizar tarjetas en el frontend (Stripe Elements). La separación es un patrón de seguridad estándar en APIs de pago.

#### Paso a paso de configuración

**1. Crear cuenta**

```
1. Ir a https://dashboard.stripe.com/register
2. Completar registro (se puede usar datos personales, no requiere empresa)
3. Verificar email
4. Activar "Test mode" (toggle en la esquina superior derecha del dashboard)
```

**2. Obtener API Keys**

```
Stripe Dashboard → Developers → API Keys → Secret key
  Publishable key: pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
  Secret key:      SK_TEST_KEY

⚠️ Las keys de test empiezan con sk_test_ y pk_test_. 
   Las de producción empiezan con sk_live_ y pk_live_.
   NUNCA uses keys de producción en desarrollo.
```

**3. Poner en archivos .env**

```
# apps/web/.env.local
STRIPE_SECRET_KEY=SK_TEST_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

# .env (raíz)
STRIPE_SECRET_KEY=SK_TEST_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
```

**4. Instalar Stripe CLI**

El Stripe CLI es la herramienta oficial para desarrollo local. Permite escuchar webhooks de Stripe y reenviarlos a tu localhost, y también disparar eventos de prueba.

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar xvzf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/

# Iniciar sesión (abre navegador para autorizar)
stripe login
```

**5. Escuchar webhooks localmente**

```bash
# Terminal 3: Escuchar eventos de Stripe
stripe listen --forward-to localhost:3000/api/v1/stripe-webhook

# Output:
# > Ready! Your webhook signing secret is whsec_XXXXXXXXXXXXXXXXX
#   (copiá este valor a STRIPE_WEBHOOK_SECRET en .env)
```

**6. Poner webhook secret**

```
# apps/web/.env.local
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXX   # el que imprimió stripe listen

# .env (raíz)
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXX
```

**7. Verificar**

```bash
# Disparar un evento de prueba
stripe trigger payment_intent.succeeded

# O flujo completo manual:
# 1. Ir a /passenger/book
# 2. Completar formulario con tarjeta de prueba: 4242 4242 4242 4242
#    CVC: cualquier 3 dígitos, Fecha: cualquier fecha futura
# 3. "Pagar y confirmar"
# 4. Verificar en Stripe Dashboard → Payments (debe aparecer el pago)
```

#### Tarjetas de prueba de Stripe

| Tarjeta | Describe |
|---------|----------|
| `4242 4242 4242 4242` | Pago exitoso (Visa) |
| `4000 0025 0000 3155` | Requiere autenticación 3D Secure |
| `4000 0000 0000 9995` | Pago rechazado (fondos insuficientes) |
| `5555 5555 5555 4444` | Mastercard |

CVC: cualquier 3 dígitos. Fecha de expiración: cualquier fecha futura (MM/YY).

---

### 20.4 Google Places — Mapas, autocomplete y distancias

#### ¿Qué es Google Places?

Google Places es un conjunto de APIs de Google Maps Platform para trabajar con ubicaciones. Nosotros usamos 3 APIs distintas:

| API | Qué hace | Dónde se usa |
|-----|---------|-------------|
| **Maps JavaScript API** | Mapa interactivo en el navegador, widget de autocomplete | Frontend: `<Script>` en `/passenger/book` |
| **Places API** | Búsqueda de direcciones, autocomplete de texto | Backend: embebido en Maps JS API como `places.Autocomplete()` |
| **Distance Matrix API** | Distancia y tiempo entre dos coordenadas (por ruta real, no línea recta) | Backend: `quoteService.ts` → `fetchGoogleDistanceMatrix()` |

#### Plan usado

Google da **$200/mes en créditos gratuitos** para todas las APIs de Maps Platform. Eso alcanza para aproximadamente:

| API | Crédito por 1000 requests | Requests mensuales con $200 |
|-----|--------------------------|---------------------------|
| Maps JavaScript API (autocomplete) | $0 (gratis con Places API) | Ilimitado en el widget |
| Places API (autocomplete, detalles) | $17.00 | ~11,000 requests |
| Distance Matrix API | $5.00 | ~28,000 requests |

Para un MVP, los $200/mes son más que suficientes. Si se supera, se cobra el excedente a la tarjeta asociada. Se puede configurar un límite de gasto (budget alert).

#### Variables de entorno necesarias

| Variable | Formato | Dónde se obtiene | Expuesta al cliente |
|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | `AIza...` | Google Cloud Console → APIs & Services → Credentials | ✅ Sí (se usa en el `<Script>` del frontend) |
| `GOOGLE_PLACES_API_KEY` | `AIza...` | **La misma key** (sin prefijo `NEXT_PUBLIC_`) | ❌ No (se usa en el backend para Distance Matrix) |

**⚠️ Es la MISMA key para frontend y backend.** La restricción por aplicación (HTTP referrer para frontend, IP para backend) se configura en Google Cloud Console. `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` está disponible en el navegador; `GOOGLE_PLACES_API_KEY` se usa en `quoteService.ts` vía `process.env.GOOGLE_PLACES_API_KEY`.

#### Paso a paso de configuración

**1. Crear proyecto en Google Cloud**

```
1. Ir a https://console.cloud.google.com/
2. Crear proyecto nuevo → Nombre: "Rymvo"
3. Seleccionar el proyecto recién creado
```

**2. Habilitar las APIs necesarias**

```
Google Cloud Console → APIs & Services → Library
Buscar y habilitar UNA POR UNA:

1. "Maps JavaScript API" → Enable
2. "Places API" → Enable
3. "Distance Matrix API" → Enable
```

**3. Crear API Key**

```
APIs & Services → Credentials → Create Credentials → API Key
→ Copiar la key generada (AIza...)
→ Click en "Edit API Key"
```

**4. Restringir la API Key (CRÍTICO para seguridad)**

Si no restringís la key, cualquiera que la vea en el código fuente puede usarla y consumir tus créditos.

```
En la pantalla de edición de la API Key:

Application restrictions:
  ○ None (no recomendado)
  ● HTTP referrers (websites)
    → Add: localhost:3000/*
    → Add: localhost:3001/*
    → Add: *.tudominio.com/*     (cuando tengas dominio)
    → Add: *.ngrok-free.app/*    (para desarrollo con ngrok)

API restrictions:
  ○ Don't restrict key (no recomendado)
  ● Restrict key
    → ☑ Maps JavaScript API
    → ☑ Places API
    → ☑ Distance Matrix API

→ Save
```

**5. Poner en archivos .env**

```
# apps/web/.env.local
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...TuKeyReal

# .env (raíz)
GOOGLE_PLACES_API_KEY=AIzaSy...TuKeyReal   # misma key, sin NEXT_PUBLIC_
```

**6. Verificar**

```bash
# Ir a /passenger/book
# Con Google API key real:
#   - Los campos de dirección deberían mostrar autocomplete de Google Places
#   - Las cotizaciones usarán distancia real por ruta (Google Distance Matrix)
#   - Ya no aparece el panel ámbar "Sin Google Places, necesitás coordenadas manuales"
```

---

### 20.5 Resend — Emails transaccionales

#### ¿Qué es Resend?

Resend es una API REST para envío de emails transaccionales. A diferencia de SMTP tradicional, provee un SDK TypeScript nativo con tipado completo. Es la alternativa moderna a SendGrid, Mailgun o Postmark.

#### Plan usado

**Free**: 100 emails/día. Sin tarjeta de crédito. Un solo dominio verificado. Templates ilimitados. API key única.

100 emails/día es más que suficiente para desarrollo y para un MVP con pocos usuarios. Si se supera, el plan Pro cuesta $20/mes por 50,000 emails.

#### Variables de entorno necesarias

| Variable | Formato | Dónde se obtiene | Expuesta al cliente |
|---|---|---|---|
| `RESEND_API_KEY` | `re_...` | Resend Dashboard → API Keys | ❌ No (solo servidor) |
| `RESEND_FROM_EMAIL` | `...@tudominio.com` | Email verificado en Resend | ❌ No (solo servidor) |

#### Paso a paso de configuración

**1. Crear cuenta**

```
1. Ir a https://resend.com
2. Sign up (gratis, sin tarjeta)
3. Verificar email
```

**2. Obtener API Key**

```
Resend Dashboard → API Keys → Create API Key
  Name: Rymvo Dev
  Permission: Sending
  → Copiar la key generada (re_...)
```

**3. Configurar dominio de envío**

Hay dos opciones:

**Opción A — Usar el dominio de prueba (más rápido para empezar)**

```
1. Resend Dashboard → Domains
2. Usar el dominio de prueba: onboarding@resend.dev
3. Resend solo permite enviar a los emails que verifiques en "Test Email Addresses"
4. Agregar tu email personal en Settings → Test Email Addresses
```

**Opción B — Verificar tu dominio real (para producción)**

```
1. Resend Dashboard → Domains → Add Domain
2. Ingresar: ryrymvo.com (o el dominio que tengas)
3. Resend te da registros DNS (TXT, MX, DKIM, SPF) que debés agregar en tu proveedor de dominio
4. Una vez verificados (puede tomar unos minutos), podés enviar desde:
   noreply@ryrymvo.com
   reservas@ryrymvo.com
   (cualquier dirección @tu-dominio)
```

**4. Poner en archivos .env**

```
# apps/web/.env.local
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXX
RESEND_FROM_EMAIL=onboarding@resend.dev    # opción A
# RESEND_FROM_EMAIL=noreply@ryrymvo.com   # opción B (cuando verifiques dominio)

# .env (raíz)
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXX
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**5. Verificar**

```
1. Crear una reserva en /passenger/book
2. "Simular pago exitoso"
3. Verificar en la terminal del servidor:
   Si RESEND_API_KEY es placeholder: [Email] Booking confirmation (no Resend key configured)
   Si RESEND_API_KEY es real: Se enviará un email a la dirección del pasajero
4. Revisar tu bandeja de entrada (y spam)
```

---

### 20.6 Resumen de setup de desarrollo

#### Tres terminales necesarias

```bash
# Terminal 1: App Next.js
pnpm dev

# Terminal 2: ngrok (webhook de Clerk)
ngrok http 3000

# Terminal 3: Stripe CLI (webhook de Stripe)
stripe listen --forward-to localhost:3000/api/v1/stripe-webhook
```

#### Archivos de variables de entorno completos

**`apps/web/.env.local`** — El archivo que Next.js carga automáticamente desde `apps/web/`:

```env
# ─── Clerk ───
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# ─── Stripe ───
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Google Places ───
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...

# ─── Resend ───
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**`.env` (raíz del monorepo)** — Referencia centralizada, usada por Prisma y scripts globales:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rymvo

CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

GOOGLE_PLACES_API_KEY=AIza...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**`packages/db/.env`** — Copia de `.env` raíz para Prisma CLI:

```bash
cp .env packages/db/.env
```

#### Costos mensuales estimados del MVP

| Servicio | Plan | Costo mensual |
|----------|------|--------------|
| **Clerk** | Hobby (50k usuarios) | $0 |
| **Stripe** | Pay-as-you-go (solo se paga por transacción) | $0 fijo + 2.9% por transacción |
| **Google Places** | $200/mes crédito gratuito | $0 (hasta ~28k requests Distance Matrix) |
| **Resend** | Free (100 emails/día) | $0 |
| **Neon (DB)** | Free (0.5 GB RAM, 1 GB storage) | $0 |
| **Vercel (deploy)** | Hobby | $0 |
| **ngrok** | Free (1 túnel) | $0 |
| **TOTAL** | | **$0/mes** (hasta que escale) |

---

### 20.7 Orden recomendado de configuración

Si estás empezando desde cero con las keys, configurá en este orden:

```
1. ngrok        ← necesario para webhooks (5 min)
2. Clerk        ← auth + webhook de usuarios (15 min)
3. PostgreSQL   ← ya funciona con Docker (0 min, ya está)
4. Stripe       ← pagos + webhook con CLI (15 min)
5. Google       ← mapas + autocomplete + distancias (10 min)
6. Resend       ← emails de confirmación (5 min)

Tiempo total estimado: ~50 minutos
```

**¿Por qué este orden?** Clerk y la DB son la base — sin ellos no podés hacer login ni guardar datos. Stripe y Google son funcionalidades que mejoran la experiencia pero no bloquean. Resend es lo último porque sin pagos reales no se envían emails.
