// @vitest-environment node
import { describe, it, expect } from "vitest";
import { csvCell, exportRequestSchema } from "../api/_lib/exportAudience.ts";
import { reportEmailContent } from "../api/_lib/exportAudienceEmail.ts";

describe("Export research input and output boundaries", () => {
  const input = {
    email: "  Person@Example.com  ",
    privacyAcknowledged: true,
    marketingConsent: false,
  };
  it("normalizes the email while retaining an explicit refusal of marketing", () => {
    const data = exportRequestSchema.parse(input);
    expect(data.email).toBe("person@example.com");
    expect(data.marketingConsent).toBe(false);
    expect(data.profile).toBe("unspecified");
  });
  it.each([
    { ...input, marketingConsent: "true" },
    { ...input, marketingConsent: undefined },
    { ...input, privacyAcknowledged: false },
    { ...input, email: "invalid" },
    { ...input, email: "a@example.com\r\nBcc: b@example.com" },
    { ...input, profile: "admin" },
    { ...input, sector: "x".repeat(121) },
    { ...input, name: "hello\nworld" },
  ])("rejects malformed or ambiguous form values", (data) =>
    expect(exportRequestSchema.safeParse(data).success).toBe(false),
  );
  it.each(["=SUM(A1)", "+123", "-1", "@cmd", '  =HYPERLINK("x")', "\tbad"])(
    "prevents spreadsheet formula injection: %s",
    (value) => {
      expect(csvCell(value)).toMatch(/^"'/);
    },
  );
  it("escapes CSV quotes and preserves Turkish text", () =>
    expect(csvCell('Şirket "A"')).toBe('"Şirket ""A"""'));
  it("only includes a marketing confirmation link for explicit opt-in", () => {
    const email = {
      to: "a@example.com",
      requestId: "test",
      downloadUrl: "https://example.com/download?token=one",
      confirmUrl: null,
      unsubscribeUrl: "https://example.com/unsubscribe?token=two",
    };
    const without = reportEmailContent(email);
    expect(without.html).not.toContain("E-posta tercihimi doğrula");
    const withOptIn = reportEmailContent({
      ...email,
      confirmUrl: "https://example.com/confirm?token=one",
    });
    expect(withOptIn.html).toContain("E-posta tercihimi doğrula");
    expect(withOptIn.text).toContain(
      "İznimi istediğim zaman geri çekebilirim.",
    );
  });
});
