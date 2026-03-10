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

        const draftData = {
          timesheet: { ...response, name: finalName },
          masp: savedMasp,
          signature: signatureBase64,
          logo: logoBase64
        };

        chrome.storage.local.set({ draftData }, () => {
          chrome.tabs.create({ url: 'preview.html' });
        });
      } else {
        alert('Erro ao extrair dados. Certifique-se de estar na tela "Minha Frequência" (AP01).');
      }
    });
  });
});
