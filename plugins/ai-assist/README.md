# AI Assist (`ai-assist`)

First-party ReactPress plugin for **5.0 Intelligent**:

- Bring your own API Key (OpenAI-compatible)
- Skills: write / organize / polish / pre-review
- **Agent** chat (streaming) for conversational drafting
- Draft-only writes; **human Approve** under All Posts → Pending review publishes

## Setup

1. New installs activate **AI Assist** automatically. Existing sites: Admin → Plugins → install & activate
2. Open plugin settings → paste API Key, model, base URL → **Test connection**
3. Posts → **New Article** → **Agent** (right chat panel), or editor sidebar Skill actions
4. **All Posts** → **Pending review** → Compare, then publish now or schedule

Core API: `/api/ai/*` (JWT admin). Agent stream: `POST /api/ai/agent/chat` (SSE).
