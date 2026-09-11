import { getPublicPublication } from "@/lib/publication-store";
import { HttpError } from "@/lib/http";
import PublicationView from "@/components/publication-view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "리모델링 공유 자료 | bundangzip-v2",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    return (
      <PublicationView
        publication={await getPublicPublication((await params).id)}
      />
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
