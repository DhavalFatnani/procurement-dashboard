export function rangesOverlap(
  aStart: bigint,
  aEnd: bigint,
  bStart: bigint,
  bEnd: bigint,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
