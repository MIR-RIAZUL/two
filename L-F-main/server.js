import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = __dirname;
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
const dbFile = path.join(dataDir, 'lost-found.sqlite');
const port = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'lost-found-dev-secret';

// Debug logging
const DEBUG = process.env.DEBUG !== 'false';
const log = (...args) => DEBUG && console.log('[INFO]', ...args);
const error = (...args) => console.error('[ERROR]', ...args);

await fs.promises.mkdir(dataDir, { recursive: true });
await fs.promises.mkdir(uploadDir, { recursive: true });

const SQL = await initSqlJs({
  locateFile: (fileName) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules', 'sql.js', 'dist', fileName)
});

const database = fs.existsSync(dbFile)
  ? new SQL.Database(fs.readFileSync(dbFile))
  : new SQL.Database();

function persistDatabase() {
  try {
    const bytes = database.export();
    fs.writeFileSync(dbFile, Buffer.from(bytes));
  } catch (err) {
    error('Database persist failed:', err.message);
  }
}

function exec(sql, params = []) {
  try {
    const statement = database.prepare(sql);
    statement.bind(params);
    const rows = [];
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
    statement.free();
    return rows;
  } catch (err) {
    error('Database exec error:', sql.slice(0, 50), err.message);
    return [];
  }
}

function getOne(sql, params = []) {
  const rows = exec(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  try {
    const statement = database.prepare(sql);
    statement.bind(params);
    statement.step();
    statement.free();
    persistDatabase();
  } catch (err) {
    error('Database run error:', sql.slice(0, 50), err.message);
  }
}

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    reward TEXT,
    image_url TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender_user_id INTEGER,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_user_id) REFERENCES users(id)
  );
`);

if ((getOne('SELECT COUNT(*) AS count FROM users')?.count || 0) === 0) {
  const hashed = bcrypt.hashSync('password123', 10);
  const now = new Date().toISOString();
  run('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)', ['Demo User', 'demo@lostfound.local', hashed, now]);
  run('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)', ['Admin', 'admin@lostfound.local', hashed, now]);
}

if ((getOne('SELECT COUNT(*) AS count FROM reports')?.count || 0) === 0) {
  const now = new Date().toISOString();
  run(`
    INSERT INTO reports (user_id, title, category, status, location, description, reward, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [1, 'Red Backpack', 'Bag', 'Lost', 'Dhanmondi', 'Black laptop inside, last seen near Dhanmondi 27.', '500', '', now]);
  run(`
    INSERT INTO reports (user_id, title, category, status, location, description, reward, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [2, 'Silver iPhone 12', 'Electronics', 'Found', 'Banani', 'Recovered at a security desk.', '', '', now]);
}

if ((getOne('SELECT COUNT(*) AS count FROM conversations')?.count || 0) === 0) {
  const now = new Date().toISOString();
  run('INSERT INTO conversations (report_id, title, created_at) VALUES (?, ?, ?)', [1, 'Red Backpack', now]);
  run('INSERT INTO messages (conversation_id, sender_user_id, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?)', [1, 1, 'Rafiul H.', 'I think I saw your backpack.', now]);
  run('INSERT INTO messages (conversation_id, sender_user_id, sender_name, body, created_at) VALUES (?, ?, ?, ?, ?)', [1, 2, 'Demo User', 'Thanks, can you share the location?', now]);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'upload';
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
    }
  }
});

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(publicDir));

function sendJson(res, statusCode, data) {
  res.status(statusCode).json(data);
}

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    log('Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function runMaybeMultipart(req, res, next) {
  if (req.is('multipart/form-data')) {
    return upload.single('image')(req, res, next);
  }
  return next();
}

function getReports() {
  return exec(`
    SELECT
      r.id,
      r.user_id AS userId,
      u.name AS authorName,
      r.title,
      r.category,
      r.status,
      r.location,
      r.description,
      r.reward,
      r.image_url AS imageUrl,
      r.created_at AS createdAt
    FROM reports r
    LEFT JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC, r.id DESC
  `);
}

function getConversationById(conversationId) {
  return getOne('SELECT * FROM conversations WHERE id = ?', [conversationId]);
}

function getOrCreateConversation(reportId, title) {
  let conversation = getOne('SELECT * FROM conversations WHERE report_id = ?', [reportId]);
  if (!conversation) {
    const createdAt = new Date().toISOString();
    run('INSERT INTO conversations (report_id, title, created_at) VALUES (?, ?, ?)', [reportId, title, createdAt]);
    conversation = getOne('SELECT * FROM conversations WHERE report_id = ?', [reportId]);
  }
  return conversation;
}

app.get('/api/health', (_req, res) => {
  sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 6) {
      return sendJson(res, 400, { error: 'Name, email, and a 6+ character password are required.' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { error: 'Invalid email format.' });
    }

    const existing = getOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return sendJson(res, 409, { error: 'Email already exists.' });
    }

    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 10);
    run('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)', [name, email, passwordHash, now]);
    const user = getOne('SELECT id, name, email, created_at AS createdAt FROM users WHERE email = ?', [email]);

    log(`User registered: ${email}`);
    sendJson(res, 201, { user, token: createToken(user) });
  } catch (err) {
    error('Register endpoint error:', err.message);
    sendJson(res, 500, { error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }

    const user = getOne('SELECT id, name, email, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }

    log(`User logged in: ${email}`);
    sendJson(res, 200, {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      token: createToken(user)
    });
  } catch (err) {
    error('Login endpoint error:', err.message);
    sendJson(res, 500, { error: 'Login failed.' });
  }
});

app.get('/api/me', authenticate, (req, res) => {
  sendJson(res, 200, { user: req.user });
});

app.get('/api/reports', (_req, res) => {
  sendJson(res, 200, getReports());
});

app.post('/api/reports', runMaybeMultipart, (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || '').trim();
    const status = String(req.body.status || 'Lost').trim();
    const location = String(req.body.location || '').trim();
    const description = String(req.body.description || '').trim();
    const reward = String(req.body.reward || '').trim();
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : String(req.body.imageUrl || '').trim();

    if (!title || !category || !location) {
      return sendJson(res, 400, { error: 'Title, category, and location are required.' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let userId = null;

    if (token) {
      try {
        userId = jwt.verify(token, JWT_SECRET).id;
      } catch (err) {
        log('Report token verification:', err.message);
        userId = null;
      }
    }

    const createdAt = new Date().toISOString();
    run(`
      INSERT INTO reports (user_id, title, category, status, location, description, reward, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, title, category, status, location, description, reward, imageUrl, createdAt]);

    const report = getOne(`
      SELECT
        r.id,
        r.user_id AS userId,
        u.name AS authorName,
        r.title,
        r.category,
        r.status,
        r.location,
        r.description,
        r.reward,
        r.image_url AS imageUrl,
        r.created_at AS createdAt
      FROM reports r
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.id DESC
      LIMIT 1
    `);

    log(`Report created: ${title} (${category})`);
    sendJson(res, 201, report);
  } catch (err) {
    error('Create report error:', err.message);
    sendJson(res, 500, { error: 'Failed to create report.' });
  }
});

app.get('/api/conversations', (_req, res) => {
  const conversations = exec(`
    SELECT
      c.id,
      c.report_id AS reportId,
      c.title,
      c.created_at AS createdAt,
      r.title AS reportTitle,
      (
        SELECT body
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) AS lastMessage,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
      ) AS messageCount
    FROM conversations c
    LEFT JOIN reports r ON r.id = c.report_id
    ORDER BY c.created_at DESC, c.id DESC
  `);

  sendJson(res, 200, conversations);
});

app.post('/api/conversations', (req, res) => {
  const reportId = Number(req.body.reportId);
  if (!reportId) {
    return sendJson(res, 400, { error: 'reportId is required.' });
  }

  const report = getOne('SELECT id, title FROM reports WHERE id = ?', [reportId]);
  if (!report) {
    return sendJson(res, 404, { error: 'Report not found.' });
  }

  const conversation = getOrCreateConversation(report.id, report.title);
  sendJson(res, 200, conversation);
});

app.get('/api/messages', (req, res) => {
  const conversationId = Number(req.query.conversationId);
  const limit = Math.min(Number(req.query.limit || 20) || 20, 100);

  if (conversationId) {
    const messages = exec(`
      SELECT
        m.id,
        m.conversation_id AS conversationId,
        m.sender_user_id AS senderUserId,
        m.sender_name AS senderName,
        m.body,
        m.created_at AS createdAt,
        c.report_id AS reportId,
        r.title AS reportTitle
      FROM messages m
      LEFT JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN reports r ON r.id = c.report_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC, m.id ASC
    `, [conversationId]);

    return sendJson(res, 200, messages);
  }

  const messages = exec(`
    SELECT
      m.id,
      m.conversation_id AS conversationId,
      m.sender_user_id AS senderUserId,
      m.sender_name AS senderName,
      m.body,
      m.created_at AS createdAt,
      c.report_id AS reportId,
      r.title AS reportTitle
    FROM messages m
    LEFT JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN reports r ON r.id = c.report_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ?
  `, [limit]);

  sendJson(res, 200, messages);
});

app.post('/api/messages', (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    const senderName = String(req.body.senderName || '').trim();
    const conversationIdRaw = Number(req.body.conversationId);
    const reportIdRaw = Number(req.body.reportId);

    if (!body || !senderName) {
      return sendJson(res, 400, { error: 'senderName and body are required.' });
    }

    let conversation = null;
    if (conversationIdRaw) {
      conversation = getConversationById(conversationIdRaw);
    } else if (reportIdRaw) {
      const report = getOne('SELECT id, title FROM reports WHERE id = ?', [reportIdRaw]);
      if (report) {
        conversation = getOrCreateConversation(report.id, report.title);
      }
    }

    if (!conversation) {
      return sendJson(res, 400, { error: 'conversationId or reportId is required.' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let senderUserId = null;
    if (token) {
      try {
        senderUserId = jwt.verify(token, JWT_SECRET).id;
      } catch (err) {
        log('Message token verification:', err.message);
        senderUserId = null;
      }
    }

    const createdAt = new Date().toISOString();
    run(`
      INSERT INTO messages (conversation_id, sender_user_id, sender_name, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [conversation.id, senderUserId, senderName, body, createdAt]);

    const message = getOne(`
      SELECT
        m.id,
        m.conversation_id AS conversationId,
        m.sender_user_id AS senderUserId,
        m.sender_name AS senderName,
        m.body,
        m.created_at AS createdAt,
        c.report_id AS reportId,
        r.title AS reportTitle
      FROM messages m
      LEFT JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN reports r ON r.id = c.report_id
      ORDER BY m.id DESC
      LIMIT 1
    `);

    log(`Message sent by ${senderName}`);
    sendJson(res, 201, message);
  } catch (err) {
    error('Message endpoint error:', err.message);
    sendJson(res, 500, { error: 'Failed to send message.' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'API route not found.' });
  }
  const indexPath = path.join(publicDir, 'index.html');
  return res.sendFile(indexPath, (err) => {
    if (err && DEBUG) error('Error serving index.html:', err.message);
  });
});

app.listen(port, () => {
  console.log(`✅ Lost & Found backend running at http://localhost:${port}`);
  console.log(`📁 Database: ${dbFile}`);
  console.log(`📤 Uploads: ${uploadDir}`);
});
