// _sync_map.js — Sync map changes from serenity_map/script.js → map_script.js
// Run with: node _sync_map.js
// NEVER use PowerShell for file writes (UTF-8 / emoji encoding rules)

const fs = require('fs');

const SERENITY = 'c:/Stuff/serenity_map/script.js';
const TARGET   = 'c:/Stuff/50_50/map_script.js';
const BACKUP   = 'c:/Stuff/50_50/map_script.js.bak';

// Normalize line endings to LF so all string replacements work regardless of platform
const serenityLines = fs.readFileSync(SERENITY, 'utf8').replace(/\r\n/g, '\n').split('\n');
let content = fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n');

// ── Backup original ──────────────────────────────────────────────────────────
fs.writeFileSync(BACKUP, content, 'utf8');
console.log('✓ Backup written to', BACKUP);

// ── 1. Extract all unique L.circle lines from serenity_map ───────────────────
// Handle both single-line and multi-line L.circle calls
const allCircles = [];
for (let i = 0; i < serenityLines.length; i++) {
    if (serenityLines[i].trim().startsWith('L.circle(')) {
        if (serenityLines[i].includes('.addTo(map)')) {
            // Single-line circle
            allCircles.push(serenityLines[i]);
        } else {
            // Multi-line circle — join until .addTo(map)
            let parts = [serenityLines[i].trim()];
            let j = i + 1;
            while (j < serenityLines.length && !serenityLines[j].includes('.addTo(map)')) {
                parts.push(serenityLines[j].trim());
                j++;
            }
            if (j < serenityLines.length) parts.push(serenityLines[j].trim());
            allCircles.push(parts.join(' '));
            i = j; // Skip processed lines
        }
    }
}
const uniqueCircles = [...new Set(allCircles)];
console.log(`✓ Extracted ${uniqueCircles.length} unique paint stroke circles`);

const paintBlock = [
    '',
    '// --- PAINT STROKES (synced from serenity_map) ---',
    ...uniqueCircles,
    '',
].join('\n');

// ── 2. Insert paint strokes before MAP PATCHES ───────────────────────────────
const MAP_PATCHES_ANCHOR = '// --- MAP PATCHES (Covering up old printed data) ---';
if (!content.includes(MAP_PATCHES_ANCHOR)) {
    console.error('ERROR: MAP PATCHES anchor not found'); process.exit(1);
}
content = content.replace(MAP_PATCHES_ANCHOR, paintBlock + MAP_PATCHES_ANCHOR);
console.log('✓ Inserted paint stroke circles before MAP PATCHES');

// ── 3. Add newParkingEmojiMarker2 and newParkingEmojiMarker3 ─────────────────
const AFTER_NEW_PARKING = `const newParkingEmojiMarker = L.marker([490, 2295], { icon: L.divIcon({ className: 'naked-site-label', html: '<div class="scalable-label" style="font-size: 28px; filter: drop-shadow(1px 1px 0px rgba(0,0,0,1)) drop-shadow(-1px -1px 0px rgba(0,0,0,1)) drop-shadow(1px -1px 0px rgba(0,0,0,1)) drop-shadow(-1px 1px 0px rgba(0,0,0,1));">🅿️</div>', iconSize: [40, 40], iconAnchor: [20, 20] })}).addTo(map).bindPopup("<b>Parking</b>");`;

const NEW_PARKING_EXTRA = `
const newParkingEmojiMarker2 = L.marker([566, 2062], {
    icon: L.divIcon({
        className: 'naked-site-label',
        html: '<div class="scalable-label" style="font-size: 28px; filter: drop-shadow(1px 1px 0px rgba(0,0,0,1)) drop-shadow(-1px -1px 0px rgba(0,0,0,1)) drop-shadow(1px -1px 0px rgba(0,0,0,1)) drop-shadow(-1px 1px 0px rgba(0,0,0,1));">🅿️</div>',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    })
}).addTo(map).bindPopup("<b>Parking</b>");

const newParkingEmojiMarker3 = L.marker([864, 1014], {
    icon: L.divIcon({
        className: 'naked-site-label',
        html: '<div class="scalable-label" style="font-size: 28px; filter: drop-shadow(1px 1px 0px rgba(0,0,0,1)) drop-shadow(-1px -1px 0px rgba(0,0,0,1)) drop-shadow(1px -1px 0px rgba(0,0,0,1)) drop-shadow(-1px 1px 0px rgba(0,0,0,1));">🅿️</div>',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    })
}).addTo(map).bindPopup("<b>Parking</b>");
`;

if (!content.includes(AFTER_NEW_PARKING)) {
    console.error('ERROR: newParkingEmojiMarker anchor not found'); process.exit(1);
}
content = content.replace(AFTER_NEW_PARKING, AFTER_NEW_PARKING + NEW_PARKING_EXTRA);
console.log('✓ Added newParkingEmojiMarker2 and newParkingEmojiMarker3');

// ── 4. Add frisbeeGolfMarker after horseshoesMarker ──────────────────────────
const AFTER_HORSESHOES = `}).addTo(map).bindPopup("<b>Horseshoes</b>");`;
const FRISBEE_MARKER = `

const frisbeeGolfMarker = L.marker([345, 198], {
    icon: L.divIcon({
        className: 'naked-site-label',
        html: '<div class="scalable-label" style="font-size: 40px; filter: drop-shadow(1px 1px 0px rgba(0,0,0,1)) drop-shadow(-1px -1px 0px rgba(0,0,0,1)) drop-shadow(1px -1px 0px rgba(0,0,0,1)) drop-shadow(-1px 1px 0px rgba(0,0,0,1));">💿</div>',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    })
}).addTo(map).bindPopup("<b>Frisbee Golf</b>");`;

if (!content.includes(AFTER_HORSESHOES)) {
    console.error('ERROR: horseshoes anchor not found'); process.exit(1);
}
// Only replace the first occurrence (the Horseshoes marker end)
const horseshoesIdx = content.indexOf(AFTER_HORSESHOES);
content = content.slice(0, horseshoesIdx + AFTER_HORSESHOES.length)
    + FRISBEE_MARKER
    + content.slice(horseshoesIdx + AFTER_HORSESHOES.length);
console.log('✓ Added frisbeeGolfMarker');

// ── 5. Update S6 (expanded to absorb S7) ────────────────────────────────────
const S6_OLD = `// --- SITE S6 ---
const s6Center = [237, 1301];
const s6AreaCoords = [[205.1,1278.4],[206.9,1236.2],[233.1,1254.6],[255.7,1277.2],[278.3,1304.6],[288.4,1318.8],[294.3,1331.3],[217.6,1355.7],[211.1,1338.5],[208.7,1319.4],[205.7,1301]];
const s6Poly = L.polygon(s6AreaCoords, { className: 'organic-polygon', fillColor: '#b5c898', fillOpacity: 1 }).addTo(map).bindPopup("<b>S6 - Paula & Peter</b>");
const s6Marker = L.marker(s6Center, { icon: L.divIcon({ className: 'naked-site-label', html: '<div class="scalable-label">S6</div>', iconSize: [60,60], iconAnchor: [30,30] }), interactive: false}).addTo(map);`;

const S6_NEW = `// --- SITE S6 ---
const s6Center = [259, 1355];
const s6AreaCoords = [[205.1,1278.4],[206.9,1236.2],[233.1,1254.6],[255.7,1277.2],[278.3,1304.6],[288.4,1318.8],[301,1344.6],[312,1371.5],[327.6,1429.4],[249.7,1456.2],[217.6,1355.7],[211.1,1338.5],[208.7,1319.4],[205.7,1301]];
const s6Poly = L.polygon(s6AreaCoords, { className: 'organic-polygon', fillColor: '#b5c898', fillOpacity: 1 }).addTo(map).bindPopup("<b>S6 - Paula & Peter</b>");
const s6Marker = L.marker(s6Center, { icon: L.divIcon({ className: 'naked-site-label', html: '<div class="scalable-label">S6</div>', iconSize: [60,60], iconAnchor: [30,30] }), interactive: false}).addTo(map);`;

if (!content.includes(S6_OLD)) {
    console.error('ERROR: S6 anchor not found'); process.exit(1);
}
content = content.replace(S6_OLD, S6_NEW);
console.log('✓ Updated S6 polygon (expanded to absorb S7 area)');

// ── 6. Remove S7 section ─────────────────────────────────────────────────────
const S7_BLOCK = `\n// --- SITE S7 ---
const s7Center = [277.1, 1395.0];
const s7AreaCoords = [[217.6,1355.7],[294.3,1331.3],[306.2,1355.1],[314.5,1378.9],[322.3,1405],[327.6,1429.4],[249.7,1456.2]];
const s7Poly = L.polygon(s7AreaCoords, { className: 'organic-polygon', fillColor: '#b5c898', fillOpacity: 1 }).addTo(map).bindPopup("<b>Site S7</b>");
const s7Marker = L.marker(s7Center, { icon: L.divIcon({ className: 'naked-site-label', html: '<div class="scalable-label">S7</div>', iconSize: [60,60], iconAnchor: [30,30] }), interactive: false}).addTo(map);`;

if (!content.includes(S7_BLOCK)) {
    console.error('ERROR: S7 block not found'); process.exit(1);
}
content = content.replace(S7_BLOCK, '');
console.log('✓ Removed S7 polygon (merged into S6)');

// ── 6b. Remove S7 from sitePolygons map ──────────────────────────────────────
const S7_POLY_REF = `  'S7': s7Poly,\n`;
if (content.includes(S7_POLY_REF)) {
    content = content.replace(S7_POLY_REF, '');
    console.log('✓ Removed S7 from sitePolygons map reference');
}

// ── 7. Update legend ─────────────────────────────────────────────────────────
const LEGEND_OLD = `// Adding the scaled HTML text inside the bounds
const legendCenter = [1250, 301]; // Center of the legend rectangle
const legendHtml = \`
<div class="embedded-legend-text">
    <h2>Legend</h2>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🐕</span> Dog Area
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;"><span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏢 🏠</span> Club House / Office</div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">💩</span> Dog Poop Disposal
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🗑️</span> Garbage
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">♻️</span> Recycling
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🅿️</span> Parking
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🔥</span> Communal Fire Pit
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏖️</span> Beach Area
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🛝</span> Playground
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏐</span> Volleyball
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🚽</span> Washrooms
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🚿</span> Showers
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🎯</span> Horseshoes
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">💃🕺</span> Pavillion
    </div>
</div>\`;
const legendIcon = L.divIcon({
    className: 'naked-site-label',
    html: legendHtml,
    iconSize: [400, 900],
    iconAnchor: [200, 450] // Anchors directly to the center coordinates
});
L.marker(legendCenter, { icon: legendIcon, interactive: false}).addTo(map);`;

const LEGEND_NEW = `// Adding the scaled HTML text inside the bounds
const legendCenter = [1283, 301]; // Center of the legend rectangle
const legendHtml = \`
<div class="embedded-legend-text">
    <h2>Legend</h2>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏖️</span> Beach Area
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;"><span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏢 🏠</span> Club House / Office</div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🔥</span> Communal Fire Pit
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🐕</span> Dog Area
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">💩</span> Dog Poop Disposal
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">💿</span> Frisbee Golf
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🗑️</span> Garbage /&nbsp;<span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">♻️</span> Recycling
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🎯</span> Horseshoes
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🅿️</span> Parking
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">💃🕺</span> Pavillion
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🛝</span> Playground
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🏐</span> Volleyball
    </div>
    <div class="embedded-legend-item" style="display:flex; align-items:center; gap: 8px; white-space: nowrap;">
        <span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🚽</span> Washrooms /&nbsp;<span style="font-size: 28px; filter: drop-shadow(1px 1px 0px #000) drop-shadow(-1px -1px 0px #000) drop-shadow(1px -1px 0px #000) drop-shadow(-1px 1px 0px #000);">🚿</span> Showers
    </div>
</div>\`;
const legendIcon = L.divIcon({
    className: 'naked-site-label',
    html: legendHtml,
    iconSize: [518, 936],
    iconAnchor: [259, 468] // Anchors directly to the center coordinates
});
L.marker(legendCenter, { icon: legendIcon, interactive: false}).addTo(map);`;

if (!content.includes(LEGEND_OLD)) {
    console.error('ERROR: Legend anchor not found'); process.exit(1);
}
content = content.replace(LEGEND_OLD, LEGEND_NEW);
console.log('✓ Updated legend (new items, reorganized, new icon size)');

// ── 8. Update updateLabelScale to add legend padding ─────────────────────────
const SCALE_OLD = `function updateLabelScale() {
    // Leaflet's CRS.Simple scale doubles for every +1 zoom. 
    // If zoom is 0 (1:1), scale is 1. If we zoom out negative, scale becomes a fraction.
    const currentScale = Math.pow(2, map.getZoom()); 
    document.documentElement.style.setProperty('--map-zoom-scale', currentScale);
}`;

const SCALE_NEW = `function updateLabelScale() {
    const currentScale = Math.pow(2, map.getZoom()); 
    document.documentElement.style.setProperty('--map-zoom-scale', currentScale);
    const legendEl = document.querySelector('.embedded-legend-text');
    if (legendEl) {
        legendEl.style.paddingLeft = (18 / currentScale) + 'px';
        legendEl.style.paddingRight = (18 / currentScale) + 'px';
    }
}`;

if (!content.includes(SCALE_OLD)) {
    console.error('ERROR: updateLabelScale anchor not found'); process.exit(1);
}
content = content.replace(SCALE_OLD, SCALE_NEW);
console.log('✓ Updated updateLabelScale with legend padding');

// ── 9. Add setTimeout(updateLabelScale, 0) after zoom event binding ───────────
const ZOOM_EVENT_OLD = `map.on('zoom', updateLabelScale);

// Removed B1 highlight per user request`;

const ZOOM_EVENT_NEW = `map.on('zoom', updateLabelScale);
// Also run after Leaflet has finished rendering markers into the DOM
setTimeout(updateLabelScale, 0);

// Removed B1 highlight per user request`;

if (!content.includes(ZOOM_EVENT_OLD)) {
    console.error('ERROR: zoom event anchor not found'); process.exit(1);
}
content = content.replace(ZOOM_EVENT_OLD, ZOOM_EVENT_NEW);
console.log('✓ Added setTimeout(updateLabelScale, 0)');

// ── 10. Update undo button handler (paint-aware) ──────────────────────────────
const UNDO_OLD = `const undoBtn = document.getElementById('undo-btn');
if (undoBtn) {
    undoBtn.addEventListener('click', function() {
        if (drawnItems.length > 0) {
            const lastItem = drawnItems.pop();
            map.removeLayer(lastItem);
            console.log("Undid last action.");
        }
    });
}`;

const UNDO_NEW = `const undoBtn = document.getElementById('undo-btn');
if (undoBtn) {
    undoBtn.addEventListener('click', function() {
        if (drawnItems.length > 0) {
            const lastItem = drawnItems.pop();
            if (lastItem && lastItem.type === 'paint') {
                map.removeLayer(lastItem.layer);
                if (window._paintStrokes && window._paintStrokes.length >= lastItem.dots) {
                    window._paintStrokes.splice(-lastItem.dots);
                }
            } else if (lastItem) {
                map.removeLayer(lastItem);
            }
            console.log("Undid last action.");
        }
    });
}`;

if (!content.includes(UNDO_OLD)) {
    console.error('ERROR: undo button anchor not found'); process.exit(1);
}
content = content.replace(UNDO_OLD, UNDO_NEW);
console.log('✓ Updated undo button handler (paint-aware)');

// ── Write output ─────────────────────────────────────────────────────────────
fs.writeFileSync(TARGET, content, 'utf8');
console.log('\n✓ map_script.js written successfully');

// ── Verify key elements ───────────────────────────────────────────────────────
const result = fs.readFileSync(TARGET, 'utf8');
const resultLines = result.split('\n');
console.log('\n── Verification ───────────────────────────────────────────────');
console.log('Total lines:', resultLines.length);
console.log('L.circle count:', resultLines.filter(l=>l.trim().startsWith('L.circle(')).length);
console.log('newParkingEmojiMarker2:', result.includes('newParkingEmojiMarker2'));
console.log('newParkingEmojiMarker3:', result.includes('newParkingEmojiMarker3'));
console.log('frisbeeGolfMarker:', result.includes('frisbeeGolfMarker'));
console.log('S7 removed:', !result.includes('// --- SITE S7'));
console.log('S6 updated:', result.includes('s6Center = [259, 1355]'));
console.log('Legend Frisbee Golf:', result.includes('Frisbee Golf'));
console.log('Legend combined Washrooms:', result.includes('Washrooms /'));
console.log('Legend iconSize 518:', result.includes('[518, 936]'));
console.log('updateLabelScale padding:', result.includes('paddingLeft'));
console.log('setTimeout updateLabelScale:', result.includes('setTimeout(updateLabelScale, 0)'));
console.log('Undo paint-aware:', result.includes("lastItem.type === 'paint'"));
console.log('ADMIN_MODE still false:', result.startsWith('const ADMIN_MODE = false;'));
