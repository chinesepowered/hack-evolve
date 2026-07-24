/**
 * Local, deterministic text embeddings.
 *
 * No model download, no API. We hash token trigrams into a fixed-width vector
 * and L2-normalise. It is crude, but it has the one property retrieval needs:
 * two bug reports describing the same failure ("uncertified nurse in ICU") land
 * close together in cosine space, while different failures land apart. That is
 * enough to make "have I seen this before?" a real similarity query rather than
 * a string compare — and it swaps cleanly for a real embedding endpoint in live
 * mode without touching any caller.
 */

const DIM = 96;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  const toks = tokens(text);

  // Unigrams and bigrams, so word order carries a little signal.
  const grams: string[] = [...toks];
  for (let i = 0; i < toks.length - 1; i++) grams.push(`${toks[i]}_${toks[i + 1]}`);

  for (const g of grams) {
    const idx = hash(g) % DIM;
    const sign = (hash("s" + g) & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }

  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // inputs are already normalised
}
