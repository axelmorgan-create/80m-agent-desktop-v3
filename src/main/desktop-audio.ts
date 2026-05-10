import * as fs from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { runHermesPythonJson } from "./desktop-python";

export function writeFloatWav(filePath: string, samples: number[]): void {
  const numSamples = samples.length;
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * 2;
  const fileSize = 36 + dataSize;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(fileSize, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const audioBuf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
    audioBuf.writeInt16LE(Math.round(s * 32767), i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([wavHeader, audioBuf]));
}

export function audioExtensionFromMime(mimeType: string): string {
  if (/ogg/i.test(mimeType)) return ".ogg";
  if (/wav/i.test(mimeType)) return ".wav";
  if (/mpeg|mp3/i.test(mimeType)) return ".mp3";
  if (/mp4|m4a/i.test(mimeType)) return ".m4a";
  return ".webm";
}

export async function transcribeAudioFile(filePath: string): Promise<string> {
  const script = String.raw`
import json
import sys
from tools.transcription_tools import transcribe_audio

result = transcribe_audio(sys.argv[1])
print(json.dumps(result, ensure_ascii=False))
`;
  const result = await runHermesPythonJson(script, [filePath], 180000);
  if (result.success && typeof result.transcript === "string") {
    return result.transcript.trim();
  }
  return "";
}

export async function synthesizeSpeech(text: string): Promise<string> {
  const outputPath = join(
    tmpdir(),
    "80m-voice",
    `tts_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`,
  );
  fs.mkdirSync(dirname(outputPath), { recursive: true });

  const script = String.raw`
import asyncio
import json
import sys

text = sys.argv[1]
output_path = sys.argv[2]

try:
    from tools.tts_tool import text_to_speech_tool
    result = json.loads(text_to_speech_tool(text, output_path))
    if result.get("success") and result.get("file_path"):
        print(json.dumps(result, ensure_ascii=False))
        raise SystemExit(0)
except Exception as exc:
    last_error = str(exc)
else:
    last_error = "Hermes TTS returned no audio"

try:
    import edge_tts
    async def main():
        communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
        await communicate.save(output_path)
    asyncio.run(main())
    print(json.dumps({"success": True, "file_path": output_path, "provider": "edge-fallback"}, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"success": False, "error": f"{last_error}; edge fallback failed: {exc}"}, ensure_ascii=False))
`;
  const result = await runHermesPythonJson(script, [text, outputPath], 90000);
  if (result.success && typeof result.file_path === "string") {
    return result.file_path;
  }
  return "";
}
