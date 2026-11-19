export const standardHours = ['09:00', '12:00', '13:00', '18:00'];
export const isTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function imageDataUrl(value) {
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value || '') ? value : '';
}

export function periodDate(period) {
  if (Number.isInteger(period?.month) && period.month >= 1 && period.month <= 12 && Number.isInteger(period.year) && period.year >= 2000 && period.year <= 2100) {
    return new Date(period.year, period.month - 1, 1);
  }
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return date;
}

export function dayLabel(item) {
  return (item.day.split(' - ')[1] || '').trim().toUpperCase();
}

export function getSpecialLabel(item, source) {
  const label = dayLabel(item);
  if (source === 'pdf') {
    const worked = Boolean(item.rawPunches?.trim()) || (item.punches || []).some(value => isTime(value));
    if (worked) return '';
    if (item.occurrence === 'PONTO FACULTATIVO') return 'P.F';
    if (item.occurrence === 'FERIADO') return 'FERIADO';
  }
  if (['SÁBADO', 'SABADO', 'DOMINGO'].includes(label) || label.startsWith('P.E') || label.startsWith('PE')) return label;
  return '';
}

export function usesStandardHours(item, source) {
  const label = dayLabel(item);
  return !getSpecialLabel(item, source) && !['SÁBADO', 'SABADO', 'DOMINGO', 'FERIADO'].includes(label) &&
    !item.occurrence && !item.rawOccurrence && !['P.F', 'FERIADO'].includes((item.punches?.[0] || '').trim().toUpperCase());
}

export function validPunches(values) {
  const normalized = values.map(value => value.trim().toUpperCase());
  if (['P.F', 'FERIADO'].includes(normalized[0])) return normalized.slice(1).every(value => !value);
  return normalized.length === 4 && normalized.every(isTime);
}

export function createPDFHtml(timesheet, masp, signature, issuingDepartment, logo) {
    // Escape all values interpolated into the printable document.
    timesheet = {
      ...timesheet,
      name: escapeHtml(timesheet.name),
      data: timesheet.data.map(item => ({
        ...item,
        day: escapeHtml(item.day),
        punches: (item.punches || []).map(escapeHtml)
      }))
    };
    masp = escapeHtml(masp);
    issuingDepartment = escapeHtml(issuingDepartment);
    signature = imageDataUrl(signature);
    logo = imageDataUrl(logo);
    const dateObj = periodDate(timesheet.period);
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dateObj).toUpperCase();
    const year = dateObj.getFullYear();

    let rowsHtml = '';

    timesheet.data.forEach(item => {
      const parts = item.day.split(' - ');
      const dayNum = parts[0].trim();
      const observation = timesheet.source === 'pdf' ? escapeHtml(item.occurrence || item.rawOccurrence || '') : '';
      const specialLabel = getSpecialLabel(item, timesheet.source);

      if (specialLabel) {
        rowsHtml += `
          <tr>
            <td>${dayNum}</td>
            <td style="font-weight: bold;">${escapeHtml(specialLabel)}</td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td>
            <td></td><td>${observation}</td>
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
            <td></td><td>${observation}</td>
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
          UNIDADE EMITENTE: ${issuingDepartment} / SEDE II
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
