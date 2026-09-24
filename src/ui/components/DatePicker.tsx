import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";

interface Props {
  /** Format YYYY-MM-DD, atau string kosong bila belum dipilih. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const LEBAR_PANEL = 304;

const DEFAULT_CLASS =
  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-100";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function keString(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dariString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function tampil(s: string): string {
  const d = dariString(s);
  return d ? `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` : "";
}

export function DatePicker({ value, onChange, placeholder = "Pilih tanggal", min, max, className = DEFAULT_CLASS }: Props) {
  const [buka, setBuka] = useState(false);
  const [tampilBulan, setTampilBulan] = useState(() => {
    const d = dariString(value) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [posisi, setPosisi] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const pemicuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hitungPosisi = useCallback(() => {
    const el = pemicuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left, window.innerWidth - LEBAR_PANEL - 12));
    const keAtas = window.innerHeight - r.bottom < 380 && r.top > window.innerHeight - r.bottom;
    setPosisi(keAtas ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
  }, []);

  function bukaPanel() {
    const d = dariString(value) ?? new Date();
    setTampilBulan(new Date(d.getFullYear(), d.getMonth(), 1));
    hitungPosisi();
    setBuka(true);
  }

  useLayoutEffect(() => {
    if (!buka) return;
    window.addEventListener("resize", hitungPosisi);
    return () => window.removeEventListener("resize", hitungPosisi);
  }, [buka, hitungPosisi]);

  useEffect(() => {
    if (!buka) return;
    function diluar(e: MouseEvent) {
      const t = e.target as Node;
      if (pemicuRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setBuka(false);
    }
    function esc(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setBuka(false);
      }
    }
    document.addEventListener("mousedown", diluar);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", diluar);
      document.removeEventListener("keydown", esc, true);
    };
  }, [buka]);

  function pindahBulan(delta: number) {
    setTampilBulan((b) => new Date(b.getFullYear(), b.getMonth() + delta, 1));
  }

  const tahun = tampilBulan.getFullYear();
  const bulan = tampilBulan.getMonth();
  // Senin = 0
  const offsetAwal = (new Date(tahun, bulan, 1).getDay() + 6) % 7;
  const jumlahHari = new Date(tahun, bulan + 1, 0).getDate();
  const sel: (Date | null)[] = [
    ...Array.from({ length: offsetAwal }, () => null),
    ...Array.from({ length: jumlahHari }, (_, i) => new Date(tahun, bulan, i + 1)),
  ];
  while (sel.length % 7 !== 0) sel.push(null);

  const hariIni = keString(new Date());

  function pilih(d: Date) {
    onChange(keString(d));
    setBuka(false);
    pemicuRef.current?.focus();
  }

  const navBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-ink hover:bg-[#f0f2ee]";

  return (
    <>
      <button
        ref={pemicuRef}
        type="button"
        onClick={() => (buka ? setBuka(false) : bukaPanel())}
        aria-haspopup="dialog"
        aria-expanded={buka}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${value ? "" : "text-slate-400"}`}>{value ? tampil(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-slate-500" />
      </button>

      {buka &&
        posisi &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Pilih tanggal"
            className="fixed z-[100] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-black/10"
            style={{ left: posisi.left, top: posisi.top, bottom: posisi.bottom, width: LEBAR_PANEL }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex">
                <button type="button" className={navBtn} onClick={() => pindahBulan(-12)} aria-label="Tahun sebelumnya">
                  <ChevronsLeft size={16} />
                </button>
                <button type="button" className={navBtn} onClick={() => pindahBulan(-1)} aria-label="Bulan sebelumnya">
                  <ChevronLeft size={16} />
                </button>
              </div>
              <p className="text-sm font-extrabold text-ink">
                {NAMA_BULAN[bulan]} {tahun}
              </p>
              <div className="flex">
                <button type="button" className={navBtn} onClick={() => pindahBulan(1)} aria-label="Bulan berikutnya">
                  <ChevronRight size={16} />
                </button>
                <button type="button" className={navBtn} onClick={() => pindahBulan(12)} aria-label="Tahun berikutnya">
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-slate-400">
              {NAMA_HARI.map((h) => (
                <div key={h} className="py-1">
                  {h}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {sel.map((d, i) => {
                if (!d) return <div key={i} />;
                const s = keString(d);
                const dipilih = s === value;
                const adalahHariIni = s === hariIni;
                const nonaktif = (min && s < min) || (max && s > max);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!!nonaktif}
                    onClick={() => pilih(d)}
                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                      dipilih
                        ? "bg-brand-600 font-extrabold text-ink"
                        : adalahHariIni
                          ? "border border-ink font-bold text-ink hover:bg-[#f0f2ee]"
                          : "text-slate-700 hover:bg-[#f0f2ee]"
                    } disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <button
                type="button"
                onClick={() => pilih(new Date())}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink hover:bg-[#f0f2ee]"
              >
                Hari ini
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setBuka(false);
                  }}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <X size={14} /> Hapus
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
