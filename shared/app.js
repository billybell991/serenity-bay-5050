// ── Per-draw configuration ────────────────────────────────────────────────
// Each draw page (/5050/, /booze/) sets window.DRAW before this script loads.
// Anything not provided falls back to the 50/50 defaults below.
const DRAW = Object.assign({
    id: '5050',
    title: 'Serenity Bay 50/50',
    emoji: '\uD83C\uDF9F\uFE0F',              // 🎟️
    dbNode: 'campgroundData',
    configNode: 'config',
    resetLogNode: 'resetLog',
    resetBackupsNode: 'resetBackups',
    defaultCode: '5050',
    adminPassword: 'serenity2026',
    codeLabel: 'Weekly',                       // wording for the editing code
    showReset: true,                           // weekly reset feature
    showGross: true,                           // "Gross Raised" tally line
    prizeSplit: 0.5                            // null => no prize line / not a 50/50 split
}, window.DRAW || {});

const dataRef = firebase.database().ref(DRAW.dbNode);
const resetLogRef = firebase.database().ref(DRAW.resetLogNode);
const resetBackupsRef = firebase.database().ref(DRAW.resetBackupsNode);
const configRef = firebase.database().ref(DRAW.configNode);

let campgroundData = [];

// ── Edit access control: read-only by default, unlock with a weekly code ──────
// Unlock state is per-draw (and per-tab) so the 50/50 and Booze Basket lock independently.
const EDIT_UNLOCK_KEY = 'editUnlocked_' + DRAW.id;
let editingUnlocked = sessionStorage.getItem(EDIT_UNLOCK_KEY) === 'true';
let currentEditCode = null;
configRef.child('editCode').on('value', (snapshot) => {
    const code = snapshot.val();
    if (code === null || code === undefined) {
        // Seed a default editing code the first time; admins can change it in-app
        currentEditCode = DRAW.defaultCode;
        configRef.child('editCode').set(currentEditCode);
    } else {
        currentEditCode = String(code);
    }
});

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
    if (window.hookMapPolygons) window.hookMapPolygons();
});
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
const resetHistoryBtn = document.getElementById('resetHistoryBtn');
const resetHistoryModal = document.getElementById('resetHistoryModal');
const resetHistoryContent = document.getElementById('resetHistoryContent');
const closeResetHistoryBtn = document.getElementById('closeResetHistory');
const mapContainer = document.getElementById('mapContainer');
const siteListContainer = document.getElementById('sitesList');
const searchContainer = document.getElementById('searchContainer');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const viewToggleIcon = document.getElementById('viewToggleIcon');
const viewToggleText = document.getElementById('viewToggleText');
let mapVisible = false;

// Build the action buttons HTML — shared between regular sites and extras
function buildActionHTML(id, showSkip = true, addExtraId = null) {
    if (showSkip && addExtraId) {
        return `
        <div class="grid grid-cols-2 gap-3 mt-3" id="actions-${id}">
            <button onclick="showAmountOptions('${id}', 'Cash')" class="py-4 bg-green-200 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-300 active:bg-green-300">
                <span class="text-2xl mb-1">💵</span>
                <span class="text-sm">Cash</span>
            </button>
            <button onclick="showAmountOptions('${id}', 'eTransfer')" class="py-4 bg-blue-200 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-300 active:bg-blue-300">
                <span class="text-2xl mb-1">📱</span>
                <span class="text-sm">eTransfer</span>
            </button>
            <button onclick="setVisited('${id}', 'None')" class="col-span-2 py-4 bg-rose-100 text-rose-700 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-rose-200 active:bg-rose-200">
                <span class="text-2xl mb-1">🚫</span>
                <span class="text-sm">No</span>
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
            <button onclick="showAmountOptions('${id}', 'Cash')" class="py-4 bg-green-200 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-300 active:bg-green-300">
                <span class="text-2xl mb-1">💵</span>
                <span class="text-sm">Cash</span>
            </button>
            <button onclick="showAmountOptions('${id}', 'eTransfer')" class="py-4 bg-blue-200 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-300 active:bg-blue-300">
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
        card.className = `site-card cursor-pointer ${site.doNotBother ? 'opacity-60 bg-gray-200 border-red-300' : (site.visited ? 'card-visited' : 'bg-white')}`;
        if (site.visited && !site.doNotBother) {
            const bgMap = { 'Cash': '#bbf7d0', 'eTransfer': '#bfdbfe', 'None': '#fecdd3' };
            card.style.backgroundColor = bgMap[site.purchaseType] || '#f9fafb';
        }
        card.addEventListener('click', function(e) { if (!e.target.closest('button, input, select, a')) toggleCard(site.id); });
        
        let statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Pending</span>`;
        if (site.visited) {
            statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Visited</span>`;
        }

        let bodyHTML = '';
        if (site.doNotBother) {
            bodyHTML = `<div class="text-sm font-bold text-red-600 mb-1">🚫 Do Not Bother</div>`;
        } else {
            const purchaseInfo = site.visited && site.purchaseType ? `
                <div class="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                    <div class="flex justify-between items-center">
                        <div><span class="font-bold">Status:</span> ${site.purchaseType}${site.amount ? ` - $${site.amount}` : ''}</div>
                        ${editingUnlocked ? `<button class="undo-btn px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onclick="confirmReset('${site.id}')">Undo</button>` : ''}
                    </div>
                    ${editingUnlocked && site.purchaseType !== 'None' ? `<button onclick="addExtra('${site.id}')" class="undo-btn mt-2 w-full py-2 bg-orange-100 text-orange-700 rounded-lg font-bold text-sm border border-orange-200 active:bg-orange-200">&#x2795; Add Extra</button>` : ''}
                </div>
            ` : '';
            const lockedHint = `<div class="mt-1 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700 text-center font-semibold">\uD83D\uDD12 View-only — tap the amber bar at the top to unlock editing</div>`;
            bodyHTML = purchaseInfo + (!site.visited ? (editingUnlocked ? buildActionHTML(site.id, true, site.id) : lockedHint) : '');
        }

        const innerHTML = `
            <div class="flex justify-between items-center mb-1">
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
                    ${editingUnlocked ? `<button class="undo-btn px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onclick="confirmReset('${extra.id}')">Undo</button>` : ''}
                </div>
            ` : '';
            const extraBodyHTML = extraPurchaseInfo + (!extra.visited ? (editingUnlocked ? buildActionHTML(extra.id, false) : '') : '');

            const extraHTML = `
                <div class="flex justify-between items-center mb-1 cursor-pointer" onclick="toggleCard('${extra.id}')">
                    <div class="text-base font-bold text-orange-800">📎 Extra @ ${extra.parentId}</div>
                    <div class="flex items-center gap-2">
                        ${extraStatusBadge}
                        ${editingUnlocked ? `<button onclick="event.stopPropagation(); removeExtra('${extra.id}')" class="text-xs text-red-500 font-bold px-2 py-1 bg-red-50 border border-red-200 rounded">✕</button>` : ''}
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
    if (!window.requireEdit()) return;
    const site = campgroundData.find(s => s.id === id);
    if(site) {
        site.visited = true;
        site.purchaseType = type;
        site.amount = amount;
        saveData();
        renderList();
        // Re-expand the card so the user can see Add Extra / Undo without re-tapping
        toggleCard(id);
        if (window.updateMapColors) window.updateMapColors();
        const refreshId = site.isExtra ? site.parentId : id;
        if (currentMapSiteId === refreshId) window.openSiteModal(refreshId);
    }
}

window.resetSite = function(id) {
    if (!window.requireEdit()) return;
    const site = campgroundData.find(s => s.id === id);
    if (site) {
        site.visited = false;
        site.purchaseType = null;
        site.amount = null;
        // If this is a main site, also remove all its extras entirely
        if (!site.isExtra) {
            campgroundData = campgroundData.filter(s => !(s.isExtra && s.parentId === id));
        }
        saveData();
        renderList();
        if (window.updateMapColors) window.updateMapColors();
        const refreshId = site.isExtra ? site.parentId : id;
        if (currentMapSiteId === refreshId) window.openSiteModal(refreshId);
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
    if (!window.requireEdit()) return;
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
    // Keep parent card open and auto-expand the new extra card
    const parentBody = document.getElementById(`body-${parentId}`);
    if (parentBody) parentBody.classList.remove('hidden');
    toggleCard(newId);
}

window.removeExtra = function(id) {
    if (!window.requireEdit()) return;
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
    const finalPrize = DRAW.prizeSplit ? grossTotal * DRAW.prizeSplit : 0;

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
    title.value = "📊 " + DRAW.title + " - Final Tally";
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
    if (DRAW.showGross) {
        addStatRow(8, '💰 Gross Total Raised', grossTotal, true, 'FFFFFBEB', 'FF92400E', true); // Yellow tint
    }
    if (DRAW.prizeSplit) {
        addStatRow(10, `🏆 ${Math.round(DRAW.prizeSplit * 100)}% Draw Prize Output`, finalPrize, true, 'FFDCFCE7', 'FF16A34A', true); // Bright green tint
        ws2.getRow(10).height = 35; // Make prize bigger
        ws2.getRow(10).getCell('B').font = { bold: true, color: { argb: 'FF16A34A' }, size: 18 };
        ws2.getRow(10).getCell('C').font = { bold: true, color: { argb: 'FF16A34A' }, size: 18 };
    }

    addStatRow(13, '🎟️ Estimated Tickets Sold', estimatedTickets, false, 'FFF3F4F6', 'FF374151', true);
    ws2.getCell('C13').alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Download the file via blob
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const safeName = DRAW.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    link.download = `${safeName}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.add('hidden');
        helpModal.classList.remove('flex');
    }
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
    const finalPrize = DRAW.prizeSplit ? grossTotal * DRAW.prizeSplit : 0;

    const grossLine = DRAW.showGross ? `
        <div class="flex justify-between border-b pb-2 text-blue-700 bg-blue-50 p-2 rounded mt-2"><span class="font-bold">💰 Gross Raised:</span> <span class="font-bold">$${grossTotal.toFixed(2)}</span></div>` : '';
    const prizeLine = DRAW.prizeSplit ? `
        <div class="flex justify-between border-b pb-2 text-green-700 bg-green-50 p-2 rounded mt-2 shadow-sm border border-green-200"><span class="font-bold text-xl">🏆 Draw Prize (${Math.round(DRAW.prizeSplit * 100)}%):</span> <span class="font-bold text-xl">$${finalPrize.toFixed(2)}</span></div>` : '';

    tallyContent.innerHTML = `
        <div class="flex justify-between border-b pb-2"><span class="font-semibold">💵 Total Cash:</span> <span>$${totalCash.toFixed(2)}</span></div>
        <div class="flex justify-between border-b pb-2"><span class="font-semibold">📱 Total eTransfer:</span> <span>$${totalEtransfer.toFixed(2)}</span></div>
        ${grossLine}
        ${prizeLine}
        <div class="mt-4 text-center text-sm text-gray-500 bg-gray-100 p-3 rounded">
            Estimated Tickets Sold: <span class="font-bold text-gray-800 text-lg">${estimatedTickets}</span>
            <br/><span class="text-xs">(Tickets: $5=1, $10=3, $20=7)</span>
        </div>
    `;
    
    tallyModal.classList.remove('hidden');
    tallyModal.classList.add('flex');
    updateTallyAdminVisibility();
});

closeTallyBtn.addEventListener('click', () => {
    tallyModal.classList.add('hidden');
    tallyModal.classList.remove('flex');
});

tallyModal.addEventListener('click', (e) => {
    if (e.target === tallyModal) {
        tallyModal.classList.add('hidden');
        tallyModal.classList.remove('flex');
    }
});

// ── Reset All Data — modal-driven (iOS-safe, no prompt/confirm) ──────────────
const resetPasswordModal  = document.getElementById('resetPasswordModal');
const resetPasswordInput  = document.getElementById('resetPasswordInput');
const resetPasswordError  = document.getElementById('resetPasswordError');
const resetPasswordCancel = document.getElementById('resetPasswordCancel');
const resetPasswordSubmit = document.getElementById('resetPasswordSubmit');
const resetConfirmModal   = document.getElementById('resetConfirmModal');
const resetConfirmCancel  = document.getElementById('resetConfirmCancel');
const resetConfirmGo      = document.getElementById('resetConfirmGo');

function showResetPasswordModal() {
    resetPasswordInput.value = '';
    resetPasswordError.classList.add('hidden');
    resetPasswordModal.classList.remove('hidden');
    resetPasswordModal.classList.add('flex');
    // Small delay so the modal is visible before keyboard opens on mobile
    setTimeout(() => resetPasswordInput.focus(), 100);
}

function hideResetPasswordModal() {
    resetPasswordModal.classList.add('hidden');
    resetPasswordModal.classList.remove('flex');
    resetPasswordInput.value = '';
    resetPasswordError.classList.add('hidden');
}

function showResetConfirmModal() {
    resetConfirmModal.classList.remove('hidden');
    resetConfirmModal.classList.add('flex');
}

function hideResetConfirmModal() {
    resetConfirmModal.classList.add('hidden');
    resetConfirmModal.classList.remove('flex');
}

function executeReset() {
    // ── Snapshot totals + full data BEFORE wiping ───────────────────────────
    let totalCash = 0, totalEtransfer = 0, ticketsEstimated = 0, sitesVisited = 0;
    campgroundData.forEach(site => {
        if (site.visited && site.amount) {
            sitesVisited++;
            if (site.purchaseType === 'Cash') totalCash += site.amount;
            if (site.purchaseType === 'eTransfer') totalEtransfer += site.amount;
            if (site.amount === 5) ticketsEstimated += 1;
            else if (site.amount === 10) ticketsEstimated += 3;
            else if (site.amount === 20) ticketsEstimated += 7;
            else ticketsEstimated += Math.floor(site.amount / 5);
        }
    });
    const grossTotal = totalCash + totalEtransfer;
    const prizeAmount = DRAW.prizeSplit ? grossTotal * DRAW.prizeSplit : 0;
    const timestamp = Date.now();
    const summary = {
        timestamp,
        date: new Date(timestamp).toISOString(),
        sitesVisited,
        cashTotal: totalCash,
        eTransferTotal: totalEtransfer,
        grossTotal,
        prizeAmount,
        ticketsEstimated
    };
    // Full restorable snapshot — keyed by timestamp so it's easy to find
    resetBackupsRef.child(String(timestamp)).set({ ...summary, data: campgroundData });
    // Lightweight log entry for the Reset History viewer
    resetLogRef.push(summary);

    campgroundData = campgroundData.filter(s => !s.isExtra);
    campgroundData.forEach(site => {
        site.visited = false;
        site.purchaseType = null;
        site.amount = null;
    });
    saveData();
    renderList();
    helpModal.classList.add('hidden');
    helpModal.classList.remove('flex');
    // Stay on the Live Tally screen and refresh its numbers (now all zeros)
    tallyBtn.click();
}

resetAllBtnHelp.addEventListener('click', showResetPasswordModal);

// ── Reset History viewer ────────────────────────────────────────────────────
function showResetHistoryModal() {
    resetHistoryContent.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Loading…</p>';
    resetHistoryModal.classList.remove('hidden');
    resetHistoryModal.classList.add('flex');
    resetLogRef.once('value').then(snap => {
        const val = snap.val();
        if (!val) {
            resetHistoryContent.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No resets recorded yet.</p>';
            return;
        }
        const entries = Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resetHistoryContent.innerHTML = entries.map(e => {
            const when = e.timestamp ? new Date(e.timestamp).toLocaleString() : (e.date || 'Unknown');
            return `
            <div class="border rounded-lg p-3 bg-gray-50">
                <div class="font-semibold text-gray-700 text-sm mb-1">${when}</div>
                <div class="text-xs text-gray-600 grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span>💵 Cash:</span><span class="text-right">$${(e.cashTotal||0).toFixed(2)}</span>
                    <span>📱 eTransfer:</span><span class="text-right">$${(e.eTransferTotal||0).toFixed(2)}</span>
                    <span>💰 Gross:</span><span class="text-right font-semibold">$${(e.grossTotal||0).toFixed(2)}</span>
                    <span>🏆 Prize:</span><span class="text-right font-semibold text-green-700">$${(e.prizeAmount||0).toFixed(2)}</span>
                    <span>🏕️ Sites:</span><span class="text-right">${e.sitesVisited||0}</span>
                    <span>🎟️ Tickets:</span><span class="text-right">${e.ticketsEstimated||0}</span>
                </div>
            </div>`;
        }).join('');
    }).catch(err => {
        resetHistoryContent.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Couldn’t load history: ${err.message}</p>`;
    });
}

function hideResetHistoryModal() {
    resetHistoryModal.classList.add('hidden');
    resetHistoryModal.classList.remove('flex');
}

resetHistoryBtn.addEventListener('click', showResetHistoryModal);
closeResetHistoryBtn.addEventListener('click', hideResetHistoryModal);
resetHistoryModal.addEventListener('click', (e) => {
    if (e.target === resetHistoryModal) hideResetHistoryModal();
});

resetPasswordCancel.addEventListener('click', hideResetPasswordModal);
resetPasswordModal.addEventListener('click', (e) => {
    if (e.target === resetPasswordModal) hideResetPasswordModal();
});

resetPasswordSubmit.addEventListener('click', () => {
    if (resetPasswordInput.value === DRAW.adminPassword) {
        hideResetPasswordModal();
        showResetConfirmModal();
    } else {
        resetPasswordError.classList.remove('hidden');
        resetPasswordInput.value = '';
        resetPasswordInput.focus();
    }
});

// Allow pressing Enter in the password field to submit
resetPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetPasswordSubmit.click();
});

resetConfirmCancel.addEventListener('click', hideResetConfirmModal);
resetConfirmModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmModal) hideResetConfirmModal();
});

resetConfirmGo.addEventListener('click', () => {
    hideResetConfirmModal();
    executeReset();
});

// ── Edit access control UI ──────────────────────────────────────────────────
const lockToggleBar   = document.getElementById('lockToggleBar');
const unlockModal     = document.getElementById('unlockModal');
const unlockCodeInput = document.getElementById('unlockCodeInput');
const unlockError     = document.getElementById('unlockError');
const unlockCancel    = document.getElementById('unlockCancel');
const unlockSubmit    = document.getElementById('unlockSubmit');
const changeEditCodeBtn = document.getElementById('changeEditCodeBtn');
const editCodeModal   = document.getElementById('editCodeModal');
const editCodeAdminPw = document.getElementById('editCodeAdminPw');
const editCodeNew     = document.getElementById('editCodeNew');
const editCodeError   = document.getElementById('editCodeError');
const editCodeSuccess = document.getElementById('editCodeSuccess');
const editCodeCancel  = document.getElementById('editCodeCancel');
const editCodeSave    = document.getElementById('editCodeSave');

function updateLockUI() {
    if (!lockToggleBar) return;
    if (editingUnlocked) {
        // Once unlocked, hide the bar entirely so it stays out of the way while working.
        lockToggleBar.style.display = 'none';
    } else {
        lockToggleBar.style.display = '';
        lockToggleBar.innerHTML = '\uD83D\uDD12 View-only \u2014 tap to unlock editing';
        lockToggleBar.className = 'block w-full text-center py-3 px-4 font-bold border-b focus:outline-none bg-amber-100 text-amber-800 border-amber-200 active:bg-amber-200';
    }
    positionMapBelowChrome();
}

// Keep the fixed map overlay starting right below the header + (visible) lock bar,
// so the "View-only" bar is never covered by the map.
function positionMapBelowChrome() {
    if (!mapContainer) return;
    const header = document.querySelector('header');
    let top = header ? header.offsetHeight : 0;
    if (lockToggleBar && lockToggleBar.style.display !== 'none') {
        top += lockToggleBar.offsetHeight;
    }
    mapContainer.style.top = top + 'px';
}
window.addEventListener('resize', positionMapBelowChrome);

// Show the Tally admin tools only when editing is unlocked — locked users see tally only
function updateTallyAdminVisibility() {
    const adminSection = document.getElementById('tallyAdminSection');
    if (adminSection) adminSection.style.display = editingUnlocked ? '' : 'none';
}

function setEditingUnlocked(val) {
    editingUnlocked = val;
    sessionStorage.setItem(EDIT_UNLOCK_KEY, val ? 'true' : 'false');
    updateLockUI();
    updateTallyAdminVisibility();
    renderList();
}

function showUnlockModal() {
    unlockCodeInput.value = '';
    unlockError.classList.add('hidden');
    unlockModal.classList.remove('hidden');
    unlockModal.classList.add('flex');
    setTimeout(() => unlockCodeInput.focus(), 100);
}

function hideUnlockModal() {
    unlockModal.classList.add('hidden');
    unlockModal.classList.remove('flex');
    unlockCodeInput.value = '';
    unlockError.classList.add('hidden');
}

// Returns true if editing is allowed; otherwise prompts to unlock and returns false
window.requireEdit = function() {
    if (editingUnlocked) return true;
    showUnlockModal();
    return false;
};

lockToggleBar.addEventListener('click', () => {
    if (editingUnlocked) {
        setEditingUnlocked(false);
    } else {
        showUnlockModal();
    }
});

unlockCancel.addEventListener('click', hideUnlockModal);
unlockModal.addEventListener('click', (e) => {
    if (e.target === unlockModal) hideUnlockModal();
});

unlockSubmit.addEventListener('click', () => {
    const entered = (unlockCodeInput.value || '').trim();
    if (currentEditCode && entered.toLowerCase() === String(currentEditCode).toLowerCase()) {
        hideUnlockModal();
        setEditingUnlocked(true);
    } else {
        unlockError.classList.remove('hidden');
        unlockCodeInput.value = '';
        unlockCodeInput.focus();
    }
});

unlockCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockSubmit.click();
});

// ── Admin: set the weekly editing code ──────────────────────────────────────
function showEditCodeModal() {
    editCodeAdminPw.value = '';
    editCodeNew.value = '';
    editCodeError.classList.add('hidden');
    editCodeSuccess.classList.add('hidden');
    editCodeModal.classList.remove('hidden');
    editCodeModal.classList.add('flex');
    setTimeout(() => editCodeAdminPw.focus(), 100);
}

function hideEditCodeModal() {
    editCodeModal.classList.add('hidden');
    editCodeModal.classList.remove('flex');
}

changeEditCodeBtn.addEventListener('click', showEditCodeModal);
editCodeCancel.addEventListener('click', hideEditCodeModal);
editCodeModal.addEventListener('click', (e) => {
    if (e.target === editCodeModal) hideEditCodeModal();
});

editCodeSave.addEventListener('click', () => {
    editCodeError.classList.add('hidden');
    editCodeSuccess.classList.add('hidden');
    if (editCodeAdminPw.value !== DRAW.adminPassword) {
        editCodeError.classList.remove('hidden');
        editCodeAdminPw.value = '';
        editCodeAdminPw.focus();
        return;
    }
    const newCode = (editCodeNew.value || '').trim();
    if (!newCode) {
        editCodeNew.focus();
        return;
    }
    configRef.child('editCode').set(newCode).then(() => {
        editCodeSuccess.classList.remove('hidden');
        setTimeout(hideEditCodeModal, 1200);
    });
});

editCodeNew.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') editCodeSave.click();
});

// Reflect the initial lock state on load
updateLockUI();

// ── Apply per-draw branding & feature flags ────────────────────────────────
(function applyDrawConfig() {
    document.title = DRAW.title;
    const titleEl = document.getElementById('appTitle');
    if (titleEl) {
        const ORG = 'Serenity Bay';
        let eyebrow = '';
        let main = DRAW.title;
        if (DRAW.title.startsWith(ORG + ' ')) {
            eyebrow = ORG;
            main = DRAW.title.slice(ORG.length + 1);
        }
        titleEl.className = 'leading-none [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]';
        const mainHtml = `<span class="block text-2xl font-bold whitespace-nowrap"><span class="hdr-emoji">${DRAW.emoji} </span>${main}<span class="hdr-emoji"> ${DRAW.emoji}</span></span>`;
        titleEl.innerHTML = eyebrow
            ? `<span class="block text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase opacity-90 mb-1">${eyebrow}</span>` + mainHtml
            : mainHtml;
    }
    // Hide the reset tools entirely when this draw doesn't do a periodic reset
    if (!DRAW.showReset) {
        ['resetAllBtnHelp', 'resetHistoryBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }
})();

viewToggleBtn.addEventListener('click', () => {
    mapVisible = !mapVisible;
    if (mapVisible) {
        mapContainer.classList.remove('hidden');
        positionMapBelowChrome();
        siteListContainer.classList.add('hidden');
        searchContainer.classList.add('hidden');
        viewToggleIcon.innerText = '📋';
        viewToggleText.innerText = 'List';
        setTimeout(() => {
            if (window._leafletMap) {
                window._leafletMap.invalidateSize({ animate: false });
                const savedZoom = localStorage.getItem('mapZoom');
                const savedLat  = localStorage.getItem('mapLat');
                const savedLng  = localStorage.getItem('mapLng');
                if (savedZoom && savedLat && savedLng) {
                    window._leafletMap.setView(
                        [parseFloat(savedLat), parseFloat(savedLng)],
                        parseFloat(savedZoom),
                        { animate: false }
                    );
                } else {
                    // Fit to container HEIGHT so the map fills the screen (user pans left/right)
                    const sz = window._leafletMap.getSize();
                    const zoom = Math.log2(sz.y / 1790);
                    window._leafletMap.setView([895, 1200], zoom);
                }
                // Start persisting position now that the map is properly sized
                if (!window._mapMoveListenerAttached) {
                    window._mapMoveListenerAttached = true;
                    window._leafletMap.on('moveend', function() {
                        const c = window._leafletMap.getCenter();
                        localStorage.setItem('mapZoom', window._leafletMap.getZoom());
                        localStorage.setItem('mapLat', c.lat);
                        localStorage.setItem('mapLng', c.lng);
                    });
                }
            }
            if (window.hookMapPolygons) window.hookMapPolygons();
        }, 200);
    } else {
        mapContainer.classList.add('hidden');
        siteListContainer.classList.remove('hidden');
        searchContainer.classList.remove('hidden');
        viewToggleIcon.innerText = '🗺️';
        viewToggleText.innerText = 'Map';
    }
});

// Prevent the browser back button from navigating away from the app.
// If a modal is open, back closes it. Otherwise, stay on the app.
history.pushState({ page: 'app' }, '', window.location.href);
window.addEventListener('popstate', () => {
    const modals = [qrModal, tallyModal, helpModal];
    const openModal = modals.find(m => !m.classList.contains('hidden'));
    if (openModal) {
        openModal.classList.add('hidden');
        openModal.classList.remove('flex');
    }
    // Always push back so the browser never actually goes back
    history.pushState({ page: 'app' }, '', window.location.href);
});

// ─── MAP INTEGRATION ──────────────────────────────────────────────────────────

const siteActionModal = document.getElementById('siteActionModal');
const siteActionSheet = document.getElementById('siteActionSheet');
const saTitle = document.getElementById('sa-title');
const saContent = document.getElementById('sa-content');
let currentMapSiteId = null;

function closeMapSheet() {
    siteActionSheet.classList.add('translate-y-full');
    setTimeout(() => {
        siteActionModal.classList.add('hidden');
        siteActionModal.classList.remove('flex');
        currentMapSiteId = null;
    }, 300);
}

siteActionModal.addEventListener('click', (e) => {
    if (e.target === siteActionModal) closeMapSheet();
});

window.openSiteModal = function(siteId) {
    const site = campgroundData.find(s => s.id === siteId);
    if (!site) return;
    currentMapSiteId = siteId;

    saTitle.textContent = site.id + (site.name ? ' \u2014 ' + site.name : '');

    let bodyHTML = '';
    if (site.doNotBother) {
        bodyHTML = '<div class="text-sm font-bold text-red-600 mb-3">\uD83D\uDEAB Do Not Bother</div>';
    } else if (site.visited && site.purchaseType) {
        const siteExtras = campgroundData.filter(s => s.isExtra && s.parentId === siteId);
        let extrasHTML = '';
        siteExtras.forEach(extra => {
            if (extra.visited && extra.purchaseType) {
                extrasHTML += `<div class="mt-2 ml-3 p-2 bg-white rounded-lg border border-orange-200 text-sm flex justify-between items-center">
                    <div>&#8627; <span class="font-semibold">${extra.purchaseType}${extra.amount ? ' &mdash; $' + extra.amount : ''}</span></div>
                    ${editingUnlocked ? `<button onclick="window.confirmReset('${extra.id}')" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Undo</button>` : ''}
                </div>`;
            } else if (editingUnlocked) {
                extrasHTML += `<div class="mt-2 ml-3 border-l-4 border-orange-200 pl-3">
                    <div class="text-xs text-orange-600 font-semibold mb-1">&#8627; Extra ticket:</div>
                    ${buildModalExtraActionHTML(extra.id)}
                </div>`;
            }
        });
        bodyHTML = `
            <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                <div class="font-bold text-lg">${site.purchaseType}${site.amount ? ' &mdash; $' + site.amount : ''}</div>
            </div>
            ${extrasHTML}
            ${editingUnlocked && site.purchaseType !== 'None' ? `<button onclick="window.modalAddExtra('${site.id}')" class="w-full mt-2 py-3 bg-orange-100 text-orange-700 rounded-xl font-bold border border-orange-200 active:bg-orange-200">&#x2795; Add Extra</button>` : ''}
            ${editingUnlocked ? `<button onclick="window.confirmReset('${site.id}')" class="w-full mt-2 py-3 bg-red-100 text-red-700 rounded-xl font-bold border border-red-200 active:bg-red-200">&#8617;&#65039; Undo</button>` : ''}`;
    } else if (editingUnlocked) {
        bodyHTML = buildModalActionHTML(site.id);
    } else {
        bodyHTML = '<div class="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-700 text-center font-semibold">\uD83D\uDD12 View-only \u2014 close this and tap the amber bar at the top to unlock editing</div>';
    }

    saContent.innerHTML = bodyHTML;
    siteActionModal.classList.remove('hidden');
    siteActionModal.classList.add('flex');
    setTimeout(() => siteActionSheet.classList.remove('translate-y-full'), 10);
};

// Modal-specific action HTML — uses "modal-" ID prefix to avoid clashing with list DOM
function buildModalActionHTML(id) {
    return `
        <div class="grid grid-cols-2 gap-3 mt-3" id="modal-actions-${id}">
            <button onclick="window.modalShowAmount('${id}', 'Cash')" class="py-4 bg-green-200 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-300 active:bg-green-300">
                <span class="text-2xl mb-1">&#x1F4B5;</span>
                <span class="text-sm">Cash</span>
            </button>
            <button onclick="window.modalShowAmount('${id}', 'eTransfer')" class="py-4 bg-blue-200 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-300 active:bg-blue-300">
                <span class="text-2xl mb-1">&#x1F4F1;</span>
                <span class="text-sm">eTransfer</span>
            </button>
            <button onclick="window.setVisited('${id}', 'None')" class="col-span-2 py-4 bg-rose-100 text-rose-700 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-rose-200 active:bg-rose-200">
                <span class="text-2xl mb-1">&#x1F6AB;</span>
                <span class="text-sm">No</span>
            </button>
        </div>
        <div class="hidden gap-2 mt-2 flex-col" id="modal-payment-${id}">
            <div class="text-center font-bold text-gray-600 mb-1">Select <span id="modal-payTypeLab-${id}"></span> Amount:</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.modalComplete('${id}', 5)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg">$5</button>
                <button onclick="window.modalComplete('${id}', 10)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg">$10</button>
                <button onclick="window.modalComplete('${id}', 20)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg">$20</button>
            </div>
            <button id="modal-qrBtn-${id}" onclick="window.showQR()" class="hidden mt-2 py-3 w-full bg-gray-800 text-white rounded-lg font-bold">
                Show QR Code / Email
            </button>
            <button onclick="window.modalCancel('${id}')" class="mt-2 py-2 w-full bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold shadow-sm text-sm">Back</button>
        </div>
    `;
}

window.modalShowAmount = function(id, type) {
    tempPaymentType[id] = type;
    document.getElementById('modal-actions-' + id).classList.add('hidden');
    const payDiv = document.getElementById('modal-payment-' + id);
    payDiv.classList.remove('hidden');
    payDiv.classList.add('flex');
    document.getElementById('modal-payTypeLab-' + id).innerText = type;
    const qrBtn = document.getElementById('modal-qrBtn-' + id);
    if (type === 'eTransfer') qrBtn.classList.remove('hidden');
    else qrBtn.classList.add('hidden');
};

window.modalComplete = function(id, amount) {
    const type = tempPaymentType[id] || 'Cash';
    window.setVisited(id, type, amount);
};

window.modalCancel = function(id) {
    document.getElementById('modal-actions-' + id).classList.remove('hidden');
    const payDiv = document.getElementById('modal-payment-' + id);
    payDiv.classList.add('hidden');
    payDiv.classList.remove('flex');
};

// Undo confirm modal — iOS-safe (no confirm())
const undoConfirmModal  = document.getElementById('undoConfirmModal');
const undoConfirmCancel = document.getElementById('undoConfirmCancel');
const undoConfirmGo     = document.getElementById('undoConfirmGo');
let _pendingUndoId = null;

undoConfirmCancel.addEventListener('click', () => {
    undoConfirmModal.classList.add('hidden');
    undoConfirmModal.classList.remove('flex');
    _pendingUndoId = null;
});
undoConfirmModal.addEventListener('click', (e) => {
    if (e.target === undoConfirmModal) undoConfirmCancel.click();
});
undoConfirmGo.addEventListener('click', () => {
    undoConfirmModal.classList.add('hidden');
    undoConfirmModal.classList.remove('flex');
    if (_pendingUndoId) window.resetSite(_pendingUndoId);
    _pendingUndoId = null;
});

window.confirmReset = function(id) {
    _pendingUndoId = id;
    const site = campgroundData.find(s => s.id === id);
    const extraCount = site && !site.isExtra
        ? campgroundData.filter(s => s.isExtra && s.parentId === id).length
        : 0;
    const extraWarning = document.getElementById('undoConfirmExtrasWarning');
    if (extraWarning) {
        if (extraCount > 0) {
            extraWarning.textContent = `⚠️ This will also remove ${extraCount} extra entr${extraCount === 1 ? 'y' : 'ies'} at this site.`;
            extraWarning.classList.remove('hidden');
        } else {
            extraWarning.classList.add('hidden');
        }
    }
    undoConfirmModal.classList.remove('hidden');
    undoConfirmModal.classList.add('flex');
};

window.modalAddExtra = function(parentId) {
    window.addExtra(parentId);
    window.openSiteModal(parentId);
};

function buildModalExtraActionHTML(id) {
    return `
        <div class="grid grid-cols-2 gap-2 mt-1" id="modal-actions-${id}">
            <button onclick="window.modalShowAmount('${id}', 'Cash')" class="py-3 bg-green-200 text-green-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-green-300 active:bg-green-300">
                <span class="text-xl mb-1">&#x1F4B5;</span>
                <span class="text-xs">Cash</span>
            </button>
            <button onclick="window.modalShowAmount('${id}', 'eTransfer')" class="py-3 bg-blue-200 text-blue-800 rounded-xl font-bold shadow-sm flex flex-col items-center justify-center border border-blue-300 active:bg-blue-300">
                <span class="text-xl mb-1">&#x1F4F1;</span>
                <span class="text-xs">eTransfer</span>
            </button>
        </div>
        <div class="hidden gap-2 mt-1 flex-col" id="modal-payment-${id}">
            <div class="text-center font-bold text-gray-600 text-sm mb-1">Select <span id="modal-payTypeLab-${id}"></span> Amount:</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.modalComplete('${id}', 5)" class="py-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold">$5</button>
                <button onclick="window.modalComplete('${id}', 10)" class="py-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold">$10</button>
                <button onclick="window.modalComplete('${id}', 20)" class="py-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold">$20</button>
            </div>
            <button id="modal-qrBtn-${id}" onclick="window.showQR()" class="hidden mt-1 py-2 w-full bg-gray-800 text-white rounded-lg font-bold text-sm">Show QR Code / Email</button>
        </div>
    `;
}

window.updateMapColors = function() {
    if (!window.sitePolygons) return;
    campgroundData.forEach(site => {
        const layer = window.sitePolygons[site.id];
        if (!layer) return;
        if (site.doNotBother) {
            layer.setStyle({ fillColor: '#4B5563', fillOpacity: 0.85 });
        } else if (!site.visited) {
            layer.setStyle({ fillColor: '#D1D5DB', fillOpacity: 0.9 });
        } else if (site.purchaseType === 'Cash') {
            layer.setStyle({ fillColor: '#bbf7d0', fillOpacity: 1 });
        } else if (site.purchaseType === 'eTransfer') {
            layer.setStyle({ fillColor: '#bfdbfe', fillOpacity: 1 });
        } else if (site.purchaseType === 'None') {
            layer.setStyle({ fillColor: '#fecdd3', fillOpacity: 1 });
        }
    });
    // P45 and P46 are the same household — both mirror P45/P46's color
    if (window.sitePolygons['P45'] && window.sitePolygons['P46']) {
        const p4546 = campgroundData.find(s => s.id === 'P45/P46');
        if (p4546) {
            let col = '#D1D5DB', op = 0.9;
            if (p4546.doNotBother)                                    { col = '#4B5563'; op = 0.85; }
            else if (p4546.visited && p4546.purchaseType === 'Cash')      { col = '#bbf7d0'; op = 1; }
            else if (p4546.visited && p4546.purchaseType === 'eTransfer') { col = '#bfdbfe'; op = 1; }
            else if (p4546.visited && p4546.purchaseType === 'None')      { col = '#fecdd3'; op = 1; }
            window.sitePolygons['P45'].setStyle({ fillColor: col, fillOpacity: op });
            window.sitePolygons['P46'].setStyle({ fillColor: col, fillOpacity: op });
        }
    }
    // T4 and T5 are the same household — T5 mirrors T4/T5's color
    if (window.sitePolygons['T4'] && window.sitePolygons['T5']) {
        const t45 = campgroundData.find(s => s.id === 'T4/T5');
        if (t45) {
            let col = '#D1D5DB', op = 0.9;
            if (t45.doNotBother)            { col = '#4B5563'; op = 0.85; }
            else if (t45.visited && t45.purchaseType === 'Cash')      { col = '#bbf7d0'; op = 1; }
            else if (t45.visited && t45.purchaseType === 'eTransfer') { col = '#bfdbfe'; op = 1; }
            else if (t45.visited && t45.purchaseType === 'None')      { col = '#fecdd3'; op = 1; }
            window.sitePolygons['T4'].setStyle({ fillColor: col, fillOpacity: op });
            window.sitePolygons['T5'].setStyle({ fillColor: col, fillOpacity: op });
        }
    }
};

window.hookMapPolygons = function() {
    if (!window.sitePolygons) return;
    Object.entries(window.sitePolygons).forEach(([siteId, layer]) => {
        layer.off('click');
        layer.unbindPopup();
        // T4 and T5 are the same household — both open T4/T5's modal
        // P45 and P46 are the same household — both open P45/P46's modal
        const targetId = (siteId === 'T5' || siteId === 'T4') ? 'T4/T5' : (siteId === 'P45' || siteId === 'P46') ? 'P45/P46' : siteId;
        layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            window.openSiteModal(targetId);
        });
    });
    window.updateMapColors();
};

// Initial render is triggered by the Firebase onValue listener above