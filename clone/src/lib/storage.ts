// Stockage d'images derrière une interface. MVP: disque local (public/uploads).
// Prod: Cloudflare R2 (S3, région UE) — ne changer que l'implémentation.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGES_PER_PRODUCT = 8;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/** Vérifie les magic bytes (pas seulement le Content-Type client). */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(buf.subarray(8, 12).toString("ascii"))) return "image/avif";
  return null;
}

export interface UploadedFile {
  url: string;
  type: string;
  bytes: number;
}

/** MVP: écrit sur disque dans public/uploads. Retourne l'URL publique. */
export async function uploadImage(buf: Buffer, declaredType: string): Promise<UploadedFile> {
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const type = sniffImageType(buf);
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("IMAGE_TYPE_NOT_ALLOWED");
  }
  const name = randomBytes(16).toString("hex") + EXT[type];
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return { url: "/uploads/" + name, type, bytes: buf.length };
}

export async function removeImage(url: string): Promise<void> {
  if (!url.startsWith("/uploads/")) return;
  const { unlink } = await import("node:fs/promises");
  await unlink(path.join(process.cwd(), "public", url)).catch(() => {});
}
