export function formatTrafficCompact(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)}GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 0.01) return `${mb.toFixed(2)}MB`
  const kb = bytes / 1024
  if (kb >= 0.01) return `${kb.toFixed(2)}KB`
  return `${bytes} B`
}

export function formatDateTime(ms: number | null): string {
  if (!ms) return "—"
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(/\//g, "-")
}
