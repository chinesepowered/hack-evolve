/**
 * Actian VectorAI point IDs must be an unsigned integer or a UUID — our
 * human-readable memory keys ("mem:certification") are rejected outright:
 *
 *   { "status": { "error": "Upsert failed: invalid UUID: mem:certification" } }
 *
 * So we derive a stable RFC-4122-shaped UUID from the key. It must be
 * deterministic: reinforcing a memory re-upserts the *same* point rather than
 * accumulating duplicates. The original key travels in the payload as `memKey`
 * so results can be mapped back to domain identifiers.
 */
export function stableUuid(key: string): string {
  const words: number[] = [];
  for (let seed = 0; seed < 4; seed++) {
    // FNV-1a, re-seeded four times to fill 128 bits.
    let h = (0x811c9dc5 ^ Math.imul(seed, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    words.push(h >>> 0);
  }
  const hex = words.map((w) => w.toString(16).padStart(8, "0")).join("");
  // Force version (4) and variant (8) nibbles so the server's parser accepts it.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
