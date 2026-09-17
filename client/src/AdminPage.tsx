import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "./api.ts";
import { Callout } from "./components.tsx";
import { fecha, mxn, statusLabel } from "./format.ts";
import type { Hotel, Listing, Me, Purchase } from "./types.ts";

export function AdminLoginPage() {
  const { me, setMe } = useOutletContext<{ me: Me | null; setMe: (m: Me) => void }>();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (me?.role === "admin") return <Navigate to="/admin" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") || "");
    try {
      await api.adminAuth(password);
      setMe({ role: "admin" });
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <h1>Panel del hotel</h1>
      <p className="muted">Contraseña de entorno (ADMIN_PASSWORD). En desarrollo: ver README.</p>
      <form className="folio" onSubmit={submit} style={{ maxWidth: 420 }}>
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {error ? <p className="err">{error}</p> : null}
        <button className="btn" type="submit">
          Entrar
        </button>
      </form>
    </>
  );
}

export function AdminPage() {
  const { me } = useOutletContext<{ me: Me | null }>();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [purchases, setPurchases] = useState<(Purchase & { guest: { name: string; email: string } | null })[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [hotelId, setHotelId] = useState("");
  const sellable = hotels.filter((h) => h.sellable && !h.comingSoon);
  const categories = sellable.find((h) => h.id === hotelId)?.categories ?? sellable[0]?.categories ?? [];

  function reload() {
    Promise.all([api.hotels(), api.adminListings(), api.adminPurchases()])
      .then(([h, l, p]) => {
        setHotels(h.hotels);
        setListings(l.listings);
        setPurchases(p.purchases);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    if (me?.role === "admin") reload();
  }, [me]);

  if (!me) return <p>Cargando…</p>;
  if (me.role !== "admin") return <Navigate to="/admin/entrar" replace />;

  async function createListing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mode = String(fd.get("mode"));
    const body: Record<string, unknown> = {
      hotelId: String(fd.get("hotelId")),
      categoryId: String(fd.get("categoryId")),
      checkIn: String(fd.get("checkIn")),
      checkOut: String(fd.get("checkOut")),
      mode,
      status: String(fd.get("status")),
      notes: String(fd.get("notes") || "") || null,
      quantity: Number(fd.get("quantity") || 1),
    };
    if (mode === "BUY_NOW") body.buyNowPriceTotal = Number(fd.get("buyNowPriceTotal"));
    if (mode === "AUCTION") {
      body.auctionMinTotal = Number(fd.get("auctionMinTotal"));
      body.durationMinutes = Number(fd.get("durationMinutes"));
    }
    setError(null);
    try {
      await api.adminCreate(body);
      setMsg("Publicación creada. El catálogo público la verá si está LIVE.");
      reload();
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function patch(id: string, status: string) {
    try {
      await api.adminPatch(id, status);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <>
      <p className="kicker">Solo cupos puntuales</p>
      <h1>Administración</h1>
      <Callout kind="warn">
        El catálogo de hoteles y tarifas está bloqueado a la especificación v1 (no editable) para no
        alterar precios ratificados. Real del Sol no aparece como vendible. Cloudbeds no está
        conectado: estos cupos son manuales.
      </Callout>
      {msg ? <Callout kind="ok">{msg}</Callout> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <form className="folio" onSubmit={createListing}>
          <h2>Nueva publicación</h2>
          <label htmlFor="hotelId">Hotel</label>
          <select
            id="hotelId"
            name="hotelId"
            value={hotelId || sellable[0]?.id || ""}
            onChange={(e) => setHotelId(e.target.value)}
            required
          >
            {sellable.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <label htmlFor="categoryId">Categoría</label>
          <select id="categoryId" name="categoryId" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (lista {mxn(c.tariffBaseMxn)}/noche)
              </option>
            ))}
          </select>
          <label htmlFor="checkIn">Check-in</label>
          <input id="checkIn" name="checkIn" type="date" required />
          <label htmlFor="checkOut">Check-out</label>
          <input id="checkOut" name="checkOut" type="date" required />
          <label htmlFor="mode">Modo</label>
          <select id="mode" name="mode" defaultValue="BUY_NOW">
            <option value="BUY_NOW">Compra inmediata</option>
            <option value="AUCTION">Subasta (1 cupo)</option>
          </select>
          <label htmlFor="quantity">Cupos (compra inmediata; subasta = 1)</label>
          <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
          <label htmlFor="buyNowPriceTotal">Precio compra inmediata (total estancia MXN)</label>
          <input id="buyNowPriceTotal" name="buyNowPriceTotal" type="number" min={1} step={1} />
          <label htmlFor="auctionMinTotal">Mínimo de subasta (total estancia MXN)</label>
          <input id="auctionMinTotal" name="auctionMinTotal" type="number" min={1} step={1} />
          <p className="tiny">
            No uses un −20 % automático. Calcula el piso con{" "}
            <Link to="/metodo-piso">el método de mínimo rentable</Link> (números actuales =
            HYPOTHETICAL).
          </p>
          <label htmlFor="durationMinutes">Duración de subasta (minutos)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min={3} defaultValue={15} />
          <label htmlFor="status">Estado inicial</label>
          <select id="status" name="status" defaultValue="LIVE">
            <option value="LIVE">Publicada</option>
            <option value="DRAFT">Borrador</option>
          </select>
          <label htmlFor="notes">Notas internas / aviso al huésped</label>
          <textarea id="notes" name="notes" placeholder="Cupo manual. Impuestos por confirmar." />
          <button className="btn" type="submit">
            Crear cupo
          </button>
        </form>

        <aside className="folio">
          <h2>Recordatorios</h2>
          <ul>
            <li>No edites a la ligera fechas o precios si ya hay pujas: pausa o crea otra publicación.</li>
            <li>Pagos en esta fase: simulados. Revisa la tabla de compras.</li>
            <li>Inventario de referencia (64 / 55 / 23) está por confirmar; no es ocupación real.</li>
          </ul>
        </aside>
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Publicaciones</h2>
      <div className="table-wrap folio">
        <table>
          <thead>
            <tr>
              <th>Hotel / categoría</th>
              <th>Fechas</th>
              <th>Modo</th>
              <th>Precio / mín.</th>
              <th>Cupos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.hotel.shortName}
                  <br />
                  {l.category.name}
                </td>
                <td>
                  {fecha(l.checkIn)} → {fecha(l.checkOut)}
                  <br />
                  {l.nights} noche{l.nights === 1 ? "" : "s"}
                </td>
                <td>{l.mode === "AUCTION" ? "Subasta" : "Compra"}</td>
                <td>
                  {l.mode === "AUCTION"
                    ? `mín. ${mxn(l.auctionMinTotal ?? 0)}`
                    : mxn(l.buyNowPriceTotal ?? 0)}
                </td>
                <td>
                  {l.quantityAvailable}/{l.quantity}
                </td>
                <td>{statusLabel(l.status)}</td>
                <td>
                  <Link to={`/publicaciones/${l.id}`}>Ver</Link>
                  <br />
                  {l.status === "LIVE" ? (
                    <button className="link" type="button" onClick={() => patch(l.id, "PAUSED")}>
                      Pausar
                    </button>
                  ) : null}
                  {l.status === "PAUSED" || l.status === "DRAFT" ? (
                    <button className="link" type="button" onClick={() => patch(l.id, "LIVE")}>
                      Publicar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: "1.5rem" }}>Compras (todas simuladas)</h2>
      <div className="table-wrap folio">
        <table>
          <thead>
            <tr>
              <th>Huésped</th>
              <th>Monto</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.guest?.name} · {p.guest?.email}
                </td>
                <td>{mxn(p.amountMxn)}</td>
                <td>{p.kind}</td>
                <td>{statusLabel(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
