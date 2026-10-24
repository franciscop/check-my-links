// Barebones smoke test, not a full suite
import { describe, expect, it } from "bun:test";
import Queue from "./queue.js";

describe("Queue", () => {
  it("skips items it has already seen", () => {
    const queue = Queue(() => {});
    expect(queue.add("a", "b")).toEqual(["a", "b"]);
    expect(queue.add("b", "c")).toEqual(["c"]);
    expect(queue.items).toEqual(["a", "b", "c"]);
  });

  it("runs the operation on each item", async () => {
    const queue = Queue((item) => item.toUpperCase());
    const results = [];
    for await (const value of queue.start("a")) results.push(value);
    expect(results).toEqual(["A"]);
  });
});
