import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';
import { detectGrid, normalizeText, parsePeriod, groupOcrRows, buildTimesheet } from './pdf-parser.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const cancelled = () => new DOMException('Importação cancelada.', 'AbortError');

function createOcr(signal, onProgress) {
  const worker = new Worker(new URL('./ocr-worker.js', import.meta.url));
  let sequence = 0;
  const pending = new Map();
  const dispose = (error = cancelled()) => {
    worker.terminate();
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    signal.removeEventListener('abort', abort);
  };
  const abort = () => dispose();
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = () => dispose(new Error('Não foi possível iniciar o OCR local. Recarregue a extensão e tente novamente.'));
  worker.onmessage = ({ data }) => {
    if (data.progress) onProgress(data.progress);
    else if (data.fatal) dispose(new Error('Falha no OCR local: ' + data.fatal));
    else {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    }
  };
  return {
    request(action, image, numeric = false) {
      signal.throwIfAborted();
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, action, image, numeric });
      });
    },
    dispose
  };
}

function cropCanvas(canvas, left, top, right, bottom, scale = 3) {
  const crop = document.createElement('canvas');
  const x = Math.ceil(left), y = Math.ceil(top);
  const width = Math.floor(right) - x, height = Math.floor(bottom) - y;
  // Whitespace keeps characters on the first/last row away from OCR edges.
  const padding = 8;
  crop.width = (width + padding * 2) * scale;
  crop.height = (height + padding * 2) * scale;
  const context = crop.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, crop.width, crop.height);
  context.drawImage(canvas, x, y, width, height, padding * scale, padding * scale, width * scale, height * scale);
  return { canvas: crop, top: y - padding, scale };
}

export async function extractTimesheetFromPdf(file, { signal, onProgress = () => {} }) {
  let loadingTask, renderTask, ocr, canvas;
  let stage = 'Abrindo PDF';
  const progress = (label, value) => { stage = label; onProgress({ label, value }); };
  const abortPdf = () => {
    renderTask?.cancel();
    void loadingTask?.destroy().catch(() => {});
  };
  signal.addEventListener('abort', abortPdf, { once: true });
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 20 MB.');
    signal.throwIfAborted();
    progress('Abrindo PDF', 0.02);
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    const header = new TextDecoder().decode(bytes.subarray(0, 1024));
    if (!header.includes('%PDF-')) throw new Error('Arquivo inválido. Selecione um PDF gerado pelo AZC.');
    loadingTask = pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: true,
      wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href
    });
    // Remember password prompts because destroy() rejects with a generic error.
    let protectedPdf = false;
    loadingTask.onPassword = () => { protectedPdf = true; void loadingTask.destroy().catch(() => {}); };
    let pdf;
    try { pdf = await loadingTask.promise; }
    catch (error) {
      if (protectedPdf) throw new Error('PDF protegido por senha. Exporte uma cópia sem senha no AZC.');
      throw error;
    }
    signal.throwIfAborted();
    if (pdf.numPages !== 1) throw new Error('Esta versão aceita somente folhas mensais de uma página.');
    const page = await pdf.getPage(1);
    const original = page.getViewport({ scale: 1 });
    if (original.width / original.height < 1.3 || original.width / original.height > 1.6) {
      throw new Error('Formato não reconhecido. Use a folha mensal do AZC em paisagem.');
    }
    const viewport = page.getViewport({ scale: 1684 / original.width });
    canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    progress('Preparando a tabela', 0.08);
    renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    signal.throwIfAborted();
    const grid = detectGrid(context.getImageData(0, 0, canvas.width, canvas.height));
    // Remove grid strokes only from the working copy, before upscaling crops.
    context.fillStyle = 'white';
    for (const line of grid.horizontal) context.fillRect(0, line.start - 1, canvas.width, line.end - line.start + 3);
    for (const line of grid.vertical) context.fillRect(line.start - 1, 0, line.end - line.start + 3, canvas.height);
    progress('Carregando OCR local', 0.12);
    ocr = createOcr(signal, message => {
      if (message.status === 'recognizing text') onProgress({ label: stage, detail: message.progress });
    });
    await ocr.request('init');
    const read = async (left, top, right, bottom, numeric = false) => {
      signal.throwIfAborted();
      const crop = cropCanvas(canvas, left, top, right, bottom);
      try {
        const result = await ocr.request('recognize', crop.canvas.toDataURL('image/png'), numeric);
        signal.throwIfAborted();
        return { ...result, top: crop.top, scale: crop.scale };
      } finally { crop.canvas.width = crop.canvas.height = 0; }
    };
    const c = grid.columns;
    progress('Conferindo o modelo da folha', 0.2);
    const headings = await read(c[0] + 2, grid.headerTop + 2, c[5] - 2, grid.top - 2);
    const normalized = normalizeText(headings.text);
    if (!normalized.includes('JORNADAREALIZADA') || !normalized.includes('OCORRENCIAS')) {
      throw new Error('Cabeçalho incompatível. Use o relatório Controle de Presença e Horas de Trabalho do AZC.');
    }
    progress('Lendo o período', 0.3);
    const periodText = await read(c[0] + 2, grid.headerTop - grid.rowHeight * 2, c[3] - 2, grid.headerTop - 2);
    const period = parsePeriod(periodText.text);
    const readColumn = async (left, right, numeric = false) => {
      const result = await read(left + 2, grid.top + 2, right - 2, grid.bottom - 2, numeric);
      return groupOcrRows(result.tsv, grid, result.top, result.scale);
    };
    progress('Lendo as datas', 0.42);
    const dates = await readColumn(c[0], c[1]);
    progress('Lendo a jornada realizada', 0.6);
    const punches = await readColumn(c[2], c[3], true);
    progress('Lendo feriados e ocorrências', 0.8);
    const occurrences = await readColumn(c[4], c[5]);
    signal.throwIfAborted();
    const timesheet = buildTimesheet(period, dates, punches, occurrences);
    progress('Extração concluída', 1);
    return timesheet;
  } catch (error) {
    if (signal.aborted) throw cancelled();
    if (error.name === 'InvalidPDFException') throw new Error('O PDF está corrompido ou não pôde ser lido. Gere o arquivo novamente no AZC.');
    throw error;
  } finally {
    signal.removeEventListener('abort', abortPdf);
    ocr?.dispose();
    if (canvas) canvas.width = canvas.height = 0;
    await loadingTask?.destroy().catch(() => {});
  }
}
