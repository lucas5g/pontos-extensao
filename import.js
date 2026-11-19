import { extractTimesheetFromPdf } from './pdf-extractor.js';

const form = document.getElementById('importForm');
const fileInput = document.getElementById('pdfFile');
const start = document.getElementById('start');
const cancel = document.getElementById('cancel');
const status = document.getElementById('status');
const progress = document.getElementById('progress');
const progressArea = document.getElementById('progressArea');
const configWarning = document.getElementById('config');
let controller = null;
let saving = false;

const hasConfig = config => ['name', 'masp', 'issuingDepartment'].every(key => String(config[key] || '').trim());

async function checkConfig() {
  const config = await chrome.storage.local.get(['name', 'masp', 'issuingDepartment', 'signature']);
  configWarning.hidden = Boolean(hasConfig(config));
  if (!controller) start.disabled = !hasConfig(config);
  return config;
}
checkConfig().catch(() => { status.textContent = 'Não foi possível carregar as configurações. Recarregue a extensão.'; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ['name', 'masp', 'issuingDepartment'].some(key => key in changes)) void checkConfig();
});

cancel.addEventListener('click', () => {
  if (saving) return;
  controller?.abort();
  cancel.disabled = true;
  status.textContent = 'Cancelando importação…';
});
window.addEventListener('pagehide', () => controller?.abort());

async function loadLogo() {
  const response = await fetch(chrome.runtime.getURL('logo.png'));
  if (!response.ok) throw new Error('Não foi possível carregar o logo da extensão.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler o logo da extensão.'));
    reader.readAsDataURL(blob);
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (controller) return;
  const file = fileInput.files[0];
  if (!file) return;
  const current = new AbortController();
  controller = current;
  start.disabled = true;
  fileInput.disabled = true;
  cancel.hidden = false;
  cancel.disabled = false;
  progressArea.hidden = false;
  progress.value = 0;
  status.className = '';
  try {
    const config = await checkConfig();
    if (!hasConfig(config)) throw new Error('Preencha nome, MASP e diretoria nas configurações antes de importar.');
    const timesheet = await extractTimesheetFromPdf(file, {
      signal: current.signal,
      onProgress({ label, value, detail }) {
        if (current.signal.aborted) return;
        if (value !== undefined) progress.value = value;
        status.textContent = detail === undefined ? label + '…' : `${label}… ${Math.round(detail * 100)}%`;
      }
    });
    const logo = await loadLogo();
    current.signal.throwIfAborted();
    // Commit once, after all extraction/validation and cancellable work succeeds.
    saving = true;
    cancel.disabled = true;
    const draftData = {
      timesheet: { ...timesheet, name: config.name },
      masp: config.masp,
      issuingDepartment: config.issuingDepartment,
      signature: config.signature || '',
      logo
    };
    await chrome.storage.local.set({ draftData });
    location.replace(chrome.runtime.getURL('preview.html'));
  } catch (error) {
    const aborted = current.signal.aborted || error.name === 'AbortError';
    status.className = aborted ? '' : 'error';
    status.textContent = aborted
      ? 'Importação cancelada. Seu rascunho anterior foi preservado.'
      : `${error.message || 'Não foi possível importar o PDF.'}\nSeu rascunho anterior foi preservado.`;
  } finally {
    saving = false;
    controller = null;
    cancel.hidden = true;
    progressArea.hidden = true;
    fileInput.disabled = false;
    await checkConfig();
  }
});
