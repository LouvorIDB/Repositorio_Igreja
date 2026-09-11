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

    const serviceId = req.query.id;
    if (!serviceId) {
        res.status(400).json({ status: 'error', message: 'ID do culto obrigatório.' });
        return;
    }

    try {
        const { data: service, error } = await supabase
            .from('services')
            .select(`
                *,
                service_media (*),
                service_songs (
                    *,
                    song_versions (
                        *,
                        songs (*)
                    )
                )
            `)
            .eq('id', serviceId)
            .eq('church_id', church.id)
            .maybeSingle();

        if (error) throw error;

        if (!service) {
            res.status(404).json({
                status: 'error',
                message: 'Culto não encontrado ou não pertence a esta congregação.'
            });
            return;
        }

        const payload = formatServicePayload(service, church);

        res.status(200).json({
            status: 'ok',
            church: { id: church.id, name: church.name },
            data: payload
        });
    } catch (err) {
        console.error('Erro ao buscar detalhes do culto:', err);
        res.status(500).json({ status: 'error', message: 'Erro ao buscar detalhes do culto: ' + err.message });
    }
}
