import { describe, expect, it } from "vitest";
import {
  barPercent,
  HOP_STAGGER_MS,
  initTrace,
  lcpTime,
  readTimings,
  traceView,
  type NavigationTimingLike,
  type TracePage,
  type TraceView,
} from "./trace";

/** A navigation entry as a browser records one: milliseconds from the start of the navigation. */
const recorded: NavigationTimingLike = {
  domainLookupStart: 12.2,
  domainLookupEnd: 31.9, // dns: 19.7 -> 20
  connectStart: 31.9,
  connectEnd: 98.6, // connection: 66.7 -> 67
  requestStart: 98.9,
  responseStart: 140.2, // first byte: 41.3 -> 41
  responseEnd: 152.9, // download: 12.7 -> 13
  transferSize: 12430, // 12.14 KB -> 12 KB
  encodedBodySize: 11980,
  domContentLoadedEventEnd: 410.4,
};

describe("readTimings", () => {
  it("reads each step as a whole number of milliseconds from a recorded entry", () => {
    expect(readTimings(recorded)).toEqual({
      dns: 20,
      connect: 67,
      ttfb: 41,
      download: 13,
      size: "12 KB",
      ready: 410,
    });
  });

  it("measures nothing when the browser gave no navigation entry, rather than guessing", () => {
    expect(readTimings(undefined)).toEqual({
      dns: null,
      connect: null,
      ttfb: null,
      download: null,
      size: null,
      ready: null,
    });
  });

  it("measures nothing from an entry with no response in it, because a zeroed entry is not a record of this page's arrival", () => {
    // A page restored from the back/forward cache, or an entry a browser has zeroed, reads 0 in
    // every field. Those zeros are not measurements, so each step stays an ellipsis.
    const zeroed: NavigationTimingLike = {
      domainLookupStart: 0,
      domainLookupEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      requestStart: 0,
      responseStart: 0,
      responseEnd: 0,
      transferSize: 0,
      encodedBodySize: 0,
      domContentLoadedEventEnd: 0,
    };
    expect(readTimings(zeroed)).toEqual(readTimings(undefined));
    // The same when only the response is missing: the steps before it are no use without it.
    expect(readTimings({ ...recorded, responseEnd: 0 })).toEqual(
      readTimings(undefined),
    );
  });

  it("keeps a real zero: a cached lookup and a reused connection took no time", () => {
    const reused = {
      ...recorded,
      domainLookupStart: 5,
      domainLookupEnd: 5,
      connectStart: 5,
      connectEnd: 5,
    };
    const t = readTimings(reused);
    expect(t.dns).toBe(0);
    expect(t.connect).toBe(0);
  });

  it("is not a measurement when the numbers cannot be one: negative, not a number or infinite", () => {
    const bad = {
      ...recorded,
      domainLookupEnd: 1, // before its start: -11.2
      connectEnd: Number.NaN,
      responseStart: Number.POSITIVE_INFINITY,
    };
    const t = readTimings(bad);
    expect(t.dns).toBeNull();
    expect(t.connect).toBeNull();
    expect(t.ttfb).toBeNull();
    // The download starts at the first byte, which is infinite here, so it is not one either.
    expect(t.download).toBeNull();
    // Each step is judged on its own two numbers: the others in the entry are untouched.
    expect(readTimings({ ...bad, responseStart: 140.2 }).download).toBe(13);
  });

  it("has no ready time until the page's own DOMContentLoaded handlers have finished", () => {
    // The browser reports 0 until then. Showing "0 ms to ready" would be a guess.
    expect(
      readTimings({ ...recorded, domContentLoadedEventEnd: 0 }).ready,
    ).toBeNull();
  });

  it("falls back to the encoded size when the transfer size is 0 (served from cache), and leaves it out when both are", () => {
    expect(readTimings({ ...recorded, transferSize: 0 }).size).toBe("12 KB");
    expect(
      readTimings({ ...recorded, transferSize: 0, encodedBodySize: 0 }).size,
    ).toBeNull();
  });

  it("rounds a small size up to 1 KB, never to 0", () => {
    expect(readTimings({ ...recorded, transferSize: 200 }).size).toBe("1 KB");
  });
});

describe("lcpTime", () => {
  it("is the start time of the last entry, whole milliseconds: the largest paint so far", () => {
    expect(lcpTime([{ startTime: 300.2 }, { startTime: 612.7 }])).toBe(613);
  });

  it("is nothing before any paint, rather than a guess", () => {
    expect(lcpTime([])).toBeNull();
  });

  it("is nothing for a start time that cannot be one", () => {
    expect(lcpTime([{ startTime: Number.NaN }])).toBeNull();
    expect(lcpTime([{ startTime: -1 }])).toBeNull();
  });
});

describe("barPercent", () => {
  it("is the value's share of the longest value shown", () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(200, 200)).toBe(100);
  });

  it("is never less than 2, so a real but tiny step still shows", () => {
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(0, 1000)).toBe(2);
  });

  it("is 0 for a step that was not measured", () => {
    expect(barPercent(null, 200)).toBe(0);
  });
});

describe("traceView", () => {
  const t = readTimings(recorded);
  const view = traceView("example.test", t, 613);

  it("is six hops in the order the page took: you, dns, connect, edge, this page, painted", () => {
    expect(view.hops.map((h) => h.name)).toEqual([
      "you",
      "dns",
      "connect",
      "edge",
      "this page",
      "painted",
    ]);
  });

  it("describes each hop generically, naming no provider", () => {
    expect(view.hops.map((h) => h.what)).toEqual([
      "your browser asked for this page",
      "DNS lookup for example.test",
      "connection",
      "first byte from the nearest edge server",
      "static HTML, 12 KB",
      "largest element drawn on your screen",
    ]);
  });

  it("shows each measured value in ms, the 'you' hop none, and the last the paint time", () => {
    expect(view.hops.map((h) => h.value)).toEqual([
      "",
      "20 ms",
      "67 ms",
      "41 ms",
      "13 ms",
      "613 ms",
    ]);
  });

  it("sizes each bar as its share of the time to paint, the longest value, with none for 'you'", () => {
    expect(view.hops.map((h) => h.bar)).toEqual([
      null,
      barPercent(20, 613),
      barPercent(67, 613),
      barPercent(41, 613),
      barPercent(13, 613),
      100,
    ]);
    expect(view.hops[5]!.bar).toBe(100);
  });

  it("staggers the hops 170 ms apart, in order", () => {
    expect(HOP_STAGGER_MS).toBe(170);
    expect(view.hops.map((h) => h.delay)).toEqual([0, 170, 340, 510, 680, 850]);
  });

  it("marks the page hop and the you hop, which the styles give their own colour", () => {
    expect(view.hops.map((h) => h.kind)).toEqual([
      "you",
      "step",
      "step",
      "step",
      "page",
      "step",
    ]);
  });

  it("marks a hop measured only when it has a value", () => {
    expect(view.hops.map((h) => h.measured)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("totals the time to paint, once there is one", () => {
    expect(view.total).toBe("613 ms to paint");
  });

  it("falls back to the time to ready before the first paint is known", () => {
    expect(traceView("example.test", t, null).total).toBe("410 ms to ready");
  });

  it("has no total when neither is known", () => {
    expect(traceView("example.test", readTimings(undefined), null).total).toBe(
      "",
    );
  });

  it("shows an ellipsis and an empty bar for a step that was not measured, never a guess", () => {
    const none = traceView("example.test", readTimings(undefined), null);
    const steps = none.hops.filter((h) => h.name !== "you");
    expect(steps.map((h) => h.value)).toEqual(["…", "…", "…", "…", "…"]);
    expect(steps.map((h) => h.bar)).toEqual([0, 0, 0, 0, 0]);
    expect(steps.every((h) => !h.measured)).toBe(true);
  });

  it("leaves the size out of the page hop when it is not known", () => {
    const noSize = traceView("example.test", { ...t, size: null }, 613)
      .hops[4]!;
    expect(noSize.what).toBe("static HTML");
  });

  it("says DNS lookup alone when there is no host name", () => {
    expect(traceView("", t, 613).hops[1]!.what).toBe("DNS lookup");
  });

  it("says whether anything was measured, so the panel can say when the browser gave nothing", () => {
    expect(view.measured).toBe(true);
    expect(
      traceView("example.test", readTimings(undefined), null).measured,
    ).toBe(false);
    expect(
      traceView("example.test", readTimings(undefined), 500).measured,
    ).toBe(true);
  });

  it("can be replayed unless the visitor asked for reduced motion", () => {
    expect(traceView("h", t, 1, { reducedMotion: false }).canReplay).toBe(true);
    expect(traceView("h", t, 1, { reducedMotion: true }).canReplay).toBe(false);
  });
});

/** A page with nothing in it but what the script asks of it, recording what it was told. */
function fakePage(over: Partial<TracePage> = {}) {
  const shown: TraceView[] = [];
  let replays = 0;
  const paintListeners: ((ms: number) => void)[] = [];
  const loadListeners: (() => void)[] = [];
  const replayListeners: (() => void)[] = [];
  let entry: NavigationTimingLike | undefined = recorded;
  let reduced = false;
  const page: TracePage = {
    host: "example.test",
    reducedMotion: () => reduced,
    navigation: () => entry,
    onPaint: (l) => void paintListeners.push(l),
    onLoad: (l) => void loadListeners.push(l),
    show: (v) => void shown.push(v),
    replay: () => void replays++,
    onReplay: (l) => void replayListeners.push(l),
    ...over,
  };
  return {
    page,
    shown,
    replays: () => replays,
    paint: (ms: number) => paintListeners.forEach((l) => l(ms)),
    load: () => loadListeners.forEach((l) => l()),
    press: () => replayListeners.forEach((l) => l()),
    setEntry: (e: NavigationTimingLike | undefined) => (entry = e),
    setReducedMotion: (value: boolean) => (reduced = value),
  };
}

describe("initTrace", () => {
  it("shows the measured steps at once, with the painted step still an ellipsis, and plays the replay", () => {
    const f = fakePage();
    initTrace(f.page);
    expect(f.shown).toHaveLength(1);
    expect(f.shown[0]!.hops[1]!.value).toBe("20 ms");
    expect(f.shown[0]!.hops[5]!.value).toBe("…");
    expect(f.replays()).toBe(1);
  });

  it("shows the painted time when the largest paint arrives, and again as a larger one does", () => {
    const f = fakePage();
    initTrace(f.page);
    f.paint(613);
    f.paint(900);
    expect(f.shown.map((v) => v.hops[5]!.value)).toEqual([
      "…",
      "613 ms",
      "900 ms",
    ]);
    // A paint updates the numbers in place: it does not replay the arrival.
    expect(f.replays()).toBe(1);
  });

  it("measures again when the page has loaded, because the ready time is not there before", () => {
    const f = fakePage();
    f.setEntry({ ...recorded, domContentLoadedEventEnd: 0 });
    initTrace(f.page);
    expect(f.shown[0]!.total).toBe("");
    f.setEntry(recorded);
    f.load();
    expect(f.shown.at(-1)!.total).toBe("410 ms to ready");
  });

  it("replays on request: shows the values again and plays the arrival", () => {
    const f = fakePage();
    initTrace(f.page);
    f.paint(613);
    f.press();
    expect(f.shown.at(-1)!.hops[5]!.value).toBe("613 ms");
    expect(f.replays()).toBe(2);
  });

  it("is still under reduced motion: it shows the values, and never replays or offers to", () => {
    const f = fakePage({ reducedMotion: () => true });
    initTrace(f.page);
    f.paint(613);
    f.press();
    expect(f.replays()).toBe(0);
    expect(f.shown.every((v) => !v.canReplay)).toBe(true);
    expect(f.shown.at(-1)!.hops[5]!.value).toBe("613 ms");
  });

  it("follows a change to reduced motion made during the visit: no more replays, and no offer of one", () => {
    const f = fakePage();
    initTrace(f.page);
    expect(f.shown[0]!.canReplay).toBe(true);
    f.setReducedMotion(true);
    f.press();
    expect(f.replays()).toBe(1); // only the one on arrival
    expect(f.shown.at(-1)!.canReplay).toBe(false);
    // And back again: the offer returns with the preference.
    f.setReducedMotion(false);
    f.paint(613);
    expect(f.shown.at(-1)!.canReplay).toBe(true);
  });

  it("shows ellipses, and says nothing was measured, when the browser has no navigation entry", () => {
    const f = fakePage();
    f.setEntry(undefined);
    initTrace(f.page);
    expect(f.shown[0]!.measured).toBe(false);
    expect(
      f.shown[0]!.hops.filter((h) => h.name !== "you").map((h) => h.value),
    ).toEqual(["…", "…", "…", "…", "…"]);
  });
});
