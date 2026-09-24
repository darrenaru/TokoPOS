import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

function format(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function UangInput({ value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);
  // Nilai 0 dikosongkan (placeholder "0") supaya angka pertama yang diketik tidak jadi "01222".
  const teks = value ? format(value) : "";

  useLayoutEffect(() => {
    const el = ref.current;
    const n = digitsBeforeCaret.current;
    if (!el || n === null) return;
    digitsBeforeCaret.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < n) {
      if (/\d/.test(el.value[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }, [teks]);

  return (
    <input
      placeholder="0"
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={teks}
      onFocus={(e) => {
        e.target.select();
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        digitsBeforeCaret.current = el.value.slice(0, caret).replace(/\D/g, "").length;
        const angka = Number(el.value.replace(/\D/g, "")) || 0;
        onChange(angka);
      }}
    />
  );
}
