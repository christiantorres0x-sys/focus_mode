import { describe, expect, it } from "vitest";
import { validateTaskInput, type TaskInput } from "./tasks";

describe("validateTaskInput (FR-25, FR-26)", () => {
  it("trims text and converts the estimate to a number", () => {
    expect(validateTaskInput({ title: "  Finish lab  ", subject: " Physics ", estimate: " 45 " })).toEqual({
      ok: true,
      value: { title: "Finish lab", subject: "Physics", estimatedMinutes: 45 },
    });
  });

  it("subject and estimate are optional", () => {
    const r = validateTaskInput({ title: "x", subject: "", estimate: "" });
    expect(r).toEqual({ ok: true, value: { title: "x", subject: null, estimatedMinutes: null } });
  });

  const invalid: [TaskInput, keyof TaskInput][] = [
    [{ title: "", subject: "", estimate: "" }, "title"],
    [{ title: "   ", subject: "", estimate: "" }, "title"],
    [{ title: "a".repeat(121), subject: "", estimate: "" }, "title"],
    [{ title: "a", subject: "s".repeat(41), estimate: "" }, "subject"],
    [{ title: "a", subject: "", estimate: "0" }, "estimate"],
    [{ title: "a", subject: "", estimate: "1441" }, "estimate"],
    [{ title: "a", subject: "", estimate: "12.5" }, "estimate"],
    [{ title: "a", subject: "", estimate: "-5" }, "estimate"],
    [{ title: "a", subject: "", estimate: "abc" }, "estimate"],
    [{ title: "a", subject: "", estimate: "1e3" }, "estimate"],
  ];
  it.each(invalid)("rejects %j with an error on %s", (input, field) => {
    const r = validateTaskInput(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });

  it("reports every problem at once", () => {
    const r = validateTaskInput({ title: "", subject: "", estimate: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeTruthy();
      expect(r.errors.estimate).toBeTruthy();
    }
  });
});
