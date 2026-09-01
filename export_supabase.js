import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configurações do Supabase (lidas de public/js/config.js)
const SUPABASE_URL = "https://pfhkzgccoirosztjcyrh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmaGt6Z2Njb2lyb3N6dGpjeXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NzY1MzgsImV4cCI6MjEwMjA1MjUzOH0.iFOlq-AXEmiTqCI2TsCblvzq_fp8YeadSr3vEFlgs9U";

// Caso tenha a SERVICE_ROLE_KEY (Chave Admin), substitua abaixo para ignorar o RLS e trazer 100% dos dados:
// const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Lista de tabelas da base de dados do projeto
const tables = [
  'churches',
  'profiles',
  'roles',
  'ministries',
  'ministry_roles',
  'user_ministry_roles',
  'services',
  'songs',
  'song_versions',
  'service_songs',
  'availability_comments',
  'themes'
];

// Helper para converter array de objetos para CSV simples
function convertToCSV(items) {
  if (!items || !items.length) return '';
  const headers = Object.keys(items[0]);
  const csvRows = [headers.join(',')];

  for (const row of items) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') {
        return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

async function exportDatabase() {
  console.log('🔄 Conectando ao Supabase e iniciando exportação de dados...\n');

  const outputDir = path.join(process.cwd(), 'backup_export');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = {};

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*');

      if (error) {
        console.log(`❌ Tabela [${table}]: Erro ao consultar -> ${error.message}`);
        summary[table] = { status: 'error', message: error.message };
      } else {
        const count = data ? data.length : 0;
        console.log(`✅ Tabela [${table}]: ${count} registros exportados.`);

        // Salva em JSON
        const jsonPath = path.join(outputDir, `${table}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

        // Salva em CSV
        if (count > 0) {
          const csvPath = path.join(outputDir, `${table}.csv`);
          fs.writeFileSync(csvPath, convertToCSV(data), 'utf-8');
        }

        summary[table] = { status: 'success', total_records: count };
      }
    } catch (err) {
      console.log(`❌ Tabela [${table}]: Exceção -> ${err.message}`);
      summary[table] = { status: 'exception', message: err.message };
    }
  }

  // Salvar resumo da exportação
  fs.writeFileSync(
    path.join(outputDir, '_summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  console.log(`\n🎉 Processo concluído! Os arquivos foram salvos na pasta:\n📁 ${outputDir}\n`);
}

exportDatabase();
