import { needsAutoAnnouncement } from './announcements.service';

describe('needsAutoAnnouncement (the booking-open cron, every 15 minutes)', () => {
  it('only an announcement with no text yet is generated and published', () => {
    expect(needsAutoAnnouncement({ text: null })).toBe(true);
    expect(needsAutoAnnouncement({ text: '' })).toBe(true);
  });

  it("the trainer's own doing stays: a draft, an edited text, one taken down, one published", () => {
    expect(needsAutoAnnouncement({ text: 'Сьогодні ноги!' })).toBe(false);
  });

  it('no training day: nothing to make', () => {
    expect(needsAutoAnnouncement(null)).toBe(false);
  });
});
