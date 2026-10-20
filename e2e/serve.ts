// Serves one built folder the way Azure Static Web Apps would, for the Playwright tests:
//
//   node e2e/serve.ts dist-e2e/preview 4400
//
// `astro preview` does not send the headers the site's config adds (the CSP, HSTS, X-Robots-Tag),
// so a blocked script or style would pass unnoticed. This server reads the folder's generated
// staticwebapp.config.json and applies it; the rules themselves are in src/e2e/rules.ts, where
// Vitest tests them. Node runs this TypeScript directly, so it uses node:http alone.
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import {
  contentType,
  respond,
  type StaticWebAppRules,
} from "../src/e2e/rules.ts";

const [folderArg, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!folderArg || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("usage: node e2e/serve.ts <built folder> <port>");
  process.exit(1);
}

const folder = resolve(folderArg);
const config = await readFile(
  join(folder, "staticwebapp.config.json"),
  "utf-8",
).then(
  (text) => JSON.parse(text) as StaticWebAppRules,
  () => {
    console.error(
      `${folder} holds no build (no staticwebapp.config.json). Run "npm run build:e2e" first.`,
    );
    process.exit(1);
  },
);

const isFile = (file: string) => {
  try {
    return statSync(join(folder, file)).isFile();
  } catch {
    return false;
  }
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const answer = respond(config, request.url ?? "/", isFile);
    const headers: Record<string, string | number> = { ...answer.headers };
    const body = answer.file
      ? await readFile(join(folder, answer.file))
      : Buffer.alloc(0);
    if (answer.file) headers["Content-Type"] = contentType(answer.file);
    headers["Content-Length"] = body.length;
    response.writeHead(answer.status, headers);
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    // A file that vanished or could not be read (a rebuild during a run): say so, and keep serving
    // rather than let one request's rejection end the process and every later test with it.
    console.error(`${request.method} ${request.url}:`, error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${folder} on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
