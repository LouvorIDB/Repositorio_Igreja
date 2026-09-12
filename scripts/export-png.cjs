const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlFile = path.resolve(__dirname, 'render-whatsapp-profile.html');
const whatsappPng = path.resolve(__dirname, '../public/assets/liturge-perfil-whatsapp.png');
const icon192Png = path.resolve(__dirname, '../public/icon-192.png');
const icon512Png = path.resolve(__dirname, '../public/icon-512.png');
const iconPng = path.resolve(__dirname, '../public/icon.png');

// 1. Gera o avatar de alta resolução (1024x1024) para o WhatsApp e para o PWA
const cmd1024 = `"${edgePath}" --headless --screenshot="${whatsappPng}" --window-size=1024,1024 --hide-scrollbars "file:///${htmlFile.replace(/\\/g, '/')}"`;
execSync(cmd1024);

fs.copyFileSync(whatsappPng, icon512Png);
fs.copyFileSync(whatsappPng, iconPng);

// 2. Gera o ícone de 192x192
const cmd192 = `"${edgePath}" --headless --screenshot="${icon192Png}" --window-size=192,192 --hide-scrollbars "file:///${htmlFile.replace(/\\/g, '/')}"`;
execSync(cmd192);

console.log('Todos os ícones PNG gerados com sucesso!');
console.log('WhatsApp (1024x1024):', whatsappPng);
console.log('icon-512.png:', icon512Png);
console.log('icon-192.png:', icon192Png);
