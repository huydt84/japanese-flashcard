import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { resolveWorkspaceRole } from "@/lib/roles";
export default async function AppEntry(){const viewer=await getViewer();if(!viewer)redirect("/");if(!viewer.profile?.role)redirect("/onboarding");const role=resolveWorkspaceRole(viewer.profile);redirect(role==="teacher"?"/teacher":"/student")}
