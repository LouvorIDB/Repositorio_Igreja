const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const CONFIG_FILE = path.join(__dirname, '..', '.adb_wifi_config.json');

function carregarConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (e) {}
    return { ip: '192.168.100.232', port: 5555 };
}

function salvarConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {}
}

function obterDispositivosConectados() {
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

async function main() {
    const args = process.argv.slice(2);
    console.log('📶 [Liturge] Gerenciador de Depuração sem Fio (ADB Wi-Fi)\n');

    // 1. Caso de Pareamento do Android 11+: npm run app:wifi -- --pair <IP:PORT> <CODIGO>
    if (args.includes('--pair')) {
        const idx = args.indexOf('--pair');
        const target = args[idx + 1];
        const code = args[idx + 2];
        if (!target || !code) {
            console.error('❌ Uso incorreto para pareamento.');
            console.log('👉 Exemplo: npm run app:wifi -- --pair 192.168.100.232:38421 123456\n');
            process.exit(1);
        }
        console.log(`🔐 Pareando com ${target}...`);
        try {
            const pairRes = execSync(`adb pair ${target} ${code}`).toString();
            console.log(pairRes.trim());
            console.log('\n🎉 Pareamento concluído!');
            console.log('Agora você pode rodar para conectar:');
            console.log(`npm run app:wifi -- <IP:PORTA_DE_CONEXAO>\n`);
        } catch (err) {
            console.error('❌ Falha no pareamento:', err.message);
        }
        return;
    }

    // 2. Conectar com endereço direto: npm run app:wifi -- 192.168.100.232:PORTA
    const directTarget = args.find(a => a.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(a));
    if (directTarget) {
        const targetStr = directTarget.includes(':') ? directTarget : `${directTarget}:5555`;
        console.log(`📡 Conectando ao endereço Wi-Fi: ${targetStr}...`);
        try {
            const connRes = execSync(`adb connect ${targetStr}`).toString();
            console.log(connRes.trim());
            if (connRes.includes('connected')) {
                const parts = targetStr.split(':');
                salvarConfig({ ip: parts[0], port: parseInt(parts[1], 10) || 5555 });
                console.log('✅ Conexão Wi-Fi salva como padrão!');
                console.log('Agora você pode rodar "npm run app:update" sem precisar de cabo.\n');
            }
        } catch (err) {
            console.error('❌ Erro ao conectar:', err.message);
        }
        return;
    }

    // 3. Modo Automático Inteligente
    const devices = obterDispositivosConectados();
    const usbDevice = devices.find(d => !d.includes(':'));
    const wifiDevice = devices.find(d => d.includes(':'));

    if (wifiDevice) {
        console.log(`✅ Já existe um dispositivo conectado via Wi-Fi: ${wifiDevice}`);
        return;
    }

    // Se houver um celular no cabo USB, ativa o Wi-Fi automaticamente!
    if (usbDevice) {
        console.log(`📲 Celular detectado via USB: ${usbDevice}`);
        console.log('🔍 Identificando endereço IP do celular na rede Wi-Fi...');
        let phoneIp = null;
        try {
            const ipOutput = execSync(`adb -s ${usbDevice} shell ip -4 addr show wlan0`).toString();
            const match = ipOutput.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
            if (match && match[1]) {
                phoneIp = match[1];
            }
        } catch (e) {}

        if (!phoneIp) {
            const saved = carregarConfig();
            phoneIp = saved.ip || '192.168.100.232';
        }

        console.log(`📶 Endereço IP encontrado: ${phoneIp}`);
        console.log('⚙️ Habilitando modo de escuta TCP/IP na porta 5555...');
        try {
            execSync(`adb -s ${usbDevice} tcpip 5555`);
            salvarConfig({ ip: phoneIp, port: 5555 });
            console.log(`📡 Conectando via Wi-Fi em ${phoneIp}:5555...`);
            const connRes = execSync(`adb connect ${phoneIp}:5555`).toString();
            console.log(connRes.trim());
            console.log('\n✨ ======================================================');
            console.log('🎉 SUCESSO! MODO SEM FIO ATIVADO!');
            console.log('👉 Você já pode desconectar o cabo USB do celular.');
            console.log('👉 Nas próximas vezes, rode "npm run app:update" direto pela Wi-Fi.');
            console.log('✨ ======================================================\n');
        } catch (err) {
            console.error('❌ Erro ao ativar porta TCP/IP:', err.message);
        }
        return;
    }

    // Se não há nenhum dispositivo conectado, tenta o último IP salvo
    const config = carregarConfig();
    const targetAddr = `${config.ip}:${config.port || 5555}`;
    console.log(`🔍 Tentando reconectar ao último endereço Wi-Fi salvo (${targetAddr})...`);
    try {
        const connRes = execSync(`adb connect ${targetAddr}`).toString();
        console.log(connRes.trim());
        if (connRes.includes('connected')) {
            console.log('\n🎉 Reconectado com sucesso via Wi-Fi!');
            console.log('Pode rodar "npm run app:update" normalmente.\n');
            return;
        }
    } catch (e) {}

    console.log('\n⚠️ Não foi possível conectar automaticamente.');
    console.log('----------------------------------------------------');
    console.log('Escolha uma das formas abaixo para ativar a depuração sem fio:\n');
    console.log('Opção 1 (Mais fácil):');
    console.log('  1. Conecte o cabo USB no notebook por alguns segundos.');
    console.log('  2. Rode: npm run app:wifi');
    console.log('  3. Pode tirar o cabo! O Wi-Fi ficará ativado permanentemente.\n');
    console.log('Opção 2 (Sem cabo - Android 11+ Depuração sem Fio):');
    console.log('  1. No Galaxy S24: Opções do Desenvolvedor -> Ative "Depuração sem fio".');
    console.log('  2. Veja o IP e a porta que aparecem na tela do celular.');
    console.log('  3. Rode no terminal:');
    console.log('     npm run app:wifi -- IP:PORTA');
    console.log('     (Exemplo: npm run app:wifi -- 192.168.100.232:38421)\n');
}

main().catch(err => {
    console.error('Erro no gerenciador Wi-Fi:', err);
});
