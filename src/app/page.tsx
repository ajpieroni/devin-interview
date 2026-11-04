import { redirect } from "next/navigation";
import { requirePage } from "@/core/authz";

export default async function Home() {
  await requirePage("session:read", "/");
  redirect("/cases");
}
