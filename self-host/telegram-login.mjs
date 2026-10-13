// Run this script yourself; never paste login codes, passwords, or the session into chat.
// Use ws pure JavaScript fallback; do not load optional native addons.
process.env.WS_NO_BUFFER_UTIL='1';
process.env.WS_NO_UTF_8_VALIDATE='1';
const {TelegramClient}=await import('teleproto');
const {StringSession}=await import('teleproto/sessions');
const {Logger,LogLevel}=await import('teleproto/extensions/Logger');
import {Writable} from 'node:stream';
import {createInterface} from 'node:readline/promises';
let muted=false;const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});output.isTTY=process.stdout.isTTY;output.columns=process.stdout.columns;
const rl=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
async function prompt(text,secret=false){muted=false;const pending=rl.question(text);muted=secret;try{return await pending;}finally{muted=false;if(secret)console.log();}}
const id=Number(await prompt('Telegram API ID: ')),hash=(await prompt('Telegram API hash: ',true)).trim();
if(!Number.isInteger(id)||id<=0||!hash){rl.close();throw new Error('API ID/hash harus diisi.');}
const client=new TelegramClient(new StringSession(''),id,hash,{connectionRetries:2,baseLogger:new Logger(LogLevel.NONE)});
try{await client.start({phoneNumber:async()=>await prompt('Nomor Telegram (+62...): '),phoneCode:async()=>await prompt('Kode login dari Telegram: ',true),password:async()=>await prompt('Password 2FA bila diminta: ',true),emailAddress:async()=>await prompt('Email Telegram bila diminta: '),emailVerification:async()=>({code:await prompt('Kode verifikasi email: ',true)}),onError:()=>{console.error('Login gagal. Periksa kode atau password; rahasia tidak ditampilkan.');return true;}});console.log('Salin nilai sesi berikut langsung ke variable TELEGRAM_SESSION di Railway. Jangan kirim ke chat/GitHub. Sesi ini memberi akses akun Telegram Anda:');console.log(client.session.save());}finally{rl.close();await client.disconnect();}
