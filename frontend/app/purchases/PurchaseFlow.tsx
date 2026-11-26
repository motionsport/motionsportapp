"use client";
import { useState } from "react";
import { api, AssignedType, CatalogItem, MyPurchases, PurchaseMethod, TransferDetails as Details } from "@/lib/api";
import { submitLiqPay } from "@/lib/liqpay";
import { errorText } from "@/lib/apiErrors";
import { TYPE_LABEL } from "@/lib/trainingTypes";
import { formatUah, groupByTitle, lineName } from "@/lib/prices";
import { TransferDetails } from "@/components/purchases/TransferDetails";
import { buyableServiceTypes } from "./buyable";
import { recommendedCard } from "./recommend";
import { DiscountToggle } from "@/components/discount/DiscountToggle";
import { discountPreview, showDiscountToggle } from "@/lib/reviewDiscount";
import { DISCOUNT_NAME, permanentPreview } from "@/lib/permanentDiscount";

type Step = "service" | "offer" | "club" | "group" | "checkout" | "sent" | "transfer";

// service: a trainer service, plus a club card if the member has none; offer: «Спеціальна пропозиція», one
// single trainer service with a free gym visit (a new client)
export type PurchaseMode = "service" | "card" | "group" | "offer";

const GIFT_LINE = "Разове відвідування залу · подарунок";

function GiftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

const SERVICE_GROUPS: { type: AssignedType; title: string }[] = [
  { type: "personal", title: TYPE_LABEL.personal },
  { type: "split", title: TYPE_LABEL.split },
];

function Option({
  item,
  selected,
  onSelect,
  recommended = false,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between space-x-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        selected ? "border-teal bg-teal/10" : "border-line bg-surface hover:border-muted"
      }`}
    >
      <span className="text-heading">
        {recommended && (
          <span className="text-accent mr-1.5" aria-label="Рекомендовано">
            ★
          </span>
        )}
        {item.optionLabel ?? item.title}
      </span>
      <span className="font-geologica text-heading tabular-nums whitespace-nowrap">{formatUah(item.amountUah)}</span>
    </button>
  );
}

const sectionTitle = "font-geologica font-semibold text-heading uppercase mt-5 mb-2";

// Service → club card (only without one) → checkout → sent. "card" / "group" modes start further in
export function PurchaseFlow({
  data,
  mode = "service",
  startType,
  onClose,
  onCashSent,
}: {
  data: MyPurchases;
  mode?: PurchaseMode;
  startType?: AssignedType;
  onClose: () => void;
  onCashSent: () => void;
}) {
  const first: Step = mode === "card" ? "club" : mode === "group" ? "group" : mode === "offer" ? "offer" : "service";
  const [step, setStep] = useState<Step>(first);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [passId, setPassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transfer, setTransfer] = useState<Details | null>(null);
  const [discountOn, setDiscountOn] = useState(false);
  // Buying through «Спеціальна пропозиція»: the server adds the free gym visit, no club card step
  const [offer, setOffer] = useState(mode === "offer");
  const offerIds = data.specialOffer?.serviceIds ?? [];

  const needsCard = !data.card;
  const service = data.catalog.services.find((s) => s.id === serviceId);
  const club = data.catalog.clubCards.find((c) => c.id === clubId);
  const pass = data.catalog.groupPasses.find((p) => p.id === passId);
  const lines = [club, service, pass].filter((x): x is CatalogItem => !!x);
  const total = lines.reduce((sum, l) => sum + l.amountUah, 0);
  const cashOn = data.methods.cash;
  const noMethod = !data.methods.liqpay && !data.methods.transfer && !cashOn;
  // Review discount: cash or transfer only, so online payment hides while it is applied
  const discount = data.reviewDiscount;
  const priced = [
    ...(club ? [{ section: "club_card", amountUah: club.amountUah }] : []),
    ...(service ? [{ section: "assigned", amountUah: service.amountUah }] : []),
    ...(pass ? [{ section: "group", amountUah: pass.amountUah }] : []),
  ];
  const canDiscount = showDiscountToggle(
    discount?.state,
    priced,
    cashOn || data.methods.transfer,
    data.reviewDiscountPercent,
  );
  const applied = canDiscount && discountOn;
  const preview = discountPreview(priced, data.reviewDiscountPercent);
  const online = data.methods.liqpay && !applied;
  // «Постійна знижка» / «Знижка іменинника» goes on a club card for a period by itself; the backend applies it again
  const permanentUah = permanentPreview(lines, data.permanentDiscount?.percent);
  const payUah = total - permanentUah - (applied ? preview.discountUah : 0);
  // Only types with nothing left (the backend refuses the others): split left still lets the member buy personal
  const buyable = buyableServiceTypes(data.packages);
  const groups = SERVICE_GROUPS.filter((g) => buyable.includes(g.type) && (!startType || g.type === startType));

  const pay = async (method: PurchaseMethod) => {
    setBusy(true);
    setError("");
    try {
      const { checkout, transfer } = await api.createPurchase(
        lines.map((l) => l.id),
        method,
        { applyDiscount: applied && method !== "LIQPAY", specialOffer: offer || undefined },
      );
      if (method === "CASH") {
        setStep("sent");
        setBusy(false);
      } else if (method === "TRANSFER" && transfer) {
        setTransfer(transfer);
        setStep("transfer");
        setBusy(false);
      } else if (checkout && !("status" in checkout)) {
        submitLiqPay(checkout);
      }
    } catch (err) {
      setError(errorText(err, "Не вдалося оформити покупку. Спробуйте ще раз."));
      setBusy(false);
    }
  };

  const back = (to: Step | "close") => (
    <button
      type="button"
      onClick={() => (to === "close" ? onClose() : setStep(to))}
      className="text-subtle text-sm hover:text-body transition-colors mb-4"
    >
      ← Назад
    </button>
  );

  if (step === "sent") {
    return (
      <div>
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-3">Оплата готівкою</h1>
        <p className="rounded-xl border border-teal bg-teal/10 px-4 py-3 text-sm text-accent mb-5">
          {data.hasTrainer ? "Віддайте гроші своєму тренеру на тренуванні." : "Віддайте гроші тренеру в залі."}
        </p>
        <button
          type="button"
          onClick={() => {
            onCashSent();
            onClose();
          }}
          className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors"
        >
          До абонемента й пакетів
        </button>
      </div>
    );
  }

  if (step === "transfer" && transfer) {
    return (
      <div>
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-3">Переказ на рахунок</h1>
        <p className="text-body text-sm mb-4">
          Перекажіть {formatUah(transfer.amountUah)} з будь-якого банку. Тренер підтвердить, коли гроші прийдуть на
          рахунок. Реквізити залишаться на сторінці «Абонемент і пакети».
        </p>
        <TransferDetails transfer={transfer} />
        <button
          type="button"
          onClick={() => {
            onCashSent();
            onClose();
          }}
          className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors mt-5"
        >
          До абонемента й пакетів
        </button>
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <div>
        {back(offer ? "offer" : mode === "group" ? "group" : mode === "card" || needsCard ? "club" : "service")}
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-1">Оплата</h1>
        <p className="text-muted text-xs mb-4">Перевірте, що купуєте</p>
        <div className="rounded-xl border border-line bg-surface px-4 py-2 mb-4">
          {offer && (
            <div className="flex justify-between space-x-3 py-2 border-b border-line text-accent">
              <span>{GIFT_LINE}</span>
              <span className="font-geologica tabular-nums">{formatUah(0)}</span>
            </div>
          )}
          {lines.map((l) => (
            <div key={l.id} className="flex justify-between space-x-3 py-2 border-b border-line">
              <span className="text-body">{lineName(l)}</span>
              <span className="font-geologica text-heading tabular-nums">{formatUah(l.amountUah)}</span>
            </div>
          ))}
          {permanentUah > 0 && data.permanentDiscount && (
            <div className="flex justify-between space-x-3 py-2 border-b border-line text-discount">
              <span>
                {DISCOUNT_NAME[data.permanentDiscount.kind]} {data.permanentDiscount.percent}%
              </span>
              <span className="font-geologica tabular-nums">−{formatUah(permanentUah)}</span>
            </div>
          )}
          <div className="flex justify-between space-x-3 py-2">
            <span className="text-muted">{applied || permanentUah > 0 ? "До сплати" : "Разом"}</span>
            <span className="font-geologica text-heading text-lg tabular-nums">{formatUah(payUah)}</span>
          </div>
        </div>
        {canDiscount && discount && (
          <div className="mb-4">
            <DiscountToggle
              code={discount.code}
              percent={data.reviewDiscountPercent}
              applied={applied}
              onChange={setDiscountOn}
              discountUah={preview.discountUah}
            />
            {applied && data.methods.liqpay && (
              <p className="text-subtle text-xs mt-2">Зі знижкою оплата лише переказом або готівкою.</p>
            )}
          </div>
        )}
        <div className="flex flex-col space-y-2">
          {online && (
            <button
              type="button"
              onClick={() => pay("LIQPAY")}
              disabled={busy}
              className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Завантаження..." : "Оплатити онлайн"}
            </button>
          )}
          {data.methods.transfer && (
            <button
              type="button"
              onClick={() => pay("TRANSFER")}
              disabled={busy}
              className={`${online ? "btn-ghost border" : "btn-primary font-medium"} w-full py-4 rounded-lg text-sm transition-colors disabled:opacity-60`}
            >
              Переказ на рахунок
            </button>
          )}
          {cashOn && (
            <button
              type="button"
              onClick={() => pay("CASH")}
              disabled={busy}
              className="btn-ghost w-full py-4 rounded-lg border text-sm transition-colors disabled:opacity-60"
            >
              Оплатити готівкою
            </button>
          )}
        </div>
        {noMethod && <p className="text-body text-sm">Оплата зараз недоступна. Зверніться до тренера в залі.</p>}
        {error && (
          <p role="alert" className="text-danger text-sm mt-3">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (step === "offer") {
    const offerServices = data.catalog.services.filter((s) => offerIds.includes(s.id));
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            if (mode === "offer") return onClose();
            setOffer(false);
            setStep("service");
          }}
          className="text-subtle text-sm hover:text-body transition-colors mb-4"
        >
          ← Назад
        </button>
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-1">Спеціальна пропозиція</h1>
        <p className="text-muted text-xs mb-4">Разове відвідування залу в подарунок, лише для першої покупки</p>
        <div className="flex flex-col space-y-2">
          {offerServices.map((s) => (
            <Option
              key={s.id}
              item={{ ...s, optionLabel: lineName(s) }}
              selected={s.id === serviceId}
              onSelect={() => setServiceId(s.id)}
            />
          ))}
        </div>
        {service && offerIds.includes(service.id) && (
          <div className="rounded-xl border border-line bg-surface px-4 py-2 mt-4">
            <div className="flex justify-between space-x-3 py-2 border-b border-line">
              <span className="text-body">{lineName(service)}</span>
              <span className="font-geologica text-heading tabular-nums">{formatUah(service.amountUah)}</span>
            </div>
            <div className="flex justify-between space-x-3 py-2 border-b border-line text-accent">
              <span>{GIFT_LINE}</span>
              <span className="font-geologica tabular-nums">{formatUah(0)}</span>
            </div>
            <div className="flex justify-between space-x-3 py-2">
              <span className="text-muted">Разом</span>
              <span className="font-geologica text-heading text-lg tabular-nums">{formatUah(service.amountUah)}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setClubId(null);
            setStep("checkout");
          }}
          disabled={!service || !offerIds.includes(service.id)}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 mt-5"
        >
          Далі
        </button>
      </div>
    );
  }

  if (step === "group") {
    return (
      <div>
        {back("close")}
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-1">Групові тренування</h1>
        <p className="text-muted text-xs mb-4">
          Діє місяць від першого тренування. Якщо не почати протягом 3 місяців від покупки, згорає.
        </p>
        <div className="flex flex-col space-y-2">
          {data.catalog.groupPasses.map((p) => (
            <Option
              key={p.id}
              item={{ ...p, optionLabel: lineName(p) }}
              selected={p.id === passId}
              onSelect={() => setPassId(p.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep("checkout")}
          disabled={!passId}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 mt-5"
        >
          Далі
        </button>
      </div>
    );
  }

  if (step === "club") {
    return (
      <div>
        {back(mode === "card" ? "close" : "service")}
        {mode === "card" ? (
          <>
            <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-3">
              Абонемент (клубна карта)
            </h1>
            <p className="rounded-xl border border-line bg-background px-4 py-3 text-sm text-body mb-2">
              Абонемент почне діяти, коли прийдете в зал. Якщо не прийти протягом 3 місяців від покупки, він згорає.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-3">
              Абонемент у зал (клубна карта)
            </h1>
            <p className="rounded-xl border border-line bg-background px-4 py-3 text-sm text-body mb-2">
              У вас немає діючого абонемента. Він потрібен, щоб займатись у залі, і купується окремо від тренувань.
            </p>
            {data.catalog.clubCards.some((c) => recommendedCard(c, service)) && (
              <p className="text-subtle text-xs mt-3">
                <span className="text-accent">★</span> рекомендовано під ваші тренування
              </p>
            )}
          </>
        )}
        {groupByTitle(data.catalog.clubCards).map((g) => (
          <section key={g.title}>
            <h2 className={sectionTitle}>{g.title}</h2>
            <div className="flex flex-col space-y-2">
              {g.items.map((c) => (
                <Option
                  key={c.id}
                  item={c}
                  selected={c.id === clubId}
                  onSelect={() => setClubId(c.id)}
                  recommended={recommendedCard(c, service)}
                />
              ))}
            </div>
          </section>
        ))}
        <button
          type="button"
          onClick={() => setStep("checkout")}
          disabled={!clubId}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 mt-5"
        >
          Далі
        </button>
      </div>
    );
  }

  return (
    <div>
      {back("close")}
      <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-1">Послуги тренера</h1>
      <p className="text-muted text-xs mb-4">Ціна без урахування вартості абонемента</p>
      {groups.length === 0 && (
        <p className="text-body text-sm">Ще є тренування цього типу: нові можна купити, коли вони закінчаться.</p>
      )}
      {groups.map((g) => (
        <section key={g.type}>
          <h2 className={sectionTitle}>{g.title}</h2>
          <div className="flex flex-col space-y-2">
            {data.catalog.services
              .filter((s) => s.trainingType === g.type)
              .map((s) => (
                <div key={s.id} className="flex flex-col space-y-2">
                  <Option item={s} selected={s.id === serviceId} onSelect={() => setServiceId(s.id)} />
                  {/* A new client picked one training here: the same through the offer gives the gym visit free */}
                  {s.id === serviceId && offerIds.includes(s.id) && (
                    <div className="rounded-xl border border-teal/40 bg-teal/5 px-4 py-3">
                      <span className="flex items-center space-x-2 text-accent font-semibold text-sm">
                        <GiftIcon />
                        <span>Новим клієнтам зал у подарунок</span>
                      </span>
                      <p className="text-subtle text-xs mt-1">
                        Візьміть одне тренування через спеціальну пропозицію: разове відвідування залу безкоштовно,
                        абонемент купувати не треба.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setOffer(true);
                          setStep("offer");
                        }}
                        className="btn-secondary w-full py-2.5 rounded-lg border text-sm transition-colors mt-3"
                      >
                        Взяти спецпропозицію
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
      <button
        type="button"
        onClick={() => {
          setClubId(null);
          setStep(needsCard ? "club" : "checkout");
        }}
        disabled={!serviceId}
        className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 mt-5"
      >
        Далі
      </button>
    </div>
  );
}
