/**
 * LocalDB - Gerenciador IndexedDB para armazenamento e sincronização Offline.
 * Nome do Banco: IgdbLouvorDB
 */
const DB_NAME = 'IgdbLouvorDB';
const DB_VERSION = 1;

class LocalDBManager {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    /**
     * Inicializa a conexão com o banco de dados IndexedDB
     */
    async init() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store para Repertório Geral
                if (!db.objectStoreNames.contains('repertorio')) {
                    db.createObjectStore('repertorio', { keyPath: 'id' });
                }

                // Store para Músicas Novas
                if (!db.objectStoreNames.contains('novas')) {
                    db.createObjectStore('novas', { keyPath: 'id' });
                }

                // Store para Cultos e Escalamento
                if (!db.objectStoreNames.contains('cultos')) {
                    db.createObjectStore('cultos', { keyPath: 'id', autoIncrement: true });
                }

                // Store para Fila de Sincronização Offline
                if (!db.objectStoreNames.contains('solicitacoes_offline')) {
                    db.createObjectStore('solicitacoes_offline', { keyPath: 'id', autoIncrement: true });
                }

                // Store para Metadados e Configurações
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Erro ao abrir IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });

        return this.initPromise;
    }

    /**
     * Auxiliar genérico para executar transações no IndexedDB
     */
    async _getTransaction(storeName, mode = 'readonly') {
        const db = await this.init();
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    /**
     * Salva uma lista inteira de itens em um ObjectStore
     */
    async salvarLista(storeName, lista) {
        if (!Array.isArray(lista)) return;
        try {
            const db = await this.init();
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear(); // Limpa store anterior para manter sincronizado com a nuvem

            lista.forEach(item => {
                if (item && typeof item === 'object') {
                    store.put(item);
                }
            });

            return new Promise((resolve) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (err) {
            console.error(`Erro ao salvar lista em ${storeName}:`, err);
            return false;
        }
    }

    /**
     * Obtém todos os itens de um ObjectStore
     */
    async obterLista(storeName) {
        try {
            const store = await this._getTransaction(storeName, 'readonly');
            return new Promise((resolve) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch (err) {
            console.error(`Erro ao ler lista de ${storeName}:`, err);
            return [];
        }
    }

    // Métodos específicos para Repertório
    async salvarRepertorio(lista) {
        return this.salvarLista('repertorio', lista);
    }
    async obterRepertorio() {
        return this.obterLista('repertorio');
    }

    // Métodos específicos para Músicas Novas
    async salvarNovas(lista) {
        return this.salvarLista('novas', lista);
    }
    async obterNovas() {
        return this.obterLista('novas');
    }

    // Métodos específicos para Cultos
    async salvarCultos(lista) {
        return this.salvarLista('cultos', lista);
    }
    async obterCultos() {
        return this.obterLista('cultos');
    }

    // Fila de Sincronização de Solicitações Offline
    async enfileirarSolicitacaoOffline(solicitacao) {
        try {
            const db = await this.init();
            const tx = db.transaction('solicitacoes_offline', 'readwrite');
            const store = tx.objectStore('solicitacoes_offline');
            const payload = {
                ...solicitacao,
                timestamp: Date.now()
            };
            store.add(payload);
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (err) {
            console.error('Erro ao enfileirar solicitação offline:', err);
            return false;
        }
    }

    async obterSolicitacoesOffline() {
        return this.obterLista('solicitacoes_offline');
    }

    async removerSolicitacaoOffline(id) {
        try {
            const db = await this.init();
            const tx = db.transaction('solicitacoes_offline', 'readwrite');
            const store = tx.objectStore('solicitacoes_offline');
            store.delete(id);
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (err) {
            console.error('Erro ao remover solicitação offline:', err);
            return false;
        }
    }

    async limparSolicitacoesOffline() {
        try {
            const db = await this.init();
            const tx = db.transaction('solicitacoes_offline', 'readwrite');
            tx.objectStore('solicitacoes_offline').clear();
        } catch (e) {}
    }
}

// Instância única global
window.LocalDB = new LocalDBManager();
