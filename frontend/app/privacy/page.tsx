import { PageLayout } from "@/components/ui/PageLayout";

// Who processes the data: the gym's ФОП, as in TRANSFER_RECIPIENT (the account for transfers)
const OWNER = "ФОП Тест Тренер";

const SECTION = "font-geologica font-semibold text-heading uppercase mb-2 mt-6";

// What the law asks to tell a person when their data is collected (Закон «Про захист персональних даних», ст. 12):
// who, what, why, to whom, their rights. Public: it is linked under «Зареєструватись» and on the invite.
// Static, like «Графік і адреса»
export default function PrivacyPage() {
  return (
    <PageLayout variant="top">
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Політика конфіденційності
      </h1>
      <div className="text-body text-base space-y-3">
        <h2 className={SECTION}>Хто обробляє дані</h2>
        <p>{OWNER}, спортзал Motion Gym, Ірпінь, вулиця Лісова, 4т.</p>

        <h2 className={SECTION}>Які дані</h2>
        <p>
          Ім&apos;я, яке ви вказали, ваші записи на тренування і відвідування, причини скасувань, покупки й оплати.
          Телефон, пошту і дані банківської картки застосунок не зберігає.
        </p>

        <h2 className={SECTION}>Навіщо</h2>
        <p>
          Щоб ви могли записуватися на тренування, купувати абонемент і пакети та отримувати сповіщення. Дані не
          використовуються для реклами і не продаються.
        </p>

        <h2 className={SECTION}>Хто їх бачить</h2>
        <p>
          Ваш тренер і власник залу. Дані зберігаються на серверах хостингу (Vercel) і бази даних (Neon); оплату карткою
          онлайн обробляє платіжний сервіс.
        </p>

        <h2 className={SECTION}>Ваші права</h2>
        <p>
          Ви можете дізнатися, які дані про вас зберігаються, виправити або видалити їх. Для цього скажіть своєму
          тренеру.
        </p>
      </div>
    </PageLayout>
  );
}
