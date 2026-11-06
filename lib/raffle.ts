import {env} from 'cloudflare:workers';
import campaign from '../campaign.json';
export {campaign};
export const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export const db=()=>{if(!env.DB)throw Error('Banco indisponível.');return env.DB;};
export const adminPassword=()=>(env as unknown as Record<string,string>).ADMIN_PASSWORD;
export const ready=()=>Boolean(campaign.enabled&&campaign.pixKey&&campaign.pixHolder&&/^55\d{10,11}$/.test(campaign.whatsapp)&&campaign.priceCents>0&&adminPassword());
export function parseBuyer(body:Record<string,unknown>){
 const name=typeof body.name==='string'?body.name.trim():'';const phone=typeof body.phone==='string'?body.phone.replace(/\D/g,''):'';
 if(name.length<2||name.length>100||!/^(?:\d{10,11}|55\d{10,11})$/.test(phone))throw Error('Informe nome e WhatsApp com DDD.');
 return {name,phone};
}
export function parseNumbers(value:unknown,max=10):number[]{if(!Array.isArray(value)||value.length<1||value.length>max||new Set(value).size!==value.length||value.some(n=>!Number.isInteger(n)||n<1||n>campaign.totalNumbers))throw Error(`Escolha de 1 a ${max} números entre 001 e ${campaign.totalNumbers}.`);return [...value].sort((a,b)=>a-b);}
export async function allocate(numbers:number[],buyer:{name:string;phone:string},source:'online'|'manual',paid=false){
 const database=db(),now=Date.now(),id=crypto.randomUUID(),expires=now+campaign.reservationMinutes*60000,status=paid?'paid':'reserved';
 await database.batch([
 database.prepare("DELETE FROM tickets WHERE status='reserved' AND expires_at<=?").bind(now),
 database.prepare('INSERT INTO reservations(id,buyer_name,buyer_phone,numbers,amount_cents,status,created_at,expires_at,source,confirmed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,buyer.name,buyer.phone,JSON.stringify(numbers),numbers.length*campaign.priceCents,status,now,expires,source,paid?now:null),
 ...numbers.map(n=>database.prepare('INSERT INTO tickets(number,reservation_id,status,expires_at) VALUES(?,?,?,?)').bind(n,id,status,expires))]);
 const total=(numbers.length*campaign.priceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const message=`Olá! Sou ${buyer.name}. Reservei os números ${numbers.join(', ')} na rifa do Negão. Total: ${total}. Reserva: ${id}. Vou enviar o comprovante para conferência.`;
 return {id,numbers,expires,whatsappUrl:`https://wa.me/${campaign.whatsapp}?text=${encodeURIComponent(message)}`};
}
