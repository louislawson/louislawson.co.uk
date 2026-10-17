import { describe, expect, it } from "vitest";
import { profile } from "./profile";

describe("the committed profile", () => {
  it("parses on import and carries the public email address", () => {
    expect(profile.email).toBe("hello@louislawson.co.uk");
  });
});
