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
            previewDiv.innerHTML = `<p>Assinatura atual:</p><img src="${signatureBase64}" style="max-height: 50px; border: 1px solid #ccc; padding: 5px;">`;
        }
    });

    // Atualizar imagem ao selecionar novo arquivo
    signatureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                signatureBase64 = event.target.result;
                previewDiv.innerHTML = `<p>Pré-visualização da nova assinatura:</p><img src="${signatureBase64}" style="max-height: 50px; border: 1px solid #ccc; padding: 5px;">`;
                statusDiv.innerText = 'Assinatura carregada, lembre-se de salvar.';
                statusDiv.style.color = 'orange';
            };
            reader.readAsDataURL(file);
        }
    });

    // Salvar configurações
    btnSave.addEventListener('click', () => {
        const name = nameInput.value;
        const masp = maspInput.value;
        chrome.storage.local.set({ name, masp, signature: signatureBase64 }, () => {
            statusDiv.innerText = 'Configurações salvas com sucesso!';
            statusDiv.style.color = 'green';
            setTimeout(() => {
                statusDiv.innerText = '';
            }, 3000);
        });
    });
});
