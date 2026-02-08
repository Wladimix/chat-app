## Простой чат
Общение с другими зарегистрированными пользователями в режиме реального времени.

**Установка зависимостей**
```
npm install
```
**Запуск версии для разработки**
```
npm run dev
```
**Сборка production**
```
npm run build
```
**Запуск версии для production**
```
npm run start
```
**Сборка docker контейнера**
```
docker build -t chat-app .
```
**Запуск версии для production в docker контейнере**
```
docker run -p 3000:3000 --name chat-app-container chat-app
```
*Порт: 3000*
