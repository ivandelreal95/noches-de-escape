import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "./api.ts";
import { Callout, GuestForm } from "./components.tsx";
import { fechaHora, mxn, statusLabel } from "./format.ts";
import type { Bid, Me, Purchase } from "./types.ts";

export function ActivityPage() {
  const { me, setMe } = useOutletContext<{ me: Me | null; setMe: (m: Me) => void }>();
  const [bids, setBids] = useState<Bid[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api
      .activity()
      .then((d) => {
        setBids(d.bids);
        setPurchases(d.purchases);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    if (me?.role === "guest") load();
  }, [me]);

  if (!me || me.role !== "guest") {
    return (
      <>
        <h1>Mi actividad</h1>
        <p>Entra con tu correo simulado para ver pujas y compras de esta sesión.</p>
        <GuestForm onDone={() => api.me().then(setMe)} />
      </>
    );
  }

  async function pay(id: string) {
    setError(null);
    try {
      const r = await api.simulatePay(id);
      setMsg(r.message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <>
      <h1>Mi actividad</h1>
      <p className="muted">
        {me.guest?.name} · {me.guest?.email} · sesión simulada
      </p>
      {msg ? <Callout kind="ok">{msg}</Callout> : null}
      {error ? <p className="err">{error}</p> : null}

      <h2>Compras (pago simulado)</h2>
      {purchases.length === 0 ? (
        <p className="muted">Sin compras todavía.</p>
      ) : (
        <div className="table-wrap folio">
          <table>
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{fechaHora(p.createdAt)}</td>
                  <td>{p.kind === "AUCTION_WIN" ? "Ganador de subasta" : "Compra inmediata"}</td>
                  <td>{mxn(p.amountMxn)}</td>
                  <td>{statusLabel(p.status)}</td>
                  <td>
                    {p.status === "SIMULATED_PENDING" ? (
                      <button className="btn" type="button" onClick={() => pay(p.id)}>
                        Simular pago
                      </button>
                    ) : (
                      <Link to={`/publicaciones/${p.listingId}`}>Ver</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Pujas</h2>
      {bids.length === 0 ? (
        <p className="muted">Sin pujas.</p>
      ) : (
        <ul className="bid-list folio">
          {bids.map((b) => (
            <li key={b.id}>
              <Link to={`/publicaciones/${b.listingId}`}>{mxn(b.amountMxn)}</Link>
              <span>{fechaHora(b.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ComoFuncionaPage() {
  const { status } = useOutletContext<{ status: { implemented: string[]; simulated: string[]; pendingExternal: string[] } | null }>();
  return (
    <>
      <p className="kicker">Transparencia</p>
      <h1>Cómo funciona (y qué no hace esta fase)</h1>
      <p className="lede">
        Plataforma para vender noches desocupadas de Grupo Posada Real vía cupos puntuales: compra
        inmediata o subasta con mínimo del hotel.
      </p>

      <div className="grid grid-3">
        <section className="card">
          <h3>Implementado</h3>
          <ul>
            {(status?.implemented ?? []).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>Simulado</h3>
          <ul>
            {(status?.simulated ?? []).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3>Pendiente / externo</h3>
          <ul>
            {(status?.pendingExternal ?? []).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Reglas de subasta</h2>
      <ul>
        <li>Una subasta = 1 unidad para fechas concretas. La puja es el total de la estancia en MXN.</li>
        <li>Primera puja ≥ mínimo. Incremento mínimo $50 MXN.</li>
        <li>Puja en los últimos 2 minutos: el cierre se extiende 2 minutos.</li>
        <li>Al cierre, la más alta gana el derecho a comprar (20 minutos para «Simular pago»).</li>
        <li>
          Si no paga: estado UNPAID_EXPIRED y se libera el cupo. No se adjudica automáticamente al
          segundo lugar.
        </li>
      </ul>
    </>
  );
}
