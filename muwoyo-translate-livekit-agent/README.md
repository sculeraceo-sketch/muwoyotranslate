# Muwoyo Translate LiveKit Agent

Persistent worker for real-time, bidirectional Connect translation. It is intentionally separate from Supabase Edge Functions because LiveKit audio subscriptions require a long-lived process.

## Architecture

The worker polls Supabase for `connect_sessions.status_v2=active`, joins `livekit_room_name` as `translation-agent-{session_id}`, and creates one independent pipeline per original microphone track:

`microphone track -> silence segmentation -> OpenRouter STT -> OpenRouter translation -> OpenRouter TTS -> LiveKit translated track -> target participant`

Only participant identities in the session row are processed. The worker ignores its own tracks and writes completed events to `connect_messages` using the service role on the server.

## Run locally

```bash
cd muwoyo-translate-livekit-agent
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python agent.py
```

Required secrets are server-side only: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY`. Never add `.env` to source control.

## Docker

```bash
docker build -t muwoyo-translate-agent .
docker run --env-file .env muwoyo-translate-agent
```

The host application must transition the session to `active` only after the Connector has accepted. The worker will not process waiting, paired, inviting, ended, or cancelled sessions.

## Deployment notes

Run at least one persistent replica with network access to LiveKit Cloud and Supabase. Configure the same `LIVEKIT_URL` as the token Edge Function. FFmpeg is used only to decode provider TTS bytes into PCM frames for the LiveKit audio source.
