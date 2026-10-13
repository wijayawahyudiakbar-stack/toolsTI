export const IOC_PROVIDERS = [
  {id:'shodan',name:'Shodan'}, {id:'recordedfuture',name:'Recorded Future'},
  {id:'abuseipdb',name:'AbuseIPDB'}, {id:'otx',name:'AlienVault OTX'}, {id:'virustotal',name:'VirusTotal'},
];
export function validIPv4(value){return typeof value==='string'&&/^(\d{1,3}\.){3}\d{1,3}$/.test(value)&&value.split('.').every(x=>Number(x)<=255);}
export function parseIPCSV(text){
 const input=String(text).replace(/^\uFEFF/,'');if(input.length>1024*1024)throw new Error('Ukuran CSV maksimum 1 MB.');
 const delimiter=input.split(/\r?\n/)[0].includes(';')?';':',';
 let rows=[],row=[],field='',quoted=false,closed=false;
 for(let i=0;i<input.length;i++){const ch=input[i];if(quoted){if(ch==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
 if(ch==='"'){if(field.trim()||closed)throw new Error('Format kutip CSV tidak valid.');quoted=true;continue;}
 if(ch===delimiter){row.push(field.trim());field='';closed=false;continue;}
 if(ch==='\n'||ch==='\r'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';closed=false;continue;}
 if(closed&&!/\s/.test(ch))throw new Error('Karakter setelah kutip CSV tidak valid.');field+=ch;
 }
 if(quoted)throw new Error('Kutip CSV belum ditutup.');row.push(field.trim());if(row.some(Boolean))rows.push(row);
 if(!rows.length)throw new Error('CSV kosong.');
 const header=rows[0].findIndex(v=>['ip','ipv4','ip_address','indicator','address'].includes(v.toLowerCase()));
 const column=header<0?0:header;const start=header<0?0:1;const ips=[],invalid=[],seen=new Set();let duplicates=0;
 for(let i=start;i<rows.length;i++){const raw=rows[i][column]??'';if(!validIPv4(raw)){invalid.push({row:i+1,value:raw});continue;}const ip=raw.split('.').map(Number).join('.');if(seen.has(ip)){duplicates++;continue;}seen.add(ip);ips.push(ip);}
 if(ips.length>50)throw new Error('Maksimum 50 alamat IP unik per batch. Pisahkan CSV menjadi beberapa file.');
 return {ips,invalid,duplicates};
}
const number=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function providerScore(id,data){
 const empty={value:null,max:100,kind:'unavailable',label:'Skor tidak tersedia',detail:'Respons sumber tidak memuat data yang diperlukan untuk menghitung skor.'};
 if(id==='abuseipdb'){const v=number(data?.data?.abuseConfidenceScore);return v===null||v>100?empty:{value:v,max:100,kind:'native',label:'Abuse confidence',detail:'Skor bawaan AbuseIPDB; bukan probabilitas pasti terjadinya insiden.'};}
 if(id==='recordedfuture'){const v=number(data?.data?.risk?.score??data?.risk?.score);return v===null||v>99?empty:{value:v,max:99,kind:'native',label:'Risk score',detail:'Skor risiko bawaan Recorded Future (0–99).'};}
 if(id==='virustotal'){const stats=data?.data?.attributes?.last_analysis_stats;if(!stats||typeof stats!=='object')return empty;const malicious=number(stats.malicious),suspicious=number(stats.suspicious);const usable=Object.values(stats).map(number);if(malicious===null||suspicious===null||usable.some(v=>v===null))return empty;const total=usable.reduce((a,v)=>a+v,0);return total?{value:Math.round((malicious+suspicious)/total*100),max:100,kind:'derived',label:'Rasio deteksi',detail:`${malicious} malicious + ${suspicious} suspicious / ${total} hasil engine. Persentase turunan, bukan skor resmi VirusTotal.`}:empty;}
 if(id==='otx'){const count=number(data?.pulse_info?.count);return count===null?empty:{value:Math.min(100,count*10),max:100,kind:'derived',label:'Aktivitas pulse',detail:`${count} pulse terkait. Indeks internal min(100, pulse × 10); keterkaitan pulse tidak otomatis berarti IP berbahaya.`};}
 if(id==='shodan'){if(!Array.isArray(data?.ports))return empty;const ports=new Set(data.ports).size;const vulns=Array.isArray(data.vulns)?data.vulns.length:data.vulns&&typeof data.vulns==='object'?Object.keys(data.vulns).length:null;
 return {value:Math.min(100,ports*5+(vulns??0)*15),max:100,kind:'derived',label:'Eksposur aset',detail:`${ports} port; ${vulns===null?'data kerentanan tidak disertakan':vulns+' kerentanan'}. Indeks internal min(100, port × 5 + kerentanan × 15); tidak menggantikan penilaian risiko.`};}
 return empty;
}
export function csvCell(value){const raw=String(value??'');const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';}
export function resultsCSV(rows){
 const header=['ip',...IOC_PROVIDERS.flatMap(p=>[`${p.id}_score`,`${p.id}_scale`,`${p.id}_type`,`${p.id}_status`,`${p.id}_detail`])];
 const lines=rows.map(row=>[row.indicator,...IOC_PROVIDERS.flatMap(p=>{const result=row.results.find(r=>r.id===p.id||r.provider===p.name);return [result?.score?.value??'',result?.score?.max??'',result?.score?.kind??'',result?.status??'error',result?.error??result?.score?.detail??row.error??''];})]);
 return '\uFEFF'+[header,...lines].map(line=>line.map(csvCell).join(',')).join('\r\n');
}
