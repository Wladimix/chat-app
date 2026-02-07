export interface User {
    login: string;
    password: string;
    online: boolean;
    wsConnectionId?: string;
}

export interface Message {
    id: string;
    from: string;
    to: string;
    text: string;
    timestamp: Date;
}

export interface WebSocketMessage {
    type: 'message' | 'typing' | 'register' | 'user_status' | 'message_sent';
    from?: string;
    to?: string;
    text?: string;
    timestamp?: number;
    id?: string;
    user?: string;
    online?: boolean;
}
