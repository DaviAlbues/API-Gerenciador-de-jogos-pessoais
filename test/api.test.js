const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, models } = require('../index');
let mongo, ownerToken, customerToken;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  process.env.SMTP_HOST = '';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterEach(async () => { await Promise.all(Object.values(models).map(model => model.deleteMany({}))); });
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
async function register(role, email) {
  await request(app).post('/auth/register').send({ email, senha: 'senha-segura-123', role }).expect(201);
  const user = await models.User.findOne({ email });
  return require('jsonwebtoken').sign({ sub: user._id.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
beforeEach(async () => {
  ownerToken = await register('DONO', 'owner@example.com');
  customerToken = await register('CLIENTE', 'customer@example.com');
});
test('health returns ok', async () => { await request(app).get('/health').expect(200, { status: 'ok' }); });
test('passwords are hashed and duplicate email rejected', async () => {
  const user = await models.User.findOne({ email: 'owner@example.com' });
  expect(user.passwordHash).not.toBe('senha-segura-123');
  await request(app).post('/auth/register').send({ email: 'owner@example.com', senha: 'senha-segura-123' }).expect(409);
});
test('owner creates game and game can be listed and fetched', async () => {
  const response = await request(app).post('/jogos').set('Authorization', `Bearer ${ownerToken}`).send({ titulo: 'Hades', genero: 'Roguelike', ano: 2020 }).expect(201);
  await request(app).get('/jogos').expect(200);
  await request(app).get(`/jogos/${response.body._id}`).expect(200);
});
test('owner-only endpoints enforce authentication and role', async () => {
  await request(app).post('/jogos').send({ titulo: 'Hades' }).expect(401);
  await request(app).post('/jogos').set('Authorization', `Bearer ${customerToken}`).send({ titulo: 'Hades' }).expect(403);
  await request(app).get('/jogos/export.csv').set('Authorization', `Bearer ${customerToken}`).expect(403);
});
test('CSV export downloads game data', async () => {
  await models.Game.create({ titulo: 'Hades', owner: (await models.User.findOne({ email: 'owner@example.com' }))._id });
  const response = await request(app).get('/jogos/export.csv').set('Authorization', `Bearer ${ownerToken}`).expect(200);
  expect(response.headers['content-type']).toContain('text/csv');
  expect(response.headers['content-disposition']).toContain('attachment');
  expect(response.text).toContain('Hades');
});
test('login does not issue token when email 2FA is not configured', async () => {
  await request(app).post('/login').send({ email: 'owner@example.com', senha: 'senha-segura-123' }).expect(503);
});
test('owner can delete game', async () => {
  const game = await models.Game.create({ titulo: 'Hades', owner: (await models.User.findOne({ email: 'owner@example.com' }))._id });
  await request(app).delete(`/jogos/${game._id}`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
  expect(await models.Game.findById(game._id)).toBeNull();
});
