"use client";
import { useEffect, useState } from "react";
import { BurgerMenu } from "@/components/ui/BurgerMenu";
import { api } from "@/lib/api";

// «Повернення · 2»: the owner gets no pushes, so the menu says when cash is waiting to be handed back
export function OwnerMenu() {
  const [refunds, setRefunds] = useState(0);
  useEffect(() => {
    api
      .getOwnerRefunds()
      .then((r) => setRefunds(r.length))
      .catch(() => undefined); // the menu works without the count
  }, []);
  return (
    <BurgerMenu
      links={[
        { href: "/owner", label: "Статистика залу" },
        { href: "/owner/refunds", label: refunds > 0 ? `Повернення · ${refunds}` : "Повернення" },
        { href: "/owner/prices", label: "Ціни" },
        { href: "/owner/trainers", label: "Тренери" },
        { href: "/owner/clients", label: "Клієнти" },
        { href: "/owner/password", label: "Мій пароль" },
      ]}
    />
  );
}
