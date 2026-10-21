// Checks a deployed site against the build that was uploaded to it. Run it after a deploy:
//
//   node scripts/check-live.ts --url <deployed address> --config dist/staticwebapp.config.json \
//     --context preview|production
//
// The address is the deploy step's output; no host is written here. The site must send exactly the
// content security policy the build generated, HSTS, and the X-Robots-Tag the build sends, and a
// path that does not exist must answer 404. A check that fails straight after a deploy is run
// again for a minute or so, since a new deployment can take a moment to reach every edge. The
// rules are in src/e2e/live.ts, where Vitest tests them. Node runs this TypeScript directly.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  checkLive,
  expectationFrom,
  parseLiveUrl,
  retry,
  type LiveConfig,
  type LiveContext,
} from "../src/e2e/live.ts";

/** One annotation line: a newline would end it, so it is written the way Actions reads one. */
const annotate = (message: string) =>
  `::error::${message.replaceAll("\n", "%0A")}`;

function fail(message: string, code = 1): never {
  console.error(annotate(message));
  process.exit(code);
}

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    config: { type: "string" },
    context: { type: "string" },
    attempts: { type: "string", default: "5" },
    delay: { type: "string", default: "15" },
  },
  strict: true,
});

const usage =
  "usage: node scripts/check-live.ts --url <address> --config <staticwebapp.config.json> --context preview|production";
if (!values.url || !values.config || !values.context) fail(usage, 2);
if (values.context !== "preview" && values.context !== "production") {
  fail(`--context must be preview or production, got "${values.context}"`, 2);
}
const attempts = Number(values.attempts);
const delaySeconds = Number(values.delay);
if (!Number.isInteger(attempts) || attempts < 1 || !(delaySeconds >= 0)) {
  fail(
    "--attempts must be a whole number of at least 1 and --delay a number of seconds",
    2,
  );
}

let url: string;
let expectation: ReturnType<typeof expectationFrom>;
try {
  url = parseLiveUrl(values.url);
  expectation = expectationFrom(
    JSON.parse(readFileSync(values.config, "utf-8")) as LiveConfig,
    values.context as LiveContext,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), 2);
}

console.log(`checking ${url} as a ${expectation.context} deploy`);
const failures = await retry(
  async () => {
    const found = await checkLive({ url, expectation, fetch });
    for (const failure of found) console.log(`  not yet: ${failure}`);
    return found;
  },
  { attempts, delayMs: delaySeconds * 1000 },
);

if (failures.length > 0) {
  for (const failure of failures) console.error(annotate(failure));
  fail(`${failures.length} live check(s) failed on ${url}`);
}
console.log(
  "live check passed: policy, HSTS, robots header and 404 are as built",
);
