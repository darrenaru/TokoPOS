const PALETTE = [
  ["#6D5EEC", "#8B7FF2"],
  ["#F97316", "#FB923C"],
  ["#0EA5E9", "#38BDF8"],
  ["#10B981", "#34D399"],
  ["#F43F5E", "#FB7185"],
  ["#EAB308", "#FACC15"],
  ["#8B5CF6", "#A78BFA"],
  ["#14B8A6", "#2DD4BF"],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function produkGradient(nama: string): string {
  const [from, to] = PALETTE[hashString(nama) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function produkInisial(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
