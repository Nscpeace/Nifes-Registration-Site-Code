import { redirect } from "next/navigation";
import { requireRole } from "@/lib/access";

export default async function MemberRecordsGateway() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  redirect("/admin/members");
}
