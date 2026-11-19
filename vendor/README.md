# Dependências locais

Estes arquivos são distribuídos com a extensão; nenhum CDN é acessado ao importar um PDF. Não há instalação de pacotes ou etapa de build para usar a extensão.

| Componente | Versão | Arquivos / licença |
| --- | --- | --- |
| [PDF.js](https://github.com/mozilla/pdf.js) | 6.5.438 | API e worker minificados, codecs de imagem WASM; Apache-2.0 e licenças dos codecs em `pdfjs/` |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 6.0.1 | API e worker minificados; Apache-2.0, avisos e licenças de dependências em `tesseract/` |
| [Tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 6.1.2 | Quatro variantes `.wasm.js`, com WASM incorporado; Apache-2.0 em `tesseract-core/LICENSE` |
| [Modelo de português](https://github.com/naptha/tessdata/tree/gh-pages/4.0.0_fast) | 4.0.0_fast | Modelo LSTM rápido, Apache-2.0 em `tessdata/LICENSE` |

Os pacotes JavaScript foram obtidos do registro oficial npm, com verificação de integridade SHA-512 dos arquivos `.tgz`. O modelo foi obtido do repositório oficial `naptha/tessdata`; sua revisão e o SHA-256 dos arquivos distribuídos estão em `versions.json`.

O OCR usa LSTM e seleciona a variante SIMD compatível com o dispositivo. As quatro variantes documentadas foram mantidas para compatibilidade. Não foram incluídos source maps, visualizadores, modelos de outros idiomas ou o avaliador de scripts QuickJS do PDF.js.

Ao atualizar, mantenha API e worker PDF.js na mesma versão, use um core compatível com a versão do Tesseract.js e atualize hashes e licenças. Se trocar o modelo de português, altere também `cachePath` em `ocr-worker.js` para não reutilizar um modelo antigo em cache. Valide OCR, cancelamento e funcionamento offline em uma extensão recarregada.
