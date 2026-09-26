import { describe, expect, it } from "vitest";
import { inviteSchema, normalizeEmail } from "@/lib/validation";

describe("email handling", () => {
  it("normalizes whitespace and casing", () => expect(normalizeEmail("  MAI@Example.COM ")).toBe("mai@example.com"));
  it("rejects malformed invitations", () => expect(inviteSchema.safeParse({ email: "not-an-email" }).success).toBe(false));
});

