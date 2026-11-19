import test from 'node:test';
import assert from 'node:assert/strict';
import { detectGrid, parsePeriod, parseOccurrence, groupOcrRows, buildTimesheet } from '../pdf-parser.js';
import { createPDFHtml, getSpecialLabel, usesStandardHours, validPunches, periodDate } from '../timesheet.js';

const period = { month: 4, year: 2026 };
function monthData() {
  return {
    dates: Array.from({ length: 30 }, (_, index) => `${String(index + 1).padStart(2, '0')}/04/2026 Qua`),
    punches: Array(30).fill('09:00 12:00 13:00 18:00'),
    occurrences: Array(30).fill('')
  };
}
const build = ({ dates, punches, occurrences }) => buildTimesheet(period, dates, punches, occurrences);

test('reads full-month period despite OCR whitespace, rejects partial/multiple months and invalid dates', () => {
  assert.deepEqual(parsePeriod('Período:0 1/04/2026 a 30/04/2026'), period);
  assert.deepEqual(parsePeriod('Período:01/02/2028 a 29/02/2028'), { month: 2, year: 2028 });
  for (const text of ['01/04/2026 a 30/04/2026', 'Período:02/04/2026 a 30/04/2026', 'Período:01/04/2026 a 01/05/2026', 'Período:01/02/2026 a 29/02/2026']) assert.throws(() => parsePeriod(text));
});

test('recognizes known occurrence typos without classifying unrelated text', () => {
  assert.equal(parseOccurrence('PONIO FACULIAIIVO'), 'PONTO FACULTATIVO');
  assert.equal(parseOccurrence('PUNTO FACULIALIVO'), 'PONTO FACULTATIVO');
  assert.equal(parseOccurrence('FERIAD0'), 'FERIADO');
  assert.equal(parseOccurrence('ATESTADO MÉDICO'), '');
  assert.equal(parseOccurrence(''), '');
});

test('rejects missing, duplicate, out-of-month and out-of-order dates', () => {
  for (const value of ['01/04/2026', '02/05/2026', '', '31/04/2026', '03/04/2026']) {
    const input = monthData(); input.dates[1] = value;
    assert.throws(() => build(input), /Data ilegível/);
  }
  const input = monthData(); input.dates.pop();
  assert.throws(() => build(input), /quantidade de dias/);
});

test('keeps ambiguous punches as reference without assigning them to entry/exit fields', () => {
  const input = monthData();
  input.punches[1] = '12:00 13:00 18:00';
  input.punches[2] = '09:00 12:00 13:00 18/00';
  input.punches[3] = '09:00 12:00 13:00 28:00';
  input.punches[4] = '09:00 12:00 13:00 18:00 19:00';
  input.punches[5] = '';
  const result = build(input);
  assert.deepEqual(result.data[0].punches, ['09:00', '12:00', '13:00', '18:00']);
  for (const row of result.data.slice(1, 5)) {
    assert.deepEqual(row.punches, []);
    assert.equal(row.needsPunchReview, true);
    assert.ok(row.rawPunches);
  }
  assert.deepEqual(result.data[1].extractedPunches, ['12:00', '13:00', '18:00']);
  assert.equal(result.data[5].needsPunchReview, false);
  assert.deepEqual(result.data[5].punches, []);
});

test('preserves unknown occurrences for review and derives weekdays from the date', () => {
  const input = monthData(); input.occurrences[0] = 'ATESTADO';
  const result = build(input);
  assert.equal(result.data[0].needsOccurrenceReview, true);
  assert.equal(result.data[0].rawOccurrence, 'ATESTADO');
  assert.equal(result.data[3].day, '04 - SÁBADO');
});

test('uses word coordinates to retain empty days between OCR rows', () => {
  const tsv = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n' +
    '5\t1\t1\t1\t1\t1\t40\t6\t20\t6\t90\t12:00\n' +
    '5\t1\t1\t1\t1\t2\t10\t6\t20\t6\t90\t09:00\n' +
    '5\t1\t1\t1\t2\t1\t10\t66\t20\t6\t90\t18:00\n';
  assert.deepEqual(groupOcrRows(tsv, { boundaries: [100, 110, 120, 130] }, 100, 3), ['09:00 12:00', '', '18:00']);
});

test('detects table geometry at different raster sizes and rejects incompatible layouts', () => {
  for (const scale of [1, 2]) {
    const width = 1000 * scale, height = 700 * scale;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const black = (x, y) => { const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; };
    const columns = [30, 100, 190, 310, 460, 740, 790, 850, 940].map(x => x * scale);
    const lines = [20, 60, 90, 120, ...Array.from({ length: 30 }, (_, i) => 130 + i * 10), 620].map(y => y * scale);
    for (const y of lines) for (let x = columns[0]; x <= columns.at(-1); x++) black(x, y);
    for (const x of columns) for (let y = 120 * scale; y <= 420 * scale; y++) black(x, y);
    const grid = detectGrid({ width, height, data });
    assert.equal(grid.boundaries.length, 31);
    assert.equal(grid.headerTop, 90 * scale);
    assert.equal(grid.columns[2], 190 * scale);
  }
  assert.throws(() => detectGrid({ width: 10, height: 10, data: new Uint8ClampedArray(400).fill(255) }), /Layout/);
});

test('preserves special days, including weekend work, and validates actual HH:mm values', () => {
  const saturday = { day: '04 - SÁBADO', punches: [], rawPunches: '' };
  assert.equal(getSpecialLabel(saturday, 'pdf'), 'SÁBADO');
  assert.equal(getSpecialLabel({ ...saturday, rawPunches: '09:00 12:00 13:00 18:00' }, 'pdf'), '');
  assert.equal(getSpecialLabel({ ...saturday, occurrence: 'FERIADO' }, 'pdf'), 'FERIADO');
  assert.equal(usesStandardHours({ ...saturday, rawPunches: '09:00' }, 'pdf'), false);
  assert.equal(usesStandardHours({ day: '01 - SEGUNDA', punches: [], occurrence: 'PONTO FACULTATIVO' }, 'pdf'), false);
  assert.equal(validPunches(['09:00', '12:00', '13:00', '18:00']), true);
  for (const values of [['9:00', '12:00', '13:00', '18:00'], ['24:00', '12:00', '13:00', '18:00'], ['09:60', '12:00', '13:00', '18:00'], ['', '', '', ''], ['P.F', '12:00', '', '']]) assert.equal(validPunches(values), false);
  assert.equal(validPunches(['FERIADO', '', '', '']), true);
});

test('prints the imported month, escapes document text and excludes unsafe image URLs', () => {
  const timesheet = { source: 'pdf', name: '<script>bad()</script>', period, data: [{ day: '01 - QUARTA', punches: ['09:00', '12:00', '13:00', '18:00'], rawOccurrence: '<img src=x onerror=bad()>' }] };
  const html = createPDFHtml(timesheet, '<b>123</b>', 'javascript:bad()', 'DIRETORIA <TESTE>', '"><script>bad()</script>');
  assert.match(html, /ABRIL/);
  assert.match(html, /2026/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=bad\(\)&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x|javascript:/);
  const old = periodDate(); const now = new Date(); now.setDate(1); now.setMonth(now.getMonth() - 1);
  assert.equal(old.getMonth(), now.getMonth()); assert.equal(old.getFullYear(), now.getFullYear());
});
