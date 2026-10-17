import { describe, expect, it } from "vitest";
import { isPlaceholder, todo } from "./schema";

describe("placeholders", () => {
  it("accepts a string that starts with TODO:", () => {
    expect(todo.safeParse("TODO: add the real title").success).toBe(true);
  });

  it("rejects a string that does not start with TODO:", () => {
    expect(todo.safeParse("A real title").success).toBe(false);
    expect(todo.safeParse("todo: lower case").success).toBe(false);
    expect(todo.safeParse(" TODO: leading space").success).toBe(false);
  });

  it("names the TODO: prefix in the error", () => {
    const result = todo.safeParse("A real title");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("TODO:");
  });

  it("is recognised by isPlaceholder for strings only", () => {
    expect(isPlaceholder("TODO: later")).toBe(true);
    expect(isPlaceholder("done")).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder(42)).toBe(false);
    expect(isPlaceholder(["TODO: x"])).toBe(false);
  });
});
