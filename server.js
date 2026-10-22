require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// セッションの設定
app.use(session({
    secret: 'your-random-secret-key', // 適当な秘密鍵
    resave: false,
    saveUninitialized: false,
}));

// 1. ログイン画面（テスト用）
app.get('/', (req, res) => {
    if (req.session.user) {
        res.send(`
            <h1>ログイン中</h1>
            <p>ようこそ、${req.session.user.username}#${req.session.user.discriminator} さん！</p>
            <img src="https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png" width="100">
            <br><a href="/logout">ログアウト</a>
        `);
    } else {
        res.send(`
            <h1>動画サイト ログインテスト</h1>
            <a href="/auth/discord" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Discordでログイン
            </a>
        `);
    }
});

// 2. Discordの認証画面へリダイレクト
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// 3. 認証後のコールバック処理
app.get('/api/auth/callback/discord', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('認証コードが見つかりません。');

    try {
        // アクセストークンを取得
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // ユーザー情報を取得
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${accessToken}` }
        });

        // セッションにユーザー情報を保存
        req.session.user = userResponse.data;

        // トップページへリダイレクト
        res.redirect('/');
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('認証中にエラーが発生しました。');
    }
});

// ログアウト
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:3000`);
});