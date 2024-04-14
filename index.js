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

 function getRussianDayName(englishDayName) {
  return dayMapper[englishDayName] || "Неизвестно";
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

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
  let response = "Все дедлайны:\n\n";

  deadlines.дедлайны.forEach((student) => {
    student.дедлайны.forEach((deadline) => {
      response += `Предмет: ${deadline.предмет}\nДедлайн: ${formatDate(
        new Date(deadline.дата)
      )}\n\n`;
    });
  });

  ctx.reply(response);
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
  const date = new Date();
  var day = days[date.getDay()];

  let response = `Расписание на сегодня:\n`;

  const currentDaySchedule = preparedSchedule.ODD_WEEK.schedule[day];
  if (!currentDaySchedule || currentDaySchedule.length === 0) {
    response += "На сегодня занятий нет.";
  } else {
    currentDaySchedule.forEach((lesson) => {
      response += `\nПара ${lesson.pair}: ${lesson.subject}, ${lesson.time}, ауд. ${lesson.classroom}, ${lesson.type}, преп. ${lesson.lecturer}`;
    });
  }

  response +=
    "\n\n\nА еще, по кнопке ниже можешь сходить в портал за более детальным расписанием =)";

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("Расписание на неделю", "full_week_schedule")],
    [{ text: "За актуальным расписанием", web_app: { url: schedule } }],
  ]);

  ctx.reply(response, keyboard);
});

bot.command("deadlines", (ctx) => {
  let response = "Дедлайны, которые еще не наступили:\n\n";

  deadlines.дедлайны.forEach((student) => {
    student.дедлайны.forEach((deadline) => {
      const now = new Date();
      const deadlineDate = new Date(deadline.дата);

      // Проверка, если дедлайн еще не наступил
      if (deadlineDate > now) {
        response += `Предмет: ${deadline.предмет}\nДедлайн: ${formatDate(
          deadlineDate
        )}\n\n`;
      }
    });
  });

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback("Все дедлайны", "all_deadlines"),
  ]);

  ctx.reply(response, keyboard);
});

bot.command("faq", (ctx) => {
  let response = "Часто задаваемые вопросы и ответы:\n\n";

  faq.вопросы_и_ответы.forEach((qa) => {
    response += `Вопрос: ${qa.вопрос}\nОтвет: ${qa.ответ}\n\n`;
  });

  ctx.reply(response);
});

bot.command("account", async (ctx) => {
  ctx.reply("Выбери нужный вариант:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "В личный кабинет", web_app: { url: account } }],
        [{ text: "За актуальным расписанием", web_app: { url: schedule } }],
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
