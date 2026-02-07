import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { User, Message } from './types';

const connections: Map<string, WebSocket> = new Map();

export function setupWebSocket(
    server: Server,
    users: Record<string, User>,
    sessions: Record<string, string>,
    messages: Message[]
) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
        const connectionId = uuidv4();
        connections.set(connectionId, ws);

        console.log(`Новое соединение WebSocket: ${connectionId}`);

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'register' && message.from) {
                    const user = users[message.from];
                    if (user) {
                        user.online = true;
                        user.wsConnectionId = connectionId;
                        console.log(`Пользователь ${message.from} зарегистрирован через соединение WebSocket с id ${connectionId}`);
                    }

                    broadcastUserStatus(message.from, true);
                }
                else if (message.type === 'message' && message.from && message.to && message.text) {
                    const msgData: Message = {
                        id: uuidv4(),
                        from: message.from,
                        to: message.to,
                        text: message.text,
                        timestamp: new Date(message.timestamp || Date.now())
                    };
                    messages.push(msgData);

                    const recipient = users[message.to];
                    if (recipient && recipient.wsConnectionId) {
                        const recipientWs = connections.get(recipient.wsConnectionId);
                        if (recipientWs) {
                            const response = {
                                type: 'message',
                                id: msgData.id,
                                from: msgData.from,
                                to: msgData.to,
                                text: msgData.text,
                                timestamp: msgData.timestamp.getTime()
                            };
                            recipientWs.send(JSON.stringify(response));
                        }
                    }

                    const confirmation = {
                        type: 'message_sent',
                        id: msgData.id,
                        timestamp: Date.now()
                    };
                    ws.send(JSON.stringify(confirmation));
                }
            } catch (error) {
                console.error('Сообщение об ошибке обработки:', error);
            }
        });

        ws.on('close', () => {
            console.log(`Соединение WebSocket закрыто.: ${connectionId}`);
            connections.delete(connectionId);

            for (const [username, user] of Object.entries(users)) {
                if (user.wsConnectionId === connectionId && user.online) {
                    console.log(`Пользователь ${username} отключился от WebSocket`);
                    break;
                }
            }
        });

        ws.on('error', (error) => {
            console.error('Ошибка WebSocket:', error);
        });
    });

    function broadcastUserStatus(username: string, isOnline: boolean): void {
        const statusMessage = {
            type: 'user_status',
            user: username,
            online: isOnline,
            timestamp: Date.now()
        };

        const messageString = JSON.stringify(statusMessage);

        connections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            }
        });

        console.log(`Статус трансляции: ${username} ${isOnline ? 'в сети' : 'не в сети'}`);
    }

    return {
        broadcastUserStatus
    };
}
