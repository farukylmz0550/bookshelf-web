import { describe, expect, it } from "vitest";
import { isValidBatchIsbn, uniqueBatchIsbns } from "./batch-isbn";

describe("batch ISBN helpers", () => {
  it("normalizes and preserves valid ISBNs", () => {
    expect(uniqueBatchIsbns(["978-0-13-468599-1"])).toEqual([
      { raw: "978-0-13-468599-1", isbn: "9780134685991", status: "ready" },
    ]);
  });

  it("marks invalid and repeated values separately", () => {
    expect(uniqueBatchIsbns(["9780134685990", "9780134685991", "978-0-13-468599-1"])).toEqual([
      { raw: "9780134685990", isbn: "9780134685990", status: "invalid" },
      { raw: "9780134685991", isbn: "9780134685991", status: "ready" },
      { raw: "978-0-13-468599-1", isbn: "9780134685991", status: "duplicate" },
    ]);
  });

  it("accepts ISBN-10 check digits", () => {
    expect(isValidBatchIsbn("0-804-42957-X")).toBe(true);
  });
});
