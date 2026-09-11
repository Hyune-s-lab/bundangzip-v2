import { authenticated } from "@/lib/auth";
import { listPublications } from "@/lib/publication-store";
import { PublicationList } from "@/components/publication-manager";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await authenticated())) redirect("/");
  return <PublicationList initial={await listPublications()} />;
}
