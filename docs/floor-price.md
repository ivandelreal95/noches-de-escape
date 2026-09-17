# Mínimo rentable por categoría (método)

Las tarifas base ($1,300…$2,700) son **precio de lista**, no costo ni piso de subasta.
No uses un descuento fijo (−20%, −30%) como “mínimo”.

## Fórmula (por estancia de N noches, categoría C)

```
Piso_estancia =
  (CV_noche × N)
  + CV_persona × adultos_esperados × N   # solo si aplica (amenities por pax)
  + CV_fijo_estancia                       # check-in/out, adquisición, etc.
  + Comisión_pago_esperada(total)          # sobre la base que use el proveedor
  + Contribución_fijos
  + Utilidad_objetivo
```

Donde:

```
Contribución_fijos = (Fijos_mensuales_hotel / RoomNights_pronóstico_mes) × N
```

`RoomNights_pronóstico` ≠ inventario × 100%. Usa un forecast realista (ej. ocupación histórica ~30% RevPAR/ADR, o tu presupuesto).

**Impuestos:** sepáralos del ingreso del hotel. El piso de decisión debe ser sobre **ingreso neto del hotel** (o deja el impuesto como línea aparte si se traslada al huésped).

## Costos a pedir (reales)

Por favor completa con MXN (promedio o típico). Marca N/A si no aplica.

| Concepto | Unidad | Posada Real | Isla Coral | Real del Sol |
|----------|--------|-------------|------------|--------------|
| Limpieza / ama de llaves | por salida o por noche | | | |
| Lavandería (sábanas/toallas) | por salida | | | |
| Amenidades (jabón, papel, etc.) | por noche o por salida | | | |
| Electricidad (AC) | por noche ocupada | | | |
| Agua | por noche ocupada | | | |
| Gas | por noche ocupada | | | |
| Desgaste / mantenimiento variable | por noche | | | |
| Costo de adquirir el cliente (ads/WhatsApp) | por reserva | | | |
| Comisión pasarela (si conocida) | % + fijo | | | |
| Gastos fijos mensuales atribuibles al hotel (nómina fija, predial, internet, etc.) | MXN/mes | | | |
| Room-nights vendidas típicas / mes (forecast) | # | | | |
| Utilidad mínima deseada sobre una noche “de relleno” | MXN o % | | | |

## Ejemplo HYPOTHETICAL (solo para ilustrar el método)

⚠️ Números inventados. No usar para publicar subastas.

Supuestos hipotéticos Posada Real — Habitación para 4, 2 noches:

| Rubro | Cálculo | MXN |
|-------|---------|-----|
| CV noche (luz+agua+gas+wear) | 180 × 2 | 360 |
| Limpieza+lavandería+amenidades | 350 × 1 salida | 350 |
| Adquisición | 80 | 80 |
| Subtotal variable | | 790 |
| Fijos mes 180,000 / 600 RN forecast = 300/RN × 2 | | 600 |
| Utilidad objetivo | | 200 |
| **Piso estancia (antes comisión/impuesto)** | | **1,590** |
| Tarifa lista 2 noches (1,600×2) | | 3,200 |

Interpretación hipotética: un mínimo de subasta ~$1,590 por 2 noches cubre variables + algo de fijos + utilidad chica; sigue muy por debajo de lista, útil solo para inventario que de otro modo iría a 0. Una venta sobre el piso **no** prueba utilidad mensual del hotel.

## Qué NO hacer
- Piso = tarifa × 0.7 “porque sí”
- Asumir ocupación 100% al repartir fijos
- Mezclar IVA con margen sin declararlo
- Abrir subastas públicas antes de fijar piso por categoría y temporada
