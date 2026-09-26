import { describe, expect, it } from "vitest";
import { resolveWorkspaceRole } from "@/lib/roles";

describe("resolveWorkspaceRole", () => {
  it("keeps a regular account in its fixed workspace", () => {
    expect(resolveWorkspaceRole({ role: "teacher", active_mode: null })).toBe("teacher");
    expect(resolveWorkspaceRole({ role: "student", active_mode: null })).toBe("student");
  });

  it("uses the persisted workspace mode for an admin", () => {
    expect(resolveWorkspaceRole({ role: "admin", active_mode: "teacher" })).toBe("teacher");
    expect(resolveWorkspaceRole({ role: "admin", active_mode: "student" })).toBe("student");
  });

  it("defaults an admin to the student workspace", () => {
    expect(resolveWorkspaceRole({ role: "admin", active_mode: null })).toBe("student");
  });
});
