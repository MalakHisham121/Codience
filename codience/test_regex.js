const fs = require('fs');
let html = fs.readFileSync('webview-ui/webview-ui/dist/index.html', 'utf-8');
console.log("Original HTML:");
console.log(html);
html = html.replace(
  /(src|href)="(.+?)"/g,
  (_match, attr, link) => {
    if (/^https?:\/\//.test(link)) return _match;
    return `${attr}="REPLACED_${link}"`;
  }
);
console.log("\nReplaced HTML:");
console.log(html);
