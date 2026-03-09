function extractTimesheetData() {
    const table = document.querySelector('.GB2UA-DDKIC');
    if (!table) {
        alert('Tabela de ponto não encontrada!');
        return null;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr.GB2UA-DDMIC'));
    const data = rows.map(row => {
        const cells = row.querySelectorAll('td');
        const day = cells[0]?.innerText.trim() || '';
        const date = cells[1]?.innerText.trim() || '';
        const punchStr = cells[3]?.innerText.trim() || '';

        // Parse punches (Entrada/Saída)
        // Example: "09:39 12:00 13:00 18:48" -> ["09:39", "12:00", "13:00", "18:48"]
        const punches = punchStr.split(/\s+/).filter(p => p.includes(':'));

        return { day, date, punches };
    });

    // Try to get Name and MASP from the page header if possible
    // Based on previous exploration: "Seja bem vindo LUCAS DE SOUSA ASSUNCAO (lucas.assuncao)"
    // But for the PDF we might need the MASP.
    const welcomeText = document.body.innerText.match(/Seja bem vindo (.*?) \((.*?)\)/);
    const name = welcomeText ? welcomeText[1] : '';
    const login = welcomeText ? welcomeText[2] : '';

    return { name, login, data };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_DATA") {
        const timesheetData = extractTimesheetData();
        sendResponse(timesheetData);
    }
});
