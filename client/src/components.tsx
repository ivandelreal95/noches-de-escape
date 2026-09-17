import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "./api.ts";
import type { Me, StatusPayload } from "./types.ts";

export function Layout({ me, setMe }: { me: Me | null; setMe: (m: Me) => void }) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.status().then(setStatus).catch(() => undefined);
  }, []);

  async function logout() {
    await api.logout();
    setMe({ role: "anonymous" });
    navigate("/");
  }

  return (
    <>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <div className="banner">
        Fase 1 · inventario <strong>manual</strong> (no Cloudbeds) · pagos{" "}
        <strong>simulados</strong> · sin fotos reales de habitación · Real del Sol no se vende
      </div>
      <header className="top">
        <Link to="/" className="brand">
          <span className="mark">NE</span>
          <span className="brand-text">
            <b>Noches de Escape</b>
            <small>Grupo Posada Real · Rincón de Guayabitos, Nayarit</small>
          </span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Catálogo
          </NavLink>
          <NavLink to="/como-funciona">Cómo funciona</NavLink>
          <NavLink to="/metodo-piso">Mínimo rentable</NavLink>
          <NavLink to="/actividad">Mi actividad</NavLink>
          {me?.role === "admin" ? (
            <NavLink to="/admin">Admin</NavLink>
          ) : (
            <NavLink to="/admin/entrar">Admin</NavLink>
          )}
          {me && me.role !== "anonymous" ? (
            <button className="link" type="button" onClick={logout}>
              Salir
            </button>
          ) : null}
        </nav>
      </header>
      <main id="contenido" className="wrap">
        <Outlet context={{ me, setMe, status }} />
      </main>
      <footer>
        Nombre provisional: Noches de Escape. Operación para Grupo Posada Real (Iván Del Real Gaona).
        Las tarifas de lista no son descuentos permanentes ni el piso de subasta. Impuestos por
        confirmar.
      </footer>
    </>
  );
}

export function GuestForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.guestAuth({
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        whatsapp: String(fd.get("whatsapp") || "") || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <form onSubmit={submit} className="folio">
      <p className="tiny">
        Registro <strong>simulado</strong>: no se verifica el correo ni WhatsApp. Sirve para asociar
        pujas y compras a una sesión.
      </p>
      <label htmlFor="name">Nombre</label>
      <input id="name" name="name" required minLength={2} autoComplete="name" />
      <label htmlFor="email">Correo</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="whatsapp">WhatsApp (opcional)</label>
      <input id="whatsapp" name="whatsapp" autoComplete="tel" />
      {error ? <p className="err">{error}</p> : null}
      <button className="btn" type="submit">
        Continuar
      </button>
    </form>
  );
}

export function PhotoNote() {
  return (
    <p className="tiny">
      No hay fotografías de habitación en esta fase. No se muestran imágenes genéricas de stock como
      si fueran del hotel.
    </p>
  );
}

export function Callout({
  kind,
  children,
}: {
  kind: "warn" | "ok" | "info";
  children: ReactNode;
}) {
  const cls = kind === "warn" ? "warnbox" : kind === "ok" ? "okbox" : "infobox";
  return <div className={cls}>{children}</div>;
}
