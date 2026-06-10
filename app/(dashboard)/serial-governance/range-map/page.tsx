import { Role } from "@/lib/prisma-enums";

import { SerialRangeMapView } from "@/components/serial-governance/SerialRangeMapView";
import { getCachedSeriesRegistry } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import { getSerialRangeMap } from "@/lib/queries/serial";
import { buildSeriesOptions } from "@/lib/series-registry";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { SERIES_CODES, type SeriesCode } from "@/lib/series-codes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function parseParams(sp: Record<string, string | string[] | undefined>) {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";
  const seriesRaw = str(sp.series);
  const registry = await getCachedSeriesRegistry();
  const fallbackSeries = registry.activeCodes[0] ?? SERIES_CODES.LOCK_TAGS;
  const series: SeriesCode = seriesRaw && registry.byCode.has(seriesRaw) ? seriesRaw : fallbackSeries;
  const zoomToActive = str(sp.zoom) !== "full";
  const adminModeRequested = str(sp.admin) === "1";
  return { series, zoomToActive, adminModeRequested };
}

export default async function SerialRangeMapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = assertRole(await getRequestSession(), [...ACCESS.serialGovernance]);
  const sp = await searchParams;
  const { series, zoomToActive, adminModeRequested } = await parseParams(sp);
  const adminMode = adminModeRequested && user.role === Role.ADMIN;
  const [data, registry] = await dbParallel(
    () => getSerialRangeMap({ series, zoomToActive }),
    () => getCachedSeriesRegistry(),
  );

  return (
    <SerialRangeMapView
      data={data}
      seriesOptions={buildSeriesOptions(registry)}
      initialZoomToActive={zoomToActive}
      adminMode={adminMode}
    />
  );
}
