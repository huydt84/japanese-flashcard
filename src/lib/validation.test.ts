import { describe, expect, it } from "vitest";
import { inviteSchema } from "@/lib/validation";

describe("email handling", () => {
  it("rejects malformed invitations", () => expect(inviteSchema.safeParse({ email: "not-an-email" }).success).toBe(false));
});
