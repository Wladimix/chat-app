import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { engine } from 'express-handlebars';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { setupWebSocket } from './websocket';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, '../views'),
    helpers: {
        eq: (a: any, b: any) => a === b,
        formatTime: (date: Date | string) => {
            if (!date) return '';
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        substr: (str: string, start: number, length?: number) => {
            if (!str || typeof str !== 'string') return '';
            if (length === undefined) {
                return str.slice(start);
            }
            return str.slice(start, start + length);
        },
    }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, '../views'));

interface User {
    login: string;
    password: string;
    online: boolean;
    wsConnectionId?: string;
}

interface Message {
    id: string;
    from: string;
    to: string;
    text: string;
    timestamp: Date;
}

const users: Record<string, User> = {};
const sessions: Record<string, string> = {};
const messages: Message[] = [];

let wsServer: any;

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).send('Пожалуйста, введите логин и пароль.');
    }

    if (!users[login]) {
        return res.status(404).send(`Пользователь "${login}" не найден. Пожалуйста, сначала зарегистрируйтесь.`);
    }

    const isValid = await bcrypt.compare(password, users[login].password);
    if (!isValid) {
        return res.status(401).send('Неверный пароль. Пожалуйста, попробуйте еще раз.');
    }

    const sessionId = uuidv4();
    sessions[sessionId] = login;
    users[login].online = true;

    res.redirect(`/users?sessionId=${sessionId}`);
});

app.post('/register', async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).send('Пожалуйста, введите логин и пароль.');
    }

    if (login.length < 3) {
        return res.status(400).send('Логин должен состоять как минимум из 3 символов.');
    }

    if (password.length < 6) {
        return res.status(400).send('Пароль должен состоять как минимум из 6 символов.');
    }

    if (users[login]) {
        return res.status(409).send(`Логин "${login}" уже занят. Пожалуйста, выберите другой.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[login] = {
        login,
        password: hashedPassword,
        online: true
    };

    const sessionId = uuidv4();
    sessions[sessionId] = login;

    res.redirect(`/users?sessionId=${sessionId}`);
});

app.get('/users', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const currentUser = sessions[sessionId];

    if (!currentUser) {
        return res.redirect('/login');
    }

    const otherUsers = Object.keys(users)
        .filter(login => login !== currentUser)
        .map(login => ({
            login,
            online: users[login].online
        }));

    res.render('users', {
        currentUser,
        users: otherUsers,
        sessionId
    });
});

app.get('/chat', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const withUser = req.query.with as string;
    const currentUser = sessions[sessionId];

    if (!currentUser || !withUser) {
        return res.redirect('/login');
    }

    res.render('chat', {
        currentUser,
        withUser,
        sessionId,
        messages: []
    });
});

app.get('/logout', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const currentUser = sessions[sessionId];

    if (currentUser && users[currentUser]) {
        users[currentUser].online = false;
        delete users[currentUser].wsConnectionId;

        if (wsServer && wsServer.broadcastUserStatus) {
            wsServer.broadcastUserStatus(currentUser, false);
        }
    }

    if (sessionId) {
        delete sessions[sessionId];
    }

    res.redirect('/login');
});

app.get('/api/messages', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const withUser = req.query.with as string;
    const currentUser = sessions[sessionId];

    if (!currentUser || !withUser) {
        return res.status(401).json({ error: 'Неавторизованный' });
    }

    const chatMessages = messages.filter(msg =>
        (msg.from === currentUser && msg.to === withUser) ||
        (msg.from === withUser && msg.to === currentUser)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json(chatMessages);
});

wsServer = setupWebSocket(server, users, sessions, messages);

server.listen(PORT, () => {
    console.log(`Сервер работает на порту ${PORT}`);
});

export { users, sessions, messages };
