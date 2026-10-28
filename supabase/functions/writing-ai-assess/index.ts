import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (!geminiKey && !openRouterKey) return json({ error: "AI marking is not configured. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY to Supabase Edge Function secrets." }, 503);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return json({ error: "Please sign in again." }, 401);

    const internalRequest = accessToken === serviceKey;
    let user: any = null;
    if (!internalRequest) {
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: "Bearer " + accessToken } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
      if (authError || !authData.user) return json({ error: "Your teacher session has expired. Please sign in again." }, 401);
      user = authData.user;
    }

    const body = await req.json();
    const submissionId = String(body.submissionId || "").trim();
    if (!submissionId) return json({ error: "Missing submission ID." }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const schoolIds: string[] = [];
    if (!internalRequest) {
      const { data: membership, error: memberError } = await admin.from("school_memberships").select("school_id").eq("user_id", user.id);
      if (memberError) throw memberError;
      schoolIds.push(...(membership || []).map((m: any) => m.school_id));
      if (!schoolIds.length) return json({ error: "Your account is not linked to a school." }, 403);
    }

    const { data: submission, error: subError } = await admin.from("writing_submissions")
      .select("id,school_id,assignment_id,draft_text,submitted_text,word_count,status,writing_assignments(title,prompt,instructions,rubric,min_words,max_words,is_open_test),students(display_name,student_code)")
      .eq("id", submissionId).maybeSingle();
    if (subError) throw subError;
    if (!submission) return json({ error: "Submission not found or you do not have permission to assess it." }, 404);
    const assignment: any = Array.isArray(submission.writing_assignments) ? submission.writing_assignments[0] : submission.writing_assignments;
    if (internalRequest) {
      if (!assignment?.is_open_test || submission.status !== "submitted") return json({ error: "Internal auto-assessment is only allowed for submitted Open Tests." }, 403);
    } else if (!schoolIds.includes(submission.school_id)) return json({ error: "Submission not found or you do not have permission to assess it." }, 404);

    const student: any = Array.isArray(submission.students) ? submission.students[0] : submission.students;
    const rubric = Array.isArray(assignment?.rubric) ? assignment.rubric : (Array.isArray(assignment?.rubric?.criteria) ? assignment.rubric.criteria : []);
    if (!rubric.length) return json({ error: "This assignment has no saved rubric. Edit and save the assignment rubric first." }, 400);
    const essay = String(submission.submitted_text ?? submission.draft_text ?? "");
    if (!essay.trim()) return json({ error: "The student essay is empty." }, 400);
    const aiSettings = assignment?.rubric?.aiSettings || {};
    const requestedParts = Array.isArray(aiSettings.reportContents) ? aiSettings.reportContents : ["strengths", "improvements", "grammar", "vocabulary"];
    const language = String(aiSettings.language || "English");
    const targetCefr = String(assignment?.rubric?.targetCefr || "A2").toUpperCase();
    const instructions = String(aiSettings.instructions || "Use only the supplied rubric. Provide evidence from the essay and do not invent evidence.");

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        criteria: { type: "array", items: { type: "object", additionalProperties: false, properties: {
          rubricIndex: { type: "integer" }, name: { type: "string" }, score: { type: "number" }, max: { type: "number" },
          evidence: { type: "string" }, suggestion: { type: "string" }
        }, required: ["rubricIndex", "name", "score", "max", "evidence", "suggestion"] } },
        feedback: { type: "string" }, strengths: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } }, grammarCorrections: { type: "array", items: { type: "string" } },
        vocabularySuggestions: { type: "array", items: { type: "string" } }, caveats: { type: "string" }
      },
      required: ["criteria", "feedback", "strengths", "improvements", "grammarCorrections", "vocabularySuggestions", "caveats"]
    };

    const promptData = {
      assignmentTitle: assignment?.title || "Writing assignment",
      assignmentPrompt: assignment?.prompt || "",
      assignmentInstructions: assignment?.instructions || "",
      targetCefr,
      feedbackLanguageLevel: "Write all student-facing feedback at the same CEFR level as the task. A1: very short sentences, common words, one simple idea at a time, and clear examples. A2: simple, direct sentences and familiar vocabulary. B1: clear everyday English with some explanation and useful linking words. B2: more detailed, precise explanations and a wider range of vocabulary, while staying clear. C1: nuanced, precise explanations and more advanced language. Do not use language above the target level just to sound professional.",
      targetLength: { minimum: Number(assignment?.min_words) || 0, maximum: Number(assignment?.max_words) || 0 },
      wordCount: Number(submission.word_count) || essay.trim().split(/\s+/).length,
      rubric,
      requestedFeedbackSections: requestedParts,
      feedbackLanguage: language,
      additionalTeacherInstructions: instructions,
      studentName: student?.display_name || student?.student_code || "Student",
      essay
    };

    // Convert the existing JSON Schema to Gemini's responseSchema format.
    const toGeminiSchema = (node: any): any => {
      const out: any = {};
      if (node.type) out.type = String(node.type).toUpperCase();
      if (node.description) out.description = node.description;
      if (node.properties) {
        out.properties = {};
        for (const [key, value] of Object.entries(node.properties)) out.properties[key] = toGeminiSchema(value);
      }
      if (node.items) out.items = toGeminiSchema(node.items);
      if (node.required) out.required = node.required;
      return out;
    };
    const systemPrompt = "You are a careful English writing assessor supporting a teacher. Assess only against the exact rubric supplied. Return exactly one criterion for each rubric criterion, in the exact same order. Set rubricIndex to the zero-based position of that criterion in the supplied rubric (first criterion is 0), copy its name and maximum exactly, and never merge, rename, omit, or reorder criteria. Scores must be numeric and within each criterion's maximum. Provide short, specific evidence from the essay; do not fabricate quotations or features. Word count is one criterion only: never reject an essay for being below the target length. Apply the rubric fairly to shorter work. Feedback is a draft for teacher approval, never a final grade. Respond in the requested feedback language. CRITICAL LANGUAGE-LEVEL RULE: The target CEFR level is provided in the assessment data. Write every student-facing comment, strength, improvement, grammar explanation, vocabulary suggestion, criterion evidence, and suggestion using language appropriate to that exact CEFR level. A1 feedback must use very simple A1 English, short sentences, common words, and concrete examples; avoid abstract terms such as cohesion, register, and complexity unless explained simply. A2 feedback must be simple and direct. B1 feedback should be clear everyday English with brief explanations. B2 feedback can use more precise vocabulary and fuller explanations appropriate to B2. C1 feedback may be nuanced and advanced. Do not explain to an A1 learner in B2/C1 language. Keep the teacher-facing assessment accurate, but keep the wording of feedback at the student's target level.";
    const userPrompt = "Assess this essay using this JSON data only:\\n" + JSON.stringify(promptData);
    let raw = "";
    let providerErrors: string[] = [];
    // Retry only transient Gemini capacity/rate-limit/server errors, then use the free OpenRouter model router.
    if (geminiKey) {
      for (let attempt = 0; attempt < 2 && !raw; attempt++) {
        try {
          const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
            method: "POST",
            headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) }
            }),
            // Bound each provider call so a stalled upstream request cannot hold the Edge Function open until gateway timeout.
            signal: AbortSignal.timeout(25000)
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            raw = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
            if (!raw) providerErrors.push("Gemini returned an empty assessment.");
          } else {
            const message = String(data?.error?.message || "Gemini request failed.");
            providerErrors.push("Gemini (" + response.status + "): " + message);
            const transient = response.status === 408 || response.status === 429 || response.status >= 500 ||
              /high demand|overload|temporar|resource_exhausted/i.test(message);
            if (!transient) break;
          }
        } catch (error) {
          providerErrors.push("Gemini network error: " + (error instanceof Error ? error.message : String(error)));
        }
        if (!raw && attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    let providerUsed = "Gemini";
    if (!raw && openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + openRouterKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://eduassess.pages.dev",
            "X-Title": "EduAssess Writing Assessment"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt + " Return only valid JSON matching the requested assessment structure." },
              { role: "user", content: userPrompt + "\\nRequired JSON structure: " + JSON.stringify(schema) }
            ]
          })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          raw = data?.choices?.[0]?.message?.content || "";
          providerUsed = "OpenRouter free model";
          if (!raw) providerErrors.push("OpenRouter returned an empty assessment.");
        } else {
          providerErrors.push("OpenRouter (" + response.status + "): " + String(data?.error?.message || "request failed"));
        }
      } catch (error) {
        providerErrors.push("OpenRouter network error: " + (error instanceof Error ? error.message : String(error)));
      }
    }
    if (!raw) return json({
      error: "AI assessment failed. No rubric scores were changed. " + providerErrors.join(" | "),
      retryable: true
    }, 502);

    let draft: any;
    try {
      draft = JSON.parse(raw);
    } catch {
      return json({ error: providerUsed + " returned invalid JSON. No rubric scores were changed.", retryable: true }, 502);
    }
    const validationCriteria = Array.isArray(draft.criteria) ? draft.criteria : [];
    if (validationCriteria.length !== rubric.length) {
      return json({ error: providerUsed + " returned " + validationCriteria.length + " rubric criteria, but this assignment requires " + rubric.length + ". No rubric scores were changed.", retryable: true }, 502);
    }
    for (let i = 0; i < rubric.length; i++) {
      const item = validationCriteria[i];
      const expectedMax = Number(rubric[i].max) || 0;
      const score = Number(item?.score);
      const max = Number(item?.max);
      if (!item || (item.rubricIndex !== undefined && Number(item.rubricIndex) !== i) ||
          !Number.isFinite(score) || score < 0 || score > expectedMax ||
          (Number.isFinite(max) && max !== expectedMax)) {
        return json({ error: providerUsed + " returned invalid scores for rubric criterion " + (i + 1) + ". No rubric scores were changed.", retryable: true }, 502);
      }
    }
    const normalizeCriterion = (value: unknown) => String(value || "").toLowerCase()
      .replace(/organisation/g, "organization").replace(/[^a-z0-9]+/g, " ").trim();
    const returnedCriteria = Array.isArray(draft.criteria) ? draft.criteria : [];
    const used = new Set<number>();
    const criteria = rubric.map((cr: any, index: number) => {
      const max = Number(cr.max) || 0;
      const targetName = normalizeCriterion(cr.name);
      let foundIndex = returnedCriteria.findIndex((item: any, i: number) =>
        !used.has(i) && Number(item.rubricIndex) === index
      );
      if (foundIndex < 0) foundIndex = returnedCriteria.findIndex((item: any, i: number) =>
        !used.has(i) && normalizeCriterion(item.name) === targetName
      );
      if (foundIndex < 0) {
        const targetWords = targetName.split(" ").filter((word: string) => word.length > 3);
        foundIndex = returnedCriteria.findIndex((item: any, i: number) => {
          if (used.has(i)) return false;
          const candidate = normalizeCriterion(item.name);
          return targetWords.length > 0 &&
            targetWords.filter((word: string) => candidate.includes(word)).length >= Math.min(2, targetWords.length);
        });
      }
      // Rubrics sometimes use different labels for the same criteria. The rubric is
      // supplied in a stable order, so use position only if the maximum points agree.
      if (foundIndex < 0 && returnedCriteria.length === rubric.length &&
          returnedCriteria[index] && !used.has(index)) {
        foundIndex = index;
      }
      if (foundIndex < 0) {
        const sameMax = returnedCriteria.map((item: any, i: number) => ({ item, i }))
          .filter(({ item, i }: any) => !used.has(i) && Number(item.max) === max);
        if (sameMax.length === 1) foundIndex = sameMax[0].i;
      }
      const found = foundIndex >= 0 ? returnedCriteria[foundIndex] : null;
      if (foundIndex >= 0) used.add(foundIndex);
      return {
        name: String(cr.name),
        max,
        score: found && Number.isFinite(Number(found.score)) ? Math.max(0, Math.min(max, Number(found.score))) : 0,
        evidence: String(found?.evidence || "No specific evidence returned; teacher review needed."),
        suggestion: String(found?.suggestion || "")
      };
    });
    const result = {
      criteria,
      feedback: String(draft.feedback || ""),
      strengths: requestedParts.includes("strengths") ? draft.strengths || [] : [],
      improvements: requestedParts.includes("improvements") ? draft.improvements || [] : [],
      grammarCorrections: requestedParts.includes("grammar") ? draft.grammarCorrections || [] : [],
      vocabularySuggestions: requestedParts.includes("vocabulary") ? draft.vocabularySuggestions || [] : [],
      caveats: String(draft.caveats || (internalRequest ? "Automatically generated AI feedback. Review it critically." : "AI suggestions require teacher review before saving."))
    };
    const { error: saveError } = await admin.from("writing_submissions").update({ ai_review: result, updated_at: new Date().toISOString() }).eq("id", submissionId);
    if (saveError) throw saveError;
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected AI assessment error." }, 500);
  }
});
