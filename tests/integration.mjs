import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdir,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const dependencies=createRequire(require.resolve('wrangler'));
const {Miniflare}=dependencies('miniflare');
const {build}=dependencies('esbuild');
const {outputFiles}=await build({stdin:{contents:`import * as raffle from './app/api/raffle/route';import * as session from './app/api/admin/session/route';import * as reservations from './app/api/admin/reservations/route';const routes={'/api/raffle':raffle,'/api/admin/session':session,'/api/admin/reservations':reservations};export default {async fetch(req){const route=routes[new URL(req.url).pathname];const fn=route?.[req.method];return fn?fn(req):new Response('Method not allowed',{status:405});}};`,resolveDir:process.cwd(),sourcefile:'test-worker.ts',loader:'ts'},plugins:[{name:'fictitious-campaign',setup(b){b.onLoad({filter:/campaign\.json$/},async args=>({contents:JSON.stringify({...JSON.parse(await readFile(args.path,'utf8')),enabled:true,pixKey:'chave-ficticia-para-testes'}),loader:'json'}))}}],bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers']});
const mf=new Miniflare({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{ADMIN_PASSWORD:'test-admin-secret-only'}});
let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++;console.log('PASS',message)};
try{
 const database=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort()){
  for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').filter(x=>x.trim()))await database.prepare(sql).run();
 }
 let cookie='';
 async function call(path,method='GET',body,auth=true,origin='https://test.local',ip='127.0.0.1'){
 const headers={'Origin':origin,'cf-connecting-ip':ip};if(body)headers['Content-Type']='application/json';if(auth&&cookie)headers.Cookie=cookie;
 const response=await mf.dispatchFetch('https://test.local'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
 }
 check((await call('/api/admin/reservations')).status===401,'reservas privadas exigem autenticação');
 check((await call('/api/admin/session','POST',{password:'wrong'})).status===401,'senha incorreta é recusada');
 const login=await call('/api/admin/session','POST',{password:'test-admin-secret-only'});
 check(login.status===200&&login.cookie.includes('HttpOnly')&&login.cookie.includes('Secure')&&login.cookie.includes('SameSite=None')&&login.cookie.includes('Partitioned')&&login.cookie.startsWith('__Host-negao_admin='),'login usa cookie seguro e particionado compatível com visualização incorporada');cookie=login.cookie.split(';')[0];
 check((await call('/api/admin/session')).data.authenticated,'sessão assinada válida é aceita');
 const simultaneous=await Promise.all([call('/api/admin/session'),call('/api/admin/reservations')]);check(simultaneous[0].data.authenticated&&simultaneous[1].status===200,'consulta de sessão e painel após login preservam autenticação');
 check((await call('/api/raffle','POST',{name:'Teste',phone:'48999990000',numbers:[1]},false,'https://outro.local')).status===403,'origem externa não pode criar reservas');
 check((await call('/api/raffle','POST',{name:'T',phone:'1',numbers:[1]})).status===409,'contato inválido é recusado');
 check((await call('/api/raffle','POST',{name:'Teste',phone:'48999990000',numbers:[501]})).status===409,'número fora da faixa é recusado');
 const first=await call('/api/raffle','POST',{name:'Participante Teste',phone:'48999990000',numbers:[1,2]});
 check(first.status===201&&first.data.whatsappUrl.startsWith('https://wa.me/5548991124702?'),'reserva cria mensagem para o WhatsApp do organizador');
 const publicData=(await call('/api/raffle')).data;
 check(publicData.tickets.length===2&&!JSON.stringify(publicData).includes('Participante Teste')&&!JSON.stringify(publicData).includes('48999990000'),'API pública não expõe dados dos participantes');
 const contenders=await Promise.all([call('/api/raffle','POST',{name:'Teste A',phone:'48999990000',numbers:[3]}),call('/api/raffle','POST',{name:'Teste B',phone:'48999990000',numbers:[3]})]);
 check(contenders.filter(x=>x.status===201).length===1&&contenders.filter(x=>x.status===409).length===1,'duas reservas simultâneas não vendem o mesmo número');
 const before=await database.prepare('SELECT COUNT(*) AS count FROM reservations').first();
 check((await call('/api/raffle','POST',{name:'Teste Conflito',phone:'48999990000',numbers:[4,1]})).status===409,'grupo com número ocupado é recusado');
 const after=await database.prepare('SELECT COUNT(*) AS count FROM reservations').first();
 check(before.count===after.count&&!(await database.prepare('SELECT number FROM tickets WHERE number=4').first()),'conflito reverte tanto números quanto registro da reserva');
 check((await call('/api/admin/reservations','PATCH',{id:first.data.id,action:'review'})).status===200,'organizador protege comprovante em conferência');
 await database.prepare('UPDATE reservations SET expires_at=0 WHERE id=?').bind(first.data.id).run();await database.prepare('UPDATE tickets SET expires_at=0 WHERE reservation_id=?').bind(first.data.id).run();
 check((await call('/api/raffle')).data.tickets.filter(t=>t.status==='review').length===2,'números em conferência permanecem bloqueados após prazo original');
 check((await call('/api/admin/reservations','PATCH',{id:first.data.id,action:'confirm'})).status===200,'Pix conferido confirma todos os números da reserva');
 check((await call('/api/admin/reservations','PATCH',{id:first.data.id,action:'release'})).status===409,'pagamento confirmado não é liberado por cancelamento de reserva');
 const expiring=await call('/api/raffle','POST',{name:'Teste Expiração',phone:'48999990000',numbers:[5]});
 await database.prepare('UPDATE reservations SET expires_at=0 WHERE id=?').bind(expiring.data.id).run();await database.prepare('UPDATE tickets SET expires_at=0 WHERE reservation_id=?').bind(expiring.data.id).run();
 const replacement=await call('/api/raffle','POST',{name:'Novo Participante',phone:'48999990000',numbers:[5]});
 check(replacement.status===201,'reserva expirada devolve o número à disponibilidade');
 check((await call('/api/admin/reservations','PATCH',{id:expiring.data.id,action:'confirm'})).status===409,'reserva expirada não confirma número reatribuído');
 check((await call('/api/admin/reservations','POST',{name:'Venda Direta',phone:'48999990000',numbers:[6,7],paid:true})).status===201,'venda manual paga é registrada');
 let panel=(await call('/api/admin/reservations')).data;
 check(panel.summary.total===2000&&panel.summary.paid===4,'resumo soma somente pagamentos confirmados');
 check((await call('/api/admin/reservations','PATCH',{id:replacement.data.id,action:'release'})).status===200,'cancelamento libera reserva não paga');
 check(!(await call('/api/raffle')).data.tickets.some(t=>t.number===5),'tabela pública reflete liberação');
 check((await call('/api/admin/reservations','POST',{name:'Teste CSRF',phone:'48999990000',numbers:[8]},true,'https://outro.local')).status===403,'operações administrativas recusam origem externa');
 const originalCookie=cookie;cookie=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a');check((await call('/api/admin/reservations')).status===401,'cookie adulterado não autentica');cookie=originalCookie;
 check((await call('/api/admin/session','DELETE')).cookie.includes('Max-Age=0'),'sair remove o cookie');
 let last;for(let i=0;i<9;i++)last=await call('/api/admin/session','POST',{password:'wrong'},false,'https://test.local','192.0.2.1');
 check(last.status===429,'tentativas de senha são limitadas');
 console.log(`\n${passed} verificações de integração passaram. Nenhum dado de produção foi usado.`);
}finally{await mf.dispose();}
