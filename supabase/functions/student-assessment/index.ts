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
    options: Array.isArray(q.options) ? q.options.map((o: any, index: number) => ({ text: String(o.text ?? "").trim(), index })).filter((o: any) => o.text.length > 0) : [],
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
      .select("id,student_id,school_id,expires_at,revoked_at,students(id,class_id,student_code,display_name,is_active,classes(name))")
      .eq("token_hash", tokenHash).maybeSingle();
    if (sessionErr) throw sessionErr;
    if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now() || !session.students?.is_active) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    await db.from("student_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

    if (action === "writing-list") {
      const { data: assignments, error } = await db.from("writing_assignments")
        .select("id,title,prompt,instructions,rubric_key,rubric,min_words,max_words,due_at,status,classes(name)")
        .eq("school_id", session.school_id).eq("class_id", session.students.class_id).eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: submissions, error: subErr } = await db.from("writing_submissions")
        .select("id,assignment_id,draft_text,status,submitted_at,updated_at")
        .eq("student_id", session.student_id);
      if (subErr) throw subErr;
      return json({ className: session.students.classes?.name || "", assignments: (assignments || []).filter((a: any) => !a.due_at || Date.parse(a.due_at) > Date.now()).map((a: any) => ({ ...a, className: a.classes?.name || session.students.classes?.name || "" })), submissions: submissions || [] });
    }

    if (action === "writing-save" || action === "writing-submit") {
      const assignmentId = String(body.assignmentId || "");
      const textValue = String(body.text || "");
      if (!assignmentId) return json({ error: "Missing writing assignment." }, 400);
      if (textValue.length > 100000) return json({ error: "Your writing is too long to save in one submission." }, 413);
      const { data: assignment, error: aErr } = await db.from("writing_assignments")
        .select("id,school_id,class_id,status,min_words,max_words,due_at")
        .eq("id", assignmentId).eq("school_id", session.school_id).eq("class_id", session.students.class_id)
        .eq("status", "published").maybeSingle();
      if (aErr) throw aErr;
      if (!assignment || (assignment.due_at && Date.parse(assignment.due_at) <= Date.now())) return json({ error: "This writing assignment is no longer available." }, 403);
      const words = textValue.trim() ? textValue.trim().split(/\\s+/).length : 0;
      if (action === "writing-submit" && words < Number(assignment.min_words || 0)) return json({ error: "Please write at least " + assignment.min_words + " words before submitting." }, 400);
      if (assignment.max_words && words > assignment.max_words) return json({ error: "Please reduce your writing to " + assignment.max_words + " words or fewer." }, 400);
      const { data: existing, error: existingErr } = await db.from("writing_submissions")
        .select("id,status").eq("assignment_id", assignmentId).eq("student_id", session.student_id).maybeSingle();
      if (existingErr) throw existingErr;
      if (existing?.status === "submitted") return json({ error: "This essay has already been submitted and is locked." }, 409);
      const now = new Date().toISOString();
      const values: any = {
        assignment_id: assignmentId, school_id: session.school_id, class_id: session.students.class_id,
        student_id: session.student_id, draft_text: textValue, word_count: words,
        status: action === "writing-submit" ? "submitted" : "draft", updated_at: now,
      };
      if (action === "writing-submit") { values.submitted_text = textValue; values.submitted_at = now; }
      const { data: saved, error: saveErr } = await db.from("writing_submissions")
        .upsert(values, { onConflict: "assignment_id,student_id" }).select("id,status,word_count,updated_at,submitted_at").single();
      if (saveErr) throw saveErr;
      return json({ ok: true, submission: saved });
    }

    if (action === "submit-diagnostic") {
      const report = body.report;
      if (!report || typeof report !== "object" || Array.isArray(report)) return json({ error: "Missing diagnostic report." }, 400);
      const serialized = JSON.stringify(report);
      if (serialized.length > 500000) return json({ error: "The report is too large to save." }, 413);
      const score = report.score || {};
      const percent = Number(score.percent);
      const questions = Number(score.questionsAnswered);
      const correct = Number(score.correct);
      const passed = Number(score.skillsPassedOrSecure);
      const extended = Number(score.skillsExtended);
      const completedAt = Date.parse(String(report.completedAt || ""));
      if (!Number.isFinite(percent) || percent < 0 || percent > 100 ||
          !Number.isInteger(questions) || questions < 0 || questions > 500 ||
          !Number.isInteger(correct) || correct < 0 || correct > questions ||
          !Number.isInteger(passed) || passed < 0 || passed > 25 ||
          !Number.isInteger(extended) || extended < 0 || extended > 25 ||
          !Number.isFinite(completedAt)) {
        return json({ error: "The diagnostic report has invalid score data." }, 400);
      }
      // Identity comes from the validated session, never from student-supplied report fields.
      const safeReport = {
        schemaVersion: Number(report.schemaVersion) || 1,
        testName: "A2 Adaptive Grammar Diagnostic",
        completedAt: new Date(completedAt).toISOString(),
        student: {
          className: String(session.students.class_id || ""),
          studentCode: String(session.students.student_code || ""),
          studentName: String(session.students.display_name || session.students.student_code || ""),
        },
        score: { questionsAnswered: questions, correct, percent, skillsPassedOrSecure: passed, skillsExtended: extended },
        skills: Array.isArray(report.skills) ? report.skills.slice(0, 25) : [],
        answers: Array.isArray(report.answers) ? report.answers.slice(0, 500) : [],
      };
      const { data: saved, error: saveErr } = await db.from("diagnostic_results").insert({
        school_id: session.school_id,
        student_id: session.student_id,
        diagnostic_key: "a2-adaptive-grammar-v1",
        completed_at: safeReport.completedAt,
        overall_percent: percent,
        questions_answered: questions,
        correct_count: correct,
        skills_passed_or_secure: passed,
        skills_extended: extended,
        report: safeReport,
      }).select("id,completed_at").single();
      if (saveErr) throw saveErr;
      return json({ ok: true, resultId: saved.id, completedAt: saved.completed_at });
    }

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
      if (questions.length > 500) return json({ error: "This assessment is too large to deliver." }, 422);
      const seenQuestionIds = new Set<string>();
      for (const q of questions) {
        const id = String(q?.id ?? "");
        const opts = Array.isArray(q?.options) ? q.options.filter((o: any) => String(o?.text ?? "").trim().length > 0) : [];
        const correct = Array.isArray(q?.options) ? q.options.filter((o: any) => o?.correct === true && String(o?.text ?? "").trim().length > 0) : [];
        if (!id || seenQuestionIds.has(id) || !String(q?.prompt ?? "").trim() || opts.length < 2 || correct.length !== 1) {
          return json({ error: "This assessment contains an invalid question. Ask your teacher to review it." }, 422);
        }
        seenQuestionIds.add(id);
      }

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
      let possible = 0, earned = 0, correctCount = 0, answeredCount = 0;
      const answerDetails = questions.map((q: any) => {
        const points = Math.max(1, Number(q.points) || 1);
        possible += points;
        const rawChosen = Object.prototype.hasOwnProperty.call(answers, String(q.id)) ? answers[String(q.id)] : null;
        const chosen = typeof rawChosen === "number" ? rawChosen : (typeof rawChosen === "string" && rawChosen.trim() !== "" ? Number(rawChosen) : NaN);
        const nonblankOptions = Array.isArray(q.options) ? q.options.map((o: any, index: number) => ({ o, index })).filter((x: any) => String(x.o?.text ?? "").trim().length > 0) : [];
        const valid = Number.isInteger(chosen) && nonblankOptions.some((x: any) => x.index === chosen);
        const correctIndex = Array.isArray(q.options) ? q.options.findIndex((o: any) => o.correct === true && String(o.text ?? "").trim().length > 0) : -1;
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
      const feedback = data.feedback === "explanations" ? answerDetails.map((a: any, i: number) => ({
        questionId: a.questionId, correct: a.correct,
        correctOption: questions[i]?.options?.find((o: any) => o.correct === true)?.text || "",
        explanation: questions[i]?.explanation || "",
      })) : null;
      return json({ scorePercent: percent, correctCount, questionsAnswered: answeredCount, totalQuestions: questions.length, possiblePoints: possible, earnedPoints: earned, feedback: feedback });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("student-assessment error", error);
    return json({ error: "The request could not be completed. Check server logs for details." }, 500);
  }
});
