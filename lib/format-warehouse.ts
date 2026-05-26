export type WarehouseRef = {
  id: string;
  name: string;
  location: string;
};

export type WarehouseOption = WarehouseRef & {
  /** Preformatted `name · location` for selects, tables, and chips. */
  label: string;
};

/** Display warehouse as `WH1 · Main campus` (name only when location is empty). */
export function formatWarehouseLabel(
  name: string,
  location?: string | null,
): string {
  const trimmedLocation = location?.trim();
  if (!trimmedLocation) {
    return name;
  }
  return `${name} · ${trimmedLocation}`;
}

export function toWarehouseOption(warehouse: WarehouseRef): WarehouseOption {
  return {
    ...warehouse,
    label: formatWarehouseLabel(warehouse.name, warehouse.location),
  };
}

export function warehouseOptionsFromRows(
  rows: WarehouseRef[],
): WarehouseOption[] {
  return rows.map(toWarehouseOption);
}
