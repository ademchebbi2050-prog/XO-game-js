import { withStore, bad } from "@/lib/api";
import { uploadImage, MAX_IMAGE_BYTES } from "@/lib/storage";

// POST multipart: champ "file". Valide magic bytes + taille, écrit via lib/storage.
export async function POST(req: Request) {
  return withStore(req, async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("FILE_REQUIRED");
    if (file.size > MAX_IMAGE_BYTES) return bad("IMAGE_TOO_LARGE", 413);
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const uploaded = await uploadImage(buf, file.type);
      return Response.json(uploaded, { status: 201 });
    } catch (e) {
      return bad(e instanceof Error ? e.message : "UPLOAD_FAILED");
    }
  });
}
