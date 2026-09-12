const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const iconHtml = path.resolve(__dirname, 'render-android-icon.html');
const roundHtml = path.resolve(__dirname, 'render-android-round.html');
const foregroundHtml = path.resolve(__dirname, 'render-android-foreground.html');
const splashHtml = path.resolve(__dirname, 'render-android-splash.html');

const resDir = path.resolve(__dirname, '../android/app/src/main/res');

function render(htmlPath, outPath, width, height) {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
    const cmd = `"${edgePath}" --headless --screenshot="${outPath}" --window-size=${width},${height} --hide-scrollbars "${fileUrl}"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log(`  ✓ Gerado: ${path.relative(resDir, outPath)} (${width}x${height})`);
}

console.log('🎨 [1/3] Gerando Ícones do App Android (Mipmap)...');

const iconSizes = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
];

for (const item of iconSizes) {
    const targetDir = path.join(resDir, item.dir);
    // 1. Ícone Padrão
    render(iconHtml, path.join(targetDir, 'ic_launcher.png'), item.size, item.size);
    // 2. Ícone Redondo
    render(roundHtml, path.join(targetDir, 'ic_launcher_round.png'), item.size, item.size);
    // 3. Foreground Adaptativo
    render(foregroundHtml, path.join(targetDir, 'ic_launcher_foreground.png'), item.fgSize, item.fgSize);
}

// Remover resíduo de vetor antigo do Android robot em drawable-v24 se existir
const oldVector = path.join(resDir, 'drawable-v24/ic_launcher_foreground.xml');
if (fs.existsSync(oldVector)) {
    fs.unlinkSync(oldVector);
    console.log('  ✓ Removido vetor padrão antigo do Android robot.');
}

console.log('\n🌟 [2/3] Gerando Splash Screens Nativas em Retrato (Portrait)...');
render(splashHtml, path.join(resDir, 'drawable/splash.png'), 1080, 1920);

const portSizes = [
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 }
];

for (const item of portSizes) {
    render(splashHtml, path.join(resDir, item.dir, 'splash.png'), item.w, item.h);
}

console.log('\n🌅 [3/3] Gerando Splash Screens Nativas em Paisagem (Landscape)...');
const landSizes = [
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 }
];

for (const item of landSizes) {
    render(splashHtml, path.join(resDir, item.dir, 'splash.png'), item.w, item.h);
}

console.log('\n✨ Todos os ativos nativos Android da identidade visual Liturge foram gerados com sucesso!');
