/**
 * analytics.js - Módulo de Inteligência de Dados, Métricas e Gráficos do LouvorIDB
 */

let chartTopMusicasInstance = null;
let chartTopVoluntariosInstance = null;
let todasMusicasExecutadas = [];

function definirAtalhoPeriodoAnalytics(opcao) {
    const elInicio = document.getElementById('analytics-data-inicio');
    const elFim = document.getElementById('analytics-data-fim');
    if (!elInicio || !elFim) return;

    const hoje = new Date();
    elFim.value = hoje.toISOString().split('T')[0];

    if (opcao === 30) {
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - 30);
        elInicio.value = inicio.toISOString().split('T')[0];
    } else if (opcao === 'ano') {
        const inicio = new Date(hoje.getFullYear(), 0, 1);
        elInicio.value = inicio.toISOString().split('T')[0];
    }
    carregarAnalytics();
}

function limparFiltroPeriodoAnalytics() {
    const elInicio = document.getElementById('analytics-data-inicio');
    const elFim = document.getElementById('analytics-data-fim');
    if (elInicio) elInicio.value = '';
    if (elFim) elFim.value = '';
    carregarAnalytics();
}

async function carregarAnalytics() {
    if (!supabaseClient) return;

    // 1. Guarda de Acesso: Apenas Líderes e Admins
    const userToEvaluate = modoSimulacaoPerfil || usuarioLogado;
    const roleUsuario = userToEvaluate ? (userToEvaluate.system_role || userToEvaluate.role || 'membro') : 'visitante';

    if (roleUsuario !== 'admin' && roleUsuario !== 'lider') {
        const sec = document.getElementById('secao-analytics');
        if (sec) sec.classList.add('hidden');
        if (typeof mostrarToast === 'function') {
            mostrarToast('Acesso negado: O módulo de Analytics é exclusivo para Líderes e Administradores.', 'aviso');
        }
        return;
    }

    try {
        const currentChurchId = userToEvaluate?.church_id || window.dadosGlobais?.church?.id || null;
        const ministeriosQueLidera = typeof obterIdsMinisteriosQueLidera === 'function' ? obterIdsMinisteriosQueLidera(userToEvaluate) : (userToEvaluate?.ministry_id ? [userToEvaluate.ministry_id] : []);
        
        let minDoUsuario = null;
        if (ministeriosQueLidera.length > 0 && window.dadosGlobais?.ministries) {
            minDoUsuario = window.dadosGlobais.ministries.find(m => ministeriosQueLidera.includes(m.id));
        }

        const isLiderNaoLouvor = (roleUsuario === 'lider') && minDoUsuario && !minDoUsuario.name.toLowerCase().includes('louvor') && !minDoUsuario.name.toLowerCase().includes('musica');

        // Ajustar visualização dos cards e gráficos para ministérios não-louvor (ex: Mídia)
        const kpiMusicasEl = document.getElementById('kpi-card-musicas');
        const kpiRepertorioEl = document.getElementById('kpi-card-repertorio');
        const cardChartMusicasEl = document.getElementById('card-analytics-musicas');
        const tituloVoluntariosEl = document.getElementById('titulo-chart-voluntarios');

        if (isLiderNaoLouvor) {
            if (kpiMusicasEl) kpiMusicasEl.classList.add('hidden');
            if (kpiRepertorioEl) kpiRepertorioEl.classList.add('hidden');
            if (cardChartMusicasEl) cardChartMusicasEl.classList.add('hidden');
            if (tituloVoluntariosEl) {
                tituloVoluntariosEl.innerHTML = `<span>🎥</span> Frequência da Equipe — ${minDoUsuario ? minDoUsuario.name : 'Ministério'}`;
            }
        } else {
            if (kpiMusicasEl) kpiMusicasEl.classList.remove('hidden');
            if (kpiRepertorioEl) kpiRepertorioEl.classList.remove('hidden');
            if (cardChartMusicasEl) cardChartMusicasEl.classList.remove('hidden');
            if (tituloVoluntariosEl) {
                tituloVoluntariosEl.innerHTML = `<span>🎸</span> Voluntários Mais Escalados`;
            }
        }

        // 2. Filtros de Intervalo de Datas
        const dataInicioStr = document.getElementById('analytics-data-inicio')?.value || '';
        const dataFimStr = document.getElementById('analytics-data-fim')?.value || '';

        // Buscar cultos no banco para filtrar por data e church_id
        let queryServices = supabaseClient.from('services').select('id, date, church_id');
        if (currentChurchId) {
            queryServices = queryServices.eq('church_id', currentChurchId);
        }
        const { data: rawServices } = await queryServices;

        const servicesFiltrados = (rawServices || []).filter(s => {
            if (!s.date) return true;
            const dOnly = s.date.split('T')[0];
            if (dataInicioStr && dOnly < dataInicioStr) return false;
            if (dataFimStr && dOnly > dataFimStr) return false;
            return true;
        });

        const validServiceIds = servicesFiltrados.map(s => s.id);
        const totalCultos = servicesFiltrados.length;

        // Atualizar KPIs Base
        const totalRepertorio = (window.dadosGlobais?.repertorio || []).length;
        let listaVoluntariosBase = window.dadosGlobais?.voluntarios || [];
        if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
            listaVoluntariosBase = listaVoluntariosBase.filter(v => {
                const vMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(v) : [v.ministry_id];
                return vMinIds.some(id => ministeriosQueLidera.includes(id));
            });
        }
        const totalVoluntarios = listaVoluntariosBase.length;

        document.getElementById('kpi-total-cultos').textContent = totalCultos;
        document.getElementById('kpi-repertorio-ativo').textContent = totalRepertorio;
        document.getElementById('kpi-total-voluntarios').textContent = totalVoluntarios;

        // 3. Buscar e filtrar dados de Músicas (service_songs)
        let topMusicas = [];
        let totalExecucoes = 0;

        if (!isLiderNaoLouvor) {
            let querySongs = supabaseClient.from('service_songs').select('*, song_versions(songs(title))');
            const { data: serviceSongsData } = await querySongs;

            const songsFiltradas = (serviceSongsData || []).filter(ss => validServiceIds.includes(ss.service_id));
            const musicasContador = {};

            songsFiltradas.forEach(item => {
                const title = item.song_versions?.songs?.title || item.song_name || item.title || 'Música';
                musicasContador[title] = (musicasContador[title] || 0) + 1;
                totalExecucoes++;
            });

            todasMusicasExecutadas = Object.entries(musicasContador)
                .sort((a, b) => b[1] - a[1]);

            topMusicas = todasMusicasExecutadas.slice(0, 5);
        }
        document.getElementById('kpi-total-musicas-tocadas').textContent = totalExecucoes;

        // 4. Buscar e filtrar dados de Escalas (service_scales)
        let queryScales = supabaseClient.from('service_scales').select('*, profiles(id, name, ministry_id), ministry_roles(id, name, ministry_id)');
        const { data: serviceScalesData } = await queryScales;

        const todosVoluntarios = window.dadosGlobais?.voluntarios || [];
        const todosMinisterios = window.dadosGlobais?.ministries || [];

        const scalesFiltradas = (serviceScalesData || []).filter(sc => {
            if (!validServiceIds.includes(sc.service_id)) return false;
            
            if (roleUsuario === 'lider' && ministeriosQueLidera.length > 0) {
                // Identifica se a função/cargo pertence aos ministérios liderados
                const roleMinId = sc.ministry_roles ? sc.ministry_roles.ministry_id : null;
                const isRoleInLeaderMin = roleMinId ? ministeriosQueLidera.includes(roleMinId) : todosMinisterios.some(m => ministeriosQueLidera.includes(m.id) && (m.ministry_roles || []).some(r => r.id === sc.role_id));

                const pid = sc.user_id || sc.profile_id;
                const prof = sc.profiles || todosVoluntarios.find(v => v.id === pid);
                const profMinIds = typeof obterIdsMinisteriosDoUsuario === 'function' ? obterIdsMinisteriosDoUsuario(prof) : (prof?.ministry_id ? [prof.ministry_id] : []);
                const isProfInLeaderMin = profMinIds.some(id => ministeriosQueLidera.includes(id));

                if (!isRoleInLeaderMin && !isProfInLeaderMin) return false;
            }
            return true;
        });

        const voluntariosContador = {};
        scalesFiltradas.forEach(item => {
            const pid = item.user_id || item.profile_id;
            const prof = item.profiles || todosVoluntarios.find(v => v.id === pid);
            const name = prof ? (prof.name || prof.email) : (item.profile_name || 'Voluntário');
            voluntariosContador[name] = (voluntariosContador[name] || 0) + 1;
        });

        const topVoluntarios = Object.entries(voluntariosContador)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // 5. Plotar Gráficos Chart.js
        if (!isLiderNaoLouvor) {
            renderizarGraficoTopMusicas(topMusicas);
        }
        renderizarGraficoTopVoluntarios(topVoluntarios);

    } catch (err) {
        console.warn('Aviso ao carregar analytics:', err);
    }
}

function renderizarGraficoTopMusicas(topMusicas) {
    const canvas = document.getElementById('chart-top-musicas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartTopMusicasInstance) {
        chartTopMusicasInstance.destroy();
    }

    const labels = topMusicas.length > 0 ? topMusicas.map(m => m[0]) : ['Nenhuma música no período'];
    const dataValues = topMusicas.length > 0 ? topMusicas.map(m => m[1]) : [0];

    const ctx = canvas.getContext('2d');
    chartTopMusicasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vezes Ministrada',
                data: dataValues,
                backgroundColor: 'rgba(6, 182, 212, 0.7)',
                borderColor: '#06b6d4',
                borderWidth: 1.5,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', stepSize: 1 },
                    grid: { color: 'rgba(51, 65, 85, 0.4)' }
                },
                y: {
                    ticks: { color: '#f8fafc', font: { weight: 'bold' } },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderizarGraficoTopVoluntarios(topVoluntarios) {
    const canvas = document.getElementById('chart-top-voluntarios');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartTopVoluntariosInstance) {
        chartTopVoluntariosInstance.destroy();
    }

    const labels = topVoluntarios.length > 0 ? topVoluntarios.map(v => v[0]) : ['Sem escalas no período'];
    const dataValues = topVoluntarios.length > 0 ? topVoluntarios.map(v => v[1]) : [1];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

    const ctx = canvas.getContext('2d');
    chartTopVoluntariosInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#0f172a',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', font: { size: 11 } }
                }
            }
        }
    });
}

// ===================== MODAL DE TODAS AS MÚSICAS MINISTRADAS =====================

function abrirModalTodasMusicasAnalytics() {
    const modal = document.getElementById('modal-todas-musicas-analytics');
    if (!modal) return;

    const inputBusca = document.getElementById('input-busca-musicas-analytics');
    if (inputBusca) inputBusca.value = '';

    renderizarListaMusicasAnalyticsModal(todasMusicasExecutadas);
    modal.classList.remove('hidden');
}

function fecharModalTodasMusicasAnalytics() {
    const modal = document.getElementById('modal-todas-musicas-analytics');
    if (modal) modal.classList.add('hidden');
}

function renderizarListaMusicasAnalyticsModal(lista) {
    const container = document.getElementById('container-lista-musicas-analytics');
    const subtitulo = document.getElementById('subtitulo-todas-musicas-analytics');
    if (!container) return;

    if (subtitulo) {
        subtitulo.textContent = `${todasMusicasExecutadas.length} músicas diferentes encontradas no período`;
    }

    if (!lista || lista.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8 italic">Nenhuma música encontrada.</p>';
        return;
    }

    container.innerHTML = lista.map((item, idx) => {
        const title = item[0];
        const count = item[1];
        const rank = idx + 1;

        let badgeCor = 'bg-slate-800 text-slate-400 border-slate-700';
        if (rank === 1) badgeCor = 'bg-amber-950/80 text-amber-400 border-amber-800/80';
        else if (rank === 2) badgeCor = 'bg-slate-700/80 text-slate-200 border-slate-600';
        else if (rank === 3) badgeCor = 'bg-amber-900/40 text-amber-500 border-amber-900/60';

        return `
            <div class="flex items-center justify-between p-3 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-md border ${badgeCor}">#${rank}</span>
                    <span class="text-xs font-semibold text-white">${title}</span>
                </div>
                <span class="text-xs font-medium text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/60">
                    ${count} ${count === 1 ? 'vez' : 'vezes'}
                </span>
            </div>
        `;
    }).join('');
}

function filtrarMusicasAnalyticsModal(query) {
    const term = (query || '').toLowerCase().trim();
    if (!term) {
        renderizarListaMusicasAnalyticsModal(todasMusicasExecutadas);
        return;
    }
    const filtradas = todasMusicasExecutadas.filter(m => m[0].toLowerCase().includes(term));
    renderizarListaMusicasAnalyticsModal(filtradas);
}

window.carregarAnalytics = carregarAnalytics;
window.definirAtalhoPeriodoAnalytics = definirAtalhoPeriodoAnalytics;
window.limparFiltroPeriodoAnalytics = limparFiltroPeriodoAnalytics;
window.abrirModalTodasMusicasAnalytics = abrirModalTodasMusicasAnalytics;
window.fecharModalTodasMusicasAnalytics = fecharModalTodasMusicasAnalytics;
window.filtrarMusicasAnalyticsModal = filtrarMusicasAnalyticsModal;
