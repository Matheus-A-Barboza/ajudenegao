import {authenticated,sameOrigin} from '../../../../lib/admin-auth';
import {adminPassword,allocate,campaign,db,json,parseBuyer,parseNumbers} from '../../../../lib/raffle';
type Order={id:string;buyer_name:string;buyer_phone:string;numbers:string;amount_cents:number;status:string;created_at:number;expires_at:number;source:string;confirmed_at:number|null};
async function allowed(request:Request){return authenticated(request,adminPassword());}
export async function GET(request:Request){
 if(!await allowed(request))return json({error:'Entre para acessar o painel.'},401);
 try{const {results}=await db().prepare('SELECT * FROM reservations ORDER BY created_at DESC').all<Order>();const now=Date.now();
 const orders=results.map(r=>({...r,numbers:JSON.parse(r.numbers) as number[],status:r.status==='reserved'&&r.expires_at<=now?'expired':r.status}));
 const {results:tickets}=await db().prepare("SELECT number,status FROM tickets WHERE status IN('paid','review') OR expires_at>?").bind(now).all<{number:number;status:string}>();
 const paid=tickets.filter(t=>t.status==='paid').length,review=tickets.filter(t=>t.status==='review').length,reserved=tickets.filter(t=>t.status==='reserved').length;
 return json({orders,tickets,summary:{paid,review,reserved,available:campaign.totalNumbers-paid-review-reserved,total:orders.filter(o=>o.status==='paid').reduce((sum,o)=>sum+o.amount_cents,0)},campaign});
 }catch{return json({error:'Não foi possível carregar as reservas.'},503);}
}
export async function POST(request:Request){
 if(!await allowed(request))return json({error:'Entre para acessar o painel.'},401);
 if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
 try{const body=await request.json() as Record<string,unknown>;const buyer=parseBuyer(body),numbers=parseNumbers(body.numbers,50);return json(await allocate(numbers,buyer,'manual',body.paid===true),201);}
 catch(e){return json({error:e instanceof Error&&/Informe|Escolha/.test(e.message)?e.message:'Um dos números não está disponível. Atualize a lista.'},409);}
}
export async function PATCH(request:Request){
 if(!await allowed(request))return json({error:'Entre para acessar o painel.'},401);
 if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
 try{const {id,action}=await request.json() as {id:unknown;action:unknown};if(typeof id!=='string'||!['confirm','review','release'].includes(String(action)))return json({error:'Operação inválida.'},400);
 const database=db(),now=Date.now();const order=await database.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first<Order>();
 if(!order)return json({error:'Reserva não encontrada.'},404);
 const numbers=JSON.parse(order.numbers) as number[];let result;
 if(action==='release'){
 result=await database.batch([
 database.prepare("UPDATE reservations SET status='cancelled' WHERE id=? AND status IN('reserved','review')").bind(id),
 database.prepare("DELETE FROM tickets WHERE reservation_id=? AND status IN('reserved','review') AND EXISTS(SELECT 1 FROM reservations WHERE id=? AND status='cancelled')").bind(id,id)]);
 }else{
 const status=action==='confirm'?'paid':'review';
 // Only an intact, unexpired allocation can be moved forward; the batch prevents races with new reservations.
 result=await database.batch([
 database.prepare("UPDATE reservations SET status=?,confirmed_at=? WHERE id=? AND status IN('reserved','review') AND (status='review' OR expires_at>?) AND (SELECT COUNT(*) FROM tickets WHERE reservation_id=? AND (status='review' OR (status='reserved' AND expires_at>?)))=?").bind(status,status==='paid'?now:null,id,now,id,now,numbers.length),
 database.prepare("UPDATE tickets SET status=? WHERE reservation_id=? AND status IN('reserved','review') AND EXISTS(SELECT 1 FROM reservations WHERE id=? AND status=?)").bind(status,id,id,status)]);
 }
 if(!result[0].meta.changes)return json({error:'Reserva expirada ou já finalizada. Confira a disponibilidade antes de registrar uma nova venda.'},409);
 return json({ok:true});
 }catch{return json({error:'Não foi possível atualizar a reserva.'},503);}
}
