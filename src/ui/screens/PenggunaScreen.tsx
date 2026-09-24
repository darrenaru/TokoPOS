import { useEffect, useState } from "react";
import { History, Plus, SquarePen, Users } from "lucide-react";
import { PenggunaFormModal } from "../components/PenggunaFormModal";
import { logAktivitasApi, penggunaApi } from "../../services/api";
import { formatTanggalWaktu } from "../../utils/currency";
import type { LogAktivitas, Pengguna, PenggunaInput, PenggunaUpdateInput } from "../../types";

const LABEL_AKSI: Record<string, string> = {
  buka_kasir: "Membuka kasir",
  tutup_kasir: "Menutup kasir",
  tambah_produk: "Menambah produk",
  ubah_produk: "Mengubah produk",
  hapus_produk: "Menghapus produk",
  tambah_pengguna: "Menambah pengguna",
  ubah_pengguna: "Mengubah pengguna",
  backup_database: "Backup database",
  restore_database: "Restore database",
};

export function PenggunaScreen() {
  const [list, setList] = useState<Pengguna[]>([]);
  const [log, setLog] = useState<LogAktivitas[]>([]);
  const [editing, setEditing] = useState<Pengguna | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function muatUlang() {
    const [pengguna, aktivitas] = await Promise.all([penggunaApi.list(), logAktivitasApi.riwayat()]);
    setList(pengguna);
    setLog(aktivitas);
  }

  useEffect(() => {
    muatUlang();
  }, []);

  async function simpanBaru(input: PenggunaInput) {
    await penggunaApi.create(input);
    setShowForm(false);
    await muatUlang();
  }

  async function simpanUpdate(input: PenggunaUpdateInput) {
    if (!editing) return;
    await penggunaApi.update(editing.id, input);
    setShowForm(false);
    await muatUlang();
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-400">Akun kasir/admin dan log aktivitas sistem</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500"
        >
          <Plus size={16} /> Tambah Pengguna
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Users size={15} className="text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Daftar Pengguna</h2>
      </div>
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Peran</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.nama}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.username}</td>
                <td className="px-4 py-2.5 capitalize text-slate-600">{p.peran}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {p.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setShowForm(true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700"
                    title="Edit"
                  >
                    <SquarePen size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <History size={15} className="text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Log Aktivitas</h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Pengguna</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
              <th className="px-4 py-3 font-medium">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-500">{formatTanggalWaktu(l.created_at)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{l.pengguna_nama}</td>
                <td className="px-4 py-2.5 text-slate-600">{LABEL_AKSI[l.aksi] ?? l.aksi}</td>
                <td className="px-4 py-2.5 text-slate-500">{l.keterangan ?? "-"}</td>
              </tr>
            ))}
            {log.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Belum ada aktivitas tercatat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PenggunaFormModal
          pengguna={editing}
          onClose={() => setShowForm(false)}
          onSubmitBaru={simpanBaru}
          onSubmitUpdate={simpanUpdate}
        />
      )}
    </div>
  );
}
