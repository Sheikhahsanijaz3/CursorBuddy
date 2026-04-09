/**
 * TTS Service
 *
 * Text-to-speech via ElevenLabs or Cartesia.
 * Returns audio data (Buffer) that the renderer plays via Web Audio.
 */

// ── ElevenLabs ────────────────────────────────────────────

async function elevenLabsSpeak(text, settings) {
  const apiKey = settings.elevenlabsKey;
  if (!apiKey) throw new Error("ElevenLabs API key not configured");

  const voiceId = settings.voiceId || "21m00Tcm4TlvDq8ikWAM";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { audioData: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}

// ── Cartesia ──────────────────────────────────────────────

async function cartesiaSpeak(text, settings) {
  const apiKey = settings.cartesiaKey;
  if (!apiKey) throw new Error("Cartesia API key not configured");

  const voiceId = settings.cartesiaVoiceId || "d86c3a72-2a34-4db2-b49e-c693e8c4ae98";

  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: text,
      voice: { mode: "id", id: voiceId },
      output_format: { container: "mp3", encoding: "mp3" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cartesia HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { audioData: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}

// ── Public API ────────────────────────────────────────────

async function speak(text, settings) {
  const provider = settings.ttsProvider || "elevenlabs";
  if (!text || !text.trim()) return null;

  switch (provider) {
    case "elevenlabs":
      return elevenLabsSpeak(text, settings);
    case "cartesia":
      return cartesiaSpeak(text, settings);
    default:
      throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

module.exports = { speak };
