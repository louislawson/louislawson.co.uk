import type { Project } from "../../content/schema";

type Measurement = NonNullable<Project["measurements"]>[number];

/** A figure that moved shows both ends; one that did not has a single value, shown once. */
export type MeasurementRow =
  | { kind: "change"; label: string; before: string; after: string }
  | { kind: "single"; label: string; value: string };

/** A value with its unit after it. A percent sign sits against the figure; other units are words. */
export function withUnit(value: string, unit?: string): string {
  if (unit === undefined || unit === "") return value;
  return unit.startsWith("%") ? `${value}${unit}` : `${value} ${unit}`;
}

/**
 * The table's rows, in the order written. A measurement with an `after` is a before-and-after row;
 * one without is a single figure, like "70% of incidents caught before users". The unit goes on
 * every value it is given for.
 */
export function measurementRows(
  measurements: readonly Measurement[] | undefined,
): MeasurementRow[] {
  return (measurements ?? []).map(({ label, before, after, unit }) =>
    after === undefined
      ? { kind: "single", label, value: withUnit(before, unit) }
      : {
          kind: "change",
          label,
          before: withUnit(before, unit),
          after: withUnit(after, unit),
        },
  );
}
