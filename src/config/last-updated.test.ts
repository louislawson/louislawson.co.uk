import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { lastCommitDate, once, parseCommitDate } from "./last-updated";

describe("once", () => {
  // Every page's layout asks for the date, and git should be asked once per build, not per page.
  it("runs the function the first time and hands back that result after", () => {
    let calls = 0;
    const next = once(() => ++calls);
    expect(next()).toBe(1);
    expect(next()).toBe(1);
    expect(next()).toBe(1);
    expect(calls).toBe(1);
  });

  it("remembers that there was no result, rather than asking again", () => {
    let calls = 0;
    const none = once(() => {
      calls++;
      return undefined;
    });
    expect(none()).toBeUndefined();
    expect(none()).toBeUndefined();
    expect(calls).toBe(1);
  });
});

describe("parseCommitDate", () => {
  it("takes the date as git writes it, without the line ending", () => {
    expect(parseCommitDate("2026-10-17\n")).toBe("2026-10-17");
    expect(parseCommitDate("2026-10-17")).toBe("2026-10-17");
  });

  it("leaves out anything that is not a date", () => {
    for (const output of [
      "",
      "\n",
      "not a date",
      "2026-10-17 12:00",
      "17/10/2026",
      "2026-13-45",
      "2026-02-30",
    ]) {
      expect(parseCommitDate(output), JSON.stringify(output)).toBeUndefined();
    }
  });
});

describe("lastCommitDate", () => {
  const empty: string[] = [];
  afterAll(() => {
    for (const dir of empty) rmSync(dir, { recursive: true, force: true });
  });

  it("is what the runner prints for the folder it is given", () => {
    const seen: string[] = [];
    const date = lastCommitDate({
      cwd: "/somewhere",
      run: (cwd) => {
        seen.push(cwd);
        return "2026-10-17\n";
      },
    });
    expect(date).toBe("2026-10-17");
    expect(seen).toEqual(["/somewhere"]);
  });

  it("is left out, not thrown, when git fails", () => {
    const date = lastCommitDate({
      run: () => {
        throw new Error("git: command not found");
      },
    });
    expect(date).toBeUndefined();
  });

  it("is left out when git prints something else", () => {
    expect(lastCommitDate({ run: () => "fatal: nothing\n" })).toBeUndefined();
  });

  it("is left out in a folder that is not a git repository", () => {
    // The temporary copies of the project that the build tests make have no .git.
    const dir = mkdtempSync(join(tmpdir(), "no-git-"));
    empty.push(dir);
    expect(lastCommitDate({ cwd: dir })).toBeUndefined();
  });

  it("is a date in this repository", () => {
    expect(lastCommitDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
