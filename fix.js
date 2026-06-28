const fs = require('fs');
let code = fs.readFileSync('c:/Stuff/50_50/app.js', 'utf8');

// Replace any occurrence of the garbled text in the buttons
code = code.replace(/<span class=\"text-2xl mb-1\">.*?<\/span>\n\s*<span class=\"text-sm\">Cash<\/span>/g, '<span class=\"text-2xl mb-1\">💵</span>\n            <span class=\"text-sm\">Cash</span>');
code = code.replace(/<span class=\"text-2xl mb-1\">.*?<\/span>\n\s*<span class=\"text-sm\">eTransfer<\/span>/g, '<span class=\"text-2xl mb-1\">📱</span>\n            <span class=\"text-sm\">eTransfer</span>');
code = code.replace(/<span class=\"text-2xl mb-1\">.*?<\/span><span class=\"text-sm\">No<\/span>/g, '<span class=\"text-2xl mb-1\">🚫</span><span class=\"text-sm\">No</span>');
code = code.replace(/<button id=\"viewToggleBtn\".*?><span id=\"viewToggleIcon\".*?>.*?<\/span>.*?<span id=\"viewToggleText\".*?>Map<\/span><\/button>/s, '<button id=\"viewToggleBtn\" class=\"flex-1 bg-purple-100 text-purple-800 active:bg-purple-200 py-2 rounded-lg font-bold flex flex-col items-center justify-center border border-purple-200 shadow-sm leading-none\"><span id=\"viewToggleIcon\" class=\"text-2xl mb-2 mt-1\">🗺️</span><span id=\"viewToggleText\" class=\"text-sm\">Map</span></button>');

fs.writeFileSync('c:/Stuff/50_50/app.js', code);
