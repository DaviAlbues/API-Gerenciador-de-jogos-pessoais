# API Gerenciador de Jogos Pessoais

API REST com Express, MongoDB Atlas, autenticação JWT, senha com hash, verificação em duas etapas por email, upload de capas para Cloudinary e exportação CSV.

## Requisitos

- Node.js 20+
- Conta MongoDB Atlas com cluster e usuário de banco
- Conta Cloudinary para imagens
- SMTP de email para o código de 2FA (por exemplo, credenciais de SMTP de um provedor)

## Configuração local

1. Clone o repositório e entre na pasta.
2. Instale dependências com `npm install`.
3. Copie `.env.example` para `.env` e preencha as variáveis.
4. No MongoDB Atlas, autorize o IP da máquina/servidor e use a connection string em `MONGODB_URI`.
5. Defina `OWNER_EMAIL` com o email que será cadastrado como proprietário. Cadastros públicos só podem criar clientes; esse email é promovido a DONO no registro.
6. Configure o Cloudinary e SMTP se quiser habilitar upload de capa e 2FA.
7. Execute `npm start`; API em `http://localhost:3000`.
8. Execute os testes com `npm test`.

Nunca envie o arquivo `.env` para o GitHub. Use variáveis de ambiente equivalentes no provedor de hospedagem.

## Autenticação e 2FA

- `POST /auth/register`: cadastro público de cliente. Campos: `email`, `senha` (mínimo 8 caracteres). Não aceita atribuição pública de papel DONO.
- `POST /login`: valida email/senha e envia código OTP por email. O SMTP deve estar configurado.
- `POST /login/verify`: recebe `email` e `codigo`; código expira em 10 minutos e, se válido, retorna JWT.
- Rotas protegidas usam `Authorization: Bearer <token>`.

As senhas são armazenadas com bcrypt. O JWT usa `JWT_SECRET`; defina um segredo longo e aleatório.

## Rotas

| Método | Endpoint | Acesso / finalidade |
| --- | --- | --- |
| GET | `/health` | Status |
| GET | `/jogos` | Lista jogos |
| GET | `/jogos/:id` | Detalhes de jogo |
| POST | `/jogos` | DONO: cadastrar jogo |
| DELETE | `/jogos/:id` | DONO: excluir jogo |
| POST | `/jogos/upload-capa` | DONO: upload base64 de imagem PNG/JPEG/WEBP para Cloudinary |
| GET | `/jogos/export.csv` | DONO: baixar CSV dos jogos |
| GET | `/jogos/disponiveis` | Usuário autenticado: jogos disponíveis |
| POST | `/alugar/:id_jogo` | Usuário autenticado: alugar jogo |
| PUT | `/devolver/:id_aluguel` | Cliente do aluguel: devolver |
| GET | `/meus-jogos` | DONO: jogos próprios |
| GET | `/logs?data=AAAA-MM-DD` | DONO: logs por data |
| GET | `/jogos/pdf` | Baixar relatório PDF |

## CORS

Configure `CORS_ORIGIN` com uma lista de origens exatas separadas por vírgula, por exemplo `http://localhost:3000,https://seu-frontend.example`. Não use `*` em produção. Requisições sem cabeçalho Origin (clientes de API/server-to-server) são aceitas; navegadores recebem CORS apenas para origens permitidas.

## Testes

Jest + Supertest + MongoDB Memory Server cobrem cadastro, hash de senha, controle de acesso, CRUD básico, exportação CSV e fluxo de login sem SMTP. O teste pode precisar baixar o binário do MongoDB na primeira execução.

## Deploy

Configure as variáveis de ambiente no serviço de hospedagem e conecte o repositório. Para Vercel, confirme que a configuração de funções e o tempo de conexão do MongoDB são adequados. Não coloque credenciais no código nem em commits.
