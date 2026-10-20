// The rules of the e2e server (e2e/serve.ts), kept apart from it so Vitest can test them: Vitest
// does not run e2e/. Nothing the site's build reads imports this, and Node runs the server on this
// file directly, so it imports nothing.

/** The parts of the build's staticwebapp.config.json that the server applies. */
export interface StaticWebAppRules {
  globalHeaders?: Record<string, string>;
  routes?: { route: string; headers?: Record<string, string> }[];
  responseOverrides?: { "404"?: { rewrite?: string } };
}

export interface Answer {
  status: number;
  /** The file to send, relative to the built folder; none when nothing can answer. */
  file?: string;
  headers: Record<string, string>;
}

/** The file a request path asks for, or undefined for a path that is malformed or leaves the folder. */
function requestedFile(urlPath: string): string | undefined {
  const raw = urlPath.split(/[?#]/)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return undefined;
  if (decoded.includes("\\")) return undefined;
  const segments = decoded.slice(1).split("/");
  // One empty segment at the end is a trailing slash; one anywhere else is a doubled slash.
  const trailing = segments.length > 1 && segments.at(-1) === "";
  const parts = trailing ? segments.slice(0, -1) : segments;
  if (parts.length === 1 && parts[0] === "") return "";
  if (parts.some((part) => part === "" || part === "." || part === ".."))
    return undefined;
  return parts.join("/");
}

const join = (folder: string, name: string) =>
  folder === "" ? name : `${folder}/${name}`;

/** The route headers that apply to a path: an exact route, or a prefix route ending in `*`. */
function routeHeaders(
  routes: StaticWebAppRules["routes"],
  urlPath: string,
): Record<string, string> {
  const path = urlPath.split(/[?#]/)[0] ?? "";
  const merged: Record<string, string> = {};
  for (const { route, headers } of routes ?? []) {
    const matches = route.endsWith("*")
      ? path.startsWith(route.slice(0, -1))
      : path === route;
    if (matches) Object.assign(merged, headers);
  }
  return merged;
}

/** Global headers, then route headers on top; a name already present in any case is replaced. */
function mergeHeaders(
  ...sets: Record<string, string>[]
): Record<string, string> {
  const byName = new Map<string, [string, string]>();
  for (const set of sets) {
    for (const [name, value] of Object.entries(set)) {
      byName.set(name.toLowerCase(), [name, value]);
    }
  }
  return Object.fromEntries(byName.values());
}

/**
 * How Static Web Apps answers a request: a file is sent as it is, a folder path sends the folder's
 * index.html, and anything else is status 404 with the page the config rewrites 404s to. Every
 * answer carries the global headers; a route's headers replace them for the files it names, and
 * not on a 404, so a missing file is never cached as if it were an asset.
 */
export function respond(
  config: StaticWebAppRules,
  urlPath: string,
  exists: (file: string) => boolean,
): Answer {
  const global = config.globalHeaders ?? {};
  const wanted = requestedFile(urlPath);
  if (wanted !== undefined) {
    const file = [wanted, join(wanted, "index.html")].find(
      (candidate) => candidate !== "" && exists(candidate),
    );
    if (file) {
      return {
        status: 200,
        file,
        headers: mergeHeaders(global, routeHeaders(config.routes, urlPath)),
      };
    }
  }
  const rewrite = config.responseOverrides?.["404"]?.rewrite?.replace(
    /^\//,
    "",
  );
  return {
    status: 404,
    file: rewrite && exists(rewrite) ? rewrite : undefined,
    headers: mergeHeaders(global),
  };
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  pdf: "application/pdf",
};

export function contentType(file: string): string {
  const dot = file.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.slice(dot + 1).toLowerCase();
  return TYPES[extension] ?? "application/octet-stream";
}

/**
 * The URL path of every page in a build, from the files in it (paths relative to the built
 * folder): each folder's index.html as the folder, and the root 404.html. The list is the build's
 * own, never a hand-kept one or the sitemap.
 */
export function pagePaths(files: string[]): string[] {
  const paths: string[] = [];
  for (const file of files) {
    const path = file.replaceAll("\\", "/");
    if (path === "404.html") paths.push("/404.html");
    else if (path === "index.html") paths.push("/");
    else if (path.endsWith("/index.html")) {
      paths.push(`/${path.slice(0, -"index.html".length)}`);
    }
  }
  return paths.sort();
}
