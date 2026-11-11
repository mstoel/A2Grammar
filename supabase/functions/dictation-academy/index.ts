import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const LEVELS = ["Pre-A1","A1","A1+","A2","A2+","B1","B1+","B2","B2+","C1","C1+","C2","C2+"];
// Treat common US and UK spelling variants as equivalent in dictation answers.
const SPELLING_EQUIVALENTS: Record<string, string> = {};
const SPELLING_PAIRS: Array<[string, string]> = [
  ["color", "colour"], ["colors", "colours"], ["colored", "coloured"], ["coloring", "colouring"],
  ["favorite", "favourite"], ["favorites", "favourites"],
  ["neighbor", "neighbour"], ["neighbors", "neighbours"], ["neighboring", "neighbouring"], ["neighborhood", "neighbourhood"], ["neighborhoods", "neighbourhoods"],
  ["harbor", "harbour"], ["harbors", "harbours"],
  ["center", "centre"], ["centers", "centres"], ["centered", "centred"], ["centering", "centring"],
  ["theater", "theatre"], ["theaters", "theatres"],
  ["gray", "grey"],
  ["traveling", "travelling"], ["traveled", "travelled"], ["traveler", "traveller"], ["travelers", "travellers"],
  ["canceling", "cancelling"], ["canceled", "cancelled"],
  ["organize", "organise"], ["organizes", "organises"], ["organized", "organised"], ["organizing", "organising"], ["organization", "organisation"], ["organizations", "organisations"],
  ["recognize", "recognise"], ["recognizes", "recognises"], ["recognized", "recognised"], ["recognizing", "recognising"],
  ["realize", "realise"], ["realizes", "realises"], ["realized", "realised"], ["realizing", "realising"],
  ["analyze", "analyse"], ["analyzes", "analyses"], ["analyzed", "analysed"], ["analyzing", "analysing"],
  ["behavior", "behaviour"], ["behaviors", "behaviours"],
  ["honor", "honour"], ["honors", "honours"], ["honored", "honoured"], ["honoring", "honouring"],
  ["humor", "humour"], ["labor", "labour"], ["labors", "labours"],
  ["favor", "favour"], ["favors", "favours"], ["favored", "favoured"], ["favoring", "favouring"],
  ["flavor", "flavour"], ["flavors", "flavours"], ["flavored", "flavoured"],
  ["rumor", "rumour"], ["rumors", "rumours"],
  ["defense", "defence"], ["defenses", "defences"], ["offense", "offence"], ["offenses", "offences"],
  ["jewelry", "jewellery"], ["mold", "mould"], ["molds", "moulds"], ["molded", "moulded"], ["molding", "moulding"],
  ["fulfill", "fulfil"], ["fulfillment", "fulfilment"],
  ["enrollment", "enrolment"], ["enroll", "enrol"],
  ["aging", "ageing"], ["labeled", "labelled"], ["labeling", "labelling"],
  ["modeled", "modelled"], ["modeling", "modelling"]
];
for (const [us, uk] of SPELLING_PAIRS) {
  SPELLING_EQUIVALENTS[us] = uk;
  SPELLING_EQUIVALENTS[uk] = uk;
}
const normalize = (value: unknown) => {
  const answer = String(value ?? "").trim().normalize("NFC").toLocaleLowerCase("en");
  return SPELLING_EQUIVALENTS[answer] || answer;
};

async function getSession(req: Request, db: any) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 40) throw new Error("Please sign in again.");
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const hash = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await db.from("student_sessions")
    .select("id,student_id,school_id,expires_at,revoked_at,students(id,class_id,student_code,display_name,is_active)")
    .eq("token_hash", hash).maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now() || !data.students?.is_active) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return data;
}

async function levelPassed(db: any, studentId: string, level: string) {
  const { data, error } = await db.from("dictation_attempts").select("id")
    .eq("student_id", studentId).eq("level_code", level).eq("attempt_type", "assessment").eq("status", "completed").gte("score_percent", 95).limit(1);
  if (error) throw error;
  return !!data?.length;
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
    const action = String(body.action || "");
    const session = await getSession(req, db);
    const studentId = session.student_id;
    const schoolId = session.school_id;

    if (action === "dashboard") {
      const [{ data: words, error: wordErr }, { data: attempts, error: attemptErr }, { data: responses, error: responseErr }] = await Promise.all([
        db.from("dictation_words").select("id,level_code").eq("is_active", true),
        db.from("dictation_attempts").select("level_code,attempt_type,score_percent,correct_count,total_questions,completed_at,status").eq("student_id", studentId),
        db.from("dictation_responses").select("level_code,word_id,is_correct").eq("student_id", studentId).eq("is_correct", true)
      ]);
      if (wordErr) throw wordErr; if (attemptErr) throw attemptErr; if (responseErr) throw responseErr;
      const mastered = new Map<string, Set<string>>();
      for (const row of responses || []) {
        if (!mastered.has(row.level_code)) mastered.set(row.level_code, new Set());
        mastered.get(row.level_code)!.add(row.word_id);
      }
      const completed = (attempts || []).filter((a: any) => a.status === "completed");
      let previousPassed = true;
      const levels = LEVELS.map((level) => {
        const levelAttempts = completed.filter((a: any) => a.level_code === level);
        const passed = levelAttempts.some((a: any) => a.attempt_type === "assessment" && Number(a.score_percent) >= 95);
        const result = {
          level,
          unlocked: previousPassed,
          passed,
          attempts: levelAttempts.length,
          bestScore: levelAttempts.length ? Math.max(...levelAttempts.map((a: any) => Number(a.score_percent) || 0)) : null,
          mastered: mastered.get(level)?.size || 0,
          totalWords: (words || []).filter((w: any) => w.level_code === level).length,
          lastAttempt: levelAttempts.map((a: any) => a.completed_at).filter(Boolean).sort().at(-1) || null
        };
        previousPassed = previousPassed && passed;
        return result;
      });
      return json({ student: session.students.display_name || session.students.student_code, className: "", levels });
    }

    if (action === "level-detail") {
      const level = String(body.level || "");
      if (!LEVELS.includes(level)) return json({ error: "Unknown level." }, 400);
      const idx = LEVELS.indexOf(level);
      if (idx > 0 && !(await levelPassed(db, studentId, LEVELS[idx - 1]))) {
        return json({ error: "Pass the previous level to unlock this level." }, 403);
      }
      const [{ data: words, error: wordErr }, { data: ownResponses, error: ownErr }, { data: attempts, error: attemptErr }, { data: allResponses, error: allErr }] = await Promise.all([
        db.from("dictation_words").select("id,word,sentence").eq("level_code", level).eq("is_active", true).order("word"),
        db.from("dictation_responses").select("word_id,is_correct,typed_answer,created_at").eq("student_id", studentId).eq("level_code", level),
        db.from("dictation_attempts").select("score_percent,correct_count,total_questions,completed_at,attempt_type").eq("student_id", studentId).eq("level_code", level).eq("status", "completed").order("completed_at", { ascending: false }),
        db.from("dictation_responses").select("word_id,is_correct").eq("school_id", schoolId).eq("level_code", level)
      ]);
      if (wordErr) throw wordErr; if (ownErr) throw ownErr; if (attemptErr) throw attemptErr; if (allErr) throw allErr;
      const ownMastered = new Set((ownResponses || []).filter((r: any) => r.is_correct).map((r: any) => r.word_id));
      const totals = new Map<string, { total: number; failed: number }>();
      for (const r of allResponses || []) {
        const t = totals.get(r.word_id) || { total: 0, failed: 0 };
        t.total++; if (!r.is_correct) t.failed++;
        totals.set(r.word_id, t);
      }
      const wordById = new Map((words || []).map((w: any) => [w.id, w]));
      const difficultWords = Array.from(totals.entries()).map(([id, t]) => {
        const w: any = wordById.get(id);
        return w && t.total >= 10 ? { word: w.word, attempts: t.total, failRate: Math.round(t.failed / t.total * 100) } : null;
      }).filter((w: any) => w && w.failRate > 50).sort((a: any, b: any) => b.failRate - a.failRate);
      const bestScore = (attempts || []).filter((a: any) => a.attempt_type === "assessment").reduce((best: number, a: any) => Math.max(best, Number(a.score_percent) || 0), 0);
      return json({
        level, totalWords: (words || []).length, mastered: ownMastered.size,
        passed: (attempts || []).some((a: any) => a.attempt_type === "assessment" && Number(a.score_percent) >= 95),
        attempts: attempts || [], bestScore,
        difficultWords,
        words: (words || []).map((w: any) => {
          const history = (ownResponses || []).filter((r: any) => r.word_id === w.id).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const latest = history[0];
          const mistakeCount = history.filter((r: any) => !r.is_correct).length;
          return { id: w.id, word: w.word, mastered: ownMastered.has(w.id), attempted: history.length > 0, lastCorrect: latest ? !!latest.is_correct : null, lastAnswer: latest?.typed_answer || "", attempts: history.length, mistakeCount };
        })
      });
    }

    if (action === "start") {
      const level = String(body.level || "");
      const mode = body.mode === "practice" ? "practice" : "assessment";
      if (!LEVELS.includes(level)) return json({ error: "Unknown level." }, 400);
      const idx = LEVELS.indexOf(level);
      if (idx > 0 && !(await levelPassed(db, studentId, LEVELS[idx - 1]))) return json({ error: "Pass the previous level to unlock this level." }, 403);
      const [{ data: bank, error }, { data: history, error: historyErr }] = await Promise.all([
        db.from("dictation_words").select("id,word,sentence").eq("level_code", level).eq("is_active", true),
        db.from("dictation_responses").select("word_id,is_correct,created_at").eq("student_id", studentId).eq("level_code", level)
      ]);
      if (error) throw error;
      if (historyErr) throw historyErr;
      if (!bank || bank.length < 25) return json({ error: "This level needs at least 25 published words before a test can start." }, 409);
      const shuffle = (items: any[]) => [...items].sort(() => Math.random() - 0.5);
      const historyByWord = new Map<string, any[]>();
      for (const response of history || []) {
        const list = historyByWord.get(response.word_id) || [];
        list.push(response);
        historyByWord.set(response.word_id, list);
      }
      const newWords = bank.filter((w: any) => !historyByWord.has(w.id));
      const mistakeWords = bank.filter((w: any) => (historyByWord.get(w.id) || []).some((r: any) => !r.is_correct))
        .sort((a: any, b: any) => {
          const mistakesA = (historyByWord.get(a.id) || []).filter((r: any) => !r.is_correct).length;
          const mistakesB = (historyByWord.get(b.id) || []).filter((r: any) => !r.is_correct).length;
          return mistakesB - mistakesA;
        });
      const passedWords = bank.filter((w: any) => {
        const h = historyByWord.get(w.id) || [];
        return h.some((r: any) => r.is_correct) && !h.some((r: any) => !r.is_correct);
      });
      const mistakePickCount = Math.min(5, mistakeWords.length);
      const newTarget = 15 + (5 - mistakePickCount);
      const newPick = shuffle(newWords).slice(0, Math.min(newTarget, newWords.length));
      const passedTarget = 5 + Math.max(0, newTarget - newPick.length);
      const passedPick = shuffle(passedWords).slice(0, Math.min(passedTarget, passedWords.length));
      const selectedIds = new Set([...newPick, ...mistakeWords.slice(0, mistakePickCount), ...passedPick].map((w: any) => w.id));
      const selected = [...newPick, ...mistakeWords.slice(0, mistakePickCount), ...passedPick];
      if (selected.length < 25) {
        const remaining = shuffle(bank.filter((w: any) => !selectedIds.has(w.id)));
        selected.push(...remaining.slice(0, 25 - selected.length));
      }
      if (selected.length < 25) return json({ error: "Not enough unique words are available for this test." }, 409);
      const shuffled = shuffle(selected).slice(0, 25);
      const { data: attempt, error: insertErr } = await db.from("dictation_attempts").insert({
        student_id: studentId, school_id: schoolId, level_code: level, attempt_type: mode, question_word_ids: shuffled.map((w: any) => w.id)
      }).select("id").single();
      if (insertErr) throw insertErr;
      return json({ attemptId: attempt.id, level, mode, questions: shuffled.map((w: any) => ({ id: w.id, word: w.word, sentence: w.sentence })) });
    }

    if (action === "submit") {
      const attemptId = String(body.attemptId || "");
      const answers = body.answers;
      if (!attemptId || !answers || typeof answers !== "object" || Array.isArray(answers)) return json({ error: "Missing answers." }, 400);
      const { data: attempt, error: attemptErr } = await db.from("dictation_attempts").select("id,level_code,attempt_type,question_word_ids,status")
        .eq("id", attemptId).eq("student_id", studentId).eq("school_id", schoolId).maybeSingle();
      if (attemptErr) throw attemptErr;
      if (!attempt || attempt.status !== "in_progress" || !Array.isArray(attempt.question_word_ids) || attempt.question_word_ids.length !== 25) {
        return json({ error: "This test is no longer available for submission." }, 409);
      }
      const { data: bank, error: bankErr } = await db.from("dictation_words").select("id,word")
        .in("id", attempt.question_word_ids).eq("level_code", attempt.level_code).eq("is_active", true);
      if (bankErr) throw bankErr;
      const bankById = new Map((bank || []).map((w: any) => [w.id, w.word]));
      if (bankById.size !== 25) return json({ error: "The word bank changed during this test. Please start again." }, 409);
      const rows = attempt.question_word_ids.map((id: string) => {
        const expected = normalize(bankById.get(id));
        const typed = normalize(answers[id]);
        return { attempt_id: attemptId, student_id: studentId, school_id: schoolId, level_code: attempt.level_code,
          word_id: id, typed_answer: String(answers[id] ?? "").trim().slice(0, 100), is_correct: !!typed && typed === expected };
      });
      const correct = rows.filter((r: any) => r.is_correct).length;
      const score = Math.round(correct / 25 * 10000) / 100;
      const { error: responseErr } = await db.from("dictation_responses").insert(rows);
      if (responseErr) throw responseErr;
      const { error: updateErr } = await db.from("dictation_attempts").update({
        correct_count: correct, score_percent: score, status: "completed", completed_at: new Date().toISOString()
      }).eq("id", attemptId).eq("student_id", studentId);
      if (updateErr) throw updateErr;
      const passed = attempt.attempt_type === "assessment" && score >= 95;
      const { data: allCorrect, error: masteredErr } = await db.from("dictation_responses").select("word_id")
        .eq("student_id", studentId).eq("level_code", attempt.level_code).eq("is_correct", true);
      if (masteredErr) throw masteredErr;
      const mastered = new Set((allCorrect || []).map((r: any) => r.word_id)).size;
      return json({ correct, total: 25, score, passed, mode: attempt.attempt_type, mastered, totalWords: 250 });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("dictation-academy error", error);
    const message = error instanceof Error ? error.message : "The request could not be completed.";
    const status = /sign in again|session has expired/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});
