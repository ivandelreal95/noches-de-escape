# Noches de Escape — especificación de producto (v1)

Plataforma para vender noches desocupadas de Grupo Posada Real (Rincón de Guayabitos, Nayarit) vía:
1) compra inmediata a precio especial (cupos/fechas específicos), y
2) subastas con mínimo controlado por el hotel.

Nombre provisional: "Noches de Escape". Idioma UI: español mexicano. Responsive móvil/desktop.

## Principios
- No descuentos permanentes a todo el inventario: solo cupos y fechas que el admin publique.
- Servidor = fuente de verdad (precios, pujas, ganadores, pagos, disponibilidad). No localStorage como verdad.
- No inventar reseñas, participantes, reservas, descuentos ni fotos genéricas como si fueran de los hoteles.
- Distinguir claramente implementado / simulado / pendiente de servicios externos.
- No cargos reales en pruebas.
- Cloudbeds: primero cupos manuales reconciliables; integración automática solo cuando haya API/credenciales.

## Hoteles y catálogo

### Hotel Posada Real (principal)
- Inventario de referencia ~64 habitaciones — CONFIRMAR antes de ventas reales.
- Política menores: hasta 2 menores gratis, menores de 7 años (NO inclusive de 7 si no se confirma; texto dado: "menores de 7 años").
- Tarifas = MXN por alojamiento por noche (CONFIRMAR). Impuestos: pendiente.
- Categorías (capacidades tal cual; NO recalcular por camas):

| id | nombre | distribución | adultos | tarifa_base_mxn | cocina |
|----|--------|--------------|---------|-----------------|--------|
| pr-hab-2 | Habitación para 2 | 1 cama matrimonial | 2 | 1300 | no |
| pr-hab-4 | Habitación para 4 | 2 camas matrimoniales | 4 | 1600 | no |
| pr-hab-5 | Habitación para 5 | 2 matrimoniales + litera individual | 5 | 1750 | no |
| pr-hab-6 | Habitación para 6 | 3 camas matrimoniales | 6 | 2000 | no |
| pr-hab-7 | Habitación para 7 | 3 matrimoniales + litera individual | 7 | 2150 | no |
| pr-bung-4 | Bungalow para 4 | 2 camas matrimoniales | 4 | 1800 | sí |
| pr-bung-6 | Bungalow para 6 | 3 camas matrimoniales | 6 | 2100 | sí |
| pr-bung-8 | Bungalow 2 recámaras para 8 | 4 camas matrimoniales | 8 | 2700 | sí |

Equipamiento habitaciones: AC, TV cable, ventilador techo, sin cocina.
Bungalows: cocina equipada + lo anterior.
Servicios hotel: alberca, chapoteadero con tobogán, jacuzzi, estacionamiento, ~60 m playa.
Disclaimer: tarifas sujetas a cambio sin previo aviso.

### Isla Coral Posada Real 2
- Inventario ref ~55 — CONFIRMAR.
- Una categoría: bungalow, 4 adultos + hasta 2 menores gratis de 0 a 7 inclusive.
- Tarifa base $2,050 MXN/noche. Distribución: 2 queen.
- Equipamiento: baño privado, cocina, TV, internet, comedor, AC, balcón.
- Frase: "Un lugar para descansar". Descripción: bungalows nuevos, diseño moderno, cálido, familiar.
- NO activar automáticamente: tarifas por temporada, mínimos de noches, anticipos, promo 4ª noche gratis (no ratificadas para esta plataforma).

### Hotel Real del Sol
- Antecedentes ~23 hab / 3 pisos / ~80 m playa — CONFIRMAR.
- Tarifario, categorías, capacidades y política de menores: PENDIENTES.
- En catálogo: visible como "próximamente" o solo listado informativo; NO aceptar compra/subasta hasta datos reales.
- Cualquier precio demo previo = ilustrativo.

## Tipos de publicación (listing)
Admin crea publicaciones con:
- hotel_id, category_id
- check_in, check_out (noches = diff)
- quantity (cupos)
- mode: BUY_NOW | AUCTION
- buy_now_price_total (MXN por estancia) O auction_min_total
- status: DRAFT | LIVE | PAUSED | CLOSED | SOLD | EXPIRED
- No editar a la ligera campos críticos si ya hay pujas o compras (bloquear o requerir confirmación fuerte).

Precios al huésped: mostrar claramente si es por noche o por estancia, total a pagar, noches, adultos/menores incluidos.

## Reglas de subasta (borrador a confirmar)
- Una subasta = 1 unidad para fechas/noches específicas.
- Puja = total de la estancia en MXN.
- Primera puja ≥ mínimo.
- Incremento mínimo $50.
- Puja en últimos 2 minutos extiende cierre +2 minutos.
- Al cierre, puja más alta gana derecho a comprar.
- Ganador tiene 20 minutos para pagar.
- Si no paga: NO adjudicar automáticamente al 2º — dejar hook configurable; default sugerido: liberar cupo y marcar subasta como UNPAID_EXPIRED (confirmación pendiente con negocio).
- Pujas concurrentes, vencimientos y liberación de inventario: lógica de servidor (transacciones / optimistic locking).

## Roles
- guest: ver catálogo, registrarse, pujar, comprar (simulado en v1), ver su actividad.
- admin: panel separado, auth protegida, CRUD hoteles/categorías/listings, pausar, simular/cerrar, ver pagos/reservas/historial.

## Persistencia (fase 1)
Stack sugerido (ajustable):
- Frontend: React + TypeScript (Vite si Vinext no es trivial de bootstrappear).
- Backend API + DB en el mismo proyecto desplegable (p.ej. SQLite/Turso o Postgres; o Cloudflare D1 + Workers si se mantiene path CF).
- Auth admin: al menos password env + session cookie; guests con email/WhatsApp opcional simulado.
- Seed con catálogo Posada Real + Isla Coral; Real del Sol sin ventas.

## Fuera de alcance fase 1 (marcar como pendiente, no fingir)
- Cloudbeds sync automática
- Pagos reales (Stripe/Conekta/Mercado Pago México)
- Fotos reales de habitaciones
- Subastas en WhatsApp nativo
- Impuestos calculados

## Entregables fase 1 (éxito)
1. Repo con app runnable (README: cómo correr local).
2. Catálogo correcto con datos arriba; Real del Sol no vendible.
3. Admin puede crear listing BUY_NOW y AUCTION con cupos/fechas.
4. Estado compartido en servidor: dos "navegadores"/sesiones ven las mismas pujas.
5. Motor de subasta con reglas anteriores (timers en servidor o evaluados al request + cron/alarm).
6. Compra inmediata y pago GANADOR = SIMULADOS (botón "simular pago"), con estados claros.
7. Distinción en UI/README: implementado vs simulado vs externo.
8. Tests básicos del motor de pujas (incremento, extensión, rechazo bajo mínimo).

## Método de mínimo rentable (doc, no inventar % )
Documentar en README/docs/floor-price.md la fórmula:
- Costo variable por noche-ocupada (limpieza, lavandería, amenidades, utilities estimados, wear)
- + adquisición/comisión pago
- + contribución a fijos (fijos mensuales / forecast room-nights ≠ 100% occ)
- + utilidad objetivo
Separar impuestos. Usar placeholders HYPOTHETICAL claramente marcados hasta costos reales de Iván.

## Idioma
Código y UI en español donde el usuario vea copy; nombres técnicos en inglés OK.
