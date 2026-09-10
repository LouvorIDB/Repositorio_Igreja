import { supabase, authenticateChurch, formatServicePayload, setCors } from './_supabase.js';

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

    const queryDatetime = req.query.datetime || req.query.date;
    if (!queryDatetime) {
        res.status(400).json({ status: 'error', message: 'Parâmetro datetime obrigatório.' });
        return;
    }

    try {
        // Extrair ano, mês e dia da data recebida
        const cleanDt = String(queryDatetime).replace('T', ' ').trim();
        const datePart = cleanDt.split(' ')[0]; // YYYY-MM-DD

        // 1. Buscar todos os cultos do dia para a congregação
        const { data: services, error } = await supabase
            .from('services')
            .select(
                *,
                service_media (*),
                service_songs (
                    *,
                    song_versions (
                        *,
                        songs (*)
                    )
                )
            )
            .eq('church_id', church.id)
            .gte('date', ${datePart}T00:00:00)
            .lte('date', ${datePart}T23:59:59);

        if (error) throw error;

        if (!services || services.length === 0) {
            res.status(404).json({
                status: 'error',
                message: Nenhum culto encontrado no Liturge para a data .
            });
            return;
        }

        // Se houver mais de um culto no mesmo dia, tentar aproximar pelo horário mais próximo
        let targetService = services[0];
        if (services.length > 1 && cleanDt.includes(':')) {
            const reqTime = cleanDt.split(' ')[1] || '';
            const reqHour = parseInt(reqTime.split(':')[0] || '0', 10);

            let minDiff = 999;
            for (const s of services) {
                try {
                    const sDt = new Date(s.date);
                    const sHour = sDt.getHours();
                    const diff = Math.abs(sHour - reqHour);
                    if (diff < minDiff) {
                        minDiff = diff;
                        targetService = s;
                    }
                } catch (e) {}
            }
        }

        const payload = formatServicePayload(targetService, church);

        res.status(200).json({
            status: 'ok',
            church: { id: church.id, name: church.name },
            data: payload
        });
    } catch (err) {
        console.error('Erro ao buscar culto por data/hora:', err);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar culto: ' + err.message });
    }
}
