// This worker owns the Tesseract worker. Terminating it also terminates its
// child, including cancellation during Tesseract initialization.
importScripts('vendor/tesseract/tesseract.min.js');

let engine;
self.onmessage = async ({ data: { id, action, image, numeric } }) => {
  try {
    if (action === 'init') {
      const local = path => new URL(path, self.location.href).href;
      engine = await Tesseract.createWorker('por', 1, {
        workerPath: local('vendor/tesseract/worker.min.js'),
        corePath: local('vendor/tesseract-core'),
        langPath: local('vendor/tessdata'),
        cachePath: 'azc-por-4.0.0-fast',
        workerBlobURL: false,
        logger: progress => self.postMessage({ progress }),
        errorHandler: error => self.postMessage({ fatal: String(error) })
      });
      await engine.setParameters({ tessedit_pageseg_mode: '6' });
      self.postMessage({ id, result: true });
    } else if (action === 'recognize') {
      await engine.setParameters({ tessedit_char_whitelist: numeric ? '0123456789: ' : '', preserve_interword_spaces: '1' });
      const { data } = await engine.recognize(image, {}, { text: true, tsv: true });
      self.postMessage({ id, result: { text: data.text, tsv: data.tsv } });
    }
  } catch (error) {
    self.postMessage({ id, error: String(error.message || error) });
  }
};
