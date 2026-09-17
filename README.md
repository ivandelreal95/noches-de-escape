# Noches de Escape

Plataforma (nombre provisional) para vender **noches desocupadas** de Grupo Posada Real en Rincón de Guayabitos, Nayarit, vía:

1. **Compra inmediata** a precio especial (solo cupos y fechas que el hotel publique).
2. **Subastas** con mínimo controlado por el hotel.

Operador: Iván Del Real Gaona / Grupo Posada Real. UI en **español mexicano**. Fase 1.

No hay descuentos permanentes a todo el inventario. El servidor (SQLite) es la fuente de verdad: dos sesiones ven las mismas pujas.

## Qué es real, simulado y externo

| Estado | Qué |
|--------|-----|
| **Implementado** | Catálogo Posada Real e Isla Coral según especificación. Cupos manuales (admin). Compra inmediata y subastas. Motor de pujas (mínimo, incremento $50, extensión +2 min). Si el ganador no paga en 20 min: `UNPAID_EXPIRED` y se libera el cupo (no se adjudica al 2º). Panel admin con contraseña de entorno. |
| **Simulado** | Registro de huésped (nombre + correo; no se verifica). Sesión por cookie. **Pago:** botón «Simular pago» — no hay cargo real. |
| **Pendiente / externo** | Cloudbeds (no hay sync ni API fingida). Pagos reales (Stripe / Conekta / Mercado Pago México). Fotos reales de habitación (no se usan stock). Impuestos calculados. Subastas en WhatsApp. Tarifario de Hotel Real del Sol. |

Hotel **Real del Sol** aparece como próximamente: no se puede comprar ni pujar; no hay tarifa inventada.

## Cómo correr en local

Requisitos: **Node.js 22+** (usa `node:sqlite`).

```bash
cp .env.example .env   # opcional; hay valores de desarrollo
npm install
npm test
npm run dev
```

- Web: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- API: [http://127.0.0.1:3001](http://127.0.0.1:3001)

Variables de entorno (`.env.example`):

- `ADMIN_PASSWORD` — panel `/admin/entrar` (desarrollo: `posada-admin`)
- `SESSION_SECRET` — firma de cookies
- `PORT` — API (3001)
- `DATABASE_PATH` — SQLite (por defecto `./data/noches.db`)

Producción en tu computadora (un solo puerto: API + web compilada):

```bash
npm run build
npm start
```

Abre [http://127.0.0.1:3001](http://127.0.0.1:3001). Eso **no** es una URL pública: WhatsApp y los teléfonos de los huéspedes no pueden entrar a `localhost`. Para compartir enlaces hay que publicar el proyecto (siguiente sección).

## Publicar en internet (para Iván)

Objetivo: una dirección **https://…** que se abre en el celular y se puede pegar en WhatsApp. El servidor sirve la página y la API juntos (mismo origen). Los **pagos siguen simulados**. **No hay Cloudbeds.**

Usa un plan de pago pequeño con **disco persistente**. El plan gratuito suele **dormirse** (tarda en abrir) y a veces **borra SQLite** si no hay volumen.

### Variables que debes configurar en el host

Nunca las subas a GitHub. No uses los valores de `.env.example` en internet.

| Variable | Qué poner |
|----------|-----------|
| `ADMIN_PASSWORD` | **Secreto fuerte** para `/admin/entrar`. **No** uses `posada-admin`. |
| `SESSION_SECRET` | Cadena larga y aleatoria (Render puede generarla). |
| `PORT` | Lo asigna el host. La app ya lee `process.env.PORT` (por defecto 3001 solo en local). |
| `DATABASE_PATH` | Ruta **dentro del disco persistente**, p. ej. `/data/noches.db`. |
| `NODE_ENV` | `production` |

### Opción recomendada: Render (pasos)

1. Crea cuenta en [Render](https://render.com) e inicia sesión con **GitHub**.
2. En GitHub, el código debe estar en el repo (este proyecto).
3. En Render: **New** → **Blueprint** (o *Web Service*). Conecta el repositorio `noches-de-escape`. Si usas Blueprint, Render lee `render.yaml`.
4. Elige el plan **Starter** (no Free): hace falta un disco para no perder las pujas al redesplegar.
5. Confirma el disco: nombre `noches-sqlite`, ruta `/data`, 1 GB. `DATABASE_PATH` queda `/data/noches.db`.
6. En Environment, escribe:
   - `ADMIN_PASSWORD` = una contraseña **nueva y fuerte** (la que usarás tú en el panel).
   - `SESSION_SECRET` = si Blueprint no la generó, pega una frase larga aleatoria.
   - `NODE_ENV` = `production` (ya viene en `render.yaml`).
7. **Deploy**. Espera a que el health check `GET /api/health` pase.
8. Abre la URL pública (`https://….onrender.com`). Prueba en el teléfono (datos, no solo Wi‑Fi de la oficina).
9. Entra a `https://TU-URL/admin/entrar` con **la contraseña que pusiste en `ADMIN_PASSWORD`**. Si más adelante quieres cambiarla: edita `ADMIN_PASSWORD` en Render y redespliega; luego entra con la nueva.
10. Copia esa URL https y envíala por WhatsApp. Cualquier publicación se comparte como `https://TU-URL/publicaciones/…`.

Si no usas Blueprint: New → Web Service → mismo repo → runtime **Docker** → health check `/api/health` → Add Disk en `/data` → las mismas variables.

### Alternativa: Railway

1. Cuenta en [Railway](https://railway.app), **Deploy from GitHub**, elige este repo. Detecta el `Dockerfile`.
2. Plan **Hobby** (no dejes el SQLite en disco efímero).
3. **Volume** (disco): montaje `/data`. Variable `DATABASE_PATH=/data/noches.db`.
4. Variables: `ADMIN_PASSWORD` (secreto fuerte), `SESSION_SECRET`, `NODE_ENV=production`. `PORT` lo pone Railway.
5. Deploy → abre la URL https → prueba `/api/health` y `/admin/entrar` en el celular.

### Qué no hace este despliegue

- No cobra tarjetas. El botón «Simular pago» **no** es un cargo real (no Stripe, Conekta ni Mercado Pago).
- No se conecta a Cloudbeds. Los cupos se cargan a mano en el panel admin.
- No pongas secretos reales en el código ni en capturas del repo.

### Si algo no abre

- La URL debe ser `https://…`, no `http://127.0.0.1` ni `localhost`.
- Free tier dormido: el primer toque puede tardar ~1 minuto, o el disco se perdió — pasa a Starter + volumen.
- Admin no entra: confirma `ADMIN_PASSWORD` en el panel del host (no la de tu `.env` local).

## Cómo probar dos sesiones

1. Abre dos ventanas (o una normal y una privada) en `/publicaciones/demo-auction-pr-bung4`.
2. Regístrate con correos distintos.
3. Puja en una: la otra debe mostrar la misma puja al cabo de ~2 s (polling al servidor).

## Catálogo (fase 1)

Precios = MXN **por alojamiento por noche** (base). **Impuestos por confirmar.** Tarifas sujetas a cambio. Inventarios de referencia (~64 / ~55 / ~23) **por confirmar**.

### Hotel Posada Real

Menores: hasta 2 gratis, **menores de 7 años** (no se asume inclusive de 7).

| Categoría | Distribución | Adultos | Lista | Cocina |
|-----------|--------------|---------|-------|--------|
| Habitación para 2 | 1 matrimonial | 2 | $1,300 | no |
| Habitación para 4 | 2 matrimoniales | 4 | $1,600 | no |
| Habitación para 5 | 2 matrimoniales + litera | 5 | $1,750 | no |
| Habitación para 6 | 3 matrimoniales | 6 | $2,000 | no |
| Habitación para 7 | 3 matrimoniales + litera | 7 | $2,150 | no |
| Bungalow para 4 | 2 matrimoniales | 4 | $1,800 | sí |
| Bungalow para 6 | 3 matrimoniales | 6 | $2,100 | sí |
| Bungalow 2 recámaras para 8 | 4 matrimoniales | 8 | $2,700 | sí |

Servicios: alberca, chapoteadero con tobogán, jacuzzi, estacionamiento, ~60 m playa.

### Isla Coral Posada Real 2

Un tipo: bungalow $2,050 /noche, 4 adultos + hasta 2 menores **0 a 7 inclusive**, 2 queen, cocina, balcón, AC. Frase: «Un lugar para descansar».

No se activan tarifas de temporada, mínimos de noches, anticipos ni 4ª noche gratis (no ratificados).

### Hotel Real del Sol

Informativo / próximamente. Sin ventas.

## Subastas (servidor)

- Puja = **total de la estancia** en MXN.
- Primera ≥ mínimo; incremento ≥ $50.
- Puja en los últimos 2 minutos → cierre +2 minutos.
- Al cierre, la más alta gana derecho a comprar (20 min para simular pago).
- Impago → `UNPAID_EXPIRED`, se libera el cupo, **no** se premia al segundo lugar.

Los cupos de demostración al arrancar una base vacía están marcados como inventario **manual**. El mínimo $1,590 del bungalow demo es el ejemplo **HYPOTHETICAL** de `docs/floor-price.md` — no es un piso real.

## Mínimo rentable

Ver [docs/floor-price.md](docs/floor-price.md) y la página `/metodo-piso`. Las tarifas de lista **no** son el piso. No usar −20 % «porque sí». Los números de ejemplo están marcados como hipotéticos.

## Tests

```bash
npm test
```

Cubre: rechazo bajo mínimo, incremento $50, extensión anti-snipe, impago sin adjudicar al 2º, Real del Sol no vendible, `/api/health`, cookies Secure, SPA + API en el mismo origen.

## Stack

React + TypeScript (Vite) · Express · SQLite (`node:sqlite`) en el mismo repo.
Producción: un proceso Node sirve `client/dist` y `/api`. `Dockerfile` + `render.yaml` (Render) o el mismo Docker en Railway, con disco en `/data`.

Especificación de producto: [docs/SPEC.md](docs/SPEC.md).
