# finetune-queue skill

A Claude Code skill that teaches agents to submit Fireworks fine-tuning jobs through the team's fair-scheduler queue instead of hitting Fireworks or `firectl` directly.

## Install

Copy the skill into your Claude skills directory:

```bash
mkdir -p ~/.claude/skills/finetune-queue
cp .claude/skills/finetune-queue/SKILL.md ~/.claude/skills/finetune-queue/SKILL.md
```

(Or symlink if you'd rather track updates: `ln -s "$(pwd)/.claude/skills/finetune-queue/SKILL.md" ~/.claude/skills/finetune-queue/SKILL.md`)

Then restart Claude Code. The skill will load on next session.

## What your agent needs

- `SUPABASE_URL=https://mteiejqiocldpdaxjmra.supabase.co` (team-wide)
- `SFTQ_API_KEY=sftq_...` (per person — ask Anirudh for yours)

Both should live in your shell env or `.env`. Never commit the key.

## What the skill does

When an agent is about to create, cancel, or check a Fireworks SFT/DPO job, the skill gets triggered and briefs the agent on:
- Which HTTP endpoints to call
- The exact request shapes
- Rules it must NOT violate (no direct `firectl` for fine-tuning, no direct Fireworks API)
- State semantics and troubleshooting

See `SKILL.md` for the full contents.
