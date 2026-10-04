import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Conservative IPv4 public-routability filter for outbound server requests. */
export function isPublicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const n = address.split(".").map(Number);
  const [a, b, c] = n;
  if (n.length !== 4 || n.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return !(
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113) ||
    a! >= 224
  );
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return isPublicIPv4(address);
  if (isIP(address) !== 6) return false;
  const halves = address.toLowerCase().split("::");
  const left = halves[0] ? halves[0]!.split(":") : [];
  const right = halves[1] ? halves[1]!.split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right].map((part) => Number.parseInt(part || "0", 16));
  if (groups.length !== 8 || groups.some((group) => !Number.isFinite(group))) return false;
  const first = groups[0]!;
  // Permit only global unicast (2000::/3), excluding protocol transition and
  // documentation ranges. Link-local, unique-local, mapped and unspecified
  // addresses fall outside this prefix and are denied.
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (groups[1] === 0 || groups[1]! <= 0x01ff || groups[1] === 0x0db8)) &&
    first !== 0x2002;
}

/** Resolve once and reject the entire hostname if any answer is non-public. */
export async function publicAddresses(hostname: string): Promise<string[] | null> {
  if (isIP(hostname)) return null;
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => !isPublicAddress(record.address))) return null;
    return records.map((record) => record.address);
  } catch {
    return null;
  }
}
