require("dotenv").config(); // Подключение и конфигурация пакета dotenv для загрузки переменных окружения из файла .env
 
// Отображение английских названий дней недели на русские
const dayMapper = {
  Sunday: "Воскресенье",
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
};
 
// Импорт классов Telegraf и Markup из пакета telegraf
const { Telegraf, Markup } = require("telegraf");
// Импорт пакета axios для выполнения HTTP-запросов
const axios = require("axios");
// Импорт данных о дедлайнах из JSON-файла
const deadlinesData = require("./assets/deadlines.json");
// Импорт данных о часто задаваемых вопросах из JSON-файла
const faqData = require("./assets/faq.json");
 
// Создание нового экземпляра бота с использованием токена из переменных окружения
const bot = new Telegraf(process.env.BOT_TOKEN);
// Получение API-ключа для доступа к сервису CHAD из переменных окружения
const CHAD_API_KEY = process.env.CHAD_API_KEY;
 
// Клонирование данных о дедлайнах и часто задаваемых вопросах для предотвращения изменений в оригинальных данных
const deadlines = JSON.parse(JSON.stringify(deadlinesData));
const faq = JSON.parse(JSON.stringify(faqData));
 
const account = "https://org.fa.ru/"; // Ссылка на личный кабинет
const schedule = "https://ruz.fa.ru/"; // Ссылка на актуальное расписание
const campus = "https://campus.fa.ru/"; // Ссылка на кампус
 
// Функция для форматирования даты и времени в формате 'день месяца, название месяца год, часы:минуты'
function formatDate(date) {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };
  return date.toLocaleString("ru-RU", options);
}
 
// Функция для получения расписания на определенный период
async function fetchSchedule(period) {
  try {
    const currentDate = new Date();
    let startDate, finishDate;
 
    if (period === "day") {
      startDate = currentDate.toISOString().split("T")[0];
      finishDate = startDate;
    } else if (period === "week") {
      startDate = currentDate.toISOString().split("T")[0];
      finishDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    }
 // Отправляем запрос и нормализуем его к json
    const url = `https://ruz.fa.ru/api/schedule/group/111296?start=${startDate}&finish=${finishDate}`;
    const response = await fetch(url);
    const data = await response.json();
 // фильтр нужных полей 
    const extractedData = data.map((item) => ({
      date: item.date,
      dayOfWeekString: item.dayOfWeekString,
      beginLesson: item.beginLesson,
      endLesson: item.endLesson,
      group: item.group,
      discipline: item.discipline,
      lecturer: item.lecturer,
      lecturerEmail: item.lecturerEmail,
      kindOfWork: item.kindOfWork,
      auditorium: item.auditorium,
    }));
 
    return extractedData;
  } catch (error) {
    console.error("Error fetching or processing data:", error);
    return null;
  }
}
 

 
// Функция для отправки расписания пользователю
async function sendSchedule(ctx, response) {
  if (!response || response.length === 0) {
    ctx.reply("На этот период нет расписания.");
    return;
  }
 
  let currentDate = "";
  let currentDayMessages = [];
 
  response.sort((a, b) => new Date(a.date) - new Date(b.date));
 
  for (const item of response) {
    const formattedDate = formatDateInSchedule(item.date);
 
    if (formattedDate !== currentDate) {
      if (currentDayMessages.length > 0) {
        const fullDayMessage = currentDayMessages.join("\n");
        await sendMessageWithDelay(ctx, fullDayMessage);
        currentDayMessages = [];
      }
      currentDate = formattedDate;
      currentDayMessages.push(`*${formattedDate}*\n\n`);
    }
 
    let lecturer = item.lecturer ? item.lecturer : "_Нет данных_ 😞";
    let lecturerEmail = item.lecturerEmail
      ? item.lecturerEmail
      : "_Нет данных_ 😞";
 
    let scheduleString = `*Начало:* ${item.beginLesson}, *Конец:* ${item.endLesson}\n`;
    scheduleString += `*Дисциплина:* ${item.discipline}\n`;
    scheduleString += `👨‍🏫 *Преподаватель:* ${lecturer}\n`;
    scheduleString += `📩 *Email:* ${lecturerEmail}\n`;
    scheduleString += `📚 *Вид занятия:* ${item.kindOfWork}\n`;
    scheduleString += `🏢 *Аудитория:* ${item.auditorium}\n\n`;
 
    currentDayMessages.push(scheduleString);
  }
 
  if (currentDayMessages.length > 0) {
    const fullDayMessage = currentDayMessages.join("\n");
    await sendMessageWithDelay(ctx, fullDayMessage);
  }
}
 
// Функция для отправки сообщения с задержкой
async function sendMessageWithDelay(ctx, message) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await ctx.replyWithMarkdown(message);
}
 
// Функция для форматирования даты в расписании
function formatDateInSchedule(dateString) {
  const date = new Date(dateString);
  const days = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const dayOfWeek = days[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = months[date.getMonth()];
  return `${dayOfWeek}, ${dayOfMonth} ${month}`;
}
 
// Обработчик для кнопки "Все дедлайны"
bot.action("all_deadlines", (ctx) => {
  let response = "*Все дедлайны:*\n\n";
 
  deadlines.deadlines.forEach((student) => {
    student.deadlines.forEach((deadline) => {
      response += `✍🏽 *Предмет:* ${deadline.object}\n⏰ *Дедлайн:* ${formatDate(
        new Date(deadline.date)
      )}\n\n`;
    });
  });
 
  ctx.reply(response, { parse_mode: "Markdown" });
});
 
// Обработчик для кнопки "На день"
bot.action("schedule_day", async (ctx) => {
  try {
    const response = await fetchSchedule("day");
    sendSchedule(ctx, response);
  } catch (error) {
    console.error("Error:", error);
    ctx.reply("Произошла ошибка при получении расписания.");
  }
});
 
// Обработчик для кнопки "На всю неделю"
bot.action("schedule_week", async (ctx) => {
  try {
    const response = await fetchSchedule("week");
    sendSchedule(ctx, response);
  } catch (error) {
    console.error("Error:", error);
    ctx.reply("Произошла ошибка при получении расписания.");
  }
});
 
// Обработчик для команды "/question"
bot.command("question", (ctx) => {
  ctx.reply("Введите ваш вопрос:");
  bot.on("text", async (ctx) => {
    const question = ctx.message.text;
 
    const requestJson = {
      message: question,
      api_key: CHAD_API_KEY,
    };
 
    try {
      const response = await axios.post(
        "https://ask.chadgpt.ru/api/public/gpt-3.5",
        requestJson
      );
 
      if (response.status === 200) {
        const respJson = response.data;
 
        if (respJson.is_success) {
          const respMsg = respJson.response;
          const usedWords = respJson.used_words_count;
          ctx.reply(`Ответ от бота: ${respMsg}\nПотрачено слов: ${usedWords}`);
        } else {
          const error = respJson.error_message;
          ctx.reply(`Ошибка: ${error}`);
        }
      } else {
        ctx.reply(`Ошибка! Код http-ответа: ${response.status}`);
      }
    } catch (error) {
      console.error("Произошла ошибка при отправке запроса:", error);
      ctx.reply("Произошла ошибка при отправке запроса");
    }
  });
});
 
// Обработчик для команды "/schedule"
bot.command("schedule", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("На день", "schedule_day"),
    Markup.button.callback("На всю неделю", "schedule_week"),
  ]);
 
  ctx.reply("Выберите период расписания:", keyboard);
});
 
// Обработчик для команды "/deadlines"
bot.command("deadlines", (ctx) => {
  let response = "*Дедлайны, которые еще не наступили:*\n\n";
 
  if (deadlines && deadlines.deadlines) {
    for (const student of deadlines.deadlines) {
      if (student && student.deadlines) {
        for (const deadline of student.deadlines) {
          const now = new Date();
          const deadlineDate = new Date(deadline.date);
 
          if (deadlineDate > now) {
            response += `📚 *Предмет:* ${
              deadline.object
            }\n⏳ *Дедлайн:* ${formatDate(deadlineDate)}\n\n`;
          }
        }
      }
    }
  }
 
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("Все дедлайны", "all_deadlines"),
  ]);
 
  ctx.reply(response, { parse_mode: "Markdown", ...keyboard });
});
 
// Обработчик для команды "/faq"
bot.command("faq", (ctx) => {
  let response = "*Часто задаваемые вопросы и ответы:*\n\n";
 
  faq.faq.forEach((qa) => {
    response += `*❓ Вопрос:* ${qa.question}\n*💬 Ответ:* ${qa.answer}\n\n`;
  });
 
  ctx.reply(response, { parse_mode: "Markdown" });
});
 
// Обработчик для команды "/account"
bot.command("account", async (ctx) => {
  ctx.reply("Выбери нужный вариант:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "В личный кабинет", web_app: { url: account } }],
        [{ text: "За актуальным расписанием", web_app: { url: schedule } }],
        [{ text: "В кампус", web_app: { url: campus } }],
      ],
    },
  });
});
 
// Обработчик для команды "/start"
bot.start((ctx) =>
  ctx.reply(
    "Привяу, выбирай команды в менюшке\nА можешь просто писать свои вопросы сюда, а я как чат-бот постараюсь на них ответить ;)"
  )
);
 
// Обработчик для текстовых сообщений
bot.on("text", async (ctx) => {
  const question = ctx.message.text;
 
  const requestJson = {
    message: question,
    api_key: CHAD_API_KEY,
  };
 
  try {
    const response = await axios.post(
      "https://ask.chadgpt.ru/api/public/gpt-3.5",
      requestJson
    );
 
    if (response.status === 200) {
      const respJson = response.data;
 
      if (respJson.is_success) {
        const respMsg = respJson.response;
        const usedWords = respJson.used_words_count;
        ctx.reply(`Ответ от бота: ${respMsg}\nПотрачено слов: ${usedWords}`);
      } else {
        const error = respJson.error_message;
        ctx.reply(`Ошибка: ${error}`);
      }
    } else {
      ctx.reply(`Ошибка! Код http-ответа: ${response.status}`);
    }
  } catch (error) {
    console.error("Произошла ошибка при отправке запроса:", error);
    ctx.reply("Произошла ошибка при отправке запроса");
  }
});
 
// запуск бота после инициализации обработчиков
bot.launch();
 
// формирование ui меню в телеграмм
bot.telegram.setMyCommands([
  { command: "schedule", description: "Вывести расписание" },
  { command: "question", description: "Задать вопрос" },
  { command: "deadlines", description: "Текущие дедлайны" },
  { command: "faq", description: "Часто задаваемые вопросы" },
  { command: "account", description: "Порталы" },
]);
 
// автоматическое отключение при сбоях
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));