/** @OnlyCurrentDoc */

// ============================================================
// MENU SUPERIOR
// ============================================================

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


// ============================================================
// CRIAÇÃO DE BLOCO DE CULTO PELA PLANILHA
// ============================================================

function gerarBlocoCulto() {
  try {
    const html = HtmlService
      .createHtmlOutputFromFile('PromptCulto')
      .setWidth(350)
      .setHeight(300)
      .setTitle('Organizador de Louvor');

    SpreadsheetApp.getUi().showModalDialog(html, ' ');

  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'Erro ao abrir janela: ' + e.message
    );
  }
}


/**
 * Cria um bloco de culto diretamente na planilha.
 *
 * Mantida para compatibilidade com o PromptCulto antigo.
 *
 * DOMINGO = 6 músicas
 * QUARTA  = 4 músicas
 * SABADO  = 5 músicas
 *
 * A criação pelo Web App pode utilizar qualquer quantidade de músicas
 * através da ação "salvarCulto".
 */
function processarEscolha(tipo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const startRow = lastRow + 2;

  let numMusicas;
  let cores;

  if (tipo === 'DOMINGO') {

    numMusicas = 6;

    cores = {
      header: '#34a853',
      light: '#e6f4ea',
      dark: '#ceead6'
    };

  } else if (tipo === 'QUARTA') {

    numMusicas = 4;

    cores = {
      header: '#4285f4',
      light: '#e8f0fe',
      dark: '#d2e3fc'
    };

  } else if (tipo === 'SABADO') {

    numMusicas = 5;

    cores = {
      header: '#ea4335',
      light: '#fce8e6',
      dark: '#fad2cf'
    };

  } else {

    // Compatibilidade com chamadas antigas.
    // Caso seja informado outro tipo, usamos 5 músicas.
    numMusicas = 5;

    cores = {
      header: '#ea4335',
      light: '#fce8e6',
      dark: '#fad2cf'
    };
  }

  const proximaData = buscarProximaData(sheet, tipo);

  // ----------------------------------------------------------
  // CABEÇALHO
  // A:E = título
  // F   = instrumentos
  // G   = cantores do culto
  // ----------------------------------------------------------

  sheet
    .getRange(startRow, 1, 1, 5)
    .merge()
    .setValue(
      proximaData + ' - CULTO DE ' + tipo
    )
    .setBackground(cores.header)
    .setFontColor('white')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // ----------------------------------------------------------
  // LINHAS DE MÚSICA
  // ----------------------------------------------------------

  const musicRange = sheet.getRange(
    startRow + 1,
    1,
    numMusicas,
    7
  );

  const backgrounds = [];

  for (let i = 0; i < numMusicas; i++) {

    const cor =
      i % 2 === 0
        ? cores.light
        : cores.dark;

    backgrounds.push([
      cor,
      cor,
      cor,
      cor,
      cor,
      cor,
      cor
    ]);
  }

  musicRange
    .setBackgrounds(backgrounds)
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      '#ffffff',
      SpreadsheetApp.BorderStyle.SOLID
    );

  // ----------------------------------------------------------
  // VALIDAÇÕES
  // ----------------------------------------------------------

  try {

    const listaTons = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',

      'Cm',
      'C#m',
      'Dm',
      'D#m',
      'Em',
      'Fm',
      'F#m',
      'Gm',
      'G#m',
      'Am',
      'A#m',
      'Bm'
    ];

    const validacaoTons =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(listaTons)
        .build();

    sheet
      .getRange(
        startRow + 1,
        2,
        numMusicas,
        1
      )
      .setDataValidation(validacaoTons);


    const listaAlteracao = [
      'Original',
      'Sobe 1/2 tom',
      'Sobe 1 tom',
      'Abaixa 1/2 tom',
      'Abaixa 1 tom'
    ];

    const validacaoAlteracao =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(listaAlteracao)
        .build();

    sheet
      .getRange(
        startRow + 1,
        3,
        numMusicas,
        1
      )
      .setDataValidation(validacaoAlteracao);

  } catch (e) {

    console.log(
      'Erro ao aplicar menus suspensos: ' +
      e.message
    );
  }

  // ----------------------------------------------------------
  // RODAPÉ
  // ----------------------------------------------------------

  sheet
    .getRange(
      startRow + 1 + numMusicas,
      1,
      1,
      7
    )
    .merge()
    .setBackground('white')
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      '#cccccc',
      SpreadsheetApp.BorderStyle.SOLID
    )
    .setValue(' ');

  ss.toast(
    'Bloco gerado com 7 colunas!'
  );

  return true;
}


// ============================================================
// DATAS DOS CULTOS
// ============================================================

function buscarProximaData(sheet, tipo) {

  const lastRow = sheet.getLastRow();
  const hoje = new Date();

  if (lastRow < 1) {
    return formatarData(
      calcularPrimeiraData(tipo)
    );
  }

  const valores = sheet
    .getRange(
      1,
      1,
      lastRow,
      1
    )
    .getValues();

  for (
    let i = valores.length - 1;
    i >= 0;
    i--
  ) {

    const texto =
      valores[i][0]
        ? valores[i][0].toString()
        : '';

    if (
      texto.includes(
        'CULTO DE ' + tipo
      )
    ) {

      const partes =
        texto
          .split(' - ')[0]
          .split('/');

      if (partes.length === 2) {

        const d = new Date(
          hoje.getFullYear(),
          parseInt(partes[1], 10) - 1,
          parseInt(partes[0], 10)
        );

        d.setDate(
          d.getDate() + 7
        );

        return formatarData(d);
      }
    }
  }

  return formatarData(
    calcularPrimeiraData(tipo)
  );
}


function calcularPrimeiraData(tipo) {

  const hoje = new Date();

  const alvo = {
    DOMINGO: 0,
    QUARTA: 3,
    SABADO: 6
  }[tipo];

  // Se o tipo não for um dos tradicionais,
  // utiliza a data atual.
  if (typeof alvo !== 'number') {
    return hoje;
  }

  let diff =
    alvo - hoje.getDay();

  if (diff < 0) {
    diff += 7;
  }

  const data =
    new Date(hoje);

  data.setDate(
    hoje.getDate() + diff
  );

  return data;
}


function formatarData(data) {

  return Utilities.formatDate(
    data,
    'GMT-3',
    'dd/MM'
  );
}


// ============================================================
// HISTÓRICO
// ============================================================

function salvarNoHistorico() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const origem =
    ss.getActiveSheet();

  const destino =
    ss.getSheetByName('Historico');

  if (!destino) {

    ss.toast(
      "Crie uma aba chamada 'Historico' primeiro!"
    );

    return;
  }

  const rangeSelecionado =
    origem.getActiveRange();

  const ui =
    SpreadsheetApp.getUi();

  const resposta =
    ui.prompt(
      'Arquivar Repertório',
      'Digite o Mês e Ano (Ex: Jan/26):',
      ui.ButtonSet.OK_CANCEL
    );

  if (
    resposta.getSelectedButton() !==
    ui.Button.OK
  ) {
    return;
  }

  const mesReferencia =
    resposta.getResponseText();

  const proximaLinha =
    destino.getLastRow() + 1;

  const numLinhas =
    rangeSelecionado.getNumRows();

  // O histórico trabalha com A:H.
  // A:G = dados do repertório
  // H   = mês/ano de referência

  const destinoRange =
    destino.getRange(
      proximaLinha,
      1,
      numLinhas,
      7
    );

  rangeSelecionado.copyTo(
    destinoRange
  );

  const colunaMes = [];

  for (
    let i = 0;
    i < numLinhas;
    i++
  ) {

    colunaMes.push([
      mesReferencia
    ]);
  }

  destino
    .getRange(
      proximaLinha,
      8,
      numLinhas,
      1
    )
    .setValues(colunaMes);

  destino.setRowHeights(
    proximaLinha,
    numLinhas,
    30
  );

  ss.toast(
    'Playlist arquivada com sucesso!'
  );
}


// ============================================================
// LIMPAR PLAYLISTS
// ============================================================

function limparPlanilhaPrincipal() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getActiveSheet();

  const ui =
    SpreadsheetApp.getUi();

  const resposta =
    ui.alert(
      'Limpar Playlists',
      'Deseja apagar todos os blocos desta aba?',
      ui.ButtonSet.YES_NO
    );

  if (
    resposta !== ui.Button.YES
  ) {
    return;
  }

  const lastRow =
    sheet.getLastRow();

  if (lastRow > 2) {

    const quantidadeLinhas =
      lastRow - 2;

    const range =
      sheet.getRange(
        3,
        1,
        quantidadeLinhas,
        7
      );

    range.clearContent();
    range.clearFormat();
    range.clearDataValidations();
    range.breakApart();

    ss.toast(
      'Planilha limpa!'
    );

  } else {

    ss.toast(
      'A planilha já está limpa.'
    );
  }
}


// ============================================================
// WEB APP - GET
// ============================================================

function doGet(e) {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetCultos =
    ss.getSheetByName('Playlists');

  const sheetBanco =
    ss.getSheetByName('Banco_Musicas');

  const sheetCantores =
    ss.getSheetByName('Cantores');

  const sheetNovas =
    ss.getSheetByName('Musicas_Novas');

  const resposta = {

    cultos:
      sheetCultos
        ? sheetCultos
          .getDataRange()
          .getValues()
        : [],

    repertorio:
      sheetBanco
        ? sheetBanco
          .getDataRange()
          .getValues()
        : [],

    banco:
      sheetBanco
        ? sheetBanco
          .getDataRange()
          .getValues()
        : [],

    cantores:
      sheetCantores
        ? sheetCantores
          .getDataRange()
          .getValues()
        : [],

    novas:
      sheetNovas
        ? sheetNovas
          .getDataRange()
          .getValues()
        : []
  };

  return ContentService
    .createTextOutput(
      JSON.stringify(resposta)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


// ============================================================
// WEB APP - POST
// ============================================================

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return respostaJSON({
        status: 'erro',
        message: 'Nenhum dado recebido.'
      });
    }

    const data =
      JSON.parse(
        e.postData.contents
      );

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();


    // ========================================================
    // VALIDAR SENHA ADMIN
    // ========================================================

    if (
      data.acao ===
      'validarSenha'
    ) {

      const senhaEsperada =
        PropertiesService
          .getScriptProperties()
          .getProperty('SENHA_ADMIN') ||
        'idblouvor';

      if (
        (data.senha || '')
          .toString()
          .trim() ===
        senhaEsperada
          .toString()
          .trim()
      ) {

        return respostaJSON({
          status: 'sucesso',
          autorizado: true
        });

      } else {

        return respostaJSON({
          status: 'erro',
          autorizado: false,
          message:
            'Senha incorreta.'
        });
      }
    }


    // ========================================================
    // MOVER MÚSICAS NOVAS PARA O BANCO
    // ========================================================

    if (
      data.acao ===
      'moverMusicasNovas'
    ) {

      const sheetNovas =
        ss.getSheetByName(
          'Musicas_Novas'
        );

      const sheetBanco =
        ss.getSheetByName(
          'Banco_Musicas'
        );

      if (!sheetNovas) {

        return respostaJSON({
          status: 'erro',
          message:
            'A aba Musicas_Novas não existe.'
        });
      }

      if (!sheetBanco) {

        return respostaJSON({
          status: 'erro',
          message:
            'A aba Banco_Musicas não existe.'
        });
      }

      if (
        sheetNovas.getLastRow() <= 1
      ) {

        return respostaJSON({
          status: 'vazio'
        });
      }

      // Dados sem o cabeçalho
      const ultimaLinhaNova =
        sheetNovas.getLastRow();

      const numLinhasNovas =
        ultimaLinhaNova - 1;

      const dadosNovas =
        sheetNovas
          .getRange(
            2,
            1,
            numLinhasNovas,
            5
          )
          .getValues();

      // Adiciona ao Banco_Musicas
      const ultimaLinhaBanco =
        sheetBanco.getLastRow();

      sheetBanco
        .getRange(
          ultimaLinhaBanco + 1,
          1,
          numLinhasNovas,
          5
        )
        .setValues(dadosNovas);

      // Ordena A-Z
      const totalLinhasBanco =
        sheetBanco.getLastRow();

      if (
        totalLinhasBanco > 1
      ) {

        sheetBanco
          .getRange(
            2,
            1,
            totalLinhasBanco - 1,
            5
          )
          .sort({
            column: 1,
            ascending: true
          });
      }

      // Remove somente os dados,
      // mantendo o cabeçalho.
      sheetNovas.deleteRows(
        2,
        numLinhasNovas
      );

      return respostaJSON({
        status: 'sucesso'
      });
    }


    // ========================================================
    // OCULTAR / MOSTRAR CULTO
    // ========================================================

    if (
      data.acao ===
      'toggleOculto'
    ) {

      const sheetToggle =
        ss.getSheetByName(
          'Playlists'
        );

      if (!sheetToggle) {

        return respostaJSON({
          status: 'erro',
          message:
            'A aba Playlists não existe.'
        });
      }

      const linhaPlanilha =
        Number(data.startIndex) + 1;

      if (
        linhaPlanilha < 1 ||
        linhaPlanilha >
        sheetToggle.getMaxRows()
      ) {

        return respostaJSON({
          status: 'erro',
          message:
            'Índice de culto inválido.'
        });
      }

      const celula =
        sheetToggle.getRange(
          linhaPlanilha,
          1
        );

      const valorAtual =
        celula
          .getValue()
          .toString();

      const novoValor =
        / - OCULTO/i.test(
          valorAtual
        )
          ? valorAtual.replace(
            / - OCULTO/i,
            ''
          )
          : valorAtual +
          ' - OCULTO';

      celula.setValue(
        novoValor
      );

      SpreadsheetApp.flush();

      return respostaJSON({
        status: 'sucesso',
        novoValor: novoValor
      });
    }


    // ========================================================
    // SALVAR CULTO COMPLETO
    // ========================================================

    if (
      data.acao ===
      'salvarCulto'
    ) {

      const sheet =
        ss.getSheetByName(
          'Playlists'
        );

      if (!sheet) {

        return respostaJSON({
          status: 'erro',
          message:
            'A aba Playlists não existe.'
        });
      }

      const musicas =
        Array.isArray(data.musicas)
          ? data.musicas
          : [];

      const lastRow =
        sheet.getLastRow();

      let startRow;


      // ------------------------------------------------------
      // EDIÇÃO DE CULTO EXISTENTE
      // ------------------------------------------------------

      if (
        data.editandoIndex !== null &&
        data.editandoIndex !== undefined &&
        data.editandoIndex !== ''
      ) {

        startRow =
          Number(data.editandoIndex) + 1;

        if (
          startRow < 1 ||
          startRow > sheet.getMaxRows()
        ) {

          return respostaJSON({
            status: 'erro',
            message:
              'Índice do culto inválido.'
          });
        }

        let linhasBloco = 1;

        if (
          startRow < lastRow
        ) {

          const quantidadeAbaixo =
            lastRow - startRow;

          const valoresAbaixo =
            sheet
              .getRange(
                startRow + 1,
                1,
                quantidadeAbaixo,
                1
              )
              .getValues();

          for (
            let k = 0;
            k < valoresAbaixo.length;
            k++
          ) {

            const txt =
              valoresAbaixo[k][0]
                ? valoresAbaixo[k][0]
                  .toString()
                  .trim()
                : '';

            // Encontrou o próximo culto.
            if (
              txt.includes(
                'CULTO DE'
              )
            ) {
              break;
            }

            linhasBloco++;
          }

          // Remove linhas vazias/rodapé
          // que pertencem ao bloco.
          while (
            linhasBloco > 1
          ) {

            const ultimaLinha =
              sheet
                .getRange(
                  startRow +
                  linhasBloco -
                  1,
                  1
                )
                .getValue()
                .toString()
                .trim();

            if (
              ultimaLinha === '' ||
              ultimaLinha === ' '
            ) {

              linhasBloco--;

            } else {

              break;
            }
          }
        }

        // Remove o bloco antigo.
        sheet.deleteRows(
          startRow,
          linhasBloco
        );

        // Cria espaço para o novo bloco.
        // +1 = cabeçalho
        // +N = músicas
        sheet.insertRowsBefore(
          startRow,
          1 + musicas.length
        );


        // ------------------------------------------------------
        // NOVO CULTO
        // ------------------------------------------------------

      } else {

        // Mantém uma linha em branco
        // entre os blocos.
        startRow =
          sheet.getLastRow() + 2;

        const linhasNecessarias =
          1 +
          musicas.length +
          1;

        sheet.insertRowsAfter(
          sheet.getLastRow(),
          linhasNecessarias
        );
      }


      // ------------------------------------------------------
      // CABEÇALHO DO CULTO
      //
      // A:E = título
      // F   = instrumentos JSON
      // G   = cantores do culto
      // ------------------------------------------------------

      sheet
        .getRange(
          startRow,
          1,
          1,
          5
        )
        .merge()
        .setValue(
          data.titulo || ''
        )
        .setBackground(
          obterCorCabecalhoCulto(
            data.titulo
          )
        )
        .setFontColor('white')
        .setFontWeight('bold')
        .setHorizontalAlignment(
          'center'
        )
        .setVerticalAlignment(
          'middle'
        );


      // ------------------------------------------------------
      // INSTRUMENTOS
      // ------------------------------------------------------

      const instrumentos =
        data.instrumentos &&
          typeof data.instrumentos ===
          'object'
          ? data.instrumentos
          : {};

      sheet
        .getRange(
          startRow,
          6
        )
        .setValue(
          JSON.stringify(
            instrumentos
          )
        );


      // ------------------------------------------------------
      // CANTORES DO CULTO
      // ------------------------------------------------------

      const cantoresCultoTexto =
        Array.isArray(
          data.cantoresCulto
        ) &&
          data.cantoresCulto.length > 0
          ? data.cantoresCulto.join(
            ', '
          )
          : '';

      sheet
        .getRange(
          startRow,
          7
        )
        .setValue(
          cantoresCultoTexto
        );


      // ------------------------------------------------------
      // LINHAS DE MÚSICAS
      //
      // A = nome
      // B = tom
      // C = variação
      // D = VS
      // E = YouTube
      // F = livre
      // G = cantores
      // ------------------------------------------------------

      if (
        musicas.length > 0
      ) {

        const valoresMusicas = [];

        for (
          let idx = 0;
          idx < musicas.length;
          idx++
        ) {

          const m =
            musicas[idx] || {};

          const cantoresMusicaTexto =
            Array.isArray(
              m.cantores
            ) &&
              m.cantores.length > 0
              ? m.cantores.join(
                ', '
              )
              : '';

          valoresMusicas.push([
            m.nome || '',
            m.tom || '',
            m.variacao || '',
            m.vs || '',
            m.yt || '',
            '',
            cantoresMusicaTexto
          ]);
        }

        sheet
          .getRange(
            startRow + 1,
            1,
            musicas.length,
            7
          )
          .setValues(
            valoresMusicas
          );


        // ----------------------------------------------------
        // FORMATAÇÃO DAS MÚSICAS
        // ----------------------------------------------------

        const backgrounds = [];

        for (
          let i = 0;
          i < musicas.length;
          i++
        ) {

          const cor =
            i % 2 === 0
              ? '#fce8e6'
              : '#fad2cf';

          backgrounds.push([
            cor,
            cor,
            cor,
            cor,
            cor,
            cor,
            cor
          ]);
        }

        sheet
          .getRange(
            startRow + 1,
            1,
            musicas.length,
            7
          )
          .setBackgrounds(
            backgrounds
          )
          .setBorder(
            true,
            true,
            true,
            true,
            true,
            true,
            '#ffffff',
            SpreadsheetApp.BorderStyle.SOLID
          );


        // ----------------------------------------------------
        // VALIDAÇÃO DE TOM
        // ----------------------------------------------------

        const listaTons = [
          'C',
          'C#',
          'D',
          'D#',
          'E',
          'F',
          'F#',
          'G',
          'G#',
          'A',
          'A#',
          'B',

          'Cm',
          'C#m',
          'Dm',
          'D#m',
          'Em',
          'Fm',
          'F#m',
          'Gm',
          'G#m',
          'Am',
          'A#m',
          'Bm'
        ];

        const validacaoTons =
          SpreadsheetApp
            .newDataValidation()
            .requireValueInList(
              listaTons
            )
            .build();

        sheet
          .getRange(
            startRow + 1,
            2,
            musicas.length,
            1
          )
          .setDataValidation(
            validacaoTons
          );


        // ----------------------------------------------------
        // VALIDAÇÃO DE VARIAÇÃO
        // ----------------------------------------------------

        const listaAlteracao = [
          'Original',
          'Sobe 1/2 tom',
          'Sobe 1 tom',
          'Abaixa 1/2 tom',
          'Abaixa 1 tom'
        ];

        const validacaoAlteracao =
          SpreadsheetApp
            .newDataValidation()
            .requireValueInList(
              listaAlteracao
            )
            .build();

        sheet
          .getRange(
            startRow + 1,
            3,
            musicas.length,
            1
          )
          .setDataValidation(
            validacaoAlteracao
          );
      }


      // ------------------------------------------------------
      // RODAPÉ / ESPAÇAMENTO
      // ------------------------------------------------------

      const footerRow =
        startRow +
        1 +
        musicas.length;

      sheet
        .getRange(
          footerRow,
          1,
          1,
          7
        )
        .merge()
        .setBackground(
          'white'
        )
        .setBorder(
          true,
          true,
          true,
          true,
          true,
          true,
          '#cccccc',
          SpreadsheetApp.BorderStyle.SOLID
        )
        .setValue(' ');


      return respostaJSON({
        status: 'sucesso',
        startRow: startRow,
        musicasSalvas:
          musicas.length
      });
    }


    // ========================================================
    // SOLICITAÇÕES NORMAIS
    // ========================================================

    let sheetSolicitacoes =
      ss.getSheetByName(
        'Solicitacoes'
      );

    if (!sheetSolicitacoes) {

      sheetSolicitacoes =
        ss.insertSheet(
          'Solicitacoes'
        );

      sheetSolicitacoes.appendRow([
        'Data/Hora',
        'Categoria',
        'Música / Culto',
        'Quem Pediu',
        'Solicitação'
      ]);
    }

    sheetSolicitacoes.appendRow([
      new Date(),
      data.categoria ||
      'Sem categoria',
      data.musica || '',
      data.autor || '',
      data.texto || ''
    ]);

    return respostaJSON({
      status: 'sucesso'
    });


  } catch (error) {

    console.error(error);

    return respostaJSON({
      status: 'erro',
      message:
        error.toString()
    });
  }
}


// ============================================================
// FUNÇÕES AUXILIARES DO WEB APP
// ============================================================

function respostaJSON(objeto) {

  return ContentService
    .createTextOutput(
      JSON.stringify(objeto)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/**
 * Define a cor do cabeçalho.
 *
 * Mantém o comportamento visual antigo para
 * DOMINGO, QUARTA e SABADO.
 */
function obterCorCabecalhoCulto(titulo) {

  const texto =
    titulo
      ? titulo.toString().toUpperCase()
      : '';

  if (
    texto.includes('DOMINGO')
  ) {
    return '#34a853';
  }

  if (
    texto.includes('QUARTA')
  ) {
    return '#4285f4';
  }

  return '#ea4335';
}