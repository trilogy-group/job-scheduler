# finetune-queue (Claude Code plugin)

A Claude Code skill that routes every Fireworks fine-tuning job (SFT + DPO) through the Trilogy team's fair-scheduler queue instead of hitting Fireworks or `firectl` directly.

## Install

The whole `job-scheduler` repository is a Claude Code marketplace. From any Claude Code session:

```
/plugin marketplace add <github-owner>/<github-repo>
/plugin install finetune-queue@job-scheduler
```

Replace `<github-owner>/<github-repo>` with the actual path once this repo is pushed (e.g. `trilogy/job-scheduler`).

After install, restart Claude Code. The `finetune-queue` skill will be available to your agents automatically when they try to create, list, cancel, or monitor Fireworks fine-tuning jobs.

## What the skill does

See [`skills/finetune-queue/SKILL.md`](skills/finetune-queue/SKILL.md). TL;DR:

- Brief agents on the scheduler HTTP API (`POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `DELETE /jobs/:id`).
- Block them from calling `firectl supervised-fine-tuning-job` / `firectl dpoj` or the Fireworks fine-tuning HTTP API directly.
- Document the payload shape, states, and per-user scheduling semantics inline.

## Configuration your agents need

Two env vars on the machine running Claude:

| Variable        | Value                                         |
|-----------------|-----------------------------------------------|
| `SUPABASE_URL`  | `https://mteiejqiocldpdaxjmra.supabase.co`   |
| `SFTQ_API_KEY`  | Your personal `sftq_*` token (ask Anirudh).  |

Put them in your shell profile or `.env`. Never commit `SFTQ_API_KEY`.

## Uninstall

```
/plugin uninstall finetune-queue@job-scheduler
/plugin marketplace remove job-scheduler
```
