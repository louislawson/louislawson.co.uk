import { describe, expect, it } from "vitest";
import { measurementRows, withUnit } from "./measurement-rows";

describe("withUnit", () => {
  it("puts the unit after the value, with a space", () => {
    expect(withUnit("3", "weeks")).toBe("3 weeks");
    expect(withUnit("<1", "hour")).toBe("<1 hour");
  });

  it("closes up a percent sign, which belongs against its figure", () => {
    expect(withUnit("60", "%")).toBe("60%");
  });

  it("leaves a value as it is when there is no unit", () => {
    expect(withUnit("weekly")).toBe("weekly");
    expect(withUnit("rare, reviewed", undefined)).toBe("rare, reviewed");
  });
});

describe("measurementRows", () => {
  it("is no rows for no measurements, whether the field is absent or empty", () => {
    expect(measurementRows(undefined)).toEqual([]);
    expect(measurementRows([])).toEqual([]);
  });

  it("makes a before-and-after row of a measurement that has both, with the unit on each value", () => {
    expect(
      measurementRows([
        {
          label: "Time to environment",
          before: "8",
          after: "2",
          unit: "hours",
        },
      ]),
    ).toEqual([
      {
        kind: "change",
        label: "Time to environment",
        before: "8 hours",
        after: "2 hours",
      },
    ]);
  });

  it("makes a single figure of a measurement with no after, with the unit on it once", () => {
    expect(
      measurementRows([
        { label: "Incidents caught before users", before: "70", unit: "%" },
      ]),
    ).toEqual([
      { kind: "single", label: "Incidents caught before users", value: "70%" },
    ]);
  });

  it("keeps the measurements in the order they were written", () => {
    const rows = measurementRows([
      { label: "B", before: "1", after: "2" },
      { label: "A", before: "3" },
      { label: "C", before: "4", after: "5" },
    ]);
    expect(rows.map((row) => row.label)).toEqual(["B", "A", "C"]);
    expect(rows.map((row) => row.kind)).toEqual(["change", "single", "change"]);
  });
});
