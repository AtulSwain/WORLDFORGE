import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage abstraction.
 *   STORAGE_DRIVER=local (default, development) — files under STORAGE_LOCAL_DIR (./storage)
 *   STORAGE_DRIVER=s3 — any S3-compatible bucket (AWS S3, R2, MinIO…)
 * Binaries never go into the relational database; only keys and metadata do.
 */
export interface StorageDriver {
  name: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** A short-lived URL for direct download, when the driver supports it. */
  signedUrl?(key: string, seconds: number): Promise<string>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_.-]+$/;
function checkKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

class LocalDriver implements StorageDriver {
  name = "local" as const;
  private root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  private file(key: string) {
    checkKey(key);
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.file(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async get(key: string) {
    try {
      return await readFile(this.file(key));
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class S3Driver implements StorageDriver {
  name = "s3" as const;
  private bucket = process.env.S3_BUCKET!;
  private clientPromise = (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    });
  })();
  async put(key: string, body: Buffer, contentType: string) {
    checkKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    checkKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const r = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    checkKey(key);
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async signedUrl(key: string, seconds: number) {
    checkKey(key);
    const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner")]);
    return getSignedUrl(await this.clientPromise, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: seconds });
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (driver) return driver;
  if (process.env.STORAGE_DRIVER === "s3") {
    const missing = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`S3 storage is selected but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set.`);
    driver = new S3Driver();
  } else driver = new LocalDriver();
  return driver;
}

/** Detects the real file type from magic bytes; the client-declared type is never trusted. */
export function sniffMime(buf: Buffer): string | null {
  const hex = buf.subarray(0, 12).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("47494638")) return "image/gif";
  if (hex.startsWith("52494646") && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavif")) return "image/avif";
  if (hex.startsWith("25504446")) return "application/pdf";
  // Plain text / Markdown: valid UTF-8 without NUL bytes.
  const head = buf.subarray(0, 4096);
  if (!head.includes(0)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(head).trimStart().toLowerCase();
      // Markup (SVG, HTML, XML) can carry scripts; it is not accepted as "text".
      if (/^(<\?xml|<svg|<!doctype|<html|<script)/.test(text)) return null;
      return "text/plain";
    } catch {
      return null;
    }
  }
  return null;
}

export const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf", "text/plain"]);
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;
