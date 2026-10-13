import { createPublicKey, verify, timingSafeEqual } from 'node:crypto';
let cached={keys:[],expires:0};
export async function verifyGoogleToken(token,clientId,nonce,domain,loadKeys){
 if(!clientId||!nonce)throw new Error('Login Google belum dikonfigurasi atau sesi login kedaluwarsa.');
 const parts=String(token).split('.');if(parts.length!==3)throw new Error('Token Google tidak valid.');
 const header=JSON.parse(Buffer.from(parts[0],'base64url')),payload=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(header.alg!=='RS256'||!header.kid)throw new Error('Algoritma token tidak diizinkan.');
 let keys;if(loadKeys){keys=await loadKeys();}else{if(cached.expires<Date.now()){const r=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Verifikasi Google sedang tidak tersedia.');cached={keys:(await r.json()).keys,expires:Date.now()+3600000};}keys=cached.keys;}
 const jwk=keys.find(k=>k.kid===header.kid);if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw new Error('Tanda tangan Google tidak valid.');
 if(!['accounts.google.com','https://accounts.google.com'].includes(payload.iss)||payload.aud!==clientId||payload.exp<=Date.now()/1000||!payload.exp||payload.iat>Date.now()/1000+60)throw new Error('Token kedaluwarsa atau ditujukan untuk aplikasi lain.');
 const expected=Buffer.from(nonce),actual=Buffer.from(String(payload.nonce??''));if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error('Nonce login tidak valid.');
 if(payload.email_verified!==true||typeof payload.email!=='string'||!payload.sub)throw new Error('Gunakan akun Google dengan email terverifikasi.');
 const isGmail=payload.email.toLowerCase().endsWith('@gmail.com');
 if((!isGmail&&!payload.hd)||(domain&&String(payload.hd??'').toLowerCase()!==domain.toLowerCase()))throw new Error('Gunakan akun Google yang diizinkan.');
 return {userId:payload.sub,email:payload.email.toLowerCase(),fullName:payload.name??null};
}
