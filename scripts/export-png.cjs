const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileHtml = path.resolve(__dirname, 'render-whatsapp-profile.html');
const coverHtml = path.resolve(__dirname, 'render-facebook-cover.html');

const whatsappPng = path.resolve(__dirname, '../public/assets/liturge-perfil-whatsapp.png');
const coverPng = path.resolve(__dirname, '../public/assets/liturge-capa-facebook.png');
const icon192Png = path.resolve(__dirname, '../public/icon-192.png');
const icon512Png = path.resolve(__dirname, '../public/icon-512.png');
const iconPng = path.resolve(__dirname, '../public/icon.png');

// 1. Gera o avatar de perfil (1024x1024) para WhatsApp, Instagram e Facebook
const cmd1024 = `"${edgePath}" --headless --screenshot="${whatsappPng}" --window-size=1024,1024 --hide-scrollbars "file:///${profileHtml.replace(/\\/g, '/')}"`;
execSync(cmd1024);

fs.copyFileSync(whatsappPng, icon512Png);
fs.copyFileSync(whatsappPng, iconPng);

// 2. Gera o ícone PWA de 192x192
const cmd192 = `"${edgePath}" --headless --screenshot="${icon192Png}" --window-size=192,192 --hide-scrollbars "file:///${profileHtml.replace(/\\/g, '/')}"`;
execSync(cmd192);

// 3. Gera a Capa Oficial do Facebook (1640x924)
const cmdCover = `"${edgePath}" --headless --screenshot="${coverPng}" --window-size=1640,924 --hide-scrollbars "file:///${coverHtml.replace(/\\/g, '/')}"`;
execSync(cmdCover);

console.log('Todos os assets visuais para redes sociais gerados com sucesso!');
console.log('1. Avatar Perfil (WhatsApp/Instagram/Facebook):', whatsappPng, `(${fs.statSync(whatsappPng).size} bytes)`);
console.log('2. Capa Facebook (1640x924):', coverPng, `(${fs.statSync(coverPng).size} bytes)`);
