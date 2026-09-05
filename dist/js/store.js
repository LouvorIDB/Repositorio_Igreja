/**
 * store.js - Gerenciador de Estado Centralizado do LouvorIDB
 * Encapsula o estado global da aplicação em um padrão Store (Getters, Setters, PubSub).
 */

(function () {
    'use strict';

    // Estado interno inicial com pré-hidratação de cache para inicialização instantânea sem piscadas
    const _state = {
        dadosGlobais: {
            cultos: [],
            repertorio: [],
            novas: [],
            voluntarios: [],
            ministries: [],
            church: (typeof window !== 'undefined' && window.__CACHED_CHURCH__) ? window.__CACHED_CHURCH__ : null
        },
        musicasCultoAtual: [],
        cantoresCultoAtual: [],
        escalaInstrumentos: { violao: '', bateria: '', teclado: '' },
        cultoEditandoIndex: null,
        isAdmin: false,
        usuarioLogado: (typeof window !== 'undefined' && window.__CACHED_USER__) ? window.__CACHED_USER__ : null
    };

    // Subscritos/Listeners para mudanças de estado
    const _listeners = new Set();

    const Store = {
        /**
         * Retorna uma cópia do estado atual ou de uma propriedade específica
         */
        getState() {
            return _state;
        },

        get(key) {
            return _state[key];
        },

        set(key, value) {
            _state[key] = value;
            this.notify(key, value);
        },

        // --- Getters e Setters específicos ---

        getDadosGlobais() {
            return _state.dadosGlobais;
        },

        setDadosGlobais(novosDados) {
            _state.dadosGlobais = Object.assign(_state.dadosGlobais, novosDados);
            this.notify('dadosGlobais', _state.dadosGlobais);
        },

        updateDadosGlobais(key, arrayOuObjeto) {
            _state.dadosGlobais[key] = arrayOuObjeto;
            this.notify(`dadosGlobais:${key}`, arrayOuObjeto);
        },

        getCultos() {
            return _state.dadosGlobais.cultos;
        },

        setCultos(cultos) {
            _state.dadosGlobais.cultos = cultos;
            this.notify('cultos', cultos);
            if (window.LocalDB && typeof window.LocalDB.salvarCultos === 'function') {
                window.LocalDB.salvarCultos(cultos).catch(() => {});
            }
        },

        getRepertorio() {
            return _state.dadosGlobais.repertorio;
        },

        setRepertorio(repertorio) {
            _state.dadosGlobais.repertorio = repertorio;
            this.notify('repertorio', repertorio);
            if (window.LocalDB && typeof window.LocalDB.salvarRepertorio === 'function') {
                window.LocalDB.salvarRepertorio(repertorio).catch(() => {});
            }
        },

        getNovas() {
            return _state.dadosGlobais.novas;
        },

        setNovas(novas) {
            _state.dadosGlobais.novas = novas;
            this.notify('novas', novas);
            if (window.LocalDB && typeof window.LocalDB.salvarNovas === 'function') {
                window.LocalDB.salvarNovas(novas).catch(() => {});
            }
        },

        getVoluntarios() {
            return _state.dadosGlobais.voluntarios;
        },

        setVoluntarios(voluntarios) {
            _state.dadosGlobais.voluntarios = voluntarios;
            this.notify('voluntarios', voluntarios);
        },

        getMinistries() {
            return _state.dadosGlobais.ministries;
        },

        setMinistries(ministries) {
            _state.dadosGlobais.ministries = ministries;
            this.notify('ministries', ministries);
        },

        getUsuarioLogado() {
            return _state.usuarioLogado;
        },

        setUsuarioLogado(usuario) {
            _state.usuarioLogado = usuario;
            _state.isAdmin = usuario?.system_role === 'admin';
            this.notify('usuarioLogado', usuario);
        },

        getIsAdmin() {
            return _state.isAdmin;
        },

        setIsAdmin(bool) {
            _state.isAdmin = !!bool;
            this.notify('isAdmin', _state.isAdmin);
        },

        getMusicasCultoAtual() {
            return _state.musicasCultoAtual;
        },

        setMusicasCultoAtual(musicas) {
            _state.musicasCultoAtual = musicas;
            this.notify('musicasCultoAtual', musicas);
        },

        getCantoresCultoAtual() {
            return _state.cantoresCultoAtual;
        },

        setCantoresCultoAtual(cantores) {
            _state.cantoresCultoAtual = cantores;
            this.notify('cantoresCultoAtual', cantores);
        },

        getEscalaInstrumentos() {
            return _state.escalaInstrumentos;
        },

        setEscalaInstrumentos(escala) {
            _state.escalaInstrumentos = escala;
            this.notify('escalaInstrumentos', escala);
        },

        getCultoEditandoIndex() {
            return _state.cultoEditandoIndex;
        },

        setCultoEditandoIndex(index) {
            _state.cultoEditandoIndex = index;
            this.notify('cultoEditandoIndex', index);
        },

        // --- Sistema de Notificação / PubSub ---

        subscribe(listenerFn) {
            if (typeof listenerFn === 'function') {
                _listeners.add(listenerFn);
                return () => _listeners.delete(listenerFn);
            }
        },

        notify(event, payload) {
            _listeners.forEach(listener => {
                try {
                    listener(event, payload, _state);
                } catch (e) {
                    console.error(`Erro ao notificar listener de estado [${event}]:`, e);
                }
            });
        }
    };

    // Expor o Store globalmente
    window.Store = Store;

    // Vincular propriedades globais legadas via Object.defineProperty
    // Isso garante 100% de compatibilidade com qualquer código legado existente
    const proxyProperties = [
        { name: 'dadosGlobais', get: () => Store.getDadosGlobais(), set: (v) => Store.setDadosGlobais(v) },
        { name: 'musicasCultoAtual', get: () => Store.getMusicasCultoAtual(), set: (v) => Store.setMusicasCultoAtual(v) },
        { name: 'cantoresCultoAtual', get: () => Store.getCantoresCultoAtual(), set: (v) => Store.setCantoresCultoAtual(v) },
        { name: 'escalaInstrumentos', get: () => Store.getEscalaInstrumentos(), set: (v) => Store.setEscalaInstrumentos(v) },
        { name: 'cultoEditandoIndex', get: () => Store.getCultoEditandoIndex(), set: (v) => Store.setCultoEditandoIndex(v) },
        { name: 'isAdmin', get: () => Store.getIsAdmin(), set: (v) => Store.setIsAdmin(v) },
        { name: 'usuarioLogado', get: () => Store.getUsuarioLogado(), set: (v) => Store.setUsuarioLogado(v) }
    ];

    proxyProperties.forEach(prop => {
        try {
            Object.defineProperty(window, prop.name, {
                get: prop.get,
                set: prop.set,
                configurable: true,
                enumerable: true
            });
        } catch (err) {
            console.warn(`Não foi possível redefinir a propriedade global ${prop.name}:`, err);
        }
    });

})();
