const express = require('express');
const path = require('path');
const multer = require('multer');
const { put } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

// 環境変数から管理者IDとパスワードを取得（設定されていない場合は初期値）
const ADMIN_ID = process.env.ID || 'admin';
const ADMIN_PASSWORD = process.env.PASSWORD || 'password123';

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let files = [
    {
        id: "sample-apk",
        title: "CpadFiles サンプル",
        description: "Vercel Blob対応のサンプルファイルです。",
        fileUrl: "https://github.com/exfat-dev3/dcha-video-site",
        author: "まろんおにいちゃん",
        createdAt: "2026-10-23"
    }
];

// ファイル一覧取得（誰でも閲覧可能）
app.get('/api/files', (req, res) => {
    res.json(files);
});

// ファイルアップロードAPI（誰でも投稿可能、バリデーション付き）
app.post('/api/files', upload.single('file'), async (req, res) => {
    const { title, description, author } = req.body;
    const uploadedFile = req.file;

    if (!title || !uploadedFile || !author) {
        return res.status(400).json({ error: 'タイトル、ファイル、投稿者は必須です' });
    }

    const authorRegex = /^[ぁ-んァ-ンー一-龠a-zA-Z0-9]{5,}$/;
    if (!authorRegex.test(author)) {
        return res.status(400).json({ error: 'ユーザー名は5文字以上の日本語・英語・数字のみで入力してください。' });
    }

    try {
        const blob = await put(uploadedFile.originalname, uploadedFile.buffer, {
            access: 'public',
        });

        const newFile = {
            id: Date.now().toString(),
            title: title,
            description: description || '',
            fileUrl: blob.url,
            author: author,
            createdAt: new Date().toLocaleDateString()
        };

        files.unshift(newFile);
        res.json({ success: true, file: newFile });
    } catch (error) {
        console.error('Blobアップロードエラー:', error);
        res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
    }
});

// 管理者ログインAPI（Basic認証を使用）
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_ID && password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'IDまたはパスワードが間違っています。' });
    }
});

// ファイル削除API（管理者ページからのみ呼び出し）
app.delete('/api/files/:id', (req, res) => {
    // 簡易的なBasic認証ヘッダーチェックまたは管理用エンドポイント
    const fileId = req.params.id;
    const index = files.findIndex(f => f.id === fileId);

    if (index === -1) return res.status(404).json({ error: 'ファイルが見つかりません' });

    files.splice(index, 1);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});