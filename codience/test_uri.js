const vscode = require('vscode-uri');
const uri = vscode.URI.file('/base/path');
console.log(vscode.Utils.joinPath(uri, 'dist', './assets/file.js').toString());
