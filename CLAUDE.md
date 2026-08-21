# Immigration Law Intelligence Machine

## Architecture
This is a Node.js + TypeScript script that runs daily via GitHub Actions.
No frontend. No Next.js. Pure pipeline: scrape → deduplicate → Claude → Supabase → Slack.

## Full build guide
All file contents and build steps are in the interactive HTML guide.

## Stack
- AI: Claude 3.5 Haiku (claude-3-5-haiku-20241022) via @anthropic-ai/sdk
- DB: Supabase (PostgreSQL) — deduplication + storage
- Notifications: Slack Block Kit via Incoming Webhook
- Scheduling: GitHub Actions cron (03:00 UTC = 06:00 Istanbul)

## File build order (critical — each imports from previous)
1. src/types.ts
2. src/sources.ts
3. src/hasher.ts
4. src/supabase.ts
5. src/anthropic.ts
6. src/prompts.ts
7. src/parser.ts
8. src/slack.ts
9. src/index.ts

## Hard rules
- Temperature 0 on all Claude calls (deterministic JSON output)
- Max 800 tokens per Claude response
- Process in parallel batches of 3 with 2s delay between batches
- ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY are never logged
- After each file: run npm run typecheck before moving to next
- model: always "claude-3-5-haiku-20241022"
- processed_by field value: "claude-3-5-haiku-20241022"