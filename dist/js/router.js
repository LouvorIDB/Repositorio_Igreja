/**
 * router.js - Gerenciador de Roteamento e Carregador Dinâmico de Views (/views)
 * Carrega trechos de templates HTML para manter o index.html leve e modular.
 */

(function () {
    'use strict';

    const ViewLoader = {
        viewsCache: new Map(),

        /**
         * Carrega o conteúdo de uma view (.html) da pasta /views
         */
        async fetchView(viewName) {
            if (this.viewsCache.has(viewName)) {
                return this.viewsCache.get(viewName);
            }
            const url = `views/${viewName}.html`;
            try {
                const response = await fetch(`${url}?v=1.0`);
                if (response.ok) {
                    const html = await response.text();
                    this.viewsCache.set(viewName, html);
                    return html;
                }
            } catch (err) {
                console.warn(`[ViewLoader] Conexão indisponível ao buscar ${url}. Tentando Cache API...`);
            }

            // Fallback para o Cache API do Service Worker
            try {
                if ('caches' in window) {
                    const cachedResponse = await caches.match(url, { ignoreSearch: true });
                    if (cachedResponse) {
                        const html = await cachedResponse.text();
                        this.viewsCache.set(viewName, html);
                        return html;
                    }
                }
            } catch (cacheErr) {
                console.error(`[ViewLoader] Erro ao ler view do Cache API:`, cacheErr);
            }

            return null;
        },

        /**
         * Injeta o HTML da view dentro do container alvo especificado por ID
         */
        async renderView(viewName, targetContainerId) {
            const container = document.getElementById(targetContainerId);
            if (!container) return;

            const html = await this.fetchView(viewName);
            if (html) {
                container.innerHTML = html;
            }
        },

        initPromise: null,

        /**
         * Inicializa o carregamento de todas as views no shell do app
         */
        async initAllViews() {
            if (this.initPromise) {
                return this.initPromise;
            }
            const viewsToLoad = [
                { name: 'admin-panel', target: 'painel-admin-container' },
                { name: 'secao-cultos', target: 'secao-cultos-container' },
                { name: 'secao-novas', target: 'secao-novas-container' },
                { name: 'secao-repertorio', target: 'secao-repertorio-container' },
                { name: 'secao-midia', target: 'secao-midia-container' },
                { name: 'secao-agenda', target: 'secao-agenda-container' },
                { name: 'secao-almoxarifado', target: 'secao-almoxarifado-container' },
                { name: 'secao-analytics', target: 'secao-analytics-container' },
                { name: 'secao-holyrics', target: 'secao-holyrics-container' },
                { name: 'modais', target: 'modais-container' }
            ];

            this.initPromise = Promise.all(viewsToLoad.map(v => this.renderView(v.name, v.target)));
            return this.initPromise;
        }
    };

    window.ViewLoader = ViewLoader;

    // Carregar views automaticamente no DOMContentLoaded se os containers existirem
    document.addEventListener('DOMContentLoaded', () => {
        ViewLoader.initAllViews();
    });

})();
