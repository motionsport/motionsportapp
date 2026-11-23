import { BurgerMenu } from "@/components/ui/BurgerMenu";

const LINKS = [
  { href: "/admin", label: "Панель тренера" },
  { href: "/admin/clients", label: "Клієнти" },
  { href: "/admin/calendar", label: "Календар" },
  { href: "/admin/schedule", label: "Розклад групових" },
  { href: "/admin/history", label: "Історія" },
  { href: "/admin/stats", label: "Статистика" },
  { href: "/admin/prices", label: "Ціни" },
  { href: "/admin/password", label: "Мій пароль" },
];

export function AdminMenu() {
  return <BurgerMenu links={LINKS} />;
}
