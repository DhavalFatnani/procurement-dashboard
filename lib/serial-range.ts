/** List every serial string in an inclusive numeric range (barcode values, no formatting). */
export function listSerialNumbersInRange(rangeStart: string, rangeEnd: string): string[] {
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  if (end < start) {
    return [];
  }

  const nums: string[] = [];
  for (let n = start; n <= end; n++) {
    nums.push(n.toString());
  }
  return nums;
}

export function serialPrintSessionKey(reservationId: string): string {
  return `knot-serial-print-${reservationId}`;
}
