const CACHE_KEY = "5050_tracker_data";

// Load data or initialize from defaults
let campgroundData = JSON.parse(localStorage.getItem(CACHE_KEY));
if (!campgroundData) {
    campgroundData = defaultCampsites;
}

// Global Variables
let currentFilter = '';
let qrCodeInstance = null;

// DOM Elements
const searchInput = document.getElementById('searchSite');
const sitesList = document.getElementById('sitesList');
const qrModal = document.getElementById('qrModal');
const qrCodeContainer = document.getElementById('qrcode');
const closeQrBtn = document.getElementById('closeQr');
const exportHeaderBtn = document.getElementById('exportHeaderBtn');
const tallyModal = document.getElementById('tallyModal');
const closeTallyBtn = document.getElementById('closeTally');
const tallyBtn = document.getElementById('tallyBtn');
const tallyContent = document.getElementById('tallyContent');
const resetAllBtn = document.getElementById('resetAllBtn');
const mapBtn = document.getElementById('mapBtn');
const mapModal = document.getElementById('mapModal');
const closeMapBtn = document.getElementById('closeMap');

// Render the list
function renderList() {
    sitesList.innerHTML = '';
    
    // Filter data
    const filtered = campgroundData.filter(site => {
        const query = currentFilter.toLowerCase();
        return site.id.toLowerCase().includes(query);
    });

    filtered.forEach(site => {
        const card = document.createElement('div');
        card.className = `site-card ${site.doNotBother ? 'opacity-60 bg-gray-200 border-red-300' : 'bg-white'}`;
        
        let statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Pending</span>`;
        if (site.visited) {
            statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Visited</span>`;
        }

        let innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <div class="text-lg font-bold text-gray-800">${site.id} - ${site.name}</div>
                <div>${statusBadge}</div>
            </div>
        `;

        // If 'Do not bother', show flag
        if (site.doNotBother) {
            innerHTML += `<div class="text-sm font-bold text-red-600 mb-1">🚫 Do Not Bother</div>`;
        } else {
            // Expanded Action Area
            const purchaseInfo = site.visited && site.purchaseType ? `
                <div class="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm flex justify-between items-center">
                    <div>
                        <span class="font-bold">Status:</span> ${site.purchaseType} 
                        ${site.amount ? ` - $${site.amount}` : ''}
                    </div>
                    <button class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onclick="resetSite('${site.id}')">Undo</button>
                </div>
            ` : '';

            const actionButtons = !site.visited ? `
                <div class="grid grid-cols-3 gap-2 mt-2" id="actions-${site.id}">
                    <button onclick="setVisited('${site.id}', 'None')" class="py-2 px-1 bg-gray-100 text-gray-700 rounded-lg font-bold shadow-sm text-xs sm:text-sm leading-tight">Skip / No</button>
                    <button onclick="showAmountOptions('${site.id}', 'Cash')" class="py-2 px-1 bg-green-100 text-green-700 rounded-lg font-bold shadow-sm text-xs sm:text-sm leading-tight">💵 Cash</button>
                    <button onclick="showAmountOptions('${site.id}', 'eTransfer')" class="py-2 px-1 bg-blue-100 text-blue-700 rounded-lg font-bold shadow-sm text-xs sm:text-sm leading-tight">📱 eTrans</button>
                </div>
                <!-- Amount Options (Hidden by default) -->
                <div class="hidden gap-2 mt-2 flex-col" id="payment-${site.id}">
                    <div class="text-center font-bold text-gray-600 mb-1">Select <span id="payTypeLab-${site.id}"></span> Amount:</div>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="completePurchase('${site.id}', 5)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$5</button>
                        <button onclick="completePurchase('${site.id}', 10)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$10</button>
                        <button onclick="completePurchase('${site.id}', 20)" class="py-3 bg-indigo-50 border-2 border-indigo-200 text-indigo-800 rounded-lg font-bold text-lg hover:bg-indigo-100 transition-colors">$20</button>
                    </div>
                    <button id="qrBtn-${site.id}" onclick="showQR()" class="hidden mt-2 py-3 w-full bg-gray-800 text-white rounded-lg font-bold align-center justify-center">
                        <svg class="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        Show QR Code
                    </button>
                    <button onclick="cancelPayment('${site.id}')" class="mt-2 py-2 text-gray-500 underline text-sm hover:text-gray-700">Back</button>
                </div>
            ` : '';

            innerHTML += purchaseInfo + actionButtons;
        }

        card.innerHTML = innerHTML;
        sitesList.appendChild(card);
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
function exportToExcel() {
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

    // 2. Format Data for Sheet 1 (All Campsites)
    const dataRows = campgroundData.map(site => ({
        "Site Number": site.id,
        "Camper(s)": site.name,
        "Visited?": site.visited ? "Yes" : "No",
        "Payment Method": site.purchaseType || "None",
        "Amount ($)": site.amount || 0,
        "Do Not Bother": site.doNotBother ? "Yes" : "No"
    }));

    // 3. Format Data for Sheet 2 (Tally Summary)
    const tallyRows = [
        { "Metric": "Total Cash Collected", "Value": `$${totalCash.toFixed(2)}` },
        { "Metric": "Total eTransfer Collected", "Value": `$${totalEtransfer.toFixed(2)}` },
        { "Metric": "Gross Raised", "Value": `$${grossTotal.toFixed(2)}` },
        { "Metric": "Draw Prize (50%)", "Value": `$${finalPrize.toFixed(2)}` },
        { "Metric": "Estimated Tickets Sold", "Value": estimatedTickets }
    ];

    // 4. Create the Excel Workbook
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(dataRows);
    const ws2 = XLSX.utils.json_to_sheet(tallyRows);

    // Auto-size columns slightly
    ws1['!cols'] = [{wch: 12}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 12}, {wch: 15}];
    ws2['!cols'] = [{wch: 30}, {wch: 15}];

    XLSX.utils.book_append_sheet(wb, ws1, "Campsites Directory");
    XLSX.utils.book_append_sheet(wb, ws2, "Tally Summary");

    // 5. Download the file
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `SerenityBay_50-50_Report_${dateStr}.xlsx`);
}

// Save to localStorage
function saveData() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(campgroundData));
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

exportHeaderBtn.addEventListener('click', exportToExcel);

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

resetAllBtn.addEventListener('click', () => {
    if(confirm("Are you SURE you want to erase all visits and totals? This cannot be undone!")) {
        campgroundData.forEach(site => {
            site.visited = false;
            site.purchaseType = null;
            site.amount = null;
        });
        saveData();
        renderList();
        tallyModal.classList.add('hidden');
        tallyModal.classList.remove('flex');
    }
});

mapBtn.addEventListener('click', () => {
    mapModal.classList.remove('hidden');
    mapModal.classList.add('flex');
});

closeMapBtn.addEventListener('click', () => {
    mapModal.classList.add('hidden');
    mapModal.classList.remove('flex');
});

// Initial Load
renderList();