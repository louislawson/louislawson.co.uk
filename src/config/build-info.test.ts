import { describe, expect, it } from "vitest";
import { buildLabel, parseBuildInfo } from "./build-info";

describe("parseBuildInfo", () => {
  it("reads the build number and the short commit the deploy workflow sets", () => {
    expect(parseBuildInfo({ BUILD_NUMBER: "412", GIT_SHA: "0af5e05" })).toEqual(
      { number: "412", commit: "0af5e05" },
    );
  });

  it("accepts a commit of 7 to 40 hex digits and no other length", () => {
    const sha40 = "0af5e05".padEnd(40, "a");
    expect(parseBuildInfo({ BUILD_NUMBER: "1", GIT_SHA: sha40 })?.commit).toBe(
      sha40,
    );
    expect(
      parseBuildInfo({ BUILD_NUMBER: "1", GIT_SHA: "0af5e0" }),
    ).toBeUndefined();
    expect(
      parseBuildInfo({ BUILD_NUMBER: "1", GIT_SHA: `${sha40}a` }),
    ).toBeUndefined();
  });

  it("ignores whitespace around a value", () => {
    expect(
      parseBuildInfo({ BUILD_NUMBER: " 412\n", GIT_SHA: "0af5e05 " }),
    ).toEqual({ number: "412", commit: "0af5e05" });
  });

  it("is nothing for a local build, where neither is set", () => {
    expect(parseBuildInfo({})).toBeUndefined();
    expect(parseBuildInfo({ BUILD_NUMBER: "", GIT_SHA: "" })).toBeUndefined();
  });

  it("is nothing unless both are set, rather than half a statement", () => {
    expect(parseBuildInfo({ BUILD_NUMBER: "412" })).toBeUndefined();
    expect(parseBuildInfo({ GIT_SHA: "0af5e05" })).toBeUndefined();
  });

  it.each(["0", "-3", "4.5", "412a", "1e3", "007", "<b>1</b>"])(
    "refuses the build number %j, so only a plain positive count reaches the page",
    (value) => {
      expect(
        parseBuildInfo({ BUILD_NUMBER: value, GIT_SHA: "0af5e05" }),
      ).toBeUndefined();
    },
  );

  it.each(["0AF5E05", "g0f5e05", "0af5e0 5", '"><script>', "main"])(
    "refuses the commit %j: lower-case hex only",
    (value) => {
      expect(
        parseBuildInfo({ BUILD_NUMBER: "412", GIT_SHA: value }),
      ).toBeUndefined();
    },
  );
});

describe("buildLabel", () => {
  it("says the build and the commit", () => {
    expect(buildLabel({ number: "412", commit: "0af5e05" })).toBe(
      "build 412 · commit 0af5e05",
    );
  });

  it("says local build when there is no build info", () => {
    expect(buildLabel(undefined)).toBe("local build");
  });
});
