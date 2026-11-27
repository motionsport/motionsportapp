import { ReactNode } from "react";
import { CatalogItem, MyPurchases } from "@/lib/api";
import { formatUah } from "@/lib/prices";
import { TYPE_LABEL_PLURAL } from "@/lib/trainingTypes";
import { buyableServiceTypes } from "./buyable";
import type { PurchaseMode } from "./PurchaseFlow";

const fromPrice = (items: CatalogItem[]) =>
  items.length ? `від ${formatUah(Math.min(...items.map((i) => i.amountUah)))}` : "";

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const PersonIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21c0-4 3-6 7-6s7 2 7 6" />
  </svg>
);
const GroupIcon = () => (
  <svg {...iconProps}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="16" cy="8" r="3" />
    <path d="M2 20c0-3 3-5 6-5s6 2 6 5" />
    <path d="M14 15c3 0 8 1 8 5" />
  </svg>
);
const GiftIcon = () => (
  <svg {...iconProps} width={18} height={18}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </svg>
);
const CardIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

function BuyTile({
  icon,
  title,
  price,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  price: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 rounded-xl border border-line bg-surface p-4 text-left hover:border-subtle transition-colors"
    >
      <span className="block text-accent">{icon}</span>
      <span className="block text-heading font-semibold max-sm:text-[16px] mt-3">{title}</span>
      <span className="block text-subtle text-xs max-sm:text-base mt-0.5">{price}</span>
    </button>
  );
}

// No buying ahead: a tile shows only when nothing of that kind is left (trainer services per type); no tiles, no block
export function BuyBlock({
  data,
  titleClass,
  onBuy,
}: {
  data: MyPurchases;
  titleClass: string;
  onBuy: (mode: PurchaseMode) => void;
}) {
  const hasUnused = (types: string[]) =>
    data.packages.some(
      (p) => types.includes(p.trainingType) && p.left > 0 && (p.state === "waiting" || p.state === "active"),
    );
  const serviceTypes = buyableServiceTypes(data.packages);
  const canBuyService = serviceTypes.length > 0;
  const services = data.catalog.services.filter(
    (s) => s.trainingType && serviceTypes.some((t) => t === s.trainingType),
  );
  // «Спеціальна пропозиція» (new client): first and bright, so «З тренером» steps back to a plain tile
  const offerServices = data.specialOffer ? services.filter((s) => data.specialOffer!.serviceIds.includes(s.id)) : [];
  const offer = offerServices.length > 0;
  const canBuyGroup = !hasUnused(["group"]);
  const canBuyCard = !data.card;
  if (!canBuyService && !canBuyGroup && !canBuyCard) return null;

  return (
    <>
      <h2 className={`${titleClass} pt-3`}>Купити</h2>
      {offer && (
        <div className="rounded-xl bg-teal text-on-teal p-4">
          <span className="flex items-center space-x-2 font-geologica font-bold text-xs uppercase tracking-wide">
            <GiftIcon />
            <span>Спеціальна пропозиція</span>
          </span>
          <span className="block max-sm:text-[16px] mt-2">
            Персональне або спліт-тренування + разове відвідування залу в подарунок
          </span>
          <span className="block text-xs max-sm:text-base mt-1">{fromPrice(offerServices)}</span>
          <button
            type="button"
            onClick={() => onBuy("offer")}
            className="w-full mt-3 py-3 rounded-lg bg-background text-accent font-semibold text-sm hover:text-teal-light transition-colors"
          >
            Отримати подарунок →
          </button>
        </div>
      )}
      {canBuyService && offer && (
        <BuyTile
          icon={<PersonIcon />}
          title="З тренером"
          price={`${serviceTypes.length === 2 ? "Персональні та спліт" : TYPE_LABEL_PLURAL[serviceTypes[0]]} · ${fromPrice(services)}`}
          onClick={() => onBuy("service")}
        />
      )}
      {canBuyService && !offer && (
        <button
          type="button"
          onClick={() => onBuy("service")}
          className="btn-primary w-full rounded-lg p-4 text-left transition-colors"
        >
          <PersonIcon />
          <span className="block font-semibold max-sm:text-[16px] mt-3">З тренером</span>
          <span className="block text-xs max-sm:text-base mt-0.5">
            {serviceTypes.length === 2 ? "Персональні та спліт" : TYPE_LABEL_PLURAL[serviceTypes[0]]} ·{" "}
            {fromPrice(services)}
          </span>
        </button>
      )}
      {(canBuyGroup || canBuyCard) && (
        <div className="flex space-x-3">
          {canBuyGroup && (
            <BuyTile
              icon={<GroupIcon />}
              title="Групові"
              price={fromPrice(data.catalog.groupPasses)}
              onClick={() => onBuy("group")}
            />
          )}
          {canBuyCard && (
            <BuyTile
              icon={<CardIcon />}
              title="Абонемент (клубна карта)"
              price={fromPrice(data.catalog.clubCards)}
              onClick={() => onBuy("card")}
            />
          )}
        </div>
      )}
    </>
  );
}
