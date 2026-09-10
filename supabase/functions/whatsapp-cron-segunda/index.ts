import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = Deno.env.get("WHATSAPP_TOKEN") || "";
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID") || "";

  if (!token || !phoneId) {
    return Response.json(
      { error: "WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não configurados" },
      { status: 500, headers: corsHeaders }
    );
  }

  // Tratamento de requisições POST para disparos imediatos de Avisos e Testes
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body.action === "aviso" && Array.isArray(body.recipients)) {
        const resultados: any[] = [];
        for (const r of body.recipients) {
          const rawPhone = (r.phone || "").replace(/\D/g, "");
          const toPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
          const firstName = (r.name || "").split(" ")[0];
          const msg = (body.message || "").replace(/\{nome\}/g, firstName);

          try {
            const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: toPhone,
                type: "text",
                text: { preview_url: true, body: msg },
              }),
            });
            const resJson = await res.json();
            resultados.push({ name: r.name, phone: toPhone, status: res.ok ? "enviado" : "erro", meta: resJson });
            await new Promise((resolve) => setTimeout(resolve, 350));
          } catch (e: any) {
            resultados.push({ name: r.name, phone: toPhone, status: "falha", error: e.message });
          }
        }
        return Response.json({ success: true, total: body.recipients.length, resultados }, { headers: corsHeaders });
      }

      if (body.action === "teste" && body.phone) {
        const rawPhone = String(body.phone).replace(/\D/g, "");
        const toPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
        const testName = body.name || "Voluntário";
        const testMinistry = body.ministry || "Louvor";
        const testContent = body.content || body.message || "Escala de teste da semana.";

        // 1. Tenta envio com Template Oficial Aprovado na Meta (Garante entrega mesmo fora da janela de 24h)
        let res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toPhone,
            type: "template",
            template: {
              name: "escala_semanal",
              language: { code: "pt_BR" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: testName },
                    { type: "text", text: testMinistry },
                    { type: "text", text: testContent },
                  ],
                },
              ],
            },
          }),
        });

        // 2. Se o template falhar, tenta fallback para texto simples
        if (!res.ok) {
          res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: toPhone,
              type: "text",
              text: { preview_url: true, body: body.message || "Teste Liturge WhatsApp" },
            }),
          });
        }

        const resJson = await res.json();
        return Response.json({ success: res.ok, meta: resJson }, { headers: corsHeaders });
      }

      if (body.action === "acordar") {
        const ministryId = body.ministry_id;
        let config = body.config;

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Se a configuração não foi enviada completa no body, busca do banco
        if (!config && ministryId) {
          const { data: minDb } = await supabase
            .from("ministries")
            .select("id, name, whatsapp_config")
            .eq("id", ministryId)
            .single();
          config = minDb?.whatsapp_config;
        }

        if (!config || !config.active) {
          return Response.json({
            success: true,
            status: "desativado",
            message: "Configuração salva. O robô de mensagens está desativado para este ministério."
          }, { headers: corsHeaders });
        }

        // Fuso de Brasília (UTC-3) para precisão no dia da semana
        const agoraUTC = new Date();
        const agoraBrasilia = new Date(agoraUTC.getTime() - 3 * 60 * 60 * 1000);
        const diaSemanaHoje = agoraBrasilia.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua...
        const diasNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

        const diaConfigurado = typeof config.day_of_week === "number" 
          ? config.day_of_week 
          : parseInt(config.day_of_week || "1", 10);

        const ehDiaDeEnvio = diaConfigurado === diaSemanaHoje;
        const deveDisparar = ehDiaDeEnvio || body.force_dispatch === true;

        if (!deveDisparar) {
          return Response.json({
            success: true,
            status: "agendado",
            message: `Robô acordado e sincronizado! O disparo automático está agendado para toda ${diasNomes[diaConfigurado] || "Segunda-feira"} às ${config.time || "08:00"}.`
          }, { headers: corsHeaders });
        }

        // Executa o disparo completo para os voluntários escalados deste ministério
        const resultado = await executarDisparoEscalas(supabase, phoneId, token, ministryId, body.test_phone || null);

        return Response.json({
          success: true,
          status: "disparado",
          totalMembrosEscalados: resultado.totalMembrosEscalados,
          totalMensagensEnviadas: resultado.totalMensagensEnviadas,
          detalhes: resultado.detalhes,
          message: `🤖 Robô acordado com sucesso! ${resultado.totalMensagensEnviadas} mensagem(ns) de escala enviada(s) para os integrantes de ${resultado.ministryName}.`
        }, { headers: corsHeaders });
      }
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 400, headers: corsHeaders });
    }
  }

  // Parâmetro opcional para teste seguro (ex: ?test_phone=5511997787992)
  const testPhone = url.searchParams.get("test_phone");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const resultado = await executarDisparoEscalas(supabase, phoneId, token, null, testPhone);
  return Response.json(resultado, { headers: corsHeaders });
});

async function executarDisparoEscalas(
  supabase: any,
  phoneId: string,
  token: string,
  targetMinistryId?: string | null,
  testPhone?: string | null
) {
  // 1. Calcular o intervalo da semana atual (Segunda-feira 00:00 até Domingo 23:59 em UTC-3)
  const agoraUTC = new Date();
  const brasiliaTime = new Date(agoraUTC.getTime() - 3 * 60 * 60 * 1000);
  const diaSemana = brasiliaTime.getDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
  const diffSegunda = brasiliaTime.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1);

  const segunda = new Date(brasiliaTime.getFullYear(), brasiliaTime.getMonth(), diffSegunda, 0, 0, 0);
  const domingo = new Date(brasiliaTime.getFullYear(), brasiliaTime.getMonth(), diffSegunda + 6, 23, 59, 59, 999);

  console.log(`Buscando cultos entre ${segunda.toISOString()} e ${domingo.toISOString()}`);

  // 2. Buscar todos os cultos da semana com suas escalas e repertório
  const { data: services, error: servErr } = await supabase
    .from("services")
    .select(`
      id,
      title,
      date,
      notes,
      church_id,
      service_scales (
        id,
        user_id,
        status
      ),
      service_songs (
        song_order,
        song_versions (
          key,
          youtube_url,
          songs (title, artist)
        )
      )
    `)
    .gte("date", segunda.toISOString())
    .lte("date", domingo.toISOString())
    .order("date");

  if (servErr) {
    console.error("Erro ao buscar cultos da semana:", servErr);
    return {
      error: servErr.message,
      totalMembrosEscalados: 0,
      totalMensagensEnviadas: 0,
      detalhes: [],
      ministryName: "Ministério",
    };
  }

  if (!services || services.length === 0) {
    return {
      message: "Nenhum culto agendado para esta semana.",
      totalMembrosEscalados: 0,
      totalMensagensEnviadas: 0,
      detalhes: [],
      ministryName: "Ministério",
    };
  }

  // 3. Buscar informações do ministério e membros excluídos
  let ministryName = "Louvor";
  let targetChurchId: string | null = null;
  const excludedUserIds = new Set<string>();

  if (targetMinistryId) {
    const { data: minData } = await supabase
      .from("ministries")
      .select("id, name, church_id, whatsapp_config")
      .eq("id", targetMinistryId)
      .single();

    if (minData) {
      ministryName = minData.name || "Louvor";
      targetChurchId = minData.church_id || null;
      if (Array.isArray(minData.whatsapp_config?.membros_excluidos)) {
        minData.whatsapp_config.membros_excluidos.forEach((id: string) => excludedUserIds.add(id));
      }
    }
  } else {
    // Cron geral
    const { data: ministries } = await supabase
      .from("ministries")
      .select("id, whatsapp_config");

    (ministries || []).forEach((m: any) => {
      const cfg = m.whatsapp_config;
      if (cfg && Array.isArray(cfg.membros_excluidos)) {
        cfg.membros_excluidos.forEach((id: string) => excludedUserIds.add(id));
      }
    });
  }

  // 4. Buscar perfis com telefone cadastrado
  let profQuery = supabase
    .from("profiles")
    .select("id, name, phone, church_id, ministry_id, role, system_role")
    .not("phone", "is", null)
    .neq("phone", "");

  if (targetChurchId) {
    profQuery = profQuery.eq("church_id", targetChurchId);
  }

  const { data: profiles, error: profErr } = await profQuery;

  if (profErr || !profiles) {
    return {
      error: "Erro ao buscar perfis.",
      totalMembrosEscalados: 0,
      totalMensagensEnviadas: 0,
      detalhes: [],
      ministryName,
    };
  }

  // Se houver ministério alvo, filtra os membros pertencentes a ele
  let perfisFiltrados = profiles;
  if (targetMinistryId) {
    perfisFiltrados = profiles.filter((p: any) => p.ministry_id === targetMinistryId);
  }

  const profilesMap = new Map<string, any>();
  perfisFiltrados.forEach((p: any) => profilesMap.set(p.id, p));

  // 5. Agrupar escalas por voluntário deste ministério
  const escalasPorUsuario = new Map<string, { profile: any; cultos: any[] }>();

  services.forEach((serv: any) => {
    let dataFmt = "";
    let horaFmt = "";
    if (serv.date) {
      const parts = serv.date.split("T");
      const dParts = (parts[0] || "").split("-");
      if (dParts.length === 3) dataFmt = `${dParts[2]}/${dParts[1]}`;
      if (parts[1]) horaFmt = parts[1].slice(0, 5);
    }

    let tituloLimpo = serv.title || "Culto";
    tituloLimpo = tituloLimpo.replace(/^\d{2}\/\d{2}\s*-\s*/, "");

    const musicasCulto = (serv.service_songs || [])
      .sort((a: any, b: any) => (a.song_order || 0) - (b.song_order || 0))
      .map((ss: any, idx: number) => {
        const v = ss.song_versions;
        const s = v?.songs;
        return {
          ordem: idx + 1,
          titulo: s?.title || "Música",
          artista: s?.artist || "",
          tom: v?.key || "",
          yt: v?.youtube_url || "",
        };
      });

    const userIdsInScale = new Set<string>();

    (serv.service_scales || []).forEach((scale: any) => {
      const user = profilesMap.get(scale.user_id);
      if (!user || !user.phone) return;
      userIdsInScale.add(user.id);

      let role = "Integrante Escalado";
      if (serv.notes) {
        try {
          const parsed = typeof serv.notes === "string" ? JSON.parse(serv.notes) : serv.notes;
          if (parsed.escala) {
            for (const [inst, nome] of Object.entries(parsed.escala)) {
              if (typeof nome === "string" && nome.trim().length > 0) {
                const nTrim = nome.toLowerCase().trim();
                const uTrim = user.name.toLowerCase().trim();
                if (nTrim.includes(uTrim) || uTrim.includes(nTrim)) {
                  role = inst;
                  break;
                }
              }
            }
          }

          if (role === "Integrante Escalado" && parsed.cantores && Array.isArray(parsed.cantores)) {
            if (
              parsed.cantores.some(
                (c: string) =>
                  typeof c === "string" &&
                  c.trim().length > 0 &&
                  c.toLowerCase().includes(user.name.toLowerCase())
              )
            ) {
              role = "Vocalista";
            }
          }
        } catch (_) {}
      }

      if (!escalasPorUsuario.has(user.id)) {
        escalasPorUsuario.set(user.id, { profile: user, cultos: [] });
      }

      escalasPorUsuario.get(user.id)!.cultos.push({
        titulo: tituloLimpo,
        dataFmt,
        horaFmt,
        role,
        musicas: musicasCulto,
      });
    });

    // Fallback notes caso o nome esteja apenas no JSON notes
    if (serv.notes) {
      try {
        const parsed = typeof serv.notes === "string" ? JSON.parse(serv.notes) : serv.notes;
        perfisFiltrados.forEach((p: any) => {
          if (userIdsInScale.has(p.id)) return;
          if (serv.church_id && p.church_id !== serv.church_id) return;

          let role: string | null = null;
          if (parsed.escala) {
            for (const [inst, nome] of Object.entries(parsed.escala)) {
              if (typeof nome === "string" && nome.trim().length > 0) {
                const nTrim = (nome as string).toLowerCase().trim();
                const uTrim = (p.name || "").toLowerCase().trim();
                if (nTrim === uTrim || nTrim.includes(uTrim) || uTrim.includes(nTrim)) {
                  role = inst;
                  break;
                }
              }
            }
          }

          if (!role && parsed.cantores && Array.isArray(parsed.cantores)) {
            if (
              parsed.cantores.some(
                (c: string) =>
                  typeof c === "string" &&
                  c.trim().length > 0 &&
                  (c.toLowerCase().includes((p.name || "").toLowerCase()) ||
                    (p.name || "").toLowerCase().includes(c.toLowerCase()))
              )
            ) {
              role = "Vocalista";
            }
          }

          if (role) {
            userIdsInScale.add(p.id);
            if (!escalasPorUsuario.has(p.id)) {
              escalasPorUsuario.set(p.id, { profile: p, cultos: [] });
            }
            escalasPorUsuario.get(p.id)!.cultos.push({
              titulo: tituloLimpo,
              dataFmt,
              horaFmt,
              role,
              musicas: musicasCulto,
            });
          }
        });
      } catch (_) {}
    }
  });

  // 6. Montar e Disparar as Mensagens
  const relatorioEnvio: any[] = [];

  for (const [userId, item] of escalasPorUsuario.entries()) {
    const user = item.profile;
    const cleanPhone = user.phone.replace(/\D/g, "");
    const toPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    if (excludedUserIds.has(userId)) {
      console.log(`[PULADO] ${user.name} (${userId}) está na lista de exclusão.`);
      relatorioEnvio.push({
        name: user.name,
        phone: toPhone,
        cultos: item.cultos.length,
        status: "ignorado_excluido",
        motivo: "Membro removido da lista de envio automático pelo líder ou a pedido.",
      });
      continue;
    }

    if (testPhone && !toPhone.includes(testPhone.replace(/\D/g, ""))) {
      continue;
    }

    const firstName = (user.name || "").split(" ")[0] || "Voluntário";

    let corpoVariavel = "";
    item.cultos.forEach((c) => {
      corpoVariavel += `🗓️ *${c.dataFmt} (${c.horaFmt})* - ${c.titulo}\n`;
      corpoVariavel += `👉 *Sua função:* ${c.role}\n`;

      if (c.musicas.length > 0) {
        corpoVariavel += `🎵 *Músicas do Culto:*\n`;
        c.musicas.forEach((m: any) => {
          const tomStr = m.tom ? ` (Tom: ${m.tom})` : "";
          const artStr = m.artista ? ` - ${m.artista}` : "";
          const ytStr = m.yt ? `\n     ▶️ ${m.yt}` : "";
          corpoVariavel += `  ${m.ordem}. *${m.titulo}*${artStr}${tomStr}${ytStr}\n`;
        });
      } else {
        corpoVariavel += `🎵 *Músicas:* Repertório em definição.\n`;
      }
      corpoVariavel += `\n`;
    });

    let msgCompleta = `Olá, ${firstName}! Graça e paz.\n`;
    msgCompleta += `Aqui está a sua programação no ministério de ${ministryName} para esta semana:\n\n`;
    msgCompleta += corpoVariavel;
    msgCompleta += `Por favor, responda a esta mensagem com a palavra CONFIRMADO para confirmar sua presença, ou com 4 para enviar uma justificativa. Deus abençoe! 🙏 ✨`;

    try {
      let res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toPhone,
          type: "template",
          template: {
            name: "escala_semanal",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: firstName },
                  { type: "text", text: ministryName },
                  { type: "text", text: corpoVariavel.trim() },
                ],
              },
            ],
          },
        }),
      });

      if (!res.ok) {
        res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toPhone,
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: msgCompleta },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "confirmado", title: "✅ Confirmar" } },
                  { type: "reply", reply: { id: "4", title: "💬 Enviar Recado" } },
                ],
              },
            },
          }),
        });
      }

      if (!res.ok) {
        res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toPhone,
            type: "text",
            text: { preview_url: true, body: msgCompleta },
          }),
        });
      }

      const resJson = await res.json();
      relatorioEnvio.push({
        name: user.name,
        phone: toPhone,
        cultos: item.cultos.length,
        status: res.ok ? "enviado" : "erro",
        metaResponse: resJson,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e: any) {
      relatorioEnvio.push({
        name: user.name,
        phone: toPhone,
        status: "falha",
        error: e.message,
      });
    }
  }

  return {
    status: "concluido",
    ministryName,
    totalMembrosEscalados: escalasPorUsuario.size,
    totalMensagensEnviadas: relatorioEnvio.filter((r) => r.status === "enviado").length,
    detalhes: relatorioEnvio,
  };
}
