import { PageLayout } from "@/components/ui/PageLayout";
import { OwnerMenu } from "@/components/owner/OwnerMenu";
import { PasswordSection } from "@/components/team/PasswordSection";

// «Мій пароль»: the owner's own; a forgotten one is reset by `seed:owner`
export default function OwnerPasswordPage() {
  return (
    <PageLayout variant="top" action={<OwnerMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Мій пароль
      </h1>
      <PasswordSection role="owner" />
    </PageLayout>
  );
}
