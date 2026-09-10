// __SCRIPT_SEPARATOR__ - info:7b226e616d65223a22737461727475705c7530303236696e666f227d
/**
 * Módulo Holyrics - Sincronização Liturge
 * Sincroniza cultos, letras de louvor e mídias anexadas diretamente da plataforma Liturge.
 */

var mID = '@liturge#sync';
var mUID = mID + '';
var currentModule = null;
var lastSyncTime = 0;

function info() {
    return {
        id: mID,
        name: 'Liturge Sync',
        description: '<html>' +
            '<h3>Liturge Sync</h3>' +
            'Sincroniza automaticamente os cultos, letras de louvor e mídias anexadas ' +
            'diretamente da plataforma <b>Liturge</b> para o Holyrics.<br><br>' +
            '• <b>Detecção inteligente:</b> Sincroniza o culto agendado selecionado ou abre a lista de próximos cultos em modo Temporário.<br>' +
            '• <b>Playlists Integradas:</b> Preenche a aba de Músicas e estrutura a linha do tempo completa na aba de Mídias com títulos de seção.<br>' +
            '• <b>Anexos de Mídia:</b> Organiza imagens, vídeos e áudios na subpasta <code>Liturge/</code>.<br>' +
            '• <b>Segurança Multi-tenant:</b> Autenticação via Token de API da sua igreja.' +
            '</html>',
        min_version: '2.24.0',
        allowed_requests: [
            'http://localhost:3333/',
            'http://localhost:3333',
            'http://127.0.0.1:3333/',
            'http://127.0.0.1:3333',
            'https://api.liturge.app/',
            'https://api.liturge.app'
        ],
        permissions: [
            { type: 'advanced', key: 'allowed_files' },
            { type: 'advanced', key: 'files_mkdir' },
            { type: 'advanced', key: 'edit_important_data' }
        ],
        available_in_main_window: true,
        available_in_bible_window: false,
        i18n: {
            name: {
                pt: 'Liturge Sync',
                en: 'Liturge Sync'
            },
            description: {
                pt: '<html>Sincronizador oficial de cultos, letras e mídias do <b>Liturge</b>.</html>',
                en: '<html>Official worship services, lyrics and media synchronizer for <b>Liturge</b>.</html>'
            }
        }
    };
}

function startup(module) {
    currentModule = module;
    mUID = mID + '_' + module.id;
    moduleLog('Módulo Liturge Sync carregado com sucesso.');
}

function shutdown(module) {
    moduleLog('Módulo Liturge Sync finalizado.');
}

function settings(module) {
    return [
        {
            id: 'liturge_api_url',
            name: 'URL da API Liturge',
            type: 'string',
            default_value: 'http://localhost:3333/api/v1',
            description: 'Endereço base da API REST do Liturge (ex: http://localhost:3333/api/v1 ou https://api.liturge.app/v1)'
        },
        {
            id: 'church_api_token',
            name: 'Token da Igreja (API Key)',
            type: 'password',
            default_value: '',
            description: 'Token de integração exclusivo da sua igreja gerado no painel do Liturge'
        },
        {
            id: 'media_base_path',
            name: 'Pasta de Mídias do Holyrics',
            type: 'string',
            default_value: 'C:\\Holyrics\\Holyrics\\files\\media',
            description: 'Caminho base onde estão as pastas image, video e audio do Holyrics'
        },
        {
            id: 'subfolder_name',
            name: 'Subpasta de Mídias',
            type: 'string',
            default_value: 'Liturge',
            description: 'Nome da subpasta onde os arquivos anexados serão organizados'
        },
        {
            id: 'log_enabled',
            name: 'Habilitar Logs',
            type: 'boolean',
            default_value: true,
            description: 'Registra detalhes do processo de sincronização na aba de logs do módulo'
        }
    ];
}

function actions(module) {
    var arr = [];

    arr.push({
        id: 'sync_liturge_action',
        name: 'Sincronizar Liturge',
        icon: 'cloud_download',
        hint: 'Clique para sincronizar o culto atual ou escolher um culto futuro do Liturge',
        action: function(evt) {
            startSyncFlow(module);
        },
        status: function(evt) {
            var now = Date.now();
            var justSynced = (now - lastSyncTime) < 30000;
            var hasToken = module.settings.church_api_token && module.settings.church_api_token.trim().length > 0;

            if (!hasToken) {
                return {
                    icon: 'warning',
                    iconColor: 'FFA500',
                    hint: 'Atenção: Configure o Token da Igreja nas configurações do módulo'
                };
            }

            if (justSynced) {
                return {
                    active: true,
                    icon: 'cloud_done',
                    iconColor: '00FF00',
                    background: '2E7D32',
                    foreground: 'FFFFFF',
                    hint: 'Sincronização realizada recentemente'
                };
            }

            return {
                icon: 'cloud_download',
                hint: 'Clique para sincronizar com o Liturge'
            };
        },
        popup_menu: [
            {
                id: 'menu_settings',
                label: 'Configurações do Liturge',
                icon: 'settings',
                action: function(evt) {
                    module.openSettings('settings');
                }
            },
            {
                id: 'menu_open_permissions',
                label: 'Permissões Avançadas',
                icon: 'security',
                action: function(evt) {
                    module.openSettings('allowed_files');
                }
            },
            {
                id: 'menu_open_log',
                label: 'Ver Logs',
                icon: 'description',
                action: function(evt) {
                    module.openLog();
                }
            }
        ]
    });

    return arr;
}

function startSyncFlow(module) {
    var apiUrl = (module.settings.liturge_api_url || '').trim().replace(/\/+$/, '');
    var token = (module.settings.church_api_token || '').trim();

    if (!apiUrl) {
        h.notificationError('Informe a URL da API do Liturge nas configurações do módulo.', 5);
        module.openSettings('settings');
        return;
    }

    if (!token) {
        h.notificationError('Informe o Token da Igreja nas configurações do módulo.', 5);
        module.openSettings('settings');
        return;
    }

    // 1. Tenta identificar se o operador já está posicionado em um culto agendado no Holyrics
    var currentSchedule = null;
    try {
        currentSchedule = h.hly('GetCurrentSchedule');
    } catch (eSched) {
        moduleLog('Aviso ao consultar GetCurrentSchedule: {}', [eSched]);
    }

    var hasSchedule = currentSchedule && currentSchedule.data && currentSchedule.data.datetime && currentSchedule.data.datetime.trim().length > 0;

    if (hasSchedule) {
        var dt = currentSchedule.data.datetime.trim();
        moduleLog('Culto agendado detectado na interface: {}', [dt]);

        try {
            var urlByDate = apiUrl + '/services/by-datetime?datetime=' + encodeURIComponent(dt);
            var res = executeHttpGet(module, urlByDate, token);

            if (!res || res.status !== 'ok' || !res.data) {
                h.notificationError('Culto correspondente a ' + dt + ' não encontrado no Liturge.', 5);
                return;
            }

            confirmAndRunSync(module, res.data);
        } catch (eReq) {
            h.notificationError('Erro ao consultar culto no Liturge: ' + eReq, 6);
            moduleLog('Erro na requisição por data: {}', [eReq]);
        }
    } else {
        // 2. Modo Temporário: Busca os próximos cultos cadastrados no Liturge
        moduleLog('Modo Temporário ativo. Buscando próximos cultos no Liturge...');

        var upcomingList = null;
        try {
            var urlUpcoming = apiUrl + '/services/upcoming?limit=10';
            var upRes = executeHttpGet(module, urlUpcoming, token);

            if (upRes && upRes.status === 'ok' && upRes.data && upRes.data.length > 0) {
                upcomingList = upRes.data;
            } else {
                h.notificationError('Nenhum próximo culto encontrado no Liturge.', 5);
                return;
            }
        } catch (eUp) {
            h.notificationError('Erro ao buscar próximos cultos no Liturge: ' + eUp, 7);
            moduleLog('Erro na requisição de próximos cultos: {}', [eUp]);
            return;
        }

        // Monta lista de seleção amigável para o operador
        var chooserItems = [];
        for (var i = 0; i < upcomingList.length; i++) {
            var s = upcomingList[i];
            chooserItems.push({
                label: s.label || (s.datetime + ' - ' + s.title),
                value: s.id,
                id: s.id
            });
        }

        var selected = h.itemChooser('Selecione o Culto para Sincronizar', chooserItems);
        if (!selected) {
            moduleLog('Seleção de culto cancelada pelo operador.');
            return;
        }

        var selectedId = (typeof selected === 'object') ? (selected.value || selected.id) : selected;

        try {
            var urlService = apiUrl + '/services/' + selectedId;
            var servRes = executeHttpGet(module, urlService, token);

            if (!servRes || servRes.status !== 'ok' || !servRes.data) {
                h.notificationError('Não foi possível carregar os detalhes do culto selecionado.', 5);
                return;
            }

            confirmAndRunSync(module, servRes.data);
        } catch (eServ) {
            h.notificationError('Erro ao carregar detalhes do culto: ' + eServ, 6);
            moduleLog('Erro ao carregar culto por ID: {}', [eServ]);
        }
    }
}

function confirmAndRunSync(module, serviceData) {
    var title = serviceData.title || 'Culto';
    var dt = serviceData.datetime || '';

    var modeOptions = [
        { label: 'Substituir a lista atual do Holyrics', value: 'replace', selected: true },
        { label: 'Apenas acrescentar ao final da lista existente', value: 'append' }
    ];

    var selectedModeItem = h.itemChooser('Sincronizar: ' + title + ' (' + dt + ')', modeOptions);
    if (!selectedModeItem) {
        moduleLog('Sincronização cancelada na confirmação.');
        return;
    }

    var modeVal = (typeof selectedModeItem === 'object') ? selectedModeItem.value : selectedModeItem;
    var isReplace = (modeVal === 'replace');

    h.popupWorker({
        title: 'Sincronizando com Liturge...',
        cancelable: false,
        action: function(worker) {
            performSyncProcess(module, serviceData, isReplace, worker);
        },
        callback: function(result, error) {
            if (error) {
                h.notificationError('Erro durante a sincronização: ' + error, 7);
                moduleLog('Falha no popupWorker: {}', [error]);
            } else {
                lastSyncTime = Date.now();
                module.repaintPanel();
            }
        }
    });
}

function performSyncProcess(module, serviceData, isReplace, worker) {
    worker.setMessage('Preparando playlists...');
    worker.setProgress(5);

    var mediaBasePath = (module.settings.media_base_path || 'C:\\Holyrics\\Holyrics\\files\\media').trim().replace(/[\\/]+$/, '');
    var subfolder = (module.settings.subfolder_name || 'Liturge').trim();

    if (isReplace) {
        worker.setMessage('Limpando playlists atuais...');
        clearHolyricsPlaylists();
    }

    var sections = serviceData.sections || [];

    var totalFiles = 0;
    for (var s = 0; s < sections.length; s++) {
        var items = sections[s].items || [];
        for (var it = 0; it < items.length; it++) {
            var item = items[it];
            if (item.type === 'image' || item.type === 'video' || item.type === 'audio') {
                totalFiles++;
            }
        }
    }

    var filesProcessed = 0;
    var mediaDownloadedCount = 0;
    var mediaPendingList = [];
    var songsFoundCount = 0;
    var songsMissingList = [];
    var mediaPlaylistPayload = [];
    var lyricsIdsToAdd = [];

    worker.setProgress(10);

    for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var secTitle = section.title || ('Seção ' + (i + 1));
        var secItems = section.items || [];

        // Adiciona separador de título da seção na timeline de Mídia
        mediaPlaylistPayload.push({
            type: 'title',
            name: secTitle,
            background_color: '000080'
        });

        for (var j = 0; j < secItems.length; j++) {
            var secItem = secItems[j];

            if (secItem.type === 'song') {
                worker.setMessage('Localizando música: ' + secItem.title);
                var songFound = findSongInHolyrics(secItem.title);

                if (songFound) {
                    songsFoundCount++;
                    lyricsIdsToAdd.push(songFound.id);
                    mediaPlaylistPayload.push({
                        type: 'song',
                        id: songFound.id
                    });
                } else {
                    var desc = secItem.title;
                    if (secItem.artist) desc += ' (' + secItem.artist + ')';
                    songsMissingList.push(desc);
                    moduleLog('Música não encontrada localmente: {}', [desc]);
                }
            } else if (secItem.type === 'image' || secItem.type === 'video' || secItem.type === 'audio') {
                filesProcessed++;
                var pct = Math.floor(10 + (filesProcessed / Math.max(totalFiles, 1)) * 75);
                worker.setProgress(pct);
                worker.setMessage('Processando anexo [' + filesProcessed + '/' + totalFiles + ']: ' + secItem.name);

                var folderType = secItem.type;
                var destDir = mediaBasePath + '\\' + folderType + '\\' + subfolder;
                var destFile = destDir + '\\' + secItem.name;
                var relativeMediaName = subfolder + '/' + secItem.name;
                var fullRelativePath = folderType + '/' + relativeMediaName;

                try {
                    // Garante que a subpasta Liturge existe
                    ensureMediaFolder(folderType, subfolder);

                    // Tenta efetuar o download do anexo
                    var downloaded = downloadFileDirect(module, secItem.url, destFile, secItem.name);
                    if (downloaded) {
                        mediaDownloadedCount++;
                    }

                    // Verifica se o arquivo existe na pasta de mídia do Holyrics
                    if (h.files.exists(fullRelativePath)) {
                        mediaPlaylistPayload.push({
                            type: secItem.type,
                            name: relativeMediaName
                        });
                    } else {
                        mediaPendingList.push(secItem.name);
                        // Se o arquivo ainda não existe fisicamente, insere um título como marcador para não quebrar a playlist
                        mediaPlaylistPayload.push({
                            type: 'title',
                            name: '[' + secItem.type.toUpperCase() + '] ' + secItem.name + ' (Arquivo pendente)',
                            background_color: '555555'
                        });
                    }
                } catch (eDl) {
                    moduleLog('Erro ao processar mídia {}: {}', [secItem.name, eDl]);
                }
            }
        }
    }

    worker.setMessage('Atualizando playlists no Holyrics...');
    worker.setProgress(90);

    // 1. Preenche a aba de Músicas (Letras)
    if (lyricsIdsToAdd.length > 0) {
        for (var k = 0; k < lyricsIdsToAdd.length; k++) {
            try {
                h.hly('AddLyricsToPlaylist', { id: lyricsIdsToAdd[k] });
            } catch (eAddLyr) {
                moduleLog('Erro ao adicionar letra à playlist: {}', [eAddLyr]);
            }
        }
        moduleLog('{} músicas adicionadas à playlist de Letras.', [lyricsIdsToAdd.length]);
    }

    // 2. Preenche a aba de Mídias (Timeline completa com Títulos, Músicas e Mídias)
    if (mediaPlaylistPayload.length > 0) {
        try {
            var rMed = h.hly('AddToPlaylist', { items: mediaPlaylistPayload });
            if (rMed && rMed.status !== 'ok') {
                moduleLog('Aviso AddToPlaylist: {}', [rMed.error || JSON.stringify(rMed)]);
            } else {
                moduleLog('{} itens adicionados com sucesso à playlist de Mídias.', [mediaPlaylistPayload.length]);
            }
        } catch (eAddMed) {
            moduleLog('Erro ao adicionar itens à playlist de mídias: {}', [eAddMed]);
        }
    }

    worker.setProgress(100);
    worker.setMessage('Concluído!');

    var summaryMsg = '<html><b>Sincronização com Liturge concluída!</b><br>' +
        '• <b>Músicas carregadas:</b> ' + songsFoundCount + '<br>' +
        '• <b>Mídias na timeline:</b> ' + filesProcessed;

    if (mediaPendingList.length > 0) {
        summaryMsg += '<br><br><font color="#FFA500"><b>Avisos de Mídia (' + mediaPendingList.length + '):</b></font><br>';
        for (var p = 0; p < mediaPendingList.length; p++) {
            summaryMsg += '&nbsp;&nbsp;• ' + mediaPendingList[p] + '<br>';
        }
        summaryMsg += '<i>(Para download automático de novos arquivos, adicione curl.exe em Permissões Avançadas).</i>';
    }

    if (songsMissingList.length > 0) {
        summaryMsg += '<br><br><font color="red"><b>Atenção: Músicas não encontradas no Holyrics (' + songsMissingList.length + '):</b></font><br>';
        for (var m = 0; m < songsMissingList.length; m++) {
            summaryMsg += '&nbsp;&nbsp;• ' + songsMissingList[m] + '<br>';
        }
        summaryMsg += '<i>Cadastre-as na biblioteca do Holyrics para sincronizar na próxima vez.</i>';
        h.notification(summaryMsg, 12);
    } else {
        h.notification(summaryMsg, 7);
    }
}

/**
 * Executa requisição HTTP GET usando o cliente HTTP nativo do Holyrics.
 */
function executeHttpGet(module, url, token) {
    moduleLog('Executando HTTP GET via Holyrics apiRequest: {}', [url]);

    var options = {
        type: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/json'
        },
        timeout: 15000
    };

    var res = null;
    try {
        if (module && typeof module.apiRequest === 'function') {
            res = module.apiRequest(url, options);
        } else {
            res = h.apiRequest(url, options);
        }
    } catch (eReq) {
        moduleLog('Exceção ao chamar apiRequest: {}', [eReq]);
        throw 'Erro de conexão: ' + eReq;
    }

    if (res === null) {
        var lastErr = '';
        try {
            if (module && typeof module.getApiRequestLastError === 'function') {
                lastErr = module.getApiRequestLastError();
            } else if (typeof h.getApiRequestLastError === 'function') {
                lastErr = h.getApiRequestLastError();
            }
        } catch (eErr) {}

        var msg = (lastErr && lastErr.length > 0) ? lastErr : 'Retorno vazio ou timeout';
        moduleLog('Erro apiRequest: {}', [msg]);
        throw 'Erro na requisição (' + msg + '). Verifique se a URL está em "Requisições permitidas" no Holyrics.';
    }

    if (typeof res === 'object') {
        return res;
    }

    try {
        return JSON.parse(res);
    } catch (eJson) {
        moduleLog('Falha ao interpretar JSON retornado: {}', [res]);
        throw 'Resposta em formato inválido recebida da API Liturge.';
    }
}

/**
 * Realiza o download do arquivo anexado utilizando curl.exe caso esteja autorizado em Permissões Avançadas.
 */
function downloadFileDirect(module, url, destFilePath, fileName) {
    var allowedFiles = [];
    try {
        if (module && typeof module.getAllowedFiles === 'function') {
            allowedFiles = module.getAllowedFiles() || [];
        }
    } catch (eAllowed) {}

    var exeToUse = 'curl.exe';
    var hasCurlAllowed = false;
    for (var a = 0; a < allowedFiles.length; a++) {
        if (allowedFiles[a].toLowerCase().indexOf('curl.exe') !== -1) {
            exeToUse = allowedFiles[a];
            hasCurlAllowed = true;
            break;
        }
    }

    if (!hasCurlAllowed) {
        moduleLog('curl.exe não está em Arquivos Permitidos. Para baixar anexos automaticamente, adicione curl.exe em Permissões Avançadas.');
        return false;
    }

    moduleLog('Baixando anexo via {}: {} -> {}', [exeToUse, url, destFilePath]);

    var cliParams = [
        '-s',
        '-k',
        '-L',
        '-o', destFilePath,
        url
    ];

    try {
        var res = module.executeCmdAndWait(exeToUse, cliParams, 30000);
        if (res && res.status === 'ok' && res.data && res.data.code === 0) {
            moduleLog('Anexo {} baixado com sucesso.', [fileName]);
            return true;
        } else {
            moduleLog('Aviso: falha no download de {}: {}', [fileName, (res ? res.error : 'retorno inválido')]);
            return false;
        }
    } catch (eExec) {
        moduleLog('Aviso na execução de curl.exe: {}', [eExec]);
        return false;
    }
}

/**
 * Garante a criação da subpasta Liturge utilizando a API nativa de arquivos do Holyrics (h.files.mkdir).
 */
function ensureMediaFolder(folderType, subfolder) {
    var relDir = folderType + '/' + subfolder;
    try {
        if (!h.files.exists(relDir)) {
            h.files.mkdir(relDir);
            moduleLog('Pasta de mídia verificada/criada nativamente: {}', [relDir]);
        }
    } catch (e) {
        moduleLog('Aviso ao criar pasta de mídia {}: {}', [relDir, e]);
    }
}

/**
 * Localiza a música no acervo local do Holyrics pelo título.
 */
function findSongInHolyrics(title) {
    if (!title || title.trim() === '') return null;
    var cleanTarget = h.normalize(title).toLowerCase().trim();

    try {
        var res = h.hly('SearchSong', { text: title, title: true });
        if (res && res.data && res.data.length > 0) {
            for (var i = 0; i < res.data.length; i++) {
                var s = res.data[i];
                if (h.normalize(s.title).toLowerCase().trim() === cleanTarget) {
                    return s;
                }
            }
            return res.data[0];
        }
    } catch (e1) {}

    try {
        if (h.db && h.db.song) {
            var found = h.db.song.search(function(s) {
                return h.normalize(s.title).toLowerCase().trim() === cleanTarget;
            });
            if (found && found.isPresent()) {
                return found.get();
            }
        }
    } catch (e2) {}

    return null;
}

/**
 * Limpa as playlists atuais (de Músicas e de Mídias).
 */
function clearHolyricsPlaylists() {
    try {
        var curLyrics = h.hly('GetLyricsPlaylist');
        if (curLyrics && curLyrics.data && curLyrics.data.length > 0) {
            var idxs = h.intStreamRange(0, curLyrics.data.length).toArray();
            h.hly('RemoveFromLyricsPlaylist', { indexes: idxs });
        }
    } catch (eL) {
        moduleLog('Aviso ao limpar playlist de letras: {}', [eL]);
    }

    try {
        var curMedia = h.hly('GetMediaPlaylist');
        if (curMedia && curMedia.data && curMedia.data.length > 0) {
            var mIdxs = h.intStreamRange(0, curMedia.data.length).toArray();
            h.hly('RemoveFromMediaPlaylist', { indexes: mIdxs });
        }
    } catch (eM) {
        moduleLog('Aviso ao limpar playlist de mídias: {}', [eM]);
    }
}

/**
 * Registrador de log do módulo.
 */
function moduleLog(msg, args) {
    if (!currentModule || (currentModule.settings && currentModule.settings.log_enabled === false)) {
        return;
    }
    try {
        currentModule.log(msg, args || []);
    } catch (e) {}
    try {
        h.log(mUID, msg, args || []);
    } catch (e2) {}
}
