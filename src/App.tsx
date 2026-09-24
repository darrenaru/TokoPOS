import { Navigate, Route, HashRouter, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./ui/components/Layout";
import { LoginScreen } from "./ui/screens/LoginScreen";
import { KasirScreen } from "./ui/screens/KasirScreen";
import { ProdukScreen } from "./ui/screens/ProdukScreen";
import { StokScreen } from "./ui/screens/StokScreen";
import { KasScreen } from "./ui/screens/KasScreen";
import { RiwayatTransaksiScreen } from "./ui/screens/RiwayatTransaksiScreen";
import { PengaturanScreen } from "./ui/screens/PengaturanScreen";
import { LaporanScreen } from "./ui/screens/LaporanScreen";
import { PenggunaScreen } from "./ui/screens/PenggunaScreen";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (user?.peran !== "admin") return <Navigate to="/kasir" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/kasir" replace />} />
        <Route path="/kasir" element={<KasirScreen />} />
        <Route
          path="/produk"
          element={
            <RequireAdmin>
              <ProdukScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/stok"
          element={
            <RequireAdmin>
              <StokScreen />
            </RequireAdmin>
          }
        />
        <Route path="/kas" element={<KasScreen />} />
        <Route path="/riwayat" element={<RiwayatTransaksiScreen />} />
        <Route
          path="/laporan"
          element={
            <RequireAdmin>
              <LaporanScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/pengguna"
          element={
            <RequireAdmin>
              <PenggunaScreen />
            </RequireAdmin>
          }
        />
        <Route
          path="/pengaturan"
          element={
            <RequireAdmin>
              <PengaturanScreen />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
