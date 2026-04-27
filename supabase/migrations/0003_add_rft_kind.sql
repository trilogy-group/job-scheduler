-- 0003_add_rft_kind.sql
-- Widen jobs.kind to allow RFT (reinforcement fine-tuning) alongside SFT, DPO.

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('SFT','DPO','RFT'));
