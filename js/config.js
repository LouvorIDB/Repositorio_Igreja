const SUPABASE_URL = "https://pfhkzgccoirosztjcyrh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U";

let supabaseClient = null;
if (window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
        console.error("Erro ao inicializar o Supabase:", err);
    }
}

let dadosGlobais = { cultos: [], repertorio: [], novas: [], voluntarios: [], ministries: [] };
let musicasCultoAtual = [];
let cantoresCultoAtual = []; // cantores selecionados para cantar no culto
let escalaInstrumentos = { violao: '', bateria: '', teclado: '' };
let cultoEditandoIndex = null;
let isAdmin = false;
let usuarioLogado = null;
