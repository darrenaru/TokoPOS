import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  Boxes,
  Wallet,
  History,
  Settings,
  LogOut,
  BarChart3,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  roles: string[];
}

const navGroups: NavItem[][] = [
  [
    { to: "/kasir", label: "Kasir", icon: LayoutGrid, roles: ["admin", "kasir"] },
    { to: "/kas", label: "Kas", icon: Wallet, roles: ["admin", "kasir"] },
    { to: "/riwayat", label: "Riwayat Transaksi", icon: History, roles: ["admin", "kasir"] },
  ],
  [
    { to: "/produk", label: "Produk", icon: Package, roles: ["admin"] },
    { to: "/stok", label: "Stok", icon: Boxes, roles: ["admin"] },
  ],
  [
    { to: "/laporan", label: "Laporan", icon: BarChart3, roles: ["admin"] },
    { to: "/pengguna", label: "Pengguna", icon: Users, roles: ["admin"] },
    { to: "/pengaturan", label: "Pengaturan", icon: Settings, roles: ["admin"] },
  ],
];

const labelClass =
  "whitespace-nowrap text-sm font-semibold opacity-0 transition-opacity duration-150 group-hover/side:opacity-100";

export function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="app-masuk flex h-screen bg-ink">
      {/* Lebar penampung beranimasi saat hover sehingga konten ikut bergeser (tidak tertimpa). */}
      <div className="sidebar-masuk group/side w-[76px] shrink-0 overflow-hidden transition-[width] duration-200 hover:w-[236px]">
        <aside className="flex h-full w-[236px] flex-col bg-ink px-4 py-4">
          <div className="mb-5 flex h-11 items-center gap-3">
            <img src="/logo-mark.png" alt="TokoPOS" className="h-11 w-11 shrink-0 object-contain p-1" />
            <div className="opacity-0 transition-opacity duration-150 group-hover/side:opacity-100">
              <p className="whitespace-nowrap text-base font-extrabold leading-tight text-white">TokoPOS</p>
              <p className="whitespace-nowrap text-[11px] leading-tight text-white/50">Sistem Kasir Desktop</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-2">
            {navGroups.map((group, gi) => {
              const visible = group.filter((item) => user && item.roles.includes(user.peran));
              if (visible.length === 0) return null;
              return (
                <div key={gi} className="flex flex-col gap-2">
                  {gi > 0 && <div className="my-1 h-px w-full bg-white/10" />}
                  {visible.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-label={item.label}
                      className="group/item flex h-11 items-center gap-3"
                    >
                      {({ isActive }) => (
                        <>
                          {/* Background aktif/hover hanya membungkus ikon, bukan seluruh lebar sidebar. */}
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                              isActive
                                ? "bg-brand-600 text-ink"
                                : "text-white/60 group-hover/item:bg-white/10 group-hover/item:text-white"
                            }`}
                          >
                            <item.icon size={20} strokeWidth={2} />
                          </span>
                          <span
                            className={`${labelClass} ${isActive ? "text-white" : "text-white/60 group-hover/item:text-white"}`}
                          >
                            {item.label}
                          </span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="flex flex-col gap-2">
            <div className="flex h-11 items-center gap-3 px-0.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                {user?.nama.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover/side:opacity-100">
                <p className="truncate whitespace-nowrap text-sm font-semibold text-white">{user?.nama}</p>
                <p className="whitespace-nowrap text-xs capitalize text-white/50">{user?.peran}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              aria-label="Keluar"
              className="group/item flex h-11 items-center gap-3 text-red-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition group-hover/item:bg-red-500/15">
                <LogOut size={20} />
              </span>
              <span className={labelClass}>Keluar</span>
            </button>
          </div>
        </aside>
      </div>

      <main className="my-2 mr-2 flex-1 overflow-auto rounded-3xl bg-[#f4f5f2]">
        {/* key = path: setiap pindah menu me-remount wrapper sehingga animasi masuk diputar ulang. */}
        <div key={pathname} className="halaman-masuk h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
