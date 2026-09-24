import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  /** Kelas untuk tombol pemicu; default sesuai gaya input aplikasi. */
  className?: string;
  leading?: ReactNode;
}

const DEFAULT_CLASS =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-400";

interface Posisi {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabled,
  className = DEFAULT_CLASS,
  leading,
}: Props<T>) {
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [posisi, setPosisi] = useState<Posisi | null>(null);
  const pemicuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const terpilih = options.find((o) => o.value === value);

  const hitungPosisi = useCallback(() => {
    const el = pemicuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ruangBawah = window.innerHeight - r.bottom - 12;
    const ruangAtas = r.top - 12;
    const keAtas = ruangBawah < 200 && ruangAtas > ruangBawah;
    setPosisi(
      keAtas
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(288, ruangAtas) }
        : { left: r.left, width: r.width, top: r.bottom + 6, maxHeight: Math.min(288, ruangBawah) },
    );
  }, []);

  function bukaPanel() {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setAktif(idx >= 0 ? idx : 0);
    hitungPosisi();
    setBuka(true);
  }

  function pilih(v: T) {
    onChange(v);
    setBuka(false);
    pemicuRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!buka) return;
    window.addEventListener("resize", hitungPosisi);
    return () => window.removeEventListener("resize", hitungPosisi);
  }, [buka, hitungPosisi]);

  useEffect(() => {
    if (!buka) return;
    function tutupBilaDiluar(e: MouseEvent) {
      const t = e.target as Node;
      if (pemicuRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setBuka(false);
    }
    document.addEventListener("mousedown", tutupBilaDiluar);
    return () => document.removeEventListener("mousedown", tutupBilaDiluar);
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-idx="${aktif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktif, buka]);

  function handleKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!buka) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        bukaPanel();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setBuka(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktif((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setAktif(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAktif(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[aktif]) pilih(options[aktif].value);
    } else if (e.key === "Tab") {
      setBuka(false);
    }
  }

  return (
    <>
      <button
        ref={pemicuRef}
        type="button"
        role="combobox"
        aria-expanded={buka}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (buka ? setBuka(false) : bukaPanel())}
        onKeyDown={handleKey}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leading}
          <span className={`truncate ${terpilih ? "" : "text-slate-400"}`}>{terpilih ? terpilih.label : placeholder}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${buka ? "rotate-180" : ""}`} />
      </button>

      {buka &&
        posisi &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            className="scroll-thin fixed z-[100] overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-black/10"
            style={{
              left: posisi.left,
              width: posisi.width,
              top: posisi.top,
              bottom: posisi.bottom,
              maxHeight: posisi.maxHeight,
            }}
          >
            {options.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">Tidak ada pilihan</p>}
            {options.map((o, i) => {
              const dipilih = o.value === value;
              return (
                <div
                  key={String(o.value)}
                  role="option"
                  aria-selected={dipilih}
                  data-idx={i}
                  onMouseEnter={() => setAktif(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pilih(o.value)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                    i === aktif ? "bg-[#f0f2ee]" : ""
                  } ${dipilih ? "font-bold text-ink" : "text-slate-700"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs font-normal text-slate-400">{o.hint}</span>}
                  </span>
                  {dipilih && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-ink">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
