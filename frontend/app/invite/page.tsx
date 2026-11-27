import { InviteFlow } from "./InviteFlow";

// «Запросити нового клієнта»: the client opens the trainer's link /invite?t=…
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { t } = await searchParams;
  return <InviteFlow token={typeof t === "string" ? t : ""} />;
}
