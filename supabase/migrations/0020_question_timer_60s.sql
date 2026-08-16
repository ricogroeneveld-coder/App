-- 0020 — Question timer: 30s → 60s.
--
-- 30 seconds turned out to be too tight. Players type their question on a
-- phone keyboard, in a second language half the time, and the deadline starts
-- the moment the previous turn resolves — not when the asker actually looks at
-- the screen. The common failure was a perfectly good question half-typed when
-- the auto-question fired over the top of it.
--
-- The deadline is server-minted (that's the whole point of migration 0012 /
-- 0017: every client counts down against ONE shared value), so the client
-- constant alone is not enough — this has to change in the database too.
--
-- WHY THIS IS A PATCH AND NOT A RE-DECLARATION
-- The interval lives inside function bodies defined across several earlier
-- migrations, and some of those functions have been revised since. Re-pasting
-- a body from 0012/0017 here would silently roll back any later revision. So
-- instead: read each live function's CURRENT definition, rewrite only the
-- question_deadline interval inside it, and CREATE OR REPLACE it back.
-- CREATE OR REPLACE preserves the owner, SECURITY DEFINER, and every grant, so
-- nothing about authorization changes.
--
-- Idempotent: after it runs there is no 30-second question_deadline left to
-- match, so a re-run is a no-op. The word-entry timer (60 seconds) and the
-- chat rate limit are untouched — the pattern is anchored to question_deadline.

do $$
declare
  fn      record;
  src     text;
  patched text;
  n       int := 0;
begin
  for fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind = 'f'
      -- Cheap pre-filter on the raw body, and it keeps pg_get_functiondef away
      -- from C-language functions any extension may have put in public.
      and p.prosrc like '%question_deadline%'
  loop
    src := pg_get_functiondef(fn.oid);

    patched := regexp_replace(
      src,
      '(question_deadline\s*=\s*now\(\)\s*\+\s*interval\s*)''30 seconds''',
      '\1''60 seconds''',
      'g'
    );

    if patched is distinct from src then
      execute patched;
      n := n + 1;
      raise notice '0020: question timer 60s in public.%(%)', fn.proname, fn.args;
    end if;
  end loop;

  raise notice '0020: patched % function(s)', n;
end $$;

-- Fail loudly rather than half-applying: if any function still mints a
-- 30-second question deadline, the client (60s) and the server would disagree
-- and turns would end early depending on which code path minted the deadline.
do $$
declare
  leftover text;
begin
  select string_agg(p.proname, ', ')
    into leftover
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.prokind = 'f'
    and p.prosrc ~ 'question_deadline\s*=\s*now\(\)\s*\+\s*interval\s*''30 seconds''';

  if leftover is not null then
    raise exception '0020: still on a 30s question deadline: %', leftover;
  end if;
end $$;

-- In-flight rooms: anything already counting down on the old timer gets the
-- extra 30 seconds now, instead of one last short turn.
update public.mystery_rooms
   set question_deadline = question_deadline + interval '30 seconds'
 where status = 'playing'
   and question_deadline is not null
   and question_deadline > now();
