import { SerialSeries } from "@/lib/prisma-enums";

import { SerialRangeMapView } from "@/components/serial-governance/SerialRangeMapView";
import { getSerialRangeMap } from "@/lib/queries/serial";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseParams(sp: Record<string, string | string[] | undefined>) {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";
  const seriesRaw = str(sp.series);
  const series = (Object.values(SerialSeries) as string[]).includes(seriesRaw)
    ? (seriesRaw as SerialSeries)
    : SerialSeries.LOCK_TAGS;
  const zoomToActive = str(sp.zoom) !== "full";
  return { series, zoomToActive };
}

export default async function SerialRangeMapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertRole(await getRequestSession(), [...ACCESS.serialGovernance]);
  const sp = await searchParams;
  const { series, zoomToActive } = parseParams(sp);
  const data = await getSerialRangeMap({ series, zoomToActive });

  return <SerialRangeMapView data={data} initialZoomToActive={zoomToActive} />;
}
