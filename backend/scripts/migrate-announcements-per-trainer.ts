import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

// One-off (2026-11-25, docs/design/specs/2026-11-25-announcement-per-trainer-design.md), the "expand" step:
// run before the deploy and once more after it, then `npm run db:push` (NOT NULL, drops the old UNIQUE on
// training_day_id and the column `topic`). Safe to re-run. Delete this file once db:push is done.
// Existing announcements and examples go to the first trainer, and so does the old weekly programme.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const first = await pool.query<{ id: string }>('select id from admins order by created_at limit 1');
  const firstId = first.rows[0]?.id;
  if (!firstId) throw new Error('No trainer yet');

  await pool.query(`
    alter table announcements add column if not exists trainer_id uuid;
    alter table announcement_examples add column if not exists trainer_id uuid;
  `);
  // Rows the old code wrote meanwhile have none: that is why the script runs again after the deploy
  const ann = await pool.query('update announcements set trainer_id = $1 where trainer_id is null', [firstId]);
  const ex = await pool.query('update announcement_examples set trainer_id = $1 where trainer_id is null', [firstId]);

  await pool.query(`
    do $$ begin
      alter table announcements add constraint announcements_trainer_id_admins_id_fk
        foreign key (trainer_id) references admins(id);
    exception when duplicate_object then null; end $$;
    do $$ begin
      alter table announcement_examples add constraint announcement_examples_trainer_id_admins_id_fk
        foreign key (trainer_id) references admins(id);
    exception when duplicate_object then null; end $$;
    create unique index if not exists announcements_day_trainer_idx on announcements (training_day_id, trainer_id);
    create index if not exists announcement_examples_trainer_idx on announcement_examples (trainer_id);

    create table if not exists trainer_schedule_topics (
      trainer_id uuid not null,
      weekday integer not null,
      topic text not null,
      constraint trainer_schedule_topics_trainer_id_weekday_pk primary key (trainer_id, weekday),
      constraint trainer_schedule_topics_trainer_id_admins_id_fk foreign key (trainer_id) references admins(id),
      constraint trainer_schedule_topics_weekday_check check (weekday between 1 and 7),
      constraint trainer_schedule_topics_topic_check check (char_length(topic) between 1 and 60)
    );
  `);
  // The gym's programme, from the code before (WEEKLY_TOPICS), becomes the first trainer's
  const topics = await pool.query(
    `insert into trainer_schedule_topics (trainer_id, weekday, topic)
     values ($1, 1, 'ноги'), ($1, 3, 'кругове тренування'), ($1, 5, 'руки')
     on conflict do nothing`,
    [firstId],
  );

  console.log(
    `First trainer ${firstId}: announcements ${ann.rowCount}, examples ${ex.rowCount}, topics added ${topics.rowCount}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
