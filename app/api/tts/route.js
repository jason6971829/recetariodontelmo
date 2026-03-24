export async function POST(request) {
  const { text, speed } = await request.json();

  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: "No text provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Limitar texto a 5000 caracteres para no agotar créditos
  const trimmedText = text.slice(0, 5000);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Voz: George (masculina, cálida, narrador) - ideal para Don Telmo
  const voiceId = "JBFqnCBsd6RMkjVDRZzb";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmedText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", err);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400", // Cache 24h
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
