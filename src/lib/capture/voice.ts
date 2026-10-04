import "server-only";

export async function transcribeAudio(audioBuffer: Buffer, mimeType = "audio/m4a"): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    // If no OpenAI key configured, return an indicator that audio was received
    return "Voice message received (transcription requires OpenAI API key configured).";
  }

  try {
    const formData = new FormData();
    const extension = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : mimeType.includes("ogg") ? "ogg" : "m4a";
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, `audio.${extension}`);
    formData.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[voice] whisper error", errText);
      return "Could not transcribe audio recording.";
    }

    const json = (await res.json()) as { text?: string };
    return json.text?.trim() || "No speech detected in audio.";
  } catch (error) {
    console.error("[voice] transcription failed", error);
    return "Could not transcribe audio recording.";
  }
}
