require('dotenv').config(); // Carrega as variáveis do .env
const express = require('express');
const jwt = require('jsonwebtoken'); // Biblioteca para os tokens de login
const app = express();

app.use(express.json());

// --- MOCK DE DADOS (Usuários e Aluguéis) ---
let usuarios = [
  { id: "u1", email: "davi@dono.com", senha: "123", role: "DONO" },
  { id: "u2", email: "cliente@teste.com", senha: "123", role: "CLIENTE" }
];

let alugueis = []; // Inicia a lista de aluguéis vazia

// Requisito I: Dados mockados com capas em formato vertical e suporte a aluguel
let jogos = [
  { 
    id: "1", 
    titulo: "The Witcher 3: Wild Hunt", 
    genero: "RPG de Ação", 
    ano: 2015, 
    capa: "https://image.api.playstation.com/vulcan/ap/rnd/202211/0711/qezXTVn1ExqBjVjR5Ipm97IK.png",
    id_dono: "u1",       // ID do dono (Davi)
    disponivel: true     // Começa disponível para aluguel
  },
  { 
    id: "2", 
    titulo: "God of War", 
    genero: "Ação / Aventura", 
    ano: 2018, 
    capa: "https://m.media-amazon.com/images/M/MV5BNjJiNTFhY2QtNzZkYi00MDNiLWEzNGEtNWE1NzBkOWIxNmY5XkEyXkFqcGc@._V1_.jpg",
    id_dono: "u1",
    disponivel: true
  },
  { 
    id: "3", 
    titulo: "Cyberpunk 2077", 
    genero: "RPG Futurista", 
    ano: 2020, 
    capa: "https://store-images.s-microsoft.com/image/apps.47379.63407868131364914.bcaa868c-407e-42c2-baeb-48a3c9f29b54.89bb995b-b066-4a53-9fe4-0260ce07e894",
    id_dono: "u1",
    disponivel: true
  }
];

let logsRequisicoes = [];


// Requisito E: Middleware que permite acesso apenas de segunda a sexta-feira
const verificarDiasUteis = (req, res, next) => {
  const diaSemana = new Date().getDay(); // 0 = Domingo, 6 = Sábado
  if (diaSemana === 1, diaSemana === 1) {
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
    horario: agora.toLocaleTimeString('pt-BR', { 
      timeZone: 'America/Sao_Paulo', 
      hour12: false 
    }),
    metodo: req.method,
    rota: req.originalUrl
  });
  next();
};

// Aplicando os middlewares globais 
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/jogos/pdf' || req.path === '/ui') return next();
  verificarDiasUteis(req, res, next);
});

app.use(registrarLog);


// --- SISTEMA DE LOGIN E SEGURANÇA ---

// Rota de Login (Gera o Token)
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  
  // Procura o usuário na lista
  const usuario = usuarios.find(u => u.email === email && u.senha === senha);
  
  if (!usuario) {
    return res.status(401).json({ erro: "Email ou senha incorretos." });
  }

 const token = jwt.sign(
    { id: usuario.id, role: usuario.role }, 
    'chave_secreta_fixa_psw2', 
    { expiresIn: '2h' }
  );
  
  res.json({ mensagem: "Login efetuado com sucesso!", token, papel: usuario.role });
});

// Middleware: Verifica se o usuário tem um Token JWT válido
const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization']; // Pega o cabeçalho Authorization
  const token = authHeader && authHeader.split(' ')[1]; // Formato esperado: "Bearer token_aqui"

  if (!token) {
    return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
  }

 // Verifica se o token é válido usando a chave fixa
jwt.verify(token, 'chave_secreta_fixa_psw2', (err, usuarioDecodificado) => {
    if (err) {
      return res.status(403).json({ erro: "Token inválido ou expirado." });
    }
    // Salva os dados do usuário na requisição para as próximas rotas usarem
    req.usuario = usuarioDecodificado; 
    next(); // Deixa a requisição continuar
  });
};

// Middleware: Garante que apenas o DONO acesse a rota
const apenasDono = (req, res, next) => {
  if (req.usuario.role !== 'DONO') {
    return res.status(403).json({ erro: "Acesso negado. Apenas o dono pode realizar esta ação." });
  }
  next(); // É dono, pode passar
};

// ATENÇÃO: Atualize o seu app.use() existente que aplica as regras de dias úteis
// Adicionei o '/login' na lista de exceções para permitir login sempre
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/jogos/pdf' || req.path === '/ui' || req.path === '/login') return next();
  verificarDiasUteis(req, res, next);
});


// --- SISTEMA DE ALUGUEL (Visão Cliente) ---

// Rota: Cliente ver apenas jogos disponíveis
app.get('/jogos/disponiveis', autenticar, (req, res) => {
  const disponiveis = jogos.filter(j => j.disponivel === true);
  res.json(disponiveis);
});

// Rota: Cliente alugar um jogo
app.post('/alugar/:id_jogo', autenticar, (req, res) => {
  const jogo = jogos.find(j => j.id === req.params.id_jogo);
  
  if (!jogo) return res.status(404).json({ erro: "Jogo não encontrado." });
  if (!jogo.disponivel) return res.status(409).json({ erro: "Este jogo já está alugado no momento." });

  // Cria um registro na lista de alugueis
  const novoAluguel = {
    id: Date.now().toString(), // Gera um ID único baseado na data
    id_jogo: jogo.id,
    id_cliente: req.usuario.id, // Pega o ID de quem fez a requisição (do Token)
    data_emprestimo: new Date().toISOString(),
    status: "ATIVO"
  };
  
  alugueis.push(novoAluguel);
  jogo.disponivel = false; // Bloqueia o jogo para outros

  res.status(201).json({ mensagem: "Jogo alugado com sucesso!", aluguel: novoAluguel });
});

// Rota: Cliente devolver um jogo
app.put('/devolver/:id_aluguel', autenticar, (req, res) => {
  const aluguel = alugueis.find(a => a.id === req.params.id_aluguel);
  
  if (!aluguel) return res.status(404).json({ erro: "Registro de aluguel não encontrado." });
  
  // Verifica se quem está devolvendo é o mesmo cliente que alugou
  if (aluguel.id_cliente !== req.usuario.id) {
    return res.status(403).json({ erro: "Você só pode devolver os jogos que você mesmo alugou." });
  }
  
  if (aluguel.status === "CONCLUIDO") {
    return res.status(400).json({ erro: "Este jogo já consta como devolvido." });
  }

  const jogo = jogos.find(j => j.id === aluguel.id_jogo);
  
  aluguel.status = "CONCLUIDO";
  aluguel.data_devolucao = new Date().toISOString();
  if (jogo) jogo.disponivel = true; // Libera o jogo no catálogo

  res.json({ mensagem: "Jogo devolvido com sucesso! Obrigado.", aluguel });
});

// Visão Dono: Ver o status de todos os seus jogos e quem alugou
app.get('/meus-jogos', autenticar, apenasDono, (req, res) => {
  const acervo = jogos.filter(j => j.id_dono === req.usuario.id);
  res.json(acervo);
});

// Rota Visual com capas verticais estilizadas
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
                    <a href="/jogos/pdf" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg">Gerar Relatório PDF (Requisito H)</a>
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
                                ${jogo.disponivel 
                                ? '<span class="text-emerald-400 font-medium">Disponível</span>' 
                                : '<span class="text-red-400 font-medium">Alugado</span>'
                                }
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

// Requisito H: Rota GET que gera um relatório otimizado em PDF 
app.get('/jogos/pdf', (req, res) => {
  const htmlPdf = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Jogos - PSW2</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { text-align: center; color: #4f46e5; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #4f46e5; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #777; }
        </style>
    </head>
    <body onload="window.print()">
        <h1>Relatório de Jogos - API PSW2</h1>
        <p><strong>Instituição:</strong> IFCE Campus Crato | <strong>Disciplina:</strong> PSW2</p>
        <hr>
        <table>
            <thead>
                <tr>
                    <th>Código ID</th>
                    <th>Título do Jogo</th>
                    <th>Gênero</th>
                    <th>Ano</th>
                </tr>
            </thead>
            <tbody>
                ${jogos.map(j => `
                    <tr>
                        <td>${j.id}</td>
                        <td>${j.titulo}</td>
                        <td>${j.genero}</td>
                        <td>${j.ano}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="footer">
            <p>Gerado automaticamente pela API de Gerenciador de Jogos Pessoais (Requisito H)</p>
        </div>
    </body>
    </html>
  `;
  res.send(htmlPdf);
});

// Requisito D: Rota GET para pesquisar um item pelo código (ID)
app.get('/jogos/:id', (req, res) => {
  const jogo = jogos.find(j => j.id === req.params.id);
  if (!jogo) {
    return res.status(404).json({ erro: "Item não encontrado com este código." });
  }
  res.json(jogo);
});

// Requisito B: Rota POST para inserir um novo item (AGORA PROTEGIDA PARA O DONO)
app.post('/jogos', autenticar, apenasDono, (req, res) => {
  // Adicionamos o campo 'capa' na desestruturação do req.body
  const { id, titulo, genero, ano, capa } = req.body;
  
  if (!id || !titulo) {
    return res.status(400).json({ erro: "ID e Título são obrigatórios." });
  }

  const jogoExistente = jogos.find(j => j.id === id);
  if (jogoExistente) {
    return res.status(409).json({ erro: "Já existe um jogo cadastrado com este ID." });
  }

  const novoJogo = { 
    id, 
    titulo, 
    genero, 
    ano, 
    // Se o usuário mandar a URL da capa, usamos ela. Se não, usamos uma imagem padrão genérica
    capa: capa || "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80&ar=3:4",
    id_dono: req.usuario.id,
    disponivel: true
  };
  
  jogos.push(novoJogo);
  res.status(201).json({ mensagem: "Item inserido com sucesso!", novoJogo });
});

// Requisito C: Rota DELETE para excluir um item (AGORA PROTEGIDA PARA O DONO)
app.delete('/jogos/:id', autenticar, apenasDono, (req, res) => {
  const tamanhoAnterior = jogos.length;
  jogos = jogos.filter(j => j.id !== req.params.id);
  
  if (jogos.length === tamanhoAnterior) {
    return res.status(404).json({ erro: "Item não encontrado para exclusão." });
  }
  res.status(200).json({ mensagem: "Item excluído com sucesso." });
});

// Requisito G: Rota GET que retorna os registros de requisição em uma data informada
app.get('/logs', (req, res) => {
  const { data } = req.query; 
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
