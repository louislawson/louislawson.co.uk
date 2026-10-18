// The trace panel's script: the path this page took to reach the visitor, from the browser's own
// Navigation Timing entry and the largest paint. The measuring and the arithmetic are plain
// functions with the numbers passed in, and the loop takes the page's parts as arguments, so all of
// it runs under test without a browser, as the navigation's script does. A step the browser did not
// measure is an ellipsis, never a guess, and nothing here sends anything anywhere.

/** The parts of a PerformanceNavigationTiming entry that the trace reads. */
export interface NavigationTimingLike {
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  domContentLoadedEventEnd: number;
}

export interface Timings {
  dns: number | null;
  connect: number | null;
  ttfb: number | null;
  download: number | null;
  size: string | null;
  ready: number | null;
}

/** The time between two timestamps, in whole milliseconds, or nothing if they cannot be one. */
function duration(start: number, end: number): number | null {
  const value = end - start;
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/**
 * A step of the navigation. Its start is a time since the navigation began, so a start of 0 is a
 * field the browser zeroed or did not expose, and taken from 0 the step would show the whole time
 * since the navigation began: it is not measured.
 */
function step(start: number, end: number): number | null {
  return start > 0 ? duration(start, end) : null;
}

/**
 * The page's size as it was sent: the encoded body. The transfer size counts the headers too, and
 * is a few hundred bytes on a 304, which the page's own cache headers make of every repeat visit.
 */
function kilobytes(entry: NavigationTimingLike): string | null {
  const bytes = entry.encodedBodySize;
  return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : null;
}

/**
 * Each step of the navigation as whole milliseconds, or nothing where it was not measured. An entry
 * with no response in it (a page restored from the back/forward cache, or one a browser has zeroed)
 * records nothing about how this page arrived: its zeros are not measurements.
 */
export function readTimings(entry: NavigationTimingLike | undefined): Timings {
  if (!entry || !(entry.responseEnd > 0)) {
    return {
      dns: null,
      connect: null,
      ttfb: null,
      download: null,
      size: null,
      ready: null,
    };
  }
  return {
    dns: step(entry.domainLookupStart, entry.domainLookupEnd),
    connect: step(entry.connectStart, entry.connectEnd),
    ttfb: step(entry.requestStart, entry.responseStart),
    download: step(entry.responseStart, entry.responseEnd),
    size: kilobytes(entry),
    // The browser reports 0 until the page's DOMContentLoaded handlers have finished.
    ready:
      entry.domContentLoadedEventEnd > 0
        ? duration(0, entry.domContentLoadedEventEnd)
        : null,
  };
}

/** The largest paint so far: the last entry's start time, in whole milliseconds. */
export function lcpTime(
  entries: readonly { startTime: number }[],
): number | null {
  const last = entries.at(-1);
  return last && Number.isFinite(last.startTime) && last.startTime >= 0
    ? Math.round(last.startTime)
    : null;
}

/**
 * A bar's width as a percentage of the longest value shown, at least 2 so a real, tiny step shows.
 * The longest is the time to paint once it is known, so each bar is that step's share of it.
 */
export function barPercent(ms: number | null, longest: number): number {
  if (ms === null) return 0;
  return Math.max(2, (ms / Math.max(1, longest)) * 100);
}

/** The gap between one hop arriving and the next, in the replay: a hop arrives at its position times this. */
export const HOP_STAGGER_MS = 170;

export interface Hop {
  name: string;
  what: string;
  /** "20 ms", an ellipsis for a step that was not measured, or nothing for the first hop. */
  value: string;
  measured: boolean;
  /** Percentage of the longest value shown (see barPercent), or null for the hop with no bar. */
  bar: number | null;
  kind: "you" | "step" | "page";
}

export interface TraceView {
  hops: Hop[];
  total: string;
  /** Whether anything at all was measured. */
  measured: boolean;
  canReplay: boolean;
}

/** What the panel shows for these timings and this paint time. */
export function traceView(
  host: string,
  t: Timings,
  paint: number | null,
  options: { reducedMotion?: boolean } = {},
): TraceView {
  const steps: {
    name: string;
    what: string;
    ms: number | null;
    kind: Hop["kind"];
  }[] = [
    {
      name: "dns",
      what: host ? `DNS lookup for ${host}` : "DNS lookup",
      ms: t.dns,
      kind: "step",
    },
    { name: "connect", what: "connection", ms: t.connect, kind: "step" },
    {
      name: "edge",
      what: "first byte from the nearest edge server",
      ms: t.ttfb,
      kind: "step",
    },
    {
      name: "this page",
      what: t.size ? `static HTML, ${t.size}` : "static HTML",
      ms: t.download,
      kind: "page",
    },
    {
      name: "painted",
      what: "largest element drawn on your screen",
      ms: paint,
      kind: "step",
    },
  ];
  const longest = Math.max(
    1,
    ...steps.flatMap((s) => (s.ms === null ? [] : [s.ms])),
  );
  const hops: Hop[] = [
    {
      name: "you",
      what: "your browser asked for this page",
      value: "",
      measured: false,
      bar: null,
      kind: "you",
    },
    ...steps.map((s) => ({
      name: s.name,
      what: s.what,
      value: s.ms === null ? "…" : `${s.ms} ms`,
      measured: s.ms !== null,
      bar: barPercent(s.ms, longest),
      kind: s.kind,
    })),
  ];
  const total =
    paint !== null
      ? `${paint} ms to paint`
      : t.ready !== null
        ? `${t.ready} ms to ready`
        : "";
  return {
    hops,
    total,
    measured: steps.some((s) => s.ms !== null) || t.ready !== null,
    canReplay: !options.reducedMotion,
  };
}

/** The parts of the page the trace needs, so the loop below can run without a browser. */
export interface TracePage {
  host: string;
  /** Asked each time, not once: the visitor can change the preference during the visit. */
  reducedMotion(): boolean;
  navigation(): NavigationTimingLike | undefined;
  /** Called with the time of the largest paint so far, each time it grows. */
  onPaint(listener: (ms: number) => void): void;
  /** Called once the page has finished loading. */
  onLoad(listener: () => void): void;
  show(view: TraceView): void;
  /** Plays the arrival: the hops come in order and the bars fill. */
  replay(): void;
  /** Called when the visitor asks for the replay. */
  onReplay(listener: () => void): void;
}

/** Shows the trace, keeps it current as the paint and the load arrive, and replays on request. */
export function initTrace(page: TracePage): void {
  let paint: number | null = null;
  const show = () =>
    page.show(
      traceView(page.host, readTimings(page.navigation()), paint, {
        reducedMotion: page.reducedMotion(),
      }),
    );

  show();
  if (!page.reducedMotion()) page.replay();
  page.onPaint((ms) => {
    paint = ms;
    show();
  });
  // The ready time is only known once the page's own handlers have run.
  page.onLoad(show);
  page.onReplay(() => {
    show();
    if (!page.reducedMotion()) page.replay();
  });
}
