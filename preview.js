import { createPDFHtml, getSpecialLabel, periodDate, standardHours, usesStandardHours, validPunches, isTime } from './timesheet.js';

const tbody = document.querySelector('#timesheetTable tbody');
const btnFinish = document.getElementById('btnFinish');
const standardHoursToggle = document.getElementById('standardHoursToggle');
const extractedModeLabel = document.getElementById('extractedModeLabel');
const standardModeLabel = document.getElementById('standardModeLabel');
const modeHint = document.getElementById('modeHint');
const extractedHours = {};
const customStandardHours = {};
let draftData;

function addNote(cell, text) {
  const note = document.createElement('small');
  note.className = 'source-note';
  note.textContent = text;
  cell.appendChild(note);
}

function renderTable() {
  const timesheet = draftData.timesheet;
  if (timesheet.source === 'pdf') {
    const summary = document.getElementById('importSummary');
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(periodDate(timesheet.period));
    summary.textContent = `PDF do AZC · ${month} · ${timesheet.data.length} dias. Confira os horários e as ocorrências reconhecidos antes de gerar a folha.`;
    summary.hidden = false;
  }
  tbody.replaceChildren();
  timesheet.data.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    const day = tr.insertCell();
    const strong = document.createElement('strong');
    strong.textContent = item.day;
    day.appendChild(strong);
    const special = getSpecialLabel(item, timesheet.source);
    if (special) {
      const cell = tr.insertCell();
      cell.colSpan = 4;
      cell.className = 'special-day';
      cell.textContent = special;
    } else {
      const p = item.punches || [];
      const legacyBlank = timesheet.source !== 'pdf' && !p.some(value => value?.trim());
      for (let type = 0; type < 4; type++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.index = index;
        input.dataset.type = type;
        input.value = p[type] || (type === 0 && legacyBlank ? 'P.F' : '');
        input.placeholder = '00:00';
        input.setAttribute('aria-label', `${item.day}: ${['Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'][type]}`);
        tr.insertCell().appendChild(input);
      }
    }
    if (timesheet.source === 'pdf') {
      if (item.needsPunchReview) addNote(day, `Marcações lidas: ${item.rawPunches}. Confira a posição de cada horário.`);
      if (item.occurrence) addNote(day, item.occurrence);
      if (item.needsOccurrenceReview) {
        addNote(day, `Ocorrência lida: ${item.rawOccurrence}`);
        const label = document.createElement('label');
        label.className = 'review-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.review = index;
        checkbox.checked = Boolean(item.occurrenceReviewed);
        label.append(checkbox, document.createTextNode('Ocorrência conferida'));
        day.appendChild(label);
      }
    }
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('tr').forEach(row => {
    extractedHours[row.dataset.index] = Array.from(row.querySelectorAll('input[type="text"]'), input => input.value);
  });
  updateScheduleMode(false);
}

function validateRow(row) {
  const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
  const values = inputs.map(input => input.value);
  const firstIsLeave = ['P.F', 'FERIADO'].includes(values[0]?.trim().toUpperCase());
  const review = row.querySelector('input[type="checkbox"]');
  const complete = (!inputs.length || validPunches(values)) && (!review || review.checked);
  row.classList.toggle('incomplete-row', !complete);
  inputs.forEach((input, index) => {
    const value = input.value.trim().toUpperCase();
    const invalid = firstIsLeave ? index > 0 && Boolean(value) : !isTime(value);
    input.setAttribute('aria-invalid', String(invalid));
  });
  if (review) review.setAttribute('aria-invalid', String(!review.checked));
  return complete;
}

function validateRows() {
  return Array.from(tbody.querySelectorAll('tr')).map(validateRow).every(Boolean);
}

function updateScheduleMode(useStandard) {
  tbody.querySelectorAll('tr').forEach(row => {
    const index = Number(row.dataset.index);
    const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
    if (!inputs.length) return;
    if (useStandard && !customStandardHours[index]) {
      customStandardHours[index] = usesStandardHours(draftData.timesheet.data[index], draftData.timesheet.source)
        ? [...standardHours] : [...extractedHours[index]];
    }
    const values = useStandard ? customStandardHours[index] : extractedHours[index];
    inputs.forEach((input, i) => { input.value = values[i] || ''; });
  });
  extractedModeLabel.classList.toggle('active', !useStandard);
  standardModeLabel.classList.toggle('active', useStandard);
  modeHint.textContent = useStandard
    ? 'Dias úteis usarão 09:00, 12:00, 13:00 e 18:00. Feriados, pontos facultativos e dias especiais serão preservados.'
    : 'Usando as marcações extraídas do ponto eletrônico.';
  validateRows();
}

tbody.addEventListener('input', event => {
  const row = event.target.closest('tr');
  if (!row) return;
  const hours = Array.from(row.querySelectorAll('input[type="text"]'), input => input.value);
  (standardHoursToggle.checked ? customStandardHours : extractedHours)[row.dataset.index] = hours;
  validateRow(row);
});
standardHoursToggle.addEventListener('change', () => updateScheduleMode(standardHoursToggle.checked));

btnFinish.addEventListener('click', async () => {
  if (!draftData) return;
  if (!validateRows()) {
    alert('Confira os campos destacados. Use horários no formato HH:mm ou P.F/FERIADO no primeiro campo, deixando os demais vazios. Confirme também as ocorrências pendentes.');
    tbody.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  // Keep the click's user activation while persisting the edited draft.
  const finalTab = window.open('', '_blank');
  if (!finalTab) {
    alert('Bloqueador de pop-ups impediu a visualização do documento!');
    return;
  }
  btnFinish.disabled = true;
  btnFinish.textContent = 'Processando…';
  try {
    tbody.querySelectorAll('tr').forEach(row => {
      const item = draftData.timesheet.data[Number(row.dataset.index)];
      const inputs = Array.from(row.querySelectorAll('input[type="text"]'));
      if (inputs.length) item.punches = inputs.map(input => input.value.trim().toUpperCase());
      const review = row.querySelector('input[type="checkbox"]');
      if (review) item.occurrenceReviewed = review.checked;
    });
    await chrome.storage.local.set({ draftData });
    const html = createPDFHtml(draftData.timesheet, draftData.masp, draftData.signature || '', draftData.issuingDepartment, draftData.logo);
    finalTab.document.write(html);
    finalTab.document.close();
    window.close();
  } catch (error) {
    finalTab.close();
    alert('Não foi possível salvar o rascunho e gerar a folha. Tente novamente.');
  } finally {
    btnFinish.disabled = false;
    btnFinish.textContent = 'Gerar Documento PDF Final';
  }
});

chrome.storage.local.get(['draftData']).then(result => {
  if (!Array.isArray(result.draftData?.timesheet?.data) || !result.draftData.timesheet.data.length) {
    btnFinish.disabled = true;
    alert('Nenhum dado encontrado para pré-visualização.');
    return;
  }
  draftData = result.draftData;
  renderTable();
}).catch(() => {
  btnFinish.disabled = true;
  alert('Não foi possível carregar o rascunho. Recarregue a extensão.');
});
