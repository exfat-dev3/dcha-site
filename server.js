const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 環境変数の読み込み（Vercelやローカルの.env用）
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// セッションの設定
app.use(session({
    secret: 'dcha-video-secret-key',
    resave: false,
    saveUninitialized: false
}));

// 静的ファイル（publicフォルダ内のHTMLやCSSなど）を配信
app.use(express.static(path.join(__dirname, 'public')));

// 1. ログインボタンを押したときの処理（Discordの認証画面へ飛ばす）
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// 2. Discord認証後のコールバック処理
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

// 3. 現在ログインしているユーザーの情報を取得するAPI
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: '未ログインです' });
    }
});

// 4. ログアウト処理
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});