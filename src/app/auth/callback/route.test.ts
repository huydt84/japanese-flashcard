// @vitest-environment node
import { expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }) }));

it.each(["https://outside.example/path", "//outside.example", "\\\\outside.example", "javascript:alert(1)"])("keeps the OAuth return on this site for %s", async (next) => {
  const response = await GET(new Request(`https://kotoba.example/auth/callback?code=test&next=${encodeURIComponent(next)}`));
  expect(response.headers.get("location")).toBe("https://kotoba.example/app");
});

it("preserves an internal OAuth return path", async () => {
  const response = await GET(new Request("https://kotoba.example/auth/callback?code=test&next=%2Fstudent%2Fnotifications"));
  expect(response.headers.get("location")).toBe("https://kotoba.example/student/notifications");
});
