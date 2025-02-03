# Этап 1: сборка приложения
FROM node:16-alpine AS build

# Задаём рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь исходный код
COPY . .

# Собираем TypeScript-код (предполагается, что в package.json есть скрипт "build")
RUN npm run build

# Этап 2: запуск приложения
FROM node:16-alpine

WORKDIR /app

# Копируем только скомпилированные файлы и необходимые файлы из предыдущего этапа
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Устанавливаем только production-зависимости
RUN npm install --only=production

# Создаём файл chatId.txt с содержимым "1"
RUN echo "1" > chatId.txt

# Указываем переменную окружения (при необходимости можно переопределять через docker-compose)
ENV NODE_ENV=production

# Команда запуска бота (если основной файл находится в dist/bot.js)
CMD ["node", "dist/bot.js"]
