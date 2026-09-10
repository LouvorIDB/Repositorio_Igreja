const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, '..', '.adb_wifi_config.json');

function carregarWifiConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {}
    return { ip: '192.168.100.232', port: 5555 };
}

function salvarWifiConfig(cfg) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (e) {}
}

function getAdbDevices() {
    try {
        const out = execSync('adb devices').toString();
        const lines = out.trim().split('\n').slice(1);
        return lines
            .map(l => l.trim())
            .filter(l => l.includes('\tdevice'))
            .map(l => l.split('\t')[0].trim());
    } catch (e) {
        return [];
    }
}

console.log('🚀 [1/4] Compilando arquivos Web (Vite)...');
execSync('npm run build', { stdio: 'inherit' });

console.log('\n🔄 [2/4] Sincronizando com o projeto Android (Capacitor)...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('\n📦 [3/4] Compilando o APK Android com Gradle...');
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
const androidDir = path.join(__dirname, '..', 'android');
execSync(gradlewCmd, { cwd: androidDir, stdio: 'inherit' });

console.log('\n📱 [4/4] Verificando conexão do celular (USB ou Wi-Fi)...');
const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

try {
    let connectedDevices = getAdbDevices();

    // Se não há dispositivo conectado via USB ou Wi-Fi, tenta reconectar ao Wi-Fi salvo
    if (connectedDevices.length === 0) {
        const wifiCfg = carregarWifiConfig();
        const targetWifi = `${wifiCfg.ip}:${wifiCfg.port || 5555}`;
        console.log(`📡 Procurando celular na rede Wi-Fi (${targetWifi})...`);
        try {
            const connOut = execSync(`adb connect ${targetWifi}`).toString();
            if (connOut.includes('connected')) {
                console.log(`✅ Reconectado com sucesso via Wi-Fi!`);
                connectedDevices = getAdbDevices();
            }
        } catch (e) {}
    }

    if (connectedDevices.length > 0) {
        const targetDevice = connectedDevices[0];
        const isWifi = targetDevice.includes(':');

        // Se estiver conectado via cabo USB, prepara automaticamente a porta TCP/IP 5555 para uso futuro sem fio!
        if (!isWifi) {
            try {
                const ipOutput = execSync(`adb -s ${targetDevice} shell ip -4 addr show wlan0`).toString();
                const match = ipOutput.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                if (match && match[1]) {
                    const phoneIp = match[1];
                    execSync(`adb -s ${targetDevice} tcpip 5555`);
                    salvarWifiConfig({ ip: phoneIp, port: 5555 });
                    console.log(`📶 Wi-Fi pré-configurado para ${phoneIp}:5555 (pronto para uso sem cabo)!`);
                }
            } catch (e) {}
        }

        const modoTexto = isWifi ? `via Wi-Fi (${targetDevice})` : `via Cabo USB (${targetDevice})`;
        console.log(`📲 Instalando atualização no celular ${modoTexto}...`);
        execSync(`adb -s ${targetDevice} install -r "${apkPath}"`, { stdio: 'inherit' });

        // Limpa resíduos de cache do WebView para que nenhuma view HTML antiga fique retida
        try {
            execSync(`adb -s ${targetDevice} shell "run-as com.liturge.app rm -rf 'app_webview/Default/Service Worker' 'app_webview/Default/CacheStorage'"`);
        } catch (e) {}

        console.log('⚡ Abrindo o Liturge na tela do aparelho...');
        execSync(`adb -s ${targetDevice} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f 0x10200000 -n com.liturge.app/.MainActivity`, { stdio: 'inherit' });

        console.log('\n✨ ======================================================');
        console.log(`🎉 SUCESSO! O aplicativo foi atualizado e aberto ${isWifi ? 'sem fio via Wi-Fi' : 'via USB'} no celular!`);
        console.log('✨ ======================================================\n');
    } else {
        console.log('\n⚠️ Nenhum celular conectado via Cabo USB nem encontrado na rede Wi-Fi.');
        console.log('✅ O novo APK foi compilado com sucesso!');
        console.log('📁 Local do arquivo para envio manual:');
        console.log(`   ${apkPath}\n`);
        console.log('💡 DICA PARA ATIVAR O MODO WI-FI:');
        console.log('   1. Conecte o cabo USB no notebook uma única vez.');
        console.log('   2. Rode: npm run app:wifi');
        console.log('   3. Pode desconectar o cabo! O comando "npm run app:update" funcionará 100% sem fio.');
        console.log('   (Ou via Android 11+ sem cabo: npm run app:wifi -- IP:PORTA)\n');
    }
} catch (err) {
    console.error('\n⚠️ Aviso na etapa de comunicação ADB com o celular:', err.message);
    console.log('✅ O APK foi compilado com sucesso em:');
    console.log(`   ${apkPath}\n`);
}
