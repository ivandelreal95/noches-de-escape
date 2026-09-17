import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "./api.ts";
import { Callout, PhotoNote } from "./components.tsx";
import { mxn } from "./format.ts";
import { ListingCard } from "./HomePage.tsx";
import type { Hotel, Listing } from "./types.ts";

export function HotelPage() {
  const { id } = useParams();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .hotel(id)
      .then((d) => {
        setHotel(d.hotel);
        setListings(d.listings);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p className="err">{error}</p>;
  if (!hotel) return <p>Cargando…</p>;

  return (
    <>
      <p className="kicker">
        <Link to="/">Catálogo</Link> / {hotel.shortName}
      </p>
      <h1>{hotel.name}</h1>
      {hotel.phrase ? <p className="lede">{hotel.phrase}</p> : null}
      <p className="lede">{hotel.description}</p>
      <Callout kind="info">{hotel.inventoryNote}</Callout>
      <p>
        <strong>Menores:</strong> {hotel.kidsPolicy}
      </p>
      <p className="tiny">{hotel.taxNote}</p>
      <p className="tiny">{hotel.disclaimer}</p>
      <PhotoNote />

      <div className="chips" style={{ margin: "1rem 0" }}>
        {hotel.amenities.map((a) => (
          <span className="chip" key={a}>
            {a}
          </span>
        ))}
      </div>

      {hotel.comingSoon || !hotel.sellable ? (
        <Callout kind="warn">
          Este hotel no admite compra ni subasta hasta que existan datos reales de tarifario y
          categorías. No se inventa un precio.
        </Callout>
      ) : (
        <>
          <h2>Categorías (tarifa de lista)</h2>
          <div className="table-wrap folio">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Distribución</th>
                  <th>Adultos</th>
                  <th>Cocina</th>
                  <th>Lista / noche</th>
                </tr>
              </thead>
              <tbody>
                {hotel.categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.distribution}</td>
                    <td>{c.adults}</td>
                    <td>{c.kitchen ? "Sí" : "No"}</td>
                    <td>{mxn(c.tariffBaseMxn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny">
            Las capacidades son las de la especificación; no se recalculan por número de camas. La
            tarifa de lista no es el piso de subasta.
          </p>
        </>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>Publicaciones de este hotel</h2>
      {listings.length === 0 ? (
        <p className="muted">No hay cupos publicados en este momento.</p>
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
