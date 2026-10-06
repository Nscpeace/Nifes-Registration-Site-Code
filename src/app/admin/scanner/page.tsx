import {requireRole} from "@/lib/access";import UsherDesk from "./usher-desk";
export default async function Scanner(){await requireRole(["SUPER_ADMIN","ADMIN","USHER"]);return <main className="wrap page"><a href="/admin">← Dashboard</a><h1>Usher check-in desk</h1><UsherDesk/></main>}
