const SUPABASE_URL = "https://pfhkzgccoirosztjcyrh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qmcjr2jlQMdgqfTPEdVZrg_REyhinho";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzY7ME_zU4avoz3cyswfP1INGxyaJuMDAHxCyZtDHnLuItqNE_YhtKgYBYmO_1YJdMH/exec";

let dadosGlobais = { cultos: [], repertorio: [], banco: [], cantores: [] };
let musicasCultoAtual = [];
let cantoresCultoAtual = []; // cantores selecionados para cantar no culto
let escalaInstrumentos = { violao: '', bateria: '', teclado: '' };
let cultoEditandoIndex = null;
let isAdmin = false;

function limparCacheLocal() {
    localStorage.removeItem('dadosGlobaisCache');
}
