import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./api.ts";
import { ActivityPage, ComoFuncionaPage } from "./ActivityPage.tsx";
import { AdminLoginPage, AdminPage } from "./AdminPage.tsx";
import { Layout } from "./components.tsx";
import { HomePage } from "./HomePage.tsx";
import { HotelPage } from "./HotelPage.tsx";
import { ListingPage } from "./ListingPage.tsx";
import { PisoPage } from "./PisoPage.tsx";
import type { Me } from "./types.ts";

export function App() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe({ role: "anonymous" }));
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout me={me} setMe={setMe} />}>
        <Route index element={<HomePage />} />
        <Route path="hoteles/:id" element={<HotelPage />} />
        <Route path="publicaciones/:id" element={<ListingPage />} />
        <Route path="actividad" element={<ActivityPage />} />
        <Route path="como-funciona" element={<ComoFuncionaPage />} />
        <Route path="metodo-piso" element={<PisoPage />} />
        <Route path="admin/entrar" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
