import { analyze } from './core.js';

// Full works stay local. This is an inspectable corpus analysis, not model training.
export function analyzeWork(text, title = '') {
  const sections = [];
  let current = null;
  const heading = /^(?:[\[【（(](.{1,60})[\]】）)]|((?:(?:final|guitar)\s+)?(?:主歌|副歌|桥段|间奏|前奏|尾声|预副歌|Verse|Chorus|Bridge|Intro|Outro|Solo|Reprise|Final|Pre[- ]?Chorus)\s*[A-Z\d一二三四]*(?:\s*[（(].*?[）)])?))\s*[:：]?$/i;
  let first = true;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { if (current?.lines.length) current = null; continue; }
    if (/^(?:歌曲名|歌名)\s*[:：]/.test(line) || (first && (line === title || /^《[^》]+》$/.test(line)))) { first = false; continue; }
    first = false;
    const label = line.match(heading);
    if (label) {
      current = { name: label[1] || label[2], lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) { current = { name: `段落 ${sections.length + 1}`, lines: [] }; sections.push(current); }
    current.lines.push(line);
  }
  const nonempty = sections.filter(s => s.lines.length);
  const lines = nonempty.flatMap(s => s.lines);
  const frequency = new Map();
  const length = line => [...line.replace(/[\p{P}\p{Z}\s]/gu, '')].length;
  for (const line of lines) frequency.set(line, (frequency.get(line) || 0) + 1);
  return {
    sections: nonempty,
    lineCount: lines.length,
    uniqueLines: [...frequency.keys()],
    repeated: [...frequency].filter(([, count]) => count > 1).map(([text, count]) => ({ text, count })),
    averageLength: lines.length ? Math.round(lines.reduce((n, l) => n + length(l), 0) / lines.length * 10) / 10 : 0,
    lengths: lines.map(length),
  };
}

function learnLine(text) {
  const analysis = analyze(text);
  // Preserve the actual source sentence's ordering and connecting words.
  // Only identified categories become slots; leave unknown language literal.
  const known = analysis.fragments.filter(f => f.type !== '自定义');
  let skeleton = text;
  const used = new Set();
  for (const fragment of [...known].sort((a, b) => b.text.length - a.text.length)) {
    if (used.has(fragment.type)) continue;
    skeleton = skeleton.replace(fragment.text, `{${fragment.type}}`);
    used.add(fragment.type);
  }
  if (typeof Intl.Segmenter === 'function') {
    const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)]
      .filter(s => s.isWordLike && [...s.segment].length > 1).map(s => s.segment);
    const existing = new Set(known.map(f => f.text));
    analysis.fragments = [...known, ...[...new Set(words)].filter(w => !existing.has(w)).map(text => ({ text, type: '词语' }))];
  }
  return { ...analysis, relation: analysis.relation === '碎片并置' ? '原句组织（未判定手法）' : analysis.relation, skeleton: used.size >= 2 ? skeleton : '', notes: '来自历史作品：保留原句组织顺序；词表未识别的句子仅作为语料，不推断句法。' };
}

export function workMaterials(works = [], enabledOnly = false) {
  return works.filter(w => !enabledOnly || w.enabled).flatMap(work => {
    const unique = analyzeWork(work.text, work.title).uniqueLines;
    return unique.map((text, index) => ({
      id: `${work.id}_line_${index}`, workId: work.id, workTitle: work.title,
      text, kind: '历史作品句子', source: `《${work.title}》${work.year ? ' · ' + work.year : ''}`,
      original: true, createdAt: work.createdAt, analysis: learnLine(text),
    }));
  });
}

export function corpusProfile(works = []) {
  const enabled = works.filter(w => w.enabled);
  const analyses = enabled.map(w => analyzeWork(w.text, w.title));
  const materials = workMaterials(enabled);
  const fragments = new Map(), relations = new Map();
  for (const m of materials) {
    for (const f of m.analysis.fragments) fragments.set(f.text, (fragments.get(f.text) || 0) + 1);
    if (m.analysis.skeleton) relations.set(m.analysis.relation, (relations.get(m.analysis.relation) || 0) + 1);
  }
  const lengths = analyses.flatMap(a => a.lengths);
  return {
    works: enabled.length, lines: lengths.length, uniqueLines: materials.length,
    sections: analyses.reduce((n, a) => n + a.sections.length, 0),
    templates: materials.filter(m => m.analysis.skeleton).length,
    repeated: analyses.reduce((n, a) => n + a.repeated.length, 0),
    averageLength: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length * 10) / 10 : 0,
    fragments: [...fragments].sort((a, b) => b[1] - a[1]).slice(0, 16),
    relations: [...relations].sort((a, b) => b[1] - a[1]),
  };
}

export function retrieveWorks(works, theme, limit = 12) {
  const terms = [...new Set(theme.split(/[\s，、]+/).filter(Boolean))];
  const chars = [...new Set([...theme].filter(c => /\p{L}/u.test(c)))];
  const ranked = workMaterials(works, true).map((m, index) => ({
    m, index, score: terms.reduce((n, t) => n + (m.text.includes(t) ? 10 : 0), 0) +
      chars.reduce((n, t) => n + (m.text.includes(t) ? 1 : 0), 0) + (m.analysis.skeleton ? 1 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const perWork = new Map(), chosen = [];
  for (const { m } of ranked) {
    if ((perWork.get(m.workId) || 0) >= Math.max(3, Math.ceil(limit / Math.max(1, works.filter(w => w.enabled).length)))) continue;
    if (chosen.some(x => x.text === m.text)) continue;
    chosen.push(m); perWork.set(m.workId, (perWork.get(m.workId) || 0) + 1);
    if (chosen.length >= limit) break;
  }
  return chosen;
}
