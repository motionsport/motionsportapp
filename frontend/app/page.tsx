import { cookies } from "next/headers";
import SchedulePage from "./SchedulePage";
import { ROLE_COOKIE } from "@/lib/roleRoutes";

// The members' schedule and the visitors' landing. proxy.ts has already sent a trainer or the owner home,
// so only a member's role cookie means signed in
export default async function Home() {
  const signedIn = (await cookies()).get(ROLE_COOKIE)?.value === "member";
  return <SchedulePage signedIn={signedIn} />;
}
