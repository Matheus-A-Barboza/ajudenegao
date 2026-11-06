import {authenticated,equalSecret,hash,makeSession,sameOrigin,sessionCookie} from '../../../../lib/admin-auth';
import {adminPassword,db,json} from '../../../../lib/raffle';
export async function GET(request:Request){return json({authenticated:await authenticated(request,adminPassword())});}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
 const secret=adminPassword();if(!secret)return json({error:'A senha administrativa ainda não foi configurada.'},503);
 try{
 const ip=request.headers.get('cf-connecting-ip')||'unknown';const now=Date.now();const bucket=await hash(ip+':'+Math.floor(now/900000));
 const attempts=await db().prepare('INSERT INTO login_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+900000).first<{count:number}>();
 if(!attempts||attempts.count>8)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const body=await request.json() as {password:unknown};
 if(typeof body.password!=='string'||body.password.length>200||!await equalSecret(body.password,secret))return json({error:'Senha incorreta.'},401);
 await db().prepare('DELETE FROM login_attempts WHERE expires_at<?').bind(now).run();
 return json({authenticated:true},200,{'Set-Cookie':sessionCookie(await makeSession(secret))});
 }catch{return json({error:'Não foi possível entrar. Tente novamente.'},503);}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return json({error:'Origem inválida.'},403);return json({authenticated:false},200,{'Set-Cookie':sessionCookie('',0)});}
