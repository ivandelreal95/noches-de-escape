export function mxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function fechaHora(ms: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(ms));
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Borrador",
    LIVE: "Publicada",
    PAUSED: "Pausada",
    CLOSED: "Cerrada · pendiente de pago",
    SOLD: "Vendida",
    EXPIRED: "Expirada sin pujas",
    UNPAID_EXPIRED: "No pagada · cupo liberado",
    SIMULATED_PENDING: "Pago simulado pendiente",
    SIMULATED_PAID: "Pago simulado registrado",
  };
  return map[status] ?? status;
}

export function remaining(endMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
