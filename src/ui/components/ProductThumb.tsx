import { produkGradient, produkInisial } from "../../utils/productVisual";

interface Props {
  nama: string;
  foto?: string | null;
  className?: string;
}

export function ProductThumb({ nama, foto, className = "" }: Props) {
  if (foto) {
    return <img src={foto} alt={nama} loading="lazy" className={`rounded-2xl object-cover ${className}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center rounded-2xl font-bold text-white ${className}`}
      style={{ background: produkGradient(nama) }}
    >
      {produkInisial(nama)}
    </div>
  );
}
