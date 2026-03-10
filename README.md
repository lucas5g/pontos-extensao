# Pontos Extensão

Extensão para Chrome desenvolvida para automatizar o preenchimento e geração de folhas de ponto (timesheets) no formato PDF.

## Funcionalidades

- **Preenchimento Automático**: Extrai dados de ponto de uma página web e preenche automaticamente os campos da folha de ponto.
- **Edição em Tempo Real**: Permite editar os horários (Entrada/Saída) diretamente na interface antes da geração final.
- **Pré-visualização**: Gera uma pré-visualização do documento PDF com todos os dados formatados.
- **Geração de PDF**: Cria o documento final em PDF com layout profissional, pronto para impressão ou salvamento.
- **Persistência de Dados**: Salva os dados em rascunho (`draftData`) no armazenamento local do Chrome, permitindo que o usuário continue o preenchimento posteriormente.

## Estrutura do Projeto

O projeto é composto por três arquivos principais:

- `manifest.json`: Define as permissões, scripts e configurações da extensão.
- `content.js`: Script injetado na página web alvo para extração e manipulação de dados.
- `preview.js`: Script responsável por renderizar a pré-visualização e gerar o PDF final.

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

## Requisitos

- Navegador Google Chrome.
- Modo de Desenvolvedor habilitado nas extensões.
