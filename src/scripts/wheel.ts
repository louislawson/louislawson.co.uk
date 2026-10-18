// The garage's wheel: a tyre, a rim, five spokes and a hub, drawn as text. frame(t) is pure and
// deterministic, so the build draws the first frame into the page and the browser carries on from
// it. The loop takes the page's parts as arguments, like trace.ts and nav.ts, and runs under test
// without a browser.

/** From dark to bright. A cell that nothing lands on stays a space. */
export const RAMP = " .,:;-=+*#%@";
export const WIDTH = 64;
export const HEIGHT = 30;
/** The tick the build draws, and the one a still wheel shows. */
export const FIRST_TICK = 18;
/** Frames are at least this far apart, which holds the loop to about 30 a second. */
export const FRAME_MS = 33;

// x, y, z, then the surface normal. Roll is about the axle (z).
type Sample = readonly [number, number, number, number, number, number];

function samples(): Sample[] {
  const points: Sample[] = [];
  // A torus, with its section slightly squared.
  const torus = (R: number, r: number, du: number, dv: number) => {
    for (let t = 0; t < Math.PI * 2; t += du) {
      for (let p = 0; p < Math.PI * 2; p += dv) {
        const ct = Math.cos(t);
        const st = Math.sin(t);
        const cp = Math.cos(p);
        const sp = Math.sin(p);
        points.push([
          (R + r * ct) * cp,
          (R + r * ct) * sp,
          r * st * 1.35,
          ct * cp,
          ct * sp,
          st,
        ]);
      }
    }
  };
  torus(1.0, 0.3, 0.12, 0.02); // tyre
  torus(0.66, 0.045, 0.5, 0.025); // rim lip
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let t = 0.16; t < 0.66; t += 0.012) {
      for (let w = -0.05; w <= 0.05; w += 0.025) {
        points.push([t * ca - w * sa, t * sa + w * ca, 0.04, 0, 0, 1]);
        points.push([t * ca - w * sa, t * sa + w * ca, -0.04, 0, 0, -1]);
      }
    }
  }
  for (let r = 0; r < 0.16; r += 0.02) {
    for (let p = 0; p < Math.PI * 2; p += 0.15) {
      points.push([r * Math.cos(p), r * Math.sin(p), 0.09, 0, 0, 1]);
      points.push([r * Math.cos(p), r * Math.sin(p), -0.09, 0, 0, -1]);
    }
  }
  return points;
}

const POINTS = samples();

// The light, as a unit vector.
const LIGHT = (() => {
  const v = [0.35, -0.55, -0.75] as const;
  const length = Math.hypot(...v);
  return v.map((n) => n / length) as [number, number, number];
})();

const TILT = -0.32;

/** One frame of the wheel at this tick: HEIGHT rows of WIDTH characters, each ended by a line break. */
export function frame(t: number): string {
  const roll = t * 0.05;
  const yaw = Math.sin(t * 0.012) * 0.9;
  const cells: string[] = new Array<string>(WIDTH * HEIGHT).fill(" ");
  const depth = new Float32Array(WIDTH * HEIGHT);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  for (const [x0, y0, z0, nx0, ny0, nz0] of POINTS) {
    // Roll about the axle, yaw about the vertical, then a small tilt about x.
    const x = x0 * cr - y0 * sr;
    const y = x0 * sr + y0 * cr;
    const nx = nx0 * cr - ny0 * sr;
    const ny = nx0 * sr + ny0 * cr;
    const x2 = x * cy + z0 * sy;
    const z2 = -x * sy + z0 * cy;
    const nx2 = nx * cy + nz0 * sy;
    const nz2 = -nx * sy + nz0 * cy;
    const y3 = y * ct - z2 * st;
    const z3 = y * st + z2 * ct;
    const ny3 = ny * ct - nz2 * st;
    const nz3 = ny * st + nz2 * ct;
    const ooz = 1 / (z3 + 4.2);
    // About 28 columns per unit of radius, and half that in rows: a glyph is about twice as tall as wide.
    const xp = Math.floor(WIDTH / 2 + 92 * x2 * ooz);
    const yp = Math.floor(HEIGHT / 2 - 44 * y3 * ooz);
    if (xp < 0 || xp >= WIDTH || yp < 0 || yp >= HEIGHT) continue;
    const i = xp + yp * WIDTH;
    if (ooz > depth[i]!) {
      depth[i] = ooz;
      const lum = Math.max(0, nx2 * LIGHT[0] + ny3 * LIGHT[1] + nz3 * LIGHT[2]);
      cells[i] =
        RAMP[
          1 + Math.min(RAMP.length - 2, Math.floor(lum * (RAMP.length - 1)))
        ]!;
    }
  }
  let text = "";
  for (let row = 0; row < HEIGHT; row++) {
    text += cells.slice(row * WIDTH, row * WIDTH + WIDTH).join("") + "\n";
  }
  return text;
}

/** Whether enough time has passed since the last frame for the next one. Times are in milliseconds. */
export function frameDue(now: number, last: number): boolean {
  return now - last > FRAME_MS;
}

export interface RunState {
  reducedMotion: boolean;
  /** The wheel is within the window. */
  onScreen: boolean;
  /** The tab is in the background. */
  tabHidden: boolean;
}

/** The wheel animates only when it can be seen and the visitor has not asked for less motion. */
export function shouldRun(state: RunState): boolean {
  return !state.reducedMotion && state.onScreen && !state.tabHidden;
}

export interface WheelPage {
  reducedMotion(): boolean;
  tabHidden(): boolean;
  /** Calls `listener` with whether the wheel is in the window, now and whenever that changes. */
  watchOnScreen(listener: (onScreen: boolean) => void): void;
  /** Calls `listener` whenever the tab is shown or hidden. */
  watchTab(listener: () => void): void;
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(handle: number): void;
  /** Puts this text in the page's wheel. */
  draw(text: string): void;
}

/**
 * Animates the wheel from the tick the build drew. Under reduced motion it does nothing, and the
 * still wheel stays. Otherwise it runs only while the wheel is on screen in a visible tab.
 */
export function initWheel(page: WheelPage): void {
  if (page.reducedMotion()) return;
  let tick = FIRST_TICK;
  let last = 0;
  let onScreen = false;
  let handle: number | undefined;

  const state = (): RunState => ({
    reducedMotion: page.reducedMotion(),
    onScreen,
    tabHidden: page.tabHidden(),
  });
  const stop = () => {
    if (handle !== undefined) page.cancelFrame(handle);
    handle = undefined;
  };
  const loop = (now: number) => {
    handle = undefined;
    if (!shouldRun(state())) return;
    if (frameDue(now, last)) {
      tick++;
      page.draw(frame(tick));
      last = now;
    }
    handle = page.requestFrame(loop);
  };
  const update = () => {
    if (!shouldRun(state())) stop();
    else if (handle === undefined) handle = page.requestFrame(loop);
  };

  page.watchOnScreen((value) => {
    onScreen = value;
    update();
  });
  page.watchTab(update);
}
