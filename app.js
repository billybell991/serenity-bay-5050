const dataRef = firebase.database().ref('campgroundData');

let campgroundData = [];

// Listen for real-time updates — fires on load and whenever any device makes a change
dataRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        campgroundData = data;
    } else {
        // First ever run — seed the database with the site list
        campgroundData = defaultCampsites;
        dataRef.set(defaultCampsites);
    }
    renderList();
});

// Global Variables
let currentFilter = '';
let qrCodeInstance = null;

// DOM Elements
const searchInput = document.getElementById('searchSite');
const sitesList = document.getElementById('sitesList');
const qrModal = document.getElementById('qrModal');
const qrCodeContainer = document.getElementById('qrcode');
const closeQrBtn = document.getElementById('closeQr');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpBtn = document.getElementById('closeHelp');
const exportFromHelpBtn = document.getElementById('exportFromHelpBtn');
const tallyModal = document.getElementById('tallyModal');
const closeTallyBtn = document.getElementById('closeTally');
const tallyBtn = document.getElementById('tallyBtn');
const tallyContent = document.getElementById('tallyContent');
const resetAllBtnHelp = document.getElementById('resetAllBtnHelp');
const mapBtn = document.getElementById('mapBtn');
const mapModal = document.getElementById('mapModal');
const closeMapBtn = document.getElementById('closeMap');

// Build the action buttons HTML — shared between regular sites and extras
function buildActionHTML(id, showSkip = true, addExtraId = null) {
    // Full 2x2 grid: Cash & eTrans on top, No & Extra on bottom
    if (showSkip && addExtraId) {
        return `
        <div class="grid grid-cols-2 gap-3 mt-3" id="actions-${id}">
            <button onclick="showAmountOptions('${id}', 'Cash')" class="py-4 bg-green-100 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-200 active:bg-green-200">
                <span class="text-2xl mb-1">💵</span>
                <span class="text-sm">Cash</span>
            </button>
            <button onclick="showAmountOptions('${id}', 'eTransfer')" class="py-4 bg-blue-100 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-200 active:bg-blue-200">
                <span class="text-2xl mb-1">📱</span>
                <span class="text-sm">eTransfer</span>
            </button>
            <button onclick="setVisited('${id}', 'None')" class="py-4 bg-gray-100 text-gray-700 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-gray-200 active:bg-gray-200">
                <span class="text-2xl mb-1">🚫</span>
                <span class="text-sm">No</span>
            </button>
            <button onclick="addExtra('${addExtraId}')" class="py-4 bg-orange-50 text-orange-700 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-orange-200 active:bg-orange-100">
                <span class="text-2xl mb-1">➕</span>
                <span class="text-sm">Add Extra</span>
            </button>
        </div>
        <div class="hidden gap-2 mt-2 flex-col" id="payment-${id}">
            <div class="text-center font-bold text-gray-600 mb-1">Select <span id="payTypeLab-${id}"></span> Amount:</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="completePurchase('${id}', 5)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$5</button>
                <button onclick="completePurchase('${id}', 10)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$10</button>
                <button onclick="completePurchase('${id}', 20)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$20</button>
            </div>
            <button id="qrBtn-${id}" onclick="showQR()" class="hidden mt-2 py-3 w-full bg-gray-800 text-white rounded-lg font-bold align-center justify-center">
                <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                Show QR Code / Email
            </button>
            <button onclick="cancelPayment('${id}')" class="mt-2 py-2 w-full bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold shadow-sm text-sm hover:bg-red-200">Back</button>
        </div>
    `;
    }

    // Extras: just Cash + eTrans in a 2-col row
    return `
        <div class="grid grid-cols-2 gap-3 mt-3" id="actions-${id}">
            <button onclick="showAmountOptions('${id}', 'Cash')" class="py-4 bg-green-100 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-200 active:bg-green-200">
                <span class="text-2xl mb-1">💵</span>
                <span class="text-sm">Cash</span>
            </button>
            <button onclick="showAmountOptions('${id}', 'eTransfer')" class="py-4 bg-blue-100 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-200 active:bg-blue-200">
                <span class="text-2xl mb-1">📱</span>
                <span class="text-sm">eTransfer</span>
            </button>
        </div>
        <div class="hidden gap-2 mt-2 flex-col" id="payment-${id}">
            <div class="text-center font-bold text-gray-600 mb-1">Select <span id="payTypeLab-${id}"></span> Amount:</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="completePurchase('${id}', 5)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$5</button>
                <button onclick="completePurchase('${id}', 10)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$10</button>
                <button onclick="completePurchase('${id}', 20)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$20</button>
            </div>
            <button id="qrBtn-${id}" onclick="showQR()" class="hidden mt-2 py-3 w-full bg-gray-800 text-white rounded-lg font-bold align-center justify-center">
                <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                Show QR Code / Email
            </button>
            <button onclick="cancelPayment('${id}')" class="mt-2 py-2 w-full bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold shadow-sm text-sm hover:bg-red-200">Back</button>
        </div>
    `;
}

// Render the list
function renderList() {
    sitesList.innerHTML = '';

    // Build a map of extras grouped by their parent site id
    const extrasByParent = {};
    campgroundData.filter(s => s.isExtra).forEach(s => {
        if (!extrasByParent[s.parentId]) extrasByParent[s.parentId] = [];
        extrasByParent[s.parentId].push(s);
    });

    // Filter only non-extra sites by the search query
    const filtered = campgroundData.filter(site => {
        if (site.isExtra) return false;
        const query = currentFilter.toLowerCase();
        return site.id.toLowerCase().includes(query);
    });

    filtered.forEach(site => {
        const card = document.createElement('div');
        card.className = `site-card ${site.doNotBother ? 'opacity-60 bg-gray-200 border-red-300' : (site.visited ? 'card-visited bg-gray-50' : 'bg-white')}`;
        
        let statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Pending</span>`;
        if (site.visited) {
            statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Visited</span>`;
        }

        let bodyHTML = '';
        if (site.doNotBother) {
            bodyHTML = `<div class="text-sm font-bold text-red-600 mb-1">🚫 Do Not Bother</div>`;
        } else {
            const purchaseInfo = site.visited && site.purchaseType ? `
                <div class="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm flex justify-between items-center">
                    <div>
                        <span class="font-bold">Status:</span> ${site.purchaseType} 
                        ${site.amount ? ` - $${site.amount}` : ''}
                    </div>
                    <button class="undo-btn px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onclick="resetSite('${site.id}')">Undo</button>
                </div>
            ` : '';
            bodyHTML = purchaseInfo + (!site.visited ? buildActionHTML(site.id, true, site.id) : '');
        }

        const innerHTML = `
            <div class="flex justify-between items-center mb-1 cursor-pointer" onclick="toggleCard('${site.id}')">
                <div class="text-lg font-bold text-gray-800">${site.id} - ${site.name}</div>
                <div class="flex items-center gap-2">${statusBadge}</div>
            </div>
            <div id="body-${site.id}" class="hidden">${bodyHTML}</div>
        `;

        card.innerHTML = innerHTML;
        sitesList.appendChild(card);

        // Render any extras for this site immediately after, indented
        const extras = extrasByParent[site.id] || [];
        extras.forEach(extra => {
            const extraCard = document.createElement('div');
            extraCard.className = `site-card ${extra.visited ? 'card-visited bg-gray-50 border border-gray-200' : 'bg-orange-50 border border-orange-200'} ml-5`;

            let extraStatusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Pending</span>`;
            if (extra.visited) {
                extraStatusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Visited</span>`;
            }

            const extraPurchaseInfo = extra.visited && extra.purchaseType ? `
                <div class="mt-1 p-2 bg-white rounded-lg border border-orange-200 text-sm flex justify-between items-center">
                    <div>
                        <span class="font-bold">Status:</span> ${extra.purchaseType}
                        ${extra.amount ? ` - $${extra.amount}` : ''}
                    </div>
                    <button class="undo-btn px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onclick="resetSite('${extra.id}')">Undo</button>
                </div>
            ` : '';
            const extraBodyHTML = extraPurchaseInfo + (!extra.visited ? buildActionHTML(extra.id, false) : '');

            const extraHTML = `
                <div class="flex justify-between items-center mb-1 cursor-pointer" onclick="toggleCard('${extra.id}')">
                    <div class="text-base font-bold text-orange-800">📎 Extra @ ${extra.parentId}</div>
                    <div class="flex items-center gap-2">
                        ${extraStatusBadge}
                        <button onclick="event.stopPropagation(); removeExtra('${extra.id}')" class="text-xs text-red-500 font-bold px-2 py-1 bg-red-50 border border-red-200 rounded">✕</button>
                    </div>
                </div>
                <div id="body-${extra.id}" class="hidden">${extraBodyHTML}</div>
            `;

            extraCard.innerHTML = extraHTML;
            sitesList.appendChild(extraCard);
        });
    });
}

// Interaction Methods
let tempPaymentType = {};

window.setVisited = function(id, type, amount = 0) {
    const site = campgroundData.find(s => s.id === id);
    if(site) {
        site.visited = true;
        site.purchaseType = type;
        site.amount = amount;
        saveData();
        renderList();
    }
}

window.resetSite = function(id) {
    const site = campgroundData.find(s => s.id === id);
    if(site) {
        site.visited = false;
        site.purchaseType = null;
        site.amount = null;
        saveData();
        renderList();
    }
}

window.showAmountOptions = function(id, type) {
    tempPaymentType[id] = type;
    document.getElementById(`actions-${id}`).classList.add('hidden');
    
    const paymentDiv = document.getElementById(`payment-${id}`);
    paymentDiv.classList.remove('hidden');
    paymentDiv.classList.add('flex');
    
    document.getElementById(`payTypeLab-${id}`).innerText = type;
    
    if (type === 'eTransfer') {
        document.getElementById(`qrBtn-${id}`).classList.remove('hidden');
    } else {
        document.getElementById(`qrBtn-${id}`).classList.add('hidden');
    }
}

window.completePurchase = function(id, amount) {
    const type = tempPaymentType[id] || 'Cash';
    setVisited(id, type, amount);
}

window.cancelPayment = function(id) {
    document.getElementById(`actions-${id}`).classList.remove('hidden');
    const paymentDiv = document.getElementById(`payment-${id}`);
    paymentDiv.classList.add('hidden');
    paymentDiv.classList.remove('flex');
}

window.toggleCard = function(id) {
    const body = document.getElementById(`body-${id}`);
    if (!body) return;
    const isExpanding = body.classList.contains('hidden');
    // Collapse all other open cards first
    document.querySelectorAll('[id^="body-"]').forEach(el => {
        if (el.id !== `body-${id}`) el.classList.add('hidden');
    });
    body.classList.toggle('hidden');
    if (isExpanding) {
        requestAnimationFrame(() => {
            const card = body.closest('.site-card');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            const navHeight = 90; // fixed bottom nav approx height
            const viewBottom = window.innerHeight - navHeight;
            if (rect.bottom > viewBottom) {
                window.scrollBy({ top: rect.bottom - viewBottom + 8, behavior: 'smooth' });
            }
        });
    }
}

window.addExtra = function(parentId) {
    const existingExtras = campgroundData.filter(s => s.isExtra && s.parentId === parentId);
    const nextNum = existingExtras.length + 1;
    const newId = `${parentId}-E${nextNum}`;
    campgroundData.push({
        id: newId,
        name: `Extra @ ${parentId}`,
        parentId: parentId,
        isExtra: true,
        visited: false,
        doNotBother: false,
        purchaseType: null,
        amount: null
    });
    saveData();
    renderList();
}

window.removeExtra = function(id) {
    campgroundData = campgroundData.filter(s => s.id !== id);
    saveData();
    renderList();
}

window.showQR = function() {
    qrModal.classList.remove('hidden');
    qrModal.classList.add('flex');
    qrCodeContainer.innerHTML = ''; // clear previous
    
    // We will generate an actual QR code here 
    qrCodeInstance = new QRCode(qrCodeContainer, {
        text: GLOBAL_ETRANSFER_EMAIL,
        width: 250,
        height: 250,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
}

// Generate Excel file
async function exportToExcel() {
    // 1. Calculate live tally stats
    let totalCash = 0;
    let totalEtransfer = 0;
    let estimatedTickets = 0;
    
    campgroundData.forEach(site => {
        if (site.visited && site.amount) {
            if (site.purchaseType === 'Cash') totalCash += site.amount;
            if (site.purchaseType === 'eTransfer') totalEtransfer += site.amount;
            
            if (site.amount === 5) estimatedTickets += 1;
            else if (site.amount === 10) estimatedTickets += 3;
            else if (site.amount === 20) estimatedTickets += 7;
            else estimatedTickets += Math.floor(site.amount / 5) * 1;
        }
    });
    
    const grossTotal = totalCash + totalEtransfer;
    const finalPrize = grossTotal / 2;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Serenity Bay Tracker';
    workbook.created = new Date();

    // --- Sheet 1: Campsites Directory ---
    const ws1 = workbook.addWorksheet('Campsites Directory', { views: [{ showGridLines: false }] });
    
    ws1.columns = [
        { header: 'Site', key: 'id', width: 10 },
        { header: 'Camper(s)', key: 'name', width: 30 },
        { header: 'Visited', key: 'visited', width: 15 },
        { header: 'Payment Method', key: 'purchaseType', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Do Not Bother', key: 'doNotBother', width: 18 }
    ];

    // Style Header Row
    const headerRow = ws1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; // Blue-700
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Populate Rows
    campgroundData.forEach((site, index) => {
        const row = ws1.addRow({
            id: site.id,
            name: site.name,
            visited: site.visited ? 'Yes' : 'No',
            purchaseType: site.purchaseType || '-',
            amount: site.amount || 0,
            doNotBother: site.doNotBother ? 'Yes' : 'No'
        });

        // Alternating row styling
        if (index % 2 === 1) {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }

        row.getCell('amount').numFmt = '"$"#,##0.00';
        row.alignment = { vertical: 'middle' };
        row.getCell('id').alignment = { horizontal: 'center' };
        row.getCell('visited').alignment = { horizontal: 'center' };
        row.getCell('purchaseType').alignment = { horizontal: 'center' };
        row.getCell('doNotBother').alignment = { horizontal: 'center' };

        // Dynamic Status Colors
        if (site.visited) {
            row.getCell('visited').font = { color: { argb: 'FF16A34A' }, bold: true }; // Green
        }
        if (site.purchaseType === 'Cash') {
            row.getCell('purchaseType').font = { color: { argb: 'FF15803D' }, bold: true }; 
        } else if (site.purchaseType === 'eTransfer') {
            row.getCell('purchaseType').font = { color: { argb: 'FF2563EB' }, bold: true };
        }

        if (site.doNotBother) {
            row.getCell('doNotBother').font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
            row.font = { color: { argb: 'FF9CA3AF' }, italic: true }; // Gray out unbothered sites
        }
        
        row.height = 20;
    });

    // Add faint borders to everything
    ws1.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        row.eachCell({ includeEmpty: false }, function(cell, colNumber) {
            cell.border = {
                top: {style:'thin', color: {argb:'FFE5E7EB'}},
                left: {style:'thin', color: {argb:'FFE5E7EB'}},
                bottom: {style:'thin', color: {argb:'FFE5E7EB'}},
                right: {style:'thin', color: {argb:'FFE5E7EB'}}
            };
        });
    });


    // --- Sheet 2: Tally Summary ---
    const ws2 = workbook.addWorksheet('Live Tally', { views: [{ showGridLines: false }] });
    
    ws2.getColumn('A').width = 5; // Spacing
    ws2.getColumn('B').width = 30; // Category
    ws2.getColumn('C').width = 25; // Value

    // Page Title
    ws2.mergeCells('B2:C2');
    const title = ws2.getCell('B2');
    title.value = "📊 Serenity Bay 50/50 - Final Tally";
    title.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
    title.alignment = { horizontal: 'center' };
    
    const DateCell = ws2.getCell('B3');
    ws2.mergeCells('B3:C3');
    DateCell.value = `Generated on: ${new Date().toLocaleDateString()}`;
    DateCell.alignment = { horizontal: 'center' };
    DateCell.font = { italic: true, color: { argb: 'FF6B7280' } };

    // Function to add a styled stat row
    const addStatRow = (rowNum, label, val, isMoney, bgColor, textColor, isBold) => {
        const row = ws2.getRow(rowNum);
        row.height = 25;
        row.getCell('B').value = label;
        row.getCell('C').value = val;
        
        row.getCell('B').font = { bold: isBold, color: { argb: textColor }, size: 14 };
        row.getCell('C').font = { bold: isBold, color: { argb: textColor }, size: 14 };
        
        if (isMoney) row.getCell('C').numFmt = '"$"#,##0.00';
        row.getCell('B').alignment = { vertical: 'middle', indent: 1 };
        row.getCell('C').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        
        row.getCell('B').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };

        row.getCell('B').border = { top: {style:'thin', color:{argb:'FFD1D5DB'}}, bottom: {style:'thin', color:{argb:'FFD1D5DB'}}, left: {style:'thin', color:{argb:'FFD1D5DB'}} };
        row.getCell('C').border = { top: {style:'thin', color:{argb:'FFD1D5DB'}}, bottom: {style:'thin', color:{argb:'FFD1D5DB'}}, right: {style:'thin', color:{argb:'FFD1D5DB'}} };
    };

    // Populate rows
    addStatRow(6, '💵 Total Cash Collected', totalCash, true, 'FFF0FDF4', 'FF166534', false); // Green tint
    addStatRow(7, '📱 Total eTransfer Collected', totalEtransfer, true, 'FFEFF6FF', 'FF1E40AF', false); // Blue tint
    addStatRow(8, '💰 Gross Total Raised', grossTotal, true, 'FFFFFBEB', 'FF92400E', true); // Yellow tint
    addStatRow(10, '🏆 50% Draw Prize Output', finalPrize, true, 'FFDCFCE7', 'FF16A34A', true); // Bright green tint
    ws2.getRow(10).height = 35; // Make prize bigger
    ws2.getRow(10).getCell('B').font = { bold: true, color: { argb: 'FF16A34A' }, size: 18 };
    ws2.getRow(10).getCell('C').font = { bold: true, color: { argb: 'FF16A34A' }, size: 18 };

    addStatRow(13, '🎟️ Estimated Tickets Sold', estimatedTickets, false, 'FFF3F4F6', 'FF374151', true);
    ws2.getCell('C13').alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Download the file via blob
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `SerenityBay_50-50_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function saveData() {
    dataRef.set(campgroundData);
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
    // Dynamic filtering works on every keystroke
    currentFilter = e.target.value.trim();
    renderList();
});

closeQrBtn.addEventListener('click', () => {
    qrModal.classList.add('hidden');
    qrModal.classList.remove('flex');
});

helpBtn.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
    helpModal.classList.add('flex');
});

closeHelpBtn.addEventListener('click', () => {
    helpModal.classList.add('hidden');
    helpModal.classList.remove('flex');
});

exportFromHelpBtn.addEventListener('click', exportToExcel);

tallyBtn.addEventListener('click', () => {
    let totalCash = 0;
    let totalEtransfer = 0;
    let estimatedTickets = 0;
    
    campgroundData.forEach(site => {
        if (site.visited && site.amount) {
            if (site.purchaseType === 'Cash') totalCash += site.amount;
            if (site.purchaseType === 'eTransfer') totalEtransfer += site.amount;
            
            // Ticket scale based on images
            if (site.amount === 5) estimatedTickets += 1;
            else if (site.amount === 10) estimatedTickets += 3;
            else if (site.amount === 20) estimatedTickets += 7;
            else estimatedTickets += Math.floor(site.amount / 5) * 1; // Fallback
        }
    });
    
    const grossTotal = totalCash + totalEtransfer;
    const finalPrize = grossTotal / 2;
    
    tallyContent.innerHTML = `
        <div class="flex justify-between border-b pb-2"><span class="font-semibold">💵 Total Cash:</span> <span>$${totalCash.toFixed(2)}</span></div>
        <div class="flex justify-between border-b pb-2"><span class="font-semibold">📱 Total eTransfer:</span> <span>$${totalEtransfer.toFixed(2)}</span></div>
        <div class="flex justify-between border-b pb-2 text-blue-700 bg-blue-50 p-2 rounded mt-2"><span class="font-bold">💰 Gross Raised:</span> <span class="font-bold">$${grossTotal.toFixed(2)}</span></div>
        <div class="flex justify-between border-b pb-2 text-green-700 bg-green-50 p-2 rounded mt-2 shadow-sm border border-green-200"><span class="font-bold text-xl">🏆 Draw Prize (50%):</span> <span class="font-bold text-xl">$${finalPrize.toFixed(2)}</span></div>
        <div class="mt-4 text-center text-sm text-gray-500 bg-gray-100 p-3 rounded">
            Estimated Tickets Sold: <span class="font-bold text-gray-800 text-lg">${estimatedTickets}</span>
            <br/><span class="text-xs">(Tickets: $5=1, $10=3, $20=7)</span>
        </div>
    `;
    
    tallyModal.classList.remove('hidden');
    tallyModal.classList.add('flex');
});

closeTallyBtn.addEventListener('click', () => {
    tallyModal.classList.add('hidden');
    tallyModal.classList.remove('flex');
});

function doResetAll() {
    const pw = prompt("Enter admin password to reset data:");
    if (pw !== "serenity2026") {
        if (pw !== null) alert("Incorrect password.");
        return;
    }
    if (!confirm("⚠️ This will erase ALL of this week's data — are you sure?")) return;
    if (!confirm("🛑 Make sure you're sure!! This CANNOT be undone. Proceed?")) return;
    // Remove all extra entries entirely, then reset regular sites
    campgroundData = campgroundData.filter(s => !s.isExtra);
    campgroundData.forEach(site => {
        site.visited = false;
        site.purchaseType = null;
        site.amount = null;
    });
    saveData();
    renderList();
    tallyModal.classList.add('hidden');
    tallyModal.classList.remove('flex');
    helpModal.classList.add('hidden');
    helpModal.classList.remove('flex');
}

resetAllBtnHelp.addEventListener('click', doResetAll);

let pz;
mapBtn.addEventListener('click', () => {
    mapModal.classList.remove('hidden');
    mapModal.classList.add('flex');
    
    // Initialize panzoom only after the modal is visible so it calculates boundaries correctly
    if (!pz) {
        const mapImage = document.getElementById('mapImage');
        pz = panzoom(mapImage, {
            maxZoom: 6,
            minZoom: 0.5,
            bounds: true,
            boundsPadding: 0.1
        });
    }
});

closeMapBtn.addEventListener('click', () => {
    mapModal.classList.add('hidden');
    mapModal.classList.remove('flex');
});

// Prevent the browser back button from navigating away from the app.
// If a modal is open, back closes it. Otherwise, stay on the app.
history.pushState({ page: 'app' }, '', window.location.href);
window.addEventListener('popstate', () => {
    const modals = [qrModal, tallyModal, mapModal, helpModal];
    const openModal = modals.find(m => !m.classList.contains('hidden'));
    if (openModal) {
        openModal.classList.add('hidden');
        openModal.classList.remove('flex');
    }
    // Always push back so the browser never actually goes back
    history.pushState({ page: 'app' }, '', window.location.href);
});

// Initial render is triggered by the Firebase onValue listener above