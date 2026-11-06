# Повернення 50% через LiqPay однією кнопкою: план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** тренер тренування натискає «Повернути» в «Повернути гроші», і застосунок сам один раз надсилає LiqPay запит на часткове повернення, без шансу повернути двічі.

**Architecture:** рядок `cancel_refunds` проходить `DUE → SENDING → DONE` (або назад у `DUE` при явній відмові); перехід у `SENDING` compare-and-set і є ключем ідемпотентності, запит у LiqPay надсилає лише переможець і лише раз. Результат з'ясовують відповідь refund API, callback `reversed` і кнопка «Перевірити» (status API), усі через compare-and-set з `SENDING`. Логіка в новому `CancelRefundsService`; рішення за відповіддю LiqPay у чистих функціях; підтвердження з callback у plain function, щоб `PaymentModule` не імпортував `PurchasesModule`.

**Tech Stack:** NestJS 11, Drizzle (Neon), Jest; Next.js 16, Vitest.

**Spec:** `docs/design/specs/2026-11-06-cancel-refund-liqpay-design.md`

## Global Constraints

- UI: без слова «LiqPay» (кажемо «кабінет оплат»), без довгого тире, без `gap-*`; кнопки з `type`, помилки `role="alert"`, підтвердження через `components/ui/Modal.tsx`.
- Помилки, які бачить людина: код у `API_ERRORS` (`backend/src/common/api-error.ts`) + текст у `ERROR_TEXT` (`frontend/lib/apiErrors.ts`), тест звіряє списки.
- LiqPay: лише `result === 'ok'` змінює стан; логувати безпечний набір полів (`LOGGED_LIQPAY_FIELDS`), без імен, телефонів, масок карт; префікс логів `Refund:`.
- Запит refund: `{ version: 3, public_key, action: 'refund', order_id, amount }`, підпис `liqpaySign` (sha1, як status API), таймаут 10 с.
- HTTP до LiqPay ніколи всередині DB-транзакції.
- `ClockService.now()` для часу; ідентифікатори в маршрутах через `ParseUUIDPipe`.

## Review Focus

1. Відповідь LiqPay загубилась (таймаут) → рядок лишається `SENDING`, повторне «Повернути» не надсилає вдруге (Task 3 тест `does not send again while SENDING`).
2. Callback `reversed` прийшов раніше за відповідь refund API → DONE ставить callback, пізня відповідь нічого не змінює (Task 3 `late response after callback changes nothing`, Task 4).
3. З оплати вже повертали в кабінеті (як 425 ₴ 04.11) → запит не йде (Task 3 `refuses when the order already has a refund the app did not make`).
4. «Не списувати» під час `SENDING` → 409 `REFUND_IN_PROGRESS` (Task 5).
5. Інший тренер (не тренер тренування) відкриває / натискає → 404 (Task 3 `another trainer gets 404`).

---

### Task 1: Схема, міграція, коди помилок

**Files:**
- Modify: `backend/src/database/schema.ts` (`cancelRefunds`, ~589)
- Modify: `backend/src/common/api-error.ts`, `frontend/lib/apiErrors.ts`

**Interfaces:**
- Produces: колонки `cancelRefunds.trainerId` (uuid NOT NULL → admins, `index('cancel_refunds_trainer_id_idx')`), `paymentId` (uuid → payments), `expectedRefundedUah` (integer), `sentAt` (timestamptz), `sentBy` (uuid → admins), `doneVia` (text, `oneOf('cancel_refunds_done_via_check', 'done_via', ['LIQPAY','CASH','MANUAL'])`), `lastError` (text), `liqpayResponse` (jsonb); статус `oneOf` = `['DUE','SENDING','DONE','CANCELLED']`.
- Produces: коди `REFUND_IN_PROGRESS` ('Refund is in progress'), `REFUNDED_ELSEWHERE` ('Order already has a refund'), `REFUND_DECLINED` ('Refund declined'), `PAYMENT_PROVIDER_UNREACHABLE` ('Payment provider unreachable'), `NOT_ONLINE_PAYMENT` ('Not an online payment').
- Тексти: `REFUND_IN_PROGRESS` «Повернення вже відправлено.», `REFUNDED_ELSEWHERE` «З цієї оплати вже повертали гроші. Перевірте в кабінеті оплат.», `REFUND_DECLINED` «Повернення не прийняли. Спробуйте пізніше або «Не списувати».», `PAYMENT_PROVIDER_UNREACHABLE` «Не вдалося зв'язатися з оплатою. Спробуйте ще раз.», `NOT_ONLINE_PAYMENT` «Ця покупка оплачена готівкою.».

- [ ] **Step 1:** змінити схему й обидва списки кодів.
- [ ] **Step 2:** `cd frontend && npm run test` (тест відповідності кодів) → PASS; `cd backend && npx tsc --noEmit` → без помилок.
- [ ] **Step 3: міграція (тестова БД, до деплою).** У SQL-консолі Neon: `ALTER TABLE cancel_refunds ADD COLUMN trainer_id uuid;` `UPDATE cancel_refunds r SET trainer_id = s.trainer_id FROM bookings b JOIN training_slots s ON s.id = b.slot_id WHERE b.id = r.booking_id;` потім `ALTER TABLE cancel_refunds DROP CONSTRAINT cancel_refunds_status_check, ADD CONSTRAINT cancel_refunds_status_check CHECK (status IN ('DUE','SENDING','DONE','CANCELLED'));` Решту колонок, FK, індекс і NOT NULL додає `npm run db:push` **після деплою коду** (старий код вставляє рядки без `trainer_id`). Перевірити `pg_get_constraintdef` для `cancel_refunds_status_check`.
- [ ] **Step 4: Commit** `feat(refunds): schema and error codes for LiqPay refunds`

### Task 2: LiqPay refund helper і правила відповіді

**Files:**
- Modify: `backend/src/payment/liqpay.helper.ts`
- Create: `backend/src/purchases/cancel-refund-rules.ts`, `backend/src/purchases/cancel-refund-rules.spec.ts`

**Interfaces:**
- Produces: `liqpayRefund(publicKey: string, privateKey: string, orderId: string, amount: number, timeoutMs = 10000): Promise<Record<string, unknown>>` (кидає на мережі / таймауті / не 200, як `liqpayStatus`).
- Produces: `refundOutcome(resp: Record<string, unknown>): 'DONE' | 'DECLINED' | 'UNKNOWN'`; `refundedSoFar(status: Record<string, unknown>): number` (`Number(refund_amount) || 0`, лише при `result === 'ok'`, інакше кидає); `precheckError(o: { baseline: number; appRefunded: number; paymentAmount: number; amount: number }): 'REFUNDED_ELSEWHERE' | null`.

- [ ] **Step 1: тести** (`cancel-refund-rules.spec.ts`):
  - `refundOutcome({result:'ok',status:'reversed'})` → `'DONE'`; `{result:'error'}` → `'DECLINED'`; `{result:'ok',status:'failure'}` і `status:'error'` → `'DECLINED'`; `{result:'ok',status:'processing'}` і `{}` → `'UNKNOWN'`.
  - `precheckError({baseline:425, appRefunded:0, paymentAmount:850, amount:300})` → `'REFUNDED_ELSEWHERE'`; `{baseline:0, appRefunded:0, paymentAmount:850, amount:300}` → `null`; `{baseline:300, appRefunded:300, paymentAmount:850, amount:300}` → `null`; `{baseline:0, appRefunded:0, paymentAmount:250, amount:300}` → `'REFUNDED_ELSEWHERE'` (сума більша за залишок).
- [ ] **Step 2:** `cd backend && npx jest cancel-refund-rules` → FAIL (модуля немає).
- [ ] **Step 3:** реалізувати. `precheckError`: `baseline > appRefunded || baseline + amount > paymentAmount`.
- [ ] **Step 4:** `npx jest cancel-refund-rules` → PASS.
- [ ] **Step 5: Commit** `feat(refunds): LiqPay refund request and response rules`

### Task 3: CancelRefundsService і маршрути

**Files:**
- Create: `backend/src/purchases/cancel-refunds.service.ts`, `backend/src/purchases/cancel-refunds.spec.ts`
- Modify: `backend/src/purchases/admin-purchases.controller.ts` (маршрути `cancel-refunds/*` → новий сервіс), `admin-purchases.service.ts` (прибрати `pendingCancelRefunds`, `markCancelRefundDone` та їх тести з `admin-purchases.spec.ts`), `purchases.module.ts` (provider)

**Interfaces:**
- Consumes: Task 1 колонки й коди; Task 2 `liqpayRefund`, `liqpayStatus`, `refundOutcome`, `refundedSoFar`, `precheckError`.
- Produces: `CancelRefundsService` (`DatabaseService`, `ClockService`):
  - `pending(trainerId): Promise<CancelRefundView[]>` — `trainer_id = trainerId`, статуси `DUE` | `SENDING`, старі першими. `CancelRefundView` = теперішні поля + `bookingId`, `status`, `liqpayPaymentId` (оплаченого платежу покупки), `lastError`.
  - `refund(trainerId, id): Promise<{ status: 'DUE' | 'SENDING' | 'DONE' }>`
  - `check(trainerId, id): Promise<{ status: 'SENDING' | 'DONE' }>`
  - `markDone(trainerId, id): Promise<{ ok: true }>`
- Маршрути (`AdminGuard`, `ParseUUIDPipe`): `GET /admin/cancel-refunds/pending`, `POST /admin/cancel-refunds/:id/refund`, `POST /admin/cancel-refunds/:id/check`, `POST /admin/cancel-refunds/:id/done`.

Поведінка `refund` (порядок важливий):
1. Рядок з `trainer_id = trainerId`, інакше 404. Покупка `CASH` → 400 `NOT_ONLINE_PAYMENT`. `SENDING` / `DONE` → повернути `{status}` без запиту (ідемпотентність). `CANCELLED` → 404 (повертати нічого).
2. Compare-and-set `DUE → SENDING` (`sent_at`, `sent_by`, `payment_id` = платіж покупки зі статусом PAID, `last_error = null`). Не виграв → прочитати й повернути поточний `{status}`, без запиту.
3. `liqpayStatus` по `order_id`; мережа або `result !== 'ok'` → compare-and-set `SENDING → DUE`, `last_error = 'PAYMENT_PROVIDER_UNREACHABLE'`, 409 з цим кодом. `baseline = refundedSoFar(...)`, `appRefunded` = сума `amount_uah` рядків цієї покупки з `done_via = 'LIQPAY'`. `precheckError` → назад у `DUE`, `last_error`, 409 `REFUNDED_ELSEWHERE`.
4. Зберегти `expected_refunded_uah = baseline + amount_uah` (where `status = 'SENDING'`), потім `liqpayRefund`.
5. Безпечний набір полів відповіді → `liqpay_response`. `refundOutcome`: `DONE` → compare-and-set `SENDING → DONE` (`done_via 'LIQPAY'`, `done_at`, `done_by`); `DECLINED` → `SENDING → DUE`, `last_error = 'REFUND_DECLINED'` (`err_code` у лог), 409 `REFUND_DECLINED`; виняток (таймаут / мережа) або `UNKNOWN` → лишити `SENDING`, повернути `{status:'SENDING'}`.

`check`: лише `SENDING` (інакше поточний `{status}`); `liqpayStatus`; `refundedSoFar >= expected_refunded_uah` → compare-and-set у `DONE` (`done_via 'LIQPAY'`); недоступний → `{status:'SENDING'}`. Ніколи не надсилає refund.

`markDone`: `CASH` з `DUE` → `DONE`, `done_via 'CASH'`; онлайн з `SENDING` → `DONE`, `done_via 'MANUAL'`; онлайн з `DUE` → 400 без коду ('Send the refund first'; кнопки в UI немає, це лише захист); уже `DONE` → 409 `MONEY_RETURNED`.

- [ ] **Step 1: тести** (`cancel-refunds.spec.ts`, chain-mock як у `admin-purchases.spec.ts`, `jest.mock('../payment/liqpay.helper')`):
  - `sends one refund for the half and marks it DONE` — відповідь `{result:'ok',status:'reversed'}`: `liqpayRefund` викликано один раз з `(…, 'mg-1', 300)`, серед `sets` є `{status:'DONE', doneVia:'LIQPAY'}`.
  - `does not send again while SENDING` — compare-and-set повертає `[]`, поточний статус `SENDING`: результат `{status:'SENDING'}`, `liqpayRefund` не викликано.
  - `keeps SENDING when the response is lost` — `liqpayRefund` кидає: `{status:'SENDING'}`, немає `set` з `status:'DUE'`.
  - `goes back to DUE when LiqPay declines` — `{result:'error', err_code:'x'}`: 409 з `code:'REFUND_DECLINED'`, є `{status:'DUE', lastError:'REFUND_DECLINED'}`.
  - `refuses when the order already has a refund the app did not make` — status `{result:'ok', refund_amount:425}`, `appRefunded` 0: 409 `REFUNDED_ELSEWHERE`, `liqpayRefund` не викликано.
  - `status API down: back to DUE, nothing sent` — `liqpayStatus` кидає: 409 `PAYMENT_PROVIDER_UNREACHABLE`, `liqpayRefund` не викликано.
  - `late response after callback changes nothing` — відповідь `reversed`, але compare-and-set `SENDING → DONE` повертає `[]`: без винятку, `{status:'DONE'}`.
  - `another trainer gets 404` — вибірка за `trainer_id` порожня → `NotFoundException`.
  - `cash purchase cannot be refunded online` → 400 `NOT_ONLINE_PAYMENT`.
  - `check marks DONE once refund_amount reaches the expected total` (`expected 300`, `refund_amount 300`) і `check never sends a refund` (`liqpayRefund` не викликано, `refund_amount 0` → `{status:'SENDING'}`).
  - `markDone: cash DUE → CASH, online SENDING → MANUAL, online DUE → 400`.
- [ ] **Step 2:** `npx jest cancel-refunds` → FAIL.
- [ ] **Step 3:** реалізувати сервіс, перенести маршрути, оновити модуль.
- [ ] **Step 4:** `npx jest cancel-refunds admin-purchases` → PASS.
- [ ] **Step 5: Commit** `feat(refunds): one-tap LiqPay refund with compare-and-set`

### Task 4: Callback `reversed` підтверджує повернення

**Files:**
- Create: `backend/src/purchases/cancel-refund.store.ts`
- Modify: `backend/src/payment/payment.service.ts` (`handleCallback`, гілка `reversed`, ~191), `payment.service.spec.ts`

**Interfaces:**
- Produces: `confirmRefundsFromCallback(db: Db, purchaseId: string, refundAmount: number, at: Date): Promise<number>` — `UPDATE cancel_refunds SET status='DONE', done_via='LIQPAY', done_at=at WHERE purchase_id = … AND status='SENDING' AND expected_refunded_uah <= refundAmount RETURNING id`, повертає кількість.

- [ ] **Step 1: тест** у `payment.service.spec.ts` (опис `refund of a paid payment`): `reversed` з `refund_amount: 300` на PAID-оплату → збережено `refundCallback` (як зараз) **і** є update `cancel_refunds` з `status:'DONE', doneVia:'LIQPAY'`; payment і purchase статуси не змінено.
- [ ] **Step 2:** `npx jest payment.service` → FAIL.
- [ ] **Step 3:** реалізувати; лог `Refund: callback order=… refund_amount=… confirmed=N`.
- [ ] **Step 4:** `npx jest payment.service` → PASS.
- [ ] **Step 5: Commit** `feat(refunds): reversed callback confirms a sent refund`

### Task 5: Тренер тренування: запис, пуш, «Не списувати», вимкнення

**Files:**
- Modify: `backend/src/booking/booking.service.ts` (`cancel` ~138, `chargeLateCancel` ~285, `notifyTrainer` ~431), `backend/src/notifications/notification.service.ts` (`sendMemberCancelled`), `backend/src/admin/admin-attendance.service.ts` (`waiveCancelFee` ~57), `backend/src/admin/admin-trainers.service.ts` (`disableTrainer`, поруч з переносом готівкових покупок ~99)
- Test: `booking.service.spec.ts` (або де тести пізнього скасування), `admin-assigned-slots.spec.ts` (waive, ~874), `admin-trainers` spec, `notification.service.spec.ts`

**Interfaces:**
- `chargeLateCancel(tx, bookingId, memberId, trainingType, localDate, slotTime, trainerId): Promise<number | null>` — вставляє `trainerId` у `cancel_refunds`, повертає суму повернення (або `null`).
- `MEMBER_CANCELLED` payload отримує `refundUah: number | null`; тіло пушу при сумі: `${displayName}: ${reason}\nПовернути ${refundUah} ₴: Клієнти`.

- [ ] **Step 1: тести:**
  - пізнє скасування разового персонального 2-24 год вставляє `cancel_refunds` з `trainerId` = тренер слота і передає `refundUah: 300` у `MEMBER_CANCELLED`.
  - `sendMemberCancelled` з `refundUah: 300` → тіло закінчується на `Повернути 300 ₴: Клієнти`; з `null` тіло як зараз.
  - `waiveCancelFee` з `refundStatus: 'SENDING'` → 409 `REFUND_IN_PROGRESS`, `syncSpend` не викликано; новий тренер після вимкнення (`cancel_refunds.trainer_id = adminId`, слот чужий) може пробачити.
  - `disableTrainer` оновлює `cancel_refunds` `{trainerId: transferToId}` для `DUE` і `SENDING` старого тренера.
- [ ] **Step 2:** `npx jest booking admin notification` → нові тести FAIL.
- [ ] **Step 3:** реалізувати. У `waiveCancelFee`: вибірка дозволяє `trainingSlots.trainerId = adminId OR cancelRefunds.trainerId = adminId`; `refundStatus === 'SENDING'` → 409 `REFUND_IN_PROGRESS` до транзакції; compare-and-set `DUE → CANCELLED` лишається.
- [ ] **Step 4:** `cd backend && npm run test` → усе PASS.
- [ ] **Step 5: Commit** `feat(refunds): the training's trainer owns the refund`

### Task 6: «Повернути гроші» в адмінці

**Files:**
- Modify: `frontend/lib/apiTypes.ts` (`CancelRefund`), `frontend/lib/api.ts` (~179), `frontend/app/admin/clients/CancelRefunds.tsx`

**Interfaces:**
- Consumes: Task 3 маршрути й `CancelRefundView`.
- `CancelRefund` + `bookingId: string; status: "DUE" | "SENDING"; liqpayPaymentId: string | null; lastError: string | null`.
- `api.refundCancelRefund(id) → post<{status: "DUE" | "SENDING" | "DONE"}>(\`/admin/cancel-refunds/${id}/refund\`)`, `api.checkCancelRefund(id)` (`/check`), `api.markCancelRefundDone(id)` (є), `api.waiveCancelFee(bookingId)` (є).

Картка за станом (тексти точні):
- онлайн `DUE`: «Повернути {formatUah}» (`btn-primary`) → `Modal` `variant="sheet"`: «Повернути {сума} на картку, якою платив(ла) {displayName}?» з кнопками «Повернути» / «Скасувати» (`canDismiss={false}` під час запиту); і «Не списувати» (вторинна).
- `SENDING`: «Повертаємо {сума}…», «Перевірити», «Повернено (перевірила в кабінеті)»; дрібно «Платіж {liqpayPaymentId}. Якщо довго, знайдіть його в кабінеті оплат → Повернення.»
- готівка `DUE`: «Віддала {сума}» і «Не списувати»; підпис «оплачено готівкою: віддайте в руки».
- `lastError` під карткою: `ERROR_TEXT[lastError]`, `role="alert"`; помилка дії через `errorText(err, "Не вдалося зберегти. Оновіть сторінку й спробуйте ще раз.")`.
- Після будь-якої дії `onDone()` (reload).
- Пояснення під заголовком: «Клієнт скасував разове тренування менш ніж за добу: поверніть половину ціни або не списуйте.»

- [ ] **Step 1:** реалізувати.
- [ ] **Step 2:** `cd frontend && npm run lint && npx tsc --noEmit && npm run test && npm run format` → без помилок.
- [ ] **Step 3: Commit** `feat(refunds): refund and waive buttons on «Повернути гроші»`

### Task 7: Документація і перевірка в тестовому режимі

**Files:**
- Modify: `CLAUDE.md` (Late cancellation, LiqPay rules: пункт «Refund of a paid payment»; `PurchasesModule` маршрути cancel-refunds)

- [ ] **Step 1:** `CLAUDE.md`: «The app never sends money» → тренер тренування натискає «Повернути», `DUE → SENDING` compare-and-set, один refund-запит на рядок, ніколи не повторюється; `reversed` callback / «Перевірити» → DONE; «Повернено (перевірила в кабінеті)» для завислого; «Не списувати» лише в `DUE`; рядки переходять при вимкненні тренера. Прибрати «There are no refunds in the app yet» там, де це вже не так (повні повернення покупки й далі не обробляються).
- [ ] **Step 2: деплой і `db:push`** (після деплою коду): перевірити, що список змін лише нові колонки / FK / індекс / NOT NULL `trainer_id` (плюс відомі шумові `slot_members`, `trainer_schedule_times`, `activate_by`).
- [ ] **Step 3: тестовий режим, вручну** (ключі `sandbox_`): разове персональне, оплата карткою, пізнє скасування 2-24 год → у «Повернути гроші» «Повернути 300 ₴» → у кабінеті «Повернення» 300 ₴ з цього платежу; у `cancel_refunds` `DONE`, `liqpay_response` збережено; callback `reversed` з `refund_amount`. Подвійне натискання з двох вкладок → у кабінеті одне повернення. «Перевірити» на `SENDING` рядку. Одразу перевірити `vercel logs` (живуть ~30 хв): `Refund:` рядки.
- [ ] **Step 4:** записати в `CLAUDE.md` (LiqPay rules) те, що показала перевірка: вигляд відповіді refund API, `wait_amount`, чи приймає sha1 / `version 3`.
- [ ] **Step 5: Commit** `docs: LiqPay refunds from the app`