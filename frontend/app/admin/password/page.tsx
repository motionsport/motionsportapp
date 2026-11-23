import { PageLayout } from "@/components/ui/PageLayout";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { PasswordSection } from "@/components/team/PasswordSection";

// «Мій пароль»: the trainer's own
export default function AdminPasswordPage() {
  return (
    <PageLayout variant="top" action={<AdminMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Мій пароль
      </h1>
      <PasswordSection role="admin" />
    </PageLayout>
  );
}
