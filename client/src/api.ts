import type { Bid, Hotel, Listing, Me, Purchase, StatusPayload } from "./types.ts";

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

const opts: RequestInit = { credentials: "include" };

export const api = {
  status: () => fetch("/api/status", opts).then((r) => parse<StatusPayload>(r)),
  me: () => fetch("/api/me", opts).then((r) => parse<Me>(r)),
  hotels: () =>
    fetch("/api/hotels", opts).then((r) => parse<{ hotels: Hotel[] }>(r)),
  hotel: (id: string) =>
    fetch(`/api/hotels/${id}`, opts).then((r) =>
      parse<{ hotel: Hotel; listings: Listing[] }>(r),
    ),
  listings: () =>
    fetch("/api/listings", opts).then((r) =>
      parse<{ listings: Listing[]; note: string }>(r),
    ),
  listing: (id: string) =>
    fetch(`/api/listings/${id}`, opts).then((r) =>
      parse<{ listing: Listing; bids: Bid[]; serverNow: number }>(r),
    ),
  guestAuth: (body: { name: string; email: string; whatsapp?: string }) =>
    fetch("/api/auth/guest", {
      ...opts,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => parse<{ role: "guest"; guest: { id: string; name: string; email: string } }>(r)),
  adminAuth: (password: string) =>
    fetch("/api/auth/admin", {
      ...opts,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).then((r) => parse<{ role: "admin" }>(r)),
  logout: () => fetch("/api/auth/logout", { ...opts, method: "POST" }).then((r) => parse<{ ok: boolean }>(r)),
  bid: (id: string, amountMxn: number) =>
    fetch(`/api/listings/${id}/bids`, {
      ...opts,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountMxn }),
    }).then((r) =>
      parse<{ listing: Listing; bids: Bid[]; extended: boolean; message: string }>(r),
    ),
  buyNow: (id: string) =>
    fetch(`/api/listings/${id}/buy-now`, {
      ...opts,
      method: "POST",
      headers: { "content-type": "application/json" },
    }).then((r) => parse<{ listing: Listing; purchase: Purchase; message: string }>(r)),
  simulatePay: (id: string) =>
    fetch(`/api/purchases/${id}/simulate-pay`, {
      ...opts,
      method: "POST",
    }).then((r) => parse<{ purchase: Purchase; message: string }>(r)),
  activity: () =>
    fetch("/api/me/activity", opts).then((r) =>
      parse<{ bids: Bid[]; purchases: Purchase[] }>(r),
    ),
  adminListings: () =>
    fetch("/api/admin/listings", opts).then((r) => parse<{ listings: Listing[] }>(r)),
  adminCreate: (body: Record<string, unknown>) =>
    fetch("/api/admin/listings", {
      ...opts,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => parse<{ listing: Listing }>(r)),
  adminPatch: (id: string, status: string) =>
    fetch(`/api/admin/listings/${id}`, {
      ...opts,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => parse<{ listing: Listing }>(r)),
  adminPurchases: () =>
    fetch("/api/admin/purchases", opts).then((r) =>
      parse<{
        purchases: (Purchase & { guest: { name: string; email: string } | null })[];
        note: string;
      }>(r),
    ),
};
