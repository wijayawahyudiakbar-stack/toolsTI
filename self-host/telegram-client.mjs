// Use ws pure JavaScript fallback; do not load optional native addons.
process.env.CIFRANTE_NATIVE='0';
process.env.WS_NO_BUFFER_UTIL='1';
process.env.WS_NO_UTF_8_VALIDATE='1';
const {TelegramClient}=await import('teleproto');
const {StringSession}=await import('teleproto/sessions');
const {Logger,LogLevel}=await import('teleproto/extensions/Logger');
export function telegramMessages(messages,channel){return messages.filter(m=>m.message&&Number.isFinite(m.date)).map(m=>({id:`telegram:${channel.toLowerCase()}:${m.id}`,platform:'telegram',channel:'@'+channel,author:channel,text:String(m.message).slice(0,12000),date:new Date(m.date*1000).toISOString(),url:`https://t.me/${channel}/${m.id}`,verified:false}));}
export async function readTelegramChannel(channel,env=process.env) {
 const apiId=Number(env.TELEGRAM_API_ID),apiHash=env.TELEGRAM_API_HASH,session=env.TELEGRAM_SESSION;
 if(!Number.isInteger(apiId)||apiId<=0||!apiHash||!session)throw new Error('Telegram Client API: lengkapi TELEGRAM_API_ID, TELEGRAM_API_HASH, dan TELEGRAM_SESSION.');
 let client;
 try{const logger=new Logger(LogLevel.NONE);
 client=new TelegramClient(new StringSession(session),apiId,apiHash,{connectionRetries:1,requestRetries:1,timeout:10,baseLogger:logger,receiveUpdates:false,floodSleepThreshold:0,autoReconnect:false});
 await client.connect();if(!await client.checkAuthorization())throw new Error('AUTH_KEY_UNREGISTERED');const messages=await client.getMessages(channel,{limit:50});return telegramMessages(messages,channel);}catch(e){if(String(e.errorMessage||e.message).includes('FLOOD_WAIT'))throw new Error('Telegram membatasi permintaan. Tunggu sebelum mencoba kembali.');throw new Error('Telegram Client API: koneksi atau akses channel gagal. Periksa sesi login dan izin akun.');}finally{if(client)await client.disconnect();}
}
