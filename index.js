const express = require('express');
const PDFDocument = require('pdfkit');
const app = express();

app.use(express.json());

// Requisito I: Dados mockados com capas em formato vertical (estilo capa de jogo)
let jogos = [
  { 
    id: "1", 
    titulo: "The Witcher 3: Wild Hunt", 
    genero: "RPG de Ação", 
    ano: 2015, 
    capa: "https://image.api.playstation.com/vulcan/ap/rnd/202211/0711/qezXTVn1ExqBjVjR5Ipm97IK.png" 
  },
  { 
    id: "2", 
    titulo: "God of War", 
    genero: "Ação / Aventura", 
    ano: 2018, 
    capa: "https://m.media-amazon.com/images/M/MV5BNjJiNTFhY2QtNzZkYi00MDNiLWEzNGEtNWE1NzBkOWIxNmY5XkEyXkFqcGc@._V1_.jpg" 
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

// Aplicando os middlewares globais (exceto na rota visual e PDF)
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/jogos/pdf' || req.path === '/ui') return next();
  verificarDiasUteis(req, res, next);
});

app.use(registrarLog);

// Rota Visual com capas verticais estilizadas (Tailwind CSS)
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
    <body class="bg-gray-950 text-white min-h-screen font-sans">
        <div class="container mx-auto px-4 py-12">
            <header class="text-center mb-12">
                <h1 class="text-4xl font-extrabold text-indigo-400 mb-3 tracking-wide">Gerenciador de Jogos</h1>
                <div class="mt-6 flex justify-center gap-4">
                    <a href="/jogos" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg">Ver JSON da API</a>
                    <a href="/jogos/pdf" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg">Descarregar PDF (Requisito H)</a>
                </div>
            </header>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                ${jogos.map(jogo => `
                    <div class="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 hover:border-indigo-500 hover:scale-105 transition duration-300 flex flex-col">
                        <!-- Capa em formato vertical (Proporção 3:4 estilo Xbox/Store) -->
                        <div class="aspect-[3/4] w-full overflow-hidden bg-gray-800 relative">
                            <img src="${jogo.capa}" alt="${jogo.titulo}" class="w-full h-full object-cover">
                        </div>
                        <div class="p-5 flex flex-col flex-grow justify-between">
                            <div>
                                <span class="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-md border border-indigo-800/50">${jogo.genero}</span>
                                <h3 class="text-lg font-bold mt-3 mb-1 text-white leading-snug">${jogo.titulo}</h3>
                                <p class="text-gray-400 text-sm">Lançamento: <span class="text-gray-200 font-semibold">${jogo.ano}</span></p>
                            </div>
                            <div class="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
                                <span>ID: ${jogo.id}</span>
                                <span class="text-emerald-400 font-medium">Disponível</span>
                            </div>
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

// Requisito H: Rota GET que gera um arquivo PDF otimizado para ambiente Serverless (Vercel)
app.get('/jogos/pdf', (req, res) => {
  const doc = new PDFDocument();
  let buffers = [];

  doc.on('data', chunk => buffers.push(chunk));
  doc.on('end', () => {
    let pdfBuffer = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=lista-de-jogos.pdf');
    res.send(pdfBuffer);
  });

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
  const novoJogo = { id, titulo, genero, ano, capa: capa || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80&ar=3:4" };
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
