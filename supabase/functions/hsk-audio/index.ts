import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF"); view.setUint32(4, 36 + pcm.length, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length); wav.set(new Uint8Array(header), 0); wav.set(pcm, 44);
  return wav;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase function configuration is incomplete." }, 500);
  if (!geminiKey) return json({ error: "Add GEMINI_API_KEY to Supabase Edge Function secrets before generating HSK audio." }, 503);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Please sign in again." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Your teacher session has expired. Please sign in again." }, 401);

    const body = await req.json();
    const questionId = String(body.questionId || "").trim();
    const schoolId = String(body.schoolId || "").trim();
    if (!questionId || !schoolId) return json({ error: "Missing question or school." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: membershipError } = await admin.from("school_memberships")
      .select("role").eq("school_id", schoolId).eq("user_id", auth.user.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) return json({ error: "You do not have permission to manage HSK content for this school." }, 403);

    const { data: question, error: questionError } = await admin.from("hsk_questions")
      .select("question_id,level,skill,audio_text,audio_path,is_published")
      .eq("question_id", questionId).maybeSingle();
    if (questionError) throw questionError;
    if (!question) return json({ error: "HSK question not found." }, 404);
    if (!question.audio_text || !question.audio_text.trim()) return json({ error: "This question has no Mandarin audio script." }, 422);

    const ttsPrompt = "Speak in clear, standard Mainland Mandarin (Putonghua), with natural pronunciation and a measured pace suitable for beginner language learners. Read the following Chinese text exactly as written. Do not translate, explain, add, or omit any words:\n\n" + question.audio_text.trim();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: ttsPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: "zh-CN",
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const ttsData = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini TTS failed", response.status, ttsData?.error?.message || "Unknown provider error");
      await admin.from("hsk_questions").update({ audio_status: "failed" }).eq("question_id", questionId);
      return json({ error: "Mandarin audio generation failed. Check the Gemini API key and provider response." }, 502);
    }
    const part = ttsData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (!part?.inlineData?.data) return json({ error: "Gemini returned no audio data for this script." }, 502);

    const audioBytes = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
    const isWav = audioBytes.length > 44 && String.fromCharCode(...audioBytes.slice(0, 4)) === "RIFF";
    const wavBytes = isWav ? audioBytes : pcmToWav(audioBytes);
    if (wavBytes.length < 1000 || wavBytes.length > 15 * 1024 * 1024) return json({ error: "The generated audio file has an unexpected size." }, 502);

    const storagePath = "audio/" + question.question_id + ".wav";
    const { error: uploadError } = await admin.storage.from("hsk-media").upload(storagePath, wavBytes, {
      contentType: "audio/wav", upsert: true, cacheControl: "31536000",
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin.from("hsk_questions").update({
      audio_path: storagePath, audio_status: "ready", audio_generated_at: new Date().toISOString(),
    }).eq("question_id", questionId);
    if (updateError) throw updateError;

    return json({ ok: true, questionId, audioStatus: "ready", storagePath, mimeType: "audio/wav", bytes: wavBytes.length });
  } catch (error) {
    console.error("hsk-audio error", error);
    return json({ error: "The audio request could not be completed. Check the Edge Function logs." }, 500);
  }
});
