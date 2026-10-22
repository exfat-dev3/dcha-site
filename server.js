const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 環境変数の読み込み（Vercelやローカル用）
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// JSONデータを受け取れるようにする
app.use(express.json());

// セッションの設定
app.use(session({
    secret: 'dcha-video-secret-key',
    resave: false,
    saveUninitialized: false
}));

// 静的ファイル（publicフォルダ内のHTMLやCSSなど）を配信
app.use(express.static(path.join(__dirname, 'public')));

// 動画データを保存しておく配列（初期サンプル）
let videos = [
    {
        id: "dQw4w9WgXcQ",
        title: "チャレンジパッドを改造してみた",
        description: "懐かしのチャレンジパッドにカスタムOSを導入して遊ぶ動画です。",
        thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        author: "maron_dayo"
    }
];

/* ---------------------------------------------------
   1. Discord 認証ルーティング
--------------------------------------------------- */

// ログインボタンを押したときの処理（Discordの認証画面へ飛ばす）
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// Discord認証後のコールバック処理
app.get('/api/auth/callback/discord', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('認証コードが見つかりませんでした。');
    }

    try {
        // Discordからアクセストークンを取得
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = tokenResponse.data.access_token;

        // ユーザー情報を取得
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                authorization: `Bearer ${accessToken}`
            }
        });

        // セッションにユーザー情報を保存
        req.session.user = userResponse.data;

        // ログイン成功したらトップページにリダイレクト
        res.redirect('/');
    } catch (error) {
        console.error('Discord認証エラー:', error.response?.data || error.message);
        res.status(500).send('認証中にエラーが発生しました。');
    }
});

// 現在ログインしているユーザーの情報を取得するAPI
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: '未ログインです' });
    }
});

// ログアウト処理
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

/* ---------------------------------------------------
   2. 動画 API ルーティング
--------------------------------------------------- */

// 動画一覧を取得するAPI
app.get('/api/videos', (req, res) => {
    res.json(videos);
});

// 新しい動画を投稿するAPI（ログインしている人のみ）
app.post('/api/videos', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインしてください' });
    }

    const { title, description, youtubeId } = req.body;
    if (!title || !youtubeId) {
        return res.status(400).json({ error: 'タイトルとYouTube IDは必須です' });
    }

    const newVideo = {
        id: youtubeId,
        title: title,
        description: description || '',
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        author: req.session.user.username
    };

    videos.unshift(newVideo); // リストの先頭に追加
    res.json({ success: true, video: newVideo });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// 【追加】動画を削除するAPI
app.delete('/api/videos/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'ログインしてください' });
    }

    const videoId = req.params.id;
    const videoIndex = videos.findIndex(v => v.id === videoId);

    if (videoIndex === -1) {
        return res.status(404).json({ error: '動画が見つかりませんでした' });
    }

    const targetVideo = videos[videoIndex];

    // 投稿者本人、もしくは特定の管理者（例: maron_dayo）だけが削除できるようにする
    // ※Discordのusernameやidで判定します
    const isAuthor = targetVideo.authorId === req.session.user.id || targetVideo.author === req.session.user.username;
    // 必要であれば管理者のIDやユーザー名をここで追加できます（例: req.session.user.username === 'your_admin_name'）

    if (!isAuthor) {
        return res.status(403).json({ error: 'この動画を削除する権限がありません' });
    }

    // 動画リストから削除
    videos.splice(videoIndex, 1);
    res.json({ success: true });
});