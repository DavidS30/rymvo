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
postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/transport_mvp?sslmode=require
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
transport-app-texas/
├── .env                          ← variables globales (DATABASE_URL, keys de Clerk, Stripe, etc.)
├── packages/db/.env              ← COPIA de .env raíz (Prisma lo necesita en su directorio)
```

**¿Por qué hay dos `.env`?** Prisma CLI (`prisma migrate dev`, `prisma db seed`) busca `.env` en el directorio donde se ejecuta. Como Turborepo ejecuta el script `db:migrate` dentro de `packages/db/`, necesita encontrar las variables ahí. La solución más simple fue copiarlo.

En producción (Paso 15, Vercel), las variables se configuran en el dashboard de Vercel, no en archivos `.env`.

### Variables reales configuradas (Paso 5)

| Variable | Valor | Para qué sirve |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/rymvo` | Conexión a Docker PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_c3VpdGFibGV...` ✅ | Key pública de Clerk (va al navegador) |
| `CLERK_SECRET_KEY` | `sk_test_GtPrpBGT...` ✅ | Key secreta de Clerk (solo servidor) |
| `CLERK_WEBHOOK_SECRET` | `whsec_placeholder` ❌ | Falta para Paso 6 |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder` ❌ | Falta para Paso 8 |
| `GOOGLE_PLACES_API_KEY` | `placeholder` ❌ | Falta para Paso 7 |
| `RESEND_API_KEY` | `re_placeholder` ❌ | Falta para Paso 10 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` ✅ | Clerk redirige acá si no hay sesión |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` ✅ | Clerk redirige acá para registrarse |

### ¿Por qué hay TRES archivos `.env`?

```
rymvo/
├── .env                          ← Raíz del monorepo: DATABASE_URL, keys globales
├── apps/web/.env.local           ← Next.js: carga automáticamente desde SU directorio
└── packages/db/.env              ← Copia: Prisma CLI busca .env en su propio directorio
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

## 10. Estado actual del proyecto (Pasos 1-5 completados)

| Paso | Qué se implementó | Archivos clave |
|------|------------------|----------------|
| **1** | Monorepo Turborepo + 4 packages | `package.json`, `turbo.json`, `pnpm-workspace.yaml`, 4 `tsconfig.json` |
| **2** | Prisma schema + migración + seed | `packages/db/prisma/schema.prisma`, 4 modelos, 3 FareRules |
| **3** | Cliente Prisma singleton | `packages/db/src/index.ts` — patrón globalThis |
| **4** | `packages/core` services | `types/` (16 tipos), `utils/` (calcFare, haversine), `services/` (5 archivos) |
| **5** | Clerk auth (login, registro, proxy) | `proxy.ts`, `sign-in/page.tsx`, `sign-up/page.tsx`, `layout.tsx` |

### Lo que se puede hacer ahora mismo

```bash
pnpm dev                          # Arrancar servidor
# http://localhost:3000           # Homepage con botones de login
# http://localhost:3000/sign-in   # Login funcional con Clerk
# http://localhost:3000/sign-up   # Registro funcional con Clerk
```

---

## 11. Próximos pasos técnicos

| Paso | Qué se hará | Concepto nuevo |
|---|---|---|
| Paso 6 | Webhook de Clerk → sincronizar usuarios | Webhooks, verificación de firma con svix, ngrok para dev local |
| Paso 7 | `GET /api/v1/quotes` + `GET /api/v1/availability` | Google Distance Matrix API, respuestas JSON tipadas |
| Paso 8 | `POST /api/v1/bookings` + Stripe | PaymentIntent, client_secret, flujo de pago |
| Paso 9 | Stripe webhook | Verificación de firma, actualización de estados |
| Paso 10 | Emails con Resend | Envío de emails transaccionales, templates HTML |
| Paso 11 | UI pasajero | Google Places Autocomplete, Stripe Elements, debounce |
| Paso 12 | Portal conductor | Cards resumen, listado de viajes, badges de estado |
| Paso 13 | Backoffice admin | Tabla paginada, filtros, sidebar de navegación |
| Paso 14 | Pruebas E2E | Stripe modo test, flujo completo |
| Paso 15 | Deploy a Vercel | Variables de entorno de producción, dominio |
