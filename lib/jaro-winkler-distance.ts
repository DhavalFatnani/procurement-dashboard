/**
 * Jaro–Winkler string similarity in [0, 1].
 * Ported from NaturalNode/natural (MIT) to avoid pulling the full `natural` package into the server bundle.
 */

function jaroDistance(s1: string, s2: string): number {
  if (s1.length === 0 || s2.length === 0) {
    return 0;
  }

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const matches1 = new Array<boolean>(s1.length).fill(false);
  const matches2 = new Array<boolean>(s2.length).fill(false);
  let m = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let k = start; k < end; k++) {
      if (matches2[k] || s1[i] !== s2[k]) {
        continue;
      }
      matches1[i] = true;
      matches2[k] = true;
      m++;
      break;
    }
  }

  if (m === 0) {
    return 0;
  }

  let t = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!matches1[i]) {
      continue;
    }
    while (!matches2[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      t++;
    }
    k++;
  }

  t /= 2;
  return (m / s1.length + m / s2.length + (m - t) / m) / 3;
}

export function jaroWinklerDistance(s1: string, s2: string): number {
  if (s1 === s2) {
    return 1;
  }
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const jaro = jaroDistance(a, b);
  const p = 0.1;
  let l = 0;
  while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) {
    l++;
  }
  return jaro + l * p * (1 - jaro);
}
