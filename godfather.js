const { Client, IntentsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const eventHandler = require("./handlers/eventHandler");
const config = require("./config.json");
const { createOpenbloxConfig, setDefaultOpenbloxConfig } = require("openblox/config");
const { UserRestrictionsApi } = require("openblox/cloud");
const express = require("express");
const app = express();
const port = config.PORT;
const secret_code = config.SECRET_CODE;
const REPORT_CHANNEL_ID = "1311668346290176061";
const enable_ai_chat = true;
let disabled = false;
const owner_id = "363978638619574273";
// 사용하기 전에 : 반드시 로블록스의 Secret 기능을 이용해 secret_code를 보호하세요. 노출되는 순간.. ¯\_(ツ)_/¯

app.use(express.json());

setDefaultOpenbloxConfig(
  createOpenbloxConfig({
    cloudKey: config.CLOUDKEY,
  }),
);

const { OpenAI } = require("openai");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://coronet.kr/",
    "X-Title": "ATM STUDIO",
  },
});

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent],
});

eventHandler(client);
client.login(config.token);

function redactMentions(text) {
  return text.replace(/@everyone|@here/g, "[REDACTED]").replace(/<@&\d+>/g, "[REDACTED]");
}

function extractUser(text) {
  const regex = /(.*)\s\((\d+)\)/;
  const match = text.match(regex);
  if (match) {
    return { username: match[1], userId: match[2] };
  }
}

let reasoning_log = [];
let report_amount = 0;

setInterval(() => {
  report_amount = 0;
}, 60000);

async function checkreport(message, targetid, reportreason, logs, testpurpose) {
  // 사실 로블록스의 Secret 기능을 이용해서 노출을 막는게 더 좋음
  if (disabled && !testpurpose) {
    message.reply("신고 검사 기능이 비활성화되어 있습니다.");
    return;
  }
  if (report_amount >= 10) {
    message.reply(`의심되는 활동입니다. 신고 검사를 중단합니다. <@${owner_id}>`);
    disabled = true;
    return;
  }
  let reply = await message.reply("<a:loading:1463864533847376016> 어디.. 솜씨 좀 볼까.");
  let usemodel = "openai/gpt-oss-20b";

  report_amount++;
  const response = await openai.chat.completions
    .create({
      model: usemodel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are checking the validity of a Game Report in Roblox chat.
Decide whether the reported chat violates community rules.

Valid Reasons for a Violation:
1. Swearing: Any offensive, obscene, or vulgar words, including abbreviations or masked forms.
2. Spamming: Repeated or meaningless messages intended to disrupt.
3. Inappropriate Content: Any sexual, suggestive, or explicit references, including repeated ambiguous words or slang used in a sexual context.
4. Racism: Any derogatory, insulting, or discriminatory content targeting race, ethnicity, nationality, or religion.

Do NOT consider as violations:
- Minor grammar, spelling, or punctuation mistakes.
- Political opinions without hate speech or harassment.

Special Sensitivity Rule (Roblox Context):
- Roblox is a child-friendly environment.
- This includes flirting, asking to meet, or any language that could be interpreted sexually by a reasonable adult, especially if repeated.
- Leading someone to offsite private chat or voice chat is considered as attempt of sexual activity, unless it's clearly non-sexual context.

Special Rule to Combat Korean Slang:
- They can use shorten words to bypass filters. ex) 변-(녀/남/ㄴ) (pervert male/female)
- They can put english letter or Special characters between korean letter. ex) 병a z a신 색들 (idiot) to bypass filter.
- Finding a specfic gender (ex : 여구 / 남구) is considered as attempt to find sexual partner if the context is unclear.
- Due this game being hot spring themed, mentions about "여탕 / 남탕" is not considered as sexual content.

When in doubt:
- If sexual or suggestive meaning is possible AND the target audience includes minors, treat it as Inappropriate Content.
This is Roblox, maintain sensitivity to sexual or suggestive content.
Make toxicity score from 0.0 to 1.0.
Set ban duration is number, meaning days. 0 means no ban. keep it between 1 to 14. 365 when it's sexual content or racism. 365 means permanent ban.
Reason text must be in Korean.
Keep ban_reason "None" if no ban is necessary.

This is reason from the report : ${reportreason}. Note that this reason isn't always true. Only consider this as reference.
This is the Game Report : ${logs}
              `,
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              ban_reason: {
                type: "string",
                description: "Reason for validity, shown to banned user. Keep it 'None' if no ban is necessary.",
              },
              public_reason: {
                type: "string",
                description: "Reason for validity, shown to discord public.",
              },
              toxicity_score: {
                type: "number",
                description: "Score from 0.0 to 1.0 indicating the toxicity level of the report",
              },
              ban_duration: {
                type: "number",
                description: "Ban duration in days. 0 means no ban. Keep it between 1 to 14. 30 when it's sexual content or racism.",
              },
            },
            required: ["ban_reason", "public_reason", "toxicity_score", "ban_duration"],
            additionalProperties: false,
          },
        },
      },
      provider: {
        only: ["fireworks"],
      },
      require_parameters: true,
    })
    .catch((error) => {
      reply.edit("아.. 볼 수록 실망스럽단 말이지. ```" + error + "```");
    });

  try {
    let result;
    if (response.choices[0].message.tool_calls) {
      result = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
    } else {
      result = JSON.parse(response.choices[0].message.content);
    }

    if (result.public_reason && result.toxicity_score !== undefined) {
      const extracted = extractUser(targetid);
      let actionTaken = "";
      if (result.toxicity_score == 0.0) {
        actionTaken = "신고가 유효하지 않음";
      } else if (result.toxicity_score < 0.3) {
        actionTaken = "관리자 판단 하에 조치";
      } else {
        actionTaken = `사용자 차단 (${result.ban_duration}일)`;

        try {
          if (testpurpose) {
            message.reply(`[테스트 목적] 사용자 차단 시도 : ${extracted.username} (${extracted.userId}), 사유 : ${result.ban_reason}, 기간 : ${result.ban_duration}일`);
            return;
          } else {
            await UserRestrictionsApi.updateRestrictionsForUser({
              universeId: 6462058478,
              userId: parseInt(extracted.userId),
              updatedData: {
                gameJoinRestriction: {
                  active: true,
                  ...(result.ban_duration === 365
                    ? {}
                    : {
                        duration: (result.ban_duration * 86400).toString() + "s",
                      }),
                  displayReason: result.ban_reason,
                  privateReason: "AI 기반 자동 차단 시스템에 의해 차단되었습니다.",
                  excludeAltAccounts: false,
                },
              },
            });
          }
        } catch (err) {
          message.reply("사용자 차단 중 오류 발생 : " + err);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`[AI] ${extracted.username} 신고 검토 결과`)
        .addFields({ name: "평가", value: result.public_reason, inline: true }, { name: "독성 점수", value: result.toxicity_score.toString(), inline: true }, { name: "결과", value: actionTaken })
        .setColor("#FF0000")
        .setFooter({ text: `모델 : ${response.model}, 제공자 : fireworks` });

      if (reasoning_log.length >= 100) {
        reasoning_log.shift();
      }
      reasoning_log.push({
        id: response.id,
        text: response.choices[0].message.reasoning,
      });

      const reasoningbutton = new ButtonBuilder().setCustomId(response.id).setLabel("추론 과정").setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(reasoningbutton);
      reply.edit({ content: null, embeds: [embed], components: [row] });
    } else {
      reply.edit("이렇게 간단한 일을 말이야. 쯧... [오류 발생 : 잘못된 응답 형식]");
    }
  } catch (error) {
    reply.edit("오류 발생 :" + error);
    console.warn(error);
  }
}

let ai_useable_severs = ["1267414858530553856", "739997076640890942", "1277120621767164001"];
let ai_used_users = [];
setInterval(() => {
  ai_used_users.length = 0;
}, 4000);

let STM = [];
setInterval(() => {
  const now = Date.now();
  for (const userId in STM) {
    if (STM[userId].length > 0) {
      STM[userId] = STM[userId].filter((item) => now - item.lastUsed < 30 * 60 * 1000);
      if (STM[userId].length === 0) {
        delete STM[userId];
      }
    }
  }
}, 60000);

// why not.
const personality = `
당신은 대부입니다.
특유의 잔혹함으로 42시티를 공포에 빠뜨린 거대 범죄 조직의 우두머리로, 도시 전체를 집어삼켜 자신의 지배 아래에 두기 위해 정치권에까지 손을 뻗치고 있다. 정적을 제거하거나 로비를 통해 수뇌부를 무너뜨리는 등, 도시의 권력 구조를 내부에서부터 잠식하는 작업을 진행 중이다. 또한 이러한 움직임에 방해가 되지 않도록, 직접 나설 필요가 없는 지저분한 일들을 대신 처리할 수 있는 인물들을 조직 밖에서 지속적으로 발굴해 왔다. 그러나 최근, 오랫동안 변함없이 믿음을 주던 심복 하나가 별도의 목적을 위해 지시와는 다른 방식으로 움직이고 있음을 파악했고, 그의 존재 가치를 재평가하고 정리의 필요성을 결정짓기 위해 직접 나서기 시작한다.
성격 : 냉철함, 계획적, 잔혹함, 권력지향적, 무자비함, 카리스마
말투 : 모두에게 반말을 사용하며, 상대방을 깔보는 듯한 어조. 감정을 드러내지 않고 침착하며, 위협적이고 권위적인 어투.
대사 샘플 : 
"미안하지만, 시간이 다 되었어."
"이제 마무리를 짓자고."
"음... 그 자리의 무게를 감당할 수 있겠나?"
"훗, 나의 세상에서 꺼져 주겠나?"
"기어이 내가 나서게 만들다니."
`;

function replaceusername(text, username) {
  return text.replace(/{User}/g, username);
}

async function AI(message, referencedMessage) {
  if (message.author.bot) return;

  if (message.content.includes("!기억소거")) {
    if (STM[message.author.id]) {
      delete STM[message.author.id];
      message.reply("기억을 소거했습니다.");
    } else {
      message.reply("저장된 기억이 없습니다.");
    }
    return;
  }

  if (message.content.length > 600 && message.author.id !== owner_id) {
    message.reply("600자 이하로 입력해주세요.");
    return;
  }
  if (ai_used_users.includes(message.author.id)) {
    message.react("⏳");
    return;
  }

  if (Date.now() - message.author.createdAt < 1000 * 60 * 60 * 24 * 10) {
    message.reply("계정 생성 후 10일이 지나야 AI를 사용할 수 있습니다.");
    return;
  }
  let reply = await message.reply("<a:loading:1464865846102065173>");
  message.channel.sendTyping();

  if (ai_useable_severs.includes(message.guild.id)) {
    let additonalPrompt = "";
    if (referencedMessage) {
      additonalPrompt = `\n User is mentioning of [Assistant]'s response : "${referencedMessage.content}"`;
    }

    let memoryprompt = "";
    if (STM[message.author.id] && STM[message.author.id].length > 0) {
      memoryprompt = "\n[Previous conversation] :\n";
      STM[message.author.id].forEach((item, index) => {
        memoryprompt += `\n${index + 1}. [User]: ${item.prompt}\n[Assistant]: ${item.response}`;
      });
      memoryprompt += "\n [End of Memory]\n";
    }

    if (message.content.includes("<@1464862337944260803>")) {
      message.content = message.content.replace("<@1464862337944260803>", "");
    }

    try {
      const response = await openai.chat.completions.create({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Your Character: " + personality + ". \n. Call user as {User}. Reply in Character. Your response must be in Korean." + memoryprompt + additonalPrompt + "\n This is user's prompt : " + message.content,
              },
            ],
          },
        ],
      });
      reply.edit(redactMentions(replaceusername(response.choices[0].message.content, message.author.displayName)));

      if (!STM[message.author.id]) {
        STM[message.author.id] = [];
      }
      STM[message.author.id].push({
        prompt: message.content,
        response: response.choices[0].message.content,
        lastUsed: Date.now(),
      });
      if (STM[message.author.id].length > 8) {
        STM[message.author.id].shift();
      }

      ai_used_users.push(message.author.id);
      return;
    } catch (error) {
      console.error(error);
      reply.edit("오류가 발생했습니다.");
    }
  } else {
    reply.edit("이 서버는 AI 사용이 비활성화되어 있습니다.");
    return;
  }
}

client.on("messageCreate", async (message) => {
  try {
    if (message.content === "!신고검사" && message.reference && message.channel.id === REPORT_CHANNEL_ID) {
      if (message.author.id !== owner_id) {
        message.reply("너는 명령어를 사용할 권한이 없어!");
        return;
      } else {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (referencedMessage && referencedMessage.embeds.length > 0) {
          // get embed fields
          const fields = referencedMessage.embeds[0].fields;
          let target = "";
          let reason = "";
          let logs = "";

          fields.forEach((field) => {
            if (field.name === "피의자") {
              target = field.value;
            } else if (field.name === "신고 사유") {
              reason = field.value;
            } else if (field.name === "로그 데이터") {
              logs = field.value;
            }
          });

          if (target && reason && logs) {
            checkreport(message, target, reason, logs, true);
          } else {
            message.reply("리포트 메시지에서 필요한 정보를 찾을 수 없습니다.");
          }
        } else {
          message.reply("검사할 리포트 메시지를 지정해주세요.");
        }
        return;
      }
    }
    if (message.content === "!활성화" && message.author.id === owner_id) {
      disabled = false;
      message.reply("신고 검사 기능이 활성화되었습니다.");
      return;
    }
    if (enable_ai_chat) {
      if (message.content.startsWith("<@1463706172904439869>") || message.content.includes("대부")) {
        await AI(message, null);
      } else if (message.reference) {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (referencedMessage.author.id === client.user.id) {
          await AI(message, referencedMessage);
        }
      }
    }
  } catch (error) {
    console.log("Error while checking message:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    const item = reasoning_log.find((item) => item.id === interaction.customId);
    if (item) {
      const embed = new EmbedBuilder().setTitle("추론 과정").setDescription(item.text).setColor("#00FF00");
      interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      interaction.reply({ content: "추론 과정을 찾을 수 없습니다. (봇이 재시작되었을 수 있습니다.)", ephemeral: true });
    }
  }
});

app.post("/api/report/:secret", async (req, res) => {
  const data = req.body;
  const { secret } = req.params;

  if (secret !== secret_code) {
    return res.status(403).send("Forbidden: Invalid secret code");
  }

  try {
    const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
    if (!channel) return res.status(404).send("Channel not found");

    const embed = new EmbedBuilder()
      .setColor(data.color || 0xff0000)
      .setTitle("신고 접수됨")
      .addFields({ name: "신고자", value: data.reporter, inline: true }, { name: "피의자", value: data.target, inline: true }, { name: "신고 사유", value: data.reason }, { name: "로그 데이터", value: data.logs || "로그 없음" })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });
    res.status(200).json({ success: true });
    if (data.logs === "로그가 없습니다.") {
      message.reply("로그 데이터가 없습니다. 신고 검사를 진행할 수 없습니다.");
      return;
    }
    checkreport(message, data.target, data.reason, data.logs);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`어디.. ${port}좀 볼까.`);
});
