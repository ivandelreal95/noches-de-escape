import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.ts";
import { Callout, PhotoNote } from "./components.tsx";
import { fecha, mxn, statusLabel } from "./format.ts";
import type { Hotel, Listing } from "./types.ts";

export function HomePage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.hotels(), api.listings()])
      .then(([h, l]) => {
        setHotels(h.hotels);
        setListings(l.listings);
        setNote(l.note);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <p className="kicker">Rincón de Guayabitos · entre semana</p>
          <h1>Noches que de otro modo quedarían vacías.</h1>
          <p className="lede">
            Compra inmediata a precio especial, o puja por un cupo con mínimo que fija el hotel.
            Solo fechas y unidades publicadas — nunca un descuento permanente a todo el inventario.
          </p>
          <div className="btn-row">
            <a className="btn" href="#cupos">
              Ver cupos publicados
            </a>
            <Link className="btn ghost" to="/como-funciona">
              Qué es real y qué no
            </Link>
          </div>
        </div>
        <aside className="folio">
          <span className="stamp">Fase 1</span>
          <h2>Sin Cloudbeds · sin cargo real</h2>
          <p className="muted">
            El servidor (SQLite) es la fuente de verdad: dos navegadores ven las mismas pujas. El
            PMS Cloudbeds no está conectado. Los botones de pago dicen «Simular pago».
          </p>
          <PhotoNote />
        </aside>
      </section>

      {error ? <p className="err">{error}</p> : null}

      <h2>Los tres hoteles</h2>
      <div className="grid grid-3">
        {hotels.map((h) => (
          <article key={h.id} className={`card ${h.comingSoon ? "soon" : ""}`}>
            <div className={`swatch ${h.id === "posada-real" ? "pr" : h.id === "isla-coral" ? "ic" : "rs"}`}>
              {h.shortName}
            </div>
            <h3>{h.name}</h3>
            {h.phrase ? <p className="muted">{h.phrase}</p> : null}
            <p className="tiny">{h.inventoryNote}</p>
            <p className="tiny">{h.kidsPolicy}</p>
            {h.comingSoon ? (
              <Callout kind="warn">
                Próximamente. No hay tarifario. No se puede comprar ni pujar.
              </Callout>
            ) : (
              <div className="chips">
                {h.amenities.slice(0, 4).map((a) => (
                  <span className="chip" key={a}>
                    {a}
                  </span>
                ))}
              </div>
            )}
            <div className="btn-row">
              <Link className="btn ghost" to={`/hoteles/${h.id}`}>
                {h.comingSoon ? "Ver ficha informativa" : "Ver ficha"}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <h2 id="cupos" style={{ marginTop: "2rem" }}>
        Cupos publicados ahora
      </h2>
      <p className="tiny">{note}</p>
      {listings.length === 0 ? (
        <Callout kind="info">No hay publicaciones vivas. El admin puede crear cupos en el panel.</Callout>
      ) : (
        <div className="grid grid-2">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="card ticket">
      <div className="chips">
        <span className="chip">{listing.mode === "AUCTION" ? "Subasta" : "Compra inmediata"}</span>
        <span className="chip">{statusLabel(listing.status)}</span>
        <span className="chip">{listing.quantityAvailable} cupo(s)</span>
      </div>
      <h3>
        {listing.category.name} · {listing.hotel.shortName}
      </h3>
      <p className="muted">
        {fecha(listing.checkIn)} → {fecha(listing.checkOut)} · {listing.nights} noche
        {listing.nights === 1 ? "" : "s"}
      </p>
      <p>
        {listing.mode === "BUY_NOW" && listing.buyNowPriceTotal != null ? (
          <>
            <span className="price">{mxn(listing.buyNowPriceTotal)}</span>
            <span className="tiny"> total de la estancia</span>
          </>
        ) : (
          <>
            <span className="price">{listing.highBidMxn != null ? mxn(listing.highBidMxn) : mxn(listing.auctionMinTotal ?? 0)}</span>
            <span className="tiny">
              {" "}
              {listing.highBidMxn != null ? "puja más alta (total estancia)" : "mínimo (total estancia)"}
            </span>
          </>
        )}
      </p>
      <p className="tiny">
        Tarifa de lista de referencia: {mxn(listing.listRateStayMxn)} por la estancia ({mxn(listing.category.tariffBaseMxn)}
        /noche). Impuestos por confirmar.
      </p>
      <div className="btn-row">
        <Link className="btn" to={`/publicaciones/${listing.id}`}>
          Abrir
        </Link>
      </div>
    </article>
  );
}
