const { devs, testServer } = require("../../config.json");
const getLocalCommands = require("../../utils/getLocalCommands");

module.exports = async (client, interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const localCommands = getLocalCommands();

  try {
    const commandObject = localCommands.find((cmd) => cmd.name === interaction.commandName);

    if (!commandObject) return;

    if (commandObject.devOnly) {
      if (!devs.includes(interaction.member.id)) {
        interaction.reply({
          content: "개발자만 사용할 수 있는 명령어야.",
          ephemeral: true,
        });
        return;
      }
    }

    if (commandObject.testOnly) {
      if (!(interaction.guild.id === testServer)) {
        interaction.reply({
          content: "그 명령어는 테스트 서버에서만 사용할 수 있어.",
          ephemeral: true,
        });
        return;
      }
    }

    if (commandObject.permissionsRequired?.length) {
      for (const permission of commandObject.permissionsRequired) {
        if (!interaction.member.permissions.has(permission) && interaction.member.id !== devs[0]) {
          interaction.reply({
            content: "큰 고통에 휩싸일거다.",
            ephemeral: true,
          });
          return;
        }
      }
    }

    if (commandObject.botPermissions?.length) {
      for (const permission of commandObject.botPermissions) {
        const bot = interaction.guild.members.me;

        if (!bot.permissions.has(permission)) {
          interaction.reply({
            content: "내 권한의 빈 껍데기일 뿐이지. 장담컨대 내 권한은 한 조각도 남아있지 않아.",
            ephemeral: true,
          });
          return;
        }
      }
    }

    await commandObject.callback(client, interaction);
  } catch (error) {
    console.log(`There was an error running this command: ${error}`);
  }
};
