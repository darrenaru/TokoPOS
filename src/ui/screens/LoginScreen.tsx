import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShoppingBag, Receipt, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function LoginScreen() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keluar, setKeluar] = useState(false);
  // Menahan redirect otomatis sampai animasi keluar selesai.
  const [menahan, setMenahan] = useState(false);

  if (user && !menahan) {
    return <Navigate to="/kasir" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setMenahan(true);
    try {
      await login(username, password);
      setKeluar(true);
      const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise((r) => setTimeout(r, kurangiGerak ? 0 : 450));
      setMenahan(false);
      navigate("/kasir", { replace: true });
    } catch (err) {
      setMenahan(false);
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
      <div className={`${keluar ? "login-keluar" : "login-kartu"} flex w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl`}>
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink p-8 text-white sm:flex">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-600/20 login-hanyut" />
          <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10 login-hanyut-b" />

          <div className="login-naik relative flex items-center gap-2.5" style={{ "--tunda": "150ms" } as React.CSSProperties}>
            <img src="/logo-mark.png" alt="TokoPOS" className="h-10 w-10 object-contain" />
            <span className="text-lg font-bold">TokoPOS</span>
          </div>

          <img src="/logo-mark.png" alt="" className="login-melayang relative mx-auto h-32 object-contain drop-shadow-[0_12px_30px_rgba(200,245,96,0.25)]" />

          <div className="login-naik relative" style={{ "--tunda": "350ms" } as React.CSSProperties}>
            <h2 className="mb-2 text-2xl font-bold leading-snug">
              Kelola transaksi tokomu, secepat kasir profesional.
            </h2>
            <p className="text-sm text-white/70">
              Satu aplikasi untuk transaksi, stok, dan kas — tetap jalan meski tanpa internet.
            </p>
          </div>

          <div className="login-naik relative flex gap-6 text-white/80" style={{ "--tunda": "500ms" } as React.CSSProperties}>
            <div className="flex items-center gap-2 text-sm">
              <ShoppingBag size={16} /> Transaksi Cepat
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Receipt size={16} /> Cetak Struk
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wallet size={16} /> Rekonsiliasi Kas
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full p-8 sm:w-1/2 sm:p-10">
          <h1 style={{ "--tunda": "250ms" } as React.CSSProperties} className="login-naik mb-1 text-2xl font-bold text-slate-900">Selamat Datang</h1>
          <p style={{ "--tunda": "330ms" } as React.CSSProperties} className="login-naik mb-6 text-sm text-slate-500">Masuk untuk mulai bertransaksi</p>

          <div className="login-naik" style={{ "--tunda": "410ms" } as React.CSSProperties}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            autoFocus
            className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          </div>

          <div className="login-naik" style={{ "--tunda": "490ms" } as React.CSSProperties}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            className="mb-5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          </div>

          {error && (
            <p key={error} className="login-getar mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ "--tunda": "570ms" } as React.CSSProperties}
            className="login-naik w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 transition hover:bg-brand-500 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
