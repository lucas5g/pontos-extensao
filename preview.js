document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.querySelector('#timesheetTable tbody');
  const btnFinish = document.getElementById('btnFinish');

  let draftData = null;

  chrome.storage.local.get(['draftData'], (result) => {
    if (result.draftData) {
      draftData = result.draftData;
      renderTable();
    } else {
      alert('Nenhum dado encontrado para pré-visualização.');
    }
  });

  function renderTable() {
    draftData.timesheet.data.forEach((item, index) => {
      const tr = document.createElement('tr');
      const parts = item.day.split(' - ');
      const dayNum = parts[0].trim();
      const dayLabel = parts[1] ? parts[1].trim().toUpperCase() : '';

      const isSpecialDay = ['SÁBADO', 'SABADO', 'DOMINGO'].includes(dayLabel) ||
        dayLabel.startsWith('P.E') || dayLabel.startsWith('PE');

      if (isSpecialDay) {
        tr.innerHTML = `
          <td><strong>${item.day}</strong></td>
          <td colspan="4" class="special-day">${dayLabel}</td>
        `;
      } else {
        const p = item.punches || [];
        const hasPunches = p.some(value => value && value.trim());
        const start1 = p[0] || (hasPunches ? '' : 'P.F');
        const end1 = p[1] || '';
        const start2 = p[2] || '';
        const end2 = p[3] || '';

        tr.innerHTML = `
          <td><strong>${item.day}</strong></td>
          <td><input type="text" data-index="${index}" data-type="0" value="${start1}" placeholder="00:00" /></td>
          <td><input type="text" data-index="${index}" data-type="1" value="${end1}" placeholder="00:00" /></td>
          <td><input type="text" data-index="${index}" data-type="2" value="${start2}" placeholder="00:00" /></td>
          <td><input type="text" data-index="${index}" data-type="3" value="${end2}" placeholder="00:00" /></td>
        `;
      }
      tbody.appendChild(tr);
    });
  }

  btnFinish.addEventListener('click', () => {
    if (!draftData) return;

    btnFinish.innerText = 'Processando...';
    btnFinish.disabled = true;

    // Atualiza os dados com base nos inputs
    const inputs = document.querySelectorAll('#timesheetTable input[type="text"]');
    inputs.forEach(input => {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      const type = parseInt(input.getAttribute('data-type'), 10);
      const val = input.value.trim();

      if (!draftData.timesheet.data[idx].punches) {
        draftData.timesheet.data[idx].punches = [];
      }
      draftData.timesheet.data[idx].punches[type] = val;
    });

    // Filtra undefined/null nos punches limitando a 4 eventos
    draftData.timesheet.data.forEach(item => {
      if (item.punches) {
        item.punches = [
          item.punches[0] || '',
          item.punches[1] || '',
          item.punches[2] || '',
          item.punches[3] || ''
        ];
      }
    });

    const htmlContent = createPDFHtml(draftData.timesheet, draftData.masp, draftData.signature, draftData.logo);

    // Abre a aba final de impressão
    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(htmlContent);
      newTab.document.close();

      // Fechar essa aba de preview automaticamente a pedido do fluxo? 
      // Não é necessário, mas é agradável pro usuário não ficar com abas acumuladas
      // window.close() pode ser bloqueado se não foi aberto por script, 
      // mas no Chrome ext (tab.create) geralmente funciona.
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      alert('Bloqueador de pop-ups impediu a visualização do documento!');
      btnFinish.innerText = 'Gerar Documento PDF Final';
      btnFinish.disabled = false;
    }
  });

  function createPDFHtml(timesheet, masp, signature, logo) {
    const dateObj = new Date();
    dateObj.setMonth(dateObj.getMonth() - 1);
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj).toUpperCase();
    const year = dateObj.getFullYear();

    let rowsHtml = '';

    timesheet.data.forEach(item => {
      const parts = item.day.split(' - ');
      const dayNum = parts[0].trim();
      const dayLabel = parts[1] ? parts[1].trim().toUpperCase() : '';

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
        const start1 = p[0] || '';
        const end1 = p[1] || '';
        const start2 = p[2] || '';
        const end2 = p[3] || '';

        const sigImgStyle = 'max-height: 16px; vertical-align: middle; display: block; margin: 0 auto;';
        const sig1 = !['P.F', 'FERIADO'].includes(start1) && start1 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
        const sig2 = end1 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
        const sig3 = start2 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';
        const sig4 = end2 && signature ? `<img src="${signature}" style="${sigImgStyle}">` : '';

        rowsHtml += `
          <tr>
            <td>${dayNum}</td>
            <td>${start1}</td><td>${sig1}</td><td>${end1}</td><td>${sig2}</td>
            <td>${start2}</td><td>${sig3}</td><td>${end2}</td><td>${sig4}</td>
            <td></td><td></td>
          </tr>
        `;
      }
    });

    const logoSrc = logo || '';

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
});
