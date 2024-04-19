require("dotenv").config();

const dayMapper = {
  Sunday: "Воскресенье",
  Monday: "Понедельник",
  Tuesday: "Вторник",
  Wednesday: "Среда",
  Thursday: "Четверг",
  Friday: "Пятница",
  Saturday: "Суббота",
};

const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const JSONSchedule = require("./assets/schedule.json");
const deadlinesData = require("./assets/deadlines.json");
const faqData = require("./assets/faq.json");
const bot = new Telegraf(process.env.BOT_TOKEN);
const CHAD_API_KEY = process.env.CHAD_API_KEY;

const preparedSchedule = JSON.parse(JSON.stringify(JSONSchedule));
const deadlines = JSON.parse(JSON.stringify(deadlinesData));
const faq = JSON.parse(JSON.stringify(faqData));

const account = "https://org.fa.ru/";
const schedule = "https://ruz.fa.ru/";
const campus = "https://campus.fa.ru/";

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

    const url = `https://ruz.fa.ru/api/schedule/group/111296?start=${startDate}&finish=${finishDate}`;
    const response = await fetch(url);
    const data = await response.json();

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

function getRussianDayName(englishDayName) {
  return dayMapper[englishDayName] || "Неизвестно";
}

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

async function sendMessageWithDelay(ctx, message) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  await ctx.replyWithMarkdown(message);
}

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

function getCurrentWeekSchedule(invert = false) {
  const currentDate = new Date();
  const startDate = new Date("April 8, 2024");
  const millisecondsInWeek = 7 * 24 * 60 * 60 * 1000;

  const difference = currentDate.getTime() - startDate.getTime();

  const passedWeeks = Math.floor(difference / millisecondsInWeek);

  return invert
    ? passedWeeks % 2 !== 0
      ? preparedSchedule.EVEN_WEEK.schedule
      : preparedSchedule.ODD_WEEK.schedule
    : passedWeeks % 2 === 0
    ? preparedSchedule.EVEN_WEEK.schedule
    : preparedSchedule.ODD_WEEK.schedule;
}

bot.action("full_week_schedule", async (ctx) => {
  let response = "*Расписание на текущую неделю:*\n";

  const weekSchedule = getCurrentWeekSchedule();
  Object.keys(weekSchedule).forEach((day) => {
    response += `\n\n*${getRussianDayName(day)}:*\n`;

    if (weekSchedule[day].length === 0) {
      response += "_На этот день занятий нет._";
    } else {
      weekSchedule[day].forEach((lesson) => {
        if (lesson.pair) response += `\n*Пара ${lesson.pair}:* \n`;
        if (lesson.subject) response += `_${lesson.subject}_,  \n`;
        if (lesson.time) response += `${lesson.time},  \n`;
        if (lesson.classroom) response += `ауд. ${lesson.classroom},  \n`;
        if (lesson.type) response += `${lesson.type},  \n`;
        if (lesson.lecturer) response += `преп. ${lesson.lecturer} \n`;
      });
    }
  });

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("Расписание на другую неделю", "switch_week"),
  ]);

  ctx.reply(response, { parse_mode: "Markdown", ...keyboard });
});

bot.action("switch_week", async (ctx) => {
  let response = "*Расписание на другую неделю:*\n";

  const weekSchedule = getCurrentWeekSchedule(true);
  Object.keys(weekSchedule).forEach((day) => {
    response += `\n\n*${getRussianDayName(day)}:*\n`;

    if (weekSchedule[day].length === 0) {
      response += "_На этот день занятий нет._";
    } else {
      weekSchedule[day].forEach((lesson) => {
        if (lesson.pair) response += `\n*Пара ${lesson.pair}:* \n`;
        if (lesson.subject) response += `_${lesson.subject}_,  \n`;
        if (lesson.time) response += `${lesson.time},  \n`;
        if (lesson.classroom) response += `ауд. ${lesson.classroom},  \n`;
        if (lesson.type) response += `${lesson.type},  \n`;
        if (lesson.lecturer) response += `преп. ${lesson.lecturer} \n`;
      });
    }
  });

  ctx.reply(response, { parse_mode: "Markdown" });
});

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

bot.action("schedule_day", async (ctx) => {
  try {
    const response = await fetchSchedule("day");
    sendSchedule(ctx, response);
  } catch (error) {
    console.error("Error:", error);
    ctx.reply("Произошла ошибка при получении расписания.");
  }
});

bot.action("schedule_week", async (ctx) => {
  try {
    const response = await fetchSchedule("week");
    sendSchedule(ctx, response);
  } catch (error) {
    console.error("Error:", error);
    ctx.reply("Произошла ошибка при получении расписания.");
  }
});

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

bot.command("schedule", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("На день", "schedule_day"),
    Markup.button.callback("На всю неделю", "schedule_week"),
  ]);

  ctx.reply("Выберите период расписания:", keyboard);
});

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

bot.command("faq", (ctx) => {
  let response = "*Часто задаваемые вопросы и ответы:*\n\n";

  faq.faq.forEach((qa) => {
    response += `*❓ Вопрос:* ${qa.question}\n*💬 Ответ:* ${qa.answer}\n\n`;
  });

  ctx.reply(response, { parse_mode: "Markdown" });
});

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

bot.start((ctx) =>
  ctx.reply(
    "Привяу, выбирай команды в менюшке\nА можешь просто писать свои вопросы сюда, а я как чат-бот постараюсь на них ответить ;)"
  )
);

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

bot.launch();

bot.telegram.setMyCommands([
  { command: "schedule", description: "Вывести расписание" },
  { command: "question", description: "Задать вопрос" },
  { command: "deadlines", description: "Текущие дедлайны" },
  { command: "faq", description: "Часто задаваемые вопросы" },
  { command: "account", description: "Порталы" },
]);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
