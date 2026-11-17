// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from "vitest";
import { selectCloseFocusCamera } from "./camera-selection";

describe("selectCloseFocusCamera", () => {
  it("prefers a macro camera over the main rear camera", () => {
    const camera = selectCloseFocusCamera([
      { id: "main", label: "Back Camera" },
      { id: "macro", label: "Back Macro Camera" },
      { id: "front", label: "Front Camera" },
    ]);

    expect(camera?.id).toBe("macro");
  });

  it("uses the ultra-wide close-focus lens when no macro label exists", () => {
    const camera = selectCloseFocusCamera([
      { id: "main", label: "Rear Camera" },
      { id: "wide", label: "Back Ultra Wide 0.5x" },
    ]);

    expect(camera?.id).toBe("wide");
  });

  it("falls back to a rear camera instead of the selfie camera", () => {
    const camera = selectCloseFocusCamera([
      { id: "front", label: "Front Camera" },
      { id: "rear", label: "camera2 0, facing back" },
    ]);

    expect(camera?.id).toBe("rear");
  });

  it("keeps the first camera when labels are unavailable", () => {
    const camera = selectCloseFocusCamera([
      { id: "first", label: "" },
      { id: "second", label: "" },
    ]);

    expect(camera?.id).toBe("first");
  });
});
