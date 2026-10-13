export function extractIndicators(text='') {
 const ips=[...new Set((text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)||[]).filter(ip=>ip.split('.').every(n=>Number(n)<=255)))];
 const cves=[...new Set((text.match(/\bCVE-\d{4}-\d{4,}\b/gi)||[]).map(x=>x.toUpperCase()))];
 return {ips:ips.slice(0,30),cves:cves.slice(0,30)};
}
function plainHTML(html) {
 return html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,v)=>{if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v.toLowerCase()]||'';}).trim();
}
export function telegramPublicPosts(html,channel) {
 const chunks=html.split(/(?=<div\b[^>]*class="[^"]*tgme_widget_message [^"]*"[^>]*data-post=)/);
 const posts=[];
 for(const chunk of chunks){const key=chunk.match(/data-post="([a-z0-9_]+)\/(\d+)"/i),text=chunk.match(/<div[^>]*class="tgme_widget_message_text[^"<]*"[^>]*>([\s\S]*?)<\/div>/),date=chunk.match(/<time[^>]*datetime="([^"]+)"/);
  if(!key||key[1].toLowerCase()!==channel.toLowerCase()||!text||!date||!Number.isFinite(Date.parse(date[1])))continue;
  const content=plainHTML(text[1]).slice(0,12000);if(!content)continue;
  posts.push({id:`telegram:${channel.toLowerCase()}:${key[2]}`,platform:'telegram',channel:'@'+channel,author:channel,text:content,date:new Date(date[1]).toISOString(),url:`https://t.me/${channel}/${key[2]}`,indicators:extractIndicators(content),verified:false});
 }
 return [...new Map(posts.map(p=>[p.id,p])).values()];
}
export function xPosts(data) {
 const users=new Map((data.includes?.users||[]).map(u=>[u.id,u.username]));
 return (data.data||[]).filter(p=>p.id&&p.text&&p.created_at).map(p=>({id:'x:'+p.id,platform:'x',author:users.get(p.author_id)||p.author_id||'X',text:p.text,date:p.created_at,url:`https://x.com/i/status/${p.id}`,indicators:extractIndicators(p.text),verified:false}));
}
export function socialTrend(p){return {id:p.id,title:p.text.replace(/\s+/g,' ').slice(0,140),category:'Social signal',severity:'Unverified',source:p.platform==='telegram'?'Telegram':'X / Twitter',date:p.date,region:'Belum diketahui',description:`Belum diverifikasi. ${p.channel||p.author} — ${p.text}`,url:p.url||undefined};}
export function createSocialCollector(db,env=process.env,fetchImpl=fetch) {
 db.exec('CREATE TABLE IF NOT EXISTS social_posts(id TEXT PRIMARY KEY, platform TEXT NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS social_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const channels=[...new Set((env.TELEGRAM_PUBLIC_CHANNELS??'breachdetect').split(',').map(x=>x.trim().replace(/^@/,'').toLowerCase()).filter(x=>/^[a-z][a-z0-9_]{4,31}$/.test(x)))].slice(0,10);
 let running=false,lastSync=null,error=null,timer,lastAttempt=0;const sourceStatus=[];
 function save(items){const stmt=db.prepare('INSERT INTO social_posts VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,payload=excluded.payload');for(const p of items)stmt.run(p.id,p.platform,p.date,JSON.stringify(p));db.prepare('DELETE FROM social_posts WHERE date<?').run(new Date(Date.now()-30*86400000).toISOString());db.exec('DELETE FROM social_posts WHERE id NOT IN (SELECT id FROM social_posts ORDER BY date DESC LIMIT 5000)');}
 async function request(url,options,platform){let r;try{r=await fetchImpl(url,{...options,signal:AbortSignal.timeout(30000)});}catch{throw new Error(`${platform}: koneksi gagal atau timeout.`);}if(!r.ok)throw new Error(`${platform}: HTTP ${r.status}. Periksa token, izin API, kuota, atau collector lain.`);return r.json();}
 async function poll(force=false){if(running||!channels.length||(!force&&Date.now()-lastAttempt<300000))return;running=true;lastAttempt=Date.now();const errors=[];sourceStatus.length=0;
 try{for(const channel of channels){try{let response;try{response=await fetchImpl(`https://t.me/s/${channel}`,{headers:{'User-Agent':'IntelWatch/1.0 (public channel monitor)'},signal:AbortSignal.timeout(15000)});}catch{throw new Error('koneksi gagal atau timeout');}if(!response.ok)throw new Error(`HTTP ${response.status}`);const html=await response.text();if(html.length>3000000)throw new Error('halaman terlalu besar');const posts=telegramPublicPosts(html,channel);sourceStatus.push({channel:'@'+channel,posts:posts.length,messageBlocks:(html.match(/data-post=/g)||[]).length,textBlocks:(html.match(/tgme_widget_message_text/g)||[]).length,title:plainHTML(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,160),checked:new Date().toISOString()});if(!posts.length)throw new Error('tidak ada posting teks yang dapat dibaca dari halaman publik');save(posts);}catch(e){errors.push('@'+channel+': '+e.message);}}
 if(errors.length)error=errors.join('; ');else{lastSync=new Date().toISOString();error=null;}
 }finally{running=false;}}
 return {save,poll,start(){if(channels.length){void poll();timer=setInterval(()=>void poll(),300000);timer.unref();}},stop(){clearInterval(timer);},status(){return {telegram:{configured:channels.length>0,channels:channels.map(x=>'@'+x),lastSync,error,running,sourceStatus},x:{configured:!!env.X_BEARER_TOKEN}};},async searchTelegram(keyword){if(!channels.length)throw new Error('TELEGRAM_PUBLIC_CHANNELS belum dikonfigurasi.');await poll();const q=keyword.toLowerCase();return db.prepare("SELECT payload FROM social_posts WHERE platform='telegram' ORDER BY date DESC LIMIT 5000").all().map(r=>JSON.parse(r.payload)).filter(p=>channels.includes((p.channel||'').replace(/^@/,'').toLowerCase())&&p.text.toLowerCase().includes(q)).slice(0,30);},trends(){return db.prepare('SELECT payload FROM social_posts ORDER BY date DESC LIMIT 500').all().map(r=>JSON.parse(r.payload)).filter(p=>p.platform!=='telegram'||channels.includes((p.channel||'').replace(/^@/,'').toLowerCase())).map(socialTrend);},async searchX(keyword){if(!env.X_BEARER_TOKEN)throw new Error('X_BEARER_TOKEN belum dikonfigurasi.');const url=new URL('https://api.x.com/2/tweets/search/recent');url.search=new URLSearchParams({query:keyword,max_results:'30','tweet.fields':'created_at,author_id','expansions':'author_id','user.fields':'username'}).toString();const data=await request(url,{headers:{Authorization:'Bearer '+env.X_BEARER_TOKEN}},'X');if(data.errors?.length)throw new Error('X: query ditolak atau respons API tidak lengkap. Periksa keyword dan izin pencarian.');const items=xPosts(data);save(items);return items;}};
}
