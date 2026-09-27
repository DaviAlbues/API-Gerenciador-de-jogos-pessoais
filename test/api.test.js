const test = require('node:test');
const assert = require('node:assert/strict');
const { criarApp } = require('../index');

async function servidor(iso, executar) {
  const app = criarApp({ agora: () => new Date(iso) });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await executar(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('lista, consulta, adiciona e remove jogos; gera PDF e consulta os logs', async () => {
  await servidor('2026-09-28T15:20:00Z', async (base) => {
    let resposta = await fetch(`${base}/jogos`);
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).length, 3);

    resposta = await fetch(`${base}/jogos/1`);
    assert.equal((await resposta.json()).id, '1');
    assert.equal((await fetch(`${base}/jogos/inexistente`)).status, 404);

    const novo = { id: '4', titulo: 'Jogo de teste', genero: 'Aventura', ano: 2024 };
    resposta = await fetch(`${base}/jogos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo)
    });
    assert.equal(resposta.status, 201);
    assert.equal((await resposta.json()).id, '4');
    assert.equal((await fetch(`${base}/jogos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo)
    })).status, 409);

    resposta = await fetch(`${base}/jogos/pdf`);
    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get('content-type'), /application\/pdf/);
    assert.match(resposta.headers.get('content-disposition'), /attachment/);
    assert.equal(Buffer.from(await resposta.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

    resposta = await fetch(`${base}/jogos/4`, { method: 'DELETE' });
    assert.equal(resposta.status, 200);
    assert.equal((await fetch(`${base}/jogos/4`)).status, 404);
    assert.equal((await fetch(`${base}/logs?data=2026-02-30`)).status, 400);
    resposta = await fetch(`${base}/logs?data=2026-09-28`);
    const logs = await resposta.json();
    assert.ok(logs.some((log) => log.rota === '/jogos/pdf' && log.horario === '12:20:00'));
    assert.ok(logs.some((log) => log.metodo === 'DELETE' && log.rota === '/jogos/4'));
  });
});

test('bloqueia sábado e domingo, inclusive página inicial e PDF', async () => {
  for (const dia of ['2026-09-26T15:00:00Z', '2026-09-27T15:00:00Z']) {
    await servidor(dia, async (base) => {
      for (const rota of ['/', '/jogos', '/jogos/pdf', '/logs?data=2026-09-27']) {
        assert.equal((await fetch(base + rota)).status, 403);
      }
    });
  }
});
