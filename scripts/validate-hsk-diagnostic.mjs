import fs from "node:fs";
import assert from "node:assert/strict";

const root = process.cwd();
const seedPath = "supabase/migrations/202611050002_hsk1_question_bank_seed.sql";
const picturePath = "supabase/migrations/202611050003_hsk1_picture_question_bank.sql";
const audioPath = "supabase/functions/hsk-audio/index.ts";
const assessmentPath = "supabase/functions/student-assessment/index.ts";
const studentPath = "hsk-diagnostic.html";
const managerPath = "hsk-audio-manager.html";

const read = (path) => fs.readFileSync(root + "/" + path, "utf8");

function readRows(path) {
  return read(path).split(/\r?\n/).filter((line) => /^\s*\('hsk[123]-/.test(line));
}

function validateRows(path, expectedCount, expectedSkill) {
  const rows = readRows(path);
  assert.equal(rows.length, expectedCount, path + ": unexpected row count");
  const ids = new Set();
  const counts = {};
  for (const line of rows) {
    const head = line.match(/^\s*\('([^']+)',\s*(\d+),\s*'([^']+)'/);
    assert.ok(head, path + ": malformed row header");
    const [, id, level, skill] = head;
    assert.match(id, /^hsk[123]-[a-z0-9-]+$/);
    assert.ok(!ids.has(id), path + ": duplicate question id " + id);
    ids.add(id);
    assert.equal(Number(level), 1, id + ": seed should be HSK 1");
    counts[skill] = (counts[skill] || 0) + 1;

    const data = line.match(/,\s*'(\[[^\n]*\])'::jsonb,\s*'(\{"correctIndex":\d+\})'::jsonb/);
    assert.ok(data, id + ": options or answer key not found");
    const options = JSON.parse(data[1]);
    const key = JSON.parse(data[2]);
    assert.ok(Array.isArray(options) && options.length >= 2, id + ": at least two options required");
    assert.ok(Number.isInteger(key.correctIndex) && key.correctIndex >= 0 && key.correctIndex < options.length,
      id + ": correctIndex is outside the options");
  }
  assert.deepEqual(counts, expectedSkill, path + ": unexpected skill distribution");
  return rows;
}

const mainRows = validateRows(seedPath, 75, {
  vocabulary: 15,
  character_recognition: 15,
  reading: 15,
  grammar: 15,
  listening: 15,
});
const pictureRows = validateRows(picturePath, 15, { picture_recognition: 15 });

for (const line of mainRows.filter((row) => row.includes("'listening'"))) {
  assert.match(line, /'[\u4e00-\u9fff！？，。]+','pending'/, "Listening items need a Chinese script and pending audio state");
}
for (const line of pictureRows) {
  assert.match(line, /<svg[\s\S]*<\/svg>/, "Picture items need an embedded SVG illustration");
}

const audio = read(audioPath);
const assessment = read(assessmentPath);
const student = read(studentPath);
const manager = read(managerPath);
assert.match(audio, /audioText:\s*String\(q\.audio_text\s*\|\|\s*""\)/, "Teacher audio list must return the script");
assert.ok(audio.indexOf("if (!geminiKey)") > audio.indexOf('if (action !== "generate")'),
  "Gemini key must only be required for generation");
assert.match(manager, /esc\(q\.audioText\)/, "Teacher audio page must show escaped Mandarin script");
assert.match(student, /q\.stimulus&&skill!=='listening'/, "Listening transcript must remain hidden from students");
assert.match(assessment, /function safeHskMetadata/, "Student metadata must be whitelisted");
assert.equal((assessment.match(/metadata:safeHskMetadata\(q\.metadata\)/g) || []).length, 2,
  "Both HSK question delivery rounds must use safe metadata");

for (const page of [studentPath, managerPath, "student-portal.html", "assessment-library.html"]) {
  const html = read(page);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0, page + ": no inline JavaScript found");
  scripts.forEach((source, index) => {
    try {
      new Function("return (async function(){\n" + source + "\n})()");
    } catch (error) {
      throw new Error(page + ": inline script " + (index + 1) + " has a syntax error: " + error.message);
    }
  });
}

console.log("HSK validation passed: question bank, answer keys, student/audio safeguards, and inline page JavaScript syntax.");
