import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";

export function publicationDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

// Reservations are immutable. Deleted publications never release their codes.
export function reservePublicationNumber(id: string, timestamp: string) {
  const day = publicationDay(timestamp);
  return reserve(id, `publication-numbers/${day}`, ["numbers", day], 10000);
}

export function reservePublicationSequence(id: string) {
  return reserve(id, "publication-sequences", ["sequences"], 1000000);
}

async function reserve(
  id: string,
  bucket: string,
  localParts: string[],
  limit: number,
) {
  const ns = process.env.COMMENT_NAMESPACE ?? process.env.VERCEL_ENV ?? "local";
  if (!/^[a-zA-Z0-9_-]+$/.test(ns)) throw new Error("Invalid namespace");
  // Local development storage is not an asset to include in the server bundle.
  const directory = path.join(/* turbopackIgnore: true */
    process.env.PUBLICATION_DATA_DIR ??
      path.join(process.cwd(), ".data", "publications"),
    ...localParts,
  );
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    await mkdir(directory, { recursive: true });
  for (let number = 1; number <= limit; number++) {
    const filename = `${number}.json`;
    const key = `bundangzip/${ns}/${bucket}/${filename}`;
    const localPath = path.join(directory, filename);
    let owner: string | null = null;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const record = await get(key, {
        access: "private",
        useCache: false,
        headers: { "Accept-Encoding": "identity" },
      });
      if (record) {
        if (record.statusCode !== 200 || !record.stream)
          throw new Error("Unexpected numbering response");
        owner = JSON.parse(await new Response(record.stream).text()).id;
      }
    } else {
      try {
        owner = JSON.parse(await readFile(localPath, "utf8")).id;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (owner === id) return number;
    if (owner) continue;
    try {
      const content = JSON.stringify({ id });
      if (process.env.BLOB_READ_WRITE_TOKEN)
        await put(key, content, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/json",
        });
      else {
        const temp = `${localPath}.${randomUUID()}.tmp`;
        try {
          await writeFile(temp, content, { flag: "wx", mode: 0o600 });
          await link(temp, localPath);
        } finally {
          await unlink(temp).catch(() => {});
        }
      }
      return number;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        code !== "EEXIST" &&
        !(error instanceof BlobPreconditionFailedError) &&
        !(error instanceof Error && /already exists/i.test(error.message))
      )
        throw error;
      number--; // Re-read the winning reservation, including same-request retries.
    }
  }
  throw new Error("Publication number limit exceeded");
}
