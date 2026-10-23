const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const { put } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// メモリ上にファイルを一時保持する設定（Vercel Blobへ転送するため）
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(session({
    secret: 'dcha-file-secret-key',
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

let files = [
    {
        id: "sample-apk",
        title: "CpadFiles サンプル",
        description: "Vercel Blob対応のサンプルファイルです。",
        fileUrl: "https://github.com/exfat-dev3/dcha-video-site",
        author: "maron_dayo",
        createdAt: "2026-10-23"
    }
];

/* ---------------------------------------------------
   Discord 認証ルーティング
--------------------------------------------------- */
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

app.get('/api/auth/callback/discord', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('認証コードが見つかりませんでした。');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${accessToken}` }
        });

        req.session.user = userResponse.data;
        res.redirect('/');
    } catch (error) {
        console.error('Discord認証エラー:', error.response?.data || error.message);
        res.status(500).send('認証中にエラーが発生しました。');
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: '未ログインです' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => { res.redirect('/'); });
});

/* ---------------------------------------------------
   ファイル API ルーティング
--------------------------------------------------- */
app.get('/api/files', (req, res) => {
    res.json(files);
});

// ファイルアップロードAPI（Vercel Blobを使用）
app.post('/api/files', upload.single('file'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインしてください' });
    }

    const { title, description } = req.body;
    const uploadedFile = req.file;

    if (!title || !uploadedFile) {
        return res.status(400).json({ error: 'タイトルとファイルは必須です' });
    }

    try {
        // Vercel Blobへファイルをアップロード
        const blob = await put(uploadedFile.originalname, uploadedFile.buffer, {
            access: 'public',
        });

        const newFile = {
            id: Date.now().toString(),
            title: title,
            description: description || '',
            fileUrl: blob.url, // Vercel Blobから発行された公開URL
            author: req.session.user.username,
            createdAt: new Date().toLocaleDateString()
        };

        files.unshift(newFile);
        res.json({ success: true, file: newFile });
    } catch (error) {
        console.error('Blobアップロードエラー:', error);
        res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
    }
});

app.delete('/api/files/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインしてください' });
    }

    const fileId = req.params.id;
    const index = files.findIndex(f => f.id === fileId);

    if (index === -1) return res.status(404).json({ error: 'ファイルが見つかりません' });

    if (files[index].author !== req.session.user.username) {
        return res.status(403).json({ error: '削除権限がありません' });
    }

    files.splice(index, 1);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});