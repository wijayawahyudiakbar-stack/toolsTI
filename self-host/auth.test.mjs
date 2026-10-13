import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyGoogleToken } from './google-auth.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'test'};
const base={iss:'https://accounts.google.com',aud:'client',exp:Date.now()/1000+300,iat:Date.now()/1000,nonce:'nonce',email_verified:true,email:'admin@example.com',hd:'example.com',sub:'user1'};
function token(payload=base){const a=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),b=Buffer.from(JSON.stringify(payload)).toString('base64url');return a+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(a+'.'+b),privateKey).toString('base64url');}
const verify=t=>verifyGoogleToken(t,'client','nonce','example.com',async()=>[jwk]);
test('verified Workspace identity accepted',async()=>assert.equal((await verify(token())).email,'admin@example.com'));
for(const [name,changes]of Object.entries({audience:{aud:'other'},expired:{exp:1},nonce:{nonce:'attacker'},domain:{hd:'other.co.id'},unverified:{email_verified:false},issuer:{iss:'attacker'},nonWorkspace:{hd:undefined}}))test('reject '+name,async()=>assert.rejects(()=>verify(token({...base,...changes}))));
test('reject forged signature',async()=>{const t=token().split('.');t[1]=Buffer.from(JSON.stringify({...base,email:'attacker@example.com'})).toString('base64url');await assert.rejects(()=>verify(t.join('.')));});

test('verified Gmail administrator accepted without Workspace domain',async()=>{const user=await verifyGoogleToken(token({...base,email:'wijayawahyudiakbar@gmail.com',hd:undefined}),'client','nonce','',async()=>[jwk]);assert.equal(user.email,'wijayawahyudiakbar@gmail.com');});
test('Gmail rejected when a Workspace domain is explicitly required',async()=>assert.rejects(()=>verify(token({...base,email:'wijayawahyudiakbar@gmail.com',hd:undefined}))));
test('external email without Workspace ownership rejected with no domain restriction',async()=>assert.rejects(()=>verifyGoogleToken(token({...base,email:'user@example.net',hd:undefined}),'client','nonce','',async()=>[jwk])));
