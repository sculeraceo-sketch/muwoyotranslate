"""Persistent LiveKit worker for active Muwoyo Connect sessions.

The worker is deliberately separate from Supabase Edge Functions because audio
tracks and long-lived WebRTC sessions require a persistent process.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import subprocess
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import httpx
from dotenv import load_dotenv
from livekit import api, rtc

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("muwoyo-agent")


@dataclass(frozen=True)
class Settings:
    livekit_url: str = os.environ["LIVEKIT_URL"]
    livekit_key: str = os.environ["LIVEKIT_API_KEY"]
    livekit_secret: str = os.environ["LIVEKIT_API_SECRET"]
    supabase_url: str = os.environ["SUPABASE_URL"]
    supabase_key: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    openrouter_key: str = os.environ["OPENROUTER_API_KEY"]
    openrouter_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    translation_model: str = os.getenv("OPENROUTER_TRANSLATION_MODEL", "google/gemini-2.5-flash-lite")
    stt_model: str = os.getenv("OPENROUTER_STT_MODEL", "openai/gpt-4o-mini-transcribe")
    tts_model: str = os.getenv("OPENROUTER_TTS_MODEL", "google/gemini-3.1-flash-tts-preview")
    tts_fallback: str = os.getenv("OPENROUTER_TTS_FALLBACK_MODEL", "qwen/qwen-audio-3.0-tts-flash")
    silence_ms: int = int(os.getenv("SILENCE_MS", "650"))
    min_segment_ms: int = int(os.getenv("MIN_SEGMENT_MS", "450"))
    max_segment_ms: int = int(os.getenv("MAX_SEGMENT_MS", "7000"))
    poll_seconds: float = float(os.getenv("AGENT_POLL_SECONDS", "2"))


SETTINGS = Settings()


def headers() -> dict[str, str]:
    return {"apikey": SETTINGS.supabase_key, "Authorization": f"Bearer {SETTINGS.supabase_key}", "Content-Type": "application/json"}


def jwt(identity: str, room: str) -> str:
    token = api.AccessToken(SETTINGS.livekit_key, SETTINGS.livekit_secret).with_identity(identity).with_ttl(600)
    token = token.with_grants(api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True))
    return token.to_jwt()


def rms(frame: rtc.AudioFrame) -> float:
    values = frame.data
    if not values:
        return 0.0
    return sum(abs(value) for value in values) / len(values)


def wav_bytes(pcm: bytes, sample_rate: int, channels: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(channels)
        stream.setsampwidth(2)
        stream.setframerate(sample_rate)
        stream.writeframes(pcm)
    return output.getvalue()


async def openrouter_stt(client: httpx.AsyncClient, audio: bytes, language: str) -> tuple[str, Optional[str]]:
    response = await client.post(f"{SETTINGS.openrouter_url}/audio/transcriptions", headers={"Authorization": f"Bearer {SETTINGS.openrouter_key}"}, files={"file": ("segment.wav", audio, "audio/wav")}, data={"model": SETTINGS.stt_model, "language": language[:2] if len(language) == 2 else ""}, timeout=30)
    response.raise_for_status()
    payload = response.json()
    return str(payload.get("text", "")).strip(), payload.get("language")


async def translate(client: httpx.AsyncClient, text: str, source: str, target: str) -> str:
    response = await client.post(f"{SETTINGS.openrouter_url}/chat/completions", headers={"Authorization": f"Bearer {SETTINGS.openrouter_key}", "Content-Type": "application/json"}, json={"model": SETTINGS.translation_model, "temperature": 0, "messages": [{"role": "system", "content": "You are a professional real-time translation engine. Return only the translation. Do not explain, answer, summarize, or add commentary. Preserve meaning, tone, names, numbers, and intent."}, {"role": "user", "content": f"Translate from {source} to {target}:\n{text}"}]}, timeout=30)
    response.raise_for_status()
    return str(response.json()["choices"][0]["message"]["content"]).strip()


async def openrouter_tts(client: httpx.AsyncClient, text: str, language: str) -> bytes:
    payload = {"model": SETTINGS.tts_model, "input": text, "instructions": f"Speak naturally in {language}.", "response_format": "mp3"}
    for model in (SETTINGS.tts_model, SETTINGS.tts_fallback):
        payload["model"] = model
        response = await client.post(f"{SETTINGS.openrouter_url}/audio/speech", headers={"Authorization": f"Bearer {SETTINGS.openrouter_key}", "Content-Type": "application/json"}, json=payload, timeout=45)
        if response.is_success:
            return response.content
    raise RuntimeError("TTS providers failed")


def mp3_to_pcm(audio: bytes) -> tuple[bytes, int, int]:
    process = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"], input=audio, capture_output=True, check=True)
    return process.stdout, 24000, 1


async def save_event(session_id: str, speaker_id: str, source: str, target: str, original: str, translated: str) -> None:
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{SETTINGS.supabase_url}/rest/v1/connect_messages", headers={**headers(), "Prefer": "return=minimal"}, json={"session_id": session_id, "user_id": speaker_id, "speaker": speaker_id, "source_language": source, "target_language": target, "text": original, "translated_text": translated})
        response.raise_for_status()


async def publish_audio(room: rtc.Room, source: rtc.AudioSource, audio: bytes, sample_rate: int, channels: int) -> None:
    frame_size = int(sample_rate * 0.02)
    samples = memoryview(audio).cast("h")
    for start in range(0, len(samples), frame_size * channels):
        chunk = samples[start:start + frame_size * channels]
        if len(chunk) < frame_size * channels:
            chunk = chunk.tobytes() + b"\x00" * ((frame_size * channels - len(chunk)) * 2)
        frame = rtc.AudioFrame(data=chunk, sample_rate=sample_rate, num_channels=channels, samples_per_channel=frame_size)
        await source.capture_frame(frame)


async def process_segment(room: rtc.Room, output: rtc.AudioSource, session_id: str, speaker_id: str, source: str, target: str, pcm: bytes, sample_rate: int, channels: int) -> None:
    started = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient() as client:
            transcript, detected = await openrouter_stt(client, wav_bytes(pcm, sample_rate, channels), source)
            if not transcript:
                return
            actual_source = detected or source
            translated = await translate(client, transcript, actual_source, target)
            tts = await openrouter_tts(client, translated, target)
        translated_pcm, output_rate, output_channels = mp3_to_pcm(tts)
        await publish_audio(room, output, translated_pcm, output_rate, output_channels)
        await save_event(session_id, speaker_id, actual_source, target, transcript, translated)
        log.info("translation_completed session_id=%s speaker=%s direction=%s->%s latency_ms=%d", session_id, speaker_id, actual_source, target, int((datetime.now(timezone.utc) - started).total_seconds() * 1000))
    except Exception as error:
        log.warning("translation_segment_failed session_id=%s speaker=%s error_type=%s", session_id, speaker_id, type(error).__name__)


async def participant_pipeline(room: rtc.Room, track: rtc.Track, session_id: str, speaker_id: str, source: str, target: str, output: rtc.AudioSource) -> None:
    audio_track = rtc.AudioStream(track)
    chunks: list[bytes] = []
    active_ms = 0
    silence_ms = 0
    sample_rate = 48000
    channels = 1
    async for event in audio_track:
        frame = event.frame
        sample_rate = frame.sample_rate
        channels = frame.num_channels
        frame_ms = int(frame.samples_per_channel * 1000 / frame.sample_rate)
        pcm = bytes(frame.data)
        speaking = rms(frame) > 500
        if speaking:
            chunks.append(pcm)
            active_ms += frame_ms
            silence_ms = 0
        elif chunks:
            chunks.append(pcm)
            silence_ms += frame_ms
            if silence_ms >= SETTINGS.silence_ms or active_ms >= SETTINGS.max_segment_ms:
                segment = b"".join(chunks)
                if active_ms >= SETTINGS.min_segment_ms:
                    asyncio.create_task(process_segment(room, output, session_id, speaker_id, source, target, segment, sample_rate, channels))
                chunks, active_ms, silence_ms = [], 0, 0


async def active_sessions() -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SETTINGS.supabase_url}/rest/v1/connect_sessions?select=id,host_user_id,connector_user_id,participant_a_language,participant_b_language,livekit_room_name,status_v2&status_v2=eq.active", headers=headers(), timeout=15)
        response.raise_for_status()
        return response.json()


async def session_is_active(session_id: str) -> bool:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SETTINGS.supabase_url}/rest/v1/connect_sessions?id=eq.{session_id}&select=status_v2", headers=headers(), timeout=15)
        response.raise_for_status()
        rows = response.json()
        return bool(rows and rows[0].get("status_v2") == "active")


async def run_session(session: dict) -> None:
    session_id = session["id"]
    room = rtc.Room()
    output_tracks: dict[str, rtc.AudioSource] = {}
    pipelines: set[asyncio.Task] = set()
    ended = asyncio.Event()
    agent_identity = f"translation-agent-{session_id}"
    try:
        async def handle_track(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant) -> None:
            if track.kind != rtc.TrackKind.KIND_AUDIO or participant.identity not in (session["host_user_id"], session["connector_user_id"]):
                return
            if participant.identity == session["host_user_id"]:
                source, target, recipient = session["participant_a_language"], session["participant_b_language"], session["connector_user_id"]
            else:
                source, target, recipient = session["participant_b_language"], session["participant_a_language"], session["host_user_id"]
            output = output_tracks.get(recipient)
            if output is None:
                output = rtc.AudioSource(24000, 1)
                translated_track = rtc.LocalAudioTrack.create_audio_track(f"translation-{participant.identity}-to-{recipient}", output)
                await room.local_participant.publish_track(translated_track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE, name=f"translation source={participant.identity} target={recipient} language={target}"))
                output_tracks[recipient] = output
            task = asyncio.create_task(participant_pipeline(room, track, session_id, participant.identity, source, target, output))
            pipelines.add(task)

        room.on("track_subscribed", handle_track)
        await room.connect(SETTINGS.livekit_url, jwt(agent_identity, session["livekit_room_name"]))
        log.info("agent_connected session_id=%s room_name=%s", session_id, session["livekit_room_name"])

        async def monitor_session() -> None:
            while await session_is_active(session_id):
                await asyncio.sleep(SETTINGS.poll_seconds)
            ended.set()

        monitor = asyncio.create_task(monitor_session())
        await ended.wait()
        monitor.cancel()
    except Exception as error:
        log.exception("agent_session_failed session_id=%s error_type=%s", session_id, type(error).__name__)
    finally:
        for task in pipelines:
            task.cancel()
        await room.disconnect()
        log.info("agent_disconnected session_id=%s", session_id)


async def main() -> None:
    running: dict[str, asyncio.Task] = {}
    while True:
        for session in await active_sessions():
            session_id = session["id"]
            if session_id not in running or running[session_id].done():
                running[session_id] = asyncio.create_task(run_session(session))
        await asyncio.sleep(SETTINGS.poll_seconds)


if __name__ == "__main__":
    asyncio.run(main())
