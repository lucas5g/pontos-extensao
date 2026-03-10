document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('name');
    const maspInput = document.getElementById('masp');
    const signatureInput = document.getElementById('signature');
    const statusDiv = document.getElementById('status');
    const previewDiv = document.getElementById('preview');
    const btnSave = document.getElementById('btnSave');

    let signatureBase64 = '';

    // Carregar dados salvos
    chrome.storage.local.get(['name', 'masp', 'signature'], (result) => {
        if (result.name) nameInput.value = result.name;
        if (result.masp) maspInput.value = result.masp;
        if (result.signature) {
            signatureBase64 = result.signature;
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = `<p>Assinatura atual:</p><img src="${signatureBase64}" alt="Assinatura">`;
        }
    });

    // Atualizar imagem ao selecionar novo arquivo
    signatureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                signatureBase64 = event.target.result;
                previewDiv.style.display = 'block';
                previewDiv.innerHTML = `<p>Pré-visualização da assinatura:</p><img src="${signatureBase64}" alt="Assinatura">`;

                statusDiv.className = 'info';
                statusDiv.innerText = 'Assinatura carregada, lembre-se de salvar.';
            };
            reader.readAsDataURL(file);
        }
    });

    // Salvar configurações
    btnSave.addEventListener('click', () => {
        const name = nameInput.value;
        const masp = maspInput.value;
        chrome.storage.local.set({ name, masp, signature: signatureBase64 }, () => {
            statusDiv.className = 'success';
            statusDiv.innerText = 'Configurações salvas com sucesso!';
            setTimeout(() => {
                statusDiv.className = '';
                statusDiv.innerText = '';
            }, 3000);
        });
    });
});
