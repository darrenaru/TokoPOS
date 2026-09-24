import { useState, type FormEvent } from "react";
import { Select } from "./Select";
import type { Pengguna, PenggunaInput, PenggunaUpdateInput } from "../../types";

interface Props {
  pengguna: Pengguna | null;
  onClose: () => void;
  onSubmitBaru: (input: PenggunaInput) => Promise<void>;
  onSubmitUpdate: (input: PenggunaUpdateInput) => Promise<void>;
}

export function PenggunaFormModal({ pengguna, onClose, onSubmitBaru, onSubmitUpdate }: Props) {
  const [nama, setNama] = useState(pengguna?.nama ?? "");
  const [username, setUsername] = useState(pengguna?.username ?? "");
  const [peran, setPeran] = useState<"admin" | "kasir">(pengguna?.peran ?? "kasir");
  const [aktif, setAktif] = useState(pengguna?.aktif ?? true);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (pengguna) {
        await onSubmitUpdate({ nama, peran, aktif, password });
      } else {
        await onSubmitBaru({ nama, username, password, peran });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{pengguna ? "Edit Pengguna" : "Tambah Pengguna"}</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama</label>
            <input required value={nama} onChange={(e) => setNama(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              required
              disabled={!!pengguna}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`${inputClass} disabled:bg-slate-100`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Peran</label>
            <Select<"admin" | "kasir">
              value={peran}
              onChange={setPeran}
              options={[
                { value: "kasir", label: "Kasir", hint: "Hanya akses transaksi" },
                { value: "admin", label: "Admin", hint: "Akses penuh" },
              ]}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password {pengguna && <span className="font-normal text-slate-400">(kosongkan jika tidak diubah)</span>}
            </label>
            <input
              type="password"
              required={!pengguna}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {pengguna && (
            <div className="flex items-center gap-2.5 pt-1">
              <input
                id="aktif"
                type="checkbox"
                checked={aktif}
                onChange={(e) => setAktif(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              <label htmlFor="aktif" className="text-sm font-medium text-slate-700">
                Akun aktif
              </label>
            </div>
          )}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-brand-600 py-2.5 font-semibold text-slate-900 shadow-sm shadow-brand-600/40 hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
