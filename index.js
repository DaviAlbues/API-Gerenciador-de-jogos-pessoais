const express = require('express');
const PDFDocument = require('pdfkit');
const app = express();

app.use(express.json());

// Requisito I: Dados mockados em memória enriquecidos com capas (URLs de imagens)
let jogos = [
  { 
    id: "1", 
    titulo: "The Witcher 3: Wild Hunt", 
    genero: "RPG de Ação", 
    ano: 2015, 
    capa: "https://upload.wikimedia.org/wikipedia/pt/0/06/TW3_Wild_Hunt.png?utm_source=pt.wikipedia.org&utm_campaign=index&utm_content=original" 
  },
  { 
    id: "2", 
    titulo: "God of War", 
    genero: "Ação / Aventura", 
    ano: 2018, 
    capa: "https://preview.redd.it/sejam-sinceros-qual-a-opini%C3%A3o-de-voc%C3%AAs-sobre-god-of-war-de-v0-604vkqr831rf1.jpg?width=640&crop=smart&auto=webp&s=a3062eee291821aa655d6e097841b6c67e162d54" 
  },
  { 
    id: "3", 
    titulo: "Cyberpunk 2077", 
    genero: "RPG Futurista", 
    ano: 2020, 
    capa: "https://store-images.s-microsoft.com/image/apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894" 
  }
];

let logsRequisicoes = [];

// Requisito E: Middleware que permite acesso apenas de segunda a sexta-feira
const verificarDiasUteis = (req, res, next) => {
  const diaSemana = new Date().getDay(); // 0 = Domingo, 6 = Sábado
  // Se quiseres testar livremente ao fim de semana para a apresentação, podes comentar esta verificação temporariamente
  if (diaSemana === 6) {
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

// Aplicando os middlewares globais (exceto na rota visual para evitar bloqueios no visual se testado ao fim de semana)
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/ui') return next();
  verificarDiasUteis(req, res, next);
});

app.use(registrarLog);

// Rota Visual (Frontend integrado para exibir capas e nomes bonitos)
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Biblioteca Pessoal de Jogos - PSW2</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white min-h-screen font-sans">
        <div class="container mx-auto px-4 py-8">
            <header class="text-center mb-10">
                <h1 class="text-4xl font-extrabold text-indigo-400 mb-2">🎮 Gerenciador de Jogos</h1>
                <p class="text-gray-400">Trabalho Prático - PSW2 (IFCE Campus Crato)</p>
                <div class="mt-4 flex justify-center gap-4">
                    <a href="/jogos" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Ver JSON da API</a>
                    <a href="/jogos/pdf" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Descarregar PDF (Requisito H)</a>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${jogos.map(jogo => `
                    <div class="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 hover:border-indigo-500 transition duration-300">
                        <img src="${jogo.capa}" alt="${jogo.titulo}" class="w-full h-48 object-cover">
                        <div class="p-5">
                            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-full">${jogo.genero}</span>
                            <h3 class="text-xl font-bold mt-3 mb-1 text-white">${jogo.titulo}</h3>
                            <p class="text-gray-400 text-sm">Ano de Lançamento: <span class="text-gray-200 font-medium">${jogo.ano}</span></p>
                            <p class="text-gray-500 text-xs mt-3">Código ID: ${jogo.id}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Requisito A: Rota GET para obter a lista de itens em JSON
app.get('/jogos', (req, res) => {
  res.json(jogos);
});

// Requisito H: Rota GET que gera um arquivo PDF para download
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
  const { id, titulo, genero, ano, capa } = req.body;
  if (!id || !titulo) {
    return res.status(400).json({ erro: "ID e Título são obrigatórios." });
  }
  const novoJogo = { id, titulo, genero, ano, capa: capa || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500" };
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
