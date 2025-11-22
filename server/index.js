import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET /api/posts?tag=Q&A|TIP|BUG|SHOW|ALL&sort=latest|votes&q=검색어&limit=20&offset=0&include=comments
 * 기본: 최신순, include=comments 포함
 */
app.get('/api/posts', async (req, res) => {
  try {
    const tag = req.query.tag || 'ALL';
    const sort = req.query.sort === 'votes' ? 'votes' : 'latest';
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const include = (req.query.include || 'comments') === 'comments';

    const where = [];
    const params = [];
    if (tag !== 'ALL') { where.push('tag = ?'); params.push(tag); }
    if (q) { where.push('(title LIKE ? OR body LIKE ? OR author LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = sort === 'votes' ? 'ORDER BY votes DESC, created_at DESC' : 'ORDER BY created_at DESC';

    const [posts] = await pool.execute(
      `SELECT id, title, body, tag, author, votes, created_at
       FROM posts
       ${whereSql}
       ${orderSql}
       LIMIT ? OFFSET ?`, [...params, limit, offset]
    );

    if (!include || posts.length === 0) {
      return res.json({ items: posts });
    }

    const ids = posts.map(p => p.id);
    // mysql2에서 IN (?)에 배열을 넘기면 자동 확장됨
    const [comments] = await pool.query(
      `SELECT id, post_id, author, body, created_at
       FROM comments
       WHERE post_id IN (?) 
       ORDER BY created_at ASC`, [ids]
    );

    const byPost = new Map();
    for (const p of posts) byPost.set(p.id, { ...p, comments: [] });
    for (const c of comments) {
      byPost.get(c.post_id)?.comments.push(c);
    }

    res.json({ items: Array.from(byPost.values()) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { title, body, tag = 'Q&A', author = '익명' } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'title, body 필요' });
    const [r] = await pool.execute(
      `INSERT INTO posts (title, body, tag, author) VALUES (?, ?, ?, ?)`,
      [title, body, tag, author]
    );
    const id = r.insertId;
    const [[post]] = await pool.query(`SELECT * FROM posts WHERE id = ?`, [id]);
    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/posts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, body, tag } = req.body || {};
    const fields = [], params = [];
    if (title != null) { fields.push('title = ?'); params.push(title); }
    if (body  != null) { fields.push('body = ?');  params.push(body); }
    if (tag   != null) { fields.push('tag = ?');   params.push(tag);  }
    if (fields.length === 0) return res.status(400).json({ error: '변경할 필드가 없음' });

    params.push(id);
    await pool.execute(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, params);
    const [[post]] = await pool.query(`SELECT * FROM posts WHERE id = ?`, [id]);
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM posts WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/posts/:id/vote', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const delta = Number(req.body?.delta || 1);
    await pool.execute(`UPDATE posts SET votes = GREATEST(-999999, LEAST(999999, votes + ?)) WHERE id = ?`, [delta, id]);
    const [[post]] = await pool.query(`SELECT * FROM posts WHERE id = ?`, [id]);
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { author = '익명', body } = req.body || {};
    if (!body) return res.status(400).json({ error: '댓글 body 필요' });
    const [r] = await pool.execute(
      `INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)`,
      [postId, author, body]
    );
    const id = r.insertId;
    const [[c]] = await pool.query(`SELECT * FROM comments WHERE id = ?`, [id]);
    res.status(201).json(c);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.execute(`DELETE FROM comments WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`FS-EDU API listening on http://localhost:${PORT}`);
});