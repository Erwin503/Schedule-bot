import { VK, MessageContext } from "vk-io";
import schedule from "node-schedule";
import * as dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";

dotenv.config();

// Инициализация VK с токеном сообщества
const vk = new VK({
  token: process.env.VK_TOKEN || "YOUR_VK_GROUP_TOKEN_HERE",
});

// Путь к файлу для хранения chat id
const CHAT_ID_FILE = path.resolve(__dirname, "chatId.txt");
// путь для докера
// const CHAT_ID_FILE = path.resolve(process.cwd(), 'chatId.txt');


/**
 * Обновляет файл с chat id:
 * - Если файла нет, записывает chat id.
 * - Если файл существует, и сохранённый id отличается, перезаписывает его.
 */
async function updateChatIdInFile(chatId: number): Promise<void> {
  try {
    let fileExists = false;
    try {
      await fs.access(CHAT_ID_FILE);
      fileExists = true;
    } catch (err) {
      fileExists = false;
    }

    if (fileExists) {
      const existingIdStr = await fs.readFile(CHAT_ID_FILE, "utf-8");
      const existingId = parseInt(existingIdStr.trim(), 10);
      if (existingId !== chatId) {
        await fs.writeFile(CHAT_ID_FILE, chatId.toString(), "utf-8");
        console.log(
          `Chat id changed from ${existingId} to ${chatId} and updated in file.`
        );
      } else {
        console.log(`Chat id ${chatId} is already recorded in file.`);
      }
    } else {
      await fs.writeFile(CHAT_ID_FILE, chatId.toString(), "utf-8");
      console.log(`Chat id ${chatId} written to file.`);
    }
  } catch (error) {
    console.error("Error updating chat id file:", error);
  }
}

/**
 * Читает chat id из файла.
 * Если файл существует и содержит корректное значение, возвращает его как число.
 * Если файла нет или значение некорректное, возвращает null.
 */
async function getChatIdFromFile(): Promise<number | null> {
  try {
    const data = await fs.readFile(CHAT_ID_FILE, "utf-8");
    const chatId = parseInt(data.trim(), 10);
    if (!isNaN(chatId)) {
      return chatId;
    } else {
      console.error("Содержимое файла chatId.txt не является числом.");
      return null;
    }
  } catch (error) {
    // Если файла нет или произошла ошибка при чтении, возвращаем null
    console.error("Ошибка чтения файла с chat id:", error);
    return null;
  }
}

/**
 * Вычисляет chat id из входящего сообщения.
 * Если peerId > 2000000000, значит это беседа, и chat_id = peerId - 2000000000.
 */
function getChatId(ctx: MessageContext): number {
  const peerId = ctx.peerId;
  return peerId > 2000000000 ? peerId - 2000000000 : peerId;
}

/**
 * Планирует отправку сообщения в указанное время каждый день.
 * @param time - время в формате "HH:MM"
 * @param message - текст сообщения
 * @param chatId - идентификатор беседы для отправки сообщения
 */
function scheduleMessage(time: string, message: string, chatId: number) {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Cron-выражение: "0 {minute} {hour} * * *" – каждый день в указанное время
  const cronExp = `0 ${minute} ${hour} * * *`;

  schedule.scheduleJob(cronExp, async () => {
    try {
      await vk.api.messages.send({
        chat_id: chatId,
        message: message,
        random_id: Date.now(), // для предотвращения дублирования
      });
      console.log(`Message "${message}" sent to chat ${chatId} at ${time}`);
    } catch (error) {
      console.error("Error sending scheduled message:", error);
    }
  });
}

// Обработка входящих сообщений
vk.updates.on("message", async (ctx: MessageContext) => {
  if (!ctx.text) return;

  // При получении команды /start бот извлекает chat id и обновляет файл
  if (ctx.text.toLowerCase() === "/start") {
    const chatId = getChatId(ctx);
    await ctx.send(
      "Бот активирован для этой беседы. Ежедневно в 10:00 и 20:00 будут отправляться запланированные сообщения."
    );
    console.log(`Chat ${chatId} activated.`);

    // Записываем chat id в файл (если его там ещё нет или если он отличается)
    await updateChatIdInFile(chatId);
  }
});

(async () => {
  const chatId = await getChatIdFromFile();
  if (chatId) {
    scheduleMessage("10:00", "Оффтоп закрыт", chatId);
    scheduleMessage("20:00", "Оффтоп открыт", chatId);
    await vk.api.messages.send({
      chat_id: chatId,
      message: "test",
      random_id: Date.now(), // для предотвращения дублирования
    });
  } else {
    console.error(
      "Chat id не найден. Проверьте файл chatId.txt или отправьте команду /start для его создания."
    );
  }

  // Запуск Long Poll для получения обновлений
  vk.updates
    .start()
    .then(() => {
      console.log("VK бот запущен");
    })
    .catch((error) => {
      console.error("Error starting VK bot:", error);
    });
})();
