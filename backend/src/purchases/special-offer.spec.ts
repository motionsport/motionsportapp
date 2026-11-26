import { specialOfferFor } from './special-offer';

// Each awaited read takes the next result
function makeDb(results: unknown[][]) {
  const queue = [...results];
  const chain: any = {
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(queue.shift() ?? []).then(resolve, reject),
  };
  for (const m of ['from', 'where', 'limit']) chain[m] = jest.fn(() => chain);
  return { select: jest.fn(() => chain) } as any;
}

const GIFT = { id: 'gift', code: 'club_single', section: 'club_card', trainingCount: null };
const P1 = { id: 'p1', code: 'personal_1', section: 'assigned', trainingCount: 1 };
const S1 = { id: 's1', code: 'split_1', section: 'assigned', trainingCount: 1 };
const P8 = { id: 'p8', code: 'personal_8', section: 'assigned', trainingCount: 8 };
const CARD = { id: 'c', code: 'club_full_1m', section: 'club_card', trainingCount: null };

describe('specialOfferFor', () => {
  it('a new client gets the single personal and split trainings, not the packages', async () => {
    await expect(specialOfferFor(makeDb([[], [], [GIFT, CARD, P1, S1, P8]]), 'm1')).resolves.toEqual({
      serviceIds: ['p1', 's1'],
    });
  });

  it('none once the client had a club card (a reception one too)', async () => {
    await expect(specialOfferFor(makeDb([[{ id: 'card' }]]), 'm1')).resolves.toBeNull();
  });

  it('none once the client had a package', async () => {
    await expect(specialOfferFor(makeDb([[], [{ id: 'pack' }]]), 'm1')).resolves.toBeNull();
  });

  it('none when the price list has no single gym visit', async () => {
    await expect(specialOfferFor(makeDb([[], [], [CARD, P1]]), 'm1')).resolves.toBeNull();
  });
});
