/** Recursively convert BigInt values for JSON.stringify / NextResponse.json */
export function serializeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? Number(v) : v))
  ) as T
}
