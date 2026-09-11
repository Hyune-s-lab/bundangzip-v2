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

// A reservation is immutable. Retrying the same draft reuses its daily number.
export async function reservePublicationNumber(id: string, timestamp: string) {
  const day = publicationDay(timestamp);
  const ns = process.env.COMMENT_NAMESPACE ?? process.env.VERCEL_ENV ?? "local";
  if (!/^[a-zA-Z0-9_-]+$/.test(ns)) throw new Error("Invalid namespace");
  const directory = path.join(
    process.env.PUBLICATION_DATA_DIR ??
      path.join(process.cwd(), ".data", "publications"),
    "numbers",
    day,
  );
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    await mkdir(directory, { recursive: true });
  for (let number = 1; number <= 10000; number++) {
    const filename = `${number}.json`;
    const key = `bundangzip/${ns}/publication-numbers/${day}/${filename}`;
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
  throw new Error("Daily publication number limit exceeded");
}
