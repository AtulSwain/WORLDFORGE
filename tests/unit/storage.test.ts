import { describe, expect, it } from "vitest";
import { ALLOWED_MIME, sniffMime } from "@/server/storage";

const b = (hex: string, tail = "") => Buffer.concat([Buffer.from(hex, "hex"), Buffer.from(tail)]);

describe("upload type sniffing", () => {
  it("recognises images and PDFs by magic bytes", () => {
    expect(sniffMime(b("89504e470d0a1a0a0000"))).toBe("image/png");
    expect(sniffMime(b("ffd8ffe000"))).toBe("image/jpeg");
    expect(sniffMime(b("474946383961"))).toBe("image/gif");
    expect(sniffMime(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))).toBe("image/webp");
    expect(sniffMime(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("accepts plain text but rejects markup that could run scripts", () => {
    expect(sniffMime(Buffer.from("# Annals of Veyr\n\nIn the year 851…"))).toBe("text/plain");
    expect(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffMime(Buffer.from("  <!DOCTYPE html><html></html>"))).toBeNull();
    expect(sniffMime(Buffer.from('<?xml version="1.0"?><svg/>'))).toBeNull();
  });

  it("rejects binary of unknown type", () => {
    expect(sniffMime(Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]))).toBeNull();
    expect(ALLOWED_MIME.has("image/svg+xml")).toBe(false);
  });
});
