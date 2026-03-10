document.addEventListener('DOMContentLoaded', () => {
  const btnGenerate = document.getElementById('btnGenerate');
  const statusDiv = document.getElementById('status');
  const btnOptions = document.getElementById('btnOptions');

  let signatureBase64 = '';
  let savedName = '';
  let savedMasp = '';

  // Load saved data
  chrome.storage.local.get(['name', 'masp', 'signature'], (result) => {
    if (result.name) savedName = result.name;
    if (result.masp) savedMasp = result.masp;

    if (result.signature && result.name && result.masp) {
      statusDiv.style.display = 'none';
      statusDiv.innerText = '';
    } else {
      statusDiv.style.display = 'block';
      statusDiv.innerText = '⚠️ Faltam configurações. Clique abaixo.';
    }

    if (result.signature) {
      signatureBase64 = result.signature;
    }
  });

  btnOptions.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  btnGenerate.addEventListener('click', async () => {
    if (!savedName || !savedMasp || !signatureBase64) {
      alert('Por favor, configure seus dados (Nome, MASP e Assinatura) primeiro!');
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
      return;
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    let tab = tabs.find(t => t.active && t.url && t.url.includes('azc.defensoria.mg.def.br'));

    // Fallback: search any tab in current window
    if (!tab) tab = tabs.find(t => t.url && t.url.includes('azc.defensoria.mg.def.br'));

    // Fallback: search all windows
    if (!tab) {
      const allTabs = await chrome.tabs.query({});
      tab = allTabs.find(t => t.url && t.url.includes('azc.defensoria.mg.def.br'));
    }

    if (!tab) {
      alert('Por favor, abra a aba da página do AZC primeiro.');
      return;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // content script may already be injected, ignore
    }

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_DATA" }, async (response) => {
      if (response) {
        const finalName = savedName || response.name;

        let logoBase64 = '';
        try {
          const logoUrl = chrome.runtime.getURL('logo.png');
          const resp = await fetch(logoUrl);
          const blob = await resp.blob();
          logoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('Erro ao carregar logo:', e);
        }

        generatePDF({ ...response, name: finalName }, savedMasp, signatureBase64, logoBase64);
      } else {
        alert('Erro ao extrair dados. Certifique-se de estar na tela "Minha Frequência" (AP01).');
      }
    });
  });
});

function generatePDF(data, masp, signature, logo) {
  const newTab = window.open('', '_blank');
  const htmlContent = createPDFHtml(data, masp, signature, logo);
  newTab.document.write(htmlContent);
  newTab.document.close();
}

function createPDFHtml(timesheet, masp, signature, logo) {
  const dateObj = new Date();
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj).toUpperCase();
  const year = dateObj.getFullYear();

  let rowsHtml = '';

  timesheet.data.forEach(item => {
    const parts = item.day.split(' - ');
    const dayNum = parts[0].trim();
    const dayLabel = parts[1] ? parts[1].trim().toUpperCase() : '';

    // Check if it's a weekend or special day (P.E, feriado, etc.)
    const isSpecialDay = ['SÁBADO', 'SABADO', 'DOMINGO'].includes(dayLabel) ||
      dayLabel.startsWith('P.E') || dayLabel.startsWith('PE');

    if (isSpecialDay) {
      rowsHtml += `
        <tr>
          <td>${dayNum}</td>
          <td style="font-weight: bold;">${dayLabel}</td><td></td><td></td><td></td>
          <td></td><td></td><td></td><td></td>
          <td></td><td></td>
        </tr>
      `;
    } else {
      const p = item.punches;
      const e1 = p[0] || '';
      const s1 = p[1] || '';
      const e2 = p[2] || '';
      const s2 = p[3] || '';

      const sigImgStyle = 'max-height: 18px; vertical-align: middle; display: block; margin: 0 auto;';
      const sig1 = e1 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
      const sig2 = s1 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
      const sig3 = e2 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
      const sig4 = s2 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';

      rowsHtml += `
        <tr>
          <td>${dayNum}</td>
          <td>${e1}</td><td>${sig1}</td><td>${s1}</td><td>${sig2}</td>
          <td>${e2}</td><td>${sig3}</td><td>${s2}</td><td>${sig4}</td>
          <td></td><td></td>
        </tr>
      `;
    }
  });

  const logoSrc = logo || '';
  const sigHtml = '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Folha de Ponto - ${timesheet.name}</title>
  <style>
    @media print { .no-print { display: none; } }
    table, th, td { border: 1px solid black; border-collapse: collapse; padding: 4px; text-align: center; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 10px; margin: 20px; }
    .header { border: 1px solid black; border-bottom: 0px; }
    .grid-2 { display: grid; grid-template-columns: 40% 60%; border-bottom: 1px solid black; }
    .grid-3 { display: grid; grid-template-columns: auto auto auto; border-bottom: 1px solid black; }
    .grid-name { display: grid; grid-template-columns: auto 15%; }
    .footer { display: flex; border: 1px solid black; border-top: 0; justify-content: center; margin-top: 0px; }
    .sign-box { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 60px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
  </style>
</head>
<body>
  <div class="header">
    <div class="grid-2">
      <div style="border-right: 1px solid black; display: flex; align-items: center; gap: 10px; padding: 5px;">
        ${logoSrc ? `<img src="${logoSrc}" class="logo-img" alt="logo">` : '<div style="width:60px;height:60px;border:1px dashed #ccc;">LOGO</div>'}
        <strong><h3>DEFENSORIA PÚBLICA DE <br> MINAS GERAIS</h3></strong>
      </div>
      <div style="text-align: center; padding: 5px;">
        <strong><h3>FOLHA DE PONTO DE <br>FREQUÊNCIA</h3></strong>
      </div>
    </div>
    <div class="grid-3">
      <div style="border-right: 1px solid black; padding: 5px;">
        UNIDADE EMITENTE: DIRETORIA DE DESENVOLVIMENTO DE SISTEMAS E PROJETOS / SEDE II
      </div>
      <div style="border-right: 1px solid black; padding: 5px;">
        <strong>MÊS: <span>${monthName}</span></strong>
      </div>
      <div style="padding: 5px;"><strong>${year}</strong></div>
    </div>
    <div class="grid-name">
      <div style="border-right: 1px solid black; padding: 5px">
        NOME DO SERVIDOR: <strong style="text-transform: uppercase;">${timesheet.name}</strong>          
      </div>
      <div style="padding: 5px;"><strong>MASP:</strong> <span>${masp}</span></div>
    </div>
  </div>

  <table style="width: 100%;">
    <thead>
      <tr><th colspan="5"><strong>PERÍODO DE AFASTAMENTO</strong></th><th colspan="6"><strong>MOTIVO</strong></th></tr>
      <tr><td colspan="5"><strong>DE __/__/____ A __/__/____</strong></td><td colspan="6"></td></tr>
      <tr><td rowspan="2">DIA</td><td colspan="4">1° TURNO</td><td colspan="4">2° TURNO</td><td rowspan="2">RUBRICA</td><td rowspan="2">OBS</td></tr>
      <tr><td>ENTRADA</td><td>RUBRICA</td><td>SAÍDA</td><td>RUBRICA</td><td>ENTRADA</td><td>RUBRICA</td><td>SAÍDA</td><td>RUBRICA</td></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

   <div style="display: flex; border: 1px solid; border-top: 0px; justify-content: center; ">
      <div style=" display: flex; gap: 3em; border-right: 1px solid; padding: 25px 30px 10px ">
        <span style="border-top: 1px solid; padding: 5px 15px 0px 15px">
          DATA
        </span>
        <span style="border-top: 1px solid; padding: 5px 10px 0px 15px">
          ASSINATURA DO SERVIDOR / MASP
        </span>
      </div>

      <div style="display: flex; gap: 3em; padding: 25px 30px 10px">
        <span style="border-top: 1px solid; padding: 5px 15px 0px 15px">
          DATA
        </span>
        <span style="border-top: 1px solid; padding: 5px 10px 0px 15px">
          ASSINATURA DA CHEFIA / MADEP OU MASP
        </span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
