# Pontos Extensão

Extensão para Chrome desenvolvida para automatizar o preenchimento e geração de folhas de ponto (timesheets) no formato PDF.

## Funcionalidades

- **Preenchimento Automático**: Extrai dados de ponto de uma página web e preenche automaticamente os campos da folha de ponto.
- **Importação de PDF do AZC**: Lê localmente o relatório mensal por OCR e abre os horários no mesmo preview, mesmo sem uma aba do AZC aberta.
- **Edição em Tempo Real**: Permite editar os horários (Entrada/Saída) diretamente na interface antes da geração final.
- **Pré-visualização**: Gera uma pré-visualização do documento PDF com todos os dados formatados.
- **Geração de PDF**: Cria o documento final em PDF com layout profissional, pronto para impressão ou salvamento.
- **Persistência de Dados**: Salva os dados em rascunho (`draftData`) no armazenamento local do Chrome, permitindo que o usuário continue o preenchimento posteriormente.

## Estrutura do Projeto

Principais componentes:

- `manifest.json`: Define as permissões, scripts e configurações da extensão.
- `content.js`: Script injetado na página web alvo para extração e manipulação de dados.
- `preview.js`: Script responsável por renderizar a pré-visualização e gerar o PDF final.
- `import.html` / `import.js`: Seleção do PDF, progresso, cancelamento e gravação do rascunho após validação.
- `pdf-extractor.js` / `pdf-parser.js` / `ocr-worker.js`: Renderização local, detecção da grade e leitura de datas, marcações e ocorrências por OCR.
- `timesheet.js`: Regras compartilhadas de horários, dias especiais e documento para impressão.
- `vendor/`: Bibliotecas e modelo de português empacotados, com versões, hashes e licenças.

## Como Usar

1. **Instalação**:
   - Clone ou baixe o repositório.
   - Abra o Chrome e navegue até `chrome://extensions`.
   - Habilite o "Modo de Desenvolvedor" (Developer mode).
   - Clique em "Carregar sem compactação" (Load unpacked) e selecione a pasta do projeto.

2. **Fluxo de Uso**:
   - Navegue até a página web que contém os dados de ponto que deseja processar.
   - Clique no ícone da extensão na barra de ferramentas do Chrome.
   - Siga as instruções na interface da extensão para extrair e editar os dados.
   - Clique em "Gerar Documento PDF Final" para finalizar o processo.

3. **Importar um PDF**:
   - Configure nome, MASP, diretoria e, opcionalmente, assinatura em Configurações.
   - No popup da extensão, clique em **Importar PDF do AZC**.
   - Selecione o relatório **Controle de Presença e Horas de Trabalho** exportado pelo AZC: um mês completo, uma página em paisagem, até 20 MB.
   - Clique em **Extrair e abrir preview**. É possível cancelar enquanto a leitura acontece; falhas e cancelamentos preservam o rascunho anterior.
   - Confira os horários reconhecidos. A extração usa **Jornada Realizada**; a coluna **Horário de Trabalho** não preenche as batidas.
   - Dias com quantidade diferente de quatro marcações exibem o texto reconhecido como referência e deixam os campos para revisão manual. Dias úteis vazios sem ocorrência também exigem preenchimento.
   - Feriados, pontos facultativos e fins de semana são preservados. Ocorrências desconhecidas aparecem para conferência; marque a confirmação depois de revisá-las.
   - Use horários `HH:mm` (00:00 a 23:59). Para indicar `P.F` ou `FERIADO` manualmente, preencha somente o primeiro campo.
   - O documento final usa o mês e o ano do PDF. As correções são salvas no rascunho antes da abertura da folha para impressão.

### Limites da importação

A primeira versão reconhece o layout mensal do AZC testado, com 28 a 31 dias. PDFs com várias páginas, senha, datas ausentes/duplicadas, período parcial ou outro layout são rejeitados. O OCR pode cometer erros: revise os valores antes de gerar o documento final.

O PDF não é enviado a servidores nem gravado no armazenamento da extensão. Apenas os dados extraídos entram em `draftData`; nome, MASP, diretoria e assinatura continuam vindo das configurações. A importação funciona sem conexão, com PDF.js, Tesseract.js e o modelo de português inteiramente locais (aproximadamente 21 MB de arquivos adicionais).

Os detalhes das dependências e licenças estão em [vendor/README.md](vendor/README.md), e as versões e hashes estão em [vendor/versions.json](vendor/versions.json). Não é necessário instalar pacotes ou executar um build.

## Verificação

Os testes de regras e parsing usam apenas o Node.js 22.7 ou superior, sem instalar dependências:

```sh
node --test tests/*.test.mjs
```

Para validar no Chrome, recarregue a extensão em `chrome://extensions` após qualquer alteração no manifest. Confira configurações, extração da página Minha Frequência (AP01), importação offline, cancelamento, PDF inválido e o preview. Na importação, verifique dias vazios, marcações incompletas, feriados, alternância de horário padrão, persistência das correções e o mês/ano da folha final. Use PDFs pessoais apenas localmente; não os adicione ao repositório.

## Requisitos

- Navegador Google Chrome.
- Modo de Desenvolvedor habilitado nas extensões.
