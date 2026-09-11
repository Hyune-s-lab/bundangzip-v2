import { authenticated } from "@/lib/auth";
import { getPublication } from "@/lib/publication-store";
import { HttpError } from "@/lib/http";
import { PublicationEditor } from "@/components/publication-manager";
import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await authenticated())) redirect("/");
  try {
    return (
      <PublicationEditor initial={await getPublication((await params).id)} />
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
