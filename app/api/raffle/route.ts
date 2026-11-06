import {sameOrigin} from '../../../lib/admin-auth';
import {allocate,campaign,db,json,parseBuyer,parseNumbers,ready} from '../../../lib/raffle';
export async function GET(){try{const {results}=await db().prepare("SELECT number,status FROM tickets WHERE status IN('paid','review') OR expires_at>?").bind(Date.now()).all();return json({campaign:{...campaign,enabled:ready()},tickets:results});}catch{return json({error:'Não foi possível atualizar os números. Tente novamente.'},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
 if(!ready())return json({error:'A rifa ainda não está aberta.'},409);
 try{const body=await request.json() as Record<string,unknown>;const buyer=parseBuyer(body),numbers=parseNumbers(body.numbers);return json(await allocate(numbers,buyer,'online'),201);}
 catch(e){return json({error:e instanceof Error&&/Informe|Escolha/.test(e.message)?e.message:'Um dos números já foi reservado. Atualize e escolha novamente.'},409);}
}
