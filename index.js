/*
> Recode script give credits to Dr Xenon
📝 | Created By Dr Xenon
🖥️ | Base Ori By Dr Xenon
📌 | Credits By Dr Xenon
📱 | Chat wa:2250500107362
👑 | Github: Dr Xenon 
✉️ | Email: xtechcorporation1@gmail.com
*/

console.clear();
console.log('starting...');
require('./settings.js');
process.on("uncaughtException", console.error);

const {
  default: makeWASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  makeInMemoryStore,
  getContentType,
  jidDecode,
  proto,
  delay
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const readline = require("readline");
const fs = require('fs');
const chalk = require('chalk');
const _ = require('lodash');
const util = require('util');
const fetch = require('node-fetch');
const FileType = require('file-type');
const { Boom } = require('@hapi/boom');
const NodeCache = require("node-cache");
const PhoneNumber = require('awesome-phonenumber');

const msgRetryCounterCache = new NodeCache();
const retryCache = new NodeCache({ stdTTL: 30, checkperiod: 20 });
const sendCache  = new NodeCache({ stdTTL: 30, checkperiod: 20 });

const { color } = require('./list/lib/color');
const {
    smsg,
    sendGmail,
    formatSize, 
    isUrl, 
    generateMessageTag,
    getBuffer,
    getSizeMedia,
    runtime,
    fetchJson,
    sleep 
} = require('./list/lib/func');

const { 
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid 
} = require('./list/lib/exif');

const usePairingCode = true;

// Fonction question pour CLI
const question = (text) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(text, answer => {
      rl.close();
      resolve(answer);
    });
  });
};

// Lowdb setup
const low = require('./list/lib/lowdb');
const yargs = require('yargs/yargs');
const { Low, JSONFile } = low;

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.db = new Low(
    /https?:\/\//.test(opts['db'] || '') ?
        new cloudDBAdapter(opts['db']) :
    /mongodb/.test(opts['db']) ?
        new mongoDB(opts['db']) :
        new JSONFile(`./list/Database/database.json`)
);

global.DATABASE = global.db;

global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => {
    let intv = setInterval(() => {
      if (!global.db.READ) {
        clearInterval(intv);
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1000);
  });
  if (global.db.data !== null) return;

  global.db.READ = true;
  await global.db.read();
  global.db.READ = false;

  global.db.data = {
      users: {},
      chats: {},
      database: {},
      game: {},
      settings: {},
      others: {},
      sticker: {},
      ...(global.db.data || {})
  };

  global.db.chain = _.chain(global.db.data);
};

(async () => {
  await global.loadDatabase();
})();


async function clientstart() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const latestVersion = await fetch('https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json')
    .then(res => res.json())
    .then(json => json.version)
    .catch(() => [4, 0, 0]);

  const bot = makeWASocket({
    printQRInTerminal: !usePairingCode,
    syncFullHistory: true,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    generateHighQualityLinkPreview: true,
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(
        message.buttonsMessage ||
        message.templateMessage ||
        message.listMessage
      );
      if (requiresPatch) {
        message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
              },
              ...message,
            },
          },
        };
      }
      return message;
    },
    version: latestVersion,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    logger: pino({ level: 'fatal' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'silent', stream: 'store' })),
    }
  });

  // CLI color and pairing code prompt
  const { say } = require('cfonts');
  const listcolor = ['red', 'blue', 'magenta'];
  const randomcolor = listcolor[Math.floor(Math.random() * listcolor.length)];

  if (!bot.authState.creds.registered) {
    say(`Xenon\nXMD\n`, { font: 'block', align: 'center', gradient: [randomcolor, randomcolor] });
say(`By Dr Xenon\nYOUTUBE : Dr.xenon2\nTelegram : DrXenon1\nInstagram : Dr.xenon2`, {
      font: 'console',
      align: 'center',
      gradient: [randomcolor, randomcolor]
    });
    const phoneNumber = await question(color(`<!> TYPE YOUR WHATSAPP NUMBER STARTING WITH COUNTRY CODE (Don't start with 0)  ❌\n<✓> EXAMPLE : 225xxx\n <+> Number : `, randomcolor));
    const code = await bot.requestPairingCode(phoneNumber.trim());
    console.log(color(`[ # ] enter that code into WhatsApp, motherfucker : ${code}`, randomcolor));
  }

  // Store (basestore)
  const createToxxicStore = require('./list/basestore');
  const store = createToxxicStore('./store', {
    maxMessagesPerChat: 100,
    memoryOnly: false
  });
  store.bind(bot.ev);

  // Gestion des messages entrants
  bot.ev.on('messages.upsert', async chatUpdate => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      // Unwrap ephemeral message if needed
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
      if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
      if (!bot.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
      let m = smsg(bot, mek, store);
      require("./XenonXmd")(bot, m, chatUpdate, mek, store);
    } catch (err) {
      console.log(chalk.yellow.bold("[ ERROR ] XenonXmd.js :\n") + chalk.redBright(util.format(err)));
    }
  });

  // Décodage JID personnalisé
  bot.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
  };

  // Mise à jour des contacts
  bot.ev.on('contacts.update', update => {
    for (let contact of update) {
      let id = bot.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  // Fonctions utiles ajoutées au bot (exemples)
  bot.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
    bot.sendMessage(jid, {
      text: text,
      contextInfo: {
        mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + "@s.whatsapp.net"),
      },
      ...options,
    }, { quoted });

  bot.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`, `[1], 'base64')
        : /^https?:\/\//.test(path)
          ? await (await getBuffer(path))
          : fs.existsSync(path)
            ? fs.readFileSync(path)
            : Buffer.alloc(0);

    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifImg(buff, options);
    } else {
      buffer = await imageToWebp(buff);
    }
    await bot.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
    return buffer;
  };

  bot.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`, `[1], 'base64')
        : /^https?:\/\//.test(path)
          ? await (await getBuffer(path))
          : fs.existsSync(path)
            ? fs.readFileSync(path)
            : Buffer.alloc(0);

    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifVid(buff, options);
    } else {
      buffer = await videoToWebp(buff);
    }
    await bot.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
    return buffer;
  };

  bot.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];

    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    let type = await FileType.fromBuffer(buffer);
    let trueFileName = attachExtension ? filename + "." + type.ext : filename;
    await fs.writeFileSync(trueFileName, buffer);

    return trueFileName;
  };

  bot.getName = (jid, withoutContact = false) => {
    let id = bot.decodeJid(jid);
    withoutContact = bot.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = (await bot.groupMetadata(id)) || {};
        resolve(
          v.name ||
          v.subject ||
          PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"),
        );
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? { id, name: "WhatsApp" }
          : id === bot.decodeJid(bot.user.id)
            ? bot.user
            : store.contacts[id] || {};
    return (
      (withoutContact ? "" : v.name) ||
      v.subject ||
      v.verifiedName ||
      PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international")
    );
  };

  bot.sendContact = async (jid, kon, quoted = '', opts = {}) => {
    let list = [];
    for (let i of kon) {
      list.push({
        displayName: await bot.getName(i),
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await bot.getName(i)}\nFN:${await bot.getName(i)}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:jangan spam bang\nitem2.EMAIL;type=INTERNET: ShinZ\nitem2.X-ABLabel:YouTube\nitem3.URL:ShinZ.Tech\nitem3.X-ABLabel:GitHub\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
      });
    }
    bot.sendMessage(jid, { contacts: { displayName: `${list.length} Contact`, contacts: list }, ...opts }, { quoted });
  };

  bot.serializeM = (m) => smsg(bot, m, store);

  bot.copyNForward = async (jid, message, forceForward = false, options = {}) => {
    if (options.readViewOnce) {
      message.message = message.message?.ephemeralMessage?.message || message.message;
      let vtype = Object.keys(message.message.viewOnceMessage.message)[0];
      delete message.message.viewOnceMessage.message[vtype].viewOnce;
      message.message = { ...message.message.viewOnceMessage.message };
    }

    let mtype = Object.keys(message.message)[0];
    let content = await generateForwardMessageContent(message, forceForward);
    let ctype = Object.keys(content)[0];
    let context = {};

    if (mtype != "conversation") {
      context = message.message[mtype].contextInfo;
    }

    content[ctype].contextInfo = {
      ...context,
      ...content[ctype].contextInfo,
    };

    const waMessage = await generateWAMessageFromContent(
      jid,
      content,
      options
        ? {
          ...content[ctype],
          ...options,
          ...(options.contextInfo
            ? {
              contextInfo: {
                ...content[ctype].contextInfo,
                ...options.contextInfo,
              },
            }
            : {}),
        }
        : {}
    );

    await bot.relayMessage(jid, waMessage.message, { messageId: waMessage.key.id });
    return waMessage;
  };

  // Helper function getTypeMessage
  function getTypeMessage(message) {
    const type = Object.keys(message);
    var restype = (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) ||
      (type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) ||
      type[type.length - 1] || Object.keys(message)[0];
    return restype;
  }

  bot.prefa = 'hah?';
  bot.public = global.Public || false;

  // connection.update event
  bot.ev.on('connection.update', async (update) => {
    let { Connecting } = require("./run.js");
    Connecting({ update, bot, Boom, DisconnectReason, sleep, color, clientstart });
  });

  // Sending button image message
  bot.sendButtonImg = async (jid, buttons = [], text, image, footer, quoted = '', options = {}) => {
    const buttonMessage = {
      image: { url: image },
      caption: text,
      footer: footer,
      buttons: buttons.map(button => ({
        buttonId: button.id || '',
        buttonText: { displayText: button.text || 'Button' },
        type: button.type || 1
      })),
      headerType: 1,
      viewOnce: options.viewOnce || false,
    };

    return bot.sendMessage(jid, buttonMessage, { quoted });
  };

  // Sending list message
  bot.sendList = async (jid, title, footer, btn, quoted = '', options = {}) => {
    let msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          "messageContextInfo": {
            "deviceListMetadata": {},
            "deviceListMetadataVersion": 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            ...options,
            body: proto.Message.InteractiveMessage.Body.create({ text: title }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || "puqi" }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                {
                  "name": "single_select",
                  "buttonParamsJson": JSON.stringify(btn)
                },
              ]
            })
          })
        }
      }
    }, { quoted });
    return await bot.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
  };

  // Sending button proto
  bot.sendButtonProto = async (jid, title, footer, buttons = [], quoted = '', options = {}) => {
    let msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          "messageContextInfo": {
            "deviceListMetadata": {},
            "deviceListMetadataVersion": 2
           },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            ...options,
            body: proto.Message.InteractiveMessage.Body.create({ text: title }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || "puqi" }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: buttons
            })
          })
        }
      }
    }, { quoted });
    return await bot.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
  };

  // Mention helper
  bot.ments = (teks = '') => {
    return teks.match('@') ? [...teks.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net') : [];
  };

  // Modify copied message
  bot.cMod = (jid, copy, text = '', sender = bot.user.id, options = {}) => {
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = mtype === 'ephemeralMessage';
    if (isEphemeral) mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
    let content = msg[mtype];
    if (typeof content === 'string') msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== 'string') msg[mtype] = {
      ...content,
      ...options
    };
    if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes('@s.whatsapp.net')) sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = sender === bot.user.id;
    return proto.WebMessageInfo.fromObject(copy);
  };

  // Simple send text shortcut
  bot.sendText = (jid, text, quoted = '', options) => bot.sendMessage(jid, { text: text, ...options }, { quoted });

  // Delete message helper
  bot.deleteMessage = async (chatId, key) => {
    try {
      await bot.sendMessage(chatId, { delete: key });
      console.log(`Message deleted: ${key.id}`);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  // Download media message buffer
  bot.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || '';
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  };

  // Save credentials on update
  bot.ev.on('creds.update', saveCreds);

  // Serialize message shortcut
  bot.serializeM = (m) => smsg(bot, m, store);

  return bot;
}

clientstart();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
