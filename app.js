(() => {
'use strict';

const CFG = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const TZ = 'America/Fortaleza';
const ROLE_LABELS = {
  ADMIN:'Admin', COLABORADOR_ARMAZEM:'Colaborador Armazém', COLABORADOR_ENTREGA:'Colaborador Entrega', CONFERENTE:'Conferente'
};
const VALUE_TYPES = [
  {key:'g300',label:'Garrafeiras 300ml',value:69.5},
  {key:'g600_green',label:'600ml Verde',value:83},
  {key:'g600_brown',label:'600ml Marrom',value:71},
  {key:'g_litrao',label:'Garrafeiras de Litrão',value:59},
  {key:'keg30',label:'Barris de Chopp 30L',value:400},
  {key:'keg50',label:'Barris de Chopp 50L',value:400}
];

let sb = null;
let authUser = null;
let profile = null;
let refs = {products:[],units:[],shifts:[],drivers:[],factories:[],customers:[]};
let productsByCode = new Map();
let customersByCode = new Map();
let nriDraftItems = [];
let nriEditingId = null;
let pendingNris = [];
let selectedNris = new Set();
let printOperation = null;
let historyNris = [];
let avariaItems = [];
let avariaEditingId = null;
let avPhotoBlob = null;
let avPhotoPreviewUrl = '';
let avGps = null;
let signatureDirty = false;
let drawingSignature = false;
let currentAvariaDetail = null;
let allConferences = [];
let allMaps = [];
let realtimeChannel = null;
let activeView = '';
let toastTimer = null;
let refRefreshPromise = null;

const viewMeta = {
  'nri-cadastro':['Cadastro por carreta','Cadastre várias NRIs de uma vez'],
  'nri-pendentes':['Impressões pendentes','Fila atualizada em tempo real'],
  'avaria-cadastro':['Registrar avaria','Foto, GPS e assinatura'],
  'conf-cadastro':['Conferência de vasilhames','Registro físico de retorno'],
  'conf-minhas':['Minhas conferências','Histórico do usuário atual'],
  'avaria-admin':['Todas as avarias','Análise e aprovação'],
  'nri-historico':['Histórico NRI','Rastreabilidade completa'],
  'conf-historico':['Histórico de conferências','Todos os registros'],
  'conf-dashboard':['Dashboard comparativo','Planejado x conferido'],
  'usuarios':['Usuários e perfis','Controle de acesso'],
  'bases':['Bases / importação','Migração do Google Sheets']
};

window.addEventListener('DOMContentLoaded', init);

async function init(){
  bindBaseEvents();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

  if (!isConfigured()) {
    setBackendStatus('error','Configure o Supabase em config.js');
    showLogin('Preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js.');
    return;
  }
  try{
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    setBackendStatus('checking','Conectando ao Supabase…');
    const {data:{session},error} = await sb.auth.getSession();
    if(error) throw error;
    if(session?.user){
      const ok = await loadProfile(session.user);
      if(ok) await startApp(); else showLogin();
    }else showLogin();
    setBackendStatus('ok','Supabase conectado');

    sb.auth.onAuthStateChange((_event,sessionNow)=>{
      if(!sessionNow && profile){ profile=null; authUser=null; teardownRealtime(); showLogin(); }
    });
  }catch(e){
    console.error(e); setBackendStatus('error','Falha ao conectar ao Supabase'); showLogin(humanError(e));
  }
}

function isConfigured(){
  return /^https:\/\/.+\.supabase\.co$/i.test(String(CFG.SUPABASE_URL||'')) && String(CFG.SUPABASE_ANON_KEY||'').length>40 && !String(CFG.SUPABASE_ANON_KEY||'').includes('COLE_AQUI');
}
function setBackendStatus(type,text){ const el=$('backendStatus'); if(!el)return; el.className=`backend-status ${type}`; el.querySelector('span').textContent=text; }
function updateOnlineStatus(){ const el=$('syncPill'); if(!el)return; const online=navigator.onLine; el.classList.toggle('offline',!online); el.querySelector('span').textContent=online?'Online':'Sem internet'; }

function bindBaseEvents(){
  $('formLogin').addEventListener('submit', login);
  $('btnMostrarSenha').addEventListener('click',()=>{ const i=$('loginSenha'); i.type=i.type==='password'?'text':'password'; $('btnMostrarSenha').textContent=i.type==='password'?'Mostrar':'Ocultar'; });
  $('btnSair').addEventListener('click', logout); $('btnSairMobile').addEventListener('click',logout);
  $('menuBtn').addEventListener('click',()=>toggleSidebar(true)); $('overlay').addEventListener('click',()=>toggleSidebar(false));
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
  $('modalClose').addEventListener('click',closeModal); $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});

  // NRI
  $('nriCodigo').addEventListener('input',onProductCode);
  $('nriValidade').addEventListener('input',e=>{ e.target.value=maskShortDate(e.target.value); updateBlockDate(); });
  $('nriLote').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
  $('nriPlaca').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
  $('btnAdicionarNriItem').addEventListener('click',addNriDraftItem);
  $('btnCancelarNriItem').addEventListener('click',clearNriItemEditor);
  $('btnLimparNri').addEventListener('click',clearNriRequest);
  $('formNriCadastro').addEventListener('submit',submitNriRequest);
  $('nriItemList').addEventListener('click',onNriDraftListClick);
  $('pendFiltro').addEventListener('input',renderPending);
  $('pendUnidade').addEventListener('change',renderPending);
  $('tbodyPendentes').addEventListener('click',onPendingClick);
  $('tbodyPendentes').addEventListener('change',onPendingCheck);
  $('btnSelecionarPendentes').addEventListener('click',toggleVisiblePendingSelection);
  $('btnImprimirTudo').addEventListener('click',()=>startPrint(filteredPending()));
  $('btnImprimirSelecionadas').addEventListener('click',()=>startPrint(pendingNris.filter(x=>selectedNris.has(x.id))));
  ['histNriBusca','histNriStatus','histNriUnidade','histNriDe','histNriAte'].forEach(id=>$(id).addEventListener(id==='histNriBusca'?'input':'change',renderNriHistory));
  $('btnAtualizarHistNri').addEventListener('click',loadNriHistory);
  $('tbodyHistNri').addEventListener('click',onNriHistoryClick);

  // Avarias
  $('avData').addEventListener('change',()=>{});
  $('avPdv').addEventListener('input',onPdvInput);
  $('avLote').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
  $('btnAvCamera').addEventListener('click',()=>$('avFotoCamera').click());
  $('btnAvArquivo').addEventListener('click',()=>$('avFotoArquivo').click());
  $('avFotoCamera').addEventListener('change',onAvariaPhoto);
  $('avFotoArquivo').addEventListener('change',onAvariaPhoto);
  $('btnAdicionarAvItem').addEventListener('click',addAvariaItem);
  $('btnCancelarAvItem').addEventListener('click',clearAvariaItemEditor);
  $('avItemList').addEventListener('click',onAvariaItemListClick);
  $('btnLimparAssinatura').addEventListener('click',clearSignature);
  $('btnLimparAvaria').addEventListener('click',clearAvariaRequest);
  $('formAvaria').addEventListener('submit',submitAvaria);
  $('avAdminBusca').addEventListener('input',renderAdminAvarias);
  $('avAdminStatus').addEventListener('change',renderAdminAvarias);
  $('btnAtualizarAvarias').addEventListener('click',loadAdminAvarias);
  $('tbodyAvariasAdmin').addEventListener('click',onAdminAvariaClick);
  setupSignatureCanvas();

  // Conferencia
  $('formConferencia').addEventListener('submit',submitConference);
  $('btnLimparConf').addEventListener('click',clearConferenceForm);
  $('btnAtualizarMinhas').addEventListener('click',loadMyConferences);
  $('minhasMapa').addEventListener('input',renderMyConferences);
  $('minhasData').addEventListener('change',renderMyConferences);
  $('btnAtualizarHistConf').addEventListener('click',loadConferenceHistory);
  ['histConfMapa','histConfConferente','histConfDe','histConfAte'].forEach(id=>$(id).addEventListener(id.includes('De')||id.includes('Ate')?'change':'input',renderConferenceHistory));
  $('btnExportarHistConf').addEventListener('click',exportConferenceCsv);
  $('btnAtualizarDashboard').addEventListener('click',loadDashboard);
  ['dashData','dashMapa','dashCidade'].forEach(id=>$(id).addEventListener(id==='dashData'?'change':'input',renderDashboard));
  $('tbodyDashboard').addEventListener('click',onDashboardClick);

  // Users/import
  $('formUsuario').addEventListener('submit',saveUser);
  $('btnLimparUsuario').addEventListener('click',clearUserForm);
  $('tbodyUsuarios').addEventListener('click',onUserTableClick);
  $('btnImportarBase').addEventListener('click',importBaseCsv);
}

async function login(e){
  e.preventDefault();
  if(!sb) return;
  const username=normalizeUsername($('loginUsuario').value); const password=$('loginSenha').value;
  if(!username||!password) return setLoginMessage('Informe usuário e senha.');
  const btn=$('btnEntrar'); btn.disabled=true; btn.textContent='Entrando…'; setLoginMessage('');
  try{
    const email=`${username}@${CFG.USER_EMAIL_DOMAIN||'disbecol.app'}`;
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error) throw error;
    if(!await loadProfile(data.user)){ await sb.auth.signOut(); throw new Error('Usuário inativo ou sem perfil.'); }
    $('loginSenha').value=''; await startApp();
  }catch(err){ setLoginMessage(loginError(err)); }
  finally{btn.disabled=false;btn.textContent='Entrar →';}
}
async function loadProfile(user){
  authUser=user;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(error||!data||!data.active){profile=null;return false;} profile=data; return true;
}
async function logout(){
  teardownRealtime(); profile=null;authUser=null; refs={products:[],units:[],shifts:[],drivers:[],factories:[],customers:[]};
  $('appShell').classList.add('hidden'); $('loginScreen').classList.remove('hidden');
  try{await sb.auth.signOut();}catch(_e){}
  setLoginMessage('');
}
function showLogin(msg=''){ $('appShell').classList.add('hidden');$('loginScreen').classList.remove('hidden');setLoginMessage(msg); }
function setLoginMessage(msg){$('loginMessage').textContent=msg||'';}
function loginError(e){ const m=String(e?.message||e||''); if(/invalid login/i.test(m))return 'Usuário ou senha inválidos.'; return humanError(e); }

async function startApp(){
  $('loginScreen').classList.add('hidden'); $('appShell').classList.remove('hidden');
  $('userNome').textContent=profile.name; $('userPerfil').textContent=ROLE_LABELS[profile.role]||profile.role; $('userAvatar').textContent=initials(profile.name);
  applyRole(); fillDefaultDates();
  await loadReferences(true);
  setupRealtime();
  if(canNri()) { await loadPending(); }
  if(isAdmin()) { loadAdminAvarias(); }
  const defaultView = profile.role==='COLABORADOR_ENTREGA'?'avaria-cadastro':profile.role==='CONFERENTE'?'conf-cadastro':'nri-cadastro';
  openView(defaultView,true);
}
function isAdmin(){return profile?.role==='ADMIN';}
function canNri(){return ['ADMIN','COLABORADOR_ARMAZEM'].includes(profile?.role);}
function canAvaria(){return ['ADMIN','COLABORADOR_ENTREGA'].includes(profile?.role);}
function canConference(){return ['ADMIN','CONFERENTE'].includes(profile?.role);}
function applyRole(){
  document.querySelectorAll('.role-nri').forEach(x=>x.classList.toggle('hidden',!canNri()));
  document.querySelectorAll('.role-avaria').forEach(x=>x.classList.toggle('hidden',!canAvaria()));
  document.querySelectorAll('.role-conferencia').forEach(x=>x.classList.toggle('hidden',!canConference()));
  document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
}
function openView(name,force=false){
  const v=$(`view-${name}`); if(!v||v.classList.contains('hidden'))return;
  if(!force&&activeView===name){toggleSidebar(false);return;}
  activeView=name; document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); v.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  const meta=viewMeta[name]||['Gestão Operacional','']; $('topbarTitulo').textContent=meta[0];$('topbarSubtitulo').textContent=meta[1]; toggleSidebar(false);
  if(name==='nri-pendentes')loadPending();
  if(name==='nri-historico')loadNriHistory();
  if(name==='avaria-admin')loadAdminAvarias();
  if(name==='conf-minhas')loadMyConferences();
  if(name==='conf-historico')loadConferenceHistory();
  if(name==='conf-dashboard')loadDashboard();
  if(name==='usuarios')loadUsers();
}
function toggleSidebar(open){$('sidebar').classList.toggle('open',open);$('overlay').classList.toggle('show',open);}

function setupRealtime(){
  teardownRealtime();
  realtimeChannel=sb.channel(`ops-${authUser.id}`);
  if(canNri()) realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'nris'},()=>debounceReload('nri'));
  if(isAdmin()) realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'damage_requests'},()=>debounceReload('avaria'));
  if(canConference()) realtimeChannel.on('postgres_changes',{event:'INSERT',schema:'public',table:'container_conferences'},()=>debounceReload('conf'));
  realtimeChannel.subscribe();
}
function teardownRealtime(){if(realtimeChannel&&sb){sb.removeChannel(realtimeChannel).catch(()=>{});realtimeChannel=null;}}
const reloadTimers={}; function debounceReload(type){clearTimeout(reloadTimers[type]);reloadTimers[type]=setTimeout(()=>{if(type==='nri'&&canNri())loadPending(true);if(type==='avaria'&&isAdmin())loadAdminAvarias(true);if(type==='conf'){if(activeView==='conf-minhas')loadMyConferences(true);if(activeView==='conf-dashboard'&&isAdmin())loadDashboard(true);}},220);}

async function loadReferences(useCache=false){
  if(useCache){ const cached=readRefCache(); if(cached){refs=cached;rebuildReferenceMaps();populateReferenceInputs();} }
  if(refRefreshPromise)return refRefreshPromise;
  refRefreshPromise=(async()=>{
    try{
      const [p,u,s,d,f,c]=await Promise.all([
        sb.from('products').select('code,name').eq('active',true).order('code'),
        sb.from('units').select('name').eq('active',true).order('name'),
        sb.from('shifts').select('name').eq('active',true).order('name'),
        sb.from('drivers').select('name').eq('active',true).order('name'),
        sb.from('factories').select('name').eq('active',true).order('name'),
        sb.from('customers').select('code,name,city,branch').order('code')
      ]);
      const errors=[p,u,s,d,f,c].map(x=>x.error).filter(Boolean); if(errors.length)throw errors[0];
      refs={products:p.data||[],units:u.data||[],shifts:s.data||[],drivers:d.data||[],factories:f.data||[],customers:c.data||[]};
      localStorage.setItem('ops_ref_cache',JSON.stringify({at:Date.now(),data:refs})); rebuildReferenceMaps();populateReferenceInputs();
    }catch(e){ if(!refs.products.length)toast(humanError(e),'error'); }
    finally{refRefreshPromise=null;}
  })();
  return refRefreshPromise;
}
function readRefCache(){try{const x=JSON.parse(localStorage.getItem('ops_ref_cache')||'null');return x&&Date.now()-x.at<12*3600e3?x.data:null;}catch{return null;}}
function rebuildReferenceMaps(){productsByCode=new Map(refs.products.map(x=>[String(x.code),x]));customersByCode=new Map(refs.customers.map(x=>[normalizeCode(x.code),x]));}
function populateReferenceInputs(){
  fillSelect('nriUnidade',refs.units.map(x=>x.name),'Selecione'); fillSelect('nriTurno',refs.shifts.map(x=>x.name),'Selecione'); fillSelect('nriMotorista',refs.drivers.map(x=>x.name),'Selecione'); fillSelect('nriFabrica',refs.factories.map(x=>x.name),'Selecione');
  fillSelect('pendUnidade',refs.units.map(x=>x.name),'Todas'); fillSelect('histNriUnidade',refs.units.map(x=>x.name),'Todas');
  $('listaProdutos').innerHTML=refs.products.map(p=>`<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');
}
function fillSelect(id,values,placeholder){const el=$(id);const old=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}

// NRI ------------------------------------------------------------------------
function fillDefaultDates(){
  const now=new Date(); const iso=localIsoDate(now); const time=localTime(now);
  if(!$('nriRecebimento').value)$('nriRecebimento').value=iso; if(!$('nriHora').value)$('nriHora').value=time; $('nriConferente').value=profile?.name||'';
  if(!$('avData').value)$('avData').value=iso; $('avEntregador').value=profile?.name||''; $('dashData').value=$('dashData').value||iso;
  $('confConferente').textContent=profile?.name||'—'; updateConfClock();
}
setInterval(updateConfClock,1000); function updateConfClock(){if(!$('confAgora'))return;$('confAgora').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'medium'}).format(new Date());}
function onProductCode(){ const code=$('nriCodigo').value.trim(); const p=productsByCode.get(code); if(!p){$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');return;} $('produtoPlaceholder').classList.add('hidden');$('produtoInfo').classList.remove('hidden');$('produtoCodigo').textContent=`Código ${p.code}`;$('produtoNome').textContent=p.name; const img=$('produtoImagem');img.classList.remove('hidden');setProductImage(img,p.code); }
function setProductImage(img,code){const ex=['png','jpg','jpeg','webp'];let i=0;const next=()=>{if(i>=ex.length){img.classList.add('hidden');return;}img.onerror=()=>{i++;next();};img.src=`${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(code)}.${ex[i]}`;};next();}
function updateBlockDate(){const iso=parseShortDate($('nriValidade').value);$('nriBloqueio').value=iso?formatShortDate(addDaysIso(iso,-30)):'';}
function addNriDraftItem(){
  const code=$('nriCodigo').value.trim();const p=productsByCode.get(code);const validity=parseShortDate($('nriValidade').value);const lot=$('nriLote').value.trim().toUpperCase();const qty=num($('nriQuantidade').value);const pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Informe um código de produto válido.','error'); if(!validity)return toast('Informe a validade completa no formato dd/mm/aa.','error'); if(!lot)return toast('Informe o lote.','error'); if(qty<=0)return toast('Informe a quantidade.','error'); if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  const item={id:nriEditingId||uuid(),product_code:p.code,product_name:p.name,validity_date:validity,lot,quantity:qty,pallets,block_date:addDaysIso(validity,-30)};
  const idx=nriDraftItems.findIndex(x=>x.id===item.id); if(idx>=0)nriDraftItems[idx]=item;else nriDraftItems.push(item); renderNriDraftItems();clearNriItemEditor();
}
function renderNriDraftItems(){
  const total=nriDraftItems.reduce((s,x)=>s+x.pallets,0);$('nriItemCounter').textContent=`${nriDraftItems.length} item(ns) • ${total} NRI(s)`;$('btnCadastrarCarreta').textContent=total?`Cadastrar carreta (${total} NRIs)`:'Cadastrar carreta';
  const el=$('nriItemList'); if(!nriDraftItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;} el.className='item-list';el.innerHTML=nriDraftItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product_code)} • ${esc(x.product_name)}</strong></div><div class="info"><small>Validade</small><strong>${formatShortDate(x.validity_date)}</strong></div><div class="info"><small>Lote</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)}</strong></div><div class="info"><small>Paletes / NRIs</small><strong>${x.pallets}</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
}
function onNriDraftListClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const row=b.closest('[data-id]');const item=nriDraftItems.find(x=>x.id===row.dataset.id);if(!item)return;if(b.dataset.act==='del'){nriDraftItems=nriDraftItems.filter(x=>x.id!==item.id);renderNriDraftItems();if(nriEditingId===item.id)clearNriItemEditor();return;}nriEditingId=item.id;$('nriCodigo').value=item.product_code;$('nriValidade').value=formatShortDate(item.validity_date);$('nriLote').value=item.lot;$('nriQuantidade').value=item.quantity;$('nriPaletes').value=item.pallets;$('nriBloqueio').value=formatShortDate(item.block_date);onProductCode();$('btnAdicionarNriItem').textContent='Salvar alteração';$('btnCancelarNriItem').classList.remove('hidden');}
function clearNriItemEditor(){nriEditingId=null;['nriCodigo','nriValidade','nriLote','nriBloqueio'].forEach(id=>$(id).value='');$('nriQuantidade').value=1;$('nriPaletes').value=1;$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');$('btnAdicionarNriItem').textContent='+ Adicionar à carreta';$('btnCancelarNriItem').classList.add('hidden');}
function clearNriRequest(){nriDraftItems=[];renderNriDraftItems();clearNriItemEditor();['nriUnidade','nriTurno','nriMotorista','nriFabrica','nriPlaca'].forEach(id=>$(id).value='');$('nriRecebimento').value=localIsoDate(new Date());$('nriHora').value=localTime(new Date());$('nriConferente').value=profile?.name||'';}
async function submitNriRequest(e){
  e.preventDefault();if(!nriDraftItems.length)return toast('Adicione ao menos um produto à carreta.','error');
  const common={unit:$('nriUnidade').value,receipt_date:$('nriRecebimento').value,shift:$('nriTurno').value,receipt_time:$('nriHora').value,driver:$('nriMotorista').value,plate:$('nriPlaca').value.trim(),factory:$('nriFabrica').value};
  if(Object.values(common).some(v=>!String(v).trim()))return toast('Preencha todos os dados da carreta.','error');
  const btn=$('btnCadastrarCarreta');btn.disabled=true;btn.textContent='Cadastrando…';
  try{const {data,error}=await sb.rpc('create_nri_request',{p_payload:{...common,items:nriDraftItems}});if(error)throw error;const count=data?.nris?.length||nriDraftItems.reduce((s,x)=>s+x.pallets,0);toast(`${count} NRIs cadastradas e enviadas para Impressões pendentes.`,'success');clearNriRequest();await loadPending(true);}
  catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;renderNriDraftItems();}
}
async function loadPending(silent=false){if(!canNri())return;try{const {data,error}=await sb.from('nris').select('*').eq('status','PENDENTE').order('created_at',{ascending:false}).limit(1500);if(error)throw error;pendingNris=(data||[]).map(mapNri);selectedNris=new Set([...selectedNris].filter(id=>pendingNris.some(x=>x.id===id)));renderPending();$('badgePendentes').textContent=pendingNris.length;}catch(e){if(!silent)toast(humanError(e),'error');}}
function mapNri(r){return {...r,codigoProduto:r.product_code,nomeProduto:r.product_name,unidade:r.unit,validade:r.validity_date,lote:r.lot,recebimento:r.receipt_date,bloqueio:r.block_date,conferente:r.checker_name,turno:r.shift,hora:fmtTime(r.receipt_time),motorista:r.driver,placa:r.plate,fabrica:r.factory,quantidade:r.quantity};}
function filteredPending(){const q=norm($('pendFiltro').value),u=$('pendUnidade').value;return pendingNris.filter(x=>(!u||x.unidade===u)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa].join(' ')).includes(q)));}
function renderPending(){const arr=filteredPending();$('tbodyPendentes').innerHTML=arr.length?arr.map(x=>`<tr><td><input type="checkbox" data-check="${x.id}" ${selectedNris.has(x.id)?'checked':''}></td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${fmtDate(x.validade)}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${fmtNum(x.quantidade)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Visualizar</button><button class="mini-btn" data-act="print" data-id="${x.id}">Imprimir</button><button class="mini-btn danger" data-act="remove" data-id="${x.id}">Remover</button></div></td></tr>`).join(''):`<tr><td colspan="6">Nenhuma NRI pendente.</td></tr>`;}
function onPendingCheck(e){if(!e.target.matches('input[data-check]'))return;e.target.checked?selectedNris.add(e.target.dataset.check):selectedNris.delete(e.target.dataset.check);}
function onPendingClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=pendingNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);if(b.dataset.act==='print')startPrint([r]);if(b.dataset.act==='remove')removeNri(r);}
function toggleVisiblePendingSelection(){const arr=filteredPending();const all=arr.length&&arr.every(x=>selectedNris.has(x.id));arr.forEach(x=>all?selectedNris.delete(x.id):selectedNris.add(x.id));renderPending();}
async function removeNri(r){if(!confirm(`Remover ${r.nri} da fila?`))return;try{const {error}=await sb.rpc('remove_nris',{p_ids:[r.id]});if(error)throw error;toast('NRI removida da fila.','success');await loadPending(true);}catch(e){toast(humanError(e),'error');}}
function showNriPreview(r){openModal(`NRI ${r.nri}`,`${r.codigoProduto} • ${r.nomeProduto}`,htmlEtiqueta(r,false),[{label:'Imprimir',class:'primary',onClick:()=>{closeModal();startPrint([r],r.status==='IMPRESSO');}}]);setTimeout(()=>{const img=$('modalBody').querySelector('img[data-product]');if(img)setProductImage(img,r.codigoProduto);},10);}
async function startPrint(records,reprint=false){if(!records?.length)return toast('Selecione ao menos uma NRI.','error');printOperation={records,reprint};const frame=$('printFrame');const doc=frame.contentWindow.document;doc.open();doc.write(printDocument(records));doc.close();await wait(90);frame.contentWindow.focus();frame.contentWindow.print();openModal('Confirmar impressão','O diálogo da impressora foi aberto.','<p>Confirme somente depois de verificar se a impressão realmente foi concluída.</p>',[{label:'Cancelar / não imprimiu',class:'secondary',onClick:()=>finishPrint('CANCELADO')},{label:'Impressão concluída',class:'primary',onClick:()=>finishPrint('IMPRESSO')}]);}
async function finishPrint(result){if(!printOperation)return;const op=printOperation;printOperation=null;closeModal();if(result==='IMPRESSO'&&!op.reprint){const ids=new Set(op.records.map(x=>x.id));pendingNris=pendingNris.filter(x=>!ids.has(x.id));renderPending();$('badgePendentes').textContent=pendingNris.length;}try{const {error}=await sb.rpc('confirm_nri_print',{p_ids:op.records.map(x=>x.id),p_reprint:!!op.reprint,p_result:result});if(error)throw error;toast(result==='IMPRESSO'?'Impressão confirmada.':'Cancelamento registrado.',result==='IMPRESSO'?'success':'');}catch(e){toast(humanError(e),'error');loadPending(true);}}
function htmlEtiqueta(r,print){const img=print?`<img alt="" onerror="imgFallback(this,'${jsEsc(r.codigoProduto)}',1)" src="${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(r.codigoProduto)}.png">`:`<img alt="" data-product="1">`;return `<div class="nri-preview-label"><div class="nri-top"><div class="nri-code-label">CÓDIGO:</div><div class="nri-code-value">${esc(r.codigoProduto)}</div><div class="nri-id">${esc(r.nri)}</div></div><div class="nri-product-title">${img}<strong>${esc(r.nomeProduto)}</strong></div><div class="nri-mini-strip"><div class="nri-mini-cell"><b>UNIDADE:</b>${esc(r.unidade)}</div></div><div class="nri-validade"><span>VALIDADE:</span><strong>${fmtDate(r.validade)}</strong></div><div class="nri-dates"><div class="nri-date-cell"><b>RECEB:</b><strong>${fmtDate(r.recebimento)}</strong></div><div class="nri-date-cell"><b>BLOQUEIO:</b><strong>${fmtDate(r.bloqueio)}</strong></div></div><div class="nri-meta"><div class="nri-meta-cell"><b>Conferente</b><span>${esc(r.conferente)}</span></div><div class="nri-meta-cell"><b>Turno</b><span>${esc(r.turno)}</span></div><div class="nri-meta-cell"><b>Hora</b><span>${esc(r.hora)}</span></div><div class="nri-meta-cell"><b>Motorista</b><span>${esc(r.motorista)}</span></div><div class="nri-meta-cell"><b>Placa</b><span>${esc(r.placa)}</span></div></div><div class="nri-bottom"><div><b>Fábrica:</b>${esc(r.fabrica)}</div><div><b>Quantidade:</b>${esc(r.quantidade)}</div><div><b>NRI:</b>${esc(r.nri)}</div></div></div>`;}
function printDocument(records){const pages=records.map(r=>`<section class="page">${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}</section>`).join('');return `<!doctype html><html><head><base href="${document.baseURI}"><meta charset="utf-8"><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#686868}.page{height:287mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always}.page:last-child{page-break-after:auto}.nri-preview-label{height:89mm;width:100%;border:1.2px solid #777;background:#fff;color:#686868;overflow:hidden}.nri-top{display:grid;grid-template-columns:auto 1fr auto;align-items:stretch;height:12mm;border-bottom:2px solid #777}.nri-code-label{display:flex;align-items:center;padding:0 2.2mm;font-size:18pt;font-weight:1000;border-right:2px solid #777}.nri-code-value{display:flex;align-items:center;padding:0 3mm;font-size:31pt;line-height:.82;font-weight:1000;color:#4b4f54}.nri-id{display:flex;align-items:center;padding:0 2mm;font-size:10pt;font-weight:900}.nri-product-title{height:18mm;border-bottom:1px solid #777;display:flex;align-items:center;justify-content:center;gap:3mm;padding:1mm 3mm;text-align:center}.nri-product-title img{width:14mm;height:14mm;object-fit:contain}.nri-product-title strong{font-size:24pt;line-height:.96;font-weight:1000}.nri-mini-strip{height:4.5mm;border-bottom:1px solid #777}.nri-mini-cell{display:flex;align-items:center;padding:.2mm 1.8mm;font-size:9pt;font-weight:700}.nri-mini-cell b{font-size:8.5pt;font-weight:1000;margin-right:1.3mm}.nri-validade{display:grid;grid-template-columns:31% 69%;height:28mm;border-bottom:1px solid #777;align-items:center}.nri-validade span{height:100%;display:flex;align-items:center;padding:1.5mm 2.5mm;border-right:1px solid #777;font-size:25pt;font-weight:1000}.nri-validade strong{font-size:58pt;line-height:.84;text-align:center;font-weight:1000;color:#4b4f54}.nri-dates{display:grid;grid-template-columns:1fr 1fr;height:10mm;border-bottom:1px solid #777}.nri-date-cell{display:grid;grid-template-columns:auto 1fr;align-items:center}.nri-date-cell+.nri-date-cell{border-left:1px solid #777}.nri-date-cell b{padding:1mm 1.8mm;font-size:10.5pt}.nri-date-cell strong{text-align:center;padding:1mm 1.4mm;border-left:1px solid #777;font-size:13.5pt}.nri-meta{display:grid;grid-template-columns:1.55fr .85fr .8fr 1.15fr 1fr;height:7mm;border-bottom:1px solid #777}.nri-meta-cell{text-align:center;border-right:1px solid #777;overflow:hidden}.nri-meta-cell:last-child{border-right:0}.nri-meta-cell b{display:block;padding:.08mm .6mm 0;font-size:7.8pt;text-decoration:underline}.nri-meta-cell span{display:block;padding:.05mm .6mm 0;font-size:9.6pt;font-weight:700;white-space:nowrap}.nri-bottom{display:grid;grid-template-columns:1.8fr .75fr 1.1fr;height:5.5mm}.nri-bottom>div{display:flex;align-items:center;padding:.2mm 1.6mm;font-size:9.5pt;font-weight:700;border-right:1px solid #777}.nri-bottom>div:last-child{border-right:0}</style></head><body>${pages}<script>function imgFallback(img,code,i){var ex=['png','jpg','jpeg','webp'];i=i||0;if(i>=ex.length){img.style.display='none';return;}img.onerror=function(){imgFallback(img,code,i+1)};img.src='${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/'+encodeURIComponent(code)+'.'+ex[i];}<\/script></body></html>`;}
async function loadNriHistory(){if(!isAdmin())return;try{let q=sb.from('nris').select('*').order('created_at',{ascending:false}).limit(2000);const {data,error}=await q;if(error)throw error;historyNris=(data||[]).map(mapNri);renderNriHistory();}catch(e){toast(humanError(e),'error');}}
function filteredNriHistory(){const q=norm($('histNriBusca').value),status=$('histNriStatus').value,u=$('histNriUnidade').value,de=$('histNriDe').value,ate=$('histNriAte').value;return historyNris.filter(x=>(!status||x.status===status)&&(!u||x.unidade===u)&&(!de||String(x.created_at).slice(0,10)>=de)&&(!ate||String(x.created_at).slice(0,10)<=ate)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa,x.conferente,x.created_by_username,x.created_by_name].join(' ')).includes(q)));}
function renderNriHistory(){const arr=filteredNriHistory();$('tbodyHistNri').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDateTime(x.created_at)}</td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${fmtDate(x.validade)}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${esc(x.created_by_name||x.created_by_username||'—')}<small>${esc(x.conferente)}</small></td><td>${statusBadge(x.status)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Ver</button><button class="mini-btn" data-act="reprint" data-id="${x.id}">Reimprimir</button></div></td></tr>`).join(''):'<tr><td colspan="7">Nenhum registro.</td></tr>';}
function onNriHistoryClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=historyNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);else startPrint([r],true);}

// AVARIAS --------------------------------------------------------------------
function onPdvInput(){const c=customersByCode.get(normalizeCode($('avPdv').value));$('avClienteNome').textContent=c?.name||'Cliente não localizado';$('avCidade').textContent=c?.city||'—';}
async function onAvariaPhoto(e){const file=e.target.files?.[0];if(!file)return;try{avPhotoBlob=await compressImage(file,1280,.76);if(avPhotoPreviewUrl)URL.revokeObjectURL(avPhotoPreviewUrl);avPhotoPreviewUrl=URL.createObjectURL(avPhotoBlob);$('avFotoPreview').src=avPhotoPreviewUrl;$('avFotoPreview').classList.remove('hidden');$('avGpsStatus').className='gps-status';$('avGpsStatus').textContent='Obtendo localização…';avGps=await captureGps();$('avGpsStatus').className='gps-status ok';$('avGpsStatus').textContent=`GPS capturado: ${avGps.latitude.toFixed(6)}, ${avGps.longitude.toFixed(6)} • ±${Math.round(avGps.accuracy||0)} m`;}catch(err){avGps=null;$('avGpsStatus').className='gps-status error';$('avGpsStatus').textContent=`GPS não capturado: ${humanGpsError(err)}`;}}
function addAvariaItem(){const product=$('avProduto').value.trim(),lot=$('avLote').value.trim().toUpperCase(),quantity=num($('avQuantidade').value),unit=$('avUnidade').value,reason=$('avMotivo').value;if(!product||!lot||quantity<=0||!unit||!reason)return toast('Preencha produto, lote, quantidade, unidade e motivo.','error');if(!avPhotoBlob)return toast('A foto é obrigatória.','error');if(!avGps)return toast('A localização GPS da foto é obrigatória.','error');const id=avariaEditingId||uuid();const old=avariaItems.find(x=>x.id===id);const item={id,product,lot,quantity,unit,reason,photoBlob:avPhotoBlob,previewUrl:avPhotoPreviewUrl,gps:avGps};const idx=avariaItems.findIndex(x=>x.id===id);if(idx>=0){if(old?.previewUrl&&old.previewUrl!==item.previewUrl)URL.revokeObjectURL(old.previewUrl);avariaItems[idx]=item;}else avariaItems.push(item);renderAvariaItems();clearAvariaItemEditor(false);}
function renderAvariaItems(){$('avItemCounter').textContent=`${avariaItems.length} produto(s)`;const el=$('avItemList');if(!avariaItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;}el.className='item-list';el.innerHTML=avariaItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product)}</strong></div><div class="info"><small>Lote</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)} ${esc(x.unit)}</strong></div><div class="info"><small>Motivo</small><strong>${esc(x.reason)}</strong></div><div class="info"><small>GPS</small><strong>${x.gps.latitude.toFixed(5)}, ${x.gps.longitude.toFixed(5)}</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');}
function onAvariaItemListClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const item=avariaItems.find(x=>x.id===b.closest('[data-id]').dataset.id);if(!item)return;if(b.dataset.act==='del'){if(item.previewUrl)URL.revokeObjectURL(item.previewUrl);avariaItems=avariaItems.filter(x=>x.id!==item.id);renderAvariaItems();return;}avariaEditingId=item.id;$('avProduto').value=item.product;$('avLote').value=item.lot;$('avQuantidade').value=item.quantity;$('avUnidade').value=item.unit;$('avMotivo').value=item.reason;avPhotoBlob=item.photoBlob;avPhotoPreviewUrl=item.previewUrl;avGps=item.gps;$('avFotoPreview').src=item.previewUrl;$('avFotoPreview').classList.remove('hidden');$('avGpsStatus').className='gps-status ok';$('avGpsStatus').textContent=`GPS capturado: ${item.gps.latitude.toFixed(6)}, ${item.gps.longitude.toFixed(6)}`;$('btnAdicionarAvItem').textContent='Salvar alteração';$('btnCancelarAvItem').classList.remove('hidden');}
function clearAvariaItemEditor(revoke=true){avariaEditingId=null;if(revoke&&avPhotoPreviewUrl&&!avariaItems.some(x=>x.previewUrl===avPhotoPreviewUrl))URL.revokeObjectURL(avPhotoPreviewUrl);avPhotoBlob=null;avPhotoPreviewUrl='';avGps=null;['avProduto','avLote','avQuantidade','avMotivo'].forEach(id=>$(id).value='');$('avUnidade').value='UNIDADE';$('avFotoCamera').value='';$('avFotoArquivo').value='';$('avFotoPreview').classList.add('hidden');$('avGpsStatus').className='gps-status';$('avGpsStatus').textContent='GPS ainda não capturado.';$('btnAdicionarAvItem').textContent='+ Adicionar produto';$('btnCancelarAvItem').classList.add('hidden');}
function clearAvariaRequest(){avariaItems.forEach(x=>{if(x.previewUrl)URL.revokeObjectURL(x.previewUrl);});avariaItems=[];renderAvariaItems();clearAvariaItemEditor();$('avData').value=localIsoDate(new Date());$('avEntregador').value=profile?.name||'';['avPdv','avMapa'].forEach(id=>$(id).value='');$('avClienteNome').textContent='Digite um PDV';$('avCidade').textContent='—';clearSignature();}
async function submitAvaria(e){e.preventDefault();const customer=customersByCode.get(normalizeCode($('avPdv').value));if(!customer)return toast('Informe um PDV válido.','error');if(!$('avMapa').value.trim())return toast('Informe o mapa.','error');if(!avariaItems.length)return toast('Adicione ao menos um produto avariado.','error');if(!signatureDirty)return toast('A assinatura do cliente é obrigatória.','error');const btn=$('btnSalvarAvaria');btn.disabled=true;btn.textContent='Enviando…';try{const reqKey=uuid();const sigBlob=await canvasBlob($('signatureCanvas'),.82);const signaturePath=`${authUser.id}/${reqKey}/assinatura.jpg`;await uploadStorage(signaturePath,sigBlob);const uploaded=await Promise.all(avariaItems.map(async(x,i)=>{const path=`${authUser.id}/${reqKey}/foto_${String(i+1).padStart(2,'0')}.jpg`;await uploadStorage(path,x.photoBlob);return {...x,photo_path:path};}));const payload={date:$('avData').value,customer_code:customer.code,customer_name:customer.name,city:customer.city,map_number:$('avMapa').value.trim(),signature_path:signaturePath,items:uploaded.map(x=>({product:x.product,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photo_path:x.photo_path,latitude:x.gps.latitude,longitude:x.gps.longitude,accuracy:x.gps.accuracy||'',gps_at:x.gps.capturedAt}))};const {error}=await sb.rpc('create_damage_request',{p_payload:payload});if(error)throw error;toast('Avaria registrada com sucesso.','success');clearAvariaRequest();}catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar requisição';}}
async function uploadStorage(path,blob){const {error}=await sb.storage.from('avarias').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
let adminAvarias=[];let lotNriMap=new Map();
async function loadAdminAvarias(silent=false){if(!isAdmin())return;try{const {data,error}=await sb.from('damage_requests').select('*,damage_items(*)').order('created_at',{ascending:false}).limit(1000);if(error)throw error;adminAvarias=data||[];const lots=[...new Set(adminAvarias.flatMap(r=>r.damage_items||[]).map(i=>String(i.lot||'').toUpperCase()).filter(Boolean))];lotNriMap=new Map();if(lots.length){for(const chunk of chunks(lots,100)){const q=await sb.from('nris').select('nri,lot,product_code,product_name,validity_date,unit').in('lot',chunk);if(q.error)throw q.error;(q.data||[]).forEach(n=>{const k=String(n.lot).toUpperCase();if(!lotNriMap.has(k))lotNriMap.set(k,[]);lotNriMap.get(k).push(n);});}}renderAdminAvarias();$('badgeAvarias').textContent=adminAvarias.filter(r=>['PENDENTE','PARCIAL'].includes(r.status)).length;}catch(e){if(!silent)toast(humanError(e),'error');}}
function filteredAdminAvarias(){const q=norm($('avAdminBusca').value),s=$('avAdminStatus').value;return adminAvarias.filter(r=>(!s||r.status===s)&&(!q||norm([r.customer_code,r.customer_name,r.delivery_name,r.map_number,...(r.damage_items||[]).flatMap(i=>[i.product_text,i.lot])].join(' ')).includes(q)));}
function renderAdminAvarias(){const arr=filteredAdminAvarias();$('tbodyAvariasAdmin').innerHTML=arr.length?arr.map(r=>{const items=r.damage_items||[];const matches=items.filter(i=>lotNriMap.has(String(i.lot).toUpperCase())).length;return `<tr><td>${fmtDate(r.occurrence_date)}<strong>${esc(r.customer_code)} • ${esc(r.customer_name)}</strong><small>${esc(r.city)} • Mapa ${esc(r.map_number)}</small></td><td>${esc(r.delivery_name)}</td><td>${items.length} produto(s)</td><td>${matches===items.length&&items.length?'<span class="status ok">Todos compatíveis</span>':matches?'<span class="status partial">Parcial</span>':'<span class="status bad">Não encontrados</span>'}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-id="${r.id}">Visualizar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhuma avaria.</td></tr>';}
function onAdminAvariaClick(e){const b=e.target.closest('button[data-id]');if(!b)return;showAvariaDetail(b.dataset.id);}
async function showAvariaDetail(id){const r=adminAvarias.find(x=>x.id===id);if(!r)return;currentAvariaDetail=r;const items=r.damage_items||[];const signed=await Promise.all([r.signature_path,...items.map(i=>i.photo_path)].map(async path=>{const {data}=await sb.storage.from('avarias').createSignedUrl(path,3600);return data?.signedUrl||'';}));const signatureUrl=signed[0];const body=`<div class="detail-grid"><div class="detail-card"><small>PDV</small><strong>${esc(r.customer_code)} • ${esc(r.customer_name)}</strong></div><div class="detail-card"><small>Cidade</small><strong>${esc(r.city)}</strong></div><div class="detail-card"><small>Mapa</small><strong>${esc(r.map_number)}</strong></div><div class="detail-card"><small>Entregador</small><strong>${esc(r.delivery_name)}</strong></div></div>${items.map((i,idx)=>{const match=lotNriMap.get(String(i.lot).toUpperCase())||[];return `<div class="damage-admin-item" data-item="${i.id}"><label><input type="checkbox" class="review-check" value="${i.id}" ${i.status==='PENDENTE'?'':'disabled'}> <strong>Produto ${idx+1}: ${esc(i.product_text)}</strong></label><div class="detail-grid"><div class="detail-card"><small>Lote</small><strong>${esc(i.lot)}</strong></div><div class="detail-card"><small>Quantidade</small><strong>${fmtNum(i.quantity)} ${esc(i.quantity_unit)}</strong></div><div class="detail-card"><small>Motivo</small><strong>${esc(i.reason)}</strong></div><div class="detail-card"><small>Status</small><strong>${esc(i.status)}</strong></div></div><div class="damage-admin-grid"><div><img src="${esc(signed[idx+1])}" alt="Foto da avaria"></div><div><iframe class="map-frame" src="https://www.google.com/maps?q=${encodeURIComponent(i.latitude+','+i.longitude)}&output=embed" loading="lazy"></iframe><small>GPS: ${i.latitude}, ${i.longitude} • ±${Math.round(i.gps_accuracy||0)}m</small></div></div><p>${match.length?`<span class="status ok">Lote compatível</span> ${match.slice(0,4).map(n=>esc(n.nri)).join(', ')}`:'<span class="status bad">Lote não encontrado</span>'}</p></div>`;}).join('')}<div class="section-title">Assinatura</div><img src="${esc(signatureUrl)}" alt="Assinatura" style="max-width:100%;max-height:220px;border:1px solid #dce5ed;border-radius:10px">`;openModal(`Avaria • PDV ${r.customer_code}`,`${fmtDate(r.occurrence_date)} • ${r.delivery_name}`,body,[{label:'Reprovar selecionados',class:'danger',onClick:()=>reviewAvaria('REPROVADO',false)},{label:'Aprovar selecionados',class:'success',onClick:()=>reviewAvaria('APROVADO',false)},{label:'Aprovar todos pendentes',class:'primary',onClick:()=>reviewAvaria('APROVADO',true)}]);}
async function reviewAvaria(status,all){if(!currentAvariaDetail)return;let ids;if(all)ids=(currentAvariaDetail.damage_items||[]).filter(i=>i.status==='PENDENTE').map(i=>i.id);else ids=[...$('modalBody').querySelectorAll('.review-check:checked')].map(x=>x.value);if(!ids.length)return toast('Selecione ao menos um produto pendente.','error');let note='';if(status==='REPROVADO'){const x=prompt('Observação da reprovação (opcional):','');if(x===null)return;note=x;}try{const {error}=await sb.rpc('review_damage_items',{p_item_ids:ids,p_status:status,p_note:note});if(error)throw error;toast(`${ids.length} produto(s) atualizado(s).`,'success');closeModal();await loadAdminAvarias(true);}catch(e){toast(humanError(e),'error');}}

// CONFERENCIA ----------------------------------------------------------------
function clearConferenceForm(){$('confMapa').value='';['confG300','confG600V','confG600M','confLitrao','confB30','confB50'].forEach(id=>$(id).value=0);}
async function submitConference(e){e.preventDefault();const map=normalizeCode($('confMapa').value);if(!map)return toast('Informe o mapa.','error');const p={p_map_number:map,p_g300:intVal('confG300'),p_g600_green:intVal('confG600V'),p_g600_brown:intVal('confG600M'),p_g_litrao:intVal('confLitrao'),p_keg30:intVal('confB30'),p_keg50:intVal('confB50')};const btn=e.submitter;btn.disabled=true;btn.textContent='Registrando…';try{const {error}=await sb.rpc('create_container_conference',p);if(error)throw error;toast('Conferência registrada.','success');clearConferenceForm();}catch(err){const m=String(err.message||'');toast(m.includes('duplicate key')?'Este mapa já possui conferência na data de hoje.':humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar conferência';}}
let myConferences=[];async function loadMyConferences(silent=false){try{const {data,error}=await sb.from('container_conferences').select('*').eq('checker_id',authUser.id).order('created_at',{ascending:false}).limit(1000);if(error)throw error;myConferences=data||[];renderMyConferences();}catch(e){if(!silent)toast(humanError(e),'error');}}
function renderMyConferences(){const m=normalizeCode($('minhasMapa').value),d=$('minhasData').value;const arr=myConferences.filter(x=>(!m||x.map_number.includes(m))&&(!d||x.conference_date===d));$('tbodyMinhas').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)} ${fmtTime(x.conference_time)}</td><td>${esc(x.map_number)}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="8">Nenhuma conferência.</td></tr>';}
async function loadConferenceHistory(){if(!isAdmin())return;try{const [c,m]=await Promise.all([sb.from('container_conferences').select('*').order('created_at',{ascending:false}).limit(3000),sb.from('maps').select('*').order('map_date',{ascending:false}).limit(5000)]);if(c.error)throw c.error;if(m.error)throw m.error;allConferences=c.data||[];allMaps=m.data||[];renderConferenceHistory();}catch(e){toast(humanError(e),'error');}}
function enrichedConferenceRows(){const mapIndex=new Map(allMaps.map(m=>[mapKey(m.map_number,m.map_date),m]));return allConferences.map(c=>({...c,map:mapIndex.get(mapKey(c.map_number,c.conference_date))||null}));}
function filteredConferenceHistory(){const map=normalizeCode($('histConfMapa').value),name=norm($('histConfConferente').value),de=$('histConfDe').value,ate=$('histConfAte').value;return enrichedConferenceRows().filter(x=>(!map||x.map_number.includes(map))&&(!name||norm(x.checker_name).includes(name))&&(!de||x.conference_date>=de)&&(!ate||x.conference_date<=ate));}
function renderConferenceHistory(){const arr=filteredConferenceHistory();$('tbodyHistConf').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)}</td><td>${fmtTime(x.conference_time)}</td><td>${esc(x.checker_name)}</td><td>${esc(x.map_number)}</td><td>${esc(x.map?.city||'—')}</td><td>${esc(x.map?.driver||'—')}</td><td>${esc(x.map?.helper1||'—')}</td><td>${esc(x.map?.helper2||'—')}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="14">Nenhum registro.</td></tr>';}
function exportConferenceCsv(){const arr=filteredConferenceHistory();const headers=['Data','Hora','Conferente','Mapa','Cidade','Motorista','Ajudante 1','Ajudante 2','Garrafeiras de 300ml','Garrafeiras de 600ml Verde','Garrafeiras de 600ml Marrom','Garrafeiras de Litrão','Barris de Chopp 30L','Barris de Chopp 50L'];const rows=arr.map(x=>[fmtDate(x.conference_date),fmtTime(x.conference_time),x.checker_name,x.map_number,x.map?.city||'',x.map?.driver||'',x.map?.helper1||'',x.map?.helper2||'',x.g300,x.g600_green,x.g600_brown,x.g_litrao,x.keg30,x.keg50]);downloadCsv('historico_conferencias.csv',[headers,...rows]);}

let dashboardRows=[];async function loadDashboard(silent=false){if(!isAdmin())return;try{let mq=sb.from('maps').select('*').order('map_date',{ascending:false}).limit(5000);let cq=sb.from('container_conferences').select('*').order('conference_date',{ascending:false}).limit(5000);const date=$('dashData').value;if(date){mq=mq.eq('map_date',date);cq=cq.eq('conference_date',date);}const [m,c]=await Promise.all([mq,cq]);if(m.error)throw m.error;if(c.error)throw c.error;allMaps=m.data||[];allConferences=c.data||[];buildDashboardRows();renderDashboard();}catch(e){if(!silent)toast(humanError(e),'error');}}
function buildDashboardRows(){const confIndex=new Map(allConferences.map(c=>[mapKey(c.map_number,c.conference_date),c]));const mapKeys=new Set(allMaps.map(m=>mapKey(m.map_number,m.map_date)));dashboardRows=allMaps.map(m=>compareMap(m,confIndex.get(mapKey(m.map_number,m.map_date))||null));for(const c of allConferences){const k=mapKey(c.map_number,c.conference_date);if(!mapKeys.has(k))dashboardRows.push(compareMap(null,c));}}
function compareMap(m,c){const diffs={};let pos=0,neg=0,divCount=0;for(const t of VALUE_TYPES){const plan=m?num(m[t.key]):0,actual=c?num(c[t.key]):0,diff=actual-plan,value=Math.abs(diff)*t.value;diffs[t.key]={...t,plan,actual,diff,value};if(diff>0)pos+=value;if(diff<0)neg+=value;if(diff!==0)divCount++;}return {key:mapKey(m?.map_number||c?.map_number,m?.map_date||c?.conference_date),map_number:m?.map_number||c?.map_number,map_date:m?.map_date||c?.conference_date,city:m?.city||'',driver:m?.driver||'',helper1:m?.helper1||'',helper2:m?.helper2||'',conference:c,diffs,pos,neg,divCount,status:!m?'FORA_BASE':!c?'SEM_CONFERENCIA':divCount?'DIVERGENTE':'OK'};}
function filteredDashboard(){const map=normalizeCode($('dashMapa').value),city=norm($('dashCidade').value);return dashboardRows.filter(x=>(!map||x.map_number.includes(map))&&(!city||norm(x.city).includes(city)));}
function renderDashboard(){const arr=filteredDashboard();const planned=arr.filter(x=>x.status!=='FORA_BASE').length,conf=arr.filter(x=>x.conference).length,pend=arr.filter(x=>x.status==='SEM_CONFERENCIA').length,div=arr.filter(x=>x.status==='DIVERGENTE').length,pos=arr.reduce((s,x)=>s+x.pos,0),neg=arr.reduce((s,x)=>s+x.neg,0);$('kpiPlanejados').textContent=planned;$('kpiConferidos').textContent=conf;$('kpiPendentes').textContent=pend;$('kpiDivergentes').textContent=div;$('kpiPositivo').textContent=money(pos);$('kpiNegativo').textContent=money(neg);$('tbodyDashboard').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.map_date)}<strong>Mapa ${esc(x.map_number)}</strong></td><td>${esc(x.city||'—')}</td><td>${esc(x.driver||'—')}<small>${esc([x.helper1,x.helper2].filter(Boolean).join(' • ')||'—')}</small></td><td>${esc(x.conference?.checker_name||'—')}</td><td>${dashStatus(x.status)}</td><td>${x.divCount}</td><td><button class="mini-btn" data-key="${esc(x.key)}">Detalhar</button></td></tr>`).join(''):'<tr><td colspan="7">Sem dados.</td></tr>';renderRanking(arr);}
function renderRanking(arr){const drivers=new Map(),helpers=new Map();arr.filter(x=>x.status==='DIVERGENTE').forEach(x=>{accRank(drivers,x.driver,x);const unique=new Set([x.helper1,x.helper2].map(s=>String(s||'').trim()).filter(Boolean));unique.forEach(h=>accRank(helpers,h,x));});renderRankTable('rankMotoristas',drivers);renderRankTable('rankAjudantes',helpers);}
function accRank(map,name,row){name=String(name||'').trim();if(!name)return;const x=map.get(name)||{name,maps:new Set(),pos:0,neg:0};x.maps.add(row.key);x.pos+=row.pos;x.neg+=row.neg;map.set(name,x);}
function renderRankTable(id,map){const arr=[...map.values()].sort((a,b)=>(b.neg-a.neg)||(b.maps.size-a.maps.size)||(b.pos-a.pos));$(id).innerHTML=arr.length?arr.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.name)}</strong></td><td>${x.maps.size}</td><td class="value-positive">${money(x.pos)}</td><td class="value-negative">${money(x.neg)}</td></tr>`).join(''):'<tr><td colspan="5">Sem divergências.</td></tr>';}
function onDashboardClick(e){const b=e.target.closest('button[data-key]');if(!b)return;const row=dashboardRows.find(x=>x.key===b.dataset.key);if(row)showDashboardDetail(row);}
function showDashboardDetail(r){const rows=VALUE_TYPES.map(t=>{const d=r.diffs[t.key],cls=d.diff>0?'value-positive':d.diff<0?'value-negative':'value-zero';return `<tr><td><strong>${esc(t.label)}</strong></td><td>${d.plan}</td><td>${d.actual}</td><td class="${cls}">${d.diff>0?'+':''}${d.diff}</td><td class="${cls}">${money(d.value)}</td></tr>`;}).join('');const body=`<div class="detail-grid"><div class="detail-card"><small>Motorista</small><strong>${esc(r.driver||'—')}</strong></div><div class="detail-card"><small>Ajudante 1</small><strong>${esc(r.helper1||'—')}</strong></div><div class="detail-card"><small>Ajudante 2</small><strong>${esc(r.helper2||'—')}</strong></div><div class="detail-card"><small>Conferente</small><strong>${esc(r.conference?.checker_name||'—')}</strong></div></div><table class="detail-table"><thead><tr><th>Vasilhame</th><th>Planilha</th><th>Conferido</th><th>Diferença</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table><div class="detail-grid" style="margin-top:12px"><div class="detail-card"><small>Valor total em divergências positivas</small><strong class="value-positive">${money(r.pos)}</strong></div><div class="detail-card"><small>Valor total em divergências negativas</small><strong class="value-negative">${money(r.neg)}</strong></div></div>`;openModal(`Mapa ${r.map_number}`,`${fmtDate(r.map_date)} • ${r.city||'—'}`,body,[]);}

// USERS ----------------------------------------------------------------------
let users=[];async function loadUsers(){if(!isAdmin())return;try{const {data,error}=await sb.from('profiles').select('*').order('name');if(error)throw error;users=data||[];renderUsers();}catch(e){toast(humanError(e),'error');}}
function renderUsers(){$('tbodyUsuarios').innerHTML=users.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(ROLE_LABELS[u.role]||u.role)}</td><td>${u.active?'<span class="status ok">Ativo</span>':'<span class="status bad">Inativo</span>'}</td><td><button class="mini-btn" data-user="${esc(u.username)}">Editar</button></td></tr>`).join('');}
function onUserTableClick(e){const b=e.target.closest('button[data-user]');if(!b)return;const u=users.find(x=>x.username===b.dataset.user);if(!u)return;$('usuarioOriginal').value=u.username;$('usuarioLogin').value=u.username;$('usuarioNome').value=u.name;$('usuarioPerfil').value=u.role;$('usuarioSenha').value='';$('usuarioAtivo').checked=u.active;}
function clearUserForm(){$('usuarioOriginal').value='';$('usuarioLogin').value='';$('usuarioNome').value='';$('usuarioPerfil').value='COLABORADOR_ARMAZEM';$('usuarioSenha').value='';$('usuarioAtivo').checked=true;}
async function saveUser(e){e.preventDefault();const original=$('usuarioOriginal').value.trim();const body={action:original?'update':'create',originalUsername:original,username:$('usuarioLogin').value,name:$('usuarioNome').value,role:$('usuarioPerfil').value,password:$('usuarioSenha').value,active:$('usuarioAtivo').checked};if(!body.username.trim()||!body.name.trim())return toast('Informe usuário e nome.','error');if(!original&&body.password.length<6)return toast('A senha do novo usuário deve ter pelo menos 6 caracteres.','error');const btn=e.submitter;btn.disabled=true;btn.textContent='Salvando…';try{const {data,error}=await sb.functions.invoke('admin-users',{body});if(error)throw error;if(data?.ok===false)throw new Error(data.error);toast('Usuário salvo.','success');clearUserForm();await loadUsers();}catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Salvar usuário';}}

// IMPORT ---------------------------------------------------------------------
async function importBaseCsv(){if(!isAdmin())return;const file=$('importFile').files?.[0];if(!file)return toast('Selecione um arquivo CSV.','error');const type=$('importTipo').value;const out=$('importResult');out.textContent='Lendo arquivo…';try{const text=await file.text();const rows=parseCsvObjects(text);if(!rows.length)throw new Error('O arquivo não possui registros.');const normalized=normalizeImport(type,rows);out.textContent=`${normalized.length} linhas reconhecidas. Enviando…`;let done=0;for(const chunk of chunks(normalized,300)){let res;if(type==='maps')res=await sb.from('maps').upsert(chunk,{onConflict:'map_number,map_date'});else if(type==='nris')res=await sb.from('nris').upsert(chunk,{onConflict:'nri'});else if(type==='conferences')res=await sb.from('container_conferences').upsert(chunk,{onConflict:'map_number,conference_date'});else res=await sb.from(type).upsert(chunk,{onConflict:importConflict(type)});if(res.error)throw res.error;done+=chunk.length;out.textContent=`Importados ${done}/${normalized.length}…`;}
    if(type==='nris'){const x=await sb.rpc('sync_nri_sequence');if(x.error)throw x.error;}out.textContent=`Concluído: ${done} registros importados.`;toast('Importação concluída.','success');localStorage.removeItem('ops_ref_cache');if(['products','units','shifts','drivers','factories','customers'].includes(type))await loadReferences(false);
  }catch(e){out.textContent=`Erro: ${humanError(e)}`;toast(humanError(e),'error');}}
function importConflict(type){return ({products:'code',units:'name',shifts:'name',drivers:'name',factories:'name',customers:'code'})[type];}
function normalizeImport(type,rows){const h=(r,...aliases)=>{for(const a of aliases){const k=Object.keys(r).find(k=>normHeader(k)===normHeader(a));if(k!==undefined)return r[k];}return '';};if(type==='products')return rows.map(r=>({code:String(h(r,'Código','Codigo','Code')).trim(),name:String(h(r,'Nome','Produto','Descrição','Descricao')).trim()})).filter(x=>x.code&&x.name);if(type==='units')return rows.map(r=>({name:String(h(r,'Unidade','Nome')).trim()})).filter(x=>x.name);if(type==='shifts')return rows.map(r=>({name:String(h(r,'Turno','Nome')).trim()})).filter(x=>x.name);if(type==='drivers')return rows.map(r=>({name:String(h(r,'Motorista','Nome')).trim()})).filter(x=>x.name);if(type==='factories')return rows.map(r=>({name:String(h(r,'Fábrica','Fabrica','Nome')).trim()})).filter(x=>x.name);if(type==='customers')return rows.map(r=>({code:normalizeCode(h(r,'Código PDV','Cód PDV','Codigo PDV','Código','Codigo')),name:String(h(r,'Nome','Nome Fantasia','Cliente','Razão Social','Razao Social')).trim(),city:String(h(r,'Cidade')).trim(),branch:String(h(r,'Filial')).trim()})).filter(x=>x.code&&x.name);if(type==='maps')return rows.map(r=>({map_number:normalizeCode(h(r,'MAPAS','MAPA')),map_date:parseAnyDate(h(r,'DATA')),city:String(h(r,'CIDADE')).trim(),driver:String(h(r,'MOTORISTA')).trim(),helper1:String(h(r,'AJUDANTE 1')).trim(),helper2:String(h(r,'AJUDANTE 2')).trim(),g300:num(h(r,'GARRAFEIRAS DE 300ML')),g600_green:num(h(r,'GARRAFEIRAS DE 600 ML VERDE','GARRAFEIRAS DE 600ML VERDE')),g600_brown:num(h(r,'GARRAFEIRAS DE 600ML MARROM','GARRAFEIRAS DE 600 ML MARROM')),g_litrao:num(h(r,'GARRAFEIRAS DE LITRÃO','GARRAFEIRAS DE LITRAO')),keg30:num(h(r,'BARRIS DE CHOPP 30L')),keg50:num(h(r,'BARRIS DE CHOPP 50L'))})).filter(x=>x.map_number&&x.map_date);if(type==='nris')return rows.map(r=>({nri:String(h(r,'NRI')).trim(),request_id:null,product_code:String(h(r,'Código Produto','Codigo Produto')).trim(),product_name:String(h(r,'Nome Produto','Produto')).trim(),unit:String(h(r,'Unidade')).trim(),validity_date:parseAnyDate(h(r,'Validade')),lot:String(h(r,'Lote')).trim().toUpperCase(),receipt_date:parseAnyDate(h(r,'Recebimento')),block_date:parseAnyDate(h(r,'Bloqueio')),checker_name:String(h(r,'Conferente')).trim(),shift:String(h(r,'Turno')).trim(),receipt_time:normalizeTime(h(r,'Hora')),driver:String(h(r,'Motorista')).trim(),plate:String(h(r,'Placa')).trim().toUpperCase(),factory:String(h(r,'Fábrica','Fabrica')).trim(),quantity:num(h(r,'Quantidade','Caixas')),status:String(h(r,'Status')||'PENDENTE').trim().toUpperCase(),created_by:null,created_by_username:String(h(r,'Usuário Cadastro','Usuario Cadastro')).trim(),created_by_name:String(h(r,'Nome Usuário Cadastro','Nome Usuario Cadastro')).trim(),created_at:parseAnyDateTime(h(r,'Criado em ISO','Criado em'))||new Date().toISOString(),printed_at:parseAnyDateTime(h(r,'Impresso em'))||null,removed_at:parseAnyDateTime(h(r,'Removido em'))||null})).filter(x=>x.nri&&x.product_code&&x.validity_date);if(type==='conferences')return rows.map(r=>({conference_date:parseAnyDate(h(r,'Data')),conference_time:normalizeTime(h(r,'Hora')),checker_id:null,checker_username:String(h(r,'Conferente Usuário','Conferente Usuario')).trim(),checker_name:String(h(r,'Conferente Nome','Conferente')).trim(),map_number:normalizeCode(h(r,'Mapa')),g300:num(h(r,'Garrafeiras de 300ml')),g600_green:num(h(r,'Garrafeiras de 600ml Verde')),g600_brown:num(h(r,'Garrafeiras de 600ml Marrom')),g_litrao:num(h(r,'Garrafeiras de Litrão','Garrafeiras de Litrao')),keg30:num(h(r,'Barris de Chopp 30L')),keg50:num(h(r,'Barris de Chopp 50L')),created_at:parseAnyDateTime(h(r,'Criado em ISO','Data/Hora'))||new Date().toISOString()})).filter(x=>x.conference_date&&x.map_number);return [];}

// MODAL / HELPERS ------------------------------------------------------------
function openModal(title,subtitle,body,actions=[]){$('modalTitle').textContent=title;$('modalSubtitle').textContent=subtitle||'';$('modalBody').innerHTML=body||'';const a=$('modalActions');a.innerHTML='';actions.forEach(x=>{const b=document.createElement('button');b.className=`btn ${x.class||'secondary'}`;b.textContent=x.label;b.addEventListener('click',x.onClick);a.appendChild(b);});$('modal').classList.add('open');}
function closeModal(){$('modal').classList.remove('open');$('modalBody').innerHTML='';$('modalActions').innerHTML='';}
function statusBadge(s){const cls=s==='IMPRESSO'||s==='APROVADO'?'ok':s==='REPROVADO'||s==='REMOVIDO'?'bad':s==='PARCIAL'?'partial':'pending';return `<span class="status ${cls}">${esc(s)}</span>`;}
function dashStatus(s){return s==='OK'?'<span class="status ok">Sem diferença</span>':s==='DIVERGENTE'?'<span class="status bad">Divergente</span>':s==='SEM_CONFERENCIA'?'<span class="status pending">Sem conferência</span>':'<span class="status partial">Fora da base</span>';}
function toast(msg,type=''){const t=$('toast');t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3600);}
function humanError(e){const m=String(e?.message||e?.error_description||e||'Erro desconhecido');if(m.includes('FORBIDDEN'))return 'Seu perfil não possui permissão para esta ação.';if(m.includes('JWT'))return 'Sua sessão expirou. Entre novamente.';if(m.includes('Failed to fetch'))return 'Falha de conexão. Verifique a internet.';return m;}
function humanGpsError(e){const code=e?.code;if(code===1)return 'permissão de localização negada pelo navegador.';if(code===2)return 'localização indisponível no aparelho.';if(code===3)return 'tempo esgotado ao obter GPS.';return String(e?.message||e||'erro ao obter localização.');}
function normalizeUsername(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,'.').replace(/[^a-z0-9._-]/g,'');}
function normalizeCode(v){return String(v||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');}
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function normHeader(v){return norm(v).replace(/[^a-z0-9]/g,'');}
function num(v){const n=Number(String(v??0).replace(',','.'));return Number.isFinite(n)?n:0;}
function intVal(id){return Math.max(0,Math.trunc(num($(id).value)));}
function fmtNum(v){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(num(v));}
function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v));}
function fmtDate(v){if(!v)return '—';const s=String(v).slice(0,10);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:v;}
function fmtTime(v){if(!v)return '—';const m=String(v).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);return m?`${m[1]}:${m[2]}${m[3]?':'+m[3]:''}`:String(v);}
function fmtDateTime(v){if(!v)return '—';try{return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'medium'}).format(new Date(v));}catch{return String(v);}}
function localIsoDate(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function localTime(d){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
function maskShortDate(v){const d=String(v||'').replace(/\D/g,'').slice(0,6);return d.length<=2?d:d.length<=4?`${d.slice(0,2)}/${d.slice(2)}`:`${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;}
function parseShortDate(v){const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);if(!m)return '';const y=2000+Number(m[3]),mo=Number(m[2]),d=Number(m[1]);const dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return '';return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function formatShortDate(iso){if(!iso)return '';const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1].slice(2)}`:'';}
function addDaysIso(iso,days){const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function parseAnyDate(v){const s=String(v||'').trim();if(!s)return null;if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;}const d=new Date(s);return isNaN(d)?null:d.toISOString().slice(0,10);}
function parseAnyDateTime(v){const s=String(v||'').trim();if(!s)return null;const d=new Date(s);return isNaN(d)?null:d.toISOString();}
function normalizeTime(v){const m=String(v||'').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?`${String(m[1]).padStart(2,'0')}:${m[2]}:${m[3]||'00'}`:'00:00:00';}
function mapKey(map,date){return `${normalizeCode(map)}|${String(date||'').slice(0,10)}`;}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function jsEsc(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function initials(n){return String(n||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function uuid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function chunks(arr,n){const out=[];for(let i=0;i<arr.length;i+=n)out.push(arr.slice(i,i+n));return out;}
function captureGps(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS indisponível'));navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),err=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),reject,{enableHighAccuracy:false,timeout:10000,maximumAge:15000}),{enableHighAccuracy:true,timeout:14000,maximumAge:0});});}
function compressImage(file,max,quality){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;if(Math.max(w,h)>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('Falha ao processar foto.'));},'image/jpeg',quality);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem inválida.'));};img.src=url;});}
function setupSignatureCanvas(){const c=$('signatureCanvas'),ctx=c.getContext('2d');ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#17202a';const pos=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};};c.addEventListener('pointerdown',e=>{drawingSignature=true;signatureDirty=true;c.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});c.addEventListener('pointermove',e=>{if(!drawingSignature)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});['pointerup','pointercancel','pointerleave'].forEach(ev=>c.addEventListener(ev,()=>drawingSignature=false));}
function clearSignature(){const c=$('signatureCanvas');c.getContext('2d').clearRect(0,0,c.width,c.height);signatureDirty=false;}
function canvasBlob(c,q){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Falha ao gerar assinatura.')),'image/jpeg',q));}
function parseCsvObjects(text){text=String(text||'').replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0]||'';const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';const matrix=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quote){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quote=false;else cell+=ch;}else{if(ch==='"')quote=true;else if(ch===delim){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));matrix.push(row);row=[];cell='';}else cell+=ch;}}if(cell||row.length){row.push(cell.replace(/\r$/,''));matrix.push(row);}const headers=(matrix.shift()||[]).map(x=>x.trim());return matrix.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
function downloadCsv(name,matrix){const csv='\uFEFF'+matrix.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

})();
