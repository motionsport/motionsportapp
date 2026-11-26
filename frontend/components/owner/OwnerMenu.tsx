import { BurgerMenu } from "@/components/ui/BurgerMenu";

const LINKS = [
  { href: "/owner", label: "Статистика залу" },
  { href: "/owner/prices", label: "Ціни" },
  { href: "/owner/trainers", label: "Тренери" },
  { href: "/owner/clients", label: "Клієнти" },
  { href: "/owner/password", label: "Мій пароль" },
];

export function OwnerMenu() {
  return <BurgerMenu links={LINKS} />;
}
