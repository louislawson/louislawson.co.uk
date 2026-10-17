import { describe, expect, it } from "vitest";
import { containsTodo, isPlaceholder, todo } from "./schema";
import { bodyContainsTodo } from "./todo";

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

  describe("bodyContainsTodo", () => {
    // A Markdown body has no schema, so this is what keeps a half-finished write-up out of production.
    it("finds TODO and TODOs as words, in any case, anywhere in the body", () => {
      for (const body of [
        "TODO: write the result section",
        "Some prose.\n\nTODO write more",
        "Still to do: see the TODOs below",
        "- todos remain",
        "(Todo)",
      ]) {
        expect(bodyContainsTodo(body), body).toBe(true);
      }
    });

    it("leaves ordinary words alone", () => {
      for (const body of [
        "A Todoist-style board and autodoc output.",
        "Nothing left to do here.",
        "",
      ]) {
        expect(bodyContainsTodo(body), body).toBe(false);
      }
    });
  });

  describe("containsTodo", () => {
    it("finds TODO as a word, in any case, anywhere in the text", () => {
      for (const value of [
        "TODO: later",
        "Faster deploys. TODO: add the figure",
        "todo write this",
        "(Todo)",
        "line one\nTODO line two",
      ]) {
        expect(containsTodo(value), value).toBe(true);
      }
    });

    it("leaves words that merely contain it alone", () => {
      for (const value of ["Todoist", "autodoc", "mastodon", "A to-do list"]) {
        expect(containsTodo(value), value).toBe(false);
      }
    });
  });
});
