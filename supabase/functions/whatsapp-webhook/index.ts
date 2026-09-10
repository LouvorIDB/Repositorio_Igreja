import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "liturge_webhook_secret_2026";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. GET: Verificação da Meta ao configurar o Webhook
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFICADO COM SUCESSO PELA META!");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden: Token de verificação incorreto", { status: 403 });
  }

  // 2. POST: Mensagens Recebidas do WhatsApp
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Recebido Webhook:", JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      // Se não houver mensagem, confirma recebimento (status de leitura/entrega)
      if (!message) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // Extrai o texto da mensagem (suporta texto comum e interações por botões ou listas)
      let rawText = "";
      if (message.type === "text") {
        rawText = (message.text?.body || "").trim();
      } else if (message.type === "interactive") {
        if (message.interactive?.type === "button_reply") {
          rawText = (message.interactive.button_reply?.id || message.interactive.button_reply?.title || "").trim();
        } else if (message.interactive?.type === "list_reply") {
          rawText = (message.interactive.list_reply?.id || message.interactive.list_reply?.title || "").trim();
        }
      } else {
        // Outros formatos de mídia (áudio, imagem, figurinha)
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const sender = message.from; // Ex: "5511997787992"
      const cleanText = rawText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

      const phoneNumberId = value?.metadata?.phone_number_id || Deno.env.get("WHATSAPP_PHONE_ID");

      // Inicializa o cliente do Supabase com privilégios de Service Role
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Normaliza o telefone do remetente
      const cleanSender = sender.replace(/\D/g, ""); // Ex: 5511997787992
      const senderDigits = cleanSender.length >= 8 ? cleanSender.slice(-8) : cleanSender;

      // 1. Identificar usuário pelo telefone buscando perfis cadastrados
      const { data: allProfiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, name, church_id, phone, ministry_id")
        .not("phone", "is", null)
        .neq("phone", "");

      const user = (allProfiles || []).find((p: any) => {
        const pDigits = (p.phone || "").replace(/\D/g, "");
        if (!pDigits) return false;
        return pDigits.endsWith(senderDigits) || cleanSender.endsWith(pDigits);
      });

      // =========================================================================
      // FLUXO A: USUÁRIO NÃO CADASTRADO (VISITANTE / LEAD)
      // =========================================================================
      if (profileErr || !user) {
        console.log(`Mensagem de visitante não cadastrado (${sender}): "${rawText}"`);

        // A1. Cenário: Cadastro de Nova Igreja / Lead SaaS
        const isLeadIntent =
          cleanText.includes("cadastrar") ||
          cleanText.includes("criar") ||
          cleanText.includes("lead") ||
          cleanText.includes("plano") ||
          cleanText.includes("preco") ||
          cleanText.includes("contratar") ||
          cleanText.includes("site") ||
          cleanText === "2";

        if (isLeadIntent) {
          const hasDetails =
            cleanText.length > 6 &&
            (cleanText.includes("igreja") ||
              cleanText.includes("pastor") ||
              cleanText.includes("sou") ||
              cleanText.includes("nome"));

          if (hasDetails) {
            // Salva lead para acompanhamento no painel
            try {
              await supabase.from("availability_comments").insert({
                church_id: null,
                user_id: null,
                category: "lead",
                comment_text: `[Lead Novo WhatsApp] Contato: ${sender} | Texto: ${rawText}`,
                status: "pendente",
              });
            } catch (errLead) {
              console.warn("Aviso ao salvar lead:", errLead);
            }

            await enviarMensagemWhatsApp(
              phoneNumberId,
              sender,
              `🎉 *Muito obrigado pelo seu interesse no Liturge!*\n\nRegistramos suas informações e nossa equipe entrará em contato via WhatsApp em breve.\n\nVocê também pode conhecer mais e criar sua conta agora mesmo acessando:\n👉 https://liturge.com.br`
            );
          } else {
            await enviarMensagemWhatsApp(
              phoneNumberId,
              sender,
              `🚀 *Conheça o Liturge - Gestão Eclesiástica Inteligente!*\n\nO Liturge foi desenvolvido para transformar o louvor e os ministérios da sua igreja:\n\n✨ Escalas inteligentes e automáticas\n🎶 Repertório com cifras dinâmicas, tons e integração com Holyrics e YouTube\n📱 Disparos e confirmações automáticas pelo WhatsApp\n👥 Gestão de disponibilidade de voluntários\n\n👉 *Cadastre sua igreja gratuitamente:* https://liturge.com.br\n\nSe preferir, responda a esta mensagem com seu *Nome* e o *Nome da sua Igreja* que entraremos em contato!`
            );
          }
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // A2. Cenário: Consulta de Repertório / Tag de Igreja
        const potentialTag = cleanText
          .replace(/^[12]\s*/, "")
          .replace(/^(tag|slug|igreja|playlist|repertorio|musicas)\s*:?\s*/, "")
          .trim();

        if (cleanText === "1" || cleanText === "playlist" || cleanText === "tag" || cleanText === "repertorio") {
          await enviarMensagemWhatsApp(
            phoneNumberId,
            sender,
            `🎶 *Consultar Repertório da Semana*\n\nPor favor, digite a *tag* ou o *nome* da sua congregação (ex: *idb*, *sede*, *lagoinha*, *batista*):`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (potentialTag.length >= 2) {
          // Busca igreja por slug ou nome
          const { data: churches } = await supabase
            .from("churches")
            .select("id, name, slug")
            .or(`slug.ilike.%${potentialTag}%,name.ilike.%${potentialTag}%`)
            .limit(3);

          if (churches && churches.length > 0) {
            const church = churches[0];

            // Busca cultos da semana atual para a igreja
            const agora = new Date();
            const diaSemana = agora.getDay();
            const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
            const segunda = new Date(agora);
            segunda.setDate(agora.getDate() + diffSegunda);
            segunda.setHours(0, 0, 0, 0);

            const domingo = new Date(segunda);
            domingo.setDate(segunda.getDate() + 6);
            domingo.setHours(23, 59, 59, 999);

            const { data: cultos } = await supabase
              .from("services")
              .select(`
                id,
                title,
                date,
                service_songs (
                  song_order,
                  song_versions (
                    key,
                    youtube_url,
                    songs (title, artist)
                  )
                )
              `)
              .eq("church_id", church.id)
              .gte("date", segunda.toISOString())
              .lte("date", domingo.toISOString())
              .order("date");

            if (!cultos || cultos.length === 0) {
              await enviarMensagemWhatsApp(
                phoneNumberId,
                sender,
                `⛪ *${church.name}*\nNenhum culto cadastrado para esta semana até o momento.\nAcesse https://liturge.com.br para acompanhar as novidades!`
              );
            } else {
              let msg = `⛪ *${church.name} - Playlist da Semana*\n\n`;
              cultos.forEach((c: any) => {
                let dataFmt = "";
                let horaFmt = "";
                if (c.date) {
                  const p = c.date.split("T");
                  const dp = (p[0] || "").split("-");
                  if (dp.length === 3) dataFmt = `${dp[2]}/${dp[1]}`;
                  if (p[1]) horaFmt = p[1].slice(0, 5);
                }
                const titulo = (c.title || "Culto").replace(/^\d{2}\/\d{2}\s*-\s*/, "");
                msg += `📅 *${dataFmt} (${horaFmt}) - ${titulo}*\n`;

                const musicas = (c.service_songs || [])
                  .sort((a: any, b: any) => (a.song_order || 0) - (b.song_order || 0));

                if (musicas.length === 0) {
                  msg += `   _Músicas em definição pela equipe de louvor._\n\n`;
                } else {
                  musicas.forEach((ss: any, idx: number) => {
                    const v = ss.song_versions;
                    const s = v?.songs;
                    const tom = v?.key ? ` (Tom: ${v.key})` : "";
                    const art = s?.artist ? ` - ${s.artist}` : "";
                    const yt = v?.youtube_url ? `\n   ▶️ ${v.youtube_url}` : "";
                    msg += `${idx + 1}. *${s?.title || "Música"}*${art}${tom}${yt}\n`;
                  });
                  msg += `\n`;
                }
              });

              if (church.slug) {
                msg += `🌐 _Página da congregação:_ https://liturge.com.br/${church.slug}`;
              }

              await enviarMensagemWhatsApp(phoneNumberId, sender, msg.trim());
            }
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        // Menu de Apresentação com Botões Interativos para Visitante
        const visitorBody = `Olá! Seja muito bem-vindo(a) ao *Liturge*! 👋\n\nNão encontramos o seu telefone vinculado a nenhuma congregação no sistema.\n\nComo posso te ajudar hoje?`;
        const visitorFallback = `Olá! Seja muito bem-vindo(a) ao *Liturge*! 👋\n\nNão encontramos o seu telefone vinculado a nenhuma igreja no sistema.\n\nComo posso te ajudar hoje?\n\n1️⃣ Digite *1* ou a *tag da sua igreja* para consultar a playlist dos cultos desta semana.\n2️⃣ Digite *2* ou *cadastrar* para conhecer o Liturge e cadastrar sua igreja gratuitamente.\n\n💡 _Se você já é membro da equipe de louvor, solicite ao líder para cadastrar o seu telefone no perfil do Liturge._`;

        await enviarBotoesWhatsApp(
          phoneNumberId,
          sender,
          visitorBody,
          [
            { id: "vis_1", title: "🎶 Ver Repertório" },
            { id: "vis_2", title: "🚀 Cadastrar Igreja" },
          ],
          visitorFallback
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // =========================================================================
      // FLUXO B: MEMBRO CADASTRADO (RECONHECIDO PELO TELEFONE)
      // =========================================================================
      const churchId = user.church_id;

      // B0. MÁQUINA DE ESTADOS: VERIFICA SE O MEMBRO POSSUI RASCUNHO DE RECADO ATIVO
      // Se o usuário digitou '4' anteriormente, a mensagem atual é o recado!
      const { data: activeDrafts } = await supabase
        .from("availability_comments")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("status", "aguardando_texto")
        .order("created_at", { ascending: false })
        .limit(1);

      if (activeDrafts && activeDrafts.length > 0) {
        const draft = activeDrafts[0];
        const draftAgeMin = (Date.now() - new Date(draft.created_at).getTime()) / (1000 * 60);

        if (draftAgeMin > 30) {
          // Rascunho expirou (mais de 30 min sem envio)
          await supabase.from("availability_comments").delete().eq("id", draft.id);
        } else if (
          cleanText === "cancelar" ||
          cleanText === "cancela" ||
          cleanText === "0" ||
          cleanText === "sair" ||
          cleanText === "voltar"
        ) {
          // Voluntário optou por cancelar o envio do recado
          await supabase.from("availability_comments").delete().eq("id", draft.id);
          await enviarMensagemWhatsApp(
            phoneNumberId,
            sender,
            `❌ *Envio cancelado!*\n\nComo posso te ajudar agora? Escolha uma das opções abaixo:`
          );
          await enviarMenuPrincipalMembro(phoneNumberId, sender, user);
          return new Response("EVENT_RECEIVED", { status: 200 });
        } else {
          // O texto recebido É O RECADO!
          const recadoTexto = rawText.trim();

          // 1. Atualiza o rascunho para pendente
          await supabase
            .from("availability_comments")
            .update({
              category: "whatsapp",
              comment_text: recadoTexto,
              status: "pendente",
            })
            .eq("id", draft.id);

          // 2. Identifica líder ou admin da congregação (excluindo o remetente)
          let leaderPhone: string | null = null;
          let ministryId = user.ministry_id;

          if (ministryId) {
            const { data: leaders } = await supabase
              .from("ministry_leaders")
              .select("profiles:profile_id(id, name, phone)")
              .eq("ministry_id", ministryId);
            const foundLeader = leaders?.find(
              (l: any) => l.profiles?.phone && l.profiles?.id !== user.id
            );
            if (foundLeader?.profiles?.phone) {
              leaderPhone = foundLeader.profiles.phone;
            }
          }

          if (!leaderPhone && churchId) {
            const { data: admins } = await supabase
              .from("profiles")
              .select("id, name, phone")
              .eq("church_id", churchId)
              .in("system_role", ["admin", "superadmin", "lider"])
              .neq("id", user.id)
              .not("phone", "is", null)
              .limit(1);
            if (admins && admins.length > 0 && admins[0].phone) {
              leaderPhone = admins[0].phone;
            }
          }

          // Notifica liderança via WhatsApp
          if (leaderPhone) {
            const cleanLeader = leaderPhone.replace(/\D/g, "");
            const fLeader = cleanLeader.startsWith("55") ? cleanLeader : `55${cleanLeader}`;
            const leaderMsg = `🔔 *Nova Mensagem de Voluntário no Liturge*\n\n👤 *De:* ${user.name}\n📱 *WhatsApp:* wa.me/${cleanSender}\n💬 *Mensagem:*\n\"${recadoTexto}\"\n\n👉 Acesse o Liturge na aba *Solicitações* ou responda diretamente ao voluntário.`;
            await enviarMensagemWhatsApp(phoneNumberId, fLeader, leaderMsg);
          }

          // Confirmação acolhedora com botões de retorno
          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `✅ *Recado enviado com sucesso!*\n\nOlá, *${user.name}*, sua mensagem foi registrada na aba *Solicitações* do Liturge e a liderança foi notificada.\n\nObrigado pelo contato! 🙏`,
            [
              { id: "1", title: "🗓️ Minhas Escalas" },
              { id: "2", title: "🎵 Próximo Culto" },
            ],
            `✅ *Recado enviado com sucesso!*\n\nOlá, *${user.name}*, sua mensagem foi registrada no sistema e a liderança foi notificada.\n\nObrigado pelo contato! 🙏`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      }

      // B0. Solicitação de Saída/Remoção da Lista Automática (Opt-out / Opt-in)
      const isOptOut =
        cleanText === "parar" ||
        cleanText === "sair" ||
        cleanText === "cancelar" ||
        cleanText === "pausar" ||
        cleanText === "remover" ||
        cleanText.includes("nao quero receber") ||
        cleanText.includes("remover da lista");

      const isOptIn =
        cleanText === "ativar" ||
        cleanText === "reativar" ||
        cleanText.includes("voltar a receber") ||
        cleanText.includes("quero receber");

      if (isOptOut || isOptIn) {
        // Localiza ministério do voluntário
        let minId = user.ministry_id;
        if (!minId) {
          const { data: umr } = await supabase
            .from("user_ministry_roles")
            .select("ministry_roles(ministry_id)")
            .eq("profile_id", user.id)
            .limit(1);
          if (umr && umr[0]?.ministry_roles?.ministry_id) {
            minId = umr[0].ministry_roles.ministry_id;
          }
        }

        let targetMinistries: any[] = [];
        if (minId) {
          const { data: mData } = await supabase
            .from("ministries")
            .select("id, whatsapp_config")
            .eq("id", minId);
          if (mData) targetMinistries = mData;
        } else if (churchId) {
          const { data: mData } = await supabase
            .from("ministries")
            .select("id, whatsapp_config")
            .eq("church_id", churchId);
          if (mData) targetMinistries = mData;
        }

        for (const m of targetMinistries) {
          const cfg = m.whatsapp_config || {};
          let excluidos: string[] = Array.isArray(cfg.membros_excluidos)
            ? [...cfg.membros_excluidos]
            : [];

          if (isOptOut) {
            if (!excluidos.includes(user.id)) excluidos.push(user.id);
          } else {
            excluidos = excluidos.filter((id) => id !== user.id);
          }

          cfg.membros_excluidos = excluidos;
          await supabase
            .from("ministries")
            .update({ whatsapp_config: cfg })
            .eq("id", m.id);
        }

        if (isOptOut) {
          await enviarMensagemWhatsApp(
            phoneNumberId,
            sender,
            `✅ *Você foi removido da lista de mensagens automáticas!*\n\nOlá, *${user.name}*, você não receberá mais os lembretes semanais de escala.\n\nCaso queira voltar a receber no futuro, basta responder *\"ATIVAR\"* nesta conversa. 🙏`
          );
        } else {
          await enviarMensagemWhatsApp(
            phoneNumberId,
            sender,
            `🎉 *Mensagens automáticas reativadas!*\n\nOlá, *${user.name}*, você voltará a receber a notificação semanal da sua escala e repertório normalmente! 🎶`
          );
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B1. Confirmação de Presença na Escala
      const isConfirmacao =
        cleanText === "confirmado" ||
        cleanText === "sim" ||
        cleanText === "confirmo" ||
        cleanText === "confirmar" ||
        cleanText === "ok" ||
        cleanText === "estarei la" ||
        cleanText === "estarei la!" ||
        cleanText.includes("presenca confirmada") ||
        cleanText.includes("pode confirmar");

      if (isConfirmacao) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Busca escalas em service_scales
        const { data: escalas } = await supabase
          .from("service_scales")
          .select(`
            id,
            status,
            services:service_id (id, title, date)
          `)
          .eq("user_id", user.id);

        const proximas = (escalas || [])
          .filter((e: any) => e.services?.date && new Date(e.services.date) >= hoje)
          .sort(
            (a: any, b: any) =>
              new Date(a.services.date).getTime() - new Date(b.services.date).getTime()
          );

        if (proximas.length > 0) {
          const alvo = proximas[0];
          await supabase
            .from("service_scales")
            .update({ status: "confirmado" })
            .eq("id", alvo.id);

          let dataFmt = "";
          if (alvo.services?.date) {
            const p = alvo.services.date.split("T");
            const dp = (p[0] || "").split("-");
            if (dp.length === 3) dataFmt = `${dp[2]}/${dp[1]}`;
          }
          const titulo = (alvo.services?.title || "Culto").replace(/^\d{2}\/\d{2}\s*-\s*/, "");

          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `🎉 *Presença Confirmada!*\nOlá, *${user.name}*! Sua presença foi confirmada com sucesso para o culto de *${dataFmt}* (${titulo}).\n\nBom ensaio e que Deus abençoe seu ministério! 🙏`,
            [
              { id: "2", title: "🎵 Ver Playlist" },
              { id: "1", title: "🗓️ Minhas Escalas" },
            ]
          );
        } else {
          // Fallback: se estiver agendado via notes no culto mais próximo
          let nextFound = false;
          if (churchId) {
            const { data: upcomingServices } = await supabase
              .from("services")
              .select("id, title, date, notes")
              .eq("church_id", churchId)
              .gte("date", hoje.toISOString())
              .order("date")
              .limit(5);

            for (const serv of upcomingServices || []) {
              if (serv.notes) {
                try {
                  const p = typeof serv.notes === "string" ? JSON.parse(serv.notes) : serv.notes;
                  const isScheduled =
                    (p.escala && Object.values(p.escala).some((n: any) => typeof n === "string" && (n.toLowerCase().includes(user.name.toLowerCase()) || user.name.toLowerCase().includes(n.toLowerCase())))) ||
                    (p.cantores && Array.isArray(p.cantores) && p.cantores.some((c: string) => typeof c === "string" && (c.toLowerCase().includes(user.name.toLowerCase()) || user.name.toLowerCase().includes(c.toLowerCase()))));

                  if (isScheduled) {
                    await supabase.from("service_scales").insert({
                      church_id: churchId,
                      service_id: serv.id,
                      user_id: user.id,
                      status: "confirmado",
                    });

                    let dataFmt = "";
                    if (serv.date) {
                      const sp = serv.date.split("T");
                      const sdp = (sp[0] || "").split("-");
                      if (sdp.length === 3) dataFmt = `${sdp[2]}/${sdp[1]}`;
                    }
                    const titulo = (serv.title || "Culto").replace(/^\d{2}\/\d{2}\s*-\s*/, "");

                    await enviarBotoesWhatsApp(
                      phoneNumberId,
                      sender,
                      `🎉 *Presença Confirmada!*\nOlá, *${user.name}*! Sua presença foi confirmada com sucesso para o culto de *${dataFmt}* (${titulo}).\n\nBom ensaio e que Deus abençoe seu ministério! 🙏`,
                      [
                        { id: "2", title: "🎵 Ver Playlist" },
                        { id: "1", title: "🗓️ Minhas Escalas" },
                      ]
                    );
                    nextFound = true;
                    break;
                  }
                } catch (_) {}
              }
            }
          }

          if (!nextFound) {
            await enviarBotoesWhatsApp(
              phoneNumberId,
              sender,
              `Olá, *${user.name}*! Você não possui escalas pendentes para confirmação no momento. Tudo certo por aqui! 👍`,
              [
                { id: "1", title: "🗓️ Minhas Escalas" },
                { id: "2", title: "🎵 Próximo Culto" },
              ]
            );
          }
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B2. Opção 1: Meus Dias Escalados no Mês
      if (
        cleanText === "1" ||
        cleanText === "opt_1" ||
        cleanText.includes("escala") ||
        cleanText.includes("mes") ||
        cleanText.includes("toco") ||
        cleanText.includes("canto") ||
        cleanText.includes("dias")
      ) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = agora.getMonth();
        const primeiroDia = new Date(ano, mes, 1, 0, 0, 0);
        const ultimoDia = new Date(ano, mes + 1, 0, 23, 59, 59);

        // 1. Busca em service_scales (sem a coluna inexistente role_name!)
        const { data: escalas, error: escErr } = await supabase
          .from("service_scales")
          .select(`
            id,
            status,
            services:service_id (id, title, date, notes)
          `)
          .eq("user_id", user.id);

        if (escErr) {
          console.error("Erro ao buscar escalas:", escErr);
        }

        // Mapa consolidado de cultos para evitar duplicidade
        const cultosMap = new Map<string, any>();

        (escalas || []).forEach((e: any) => {
          const serv = e.services;
          if (!serv?.date) return;
          const d = new Date(serv.date);
          if (d >= primeiroDia && d <= ultimoDia) {
            cultosMap.set(serv.id, {
              id: serv.id,
              scaleId: e.id,
              title: serv.title,
              date: serv.date,
              notes: serv.notes,
              status: e.status || "pendente",
              role: "Escalado",
            });
          }
        });

        // 2. Busca cultos do mês da congregação para capturar notas em JSON
        if (churchId) {
          const { data: servsMes } = await supabase
            .from("services")
            .select("id, title, date, notes")
            .eq("church_id", churchId)
            .gte("date", primeiroDia.toISOString())
            .lte("date", ultimoDia.toISOString());

          (servsMes || []).forEach((serv: any) => {
            if (cultosMap.has(serv.id)) {
              const existente = cultosMap.get(serv.id);
              if (!existente.notes && serv.notes) existente.notes = serv.notes;
              return;
            }

            if (serv.notes) {
              try {
                const parsed = typeof serv.notes === "string" ? JSON.parse(serv.notes) : serv.notes;
                let found = false;
                if (parsed.escala) {
                  for (const [, nome] of Object.entries(parsed.escala)) {
                    if (typeof nome === "string" && nome.trim().length > 0) {
                      const nTrim = (nome as string).toLowerCase().trim();
                      const uTrim = user.name.toLowerCase().trim();
                      if (nTrim === uTrim || nTrim.includes(uTrim) || uTrim.includes(nTrim)) {
                        found = true;
                        break;
                      }
                    }
                  }
                }
                if (!found && parsed.cantores && Array.isArray(parsed.cantores)) {
                  if (
                    parsed.cantores.some(
                      (c: string) =>
                        typeof c === "string" &&
                        c.trim().length > 0 &&
                        (c.toLowerCase().includes(user.name.toLowerCase()) ||
                          user.name.toLowerCase().includes(c.toLowerCase()))
                    )
                  ) {
                    found = true;
                  }
                }
                if (found) {
                  cultosMap.set(serv.id, {
                    id: serv.id,
                    title: serv.title,
                    date: serv.date,
                    notes: serv.notes,
                    status: "pendente",
                    role: "Escalado",
                  });
                }
              } catch (_) {}
            }
          });
        }

        const listaCultos = Array.from(cultosMap.values()).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        if (listaCultos.length === 0) {
          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `Olá, *${user.name}*! 📅\nVocê não possui escalas agendadas para este mês até o momento.`,
            [
              { id: "2", title: "🎵 Próximo Culto" },
              { id: "4", title: "💬 Enviar Recado" },
            ]
          );
        } else {
          let msg = `📅 *Suas Escalas deste Mês - Liturge*\nOlá, *${user.name}*! Aqui estão os seus cultos:\n\n`;

          listaCultos.forEach((c: any) => {
            let dataFmt = "";
            let horaFmt = "";
            if (c.date) {
              const parts = c.date.split("T");
              const dParts = (parts[0] || "").split("-");
              if (dParts.length === 3) dataFmt = `${dParts[2]}/${dParts[1]}`;
              if (parts[1]) horaFmt = parts[1].slice(0, 5);
            }

            let role = "Escalado";
            if (c.notes) {
              try {
                const parsed = typeof c.notes === "string" ? JSON.parse(c.notes) : c.notes;
                if (parsed.escala) {
                  for (const [inst, nome] of Object.entries(parsed.escala)) {
                    if (typeof nome === "string" && nome.trim().length > 0) {
                      const nTrim = (nome as string).toLowerCase().trim();
                      const uTrim = user.name.toLowerCase().trim();
                      if (nTrim === uTrim || nTrim.includes(uTrim) || uTrim.includes(nTrim)) {
                        role = inst;
                        break;
                      }
                    }
                  }
                }
                if (role === "Escalado" && parsed.cantores && Array.isArray(parsed.cantores)) {
                  if (
                    parsed.cantores.some(
                      (s: string) =>
                        typeof s === "string" &&
                        s.trim().length > 0 &&
                        (s.toLowerCase().includes(user.name.toLowerCase()) ||
                          user.name.toLowerCase().includes(s.toLowerCase()))
                    )
                  ) {
                    role = "Vocalista";
                  }
                }
              } catch (_) {}
            }

            let titulo = c.title || "Culto";
            titulo = titulo.replace(/^\d{2}\/\d{2}\s*-\s*/, "");
            const statusBadge = c.status === "confirmado" ? "✅ Confirmado" : "⏳ Pendente";

            msg += `• *${dataFmt}* (${horaFmt}) - ${titulo}\n  👉 *Função:* ${role} (${statusBadge})\n\n`;
          });

          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            msg.trim(),
            [
              { id: "confirmado", title: "✅ Confirmar Presença" },
              { id: "2", title: "🎵 Ver Playlist" },
              { id: "4", title: "💬 Enviar Recado" },
            ],
            msg.trim() + `\n\n💡 _Para confirmar o próximo culto, responda *\"Confirmado\"* ou digite *4* para mandar recado._`
          );
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B3. Opção 2: Playlist do Próximo Culto
      if (
        cleanText === "2" ||
        cleanText === "opt_2" ||
        cleanText.includes("playlist") ||
        cleanText.includes("proximo") ||
        cleanText.includes("culto")
      ) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Prioriza o próximo culto em que o usuário está escalado
        const { data: userEscalas } = await supabase
          .from("service_scales")
          .select("service_id, services:service_id(id, title, date)")
          .eq("user_id", user.id);

        const proximasDoUser = (userEscalas || [])
          .filter((e: any) => e.services?.date && new Date(e.services.date) >= hoje)
          .sort(
            (a: any, b: any) =>
              new Date(a.services.date).getTime() - new Date(b.services.date).getTime()
          );

        let targetServiceId = proximasDoUser[0]?.services?.id;

        // Se não estiver escalado em nenhum próximo, pega o próximo culto geral da igreja
        if (!targetServiceId && churchId) {
          const { data: proximosIgreja } = await supabase
            .from("services")
            .select("id, date")
            .eq("church_id", churchId)
            .gte("date", hoje.toISOString())
            .order("date")
            .limit(1);
          targetServiceId = proximosIgreja?.[0]?.id;
        }

        if (!targetServiceId) {
          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `Olá, *${user.name}*! Não encontramos cultos agendados para os próximos dias na sua congregação.`,
            [
              { id: "1", title: "🗓️ Minhas Escalas" },
              { id: "4", title: "💬 Enviar Recado" },
            ]
          );
        } else {
          const { data: servCompleto } = await supabase
            .from("services")
            .select(`
              id,
              title,
              date,
              service_songs (
                song_order,
                song_versions (
                  key,
                  youtube_url,
                  songs (title, artist)
                )
              )
            `)
            .eq("id", targetServiceId)
            .single();

          let dataFmt = "";
          let horaFmt = "";
          if (servCompleto?.date) {
            const p = servCompleto.date.split("T");
            const dp = (p[0] || "").split("-");
            if (dp.length === 3) dataFmt = `${dp[2]}/${dp[1]}`;
            if (p[1]) horaFmt = p[1].slice(0, 5);
          }
          const titulo = (servCompleto?.title || "Culto").replace(/^\d{2}\/\d{2}\s*-\s*/, "");

          const musicas = (servCompleto?.service_songs || [])
            .sort((a: any, b: any) => (a.song_order || 0) - (b.song_order || 0));

          if (musicas.length === 0) {
            await enviarBotoesWhatsApp(
              phoneNumberId,
              sender,
              `📅 *Próximo Culto:* *${titulo}* (${dataFmt} às ${horaFmt})\n\nAs músicas deste culto ainda não foram adicionadas pela liderança. Fique atento às novidades no Liturge! 🎵`,
              [
                { id: "confirmado", title: "✅ Confirmar Presença" },
                { id: "1", title: "🗓️ Minhas Escalas" },
              ]
            );
          } else {
            let msg = `🎵 *Playlist do Próximo Culto - Liturge*\n⛪ *${titulo}* - ${dataFmt} às ${horaFmt}\n\n`;
            musicas.forEach((ss: any, idx: number) => {
              const v = ss.song_versions;
              const s = v?.songs;
              const tom = v?.key ? ` (Tom: ${v.key})` : "";
              const art = s?.artist ? ` - ${s.artist}` : "";
              const yt = v?.youtube_url ? `\n   ▶️ ${v.youtube_url}` : "";
              msg += `${idx + 1}. *${s?.title || "Música"}*${art}${tom}${yt}\n\n`;
            });
            msg += `👉 _Acesse o Liturge para consultar cifras e detalhes completos!_`;

            await enviarBotoesWhatsApp(
              phoneNumberId,
              sender,
              msg.trim(),
              [
                { id: "confirmado", title: "✅ Confirmar Presença" },
                { id: "1", title: "🗓️ Minhas Escalas" },
                { id: "4", title: "💬 Enviar Recado" },
              ],
              msg.trim()
            );
          }
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B4. Opção 3: Músicas Novas no Repertório
      if (
        cleanText === "3" ||
        cleanText === "opt_3" ||
        cleanText.includes("nova") ||
        cleanText.includes("novas") ||
        cleanText.includes("aprendizado")
      ) {
        const { data: musicasNovas, error: songErr } = await supabase
          .from("songs")
          .select(`
            id,
            title,
            artist,
            status,
            song_versions (key, youtube_url)
          `)
          .eq("church_id", churchId)
          .eq("status", "nova")
          .limit(10);

        if (songErr) {
          console.error("Erro ao buscar músicas novas:", songErr);
        }

        if (!musicasNovas || musicasNovas.length === 0) {
          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `🎶 *Músicas Novas - Liturge*\nNão há músicas marcadas como 'novas' no repertório da sua igreja no momento.`,
            [
              { id: "2", title: "🎵 Próximo Culto" },
              { id: "1", title: "🗓️ Minhas Escalas" },
            ]
          );
        } else {
          let msg = `🎶 *Músicas Novas do Repertório*\nConfira as novidades para ensaiar:\n\n`;
          musicasNovas.forEach((m: any, idx: number) => {
            const versao = m.song_versions?.[0];
            const yt = versao?.youtube_url ? `\n   ▶️ ${versao.youtube_url}` : "";
            const tom = versao?.key ? ` (Tom: ${versao.key})` : "";
            msg += `${idx + 1}. *${m.title}*${m.artist ? " - " + m.artist : ""}${tom}${yt}\n\n`;
          });

          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            msg.trim(),
            [
              { id: "2", title: "🎵 Playlist Culto" },
              { id: "1", title: "🗓️ Minhas Escalas" },
            ],
            msg.trim()
          );
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B5. Opção 4: Enviar Comentário / Justificativa para a Liderança
      if (
        cleanText === "4" ||
        cleanText === "opt_4" ||
        cleanText.startsWith("recado") ||
        cleanText.startsWith("comentario") ||
        cleanText.startsWith("justificativa") ||
        cleanText.startsWith("aviso") ||
        cleanText.includes("nao vou poder") ||
        cleanText.includes("imprevisto") ||
        cleanText.includes("falta")
      ) {
        if (
          cleanText === "4" ||
          cleanText === "opt_4" ||
          cleanText === "recado" ||
          cleanText === "comentario" ||
          cleanText === "justificativa" ||
          cleanText === "aviso"
        ) {
          // Cria o rascunho ativo no banco de dados aguardando a mensagem subsequente do voluntário
          try {
            await supabase.from("availability_comments").insert({
              church_id: user.church_id,
              user_id: user.id,
              category: "whatsapp_draft",
              comment_text: "Aguardando mensagem...",
              status: "aguardando_texto",
            });
          } catch (errDraft) {
            console.error("Erro ao inserir draft de comentário:", errDraft);
          }

          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `💬 *Enviar Mensagem para a Liderança*\n\nPor favor, digite a sua justificativa ou recado na próxima mensagem. Ela será registrada no Liturge e enviada imediatamente para a liderança!`,
            [{ id: "cancelar", title: "❌ Cancelar" }],
            `💬 *Enviar Mensagem para a Liderança*\n\nPor favor, digite a sua justificativa ou recado na próxima mensagem. Ela será registrada no Liturge e enviada imediatamente para a liderança!\n\n_(Para cancelar, digite *cancelar* ou *0*)_`
          );
        } else {
          let recadoTexto = rawText
            .replace(/^[4\s\-:.]+/g, "")
            .replace(/^(opt_4|recado|comentario|justificativa|aviso)\s*:?\s*/i, "")
            .trim();
          if (!recadoTexto) recadoTexto = rawText;

          // Salva direto em availability_comments
          try {
            await supabase.from("availability_comments").insert({
              church_id: user.church_id,
              user_id: user.id,
              category: "whatsapp",
              comment_text: recadoTexto,
              status: "pendente",
            });
          } catch (errComm) {
            console.error("Erro ao inserir em availability_comments:", errComm);
          }

          // Identifica o líder ou administrador da igreja para notificação (excluindo o remetente)
          let leaderPhone: string | null = null;
          let ministryId = user.ministry_id;

          if (ministryId) {
            const { data: leaders } = await supabase
              .from("ministry_leaders")
              .select("profiles:profile_id(id, name, phone)")
              .eq("ministry_id", ministryId);
            const foundLeader = leaders?.find(
              (l: any) => l.profiles?.phone && l.profiles?.id !== user.id
            );
            if (foundLeader?.profiles?.phone) {
              leaderPhone = foundLeader.profiles.phone;
            }
          }

          if (!leaderPhone && churchId) {
            const { data: admins } = await supabase
              .from("profiles")
              .select("id, name, phone")
              .eq("church_id", churchId)
              .in("system_role", ["admin", "superadmin", "lider"])
              .neq("id", user.id)
              .not("phone", "is", null)
              .limit(1);
            if (admins && admins.length > 0 && admins[0].phone) {
              leaderPhone = admins[0].phone;
            }
          }

          // Notifica líder via WhatsApp
          if (leaderPhone) {
            const cleanLeader = leaderPhone.replace(/\D/g, "");
            const fLeader = cleanLeader.startsWith("55") ? cleanLeader : `55${cleanLeader}`;
            const leaderMsg = `🔔 *Nova Mensagem de Voluntário no Liturge*\n\n👤 *De:* ${user.name}\n📱 *WhatsApp:* wa.me/${cleanSender}\n💬 *Mensagem:*\n\"${recadoTexto}\"\n\n👉 Acesse o Liturge na aba *Solicitações* ou responda diretamente ao voluntário.`;
            await enviarMensagemWhatsApp(phoneNumberId, fLeader, leaderMsg);
          }

          // Responde ao voluntário
          await enviarBotoesWhatsApp(
            phoneNumberId,
            sender,
            `✅ *Recado enviado com sucesso!*\n\nOlá, *${user.name}*, sua mensagem foi registrada no sistema Liturge e a liderança foi notificada.\n\nObrigado pelo contato! 🙏`,
            [
              { id: "1", title: "🗓️ Minhas Escalas" },
              { id: "2", title: "🎵 Próximo Culto" },
            ]
          );
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // B6. Menu Padrão Interativo para Membros
      await enviarMenuPrincipalMembro(phoneNumberId, sender, user);
      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      console.error("Erro no processamento do webhook:", err);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

/**
 * Envia o Menu Principal do Membro via Lista Interativa com fallback para texto
 */
async function enviarMenuPrincipalMembro(phoneNumberId: string, to: string, user: any) {
  const bodyText = `Olá, *${user.name}*! Sou o assistente virtual do *Liturge* 🎶\n\nComo posso te ajudar hoje?\n\nToque no botão abaixo para escolher uma opção ou digite o número correspondente:`;

  const fallbackText = `Olá, *${user.name}*! Sou o assistente virtual do *Liturge* 🎶\n\nComo posso te ajudar hoje?\n\n1️⃣ Digite *1* para consultar suas escalas do mês.\n2️⃣ Digite *2* para ver a playlist do próximo culto.\n3️⃣ Digite *3* para ouvir as músicas novas no YouTube.\n4️⃣ Digite *4* para enviar um recado/justificativa para a liderança.\n\n💡 *Dica:* Ao receber a escala semanal na segunda-feira, responda *\"Confirmado\"* para confirmar sua presença!`;

  await enviarListaWhatsApp(
    phoneNumberId,
    to,
    bodyText,
    "📋 Ver Opções",
    [
      {
        title: "Menu Liturge",
        rows: [
          {
            id: "1",
            title: "🗓️ Minhas Escalas",
            description: "Seus cultos e funções no mês",
          },
          {
            id: "2",
            title: "🎵 Próximo Culto",
            description: "Playlist, cifras e YouTube",
          },
          {
            id: "3",
            title: "🌟 Músicas Novas",
            description: "Novidades do repertório para ensaio",
          },
          {
            id: "4",
            title: "💬 Enviar Recado",
            description: "Avisar o líder ou justificar falta",
          },
        ],
      },
    ],
    fallbackText
  );
}

/**
 * Envio de Mensagem de Texto Simples
 */
async function enviarMensagemWhatsApp(
  phoneNumberId: string,
  to: string,
  text: string
) {
  const token = Deno.env.get("WHATSAPP_TOKEN") || "";
  const phoneId = phoneNumberId || Deno.env.get("WHATSAPP_PHONE_ID") || "";
  if (!token || !phoneId) {
    console.warn("WhatsApp Token ou Phone Number ID ausentes.");
    return;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
          text: { preview_url: text.includes("http"), body: text },
        }),
      }
    );
    const resJson = await res.json();
    console.log("Resposta envio WhatsApp (Texto):", resJson);
  } catch (e) {
    console.error("Erro ao enviar mensagem WhatsApp:", e);
  }
}

/**
 * Envio de Botões Interativos (Quick Reply Buttons - até 3 botões) com Fallback
 */
async function enviarBotoesWhatsApp(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  fallbackText?: string
) {
  const token = Deno.env.get("WHATSAPP_TOKEN") || "";
  const phoneId = phoneNumberId || Deno.env.get("WHATSAPP_PHONE_ID") || "";
  if (!token || !phoneId) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: bodyText },
            action: {
              buttons: buttons.slice(0, 3).map((b) => ({
                type: "reply",
                reply: {
                  id: b.id,
                  title: b.title.slice(0, 20),
                },
              })),
            },
          },
        }),
      }
    );
    const resJson = await res.json();
    console.log("Resposta envio WhatsApp (Botões):", resJson);

    if (!res.ok && fallbackText) {
      console.warn("Falha no envio de botões interativos, disparando fallback textual...");
      await enviarMensagemWhatsApp(phoneId, to, fallbackText);
    }
  } catch (err) {
    console.error("Erro ao enviar botões interativos:", err);
    if (fallbackText) {
      await enviarMensagemWhatsApp(phoneId, to, fallbackText);
    }
  }
}

/**
 * Envio de Lista Interativa (Interactive List Message - até 10 opções) com Fallback
 */
async function enviarListaWhatsApp(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  fallbackText?: string
) {
  const token = Deno.env.get("WHATSAPP_TOKEN") || "";
  const phoneId = phoneNumberId || Deno.env.get("WHATSAPP_PHONE_ID") || "";
  if (!token || !phoneId) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "interactive",
          interactive: {
            type: "list",
            header: { type: "text", text: "Liturge 🎶" },
            body: { text: bodyText },
            footer: { text: "Toque abaixo para escolher" },
            action: {
              button: buttonText.slice(0, 20),
              sections: sections.map((sec) => ({
                title: sec.title.slice(0, 24),
                rows: sec.rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: r.title.slice(0, 24),
                  description: r.description ? r.description.slice(0, 72) : undefined,
                })),
              })),
            },
          },
        }),
      }
    );
    const resJson = await res.json();
    console.log("Resposta envio WhatsApp (Lista):", resJson);

    if (!res.ok && fallbackText) {
      console.warn("Falha no envio de lista interativa, disparando fallback textual...");
      await enviarMensagemWhatsApp(phoneId, to, fallbackText);
    }
  } catch (err) {
    console.error("Erro ao enviar lista interativa:", err);
    if (fallbackText) {
      await enviarMensagemWhatsApp(phoneId, to, fallbackText);
    }
  }
}
