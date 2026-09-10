/**
 * MÓDULO: DISPARADOR SEMANAL DE WHATSAPP
 * Liturge - Sistema Eclesiástico
 * Agrupa as escalas e repertórios da semana por voluntário e gera mensagens
 * formatadas para envio 1-click via wa.me e automação via API.
 */

(function() {
    let voluntáriosSemanaCache = [];
    let inicioSemanaAtual = null;
    let fimSemanaAtual = null;

    function getSupabaseClient() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
        return null;
    }

    /**
     * Calcula as datas de Segunda a Domingo para uma data de referência
     */
    function obterIntervaloSemana(dataRef) {
        const d = dataRef ? new Date(dataRef) : new Date();
        const diaSemana = d.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
        
        // Distância até a segunda-feira anterior (ou hoje se for segunda)
        const distSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
        const segunda = new Date(d);
        segunda.setDate(d.getDate() + distSegunda);
        segunda.setHours(0, 0, 0, 0);

        const domingo = new Date(segunda);
        domingo.setDate(segunda.getDate() + 6);
        domingo.setHours(23, 59, 59, 999);

        return { segunda, domingo };
    }

    /**
     * Formata data para DD/MM/AAAA
     */
    function formatarDataBR(dateObj) {
        const dia = String(dateObj.getDate()).padStart(2, '0');
        const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
        const ano = dateObj.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    /**
     * Retorna o dia da semana por extenso em maiúsculo
     */
    function obterNomeDiaSemana(dateObj) {
        const dias = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        return dias[dateObj.getDay()];
    }

    /**
     * Abre o modal de comunicação semanal de WhatsApp
     */
    async function abrirModalWhatsAppSemanal(dataRef) {
        const modal = document.getElementById('modal-whatsapp-semanal');
        if (!modal) {
            console.warn('[WhatsApp] Modal modal-whatsapp-semanal não encontrado.');
            return;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const { segunda, domingo } = obterIntervaloSemana(dataRef);
        inicioSemanaAtual = segunda;
        fimSemanaAtual = domingo;

        const labelSemana = document.getElementById('wpp-label-intervalo-semana');
        if (labelSemana) {
            labelSemana.textContent = `Semana de ${formatarDataBR(segunda)} até ${formatarDataBR(domingo)}`;
        }

        await compilarEscalasSemanais(segunda, domingo);
    }
    window.abrirModalWhatsAppSemanal = abrirModalWhatsAppSemanal;

    /**
     * Fecha o modal de WhatsApp
     */
    function fecharModalWhatsAppSemanal() {
        const modal = document.getElementById('modal-whatsapp-semanal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
    window.fecharModalWhatsAppSemanal = fecharModalWhatsAppSemanal;

    /**
     * Compila e agrupa os cultos e músicas da semana por voluntário
     */
    async function compilarEscalasSemanais(inicio, fim) {
        const container = document.getElementById('wpp-lista-voluntarios-semana');
        if (!container) return;

        container.innerHTML = '<div class="py-8 text-center text-xs text-slate-400">Compilando escalas e músicas da semana...</div>';

        const rawServices = window.dadosGlobais?.services || [];
        const isoInicio = inicio.toISOString().split('T')[0];
        const isoFim = fim.toISOString().split('T')[0];

        // 1. Filtrar cultos que ocorrem nesta semana
        const cultosSemana = rawServices.filter(s => {
            if (!s.date) return false;
            const d = s.date.split('T')[0];
            return d >= isoInicio && d <= isoFim;
        }).sort((a, b) => a.date.localeCompare(b.date));

        if (cultosSemana.length === 0) {
            container.innerHTML = `
                <div class="py-12 text-center space-y-2">
                    <span class="text-3xl">📅</span>
                    <p class="text-sm font-semibold text-slate-300">Nenhum culto cadastrado para esta semana.</p>
                    <p class="text-xs text-slate-500">Cadastre cultos na Agenda para poder notificar a equipe.</p>
                </div>
            `;
            const badgeTotal = document.getElementById('wpp-badge-total-voluntarios');
            if (badgeTotal) badgeTotal.textContent = '0 voluntários';
            return;
        }

        // 2. Mapeamento de Voluntários -> Cultos & Músicas
        const mapaMembros = {}; // chave: nome normalizado ou profile_id

        // Perfis cadastrados com máxima redundância
        let profiles = (window.dadosGlobais?.profiles && window.dadosGlobais.profiles.length > 0)
            ? window.dadosGlobais.profiles
            : ((window.dadosGlobais?.voluntarios && window.dadosGlobais.voluntarios.length > 0) ? window.dadosGlobais.voluntarios : []);

        // Se por algum motivo a memória estiver vazia, busca diretamente do Supabase
        const sClientProfiles = getSupabaseClient();
        if ((!profiles || profiles.length === 0) && sClientProfiles) {
            try {
                const cId = window.dadosGlobais?.church?.id || window.usuarioLogado?.church_id || null;
                let q = sClientProfiles.from('profiles').select('*');
                if (cId) q = q.eq('church_id', cId);
                const { data: dbProfs } = await q;
                if (Array.isArray(dbProfs) && dbProfs.length > 0) {
                    profiles = dbProfs;
                    if (window.dadosGlobais) {
                        window.dadosGlobais.profiles = dbProfs;
                        window.dadosGlobais.voluntarios = dbProfs;
                    }
                }
            } catch (err) {
                console.warn('[WhatsApp] Erro ao buscar perfis:', err);
            }
        }

        // Função de normalização de texto para cruzamento de nomes
        function normalizarTexto(t) {
            return String(t || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function acharPerfil(pId, nome) {
            if (pId) {
                const porId = profiles.find(p => p.id === pId);
                if (porId) return porId;
            }
            if (nome) {
                const nNorm = normalizarTexto(nome);
                // Busca por nome exato
                let porNome = profiles.find(p => normalizarTexto(p.name) === nNorm);
                if (porNome) return porNome;

                // Busca por primeiro nome se tiver mais de 2 letras
                const primeiroNome = nNorm.split(' ')[0];
                if (primeiroNome.length >= 3) {
                    porNome = profiles.find(p => normalizarTexto(p.name).split(' ')[0] === primeiroNome);
                    if (porNome) return porNome;
                }
            }
            return null;
        }

        cultosSemana.forEach(serv => {
            let parsedNotes = {};
            try { parsedNotes = typeof serv.notes === 'string' ? JSON.parse(serv.notes) : serv.notes; } catch(e){}

            // Extrai a hora
            let hora = '19:30';
            if (serv.date && serv.date.includes('T')) {
                hora = serv.date.split('T')[1].substring(0, 5);
            }

            // Extrai as músicas do culto com tom
            const musicasCulto = [];
            if (Array.isArray(serv.service_songs)) {
                serv.service_songs.forEach(ss => {
                    const songName = ss.song_versions?.songs?.title || ss.song_title || 'Música';
                    const tone = ss.song_versions?.key || ss.key || '';
                    const songId = ss.song_versions?.song_id || ss.song_id || '';
                    musicasCulto.push({ title: songName, tone, songId });
                });
            }

            // Se service_songs não estiver populado em memória, busca de dadosGlobais.cultos
            if (musicasCulto.length === 0 && Array.isArray(window.dadosGlobais?.cultos)) {
                const cMatch = window.dadosGlobais.cultos.find(c => c[8] === serv.id);
                if (cMatch && cMatch[5]) {
                    const nomes = String(cMatch[5]).split(',').map(s => s.trim()).filter(Boolean);
                    nomes.forEach(n => musicasCulto.push({ title: n, tone: '', songId: '' }));
                }
            }

            // Mapeia escalas
            const escalasCulto = [];
            if (Array.isArray(serv.service_scales)) {
                serv.service_scales.forEach(esc => {
                    const n = esc.profile_name || esc.profiles?.name || '';
                    if (n && n !== 'Voluntário' && n.trim() !== '') {
                        escalasCulto.push({
                            profileId: esc.profile_id,
                            nome: n.trim(),
                            funcao: esc.role_name || esc.ministry_roles?.name || 'Ministério'
                        });
                    }
                });
            }

            // Mapeia cantores em notes
            if (Array.isArray(parsedNotes?.cantores)) {
                parsedNotes.cantores.forEach(cNome => {
                    const cClean = String(cNome || '').trim();
                    if (cClean && !escalasCulto.some(e => normalizarTexto(e.nome) === normalizarTexto(cClean))) {
                        escalasCulto.push({
                            profileId: null,
                            nome: cClean,
                            funcao: 'Vocalista'
                        });
                    }
                });
            }

            // Mapeia escala em notes.escala (ex: { violao: 'Igor Ribeiro', ... })
            if (parsedNotes?.escala && typeof parsedNotes.escala === 'object') {
                Object.entries(parsedNotes.escala).forEach(([fnc, nomeEsc]) => {
                    const nClean = String(nomeEsc || '').trim();
                    if (nClean && !escalasCulto.some(e => normalizarTexto(e.nome) === normalizarTexto(nClean))) {
                        escalasCulto.push({
                            profileId: null,
                            nome: nClean,
                            funcao: fnc.charAt(0).toUpperCase() + fnc.slice(1)
                        });
                    }
                });
            }

            // Adiciona aos voluntários
            escalasCulto.forEach(item => {
                if (!item.nome || item.nome.toLowerCase() === 'voluntário') return;

                const prof = acharPerfil(item.profileId, item.nome);
                const nomeFinal = prof?.name || item.nome;
                const telEncontrado = prof?.phone || prof?.telefone || prof?.whatsapp || '';
                const key = normalizarTexto(nomeFinal);

                if (!mapaMembros[key]) {
                    mapaMembros[key] = {
                        profileId: prof?.id || item.profileId || null,
                        nome: nomeFinal,
                        phone: telEncontrado,
                        cultos: []
                    };
                } else if (!mapaMembros[key].phone && telEncontrado) {
                    mapaMembros[key].phone = telEncontrado;
                }

                // Evita duplicata de culto para o mesmo membro
                if (!mapaMembros[key].cultos.some(c => c.serviceId === serv.id)) {
                    mapaMembros[key].cultos.push({
                        serviceId: serv.id,
                        title: serv.title || 'Culto',
                        dateIso: serv.date.split('T')[0],
                        hora: hora,
                        funcao: item.funcao,
                        musicas: musicasCulto
                    });
                }
            });
        });

        const listaVoluntarios = Object.values(mapaMembros).sort((a, b) => a.nome.localeCompare(b.nome));
        voluntáriosSemanaCache = listaVoluntarios;

        const badgeTotal = document.getElementById('wpp-badge-total-voluntarios');
        if (badgeTotal) badgeTotal.textContent = `${listaVoluntarios.length} voluntários`;

        if (listaVoluntarios.length === 0) {
            container.innerHTML = `
                <div class="py-10 text-center text-xs text-slate-400">
                    Nenhum voluntário escalado nos cultos desta semana.
                </div>
            `;
            return;
        }

        // 3. Renderizar cada voluntário
        container.innerHTML = listaVoluntarios.map((vol, idx) => {
            const msgFormatada = gerarTextoMensagemWhatsApp(vol);
            const msgEncoded = encodeURIComponent(msgFormatada);
            const temTelefone = !!vol.phone && vol.phone.replace(/\D/g, '').length >= 10;
            const phoneClean = formatarTelefoneWhatsApp(vol.phone);

            return `
                <div class="bg-slate-900 border ${temTelefone ? 'border-slate-800' : 'border-amber-700/60 bg-amber-950/10'} p-4 rounded-xl space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                ${vol.nome.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-white">${vol.nome}</h4>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-xs ${temTelefone ? 'text-emerald-400' : 'text-amber-400 font-semibold'}">
                                        ${temTelefone ? `📱 ${vol.phone}` : '⚠️ Telefone não cadastrado'}
                                    </span>
                                    <span class="text-xs text-slate-500">•</span>
                                    <span class="text-xs text-slate-400">${vol.cultos.length} culto(s) na semana</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button onclick="togglePreviewMensagemWpp(${idx})" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition font-medium">
                                👁️ Ver Mensagem
                            </button>
                            
                            ${temTelefone ? `
                                <a href="https://wa.me/${phoneClean}?text=${msgEncoded}" target="_blank" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40">
                                    <span>📲</span> Enviar WhatsApp
                                </a>
                            ` : `
                                <button onclick="abrirPromptEditarTelefone('${vol.profileId || ''}', '${vol.nome}')" class="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg transition">
                                    ➕ Cadastrar Tel
                                </button>
                            `}
                        </div>
                    </div>

                    <!-- PREVIEW DA MENSAGEM (ACCORDION) -->
                    <div id="wpp-preview-msg-${idx}" class="hidden mt-3 p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap select-all">
${msgFormatada}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Limpa e formata o telefone para o padrão internacional DDI 55
     */
    function formatarTelefoneWhatsApp(tel) {
        if (!tel) return '';
        let digits = String(tel).replace(/\D/g, '');
        if (!digits.startsWith('55') && digits.length >= 10) {
            digits = '55' + digits;
        }
        return digits;
    }

    /**
     * Gera o texto da mensagem no padrão markdown do WhatsApp
     */
    function gerarTextoMensagemWhatsApp(vol) {
        const primeiroNome = vol.nome.split(' ')[0];
        let texto = `Olá, ${primeiroNome}! 🎶 Graça e paz!\n\n`;
        texto += `Aqui está a sua programação no *Ministério de Louvor* para esta semana:\n\n`;

        vol.cultos.forEach(c => {
            const dObj = new Date(`${c.dateIso}T12:00:00`);
            const diaSemana = obterNomeDiaSemana(dObj);
            const dataFmt = formatarDataBR(dObj);

            texto += `━━━━━━━━━━━━━━━━━━━━\n`;
            texto += `📅 *${diaSemana} (${dataFmt}) às ${c.hora}*\n`;
            texto += `🏛️ *${c.title}*\n`;
            texto += `🎸 *Sua Função:* ${c.funcao}\n\n`;

            if (c.musicas && c.musicas.length > 0) {
                texto += `📜 *Repertório do Culto:*\n`;
                c.musicas.forEach((m, mIdx) => {
                    const tomStr = m.tone ? ` (Tom: ${m.tone})` : '';
                    texto += `${mIdx + 1}. *${m.title}*${tomStr}\n`;
                });
            } else {
                texto += `📜 *Repertório:* A definir em breve pela liderança.\n`;
            }
            texto += `\n`;
        });

        texto += `━━━━━━━━━━━━━━━━━━━━\n`;
        texto += `Acesse as cifras e áudios no aplicativo:\n`;
        texto += `👉 ${window.location.origin || 'https://liturge.app'}\n\n`;
        texto += `Bons ensaios e uma semana abençoada! 🙌`;

        return texto;
    }

    /**
     * Alterna a visualização da mensagem no card
     */
    function togglePreviewMensagemWpp(idx) {
        const el = document.getElementById(`wpp-preview-msg-${idx}`);
        if (el) el.classList.toggle('hidden');
    }
    window.togglePreviewMensagemWpp = togglePreviewMensagemWpp;

    /**
     * Prompt rápido para preencher o telefone de um membro sem telefone
     */
    async function abrirPromptEditarTelefone(profileId, nome) {
        const tel = prompt(`Informe o WhatsApp de ${nome} (com DDD, ex: 11999998888):`);
        if (!tel) return;

        const digits = tel.replace(/\D/g, '');
        if (digits.length < 10) {
            alert('Número de telefone inválido. Informe o DDD e o número completo.');
            return;
        }

        const sClientTel = getSupabaseClient();
        if (sClientTel && profileId) {
            try {
                await sClientTel
                    .from('profiles')
                    .update({ phone: tel })
                    .eq('id', profileId);
            } catch(e){}
        }

        // Atualiza em memória
        if (Array.isArray(window.dadosGlobais?.profiles)) {
            const p = window.dadosGlobais.profiles.find(x => x.id === profileId || x.name === nome);
            if (p) p.phone = tel;
        }

        alert(`Telefone de ${nome} cadastrado com sucesso!`);
        await compilarEscalasSemanais(inicioSemanaAtual, fimSemanaAtual);
    }
    window.abrirPromptEditarTelefone = abrirPromptEditarTelefone;

    // =========================================================================
    // NOVA ABA ADMIN: MENSAGENS AOS MEMBROS (WHATSAPP MULTI-MINISTÉRIO & RETRÁTIL)
    // =========================================================================

    let ministerioAtivoMensagensId = null;
    let membrosDoMinisterioAtivo = [];
    let ministeriosDisponiveis = [];
    let membrosExcluidosAuto = new Set();

    /**
     * Alterna a exibição das seções retráteis da nova aba
     */
    function alternarSecaoRetratilMensagens(tipo) {
        if (tipo === 'auto') {
            const corpo = document.getElementById('corpo-secao-auto-wpp');
            const chevron = document.getElementById('chevron-auto-wpp');
            if (corpo) {
                const fechado = corpo.classList.toggle('hidden');
                if (chevron) {
                    if (fechado) {
                        chevron.classList.remove('rotate-180');
                    } else {
                        chevron.classList.add('rotate-180');
                    }
                }
            }
        } else if (tipo === 'aviso') {
            const corpo = document.getElementById('corpo-secao-aviso-wpp');
            const chevron = document.getElementById('chevron-aviso-wpp');
            if (corpo) {
                const fechado = corpo.classList.toggle('hidden');
                if (chevron) {
                    if (fechado) {
                        chevron.classList.remove('rotate-180');
                    } else {
                        chevron.classList.add('rotate-180');
                    }
                }
            }
        }
    }
    window.alternarSecaoRetratilMensagens = alternarSecaoRetratilMensagens;

    /**
     * Renderiza e inicializa a aba de Mensagens aos Membros
     */
    async function renderizarAdminMensagensMembros() {
        const select = document.getElementById('msg-membros-select-ministerio');
        if (!select) return;

        select.innerHTML = '<option value="">Carregando...</option>';

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || window.usuarioLogado || null;
        const role = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';
        const ministeriosQueLidera = typeof obterIdsMinisteriosQueLidera === 'function' 
            ? obterIdsMinisteriosQueLidera(userToEvaluate) 
            : ((userToEvaluate && Array.isArray(userToEvaluate.lider_de) && userToEvaluate.lider_de.length > 0) 
                ? userToEvaluate.lider_de 
                : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []));

        const currentChurchId = (window.dadosGlobais?.church && window.dadosGlobais.church.id) 
            || (window.usuarioLogado && window.usuarioLogado.church_id);

        let ministries = window.dadosGlobais?.ministries || [];

        // Busca atualizada do Supabase se possível
        const sClientMin = getSupabaseClient();
        if (sClientMin) {
            try {
                let q = sClientMin.from('ministries').select('*').order('name');
                if (currentChurchId) q = q.eq('church_id', currentChurchId);
                const { data: minData, error: minErr } = await q;
                if (!minErr && Array.isArray(minData)) {
                    ministries = minData;
                    if (window.dadosGlobais) window.dadosGlobais.ministries = minData;
                }
            } catch (e) {
                console.warn('[Mensagens] Erro ao carregar ministérios:', e);
            }
        }

        // Filtrar por permissão: admin vê todos; líder vê apenas o(s) seu(s) ministério(s)
        if (role === 'admin' || window.isSuperAdmin) {
            ministeriosDisponiveis = ministries;
        } else if (role === 'lider') {
            ministeriosDisponiveis = ministries.filter(m => ministeriosQueLidera.includes(m.id));
        } else {
            ministeriosDisponiveis = [];
        }

        if (ministeriosDisponiveis.length === 0) {
            select.innerHTML = '<option value="">Nenhum ministério vinculado a você</option>';
            select.disabled = true;
            return;
        }

        select.innerHTML = ministeriosDisponiveis.map(m => `
            <option value="${m.id}">${m.name || 'Ministério'}</option>
        `).join('');

        // Se for líder com apenas 1 ministério, trava a seleção para evitar confusão
        select.disabled = (role === 'lider' && ministeriosDisponiveis.length <= 1);

        // Mantém seleção anterior ou usa o primeiro permitido
        if (!ministerioAtivoMensagensId || !ministeriosDisponiveis.some(m => m.id === ministerioAtivoMensagensId)) {
            ministerioAtivoMensagensId = ministeriosDisponiveis[0].id;
        }

        select.value = ministerioAtivoMensagensId;
        await trocarMinisterioMensagens(ministerioAtivoMensagensId);
    }
    window.renderizarAdminMensagensMembros = renderizarAdminMensagensMembros;

    /**
     * Troca o ministério atualmente em edição
     */
    async function trocarMinisterioMensagens(minId) {
        if (!minId) return;
        ministerioAtivoMensagensId = minId;

        const ministry = ministeriosDisponiveis.find(m => m.id === minId) || {};
        carregarConfiguracaoMinisterioMensagens(ministry);
        await carregarMembrosParaAvisos(minId);
        atualizarPreviewMensagemAutomatica();
        atualizarPreviewAvisoImediato();
    }
    window.trocarMinisterioMensagens = trocarMinisterioMensagens;

    /**
     * Preenche os campos da seção de envio automático a partir dos dados do ministério
     */
    function carregarConfiguracaoMinisterioMensagens(ministry) {
        const defaultTemplate = `{escalas}\n\n{repertorio}`;

        const cfg = ministry.whatsapp_config || {
            active: false,
            day_of_week: 1,
            time: "08:00",
            template: defaultTemplate,
            include_services: true,
            include_repertoire: true,
            include_youtube_links: true,
            include_tone: true,
            include_confirmation_prompt: true
        };

        const switchAtivo = document.getElementById('wpp-auto-ativo');
        if (switchAtivo) switchAtivo.checked = !!cfg.active;

        const selectDia = document.getElementById('wpp-auto-dia');
        if (selectDia) selectDia.value = String(cfg.day_of_week ?? 1);

        const inputHora = document.getElementById('wpp-auto-hora');
        if (inputHora) inputHora.value = cfg.time || '08:00';

        const checkEscalas = document.getElementById('wpp-inc-escalas');
        if (checkEscalas) checkEscalas.checked = cfg.include_services !== false;

        const checkRepertorio = document.getElementById('wpp-inc-repertorio');
        if (checkRepertorio) checkRepertorio.checked = cfg.include_repertoire !== false;

        const checkYoutube = document.getElementById('wpp-inc-youtube');
        if (checkYoutube) checkYoutube.checked = cfg.include_youtube_links !== false;

        const checkTom = document.getElementById('wpp-inc-tom');
        if (checkTom) checkTom.checked = cfg.include_tone !== false;

        const checkConfirm = document.getElementById('wpp-inc-confirmacao');
        if (checkConfirm) checkConfirm.checked = cfg.include_confirmation_prompt !== false;

        let currentTpl = cfg.template || defaultTemplate;
        // Limpa saudações e despedidas antigas caso tenham sido salvas anteriormente
        currentTpl = currentTpl
            .replace(/^Olá,\s*\*?\{nome\}\*?!?\s*(👋|🙏)?\s*\n*Segue sua escala no ministério \*?\{ministerio\}\*? para esta semana:\s*/i, '')
            .replace(/\s*Tenha uma abençoada semana.*$/i, '')
            .replace(/\s*\*?Por favor, responda a esta mensagem confirmando.*$/i, '')
            .trim();
        if (!currentTpl) currentTpl = defaultTemplate;

        const textareaTpl = document.getElementById('wpp-auto-template');
        if (textareaTpl) textareaTpl.value = currentTpl;

        const excluidos = Array.isArray(cfg.membros_excluidos) ? cfg.membros_excluidos : [];
        membrosExcluidosAuto = new Set(excluidos);
        atualizarBadgeExcluidosAuto();
        renderizarCardsMembrosAuto();

        atualizarStatusToggleAutoWpp();

        const feedback = document.getElementById('wpp-auto-feedback-msg');
        if (feedback) feedback.textContent = '';
    }

    /**
     * Atualiza o badge numérico de membros excluídos do envio automático
     */
    function atualizarBadgeExcluidosAuto() {
        const badge = document.getElementById('badge-excluidos-auto-wpp');
        if (!badge) return;
        const total = membrosExcluidosAuto.size;
        if (total === 0) {
            badge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400';
            badge.textContent = '0 excluídos';
        } else {
            badge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-700/80 text-rose-300';
            badge.textContent = `${total} ${total === 1 ? 'excluído' : 'excluídos'}`;
        }
    }
    window.atualizarBadgeExcluidosAuto = atualizarBadgeExcluidosAuto;

    /**
     * Alterna a exclusão de um voluntário do envio semanal automático
     */
    function alternarExclusaoMembroAuto(memberId) {
        if (!memberId) return;
        if (membrosExcluidosAuto.has(memberId)) {
            membrosExcluidosAuto.delete(memberId);
        } else {
            membrosExcluidosAuto.add(memberId);
        }
        atualizarBadgeExcluidosAuto();
        renderizarCardsMembrosAuto();
    }
    window.alternarExclusaoMembroAuto = alternarExclusaoMembroAuto;

    /**
     * Renderiza os cards individuais de integrantes na lista de envio automático semanal
     */
    function renderizarCardsMembrosAuto() {
        const container = document.getElementById('lista-membros-auto-container');
        if (!container) return;

        if (!membrosDoMinisterioAtivo || membrosDoMinisterioAtivo.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-4 text-center text-xs text-slate-500">
                    Nenhum integrante encontrado para este ministério.
                </div>
            `;
            return;
        }

        container.innerHTML = membrosDoMinisterioAtivo.map((m) => {
            const clean = (m.phone || '').replace(/\D/g, '');
            const temTelefone = clean.length >= 10;
            const isExcluido = membrosExcluidosAuto.has(m.id);
            const iniciais = (m.name || 'M').substring(0, 2).toUpperCase();
            const rolesStr = m.roles && m.roles.length > 0 ? m.roles.join(', ') : 'Membro';

            return `
                <div class="flex items-center justify-between p-2.5 rounded-xl border transition ${
                    isExcluido 
                        ? 'bg-rose-950/20 border-rose-800/50' 
                        : 'bg-slate-800/80 border-slate-700/60 hover:border-slate-600'
                }">
                    <div class="flex items-center gap-2.5 min-w-0 pr-2">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                            isExcluido 
                                ? 'bg-rose-900/40 text-rose-300 border border-rose-700/40' 
                                : 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                        }">
                            ${iniciais}
                        </div>
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                                <span class="truncate">${m.name}</span>
                                ${isExcluido 
                                    ? '<span class="text-[9px] bg-rose-900/60 text-rose-300 px-1.5 py-0.2 rounded border border-rose-700/50 flex-shrink-0">Removido</span>' 
                                    : '<span class="text-[9px] bg-emerald-900/60 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-700/50 flex-shrink-0">Recebe</span>'
                                }
                            </div>
                            <div class="text-[10px] text-slate-400 truncate">
                                ${rolesStr} ${temTelefone ? `• ${m.phone}` : '• <span class="text-amber-400">Sem tel</span>'}
                            </div>
                        </div>
                    </div>

                    <div class="flex-shrink-0">
                        ${isExcluido ? `
                            <button type="button" onclick="alternarExclusaoMembroAuto('${m.id}')"
                                class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition flex items-center gap-1 shadow-sm"
                                title="Reativar envio de mensagem automática para este voluntário">
                                <span>➕</span> Incluir
                            </button>
                        ` : `
                            <button type="button" onclick="alternarExclusaoMembroAuto('${m.id}')"
                                class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-700/80 hover:bg-rose-900/80 hover:text-rose-200 text-slate-300 transition flex items-center gap-1 border border-slate-600"
                                title="Remover este voluntário da mensagem semanal automática">
                                <span>❌</span> Remover
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }
    window.renderizarCardsMembrosAuto = renderizarCardsMembrosAuto;

    /**
     * Atualiza o badge e o label do switch de ativação automática
     */
    function atualizarStatusToggleAutoWpp() {
        const switchAtivo = document.getElementById('wpp-auto-ativo');
        const badge = document.getElementById('badge-status-auto-wpp');
        const labelSwitch = document.getElementById('label-switch-auto-wpp');
        const ativo = !!(switchAtivo && switchAtivo.checked);

        if (badge) {
            if (ativo) {
                badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-400 border-emerald-700/80';
                badge.textContent = '● Ativada';
            } else {
                badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-slate-900 border-slate-700 text-slate-400';
                badge.textContent = '● Desativada';
            }
        }

        if (labelSwitch) {
            labelSwitch.textContent = ativo ? 'Ativado' : 'Desativado';
        }
    }
    window.atualizarStatusToggleAutoWpp = atualizarStatusToggleAutoWpp;

    /**
     * Insere tag no cursor do textarea do template
     */
    function inserirTagTemplate(tag) {
        const textarea = document.getElementById('wpp-auto-template');
        if (!textarea) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const texto = textarea.value;
        textarea.value = texto.substring(0, start) + tag + texto.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        atualizarPreviewMensagemAutomatica();
    }
    window.inserirTagTemplate = inserirTagTemplate;

    /**
     * Insere tag no cursor do textarea do aviso
     */
    function inserirTagAviso(tag) {
        const textarea = document.getElementById('wpp-aviso-texto');
        if (!textarea) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const texto = textarea.value;
        textarea.value = texto.substring(0, start) + tag + texto.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        atualizarPreviewAvisoImediato();
    }
    window.inserirTagAviso = inserirTagAviso;

    /**
     * Gera a pré-visualização da mensagem automática compilada com cultos reais da semana
     */
    function atualizarPreviewMensagemAutomatica() {
        const previewEl = document.getElementById('wpp-auto-preview');
        if (!previewEl) return;

        const ministry = ministeriosDisponiveis.find(m => m.id === ministerioAtivoMensagensId) || {};
        const template = document.getElementById('wpp-auto-template')?.value || '';
        const incEscalas = !!document.getElementById('wpp-inc-escalas')?.checked;
        const incRepertorio = !!document.getElementById('wpp-inc-repertorio')?.checked;
        const incYoutube = !!document.getElementById('wpp-inc-youtube')?.checked;
        const incTom = !!document.getElementById('wpp-inc-tom')?.checked;
        const incConfirm = !!document.getElementById('wpp-inc-confirmacao')?.checked;

        const churchName = window.dadosGlobais?.church?.name || 'Nossa Igreja';
        const ministryName = ministry.name || 'Louvor';

        // 1. Obter cultos da semana atual
        const { segunda, domingo } = obterIntervaloSemana(new Date());
        const isoInicio = segunda.toISOString().split('T')[0];
        const isoFim = domingo.toISOString().split('T')[0];

        const rawServices = window.dadosGlobais?.services || [];
        const cultosSemana = rawServices.filter(s => {
            if (!s.date) return false;
            const d = s.date.split('T')[0];
            return d >= isoInicio && d <= isoFim;
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Bloco de escalas
        let blocoEscalas = '';
        if (incEscalas) {
            if (cultosSemana.length > 0) {
                blocoEscalas = cultosSemana.map(s => {
                    let dataFmt = '';
                    let horaFmt = '';
                    if (s.date) {
                        const parts = s.date.split('T');
                        const dp = (parts[0] || '').split('-');
                        if (dp.length === 3) dataFmt = `${dp[2]}/${dp[1]}`;
                        if (parts[1]) horaFmt = parts[1].slice(0, 5);
                    }
                    return `🗓️ *${dataFmt} (${horaFmt})* - ${s.title || 'Culto'}\n👉 *Sua Função:* Integrante Escalado`;
                }).join('\n\n');
            } else {
                blocoEscalas = `🗓️ *Quarta (20:00)* - Culto da Palavra\n👉 *Sua Função:* Integrante Escalado\n\n🗓️ *Domingo (18:00)* - Culto de Louvor & Adoração\n👉 *Sua Função:* Integrante Escalado`;
            }
        }

        // Bloco de repertório
        let blocoRepertorio = '';
        if (incRepertorio) {
            blocoRepertorio = `🎵 *Repertório da Semana:*\n`;
            blocoRepertorio += `  1. *Lindo És* - FHOP${incTom ? ' (Tom: G)' : ''}${incYoutube ? '\n     ▶️ https://youtu.be/exemplo1' : ''}\n`;
            blocoRepertorio += `  2. *Bondade de Deus* - Isaías Saad${incTom ? ' (Tom: D)' : ''}${incYoutube ? '\n     ▶️ https://youtu.be/exemplo2' : ''}\n`;
            blocoRepertorio += `  3. *A Bênção* - Gabriel Guedes${incTom ? ' (Tom: C)' : ''}${incYoutube ? '\n     ▶️ https://youtu.be/exemplo3' : ''}`;
        }

        // Bloco de cultos (resumo)
        let blocoCultos = cultosSemana.length > 0
            ? cultosSemana.map(s => `• ${s.title || 'Culto'} (${s.date.split('T')[0]})`).join('\n')
            : `• Culto de Quarta (20:00)\n• Culto de Domingo (18:00)`;

        // Montagem do miolo personalizável (Variável {{3}} da Meta)
        let miolo = (template || '').trim();
        if (!miolo) {
            miolo = `{escalas}\n\n{repertorio}`;
        }

        // Limpeza de saudações e despedidas antigas caso ainda existam no texto do usuário
        miolo = miolo
            .replace(/^Olá,\s*\*?\{nome\}\*?!?\s*(👋|🙏)?\s*\n*Segue sua escala no ministério \*?\{ministerio\}\*? para esta semana:\s*/i, '')
            .replace(/\s*Tenha uma abençoada semana.*$/i, '')
            .replace(/\s*\*?Por favor, responda a esta mensagem confirmando.*$/i, '')
            .trim();

        miolo = miolo.replace(/\{escalas\}/g, blocoEscalas);
        miolo = miolo.replace(/\{repertorio\}/g, blocoRepertorio);
        miolo = miolo.replace(/\{cultos\}/g, blocoCultos);
        miolo = miolo.replace(/\{nome\}/g, 'Gabriel Santos');
        miolo = miolo.replace(/\{ministerio\}/g, ministryName);
        miolo = miolo.replace(/\{igreja\}/g, churchName);
        miolo = miolo.replace(/\{youtube\}/g, incYoutube ? '▶️ https://youtube.com/playlist-exemplo' : '');

        // Cabeçalho Fixo Oficial da Meta
        const cabecalhoMeta = `Olá, Gabriel Santos! Graça e paz.\nAqui está a sua programação no ministério de ${ministryName} para esta semana:\n\n`;

        // Rodapé Fixo Oficial da Meta
        const rodapeMeta = `\n\nPor favor, responda a esta mensagem com a palavra CONFIRMADO para confirmar sua presença, ou com 4 para enviar uma justificativa. Deus abençoe! 🙏 ✨`;

        const msgFinal = cabecalhoMeta + miolo.trim() + rodapeMeta;
        previewEl.textContent = msgFinal;
    }
    window.atualizarPreviewMensagemAutomatica = atualizarPreviewMensagemAutomatica;

    /**
     * Salva a configuração de mensagens automáticas no Supabase e acorda o robô
     */
    async function salvarConfiguracaoMinisterioMensagens() {
        const feedback = document.getElementById('wpp-auto-feedback-msg');
        const btnSalvar = document.getElementById('btn-salvar-config-wpp');
        if (!ministerioAtivoMensagensId) {
            alert('Selecione um ministério para salvar.');
            return;
        }

        const config = {
            active: !!document.getElementById('wpp-auto-ativo')?.checked,
            day_of_week: parseInt(document.getElementById('wpp-auto-dia')?.value || '1', 10),
            time: document.getElementById('wpp-auto-hora')?.value || '08:00',
            include_services: !!document.getElementById('wpp-inc-escalas')?.checked,
            include_repertoire: !!document.getElementById('wpp-inc-repertorio')?.checked,
            include_youtube_links: !!document.getElementById('wpp-inc-youtube')?.checked,
            include_tone: !!document.getElementById('wpp-inc-tom')?.checked,
            include_confirmation_prompt: !!document.getElementById('wpp-inc-confirmacao')?.checked,
            template: document.getElementById('wpp-auto-template')?.value || '',
            membros_excluidos: Array.from(membrosExcluidosAuto)
        };

        if (btnSalvar) btnSalvar.disabled = true;
        if (feedback) feedback.innerHTML = '<span class="text-amber-400 font-semibold animate-pulse">💾 Salvando configuração e comunicando o robô...</span>';

        try {
            const sClientSave = getSupabaseClient();
            if (!sClientSave) throw new Error('Cliente Supabase não inicializado.');

            const { error } = await sClientSave
                .from('ministries')
                .update({ whatsapp_config: config })
                .eq('id', ministerioAtivoMensagensId);

            if (error) {
                // Se a coluna ainda não existe, orienta o usuário
                if (error.message && error.message.includes('whatsapp_config')) {
                    throw new Error('A coluna whatsapp_config ainda não foi criada no banco de dados. Execute o script sql/adicionar_whatsapp_config_ministerios.sql no Supabase SQL Editor.');
                }
                throw error;
            }

            // Atualiza objeto em memória
            const min = ministeriosDisponiveis.find(m => m.id === ministerioAtivoMensagensId);
            if (min) min.whatsapp_config = config;

            // Se a configuração estiver desligada, apenas confirma e finaliza
            if (!config.active) {
                if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-semibold">✅ Configuração salva! (Robô de envio automático desligado)</span>';
                setTimeout(() => { if (feedback) feedback.innerHTML = ''; }, 4000);
                return;
            }

            // Verifica se hoje é o dia programado
            const hojeDiaSemana = (new Date()).getDay(); // 0 = Dom, 1 = Seg ... 6 = Sáb
            const diaConfig = parseInt(config.day_of_week ?? 1, 10);
            let forcarDisparo = (diaConfig === hojeDiaSemana);

            // Se hoje não for o dia configurado, pergunta amigavelmente se deseja disparar as escalas desta semana agora para testar
            if (!forcarDisparo) {
                const diasNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                const nomeDiaConfig = diasNomes[diaConfig] || 'outro dia';
                const desejaTestar = confirm(`A configuração foi salva para toda ${nomeDiaConfig} às ${config.time || '08:00'}.\n\nDeseja que o robô faça o disparo das escalas desta semana agora para testar o envio para os voluntários?`);
                if (desejaTestar) {
                    forcarDisparo = true;
                }
            }

            if (feedback) {
                feedback.innerHTML = `<span class="text-blue-400 font-semibold animate-pulse">🤖 Robô acordado! ${forcarDisparo ? 'Compilando escalas e disparando WhatsApp...' : 'Sincronizando agendamento...'}</span>`;
            }

            // Chama a Edge Function para acordar o robô
            const supabaseAnonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (window.supabaseAnonKey || '');
            const edgeRes = await fetch('https://pfhkzgccoirosztjcyrh.supabase.co/functions/v1/whatsapp-cron-segunda', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                    action: 'acordar',
                    ministry_id: ministerioAtivoMensagensId,
                    config: config,
                    force_dispatch: forcarDisparo
                })
            });

            const edgeData = await edgeRes.json();
            if (!edgeRes.ok) {
                throw new Error(edgeData.error || 'Erro na resposta do robô.');
            }

            if (edgeData.status === 'disparado') {
                if (feedback) {
                    feedback.innerHTML = `<span class="text-emerald-400 font-bold">✅ Configuração salva! 🤖 Robô disparou ${edgeData.totalMensagensEnviadas || 0} mensagem(ns) de escala para a equipe!</span>`;
                }
                alert(`🤖 Robô acordado com sucesso!\n\n${edgeData.totalMensagensEnviadas || 0} mensagem(ns) enviada(s) via WhatsApp para os voluntários escalados nesta semana.`);
            } else if (edgeData.status === 'agendado') {
                if (feedback) {
                    feedback.innerHTML = `<span class="text-emerald-400 font-semibold">✅ Configuração salva! 🤖 ${edgeData.message || 'Robô acordado e sincronizado.'}</span>`;
                }
            } else {
                if (feedback) {
                    feedback.innerHTML = `<span class="text-emerald-400 font-semibold">✅ ${edgeData.message || 'Configuração salva e sincronizada!'}</span>`;
                }
            }
        } catch (err) {
            console.error('[Mensagens] Erro ao salvar configuração / acordar robô:', err);
            if (feedback) feedback.innerHTML = `<span class="text-rose-400 font-semibold">❌ Erro: ${err.message}</span>`;
            alert(`Erro ao salvar ou acordar robô: ${err.message}`);
        } finally {
            if (btnSalvar) btnSalvar.disabled = false;
        }
    }
    window.salvarConfiguracaoMinisterioMensagens = salvarConfiguracaoMinisterioMensagens;

    /**
     * Envia uma mensagem de teste para o WhatsApp do usuário logado
     */
    async function enviarTesteMensagemAutomatica() {
        const previewEl = document.getElementById('wpp-auto-preview');
        const msg = previewEl ? previewEl.textContent : '';

        const userToEvaluate = (typeof modoSimulacaoPerfil !== 'undefined' ? modoSimulacaoPerfil : null) || window.usuarioLogado || null;
        let userPhone = userToEvaluate ? (userToEvaluate.phone || userToEvaluate.telefone || '') : '';

        const telPrompt = prompt('Confirme ou digite o seu número de WhatsApp com DDD para receber o teste (ex: 11999998888):', userPhone.replace(/\D/g, ''));
        if (!telPrompt) return;

        const cleanPhone = formatarTelefoneWhatsApp(telPrompt);
        if (cleanPhone.length < 10) {
            alert('Número de telefone inválido.');
            return;
        }

        // Tenta enviar via WhatsApp Cloud API diretamente
        try {
            const edgeRes = await fetch('https://pfhkzgccoirosztjcyrh.supabase.co/functions/v1/whatsapp-cron-segunda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'teste', phone: cleanPhone, message: msg })
            });
            const edgeJson = await edgeRes.json();
            if (edgeJson.success) {
                alert(`✅ Mensagem de teste enviada diretamente para o seu WhatsApp (+${cleanPhone})!`);
                return;
            }
        } catch (e) {
            console.warn('[Mensagens] Falha no disparo direto, abrindo WhatsApp Web:', e);
        }

        // Contingência: abre WhatsApp com mensagem pré-formatada
        const encodedMsg = encodeURIComponent(msg);
        const waLink = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
        window.open(waLink, '_blank');
    }
    window.enviarTesteMensagemAutomatica = enviarTesteMensagemAutomatica;

    /**
     * Carrega os integrantes do ministério selecionado para a seção de avisos
     */
    async function carregarMembrosParaAvisos(minId) {
        const container = document.getElementById('lista-membros-aviso-container');
        if (!container) return;

        container.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slate-500">Buscando integrantes...</div>';

        const currentChurchId = (window.dadosGlobais?.church && window.dadosGlobais.church.id) 
            || (window.usuarioLogado && window.usuarioLogado.church_id);

        let profiles = window.dadosGlobais?.profiles || [];
        let ministryRoles = [];
        let ministryLeaders = [];
        let userMinistryRoles = [];

        const sClientAvisos = getSupabaseClient();
        if (sClientAvisos) {
            try {
                // 1. Busca perfis da igreja
                let qProf = sClientAvisos.from('profiles').select('*').order('name');
                if (currentChurchId) qProf = qProf.eq('church_id', currentChurchId);
                const { data: pData } = await qProf;
                if (pData) profiles = pData;

                // 2. Busca funções e lideranças deste ministério
                const { data: mrData } = await sClientAvisos
                    .from('ministry_roles')
                    .select('id, name, ministry_id')
                    .eq('ministry_id', minId);
                if (mrData) ministryRoles = mrData;

                const { data: mlData } = await sClientAvisos
                    .from('ministry_leaders')
                    .select('profile_id, ministry_id')
                    .eq('ministry_id', minId);
                if (mlData) ministryLeaders = mlData;

                // 3. Se houver funções no ministério, busca os vínculos de usuários
                const roleIdsForMin = ministryRoles.map(r => r.id);
                if (roleIdsForMin.length > 0) {
                    const { data: umrData } = await sClientAvisos
                        .from('user_ministry_roles')
                        .select('profile_id, user_id, role_id')
                        .in('role_id', roleIdsForMin);
                    if (umrData) userMinistryRoles = umrData;
                }
            } catch (e) {
                console.warn('[Mensagens] Erro ao buscar membros do ministério:', e);
            }
        }

        const currentMinistry = (ministeriosDisponiveis || []).find(m => m.id === minId) 
            || (window.dadosGlobais?.ministries || []).find(m => m.id === minId) || {};
        const minNameClean = (currentMinistry.name || '').toLowerCase().trim();

        const roleIdsSet = new Set(ministryRoles.map(r => r.id));
        const leaderIdsSet = new Set((ministryLeaders || []).map(ml => ml.profile_id).filter(Boolean));
        if (currentMinistry.leader_id) leaderIdsSet.add(currentMinistry.leader_id);

        const umrMemberIds = new Set((userMinistryRoles || []).map(u => u.profile_id || u.user_id).filter(Boolean));

        // Mapeia nomes das funções por perfil
        const rolesMap = {};
        (ministryRoles || []).forEach(r => {
            (userMinistryRoles || []).filter(u => u.role_id === r.id).forEach(u => {
                const pid = u.profile_id || u.user_id;
                if (pid) {
                    if (!rolesMap[pid]) rolesMap[pid] = [];
                    if (!rolesMap[pid].includes(r.name)) rolesMap[pid].push(r.name);
                }
            });
        });

        // FILTRO ESTRITO: Apenas voluntários e líderes que realmente pertencem a este ministério
        const membrosFiltrados = profiles.filter(p => {
            // 1. Vínculo direto pelo ministry_id na tabela profiles
            const hasMinId = p.ministry_id === minId;
            // 2. Vínculo textual caso ministry seja gravado por nome
            const hasMinName = minNameClean && p.ministry && p.ministry.toLowerCase().trim() === minNameClean;
            // 3. Vínculo por liderança do ministério
            const isLider = leaderIdsSet.has(p.id) || (Array.isArray(p.lider_de) && p.lider_de.includes(minId));
            // 4. Vínculo por função ministerial cadastrada
            const hasRoleInMin = umrMemberIds.has(p.id) || (
                Array.isArray(p.user_ministry_roles) && p.user_ministry_roles.some(umr => 
                    umr.ministry_id === minId || roleIdsSet.has(umr.role_id || umr.ministry_role_id)
                )
            );
            return hasMinId || hasMinName || isLider || hasRoleInMin;
        });

        membrosDoMinisterioAtivo = membrosFiltrados.map(p => {
            const isLeaderOfThis = leaderIdsSet.has(p.id) 
                || (Array.isArray(p.lider_de) && p.lider_de.includes(minId)) 
                || (p.system_role === 'lider' && p.ministry_id === minId);
            
            const specificRoles = rolesMap[p.id] || [];
            let displayRole = 'Voluntário';
            if (isLeaderOfThis) {
                displayRole = 'Líder';
            } else if (specificRoles.length > 0) {
                displayRole = specificRoles.join(', ');
            } else if (p.role === 'admin' || p.system_role === 'admin') {
                displayRole = 'Admin';
            } else if (p.role || p.system_role) {
                const r = (p.system_role || p.role).toLowerCase();
                displayRole = r === 'voluntario' ? 'Voluntário' : (r === 'membro' ? 'Membro' : r);
            }

            return {
                id: p.id,
                name: p.name || 'Sem nome',
                phone: p.phone || p.telefone || p.whatsapp || '',
                roles: [displayRole]
            };
        });

        renderizarCardsMembrosAviso(membrosDoMinisterioAtivo);
        atualizarContadorMembrosAviso();
        renderizarCardsMembrosAuto();
        atualizarBadgeExcluidosAuto();
    }

    /**
     * Renderiza os cards de membros na lista de avisos
     */
    function renderizarCardsMembrosAviso(lista) {
        const container = document.getElementById('lista-membros-aviso-container');
        if (!container) return;

        if (lista.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-6 text-center text-xs text-slate-500">
                    Nenhum integrante encontrado para este ministério.
                </div>
            `;
            return;
        }

        container.innerHTML = lista.map((m, idx) => {
            const clean = (m.phone || '').replace(/\D/g, '');
            const temTelefone = clean.length >= 10;
            const rolesStr = m.roles.length > 0 ? m.roles.join(', ') : 'Membro';
            const iniciais = (m.name || 'M').substring(0, 2).toUpperCase();

            return `
                <label class="flex items-start gap-3 bg-slate-900/90 border ${temTelefone ? 'border-slate-800 hover:border-slate-700' : 'border-amber-700/40 bg-amber-950/10'} p-3 rounded-xl cursor-pointer transition select-none">
                    <input type="checkbox" name="membro-aviso-check" value="${m.id}" data-idx="${idx}"
                        ${temTelefone ? 'checked' : 'disabled'}
                        onchange="atualizarContadorMembrosAviso()"
                        class="mt-1 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0">
                    
                    <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        ${iniciais}
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-white truncate">${m.name}</div>
                        <div class="text-[11px] text-slate-400 truncate">${rolesStr}</div>
                        <div class="mt-1 flex items-center gap-1">
                            ${temTelefone ? `
                                <span class="text-[11px] text-emerald-400 font-mono">📱 ${m.phone}</span>
                            ` : `
                                <button type="button" onclick="event.preventDefault(); abrirPromptEditarTelefone('${m.id}', '${m.name}');"
                                    class="text-[10px] text-amber-400 bg-amber-950/60 hover:bg-amber-900 border border-amber-700/60 px-1.5 py-0.5 rounded transition">
                                    ⚠️ Cadastrar Tel
                                </button>
                            `}
                        </div>
                    </div>
                </label>
            `;
        }).join('');
    }

    /**
     * Atualiza o contador de membros selecionados
     */
    function atualizarContadorMembrosAviso() {
        const checkboxes = document.querySelectorAll('input[name="membro-aviso-check"]:checked');
        const totalChecked = checkboxes.length;
        const total = membrosDoMinisterioAtivo.length;

        const contador = document.getElementById('contador-membros-aviso');
        if (contador) contador.textContent = `${totalChecked} de ${total} selecionados`;

        const badge = document.getElementById('badge-selecionados-aviso');
        if (badge) badge.textContent = `${totalChecked} membro(s) selecionado(s)`;

        const btnDisparo = document.getElementById('btn-disparar-aviso-wpp');
        if (btnDisparo) btnDisparo.disabled = totalChecked === 0;
    }
    window.atualizarContadorMembrosAviso = atualizarContadorMembrosAviso;

    /**
     * Marca ou desmarca todos os membros com telefone válido
     */
    function selecionarTodosMembrosAviso(marcar) {
        const checkboxes = document.querySelectorAll('input[name="membro-aviso-check"]');
        checkboxes.forEach(cb => {
            if (!cb.disabled) cb.checked = !!marcar;
        });
        atualizarContadorMembrosAviso();
    }
    window.selecionarTodosMembrosAviso = selecionarTodosMembrosAviso;

    /**
     * Filtra a lista de membros por busca textual
     */
    function filtrarListaMembrosAviso(termo) {
        const t = (termo || '').toLowerCase().trim();
        if (!t) {
            renderizarCardsMembrosAviso(membrosDoMinisterioAtivo);
        } else {
            const filtrados = membrosDoMinisterioAtivo.filter(m => 
                (m.name || '').toLowerCase().includes(t) ||
                m.roles.some(r => r.toLowerCase().includes(t)) ||
                (m.phone || '').includes(t)
            );
            renderizarCardsMembrosAviso(filtrados);
        }
        atualizarContadorMembrosAviso();
    }
    window.filtrarListaMembrosAviso = filtrarListaMembrosAviso;

    /**
     * Atualiza a pré-visualização do comunicado imediato
     */
    function atualizarPreviewAvisoImediato() {
        const previewEl = document.getElementById('wpp-aviso-preview');
        const texto = document.getElementById('wpp-aviso-texto')?.value || '';
        if (!previewEl) return;

        if (!texto.trim()) {
            previewEl.textContent = 'Digite um comunicado acima para visualizar a prévia aqui...';
            return;
        }

        let formatado = texto.replace(/\{nome\}/g, 'Gabriel Santos');
        previewEl.textContent = formatado;
    }
    window.atualizarPreviewAvisoImediato = atualizarPreviewAvisoImediato;

    /**
     * Dispara o comunicado imediato aos membros selecionados
     */
    async function enviarAvisoImediatoMembros() {
        const checkboxes = document.querySelectorAll('input[name="membro-aviso-check"]:checked');
        if (checkboxes.length === 0) {
            alert('Selecione ao menos um integrante com telefone cadastrado para enviar o aviso.');
            return;
        }

        const texto = document.getElementById('wpp-aviso-texto')?.value || '';
        if (!texto.trim()) {
            alert('Por favor, escreva a mensagem do comunicado antes de enviar.');
            document.getElementById('wpp-aviso-texto')?.focus();
            return;
        }

        const selecionados = Array.from(checkboxes).map(cb => {
            return membrosDoMinisterioAtivo.find(m => m.id === cb.value) || membrosDoMinisterioAtivo[parseInt(cb.getAttribute('data-idx'), 10)];
        }).filter(Boolean);

        const confirmar = confirm(`Deseja disparar este comunicado para ${selecionados.length} integrante(s) via WhatsApp?`);
        if (!confirmar) return;

        const progContainer = document.getElementById('wpp-aviso-progresso-container');
        const progStatus = document.getElementById('wpp-aviso-progresso-status');
        const progContador = document.getElementById('wpp-aviso-progresso-contador');
        const progBarra = document.getElementById('wpp-aviso-progresso-barra');
        const relatorio = document.getElementById('wpp-aviso-relatorio-envio');

        if (progContainer) progContainer.classList.remove('hidden');
        if (relatorio) relatorio.innerHTML = '';

        let enviadosApi = 0;
        const total = selecionados.length;

        // Tenta enviar em lote via Edge Function (WhatsApp Cloud API)
        let resultadosApi = null;
        try {
            if (progStatus) progStatus.textContent = 'Conectando à API do WhatsApp Cloud...';
            const edgeRes = await fetch('https://pfhkzgccoirosztjcyrh.supabase.co/functions/v1/whatsapp-cron-segunda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'aviso',
                    recipients: selecionados.map(m => ({ name: m.name, phone: m.phone })),
                    message: texto
                })
            });
            if (edgeRes.ok) {
                const edgeData = await edgeRes.json();
                if (edgeData && Array.isArray(edgeData.resultados)) {
                    resultadosApi = edgeData.resultados;
                }
            }
        } catch (e) {
            console.warn('[Mensagens] Disparo direto via API indisponível, gerando links diretos:', e);
        }

        for (let i = 0; i < total; i++) {
            const m = selecionados[i];
            const msgPersonalizada = texto.replace(/\{nome\}/g, m.name.split(' ')[0]);
            const clean = formatarTelefoneWhatsApp(m.phone);
            const encoded = encodeURIComponent(msgPersonalizada);
            const waLink = `https://wa.me/${clean}?text=${encoded}`;

            const resApiMembro = resultadosApi ? resultadosApi.find(r => r.name === m.name || (r.phone && r.phone.includes(clean))) : null;
            const foiEnviadoViaApi = resApiMembro && resApiMembro.status === 'enviado';

            if (foiEnviadoViaApi) enviadosApi++;

            if (progStatus) progStatus.textContent = `Processando: ${m.name}...`;
            if (progContador) progContador.textContent = `${i + 1} / ${total}`;
            if (progBarra) progBarra.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

            // Adiciona item no relatório com status e link
            if (relatorio) {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs gap-2';
                item.innerHTML = `
                    <div class="flex items-center gap-2 truncate">
                        <span class="${foiEnviadoViaApi ? 'text-emerald-400' : 'text-slate-300'} font-semibold truncate">${m.name}</span>
                        <span class="text-[11px] text-slate-500 font-mono">(${m.phone})</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${foiEnviadoViaApi ? `
                            <span class="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                                <span>✓</span> Enviado via API
                            </span>
                        ` : ''}
                        <a href="${waLink}" target="_blank" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow">
                            📲 Abrir WhatsApp
                        </a>
                    </div>
                `;
                relatorio.appendChild(item);
            }

            await new Promise(r => setTimeout(r, 60));
        }

        if (enviadosApi > 0) {
            if (progStatus) progStatus.textContent = `🎉 Disparo concluído! ${enviadosApi} de ${total} enviados automaticamente via API.`;
        } else {
            if (progStatus) progStatus.textContent = `✅ Pronto! ${total} mensagem(ns) preparadas com links 1-click abaixo.`;
        }
    }
    window.enviarAvisoImediatoMembros = enviarAvisoImediatoMembros;

})();
