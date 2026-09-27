const express = require('express');
const PDFDocument = require('pdfkit');

const FUSO_HORARIO = 'America/Sao_Paulo';

function horarioLocal(data) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', weekday: 'short'
  }).formatToParts(data);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return {
    data: `${valor('year')}-${valor('month')}-${valor('day')}`,
    horario: `${valor('hour')}:${valor('minute')}:${valor('second')}`,
    diaSemana: valor('weekday')
  };
}

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function criarApp({ agora = () => new Date() } = {}) {
  const app = express();
  app.use(express.json());

  // Os dados ficam em memória. Reiniciar o servidor restaura esta lista.
  let jogos = [
    { id: '1', titulo: 'The Witcher 3: Wild Hunt', genero: 'RPG de Ação', ano: 2015, capa: 'https://image.api.playstation.com/vulcan/ap/rnd/202211/0711/qezXTVn1ExqBjVjR5Ipm97IK.png' },
    { id: '2', titulo: 'God of War', genero: 'Ação / Aventura', ano: 2018, capa: 'https://m.media-amazon.com/images/M/MV5BNjJiNTFhY2QtNzZkYi00MDNiLWEzNGEtNWE1NzBkOWIxNmY5XkEyXkFqcGc@._V1_.jpg' },
    { id: '3', titulo: 'Cyberpunk 2077', genero: 'RPG Futurista', ano: 2020, capa: 'https://store-images.s-microsoft.com/image/apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894' }
  ];
  const logs = [];

  // Uma tentativa bloqueada também entra no registro.
  app.use((req, res, next) => {
    const momento = horarioLocal(agora());
    logs.push({ data: momento.data, horario: momento.horario, metodo: req.method, rota: req.originalUrl });
    if (momento.diaSemana === 'sáb.' || momento.diaSemana === 'dom.') {
      return res.status(403).json({ erro: 'A API está disponível apenas de segunda a sexta-feira.' });
    }
    next();
  });

  app.get('/', (req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Biblioteca pessoal de jogos</title>
<style>body{font:16px system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#eee;background:#151827}a{color:#a9c4ff}li{margin:12px 0}code{background:#292d40;padding:3px 6px;border-radius:4px}</style></head>
<body><h1>Biblioteca pessoal de jogos</h1><p>API de jogos com dados armazenados em memória.</p>
<ul><li><a href="/jogos">Lista de jogos (JSON)</a></li><li><a href="/jogos/pdf">Baixar lista em PDF</a></li><li><a href="/jogos/1">Consultar o jogo 1</a></li></ul>
<p>Para consultar registros, use <code>GET /logs?data=AAAA-MM-DD</code>. Consulte o README para ver todas as rotas e exemplos.</p></body></html>`);
  });

  app.get('/jogos', (req, res) => res.json(jogos));

  app.get('/jogos/pdf', (req, res) => {
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="jogos.pdf"' });
    const pdf = new PDFDocument({ margin: 50 });
    pdf.on('error', (erro) => {
      console.error('Erro ao gerar PDF:', erro);
      res.destroy(erro);
    });
    pdf.pipe(res);
    pdf.fontSize(18).text('Biblioteca pessoal de jogos');
    pdf.moveDown().fontSize(11).text(`Jogos cadastrados: ${jogos.length}`);
    pdf.moveDown();
    for (const jogo of jogos) {
      pdf.fontSize(12).text(`${jogo.id} - ${jogo.titulo}`);
      pdf.fontSize(10).text(`Gênero: ${jogo.genero || 'Não informado'} | Ano: ${jogo.ano ?? 'Não informado'}`);
      pdf.moveDown(0.6);
    }
    pdf.end();
  });

  app.get('/jogos/:id', (req, res) => {
    const jogo = jogos.find((item) => item.id === req.params.id);
    if (!jogo) return res.status(404).json({ erro: 'Jogo não encontrado.' });
    res.json(jogo);
  });

  app.post('/jogos', (req, res) => {
    const { id, titulo, genero, ano, capa } = req.body || {};
    if (typeof id !== 'string' || !id.trim() || typeof titulo !== 'string' || !titulo.trim()) {
      return res.status(400).json({ erro: 'ID e título devem ser textos não vazios.' });
    }
    if (jogos.some((jogo) => jogo.id === id.trim())) {
      return res.status(409).json({ erro: 'Já existe um jogo com esse ID.' });
    }
    if (genero !== undefined && typeof genero !== 'string') return res.status(400).json({ erro: 'Gênero deve ser texto.' });
    if (ano !== undefined && (!Number.isInteger(ano) || ano < 1950)) return res.status(400).json({ erro: 'Ano deve ser um número inteiro a partir de 1950.' });
    if (capa !== undefined && typeof capa !== 'string') return res.status(400).json({ erro: 'Capa deve ser uma URL em texto.' });
    const novoJogo = { id: id.trim(), titulo: titulo.trim(), genero: genero || '', ano: ano ?? null, capa: capa || '' };
    jogos.push(novoJogo);
    res.status(201).json(novoJogo);
  });

  app.delete('/jogos/:id', (req, res) => {
    const indice = jogos.findIndex((jogo) => jogo.id === req.params.id);
    if (indice === -1) return res.status(404).json({ erro: 'Jogo não encontrado.' });
    const [removido] = jogos.splice(indice, 1);
    res.json({ mensagem: 'Jogo excluído.', jogo: removido });
  });

  app.get('/logs', (req, res) => {
    if (!dataValida(req.query.data)) {
      return res.status(400).json({ erro: 'Informe uma data válida em ?data=AAAA-MM-DD.' });
    }
    res.json(logs.filter((registro) => registro.data === req.query.data));
  });

  return app;
}

const app = criarApp();
if (require.main === module) {
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log(`API disponível em http://localhost:${porta}`));
}

module.exports = app;
module.exports.criarApp = criarApp;
