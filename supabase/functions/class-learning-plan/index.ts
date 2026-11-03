const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Supabase function configuration is incomplete." }, 500);
  if (!geminiKey && !openRouterKey) return json({ error: "AI analysis is not configured. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY to Supabase Edge Function secrets." }, 503);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Please sign in again." }, 401);
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Your teacher session has expired. Please sign in again." }, 401);
    const body = await req.json();
    const schoolId = String(body.schoolId || "");
    const analysis = body.analysis;
    if (!schoolId || !analysis || typeof analysis !== "object") return json({ error: "Missing school or analysis data." }, 400);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: membership, error: memberError } = await admin.from("school_memberships").select("school_id").eq("school_id", schoolId).eq("user_id", auth.user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return json({ error: "You do not have access to this school's learning data." }, 403);

    const schema = {
      type: "object",
      properties: {
        executiveSummary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        priorities: { type: "array", items: { type: "object", properties: { area: { type: "string" }, evidence: { type: "string" }, action: { type: "string" }, successMeasure: { type: "string" } }, required: ["area","evidence","action","successMeasure"] } },
        supportGroups: { type: "array", items: { type: "object", properties: { focus: { type: "string" }, students: { type: "array", items: { type: "string" } }, activities: { type: "array", items: { type: "string" } }, target: { type: "string" } }, required: ["focus","students","activities","target"] } },
        enrichmentGroups: { type: "array", items: { type: "object", properties: { focus: { type: "string" }, students: { type: "array", items: { type: "string" } }, challenge: { type: "string" }, outcome: { type: "string" } }, required: ["focus","students","challenge","outcome"] } },
        fourWeekPlan: { type: "array", items: { type: "object", properties: { week: { type: "string" }, focus: { type: "string" }, actions: { type: "array", items: { type: "string" } }, check: { type: "string" } }, required: ["week","focus","actions","check"] } },
        cautions: { type: "array", items: { type: "string" } }
      },
      required: ["executiveSummary","strengths","priorities","supportGroups","enrichmentGroups","fourWeekPlan","cautions"]
    };
    const prompt = "You are an experienced classroom assessment and differentiation coach. Analyse only the supplied anonymised/teacher-authorised class assessment evidence. Do not invent skills, causes, student details, or scores. Distinguish measured findings from hypotheses. Identify class strengths, the most important teachable gaps, students who may need additional support, and students who may benefit from enrichment. Student groupings are provisional recommendations for teacher review, not diagnoses or fixed labels. Consider number of results and consistency; do not overreact to one low/high score. If evidence is insufficient, say so and recommend gathering more evidence. Give practical differentiated activities, measurable success criteria, and a realistic four-week plan. Keep student names exactly as supplied and only include students present in the input. Return valid JSON matching this schema: " + JSON.stringify(schema) + "\nDATA:\n" + JSON.stringify(analysis);
    let raw = "";
    let errors: string[] = [];
    if (geminiKey) {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
          method: "POST", headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema } }),
          signal: AbortSignal.timeout(12000)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) raw = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
        else errors.push("Gemini (" + response.status + "): " + String(data?.error?.message || "request failed"));
      } catch (e) { errors.push("Gemini: " + (e instanceof Error ? e.message : String(e))); }
    }
    if (!raw && openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", headers: { "Authorization": "Bearer " + openRouterKey, "Content-Type": "application/json", "HTTP-Referer": "https://eduassess.pages.dev", "X-Title": "EduAssess Learning Plan" },
          body: JSON.stringify({ model: "openrouter/free", temperature: 0.2, max_tokens: 5000, messages: [{ role: "system", content: "Return only valid JSON. Do not use markdown fences." }, { role: "user", content: prompt }] }),
          signal: AbortSignal.timeout(18000)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const content = data?.choices?.[0]?.message?.content;
          raw = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map((p: any) => p.text || "").join("").trim() : "";
        } else errors.push("OpenRouter (" + response.status + "): " + String(data?.error?.message || "request failed"));
      } catch (e) { errors.push("OpenRouter: " + (e instanceof Error ? e.message : String(e))); }
    }
    if (!raw) { console.error("class-learning-plan provider failures:", errors); return json({ error: "AI analysis failed. " + (errors.join(" | ") || "The provider returned an empty response.") }, 502); }
    let result: any;
    try {
      const clean = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
      const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
      result = JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
    } catch (e) { console.error("class-learning-plan invalid JSON:", e, raw.slice(0, 1200)); return json({ error: "The AI provider returned an invalid report. Please try again." }, 502); }
    for (const key of ["executiveSummary","strengths","priorities","supportGroups","enrichmentGroups","fourWeekPlan","cautions"]) {
      if (result[key] === undefined) return json({ error: "The AI report was incomplete. Please try again." }, 502);
    }
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected analysis error." }, 500);
  }
});
