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
  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Supabase function configuration is incomplete." }, 500);
  if (!geminiKey && !groqKey && !openRouterKey) return json({ error: "AI marking is not configured. Add GEMINI_API_KEY, GROQ_API_KEY, and/or OPENROUTER_API_KEY to Supabase Edge Function secrets." }, 503);

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
      genre: String(assignment?.rubric?.genre || "general writing"),
      scoringCalibration: {
        purpose: "Apply a criterion-by-criterion analytic assessment. The total is the sum of independent criterion scores, not a holistic impression. Reward demonstrated strengths even when another skill is weak.",
        bands: [
          "90-100%: exceptional — notably effective, assured or original performance for this CEFR level in this criterion; the work stands out for clear, specific reasons. Minor imperfections may remain.",
          "80-89%: very strong — consistently effective performance for this CEFR level; clear strengths outweigh limited weaknesses.",
          "70-79%: competent to strong — the criterion is achieved well overall, with some noticeable weaknesses.",
          "60-69%: developing but mostly successful — the main requirement is met, though weaknesses are frequent or visible.",
          "40-59%: limited — partial achievement; weaknesses materially reduce the quality of this criterion.",
          "20-39%: weak — only a small part of this criterion is demonstrated.",
          "0-19%: very little relevant evidence for this criterion."
        ],
        scoringProcedure: [
          "Step 1: Read the task prompt, instructions, target CEFR, genre and the exact rubric. Identify what each criterion measures before judging the essay.",
          "Step 2: For each criterion, list only evidence relevant to that criterion. Do not let the overall impression or another criterion's weakness determine this score.",
          "Step 3: Select the performance band for that criterion, then choose a precise score within the band based on consistency, quality and significance of evidence.",
          "Step 4: Check the nearest band above and below. Evidence must explain why the chosen band is more accurate.",
          "Step 5: Add the criterion scores. Do not apply an extra holistic deduction, hidden ceiling, or overall quality adjustment."
        ],
        criterionIsolation: [
          "GRAMMAR ERRORS MUST BE DEDUCTED FROM GRAMMAR AND SENTENCE STRUCTURE ONLY, unless the rubric explicitly defines another criterion to include grammatical accuracy or the errors make the intended meaning genuinely impossible to understand.",
          "Do not reduce task achievement, creativity, ideas, content, plot, organisation, cohesion or vocabulary merely because grammar is inaccurate.",
          "A story can be exceptional in imagination, relevance, detail, engagement, plot development and ending while containing weak grammar. Score those strengths highly in the criteria that measure them; deduct grammar errors in the grammar criterion.",
          "Do not penalise the same error twice. Spelling and punctuation belong in their own criterion when the rubric has one. Vocabulary measures word choice, range, precision and appropriacy, not grammatical correctness.",
          "Only reduce organisation when the sequence, paragraphing, connections or overall structure are actually weak. Grammar mistakes alone are not evidence of poor organisation.",
          "Only reduce task achievement when the response misses the prompt, lacks required content, is underdeveloped in relevant ideas, or fails to fulfil the task. Do not confuse language accuracy with task fulfilment.",
          "If a criterion combines multiple skills in its written description, explain which part of the criterion is affected and avoid importing unrelated weaknesses."
        ],
        exceptionalWork: [
          "Exceptional does not mean error-free, adult-like, or beyond the CEFR level. It means unusually effective for the student's target level and the task conditions.",
          "For narrative task achievement, exceptional work may show an engaging premise, clear situation, purposeful character actions, well-developed connected events, effective tension or surprise, vivid relevant details, and a satisfying or deliberate ending.",
          "For narrative organisation, exceptional work has a clear and controlled sequence, purposeful paragraphs or transitions, and events that connect naturally. A simple plot can be exceptional if it is handled very effectively; an elaborate twist is not required.",
          "For vocabulary, exceptional work uses varied, vivid and precise words appropriately for the target level. Do not require rare or unnecessarily advanced vocabulary.",
          "For grammar, exceptional work shows strong control and useful sentence variety for the target level. This is the criterion where grammar errors are counted.",
          "For spelling and punctuation, assess only spelling, capitalisation and punctuation unless the supplied rubric explicitly says otherwise.",
          "A criterion can score 90-100 even if another criterion scores much lower. Do not make all criterion scores converge."
        ],
        benchmarkAnchors: [
          "Teacher-approved B1 timed narrative benchmark: 'The Spies and the Lab Monster' is an example of exceptional independent classroom storytelling. Its imaginative concept, developed sequence, engaging events and effective reveal/end should be recognised as high-level narrative achievement for B1. Small language errors should affect language-accuracy criteria, not erase its strengths in ideas or organisation.",
          "Teacher-approved B1 narrative profile: 'Dave and Greg' demonstrates that an imaginative, relevant and understandable story with connected events can earn strong task-achievement and organisation scores even when grammar needs substantial correction. Do not let grammar weakness collapse the whole assessment.",
          "These are qualitative calibration anchors, not fixed scores or templates. Compare the current essay's actual evidence and task; never award a score merely because it resembles a benchmark title or topic."
        ],
        rules: [
          "These are descriptive bands, not quotas. Never force a target average, bell curve or score distribution.",
          "Do not cap a score because the writer is a learner. Judge performance against the stated CEFR level, not against native-speaker or adult professional writing.",
          "Judge spelling and punctuation separately from grammar when the rubric separates them.",
          "For B1 narratives, expect a generally logical sequence, a recognisable beginning, development and ending, and common linking expressions. Do not require advanced literary techniques.",
          "Judge task achievement against the actual prompt and instructions. Do not invent requirements.",
          "Use the supplied criterion description and maximum points. Return a score supported by specific evidence, not a vague overall impression.",
          "Do not compress successful work into 40-59. Use 70-89 when the criterion is genuinely strong; reserve 90-100 for standout performance with identifiable evidence.",
          "Word count is a criterion only if the supplied rubric explicitly makes it one. Never apply an unstated word-count penalty."
        ]
      },
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
    const systemPrompt = "You are an analytic English writing assessor. Follow the scoringCalibration procedure exactly. The assessment is criterion-referenced, not holistic: score each criterion only for the skill(s) named in that criterion. CRITICAL NON-TRANSFER RULE: grammar mistakes are deducted from the grammar/sentence-structure criterion, not task achievement, ideas, creativity, organisation or vocabulary. Do not lower those other scores because grammar is poor. Transfer an effect to another criterion only when the essay provides independent evidence of weakness in that other skill, or meaning is genuinely impossible to understand. A creative, coherent and engaging story can therefore receive very high scores for ideas/task achievement and organisation while receiving a much lower grammar score. Do not double-penalise. Exceptional means standout performance for the target CEFR level and task, not error-free writing; use 90-100 when specific evidence justifies it. Never impose a hidden overall penalty or score ceiling. First judge each criterion independently, then add the scores without adjustment. Use the exact supplied rubric and prompt. Return exactly one result for each rubric criterion in the exact same order. Set rubricIndex to its zero-based position, copy its name and maximum exactly, and never merge, rename, omit or reorder criteria. Scores must be numeric and within the criterion maximum. Evidence must be specific and grounded in the essay; do not invent quotations or features. Word count is a criterion only when the rubric explicitly says so. Feedback is a draft for teacher approval, not a final grade. Respond in the requested feedback language. CRITICAL LANGUAGE-LEVEL RULE: write every student-facing comment, strength, improvement, grammar explanation, vocabulary suggestion, criterion evidence and suggestion at the target CEFR level. A1 feedback uses very simple short sentences and common words; A2 is simple and direct; B1 is clear everyday English with brief explanations; B2 is more precise with fuller explanations; C1 may be nuanced and advanced. Do not explain to an A1 learner in B2/C1 language.";
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
          const message = error instanceof Error ? error.message : String(error);
          providerErrors.push("Gemini network error: " + message);
          // A timeout is unlikely to improve on an immediate retry; fall through to OpenRouter instead.
          if (/timed out|timeout|abort/i.test(message)) break;
        }
        if (!raw && attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    let providerUsed = "Gemini";
    // Use Groq as the direct-provider fallback before the free-model router.
    if (!raw && groqKey) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + groqKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            temperature: 0.2,
            max_completion_tokens: 6000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt + " Return only valid JSON matching the requested assessment structure. Do not use markdown fences or add text before or after the JSON." },
              { role: "user", content: userPrompt + "\\nRequired JSON structure: " + JSON.stringify(schema) }
            ]
          }),
          signal: AbortSignal.timeout(35000)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === "string") raw = content.trim();
          else if (Array.isArray(content)) raw = content.map((part: any) => typeof part === "string" ? part : String(part?.text || "")).join("").trim();
          if (raw) {
            providerUsed = "Groq (" + String(data?.model || "openai/gpt-oss-20b") + ")";
          } else {
            providerErrors.push("Groq returned no text (finish reason: " + String(data?.choices?.[0]?.finish_reason || "unknown") + ").");
          }
        } else {
          providerErrors.push("Groq (" + response.status + "): " + String(data?.error?.message || "request failed"));
        }
      } catch (error) {
        providerErrors.push("Groq network error: " + (error instanceof Error ? error.message : String(error)));
      }
    }

    if (!raw && openRouterKey) {
      // Some free routed models return no content when JSON mode is requested.
      // Try JSON mode first, then retry once without it and parse the model's plain JSON response.
      for (let openRouterAttempt = 0; openRouterAttempt < 2 && !raw; openRouterAttempt++) {
        try {
          const requestBody: any = {
            model: "openrouter/free",
            temperature: 0.2,
            max_tokens: 6000,
            messages: [
              { role: "system", content: systemPrompt + " Return only valid JSON matching the requested assessment structure. Do not use markdown fences or add text before or after the JSON." },
              { role: "user", content: userPrompt + "\\nRequired JSON structure: " + JSON.stringify(schema) }
            ]
          };
          if (openRouterAttempt === 0) requestBody.response_format = { type: "json_object" };
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + openRouterKey,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://eduassess.pages.dev",
              "X-Title": "EduAssess Writing Assessment"
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(45000)
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const choice = data?.choices?.[0];
            const message = choice?.message;
            const content = message?.content;
            if (typeof content === "string") raw = content.trim();
            else if (Array.isArray(content)) raw = content.map((part: any) => typeof part === "string" ? part : String(part?.text || "")).join("").trim();
            if (raw) {
              providerUsed = "OpenRouter free model (" + String(data?.model || "model unknown") + ")";
            } else {
              const reason = String(choice?.finish_reason || "unknown");
              const nativeReason = String(choice?.native_finish_reason || "unknown");
              const messageKeys = message && typeof message === "object" ? Object.keys(message).join(",") : "no message object";
              const reasoningLength = typeof message?.reasoning === "string" ? message.reasoning.length : 0;
              const apiError = String(data?.error?.message || "");
              providerErrors.push(
                "OpenRouter returned no text (model: " + String(data?.model || "unknown") +
                ", finish: " + reason + ", native finish: " + nativeReason +
                ", message fields: " + messageKeys + ", reasoning chars: " + reasoningLength +
                (apiError ? ", API error: " + apiError : "") +
                ", attempt " + (openRouterAttempt + 1) + ")."
              );
            }
          } else {
            const message = String(data?.error?.message || "request failed");
            providerErrors.push("OpenRouter (" + response.status + "): " + message);
            // Retry once without JSON mode if a routed model rejects that response format.
            if (openRouterAttempt === 0 && /response.?format|json.?object|unsupported|not support/i.test(message)) continue;
            break;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          providerErrors.push("OpenRouter network error: " + message);
          break;
        }
      }
    }
    if (!raw) return json({
      error: "AI assessment failed. No rubric scores were changed. " + providerErrors.join(" | "),
      retryable: true
    }, 502);

    let draft: any;
    try {
      // Accept plain JSON, fenced JSON, or a short preamble followed by a JSON object.
      let candidate = raw.trim().replace(/^\uFEFF/, "");
      candidate = candidate.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      try {
        draft = JSON.parse(candidate);
      } catch {
        const firstBrace = candidate.indexOf("{");
        const lastBrace = candidate.lastIndexOf("}");
        if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error("No complete JSON object found.");
        draft = JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      }
    } catch {
      const preview = raw.trim().slice(0, 120).replace(/[\r\n]+/g, " ");
      return json({
        error: providerUsed + " returned text that was not valid JSON (response length: " + raw.length + "). No rubric scores were changed. " + (preview ? "Response began: " + preview : "The response was empty."),
        retryable: true
      }, 502);
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
