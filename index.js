const express = require('express');
const PDFDocument = require('pdfkit');
const app = express();

app.use(express.json());

// Requisito I: Dados mockados em memória
let jogos = [
  { id: "1", titulo: "The Witcher 3", genero: "RPG", ano: 2015 },
  { id: "2", titulo: "God of War", genero: "Ação", ano: 2018 },
  { id: "3", titulo: "Cyberpunk 2077", genero: "RPG", ano: 2020 }
];

let logsRequisicoes = [];

// Requisito E: Middleware que permite acesso apenas de segunda a sexta-feira
const verificarDiasUteis = (req, res, next) => {
  const diaSemana = new Date().getDay(); // 0 = Domingo, 6 = Sábado
  if ( diaSemana === 6) {
    return res.status(403).json({ 
      erro: "Acesso negado. A API funciona apenas de segunda a sexta-feira (Requisito E)." 
    });
  }
  next();
};

// Requisito F: Middleware que registra o horário e a rota de cada requisição
const registrarLog = (req, res, next) => {
  const agora = new Date();
  logsRequisicoes.push({
    data: agora.toISOString().split('T')[0],
    horario: agora.toLocaleTimeString(),
    metodo: req.method,
    rota: req.originalUrl
  });
  next();
};

// Aplicando os middlewares globais
app.use(verificarDiasUteis);
app.use(registrarLog);

// Requisito A: Rota GET para obter a lista de itens
app.get('/jogos', (req, res) => {
  res.json(jogos);
});

// Requisito H: Rota GET que gera um arquivo PDF para download (DEVE FICAR ANTES DE /:id)
app.get('/jogos/pdf', (req, res) => {
  const doc = new PDFDocument();
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=lista-de-jogos.pdf');
  
  doc.pipe(res);

  doc.fontSize(20).text('Relatório de Jogos - API PSW2', { align: 'center' });
  doc.moveDown();
  
  jogos.forEach((jogo, index) => {
    doc.fontSize(12).text(`${index + 1}. Código: ${jogo.id} | Título: ${jogo.titulo} | Gênero: ${jogo.genero} (${jogo.ano})`);
  });

  doc.end();
});

// Requisito D: Rota GET para pesquisar um item pelo código (ID)
app.get('/jogos/:id', (req, res) => {
  const jogo = jogos.find(j => j.id === req.params.id);
  if (!jogo) {
    return res.status(404).json({ erro: "Item não encontrado com este código." });
  }
  res.json(jogo);
});

// Requisito B: Rota POST para inserir um novo item
app.post('/jogos', (req, res) => {
  const { id, titulo, genero, ano } = req.body;
  if (!id || !titulo) {
    return res.status(400).json({ erro: "ID e Título são obrigatórios." });
  }
  const novoJogo = { id, titulo, genero, ano };
  jogos.push(novoJogo);
  res.status(201).json({ mensagem: "Item inserido com sucesso!", novoJogo });
});

// Requisito C: Rota DELETE para excluir um item
app.delete('/jogos/:id', (req, res) => {
  const tamanhoAnterior = jogos.length;
  jogos = jogos.filter(j => j.id !== req.params.id);
  
  if (jogos.length === tamanhoAnterior) {
    return res.status(404).json({ erro: "Item não encontrado para exclusão." });
  }
  res.status(200).json({ mensagem: "Item excluído com sucesso." });
});

// Requisito G: Rota GET que retorna os registros de requisição em uma data informada
app.get('/logs', (req, res) => {
  const { data } = req.query; // Exemplo: /logs?data=2026-09-27
  if (!data) {
    return res.status(400).json({ erro: "Informe a data no parâmetro ?data=AAAA-MM-DD" });
  }
  const logsFiltrados = logsRequisicoes.filter(log => log.data === data);
  res.json(logsFiltrados);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a executar na porta ${PORT}`);
});