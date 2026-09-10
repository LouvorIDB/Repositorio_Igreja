import { supabase, authenticateChurch, setCors } from './_supabase.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ status: 'error', message: 'Método não permitido. Use GET.' });
        return;
    }

    const church = await authenticateChurch(req, res);
    if (!church) return;

    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);

        // Data de início (hoje no fuso local/UTC, recuando 12h para cobrir cultos de hoje em andamento)
        const dateThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

        const { data: services, error } = await supabase
            .from('services')
            .select('id, title, date, status')
            .eq('church_id', church.id)
            .neq('status', 'arquivado')
            .gte('date', dateThreshold)
            .order('date', { ascending: true })
            .limit(limit);

        if (error) throw error;

        const formattedServices = (services || []).map(s => {
            let dataStr = s.date;
            let label = s.title;
            try {
                const dt = new Date(s.date);
                const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const diaSemana = dias[dt.getDay()] || '';
                const dia = String(dt.getDate()).padStart(2, '0');
                const mes = String(dt.getMonth() + 1).padStart(2, '0');
                const hora = String(dt.getHours()).padStart(2, '0');
                const min = String(dt.getMinutes()).padStart(2, '0');
                label = ${diaSemana}, / : - ;
            } catch (e) {}

            return {
                id: s.id,
                datetime: s.date,
                title: s.title,
                label: label
            };
        });

        res.status(200).json({
            status: 'ok',
            church: { id: church.id, name: church.name },
            data: formattedServices
        });
    } catch (err) {
        console.error('Erro ao buscar cultos futuros:', err);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar cultos: ' + err.message });
    }
}
