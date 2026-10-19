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
  if (!url || !anonKey || !serviceKey) return json({ error: "Supabase function configuration is incomplete." }, 500);
  if (!geminiKey) return json({ error: "AI marking is not configured yet. The administrator must add the GEMINI_API_KEY secret and redeploy this function." }, 503);

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
          name: { type: "string" }, score: { type: "number" }, max: { type: "number" },
          evidence: { type: "string" }, suggestion: { type: "string" }
        }, required: ["name", "score", "max", "evidence", "suggestion"] } },
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
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are a careful English writing assessor supporting a teacher. Assess only against the exact rubric supplied. Scores must be numeric and within each criterion's maximum. Provide short, specific evidence from the essay; do not fabricate quotations or features. Word count is one criterion only: never reject an essay for being below the target length. Apply the rubric fairly to shorter work. Feedback is a draft for teacher approval, never a final grade. Respond in the requested feedback language. CRITICAL LANGUAGE-LEVEL RULE: The target CEFR level is provided in the assessment data. Write every student-facing comment, strength, improvement, grammar explanation, vocabulary suggestion, criterion evidence, and suggestion using language appropriate to that exact CEFR level. A1 feedback must use very simple A1 English, short sentences, common words, and concrete examples; avoid abstract terms such as cohesion, register, and complexity unless explained simply. A2 feedback must be simple and direct. B1 feedback should be clear everyday English with brief explanations. B2 feedback can use more precise vocabulary and fuller explanations appropriate to B2. C1 feedback may be nuanced and advanced. Do not explain to an A1 learner in B2/C1 language. Keep the teacher-facing assessment accurate, but keep the wording of feedback at the student's target level." }]
        },
        contents: [{
          role: "user",
          parts: [{ text: "Assess this essay using this JSON data only:\\n" + JSON.stringify(promptData) }]
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(schema)
        }
      })
    });
    const aiJson = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      const message = aiJson?.error?.message || "The AI provider could not assess this essay.";
      return json({ error: message }, 502);
    }
    const raw = aiJson?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("");
    if (!raw) return json({ error: aiJson?.promptFeedback?.blockReason || "The AI returned an empty assessment." }, 502);
    const draft = JSON.parse(raw);
    const criteria = rubric.map((cr: any) => {
      const found = (draft.criteria || []).find((item: any) => String(item.name).trim().toLowerCase() === String(cr.name).trim().toLowerCase());
      const max = Number(cr.max) || 0;
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
