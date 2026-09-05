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
        if ((!profiles || profiles.length === 0) && window.supabaseClient) {
            try {
                const cId = window.dadosGlobais?.church?.id || window.usuarioLogado?.church_id || null;
                let q = window.supabaseClient.from('profiles').select('*');
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

        if (window.supabaseClient && profileId) {
            try {
                await window.supabaseClient
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

})();
