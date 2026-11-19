// Geometry and OCR parsing are independent of the PDF/OCR libraries.
const layoutError = () => new Error('Layout não reconhecido. Use a folha mensal do AZC, de uma página, no modelo Controle de Presença e Horas de Trabalho.');

function groups(values) {
  const result = [];
  for (const value of values) {
    const last = result.at(-1);
    if (last && value === last.end + 1) last.end = value;
    else result.push({ start: value, end: value });
  }
  return result.map(line => ({ ...line, center: (line.start + line.end) / 2 }));
}

export function detectGrid({ width, height, data }) {
  const rowCounts = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 450) rowCounts[y]++;
    }
  }
  const horizontal = groups(Array.from(rowCounts.keys()).filter(y => rowCounts[y] > width * 0.7));
  let boundaries = [];
  for (let start = 0; start < horizontal.length - 1; start++) {
    const step = horizontal[start + 1].center - horizontal[start].center;
    if (step < height * 0.007 || step > height * 0.025) continue;
    const run = [horizontal[start]];
    for (let j = start + 1; j < horizontal.length; j++) {
      const gap = horizontal[j].center - run.at(-1).center;
      if (Math.abs(gap - step) > step * 0.22) break;
      run.push(horizontal[j]);
    }
    if (run.length > boundaries.length) boundaries = run;
  }
  if (boundaries.length < 29 || boundaries.length > 32) throw layoutError();
  const top = boundaries[0].center;
  const bottom = boundaries.at(-1).center;
  const rowHeight = (bottom - top) / (boundaries.length - 1);
  const verticalPixels = [];
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = Math.ceil(top); y < bottom; y++) {
      const i = (y * width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < 450) count++;
    }
    if (count > (bottom - top) * 0.8) verticalPixels.push(x);
  }
  const vertical = groups(verticalPixels);
  if (vertical.length !== 9) throw layoutError();
  const columns = vertical.map(line => line.center);
  const tableWidth = columns.at(-1) - columns[0];
  const expected = [0, 0.077, 0.171, 0.304, 0.468, 0.769, 0.828, 0.885, 1];
  if (columns.some((x, i) => Math.abs((x - columns[0]) / tableWidth - expected[i]) > 0.025)) throw layoutError();
  const headerTop = horizontal.filter(line => line.center < top - rowHeight).at(-1)?.center;
  if (!headerTop) throw layoutError();
  return { columns, boundaries: boundaries.map(line => line.center), horizontal, vertical, top, bottom, rowHeight, headerTop };
}

export function normalizeText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] !== b[j - 1]));
    }
    previous = current;
  }
  return previous[b.length];
}

export function parseOccurrence(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  if (distance(normalized, 'FERIADO') <= 1) return 'FERIADO';
  if (distance(normalized, 'PONTOFACULTATIVO') <= 3) return 'PONTO FACULTATIVO';
  return '';
}

function validDate(day, month, year) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 2000 && year <= 2100 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parsePeriod(text) {
  const compact = text.normalize('NFD').replace(/[\u0300-\u036f\s]/g, '').toUpperCase();
  const match = compact.match(/PERIODO[:;]?(\d{2})\/(\d{2})\/(\d{4})A(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) throw new Error('Não foi possível ler o período da folha. Tente gerar o PDF novamente no AZC.');
  const [day, month, year, endDay, endMonth, endYear] = match.slice(1).map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!validDate(day, month, year) || !validDate(endDay, endMonth, endYear) || day !== 1 || month !== endMonth || year !== endYear || endDay !== lastDay) {
    throw new Error('A importação aceita uma folha de um mês completo. Confira o período selecionado no AZC.');
  }
  return { month, year };
}

// Each TSV word retains its vertical position, including gaps for empty days.
export function groupOcrRows(tsv, grid, cropTop, scale) {
  const rows = Array.from({ length: grid.boundaries.length - 1 }, () => []);
  for (const line of tsv.split('\n').slice(1)) {
    const values = line.replace(/\r$/, '').split('\t');
    if (values[0] !== '5' || values.length < 12) continue;
    const text = values.slice(11).join('\t').trim();
    if (!text) continue;
    const y = cropTop + (Number(values[7]) + Number(values[9]) / 2) / scale;
    const row = grid.boundaries.findIndex((boundary, i) => i < rows.length && y >= boundary && y < grid.boundaries[i + 1]);
    if (row >= 0) rows[row].push({ text, x: Number(values[6]) });
  }
  return rows.map(words => words.sort((a, b) => a.x - b.x).map(word => word.text).join(' '));
}

export function buildTimesheet(period, dates, punches, occurrences) {
  const daysInMonth = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  if (dates.length !== daysInMonth || punches.length !== dates.length || occurrences.length !== dates.length) throw new Error('A quantidade de dias da tabela não corresponde ao período da folha.');
  const seen = new Set();
  const data = dates.map((text, index) => {
    const match = text.replace(/\s/g, '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    const [day, month, year] = match ? match.slice(1).map(Number) : [];
    if (!match || !validDate(day, month, year) || month !== period.month || year !== period.year || seen.has(day) || day !== index + 1) {
      throw new Error(`Data ilegível, duplicada ou fora de ordem na linha ${index + 1}. Gere um novo PDF no AZC.`);
    }
    seen.add(day);
    const rawPunches = punches[index].trim();
    const tokens = rawPunches.match(/\b\d{1,2}:\d{2}\b/g) || [];
    const extractedPunches = tokens.filter(value => /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(value)).map(value => value.padStart(5, '0'));
    const hasUnreadText = rawPunches.replace(/\b\d{1,2}:\d{2}\b/g, '').trim().length > 0;
    const complete = tokens.length === 4 && extractedPunches.length === 4 && !hasUnreadText;
    const rawOccurrence = occurrences[index].trim();
    const occurrence = parseOccurrence(rawOccurrence);
    const date = new Date(Date.UTC(year, month - 1, day));
    const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(date).toUpperCase();
    return {
      day: `${String(day).padStart(2, '0')} - ${label}`,
      date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      punches: complete ? extractedPunches : [],
      extractedPunches,
      rawPunches,
      occurrence,
      rawOccurrence,
      needsPunchReview: Boolean(rawPunches) && !complete,
      needsOccurrenceReview: Boolean(rawOccurrence) && !occurrence
    };
  });
  return { source: 'pdf', period, data };
}
