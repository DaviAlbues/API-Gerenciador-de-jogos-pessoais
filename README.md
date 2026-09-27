# Biblioteca pessoal de jogos

API HTTP feita com Node.js e Express para cadastrar, consultar, listar e excluir jogos de uma biblioteca pessoal. Trabalho da disciplina de Web 2.

**Integrantes:** Lui Richard Silva Lima e Davi Albues Nunes Alencar.  
**Aplicação publicada:** https://api-gerenciador-de-jogos-pessoais.vercel.app/  
O projeto já possui repositório no GitHub; inclua o endereço aqui se quiser apresentá-lo no README.

Esta documentação descreve **o código desta pasta**. O endereço publicado pode estar em uma versão anterior até que as alterações sejam enviadas ao repositório usado pela Vercel.

## Como funciona

Os jogos começam em um array dentro de `index.js`. Um POST adiciona um jogo e um DELETE o remove. Não há banco de dados: alterações e registros de requisições desaparecem quando o processo reinicia. Na Vercel, instâncias diferentes também podem ter cópias diferentes da lista e dos logs. Para demonstrar o ciclo de cadastro e exclusão com resultados consistentes, rode a API localmente.

Todas as rotas aceitam requisições apenas de **segunda a sexta**, pelo horário de Brasília (`America/Sao_Paulo`). Aos sábados e domingos respondem HTTP 403. Cada requisição, inclusive uma tentativa bloqueada, é registrada em memória com data, horário, método e rota. Como a consulta de logs também é bloqueada no fim de semana, os registros desse período só podem ser consultados em dia útil, enquanto a mesma instância ainda estiver ativa.

## Requisitos

- Node.js 20 ou superior e npm

## Rodar no computador

No terminal, dentro da pasta que contém `package.json`:

```bash
npm ci
npm start
```

A aplicação abre em `http://localhost:3000`. Em outro terminal, rode `npm test` para verificar as principais rotas e as regras de dias úteis. Os testes fixam a data internamente e, por isso, funcionam também no fim de semana.

## Rotas

| Método | Endereço | Resultado |
| --- | --- | --- |
| GET | `/` | Página simples com links para a API |
| GET | `/jogos` | Lista de jogos em JSON |
| GET | `/jogos/:id` | Um jogo pelo ID; 404 se não existir |
| POST | `/jogos` | Adiciona um jogo; responde 201 |
| DELETE | `/jogos/:id` | Exclui o jogo pelo ID; 404 se não existir |
| GET | `/logs?data=AAAA-MM-DD` | Requisições da data informada |
| GET | `/jogos/pdf` | Baixa um arquivo PDF com a lista atual |

Para todas as rotas, o middleware pode responder 403 nos fins de semana. A lista e as buscas respondem JSON. A rota PDF responde `application/pdf` com cabeçalho de download; não é uma página HTML de impressão. As rotas GET podem ser abertas no navegador. Para POST e DELETE, use uma extensão de requisições HTTP, Postman ou os comandos abaixo.

### Formato de um jogo

```json
{
  "id": "4",
  "titulo": "Hollow Knight",
  "genero": "Metroidvania",
  "ano": 2017,
  "capa": "https://exemplo.com/capa.jpg"
}
```

`id` e `titulo` são obrigatórios e devem ser textos não vazios. O ID deve ser único. `genero`, `ano` e `capa` são opcionais. O ano, quando informado, deve ser inteiro a partir de 1950. A capa é apenas uma URL armazenada como texto; o servidor não baixa a imagem.

Respostas de erro comuns: **400** para dados inválidos, **403** para acesso no fim de semana, **404** para jogo inexistente e **409** para ID duplicado.

## Onde está cada requisito da atividade

| Requisito | Implementação |
| --- | --- |
| A — listar itens | `GET /jogos` |
| B — inserir item | `POST /jogos` |
| C — excluir item | `DELETE /jogos/:id` |
| D — pesquisar pelo código | `GET /jogos/:id`; o código é o campo `id` |
| E — acesso apenas de segunda a sexta | Middleware global em `index.js`, pelo horário de Brasília |
| F — registrar horário e rota | Mesmo middleware, antes da verificação do dia; registra também o método |
| G — consultar registros por data | `GET /logs?data=AAAA-MM-DD` |
| H — PDF para download | `GET /jogos/pdf`, gerado com PDFKit |
| I — dados mockados | Array `jogos` em `index.js`, sem banco |
| J — versionamento no GitHub | Repositório da equipe já publicado, conforme informado pelos integrantes; link não fornecido |
| L — aplicação em nuvem | URL da Vercel informada acima |

## O que acontece com os dados na Vercel

Os jogos e os registros ficam guardados temporariamente enquanto uma cópia do servidor está funcionando. Se ela reiniciar, os jogos voltam à lista inicial e os registros anteriores somem. A Vercel também pode atender duas requisições usando cópias diferentes. Por isso, cadastrar um jogo em uma requisição não garante que ele apareça na próxima consulta feita no endereço público.

Essa escolha atende ao pedido do professor de manter os dados no próprio código. Para mostrar cadastro, exclusão e histórico de forma previsível, rode o projeto no computador. O `vercel.json` liga o endereço público à API. Aos sábados e domingos, todas as rotas desta versão respondem 403; o comando `npm test` mostra o bloqueio mesmo quando a apresentação ocorre em outro dia.

## Estrutura

```text
api-web2/
├── index.js             API, dados, middlewares e rotas
├── test/api.test.js      Testes de integração
├── package.json         Dependências e comandos
├── package-lock.json    Versões das dependências
├── vercel.json          Configuração de publicação
├── .gitignore           Arquivos que não vão ao Git
└── README.md            Documentação
```
