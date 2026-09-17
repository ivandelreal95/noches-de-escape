import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "./api.ts";
import { Callout, GuestForm, PhotoNote } from "./components.tsx";
import { fecha, fechaHora, mxn, remaining, statusLabel } from "./format.ts";
import type { Bid, Listing, Me, Purchase } from "./types.ts";

export function ListingPage() {
  const { id } = useParams();
  const { me, setMe } = useOutletContext<{ me: Me | null; setMe: (m: Me) => void }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [serverNow, setServerNow] = useState(Date.now());
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [amount, setAmount] = useState("");

  const refreshMe = useCallback(() => {
    api.me().then(setMe);
  }, [setMe]);

  const load = useCallback(() => {
    if (!id) return;
    api
      .listing(id)
      .then((d) => {
        setListing(d.listing);
        setBids(d.bids);
        setServerNow(d.serverNow);
        setTick(Date.now());
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 2000);
    const clock = setInterval(() => setTick(Date.now()), 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    if (listing?.nextMinBidMxn != null && amount === "") {
      setAmount(String(listing.nextMinBidMxn));
    }
  }, [listing, amount]);

  if (error && !listing) return <p className="err">{error}</p>;
  if (!listing) return <p>Cargando…</p>;

  const drift = Date.now() - tick;
  const approxNow = serverNow + drift;
  const guestReady = me?.role === "guest";

  async function onBid(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const r = await api.bid(id, Number(amount));
      setListing(r.listing);
      setBids(r.bids);
      setMessage(r.message);
      setAmount(String(r.listing.nextMinBidMxn ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function onBuy() {
    if (!id) return;
    setError(null);
    try {
      const r = await api.buyNow(id);
      setListing(r.listing);
      setPurchase(r.purchase);
      setMessage(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function onPay() {
    if (!purchase) return;
    try {
      const r = await api.simulatePay(purchase.id);
      setPurchase(r.purchase);
      setMessage(r.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  const canAct =
    listing.status === "LIVE" &&
    (listing.mode === "AUCTION" || listing.quantityAvailable > 0) &&
    listing.hotel.sellable;

  return (
    <>
      <p className="kicker">
        <Link to={`/hoteles/${listing.hotel.id}`}>{listing.hotel.shortName}</Link>
      </p>
      <h1>
        {listing.category.name}
        <br />
        <span className="muted" style={{ fontSize: "1.1rem" }}>
          {fecha(listing.checkIn)} → {fecha(listing.checkOut)} · {listing.nights} noche
          {listing.nights === 1 ? "" : "s"}
        </span>
      </h1>

      <div className="chips">
        <span className="chip">{listing.mode === "AUCTION" ? "Subasta · total estancia" : "Compra inmediata · total estancia"}</span>
        <span className="chip">{statusLabel(listing.status)}</span>
        <span className="chip">
          {listing.quantityAvailable}/{listing.quantity} cupos
        </span>
      </div>

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <section className="folio">
          <p>
            {listing.category.distribution} · {listing.category.adults} adultos · cocina:{" "}
            {listing.category.kitchen ? "sí" : "no"}
          </p>
          <p className="tiny">{listing.category.roomAmenities}</p>
          <p className="tiny">{listing.hotel.kidsPolicy}</p>
          <p className="tiny">{listing.hotel.taxNote}</p>
          <PhotoNote />
          <p>
            Lista de referencia: <strong>{mxn(listing.category.tariffBaseMxn)}</strong> /noche ·{" "}
            <strong>{mxn(listing.listRateStayMxn)}</strong> la estancia.
          </p>
          {listing.notes ? <Callout kind="info">{listing.notes}</Callout> : null}

          {listing.mode === "AUCTION" ? (
            <>
              <p className="tiny">La puja es el total de la estancia en MXN (no por noche).</p>
              <p>
                Mínimo: {mxn(listing.auctionMinTotal ?? 0)}
                {listing.highBidMxn != null ? ` · más alta: ${mxn(listing.highBidMxn)}` : " · aún no hay pujas"}
              </p>
              {listing.auctionEndsAt ? (
                <p>
                  Cierra: {fechaHora(listing.auctionEndsAt)} · queda{" "}
                  <span className="countdown">{remaining(listing.auctionEndsAt, approxNow)}</span>
                </p>
              ) : null}
              {listing.status === "CLOSED" && listing.winnerIsYou ? (
                <Callout kind="warn">
                  Ganaste el derecho de compra. Tienes 20 minutos para pulsar «Simular pago». Si no,
                  el cupo se libera y no se adjudica al segundo lugar. Ve a{" "}
                  <Link to="/actividad">Mi actividad</Link>.
                </Callout>
              ) : null}
            </>
          ) : (
            <p className="price">{listing.buyNowPriceTotal != null ? mxn(listing.buyNowPriceTotal) : "—"}</p>
          )}
        </section>

        <section>
          {!listing.hotel.sellable ? (
            <Callout kind="warn">Este hotel no se puede comprar.</Callout>
          ) : !guestReady ? (
            <>
              <h2>Para pujar o comprar</h2>
              <GuestForm
                onDone={() => {
                  refreshMe();
                }}
              />
            </>
          ) : canAct && listing.mode === "AUCTION" ? (
            <form onSubmit={onBid} className="folio">
              <h2>Pujar</h2>
              <p className="tiny">
                Primera puja ≥ mínimo. Después, incremento mínimo $50 MXN. Si pujas en los últimos 2
                minutos, el cierre se extiende 2 minutos.
              </p>
              <label htmlFor="amount">Monto total de la estancia (MXN)</label>
              <input
                id="amount"
                type="number"
                min={listing.nextMinBidMxn ?? 0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="tiny">Siguiente mínimo: {listing.nextMinBidMxn != null ? mxn(listing.nextMinBidMxn) : "—"}</p>
              <button className="btn coral" type="submit">
                Enviar puja
              </button>
            </form>
          ) : canAct && listing.mode === "BUY_NOW" ? (
            <div className="folio">
              <h2>Comprar ahora</h2>
              <p className="tiny">Reserva un cupo de esta publicación. El pago es simulado.</p>
              <button className="btn coral" type="button" onClick={onBuy}>
                Reservar cupo
              </button>
            </div>
          ) : (
            <Callout kind="info">Esta publicación no acepta nuevas pujas o compras.</Callout>
          )}

          {purchase ? (
            <div className="folio" style={{ marginTop: "1rem" }}>
              <span className="stamp">Simulado</span>
              <p>
                {statusLabel(purchase.status)} · {mxn(purchase.amountMxn)}
              </p>
              {purchase.status === "SIMULATED_PENDING" ? (
                <button className="btn" type="button" onClick={onPay}>
                  Simular pago
                </button>
              ) : (
                <Callout kind="ok">No se cobró ninguna tarjeta.</Callout>
              )}
            </div>
          ) : null}

          {message ? <p className="muted">{message}</p> : null}
          {error ? <p className="err">{error}</p> : null}
        </section>
      </div>

      {listing.mode === "AUCTION" ? (
        <>
          <h2 style={{ marginTop: "1.5rem" }}>Pujas (servidor)</h2>
          <p className="tiny">Se actualizan cada 2 s desde el servidor. Misma lista en todas las sesiones.</p>
          {bids.length === 0 ? (
            <p className="muted">Nadie ha pujado todavía.</p>
          ) : (
            <ul className="bid-list folio">
              {bids.map((b) => (
                <li key={b.id}>
                  <span>{b.guestName}</span>
                  <span>
                    {mxn(b.amountMxn)} · {fechaHora(b.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </>
  );
}
