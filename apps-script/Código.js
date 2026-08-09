/** @OnlyCurrentDoc */

// 1. MENU SUPERIOR
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⛪ Ministério')
      .addItem('Gerar Novo Culto', 'gerarBlocoCulto')
      .addSeparator()
      .addItem('Arquivar Seleção no Histórico', 'salvarNoHistorico')
      .addItem('Limpar Aba de Playlists', 'limparPlanilhaPrincipal')
      .addSeparator()
      .addItem('Sincronizar Drive', 'sincronizarArquivosDrive')
      .addToUi();
}

function gerarBlocoCulto() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('PromptCulto')
        .setWidth(350).setHeight(300).setTitle('Organizador de Louvor');
    SpreadsheetApp.getUi().showModalDialog(html, ' ');
  } catch (e) {
    SpreadsheetApp.getUi().alert("Erro ao abrir janela: " + e.message);
  }
}

function processarEscolha(tipo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const startRow = lastRow + 2;

  let numMusicas, cores;
  if (tipo === 'DOMINGO') {
    numMusicas = 6;
    cores = { header: "#34a853", light: "#e6f4ea", dark: "#ceead6" };
  } else if (tipo === 'QUARTA') {
    numMusicas = 4;
    cores = { header: "#4285f4", light: "#e8f0fe", dark: "#d2e3fc" };
  } else {
    numMusicas = 5;
    cores = { header: "#ea4335", light: "#fce8e6", dark: "#fad2cf" };
  }

  const proximaData = buscarProximaData(sheet, tipo);

  // Cabeçalho — agora 7 colunas (A:G)
  // Col F = instrumentos (JSON), Col G = cantores do culto
  sheet.getRange(startRow, 1, 1, 5).merge()
    .setValue(proximaData + " - CULTO DE " + tipo)
    .setBackground(cores.header).setFontColor("white").setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  // Linhas de música — 7 colunas (A:G)
  // Col G de cada linha = cantores da música
  const musicRange = sheet.getRange(startRow + 1, 1, numMusicas, 7);
  const backgrounds = [];
  for (let i = 0; i < numMusicas; i++) {
    const cor = (i % 2 === 0) ? cores.light : cores.dark;
    backgrounds.push([cor, cor, cor, cor, cor, cor, cor]);
  }
  musicRange.setBackgrounds(backgrounds)
    .setBorder(true, true, true, true, true, true, "#ffffff", SpreadsheetApp.BorderStyle.SOLID);

  try {
    const listaTons = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B",
      "Cm","C#m","Dm","D#m","Em","Fm","F#m","Gm","G#m","Am","A#m","Bm"];
    const validacaoTons = SpreadsheetApp.newDataValidation().requireValueInList(listaTons).build();
    sheet.getRange(startRow + 1, 2, numMusicas, 1).setDataValidation(validacaoTons);

    const listaAlteracao = ["Original","Sobe 1/2 tom","Sobe 1 tom","Abaixa 1/2 tom","Abaixa 1 tom"];
    const validacaoAlteracao = SpreadsheetApp.newDataValidation().requireValueInList(listaAlteracao).build();
    sheet.getRange(startRow + 1, 3, numMusicas, 1).setDataValidation(validacaoAlteracao);
  } catch (e) {
    console.log("Erro ao aplicar menus suspensos: " + e.message);
  }

  // Rodapé
  sheet.getRange(startRow + 1 + numMusicas, 1, 1, 7).merge()
    .setBackground("white")
    .setBorder(true, true, true, true, true, true, "#cccccc", SpreadsheetApp.BorderStyle.SOLID)
    .setValue(" ");

  ss.toast("Bloco gerado com 7 colunas!");
  return true;
}

function buscarProximaData(sheet, tipo) {
  const lastRow = sheet.getLastRow();
  const hoje = new Date();
  if (lastRow < 1) return formatarData(calcularPrimeiraData(tipo));
  const valores = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    let texto = valores[i][0].toString();
    if (texto.includes("CULTO DE " + tipo)) {
      let partes = texto.split(" - ")[0].split("/");
      if (partes.length === 2) {
        let d = new Date(hoje.getFullYear(), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
        d.setDate(d.getDate() + 7);
        return formatarData(d);
      }
    }
  }
  return formatarData(calcularPrimeiraData(tipo));
}

function calcularPrimeiraData(tipo) {
  const hoje = new Date();
  const alvo = { 'DOMINGO': 0, 'QUARTA': 3, 'SABADO': 6 }[tipo];
  let diff = alvo - hoje.getDay();
  if (diff < 0) diff += 7;
  const data = new Date(hoje);
  data.setDate(hoje.getDate() + diff);
  return data;
}

function formatarData(data) {
  return Utilities.formatDate(data, "GMT-3", "dd/MM");
}

function salvarNoHistorico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const origem = ss.getActiveSheet();
  const destino = ss.getSheetByName('Historico');
  if (!destino) { ss.toast("Crie uma aba chamada 'Historico' primeiro!"); return; }

  const rangeSelecionado = origem.getActiveRange();
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.prompt('Arquivar Repertório', 'Digite o Mês e Ano (Ex: Jan/26):', ui.ButtonSet.OK_CANCEL);

  if (resposta.getSelectedButton() == ui.Button.OK) {
    const mesReferencia = resposta.getResponseText();
    const proximaLinha = destino.getLastRow() + 1;
    const numLinhas = rangeSelecionado.getNumRows();
    const destinoRange = destino.getRange(proximaLinha, 1, numLinhas, 7);
    rangeSelecionado.copyTo(destinoRange);
    const colunaMes = [];
    for (let i = 0; i < numLinhas; i++) colunaMes.push([mesReferencia]);
    destino.getRange(proximaLinha, 8, numLinhas, 1).setValues(colunaMes);
    destino.setRowHeights(proximaLinha, numLinhas, 30);
    ss.toast("Playlist arquivada com sucesso!");
  }
}

function limparPlanilhaPrincipal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.alert('Limpar Playlists', 'Deseja apagar todos os blocos desta aba?', ui.ButtonSet.YES_NO);
  if (resposta == ui.Button.YES) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(3, 1, lastRow, 7).clear();
      sheet.getRange(3, 1, lastRow, 7).clearFormat();
      sheet.getRange(3, 1, lastRow, 7).breakApart();
      ss.toast("Planilha limpa!");
    } else {
      ss.toast("A planilha já está limpa.");
    }
  }
}

// ===================== WEB APP =====================

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetCultos    = ss.getSheetByName("Playlists");
  var sheetBanco     = ss.getSheetByName("Banco_Musicas");
  var sheetCantores  = ss.getSheetByName("Cantores");
  var sheetNovas     = ss.getSheetByName("Musicas_Novas");

  return ContentService
    .createTextOutput(JSON.stringify({
      cultos:     sheetCultos    ? sheetCultos.getDataRange().getValues()   : [],
      repertorio: sheetBanco     ? sheetBanco.getDataRange().getValues()    : [],
      banco:      sheetBanco     ? sheetBanco.getDataRange().getValues()    : [],
      cantores:   sheetCantores  ? sheetCantores.getDataRange().getValues() : [],
      novas:      sheetNovas     ? sheetNovas.getDataRange().getValues()    : []
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Mover músicas novas para o banco e ordenar A-Z ──────────────────
    if (data.acao === 'moverMusicasNovas') {
      var sheetNovas = ss.getSheetByName("Musicas_Novas");
      var sheetBanco = ss.getSheetByName("Banco_Musicas");

      if (!sheetNovas || sheetNovas.getLastRow() <= 1) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "vazio" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Pega todas as músicas novas (sem o cabeçalho)
      var ultimaLinhaNova = sheetNovas.getLastRow();
      var numLinhasNovas = ultimaLinhaNova - 1;
      var dadosNovas = sheetNovas.getRange(2, 1, numLinhasNovas, 5).getValues();

      // Adiciona ao final do Banco_Musicas
      var ultimaLinhaBanco = sheetBanco.getLastRow();
      sheetBanco.getRange(ultimaLinhaBanco + 1, 1, numLinhasNovas, 5).setValues(dadosNovas);

      // Ordena o Banco_Musicas pela coluna A (nome) de A-Z, ignorando o cabeçalho
      var totalLinhasBanco = sheetBanco.getLastRow();
      if (totalLinhasBanco > 1) {
        sheetBanco.getRange(2, 1, totalLinhasBanco - 1, 5).sort({ column: 1, ascending: true });
      }

      // Limpa a aba Musicas_Novas (mantém só o cabeçalho)
      if (numLinhasNovas > 0) {
        sheetNovas.deleteRows(2, numLinhasNovas);
      }

      return ContentService
        .createTextOutput(JSON.stringify({ status: "sucesso" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Ocultar / mostrar culto ──────────────────────────────────────────
    if (data.acao === 'toggleOculto') {
      var sheetToggle = ss.getSheetByName("Playlists");
      var linhaPlanilha = data.startIndex + 1;
      var celula = sheetToggle.getRange(linhaPlanilha, 1);
      var valorAtual = celula.getValue().toString();
      var novoValor = / - OCULTO/i.test(valorAtual)
        ? valorAtual.replace(/ - OCULTO/i, '')
        : valorAtual + ' - OCULTO';
      celula.setValue(novoValor);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "sucesso", novoValor: novoValor }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Salvar culto completo ────────────────────────────────────────────
    if (data.acao === 'salvarCulto') {
      var sheet = ss.getSheetByName("Playlists");
      var lastRow = sheet.getLastRow();

      // Edição: apaga bloco antigo e reinsere no lugar
      if (data.editandoIndex !== null) {
        var startRow = data.editandoIndex + 1;
        var linhasBloco = 1;

        if (startRow < lastRow) {
          var valoresAbaixo = sheet.getRange(startRow + 1, 1, lastRow - startRow, 1).getValues();
          for (var k = 0; k < valoresAbaixo.length; k++) {
            var txt = valoresAbaixo[k][0] ? valoresAbaixo[k][0].toString() : '';
            if (txt.includes("CULTO DE")) break;
            linhasBloco++;
          }
          while (linhasBloco > 1) {
            var ultimaLinha = sheet.getRange(startRow + linhasBloco - 1, 1).getValue().toString().trim();
            if (ultimaLinha === '' || ultimaLinha === ' ') linhasBloco--;
            else break;
          }
        }

        sheet.deleteRows(startRow, linhasBloco);
        sheet.insertRowsBefore(startRow, 1 + data.musicas.length);

      } else {
        // Novo culto: adiciona no final
        var startRow = sheet.getLastRow() + 2;
        sheet.insertRowsAfter(sheet.getLastRow(), 1 + data.musicas.length + 1);
      }

      // ── Linha de cabeçalho ──
      // Col A:E  = título (mesclado)
      // Col F    = instrumentos (JSON: {violao, bateria, teclado})
      // Col G    = cantores do culto (vírgula separados)
      sheet.getRange(startRow, 1, 1, 5).merge()
        .setValue(data.titulo)
        .setBackground("#ea4335").setFontColor("white").setFontWeight("bold")
        .setHorizontalAlignment("center");

      var instrumentosJSON = JSON.stringify(data.instrumentos || {});
      sheet.getRange(startRow, 6).setValue(instrumentosJSON);

      var cantoresCultoTexto = (data.cantoresCulto && data.cantoresCulto.length > 0)
        ? data.cantoresCulto.join(', ')
        : '';
      sheet.getRange(startRow, 7).setValue(cantoresCultoTexto);

      // ── Linhas de música ──
      // Col A = nome, B = tom, C = variação, D = vs, E = yt, F = (vazio), G = cantores da música
      data.musicas.forEach(function(m, idx) {
        var row = startRow + 1 + idx;
        sheet.getRange(row, 1).setValue(m.nome);
        sheet.getRange(row, 2).setValue(m.tom);
        sheet.getRange(row, 3).setValue(m.variacao);
        sheet.getRange(row, 4).setValue(m.vs);
        sheet.getRange(row, 5).setValue(m.yt);
        sheet.getRange(row, 6).setValue(''); // col F livre nas linhas de música
        var cantoresMusicaTexto = (m.cantores && m.cantores.length > 0) ? m.cantores.join(', ') : '';
        sheet.getRange(row, 7).setValue(cantoresMusicaTexto);
      });

      return ContentService
        .createTextOutput(JSON.stringify({ status: "sucesso" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Solicitações normais (ajuste de tom, sugestões) ─────────────────
    var sheetSolicitacoes = ss.getSheetByName("Solicitacoes");
    if (!sheetSolicitacoes) {
      sheetSolicitacoes = ss.insertSheet("Solicitacoes");
      sheetSolicitacoes.appendRow(["Data/Hora", "Categoria", "Música / Culto", "Quem Pediu", "Solicitação"]);
    }
    sheetSolicitacoes.appendRow([
      new Date(),
      data.categoria || "Sem categoria",
      data.musica,
      data.autor,
      data.texto
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "sucesso" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "erro", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}