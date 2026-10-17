import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return hex(bytes);
}
function safeQuestion(q: any) {
  return {
    id: String(q.id ?? ""),
    prompt: String(q.prompt ?? ""),
    points: Math.max(1, Number(q.points) || 1),
    options: Array.isArray(q.options) ? q.options.map((o: any) => ({ text: String(o.text ?? "") })) : [],
  };
}
function inWindow(a: any) {
  const now = Date.now();
  return (!a.opens_at || Date.parse(a.opens_at) <= now) && (!a.closes_at || Date.parse(a.closes_at) > now);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    if (action === "login") {
      const schoolSlug = String(body.schoolSlug ?? "").trim().toLowerCase();
      const studentCode = String(body.studentCode ?? "").trim();
      const accessCode = String(body.accessCode ?? "").trim().toUpperCase();
      if (!schoolSlug || !studentCode || !accessCode) return json({ error: "Enter your school ID, student ID and access code." }, 400);
      const { data: school, error: schoolErr } = await db.from("schools").select("id,name,slug").eq("slug", schoolSlug).eq("is_active", true).maybeSingle();
      if (schoolErr) throw schoolErr;
      if (!school) return json({ error: "The school or student details were not recognized." }, 401);
      const { data: student, error: studentErr } = await db.from("students").select("id,school_id,class_id,student_code,display_name,access_code_hash,is_active").eq("school_id", school.id).eq("student_code", studentCode).maybeSingle();
      if (studentErr) throw studentErr;
      if (!student || !student.is_active || student.school_id !== school.id || await sha256(accessCode) !== student.access_code_hash) {
        return json({ error: "The school or student details were not recognized." }, 401);
      }
      const token = newToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      const { error: sessionErr } = await db.from("student_sessions").insert({
        student_id: student.id, school_id: school.id, token_hash: await sha256(token), expires_at: expiresAt,
      });
      if (sessionErr) throw sessionErr;
      return json({ token, expiresAt, school: school.name, student: student.display_name || student.student_code });
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.length < 40) return json({ error: "Please sign in again." }, 401);
    const tokenHash = await sha256(token);
    const { data: session, error: sessionErr } = await db.from("student_sessions")
      .select("id,student_id,school_id,expires_at,revoked_at,students(id,class_id,student_code,display_name,is_active)")
      .eq("token_hash", tokenHash).maybeSingle();
    if (sessionErr) throw sessionErr;
    if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now() || !session.students?.is_active) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    await db.from("student_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

    if (action === "logout") {
      const { error } = await db.from("student_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "list") {
      const { data: assignments, error } = await db.from("assessment_assignments")
        .select("assigned_at,assessments(id,title,description,engine_key,is_published,is_active,opens_at,closes_at,assessment_data,result_storage_mode),classes!inner(id,is_active)")
        .eq("class_id", session.students.class_id)
        .eq("school_id", session.school_id)
        .eq("classes.is_active", true);
      if (error) throw error;
      const items = (assignments || []).map((x: any) => x.assessments).filter((a: any) =>
        a && a.is_active && a.is_published && inWindow(a)
      ).map((a: any) => ({
        id: a.id, title: a.title, description: a.description, engineKey: a.engine_key,
        kind: a.engine_key === "mc-assessment-builder-v1" ? "multiple-choice" :
          a.engine_key === "essay-rubric-v1" ? "essay-rubric" :
          a.engine_key === "a2-adaptive-grammar-v1" ? "adaptive-diagnostic" : "other",
        supported: a.engine_key === "mc-assessment-builder-v1",
      }));
      return json({ student: session.students.display_name || session.students.student_code, assessments: items });
    }

    if (action === "start" || action === "submit") {
      const assessmentId = String(body.assessmentId ?? "");
      if (!assessmentId) return json({ error: "Missing assessment ID." }, 400);
      const { data: assignment, error: assignErr } = await db.from("assessment_assignments")
        .select("assessment_id,school_id,class_id,classes!inner(is_active)")
        .eq("assessment_id", assessmentId).eq("school_id", session.school_id)
        .eq("class_id", session.students.class_id).eq("classes.is_active", true).maybeSingle();
      if (assignErr) throw assignErr;
      if (!assignment) return json({ error: "This assessment is not assigned to your class." }, 403);
      const { data: assessment, error: assessErr } = await db.from("assessments")
        .select("id,title,engine_key,assessment_data,result_storage_mode,is_published,is_active,opens_at,closes_at")
        .eq("id", assessmentId).maybeSingle();
      if (assessErr) throw assessErr;
      if (!assessment || !assessment.is_active || !assessment.is_published || !inWindow(assessment)) {
        return json({ error: "This assessment is not currently available." }, 403);
      }
      if (assessment.engine_key !== "mc-assessment-builder-v1") {
        return json({ error: "This assessment type is listed, but online delivery for this type is not ready yet." }, 501);
      }
      const data = assessment.assessment_data || {};
      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (!questions.length) return json({ error: "This assessment has no questions." }, 422);

      if (action === "start") {
        return json({
          assessment: {
            id: assessment.id, title: assessment.title, instructions: data.instructions || "",
            passage: data.passage || "", minutes: Math.max(0, Number(data.minutes) || 0),
            feedback: data.feedback || "score", questions: questions.map(safeQuestion),
          },
        });
      }

      const answers = body.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) return json({ error: "Submit answers as a question-ID to option-index map." }, 400);
      if (questions.length > 500) return json({ error: "This assessment is too large to score." }, 422);
      let possible = 0, earned = 0, correctCount = 0, answeredCount = 0;
      const answerDetails = questions.map((q: any) => {
        const points = Math.max(1, Number(q.points) || 1);
        possible += points;
        const chosen = Number(answers[String(q.id)]);
        const valid = Number.isInteger(chosen) && chosen >= 0 && chosen < (Array.isArray(q.options) ? q.options.length : 0);
        const correctIndex = Array.isArray(q.options) ? q.options.findIndex((o: any) => o.correct === true) : -1;
        const isCorrect = valid && correctIndex >= 0 && chosen === correctIndex;
        if (valid) answeredCount++;
        if (isCorrect) { correctCount++; earned += points; }
        return { questionId: String(q.id ?? ""), chosenIndex: valid ? chosen : null, correct: isCorrect, pointsEarned: isCorrect ? points : 0 };
      });
      const percent = possible ? Math.round((earned / possible) * 10000) / 100 : 0;
      const storage = ["none", "anonymous", "identified"].includes(assessment.result_storage_mode) ? assessment.result_storage_mode : "none";
      if (storage === "identified") {
        const { error } = await db.from("attempts").insert({
          student_id: session.student_id, assessment_id: assessment.id, completed_at: new Date().toISOString(),
          result: { answers: answerDetails, possiblePoints: possible, earnedPoints: earned },
          score_percent: percent, correct_count: correctCount, questions_answered: answeredCount, engine_key: assessment.engine_key,
        });
        if (error) throw error;
      } else if (storage === "anonymous") {
        const { error } = await db.from("anonymous_assessment_results").insert({
          assessment_id: assessment.id, score_percent: percent, correct_count: correctCount,
          questions_answered: answeredCount, result: { answers: answerDetails, possiblePoints: possible, earnedPoints: earned },
        });
        if (error) throw error;
      }
      const feedback = data.feedback === "none" ? null : answerDetails.map((a: any, i: number) => ({
        questionId: a.questionId, correct: a.correct,
        correctOption: questions[i]?.options?.find((o: any) => o.correct === true)?.text || "",
        explanation: questions[i]?.explanation || "",
      }));
      return json({ scorePercent: percent, correctCount, questionsAnswered: answeredCount, totalQuestions: questions.length, possiblePoints: possible, earnedPoints: earned, feedback: feedback });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("student-assessment error", error);
    return json({ error: "The request could not be completed. Check server logs for details." }, 500);
  }
});
