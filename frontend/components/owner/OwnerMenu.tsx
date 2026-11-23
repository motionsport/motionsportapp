import { BurgerMenu } from "@/components/ui/BurgerMenu";

const LINKS = [
  { href: "/owner", label: "Статистика залу" },
  { href: "/owner/prices", label: "Ціни" },
];

export function OwnerMenu() {
  return <BurgerMenu links={LINKS} />;
}
