import { useMemo, useState } from "react";
import { mxn } from "./format.ts";

export function PisoPage() {
  const [nights, setNights] = useState(2);
  const [cvNoche, setCvNoche] = useState(180);
  const [salida, setSalida] = useState(350);
  const [adq, setAdq] = useState(80);
  const [fijos, setFijos] = useState(180_000);
  const [rn, setRn] = useState(600);
  const [utilidad, setUtilidad] = useState(200);
  const [listaNoche, setListaNoche] = useState(1600);

  const calc = useMemo(() => {
    const variable = cvNoche * nights + salida + adq;
    const contrib = rn > 0 ? (fijos / rn) * nights : 0;
    const piso = variable + contrib + utilidad;
    return { variable, contrib, piso, lista: listaNoche * nights };
  }, [nights, cvNoche, salida, adq, fijos, rn, utilidad, listaNoche]);

  return (
    <>
      <p className="kicker">Método · no es un descuento fijo</p>
      <h1>Mínimo rentable por categoría</h1>
      <p className="lede">
        Las tarifas base ($1,300…$2,700) son precio de lista, no costo ni piso de subasta. No uses
        un descuento fijo (−20 %, −30 %) como «mínimo».
      </p>

      <div className="warnbox">
        <strong>Números hipotéticos.</strong> El ejemplo y la calculadora de abajo son HYPOTHETICAL.
        No publicques subastas reales con estos valores. Faltan costos reales de Iván / Grupo
        Posada Real.
      </div>

      <h2 style={{ marginTop: "1.25rem" }}>Fórmula (estancia de N noches, categoría C)</h2>
      <pre className="folio" style={{ whiteSpace: "pre-wrap" }}>{`Piso_estancia =
  (CV_noche × N)
  + CV_persona × adultos_esperados × N   # solo si aplica
  + CV_fijo_estancia
  + Comisión_pago_esperada(total)
  + Contribución_fijos
  + Utilidad_objetivo

Contribución_fijos = (Fijos_mensuales_hotel / RoomNights_pronóstico_mes) × N`}</pre>
      <p>
        <code>RoomNights_pronóstico</code> no es inventario × 100 %. Usa un forecast realista (p. ej.
        ocupación histórica, no capacidad llena).
      </p>
      <p>
        Impuestos: sepáralos del ingreso del hotel. El piso de decisión debe ser sobre ingreso neto
        (o deja el impuesto como línea aparte si se traslada al huésped).
      </p>

      <h2>Costos a pedir (reales)</h2>
      <p className="tiny">Completar con MXN. Marca N/A si no aplica. Hoy están vacíos a propósito.</p>
      <div className="table-wrap folio">
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Unidad</th>
              <th>Posada Real</th>
              <th>Isla Coral</th>
              <th>Real del Sol</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Limpieza / ama de llaves", "por salida o por noche"],
              ["Lavandería (sábanas/toallas)", "por salida"],
              ["Amenidades", "por noche o por salida"],
              ["Electricidad (AC)", "por noche ocupada"],
              ["Agua", "por noche ocupada"],
              ["Gas", "por noche ocupada"],
              ["Desgaste / mantenimiento variable", "por noche"],
              ["Costo de adquirir el cliente", "por reserva"],
              ["Comisión pasarela", "% + fijo"],
              ["Gastos fijos mensuales atribuibles", "MXN/mes"],
              ["Room-nights vendidas típicas / mes", "#"],
              ["Utilidad mínima deseada (noche de relleno)", "MXN o %"],
            ].map(([c, u]) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{u}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Ejemplo HYPOTHETICAL</h2>
      <p className="tiny">
        Inventado. Posada Real — Habitación para 4, 2 noches. No usar para publicar subastas.
      </p>
      <div className="table-wrap folio">
        <table>
          <tbody>
            <tr>
              <td>CV noche (luz+agua+gas+wear)</td>
              <td>180 × 2</td>
              <td>360</td>
            </tr>
            <tr>
              <td>Limpieza+lavandería+amenidades</td>
              <td>350 × 1 salida</td>
              <td>350</td>
            </tr>
            <tr>
              <td>Adquisición</td>
              <td></td>
              <td>80</td>
            </tr>
            <tr>
              <td>Fijos mes 180,000 / 600 RN × 2</td>
              <td></td>
              <td>600</td>
            </tr>
            <tr>
              <td>Utilidad objetivo</td>
              <td></td>
              <td>200</td>
            </tr>
            <tr>
              <td>
                <strong>Piso estancia (antes comisión/impuesto)</strong>
              </td>
              <td></td>
              <td>
                <strong>1,590</strong>
              </td>
            </tr>
            <tr>
              <td>Tarifa lista 2 noches (1,600×2)</td>
              <td></td>
              <td>3,200</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Interpretación hipotética: un mínimo ~{mxn(1590)} por 2 noches cubre variables + algo de
        fijos + utilidad chica; sigue muy por debajo de lista, útil solo para inventario que de otro
        modo iría a 0. Una venta sobre el piso no prueba utilidad mensual del hotel.
      </p>

      <h2>Calculadora ilustrativa (sigue siendo hipotética)</h2>
      <div className="grid grid-2">
        <form className="folio" onSubmit={(e) => e.preventDefault()}>
          <label>Noches</label>
          <input type="number" min={1} value={nights} onChange={(e) => setNights(Number(e.target.value))} />
          <label>CV / noche ocupada</label>
          <input type="number" value={cvNoche} onChange={(e) => setCvNoche(Number(e.target.value))} />
          <label>Limpieza+lavandería+amenidades (por salida)</label>
          <input type="number" value={salida} onChange={(e) => setSalida(Number(e.target.value))} />
          <label>Adquisición</label>
          <input type="number" value={adq} onChange={(e) => setAdq(Number(e.target.value))} />
          <label>Fijos mensuales del hotel</label>
          <input type="number" value={fijos} onChange={(e) => setFijos(Number(e.target.value))} />
          <label>Room-nights forecast / mes (≠ 100 % occ)</label>
          <input type="number" value={rn} onChange={(e) => setRn(Number(e.target.value))} />
          <label>Utilidad objetivo</label>
          <input type="number" value={utilidad} onChange={(e) => setUtilidad(Number(e.target.value))} />
          <label>Tarifa lista / noche (solo comparación)</label>
          <input type="number" value={listaNoche} onChange={(e) => setListaNoche(Number(e.target.value))} />
        </form>
        <aside className="folio">
          <span className="stamp">Hypothetical</span>
          <p>Subtotal variable: {mxn(Math.round(calc.variable))}</p>
          <p>Contribución a fijos: {mxn(Math.round(calc.contrib))}</p>
          <p className="price">{mxn(Math.round(calc.piso))}</p>
          <p className="tiny">Piso estancia antes de comisión e impuesto</p>
          <p>Lista de la estancia: {mxn(calc.lista)}</p>
        </aside>
      </div>

      <h2>Qué no hacer</h2>
      <ul>
        <li>Piso = tarifa × 0.7 «porque sí»</li>
        <li>Asumir ocupación 100 % al repartir fijos</li>
        <li>Mezclar IVA con margen sin declararlo</li>
        <li>Abrir subastas públicas antes de fijar piso por categoría y temporada</li>
      </ul>
    </>
  );
}
