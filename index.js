require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const { randomInt } = require('crypto');

const app = express();
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não autorizada pelo CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['DONO', 'CLIENTE'], default: 'CLIENTE' },
  otpHash: String,
  otpExpiresAt: Date
}, { timestamps: true });
const gameSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  genero: String, ano: Number, capa: String, imagePublicId: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  disponivel: { type: Boolean, default: true }
}, { timestamps: true });
const rentalSchema = new mongoose.Schema({
  game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['ATIVO', 'CONCLUIDO'], default: 'ATIVO' },
  rentedAt: { type: Date, default: Date.now }, returnedAt: Date
}, { timestamps: true });
const logSchema = new mongoose.Schema({
  date: { type: String, required: true }, time: { type: String, required: true },
  method: String, route: String, status: Number
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);
const Rental = mongoose.models.Rental || mongoose.model('Rental', rentalSchema);
const RequestLog = mongoose.models.RequestLog || mongoose.model('RequestLog', logSchema);
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use((req, res, next) => {
  res.on('finish', () => {
    const now = new Date();
    RequestLog.create({
      date: now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
      time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false }),
      method: req.method, route: req.originalUrl, status: res.statusCode
    }).catch(() => {});
  });
  next();
});

const signToken = user => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ erro: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
});
const ownerOnly = (req, res, next) => req.user.role === 'DONO'
  ? next() : res.status(403).json({ erro: 'Apenas o dono pode executar esta ação.' });
const transporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.post('/auth/register', asyncRoute(async (req, res) => {
  const { email, senha, role } = req.body;
  if (!email || !senha || senha.length < 8) return res.status(400).json({ erro: 'Informe email e senha com pelo menos 8 caracteres.' });
  if (role && role !== 'CLIENTE') return res.status(400).json({ erro: 'O cadastro público permite apenas CLIENTE.' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ erro: 'Email já cadastrado.' });
  const assignedRole = process.env.OWNER_EMAIL && email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase() ? 'DONO' : 'CLIENTE';
  const user = await User.create({ email, passwordHash: await bcrypt.hash(senha, 12), role: assignedRole });
  res.status(201).json({ id: user._id, email: user.email, role: user.role });
}));

app.post('/login', asyncRoute(async (req, res) => {
  const { email, senha } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(senha || ''), user.passwordHash))) return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  if (!process.env.SMTP_HOST) return res.status(503).json({ erro: '2FA por email não configurado no servidor.' });
  const otp = String(randomInt(100000, 1000000));
  user.otpHash = await bcrypt.hash(otp, 10);
  user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  await transporter().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email, subject: 'Código de verificação', text: `Seu código de verificação é ${otp}. Ele expira em 10 minutos.` });
  res.json({ mensagem: 'Código de verificação enviado para o email cadastrado.' });
}));
app.post('/login/verify', asyncRoute(async (req, res) => {
  const { email, codigo } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date() || !(await bcrypt.compare(String(codigo || ''), user.otpHash))) return res.status(401).json({ erro: 'Código inválido ou expirado.' });
  user.otpHash = undefined; user.otpExpiresAt = undefined; await user.save();
  res.json({ mensagem: 'Login efetuado com sucesso.', token: signToken(user), papel: user.role });
}));

app.get('/jogos', asyncRoute(async (req, res) => res.json(await Game.find().populate('owner', 'email'))));
app.get('/jogos/export.csv', authenticate, ownerOnly, asyncRoute(async (req, res) => {
  const games = await Game.find().populate('owner', 'email').lean();
  const headers = ['id', 'titulo', 'genero', 'ano', 'capa', 'disponivel', 'ownerEmail'];
  const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const rows = games.map(g => [g._id, g.titulo, g.genero, g.ano, g.capa, g.disponivel, g.owner?.email]);
  const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="jogos.csv"');
  res.send('\uFEFF' + csv);
}));
app.get('/jogos/:id', asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ erro: 'Jogo não encontrado.' });
  const game = await Game.findById(req.params.id).populate('owner', 'email');
  if (!game) return res.status(404).json({ erro: 'Jogo não encontrado.' });
  res.json(game);
}));
app.post('/jogos', authenticate, ownerOnly, asyncRoute(async (req, res) => {
  const { titulo, genero, ano, capa } = req.body;
  if (!titulo || !String(titulo).trim()) return res.status(400).json({ erro: 'Título é obrigatório.' });
  res.status(201).json(await Game.create({ titulo, genero, ano, capa, owner: req.user._id }));
}));
app.post('/jogos/upload-capa', authenticate, ownerOnly, asyncRoute(async (req, res) => {
  const { image } = req.body;
  if (!image || !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return res.status(400).json({ erro: 'Envie uma imagem PNG, JPEG ou WEBP em base64.' });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ erro: 'Armazenamento de imagens não configurado.' });
  const result = await cloudinary.uploader.upload(image, { folder: 'biblioteca-jogos/capas', resource_type: 'image' });
  res.status(201).json({ url: result.secure_url, publicId: result.public_id });
}));
app.delete('/jogos/:id', authenticate, ownerOnly, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ erro: 'Jogo não encontrado.' });
  const game = await Game.findById(req.params.id);
  if (!game) return res.status(404).json({ erro: 'Jogo não encontrado.' });
  if (game.imagePublicId && process.env.CLOUDINARY_API_SECRET) await cloudinary.uploader.destroy(game.imagePublicId);
  await game.deleteOne();
  res.json({ mensagem: 'Jogo excluído com sucesso.' });
}));
app.get('/jogos/disponiveis', authenticate, asyncRoute(async (req, res) => res.json(await Game.find({ disponivel: true }))));
app.post('/alugar/:id_jogo', authenticate, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id_jogo)) return res.status(404).json({ erro: 'Jogo não encontrado.' });
  const game = await Game.findOneAndUpdate({ _id: req.params.id_jogo, disponivel: true }, { disponivel: false }, { new: true });
  if (!game) return res.status(409).json({ erro: 'Jogo inexistente ou indisponível.' });
  const rental = await Rental.create({ game: game._id, customer: req.user._id });
  res.status(201).json({ mensagem: 'Jogo alugado com sucesso.', aluguel: rental });
}));
app.put('/devolver/:id_aluguel', authenticate, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id_aluguel)) return res.status(404).json({ erro: 'Aluguel não encontrado.' });
  const rental = await Rental.findOne({ _id: req.params.id_aluguel, customer: req.user._id });
  if (!rental) return res.status(404).json({ erro: 'Aluguel não encontrado para este usuário.' });
  if (rental.status === 'CONCLUIDO') return res.status(400).json({ erro: 'Aluguel já devolvido.' });
  rental.status = 'CONCLUIDO'; rental.returnedAt = new Date(); await rental.save();
  await Game.findByIdAndUpdate(rental.game, { disponivel: true });
  res.json({ mensagem: 'Jogo devolvido com sucesso.', aluguel: rental });
}));
app.get('/meus-jogos', authenticate, ownerOnly, asyncRoute(async (req, res) => res.json(await Game.find({ owner: req.user._id }))));
app.get('/logs', authenticate, ownerOnly, asyncRoute(async (req, res) => {
  const { data } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ erro: 'Informe data=AAAA-MM-DD.' });
  res.json(await RequestLog.find({ date: data }).sort({ createdAt: 1 }));
}));
app.get('/jogos/pdf', asyncRoute(async (req, res) => {
  const games = await Game.find().lean();
  const PDFDocument = require('pdfkit'); const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="jogos.pdf"');
  doc.pipe(res); doc.fontSize(18).text('Relatório de Jogos', { align: 'center' }); doc.moveDown();
  games.forEach(g => doc.fontSize(11).text(`${g.titulo} | ${g.genero || '-'} | ${g.ano || '-'} | ${g.disponivel ? 'Disponível' : 'Alugado'}`));
  doc.end();
}));
app.use((err, req, res, next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ erro: 'Origem não permitida.' });
  if (err.code === 11000) return res.status(409).json({ erro: 'Registro duplicado.' });
  console.error(err); res.status(500).json({ erro: 'Erro interno do servidor.' });
});
async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não definida.');
  await mongoose.connect(process.env.MONGODB_URI);
}
if (require.main === module) connectDatabase().then(() => {
  const port = process.env.PORT || 3000; app.listen(port, () => console.log(`API disponível na porta ${port}`));
}).catch(error => { console.error('Falha ao conectar ao MongoDB:', error.message); process.exit(1); });
module.exports = { app, connectDatabase, models: { User, Game, Rental, RequestLog } };
