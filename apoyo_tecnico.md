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
