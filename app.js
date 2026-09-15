(() => {
'use strict';

const CFG = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const TZ = 'America/Fortaleza';
const ROLE_LABELS = {
  ADMIN:'Admin', COLABORADOR_ARMAZEM:'Colaborador Armazém / Conferente', COLABORADOR_ENTREGA:'Motorista', CONFERENTE:'Colaborador Armazém / Conferente'
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
let selectedCustomerKey = '';
let nriDraftItems = [];
let nriEditingId = null;
let pendingNris = [];
let selectedNris = new Set();
let printOperation = null;
let historyNris = [];
let avariaItems = [];
let avariaEditingId = null;
let avPhotos = [];
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{});

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
  document.querySelectorAll('.nav-module-toggle').forEach(b=>b.addEventListener('click',()=>toggleNavModule(b.closest('.nav-module'))));
  $('modalClose').addEventListener('click',closeModal); $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});

  // NRI
  $('nriCodigo').addEventListener('input',onProductCode);
  $('nriTipo').addEventListener('change',updateNriTypeFields);
  $('nriSemValidade').addEventListener('change',updateNriValidityMode);
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
  $('avMapa').addEventListener('input',()=>{$('avMapaResumo').textContent=$('avMapa').value.trim()||'—';});
  $('avClienteEscolha').addEventListener('change',onCustomerChoiceChange);
  $('avLote').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
  $('btnAvCamera').addEventListener('click',()=>$('avFotoCamera').click());
  $('btnAvArquivo').addEventListener('click',()=>$('avFotoArquivo').click());
  $('avFotoCamera').addEventListener('change',onAvariaPhoto);
  $('avFotoArquivo').addEventListener('change',onAvariaPhoto);
  $('avPhotoGallery').addEventListener('click',onAvariaPhotoGalleryClick);
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
  $('btnLimparDashboard').addEventListener('click',clearDashboardFilters);
  $('dashPeriodo').addEventListener('change',()=>{updateDashboardPeriod();renderDashboard();});
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
  document.title='Disb Gestão';
  $('userNome').textContent=profile.name; $('userPerfil').textContent=ROLE_LABELS[profile.role]||profile.role; $('userAvatar').textContent=initials(profile.name);
  applyRole(); restoreNavModules(); fillDefaultDates(); updateDashboardPeriod();
  await loadReferences(true);
  setupRealtime();
  if(canNri()) { await loadPending(); }
  if(isAdmin()) { loadAdminAvarias(); }
  const defaultView = profile.role==='COLABORADOR_ENTREGA'?'avaria-cadastro':profile.role==='CONFERENTE'?'conf-cadastro':'nri-cadastro';
  openView(defaultView,true);
}
function isAdmin(){return profile?.role==='ADMIN';}
function canNri(){return ['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE'].includes(profile?.role);}
function canAvaria(){return ['ADMIN','COLABORADOR_ENTREGA'].includes(profile?.role);}
function canConference(){return ['ADMIN','COLABORADOR_ARMAZEM','CONFERENTE'].includes(profile?.role);}
function applyRole(){
  document.querySelectorAll('.role-nri').forEach(x=>x.classList.toggle('hidden',!canNri()));
  document.querySelectorAll('.role-avaria').forEach(x=>x.classList.toggle('hidden',!canAvaria()));
  document.querySelectorAll('.role-conferencia').forEach(x=>x.classList.toggle('hidden',!canConference()));
  document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
}
function toggleNavModule(module){
  if(!module)return;
  setNavModuleOpen(module,!module.classList.contains('open'));
  saveNavModules();
}
function setNavModuleOpen(module,open){
  if(!module)return;
  module.classList.toggle('open',!!open);
  const btn=module.querySelector('.nav-module-toggle');
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}
function saveNavModules(){
  const state={};
  document.querySelectorAll('.nav-module').forEach(m=>state[m.dataset.module]=m.classList.contains('open'));
  try{localStorage.setItem('disb_nav_modules',JSON.stringify(state));}catch(_e){}
}
function restoreNavModules(){
  let state={};
  try{state=JSON.parse(localStorage.getItem('disb_nav_modules')||'{}')||{};}catch(_e){}
  document.querySelectorAll('.nav-module').forEach(m=>setNavModuleOpen(m,state[m.dataset.module]===true));
}
function openModuleForView(name){
  const item=document.querySelector(`.nav-item[data-view="${name}"]`);
  const module=item?.closest('.nav-module');
  if(module){setNavModuleOpen(module,true);saveNavModules();}
}
function openView(name,force=false){
  const v=$(`view-${name}`); if(!v||v.classList.contains('hidden'))return;
  if(!force&&activeView===name){toggleSidebar(false);return;}
  activeView=name; document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); v.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  openModuleForView(name);
  const meta=viewMeta[name]||['Disb Gestão','']; $('topbarTitulo').textContent=meta[0];$('topbarSubtitulo').textContent=meta[1]; toggleSidebar(false);
  if(name==='nri-pendentes')loadPending();
  if(name==='avaria-cadastro')ensureAvariaLocationPermission();
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
      refs=sanitizeRefs({products:p.data||[],units:u.data||[],shifts:s.data||[],drivers:d.data||[],factories:f.data||[],customers:c.data||[]});
      localStorage.setItem('ops_ref_cache',JSON.stringify({at:Date.now(),data:refs})); rebuildReferenceMaps();populateReferenceInputs();
    }catch(e){ if(!refs.products.length)toast(humanError(e),'error'); }
    finally{refRefreshPromise=null;}
  })();
  return refRefreshPromise;
}
function readRefCache(){try{const x=JSON.parse(localStorage.getItem('ops_ref_cache')||'null');return x&&Date.now()-x.at<12*3600e3?sanitizeRefs(x.data):null;}catch{return null;}}
function rebuildReferenceMaps(){
  productsByCode=new Map(refs.products.map(x=>[String(x.code),x]));
  customersByCode=new Map();
  refs.customers.forEach(x=>{
    const k=normalizeCode(x.code);
    if(!k)return;
    if(!customersByCode.has(k))customersByCode.set(k,[]);
    customersByCode.get(k).push(x);
  });
}
function populateReferenceInputs(){
  fillSelect('nriUnidade',refs.units.map(x=>x.name),'Selecione'); fillSelect('nriTurno',refs.shifts.map(x=>x.name),'Selecione'); fillSelect('nriMotorista',refs.drivers.map(x=>x.name),'Selecione'); fillSelect('nriFabrica',refs.factories.map(x=>x.name),'Selecione');
  fillSelect('pendUnidade',refs.units.map(x=>x.name),'Todas'); fillSelect('histNriUnidade',refs.units.map(x=>x.name),'Todas');
  updateNriTypeFields();
}
function fillSelect(id,values,placeholder){const el=$(id);const old=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}
function sanitizeRefText(v){return repairText(String(v??'')).trim();}
function repairText(v){let s=String(v??'');const map={'Ã¡':'á','Ã ': 'à','Ã¢':'â','Ã£':'ã','Ã¤':'ä','Ã©':'é','Ã¨':'è','Ãª':'ê','Ã«':'ë','Ã­':'í','Ã¬':'ì','Ã®':'î','Ã¯':'ï','Ã³':'ó','Ã²':'ò','Ã´':'ô','Ãµ':'õ','Ã¶':'ö','Ãº':'ú','Ã¹':'ù','Ã»':'û','Ã¼':'ü','Ã§':'ç','Ã':'Á','Ã€':'À','Ã‚':'Â','Ãƒ':'Ã','Ã„':'Ä','Ã‰':'É','Ãˆ':'È','ÃŠ':'Ê','Ã‹':'Ë','Ã':'Í','ÃŒ':'Ì','ÃŽ':'Î','Ã':'Ï','Ã“':'Ó','Ã’':'Ò','Ã”':'Ô','Ã•':'Õ','Ã–':'Ö','Ãš':'Ú','Ã™':'Ù','Ã›':'Û','Ãœ':'Ü','Ã‡':'Ç','â€“':'–','â€”':'—','â€˜':'‘','â€™':'’','â€œ':'“','â€':'”','â€¢':'•','Â ':' ','Âº':'º','Âª':'ª'};for(const [a,b] of Object.entries(map))s=s.split(a).join(b);s=s.replace(/Â(?=[A-Za-zÀ-ÿ])/g,'');return s;}
function sanitizeRefs(data){return {products:(data.products||[]).map(x=>({code:normalizeCode(x.code),name:sanitizeRefText(x.name)})).filter(x=>x.code&&x.name),units:(data.units||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),shifts:(data.shifts||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),drivers:(data.drivers||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),factories:(data.factories||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),customers:(data.customers||[]).map(x=>({code:normalizeCode(x.code),name:sanitizeRefText(x.name),city:sanitizeRefText(x.city),branch:sanitizeRefText(x.branch)})).filter(x=>x.code&&x.name)};}

// NRI ------------------------------------------------------------------------
function fillDefaultDates(){
  const now=new Date(); const iso=localIsoDate(now); const time=localTime(now);
  if(!$('nriRecebimento').value)$('nriRecebimento').value=iso; if(!$('nriHora').value)$('nriHora').value=time; $('nriConferente').value=profile?.name||'';
  if(!$('avData').value)$('avData').value=iso; $('avEntregador').value=profile?.name||'';
  $('confConferente').textContent=profile?.name||'—'; updateConfClock();
}
setInterval(updateConfClock,1000); function updateConfClock(){if(!$('confAgora'))return;$('confAgora').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'medium'}).format(new Date());}
function onProductCode(){ const code=normalizeCode($('nriCodigo').value); const p=productsByCode.get(code); if(!p){$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');return;} $('produtoPlaceholder').classList.add('hidden');$('produtoInfo').classList.remove('hidden');$('produtoCodigo').textContent=`Código ${p.code}`;$('produtoNome').textContent=p.name; const img=$('produtoImagem');img.classList.remove('hidden');setProductImage(img,p.code); }
function setProductImage(img,code){const ex=['png','jpg','jpeg','webp'];let i=0;const next=()=>{if(i>=ex.length){img.classList.add('hidden');return;}img.onerror=()=>{i++;next();};img.src=`${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(code)}.${ex[i]}`;};next();}
function setSelectFixedValue(select,value,disabled){
  if(!select)return;
  const marker='__fixed_value__';
  [...select.options].filter(o=>o.dataset.fixed===marker).forEach(o=>o.remove());
  if(disabled){const o=document.createElement('option');o.value=value;o.textContent=value;o.dataset.fixed=marker;select.prepend(o);select.value=value;}
  select.disabled=disabled;
  select.required=!disabled;
  if(!disabled&&select.value===value)select.value='';
}
function updateNriTypeFields(){
  const marketplace=$('nriTipo').value==='MARKETPLACE';
  setSelectFixedValue($('nriMotorista'),'--',marketplace);
  setSelectFixedValue($('nriFabrica'),'--',marketplace);
  const plate=$('nriPlaca');
  if(marketplace){plate.value='--';plate.disabled=true;plate.required=false;}else{plate.disabled=false;plate.required=true;if(plate.value==='--')plate.value='';}
}
function updateNriValidityMode(){
  const sem=$('nriSemValidade').checked;
  const validity=$('nriValidade');
  validity.disabled=sem;
  if(sem){validity.value='';$('nriBloqueio').value='--';}else{if($('nriBloqueio').value==='--')$('nriBloqueio').value='';updateBlockDate();}
}
function updateBlockDate(){if($('nriSemValidade').checked){$('nriBloqueio').value='--';return;}const iso=parseShortDate($('nriValidade').value);$('nriBloqueio').value=iso?formatShortDate(addDaysIso(iso,-30)):'';}
function addNriDraftItem(){
  const code=normalizeCode($('nriCodigo').value);const p=productsByCode.get(code);const semValidade=$('nriSemValidade').checked;const validity=semValidade?null:parseShortDate($('nriValidade').value);const lot=$('nriLote').value.trim().toUpperCase();const qty=num($('nriQuantidade').value);const pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Informe um código de produto válido.','error'); if(!semValidade&&!validity)return toast('Informe a validade completa no formato dd/mm/aa ou selecione Sem Validade.','error'); if(!lot)return toast('Informe o lote.','error'); if(qty<=0)return toast('Informe a quantidade.','error'); if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  const item={id:nriEditingId||uuid(),product_code:p.code,product_name:p.name,validity_date:validity,lot,quantity:qty,pallets,block_date:validity?addDaysIso(validity,-30):null};
  const idx=nriDraftItems.findIndex(x=>x.id===item.id); if(idx>=0)nriDraftItems[idx]=item;else nriDraftItems.push(item); renderNriDraftItems();clearNriItemEditor();
}
function renderNriDraftItems(){
  const total=nriDraftItems.reduce((s,x)=>s+x.pallets,0);$('nriItemCounter').textContent=`${nriDraftItems.length} item(ns) • ${total} NRI(s)`;$('btnCadastrarCarreta').textContent=total?`Cadastrar carreta (${total} NRIs)`:'Cadastrar carreta';
  const el=$('nriItemList'); if(!nriDraftItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;} el.className='item-list';el.innerHTML=nriDraftItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product_code)} • ${esc(x.product_name)}</strong></div><div class="info"><small>Validade</small><strong>${x.validity_date?formatShortDate(x.validity_date):'Sem Validade'}</strong></div><div class="info"><small>Lote</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)}</strong></div><div class="info"><small>Paletes / NRIs</small><strong>${x.pallets}</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
}
function onNriDraftListClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const row=b.closest('[data-id]');const item=nriDraftItems.find(x=>x.id===row.dataset.id);if(!item)return;if(b.dataset.act==='del'){nriDraftItems=nriDraftItems.filter(x=>x.id!==item.id);renderNriDraftItems();if(nriEditingId===item.id)clearNriItemEditor();return;}nriEditingId=item.id;$('nriCodigo').value=item.product_code;$('nriSemValidade').checked=!item.validity_date;$('nriValidade').value=formatShortDate(item.validity_date);$('nriLote').value=item.lot;$('nriQuantidade').value=item.quantity;$('nriPaletes').value=item.pallets;$('nriBloqueio').value=item.block_date?formatShortDate(item.block_date):'--';updateNriValidityMode();onProductCode();$('btnAdicionarNriItem').textContent='Salvar alteração';$('btnCancelarNriItem').classList.remove('hidden');}
function clearNriItemEditor(){nriEditingId=null;['nriCodigo','nriValidade','nriLote','nriBloqueio'].forEach(id=>$(id).value='');$('nriSemValidade').checked=false;updateNriValidityMode();$('nriQuantidade').value=1;$('nriPaletes').value=1;$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');$('btnAdicionarNriItem').textContent='+ Adicionar à carreta';$('btnCancelarNriItem').classList.add('hidden');}
function clearNriRequest(){nriDraftItems=[];renderNriDraftItems();clearNriItemEditor();['nriUnidade','nriTurno','nriMotorista','nriFabrica','nriPlaca'].forEach(id=>$(id).value='');$('nriTipo').value='AMBEV';updateNriTypeFields();$('nriRecebimento').value=localIsoDate(new Date());$('nriHora').value=localTime(new Date());$('nriConferente').value=profile?.name||'';}
async function submitNriRequest(e){
  e.preventDefault();if(!nriDraftItems.length)return toast('Adicione ao menos um produto à carreta.','error');
  const requestType=$('nriTipo').value==='MARKETPLACE'?'MARKETPLACE':'AMBEV';
  const common={unit:$('nriUnidade').value,request_type:requestType,receipt_date:$('nriRecebimento').value,shift:$('nriTurno').value,receipt_time:$('nriHora').value,driver:requestType==='MARKETPLACE'?'--':$('nriMotorista').value,plate:requestType==='MARKETPLACE'?'--':$('nriPlaca').value.trim(),factory:requestType==='MARKETPLACE'?'--':$('nriFabrica').value};
  const requiredBase=[common.unit,common.request_type,common.receipt_date,common.shift,common.receipt_time];
  if(requiredBase.some(v=>!String(v).trim()))return toast('Preencha unidade, tipo, data, turno e hora.','error');
  if(requestType==='AMBEV'&&[common.driver,common.plate,common.factory].some(v=>!String(v).trim()))return toast('Preencha motorista, placa e fábrica para recebimento Ambev.','error');
  const btn=$('btnCadastrarCarreta');btn.disabled=true;btn.textContent='Cadastrando…';
  try{const {data,error}=await sb.rpc('create_nri_request',{p_payload:{...common,items:nriDraftItems}});if(error)throw error;const count=data?.nris?.length||nriDraftItems.reduce((s,x)=>s+x.pallets,0);toast(`${count} NRIs cadastradas e enviadas para Impressões pendentes.`,'success');clearNriRequest();await loadPending(true);}
  catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;renderNriDraftItems();}
}
async function loadPending(silent=false){if(!canNri())return;try{const {data,error}=await sb.from('nris').select('*').eq('status','PENDENTE').order('created_at',{ascending:false}).limit(1500);if(error)throw error;pendingNris=(data||[]).map(mapNri);selectedNris=new Set([...selectedNris].filter(id=>pendingNris.some(x=>x.id===id)));renderPending();$('badgePendentes').textContent=pendingNris.length;}catch(e){if(!silent)toast(humanError(e),'error');}}
function mapNri(r){return {...r,codigoProduto:r.product_code,nomeProduto:r.product_name,unidade:r.unit,tipo:r.request_type||'AMBEV',validade:r.validity_date,lote:r.lot,recebimento:r.receipt_date,bloqueio:r.block_date,conferente:r.checker_name,turno:r.shift,hora:fmtTime(r.receipt_time),motorista:r.driver,placa:r.plate,fabrica:r.factory,quantidade:r.quantity};}
function filteredPending(){const q=norm($('pendFiltro').value),u=$('pendUnidade').value;return pendingNris.filter(x=>(!u||x.unidade===u)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa].join(' ')).includes(q)));}
function renderPending(){const arr=filteredPending();$('tbodyPendentes').innerHTML=arr.length?arr.map(x=>`<tr><td><input type="checkbox" data-check="${x.id}" ${selectedNris.has(x.id)?'checked':''}></td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${x.validade?fmtDate(x.validade):'Sem Validade'}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${fmtNum(x.quantidade)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Visualizar</button><button class="mini-btn" data-act="print" data-id="${x.id}">Imprimir</button><button class="mini-btn danger" data-act="remove" data-id="${x.id}">Remover</button></div></td></tr>`).join(''):`<tr><td colspan="6">Nenhuma NRI pendente.</td></tr>`;}
function onPendingCheck(e){if(!e.target.matches('input[data-check]'))return;e.target.checked?selectedNris.add(e.target.dataset.check):selectedNris.delete(e.target.dataset.check);}
function onPendingClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=pendingNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);if(b.dataset.act==='print')startPrint([r]);if(b.dataset.act==='remove')removeNri(r);}
function toggleVisiblePendingSelection(){const arr=filteredPending();const all=arr.length&&arr.every(x=>selectedNris.has(x.id));arr.forEach(x=>all?selectedNris.delete(x.id):selectedNris.add(x.id));renderPending();}
async function removeNri(r){if(!confirm(`Remover ${r.nri} da fila?`))return;try{const {error}=await sb.rpc('remove_nris',{p_ids:[r.id]});if(error)throw error;toast('NRI removida da fila.','success');await loadPending(true);}catch(e){toast(humanError(e),'error');}}
function showNriPreview(r){openModal(`NRI ${r.nri}`,`${r.codigoProduto} • ${r.nomeProduto}`,htmlEtiqueta(r,false),[{label:'Imprimir',class:'primary',onClick:()=>{closeModal();startPrint([r],r.status==='IMPRESSO');}}]);setTimeout(()=>{const img=$('modalBody').querySelector('img[data-product]');if(img)setProductImage(img,r.codigoProduto);},10);}
async function startPrint(records,reprint=false){if(!records?.length)return toast('Selecione ao menos uma NRI.','error');printOperation={records,reprint};const frame=$('printFrame');const doc=frame.contentWindow.document;doc.open();doc.write(printDocument(records));doc.close();await wait(90);frame.contentWindow.focus();frame.contentWindow.print();openModal('Confirmar impressão','O diálogo da impressora foi aberto.','<p>Confirme somente depois de verificar se a impressão realmente foi concluída.</p>',[{label:'Cancelar / não imprimiu',class:'secondary',onClick:()=>finishPrint('CANCELADO')},{label:'Impressão concluída',class:'primary',onClick:()=>finishPrint('IMPRESSO')}]);}
async function finishPrint(result){if(!printOperation)return;const op=printOperation;printOperation=null;closeModal();if(result==='IMPRESSO'&&!op.reprint){const ids=new Set(op.records.map(x=>x.id));pendingNris=pendingNris.filter(x=>!ids.has(x.id));renderPending();$('badgePendentes').textContent=pendingNris.length;}try{const {error}=await sb.rpc('confirm_nri_print',{p_ids:op.records.map(x=>x.id),p_reprint:!!op.reprint,p_result:result});if(error)throw error;toast(result==='IMPRESSO'?'Impressão confirmada.':'Cancelamento registrado.',result==='IMPRESSO'?'success':'');}catch(e){toast(humanError(e),'error');loadPending(true);}}
function htmlEtiqueta(r,print){const img=print?`<img alt="" onerror="imgFallback(this,'${jsEsc(r.codigoProduto)}',1)" src="${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(r.codigoProduto)}.png">`:`<img alt="" data-product="1">`;const semValidade=!r.validade;const validadeTexto=semValidade?'SEM VALIDADE':fmtDate(r.validade);const bloqueioTexto=semValidade?'--':fmtDate(r.bloqueio);return `<div class="nri-preview-label"><div class="nri-top"><div class="nri-code-label">CÓDIGO:</div><div class="nri-code-value">${esc(r.codigoProduto)}</div><div class="nri-id">${esc(r.nri)}</div></div><div class="nri-product-title">${img}<strong>${esc(r.nomeProduto)}</strong></div><div class="nri-mini-strip"><div class="nri-mini-cell"><b>UNIDADE:</b>${esc(r.unidade)} <b style="margin-left:12px">TIPO:</b>${esc(r.tipo||'AMBEV')}</div></div><div class="nri-validade"><span>VALIDADE:</span><strong class="${semValidade?'sem-validade':''}">${validadeTexto}</strong></div><div class="nri-dates"><div class="nri-date-cell"><b>RECEB:</b><strong>${fmtDate(r.recebimento)}</strong></div><div class="nri-date-cell"><b>BLOQUEIO:</b><strong>${bloqueioTexto}</strong></div></div><div class="nri-meta"><div class="nri-meta-cell"><b>Conferente</b><span>${esc(r.conferente)}</span></div><div class="nri-meta-cell"><b>Turno</b><span>${esc(r.turno)}</span></div><div class="nri-meta-cell"><b>Hora</b><span>${esc(r.hora)}</span></div><div class="nri-meta-cell"><b>Motorista</b><span>${esc(r.motorista)}</span></div><div class="nri-meta-cell"><b>Placa</b><span>${esc(r.placa)}</span></div></div><div class="nri-bottom"><div><b>Fábrica:</b>${esc(r.fabrica)}</div><div><b>Quantidade:</b>${esc(r.quantidade)}</div><div><b>NRI:</b>${esc(r.nri)}</div></div></div>`;}
function printDocument(records){const pages=records.map(r=>`<section class="page">${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}</section>`).join('');return `<!doctype html><html><head><base href="${document.baseURI}"><meta charset="utf-8"><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#686868}.page{height:287mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always}.page:last-child{page-break-after:auto}.nri-preview-label{height:89mm;width:100%;border:1.2px solid #777;background:#fff;color:#686868;overflow:hidden}.nri-top{display:grid;grid-template-columns:auto 1fr auto;align-items:stretch;height:12mm;border-bottom:2px solid #777}.nri-code-label{display:flex;align-items:center;padding:0 2.2mm;font-size:18pt;font-weight:1000;border-right:2px solid #777}.nri-code-value{display:flex;align-items:center;padding:0 3mm;font-size:31pt;line-height:.82;font-weight:1000;color:#4b4f54}.nri-id{display:flex;align-items:center;padding:0 2mm;font-size:10pt;font-weight:900}.nri-product-title{height:18mm;border-bottom:1px solid #777;display:flex;align-items:center;justify-content:center;gap:3mm;padding:1mm 3mm;text-align:center}.nri-product-title img{width:14mm;height:14mm;object-fit:contain}.nri-product-title strong{font-size:24pt;line-height:.96;font-weight:1000}.nri-mini-strip{height:4.5mm;border-bottom:1px solid #777}.nri-mini-cell{display:flex;align-items:center;padding:.2mm 1.8mm;font-size:9pt;font-weight:700}.nri-mini-cell b{font-size:8.5pt;font-weight:1000;margin-right:1.3mm}.nri-validade{display:grid;grid-template-columns:31% 69%;height:28mm;border-bottom:1px solid #777;align-items:center}.nri-validade span{height:100%;display:flex;align-items:center;padding:1.5mm 2.5mm;border-right:1px solid #777;font-size:25pt;font-weight:1000}.nri-validade strong{font-size:58pt;line-height:.84;text-align:center;font-weight:1000;color:#4b4f54}.nri-validade strong.sem-validade{font-size:28pt;line-height:1}.nri-dates{display:grid;grid-template-columns:1fr 1fr;height:10mm;border-bottom:1px solid #777}.nri-date-cell{display:grid;grid-template-columns:auto 1fr;align-items:center}.nri-date-cell+.nri-date-cell{border-left:1px solid #777}.nri-date-cell b{padding:1mm 1.8mm;font-size:10.5pt}.nri-date-cell strong{text-align:center;padding:1mm 1.4mm;border-left:1px solid #777;font-size:13.5pt}.nri-meta{display:grid;grid-template-columns:1.55fr .85fr .8fr 1.15fr 1fr;height:7mm;border-bottom:1px solid #777}.nri-meta-cell{text-align:center;border-right:1px solid #777;overflow:hidden}.nri-meta-cell:last-child{border-right:0}.nri-meta-cell b{display:block;padding:.08mm .6mm 0;font-size:7.8pt;text-decoration:underline}.nri-meta-cell span{display:block;padding:.05mm .6mm 0;font-size:9.6pt;font-weight:700;white-space:nowrap}.nri-bottom{display:grid;grid-template-columns:1.8fr .75fr 1.1fr;height:5.5mm}.nri-bottom>div{display:flex;align-items:center;padding:.2mm 1.6mm;font-size:9.5pt;font-weight:700;border-right:1px solid #777}.nri-bottom>div:last-child{border-right:0}</style></head><body>${pages}<script>function imgFallback(img,code,i){var ex=['png','jpg','jpeg','webp'];i=i||0;if(i>=ex.length){img.style.display='none';return;}img.onerror=function(){imgFallback(img,code,i+1)};img.src='${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/'+encodeURIComponent(code)+'.'+ex[i];}<\/script></body></html>`;}
async function loadNriHistory(){if(!isAdmin())return;try{let q=sb.from('nris').select('*').order('created_at',{ascending:false}).limit(2000);const {data,error}=await q;if(error)throw error;historyNris=(data||[]).map(mapNri);renderNriHistory();}catch(e){toast(humanError(e),'error');}}
function filteredNriHistory(){const q=norm($('histNriBusca').value),status=$('histNriStatus').value,u=$('histNriUnidade').value,de=$('histNriDe').value,ate=$('histNriAte').value;return historyNris.filter(x=>(!status||x.status===status)&&(!u||x.unidade===u)&&(!de||String(x.created_at).slice(0,10)>=de)&&(!ate||String(x.created_at).slice(0,10)<=ate)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa,x.conferente,x.created_by_username,x.created_by_name].join(' ')).includes(q)));}
function renderNriHistory(){const arr=filteredNriHistory();$('tbodyHistNri').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDateTime(x.created_at)}</td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${x.validade?fmtDate(x.validade):'Sem Validade'}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${esc(x.created_by_name||x.created_by_username||'—')}<small>${esc(x.conferente)}</small></td><td>${statusBadge(x.status)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Ver</button><button class="mini-btn" data-act="reprint" data-id="${x.id}">Reimprimir</button></div></td></tr>`).join(''):'<tr><td colspan="7">Nenhum registro.</td></tr>';}
function onNriHistoryClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=historyNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);else startPrint([r],true);}

// AVARIAS --------------------------------------------------------------------
function customerKey(c){return `${normalizeCode(c?.code)}|${String(c?.branch||'').trim()}|${String(c?.name||'').trim()}`;}
function currentCustomerMatches(){return customersByCode.get(normalizeCode($('avPdv').value))||[];}
function selectedCustomer(){
  const matches=currentCustomerMatches();
  if(matches.length===1)return matches[0];
  if(!selectedCustomerKey)return null;
  return matches.find(c=>customerKey(c)===selectedCustomerKey)||null;
}
function showCustomer(c){
  const typed=normalizeCode($('avPdv').value);
  $('avClienteNome').textContent=c?.name||(typed?'Cliente não localizado':'Digite um código');
  $('avClienteCodigo').textContent=c?.code||typed||'—';
  $('avCidade').textContent=c?.city||'—';
  $('avMapaResumo').textContent=$('avMapa').value.trim()||'—';
}
function onPdvInput(){
  selectedCustomerKey='';
  const matches=currentCustomerMatches();
  const wrap=$('avClienteDuplicado');
  const sel=$('avClienteEscolha');
  sel.innerHTML='';
  if(!matches.length){wrap.classList.add('hidden');showCustomer(null);return;}
  if(matches.length===1){wrap.classList.add('hidden');showCustomer(matches[0]);return;}
  showCustomer(null);
  $('avClienteNome').textContent=`${matches.length} clientes encontrados — selecione abaixo`;
  sel.innerHTML='<option value="">Selecione o cliente</option>'+matches.map(c=>`<option value="${esc(customerKey(c))}">${esc(c.name)} • ${esc(c.city||'—')} • ${esc(c.branch||'Sem filial')}</option>`).join('');
  wrap.classList.remove('hidden');
}
function onCustomerChoiceChange(){
  selectedCustomerKey=$('avClienteEscolha').value||'';
  showCustomer(selectedCustomer());
}
async function onAvariaPhoto(e){
  const files=[...(e.target.files||[])];
  e.target.value='';
  if(!files.length)return;
  const remaining=5-avPhotos.length;
  if(remaining<=0)return toast('Cada produto aceita no máximo 5 fotos.','error');
  const chosen=files.slice(0,remaining);
  if(files.length>remaining)toast(`Somente ${remaining} foto(s) foram adicionadas. O limite é 5.`,'');
  for(const file of chosen){
    const sourceKey=`${file.name}|${file.size}|${file.lastModified}`;
    if(avPhotos.some(p=>p.sourceKey===sourceKey)){toast('Esta foto já foi adicionada.','error');continue;}
    let previewUrl='';
    try{
      $('avGpsStatus').className='gps-status';
      $('avGpsStatus').textContent=`Preparando foto ${avPhotos.length+1} e obtendo localização…`;
      const blob=await compressImage(file,1280,.76);
      previewUrl=URL.createObjectURL(blob);
      const gps=await captureGps();
      avPhotos.push({id:uuid(),blob,previewUrl,gps,sourceKey});
      renderAvariaPhotoGallery();
    }catch(err){
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      $('avGpsStatus').className='gps-status error';
      $('avGpsStatus').textContent=`Foto não adicionada: ${humanGpsError(err)}`;
    }
  }
}
function renderAvariaPhotoGallery(){
  const el=$('avPhotoGallery');
  $('avFotoCounter').textContent=`${avPhotos.length}/5 fotos`;
  if(!avPhotos.length){el.className='photo-gallery empty';el.innerHTML='<span>Nenhuma foto adicionada.</span>';$('avGpsStatus').className='gps-status';$('avGpsStatus').textContent='Adicione uma foto para capturar a localização.';return;}
  el.className='photo-gallery';
  el.innerHTML=avPhotos.map((p,i)=>`<div class="photo-thumb" data-photo-id="${esc(p.id)}"><img src="${esc(p.previewUrl)}" alt="Foto ${i+1}"><div><strong>Foto ${i+1}</strong><small>✓ GPS capturado • ±${Math.round(p.gps.accuracy||0)} m</small></div><button type="button" class="photo-remove" data-remove-photo="${esc(p.id)}" aria-label="Remover foto">×</button></div>`).join('');
  $('avGpsStatus').className='gps-status ok';
  $('avGpsStatus').textContent=`${avPhotos.length} foto(s) com localização capturada.`;
}
function onAvariaPhotoGalleryClick(e){
  const b=e.target.closest('[data-remove-photo]');if(!b)return;
  const id=b.dataset.removePhoto;const photo=avPhotos.find(p=>p.id===id);
  if(photo?.previewUrl&&!avariaEditingId)URL.revokeObjectURL(photo.previewUrl);
  avPhotos=avPhotos.filter(p=>p.id!==id);renderAvariaPhotoGallery();
}
function addAvariaItem(){
  const product=sanitizeRefText($('avProduto').value.trim()),lot=$('avLote').value.trim().toUpperCase(),quantity=num($('avQuantidade').value),unit=$('avUnidade').value,reason=$('avMotivo').value;
  if(!product||!lot||quantity<=0||!unit||!reason)return toast('Preencha produto, lote, quantidade, unidade e motivo.','error');
  if(!avPhotos.length)return toast('Adicione ao menos uma foto da avaria.','error');
  if(avPhotos.some(p=>!p.gps))return toast('Todas as fotos precisam ter localização GPS.','error');
  const id=avariaEditingId||uuid();
  const item={id,product,lot,quantity,unit,reason,photos:avPhotos.map(p=>({...p}))};
  const idx=avariaItems.findIndex(x=>x.id===id);
  if(idx>=0){
    const keep=new Set(item.photos.map(p=>p.previewUrl));
    (avariaItems[idx].photos||[]).forEach(p=>{if(p.previewUrl&&!keep.has(p.previewUrl))URL.revokeObjectURL(p.previewUrl);});
    avariaItems[idx]=item;
  }else avariaItems.push(item);
  renderAvariaItems();clearAvariaItemEditor(false);
}
function renderAvariaItems(){
  $('avItemCounter').textContent=`${avariaItems.length} produto(s)`;const el=$('avItemList');
  if(!avariaItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;}
  el.className='item-list';
  el.innerHTML=avariaItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product)}</strong></div><div class="info"><small>Lote</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)} ${esc(x.unit)}</strong></div><div class="info"><small>Motivo</small><strong>${esc(x.reason)}</strong></div><div class="info"><small>Evidências</small><strong>${x.photos.length} foto(s) • GPS ✓</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
}
function onAvariaItemListClick(e){
  const b=e.target.closest('button[data-act]');if(!b)return;const item=avariaItems.find(x=>x.id===b.closest('[data-id]').dataset.id);if(!item)return;
  if(b.dataset.act==='del'){(item.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);});avariaItems=avariaItems.filter(x=>x.id!==item.id);renderAvariaItems();return;}
  avariaEditingId=item.id;$('avProduto').value=item.product;$('avLote').value=item.lot;$('avQuantidade').value=item.quantity;$('avUnidade').value=item.unit;$('avMotivo').value=item.reason;
  avPhotos=(item.photos||[]).map(p=>({...p}));renderAvariaPhotoGallery();$('btnAdicionarAvItem').textContent='Salvar alteração';$('btnCancelarAvItem').classList.remove('hidden');
}
function clearAvariaItemEditor(revoke=true){
  avariaEditingId=null;
  if(revoke){const used=new Set(avariaItems.flatMap(x=>(x.photos||[]).map(p=>p.previewUrl)));avPhotos.forEach(p=>{if(p.previewUrl&&!used.has(p.previewUrl))URL.revokeObjectURL(p.previewUrl);});}
  avPhotos=[];['avProduto','avLote','avQuantidade','avMotivo'].forEach(id=>$(id).value='');$('avUnidade').value='UNIDADE';$('avFotoCamera').value='';$('avFotoArquivo').value='';renderAvariaPhotoGallery();$('btnAdicionarAvItem').textContent='+ Adicionar produto';$('btnCancelarAvItem').classList.add('hidden');
}
function clearAvariaRequest(){
  avariaItems.forEach(x=>(x.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);}));avariaItems=[];renderAvariaItems();clearAvariaItemEditor(false);$('avData').value=localIsoDate(new Date());$('avEntregador').value=profile?.name||'';['avPdv','avMapa'].forEach(id=>$(id).value='');$('avClienteNome').textContent='Digite um código';$('avClienteCodigo').textContent='—';$('avCidade').textContent='—';$('avMapaResumo').textContent='—';selectedCustomerKey='';$('avClienteEscolha').innerHTML='';$('avClienteDuplicado').classList.add('hidden');clearSignature();
}
async function submitAvaria(e){
  e.preventDefault();const customer=selectedCustomer();if(!customer)return toast(currentCustomerMatches().length>1?'Selecione qual cliente corresponde ao PDV informado.':'Informe um PDV válido.','error');if(!$('avMapa').value.trim())return toast('Informe o mapa.','error');if(!avariaItems.length)return toast('Adicione ao menos um produto avariado.','error');if(!signatureDirty)return toast('A assinatura do cliente é obrigatória.','error');const btn=$('btnSalvarAvaria');btn.disabled=true;btn.textContent='Enviando…';
  try{
    const reqKey=uuid();const sigBlob=await canvasBlob($('signatureCanvas'),.82);const signaturePath=`${authUser.id}/${reqKey}/assinatura.jpg`;await uploadStorage(signaturePath,sigBlob);
    const uploaded=[];
    for(let i=0;i<avariaItems.length;i++){
      const x=avariaItems[i],photos=[];
      for(let j=0;j<x.photos.length;j++){
        const p=x.photos[j],path=`${authUser.id}/${reqKey}/produto_${String(i+1).padStart(2,'0')}_foto_${String(j+1).padStart(2,'0')}.jpg`;
        await uploadStorage(path,p.blob);
        photos.push({photo_path:path,latitude:p.gps.latitude,longitude:p.gps.longitude,accuracy:p.gps.accuracy||'',gps_at:p.gps.capturedAt});
      }
      uploaded.push({...x,photos});
    }
    const payload={date:$('avData').value,customer_code:customer.code,customer_name:customer.name,city:customer.city,map_number:$('avMapa').value.trim(),signature_path:signaturePath,items:uploaded.map(x=>{const first=x.photos[0];return {product:x.product,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photos:x.photos,photo_path:first.photo_path,latitude:first.latitude,longitude:first.longitude,accuracy:first.accuracy,gps_at:first.gps_at};})};
    const {error}=await sb.rpc('create_damage_request',{p_payload:payload});if(error)throw error;toast('Avaria registrada com sucesso.','success');clearAvariaRequest();
  }catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar requisição';}
}
async function uploadStorage(path,blob){const {error}=await sb.storage.from('avarias').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
let adminAvarias=[];let lotNriMap=new Map();
async function loadAdminAvarias(silent=false){
  if(!isAdmin())return;
  try{
    const {data,error}=await sb.from('damage_requests').select('*,damage_items(*,damage_item_photos(*))').order('created_at',{ascending:false}).limit(1000);
    if(error)throw error;adminAvarias=data||[];
    const lots=[...new Set(adminAvarias.flatMap(r=>r.damage_items||[]).map(i=>String(i.lot||'').toUpperCase()).filter(Boolean))];lotNriMap=new Map();
    if(lots.length){for(const chunk of chunks(lots,100)){const q=await sb.from('nris').select('nri,lot,product_code,product_name,validity_date,unit').in('lot',chunk);if(q.error)throw q.error;(q.data||[]).forEach(n=>{const k=String(n.lot).toUpperCase();if(!lotNriMap.has(k))lotNriMap.set(k,[]);lotNriMap.get(k).push(n);});}}
    renderAdminAvarias();$('badgeAvarias').textContent=adminAvarias.filter(r=>['PENDENTE','PARCIAL'].includes(r.status)).length;
  }catch(e){if(!silent)toast(humanError(e),'error');}
}
function itemEvidencePhotos(i){
  const photos=[...(i.damage_item_photos||[])].sort((a,b)=>num(a.photo_order)-num(b.photo_order));
  if(photos.length)return photos;
  return i.photo_path?[{photo_order:1,photo_path:i.photo_path,latitude:i.latitude,longitude:i.longitude,gps_accuracy:i.gps_accuracy,gps_captured_at:i.gps_captured_at}]:[];
}
function filteredAdminAvarias(){const q=norm($('avAdminBusca').value),s=$('avAdminStatus').value;return adminAvarias.filter(r=>(!s||r.status===s)&&(!q||norm([r.customer_code,r.customer_name,r.city,r.delivery_name,r.map_number,...(r.damage_items||[]).flatMap(i=>[i.product_text,i.lot,i.reason])].join(' ')).includes(q)));}
function renderAdminAvarias(){
  const arr=filteredAdminAvarias();
  $('tbodyAvariasAdmin').innerHTML=arr.length?arr.map(r=>{const items=r.damage_items||[],matches=items.filter(i=>lotNriMap.has(String(i.lot).toUpperCase())).length,photos=items.reduce((n,i)=>n+itemEvidencePhotos(i).length,0);return `<tr><td>${fmtDate(r.occurrence_date)}<strong>PDV ${esc(r.customer_code)} • ${esc(r.customer_name)}</strong><small>${esc(r.city)} • Mapa ${esc(r.map_number)}</small></td><td>${esc(r.delivery_name)}</td><td><strong>${items.length} produto(s)</strong><small>${photos} foto(s)</small></td><td>${matches===items.length&&items.length?'<span class="status ok">Todos compatíveis</span>':matches?'<span class="status partial">Parcial</span>':'<span class="status bad">Não encontrados</span>'}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-id="${r.id}">Visualizar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhuma avaria.</td></tr>';
}
function onAdminAvariaClick(e){const b=e.target.closest('button[data-id]');if(!b)return;showAvariaDetail(b.dataset.id);}
async function showAvariaDetail(id){
  const r=adminAvarias.find(x=>x.id===id);if(!r)return;currentAvariaDetail=r;const items=r.damage_items||[];
  const paths=[r.signature_path,...items.flatMap(i=>itemEvidencePhotos(i).map(p=>p.photo_path))].filter(Boolean);
  const signedPairs=await Promise.all(paths.map(async path=>{const {data}=await sb.storage.from('avarias').createSignedUrl(path,3600);return [path,data?.signedUrl||''];}));
  const signed=new Map(signedPairs),signatureUrl=signed.get(r.signature_path)||'';
  const pending=items.filter(i=>i.status==='PENDENTE').length;
  const productsHtml=items.map((i,idx)=>{
    const match=lotNriMap.get(String(i.lot).toUpperCase())||[],photos=itemEvidencePhotos(i);
    const photoHtml=photos.map((p,pidx)=>`<div class="damage-photo-card"><div class="damage-photo-title"><strong>Foto ${pidx+1}</strong><span class="status ok">GPS ✓</span></div><img src="${esc(signed.get(p.photo_path)||'')}" alt="Foto ${pidx+1} da avaria"><iframe class="map-frame" src="https://www.google.com/maps?q=${encodeURIComponent(p.latitude+','+p.longitude)}&output=embed" loading="lazy"></iframe><small>GPS: ${p.latitude}, ${p.longitude} • ±${Math.round(p.gps_accuracy||0)} m</small></div>`).join('');
    return `<div class="damage-admin-item" data-item="${i.id}"><div class="damage-product-head"><label class="damage-check"><input type="checkbox" class="review-check" value="${i.id}" ${i.status==='PENDENTE'?'':'disabled'}><span></span></label><div><small>PRODUTO ${idx+1}</small><strong>${esc(i.product_text)}</strong></div>${statusBadge(i.status)}</div><div class="damage-summary-grid"><div><small>LOTE</small><strong>${esc(i.lot)}</strong></div><div><small>QUANTIDADE</small><strong>${fmtNum(i.quantity)} ${esc(i.quantity_unit)}</strong></div><div><small>MOTIVO</small><strong>${esc(i.reason)}</strong></div><div><small>EVIDÊNCIAS</small><strong>${photos.length} foto(s)</strong></div></div><div class="damage-lot-row">${match.length?`<span class="status ok">Lote compatível</span><span>${match.slice(0,4).map(n=>esc(n.nri)).join(', ')}</span>`:'<span class="status bad">Lote não encontrado</span>'}</div><details class="damage-evidence"><summary><span>Ver evidências</span><small>${photos.length} foto(s) • localização por foto</small></summary><div class="damage-photo-grid">${photoHtml||'<div class="empty-state">Sem foto disponível.</div>'}</div></details></div>`;
  }).join('');
  const body=`<div class="damage-request-hero"><div><small>OCORRÊNCIA</small><strong>PDV ${esc(r.customer_code)} · ${esc(r.customer_name)}</strong><span>${esc(r.city)} • Mapa ${esc(r.map_number)} • ${esc(r.delivery_name)}</span></div><div class="damage-counts"><b>${items.length}</b><span>produtos</span><b>${pending}</b><span>pendentes</span></div></div><div class="detail-grid damage-request-grid"><div class="detail-card"><small>PDV</small><strong>${esc(r.customer_name)}</strong></div><div class="detail-card"><small>Código</small><strong>${esc(r.customer_code)}</strong></div><div class="detail-card"><small>Cidade</small><strong>${esc(r.city)}</strong></div><div class="detail-card"><small>Mapa</small><strong>${esc(r.map_number)}</strong></div><div class="detail-card"><small>Motorista</small><strong>${esc(r.delivery_name)}</strong></div></div><div class="damage-selection-bar"><span id="avariaSelectionSummary">0 selecionados</span><small>Marque os produtos pendentes para aprovar ou reprovar.</small></div>${productsHtml}<details class="signature-details"><summary>Ver assinatura do cliente</summary><img src="${esc(signatureUrl)}" alt="Assinatura"></details>`;
  openModal(`Avaria • PDV ${r.customer_code}`,`${fmtDate(r.occurrence_date)} • ${r.delivery_name}`,body,[{label:'Reprovar selecionados',class:'danger',onClick:()=>reviewAvaria('REPROVADO',false)},{label:'Aprovar selecionados',class:'success',onClick:()=>reviewAvaria('APROVADO',false)},{label:'Aprovar todos pendentes',class:'primary',onClick:()=>reviewAvaria('APROVADO',true)}]);
  const updateSelection=()=>{const n=$('modalBody').querySelectorAll('.review-check:checked').length;const el=$('avariaSelectionSummary');if(el)el.textContent=`${n} selecionado${n===1?'':'s'}`;};
  $('modalBody').querySelectorAll('.review-check').forEach(c=>c.addEventListener('change',updateSelection));
}
async function reviewAvaria(status,all){if(!currentAvariaDetail)return;let ids;if(all)ids=(currentAvariaDetail.damage_items||[]).filter(i=>i.status==='PENDENTE').map(i=>i.id);else ids=[...$('modalBody').querySelectorAll('.review-check:checked')].map(x=>x.value);if(!ids.length)return toast('Selecione ao menos um produto pendente.','error');let note='';if(status==='REPROVADO'){const x=prompt('Observação da reprovação (opcional):','');if(x===null)return;note=x;}try{const {error}=await sb.rpc('review_damage_items',{p_item_ids:ids,p_status:status,p_note:note});if(error)throw error;toast(`${ids.length} produto(s) atualizado(s).`,'success');closeModal();await loadAdminAvarias(true);}catch(e){toast(humanError(e),'error');}}

// CONFERENCIA ----------------------------------------------------------------
function clearConferenceForm(){$('confMapa').value='';['confG300','confG600V','confG600M','confLitrao','confB30','confB50'].forEach(id=>$(id).value=0);}
async function submitConference(e){e.preventDefault();const map=normalizeCode($('confMapa').value);if(!map)return toast('Informe o mapa.','error');const p={p_map_number:map,p_g300:intVal('confG300'),p_g600_green:intVal('confG600V'),p_g600_brown:intVal('confG600M'),p_g_litrao:intVal('confLitrao'),p_keg30:intVal('confB30'),p_keg50:intVal('confB50')};const btn=e.submitter;btn.disabled=true;btn.textContent='Registrando…';try{const {error}=await sb.rpc('create_container_conference',p);if(error)throw error;toast('Conferência registrada.','success');clearConferenceForm();}catch(err){const m=String(err.message||'');toast(m.includes('duplicate key')?'Este mapa já possui conferência na data de hoje.':humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar conferência';}}
let myConferences=[];async function loadMyConferences(silent=false){try{const {data,error}=await sb.from('container_conferences').select('*').eq('checker_id',authUser.id).order('created_at',{ascending:false}).limit(1000);if(error)throw error;myConferences=data||[];renderMyConferences();}catch(e){if(!silent)toast(humanError(e),'error');}}
function renderMyConferences(){const m=normalizeCode($('minhasMapa').value),d=$('minhasData').value;const arr=myConferences.filter(x=>(!m||x.map_number.includes(m))&&(!d||x.conference_date===d));$('tbodyMinhas').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)} ${fmtTime(x.conference_time)}</td><td>${esc(x.map_number)}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="8">Nenhuma conferência.</td></tr>';}
async function loadConferenceHistory(){if(!isAdmin())return;try{const [c,m]=await Promise.all([sb.from('container_conferences').select('*').order('created_at',{ascending:false}).limit(3000),sb.from('maps').select('*').order('map_date',{ascending:false}).limit(5000)]);if(c.error)throw c.error;if(m.error)throw m.error;allConferences=c.data||[];allMaps=m.data||[];renderConferenceHistory();}catch(e){toast(humanError(e),'error');}}
function mapNumberKey(map){return normalizeCode(map);}
function latestMapIndexByNumber(rows=allMaps){const idx=new Map();for(const m of rows){const k=mapNumberKey(m.map_number);if(!k)continue;const prev=idx.get(k);if(!prev||String(m.map_date||'')>String(prev.map_date||''))idx.set(k,m);}return idx;}
function latestConferenceIndexByNumber(rows=allConferences){const idx=new Map();for(const c of rows){const k=mapNumberKey(c.map_number);if(!k)continue;const prev=idx.get(k);const curStamp=String(c.created_at||c.conference_date||'');const prevStamp=String(prev?.created_at||prev?.conference_date||'');if(!prev||curStamp>prevStamp)idx.set(k,c);}return idx;}
function enrichedConferenceRows(){const mapIndex=latestMapIndexByNumber();return allConferences.map(c=>({...c,map:mapIndex.get(mapNumberKey(c.map_number))||null}));}
function filteredConferenceHistory(){const map=normalizeCode($('histConfMapa').value),name=norm($('histConfConferente').value),de=$('histConfDe').value,ate=$('histConfAte').value;return enrichedConferenceRows().filter(x=>(!map||x.map_number.includes(map))&&(!name||norm(x.checker_name).includes(name))&&(!de||x.conference_date>=de)&&(!ate||x.conference_date<=ate));}
function renderConferenceHistory(){const arr=filteredConferenceHistory();$('tbodyHistConf').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)}</td><td>${fmtTime(x.conference_time)}</td><td>${esc(x.checker_name)}</td><td>${esc(x.map_number)}</td><td>${esc(x.map?.city||'—')}</td><td>${esc(x.map?.driver||'—')}</td><td>${esc(x.map?.helper1||'—')}</td><td>${esc(x.map?.helper2||'—')}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="14">Nenhum registro.</td></tr>';}
function exportConferenceCsv(){const arr=filteredConferenceHistory();const headers=['Data','Hora','Conferente','Mapa','Cidade','Motorista','Ajudante 1','Ajudante 2','Garrafeiras de 300ml','Garrafeiras de 600ml Verde','Garrafeiras de 600ml Marrom','Garrafeiras de Litrão','Barris de Chopp 30L','Barris de Chopp 50L'];const rows=arr.map(x=>[fmtDate(x.conference_date),fmtTime(x.conference_time),x.checker_name,x.map_number,x.map?.city||'',x.map?.driver||'',x.map?.helper1||'',x.map?.helper2||'',x.g300,x.g600_green,x.g600_brown,x.g_litrao,x.keg30,x.keg50]);downloadCsv('historico_conferencias.csv',[headers,...rows]);}

let dashboardRows=[];
async function loadDashboard(silent=false){
  if(!isAdmin())return;
  try{
    const [m,c]=await Promise.all([
      sb.from('maps').select('*').order('map_date',{ascending:false}).limit(5000),
      sb.from('container_conferences').select('*').order('created_at',{ascending:false}).limit(5000)
    ]);
    if(m.error)throw m.error;if(c.error)throw c.error;allMaps=m.data||[];allConferences=c.data||[];buildDashboardRows();renderDashboard();
  }catch(e){if(!silent)toast(humanError(e),'error');}
}
function updateDashboardPeriod(){
  const specific=$('dashPeriodo').value==='DATA';$('dashData').disabled=!specific;
  if(!specific)$('dashData').value='';
}
function clearDashboardFilters(){
  $('dashPeriodo').value='TODAS';$('dashData').value='';$('dashMapa').value='';$('dashCidade').value='';updateDashboardPeriod();renderDashboard();
}
function buildDashboardRows(){
  const mapIndex=latestMapIndexByNumber(allMaps);
  dashboardRows=allConferences.map(c=>compareMap(mapIndex.get(mapNumberKey(c.map_number))||null,c)).sort((a,b)=>String(b.display_date||'').localeCompare(String(a.display_date||''))||String(b.conference?.created_at||'').localeCompare(String(a.conference?.created_at||'')));
}
function compareMap(m,c){
  const comparable=!!(m&&c),diffs={};let pos=0,neg=0,divCount=0;
  for(const t of VALUE_TYPES){
    const plan=m?num(m[t.key]):null,actual=c?num(c[t.key]):null,diff=comparable?actual-plan:0,value=comparable?Math.abs(diff)*t.value:0;
    diffs[t.key]={...t,plan,actual,diff,value};if(comparable&&diff>0)pos+=value;if(comparable&&diff<0)neg+=value;if(comparable&&diff!==0)divCount++;
  }
  const mapNumber=m?.map_number||c?.map_number||'';
  return {key:String(c?.id||mapKey(mapNumber,c?.conference_date||m?.map_date||'')),map_number:mapNumber,map_date:m?.map_date||'',source_map_date:m?.map_date||'',conference_date:c?.conference_date||'',display_date:m?.map_date||c?.conference_date||'',city:m?.city||'',driver:m?.driver||'',helper1:m?.helper1||'',helper2:m?.helper2||'',conference:c,diffs,pos,neg,divCount,status:!m?'SEM_BASE':divCount?'DIVERGENTE':'OK'};
}
function filteredDashboard(){
  const map=normalizeCode($('dashMapa').value),city=norm($('dashCidade').value),dateMode=$('dashPeriodo').value,date=$('dashData').value;
  return dashboardRows.filter(x=>(dateMode!=='DATA'||!date||x.display_date===date)&&(!map||x.map_number.includes(map))&&(!city||norm(x.city).includes(city)));
}
function shortCityLabel(city){const parts=String(city||'').split(',').map(x=>x.trim()).filter(Boolean);if(!parts.length)return '—';return parts.length===1?parts[0]:`${parts[0]} +${parts.length-1} cidade${parts.length-1===1?'':'s'}`;}
function renderDashboard(){
  const arr=filteredDashboard(),ok=arr.filter(x=>x.status==='OK').length,div=arr.filter(x=>x.status==='DIVERGENTE').length,noBase=arr.filter(x=>x.status==='SEM_BASE').length,pos=arr.reduce((s,x)=>s+(x.status==='DIVERGENTE'?x.pos:0),0),neg=arr.reduce((s,x)=>s+(x.status==='DIVERGENTE'?x.neg:0),0);
  $('kpiConferencias').textContent=arr.length;$('kpiSemDiferenca').textContent=ok;$('kpiDivergentes').textContent=div;$('kpiSemBase').textContent=noBase;$('kpiPositivo').textContent=money(pos);$('kpiNegativo').textContent=money(neg);
  $('tbodyDashboard').innerHTML=arr.length?arr.map(x=>`<tr class="dashboard-row" data-key="${esc(x.key)}"><td>${fmtDate(x.display_date)}<strong>Mapa ${esc(x.map_number)}</strong><small>${x.status==='SEM_BASE'?'Sem data de rota na base':`Data da rota${x.conference_date&&x.conference_date!==x.display_date?` • conferido em ${fmtDate(x.conference_date)}`:''}`}</small></td><td title="${esc(x.city||'')}">${esc(shortCityLabel(x.city))}</td><td>${esc(x.driver||'—')}<small>${esc([x.helper1,x.helper2].filter(Boolean).join(' • ')||'—')}</small></td><td>${esc(x.conference?.checker_name||'—')}</td><td>${dashStatus(x.status)}</td><td>${x.status==='SEM_BASE'?'—':x.divCount}</td><td><button class="mini-btn" data-key="${esc(x.key)}">Detalhar</button></td></tr>`).join(''):'<tr><td colspan="7">Nenhuma conferência encontrada.</td></tr>';
  renderRanking(arr);
}
function renderRanking(arr){const drivers=new Map(),helpers=new Map();arr.filter(x=>x.status==='DIVERGENTE').forEach(x=>{accRank(drivers,x.driver,x);const unique=new Set([x.helper1,x.helper2].map(s=>String(s||'').trim()).filter(Boolean));unique.forEach(h=>accRank(helpers,h,x));});renderRankTable('rankMotoristas',drivers);renderRankTable('rankAjudantes',helpers);}
function accRank(map,name,row){name=String(name||'').trim();if(!name)return;const x=map.get(name)||{name,maps:new Set(),pos:0,neg:0};x.maps.add(row.key);x.pos+=row.pos;x.neg+=row.neg;map.set(name,x);}
function renderRankTable(id,map){const arr=[...map.values()].sort((a,b)=>(b.neg-a.neg)||(b.maps.size-a.maps.size)||(b.pos-a.pos));$(id).innerHTML=arr.length?arr.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.name)}</strong></td><td>${x.maps.size}</td><td class="value-positive">${money(x.pos)}</td><td class="value-negative">${money(x.neg)}</td></tr>`).join(''):'<tr><td colspan="5">Sem divergências.</td></tr>';}
function onDashboardClick(e){const target=e.target.closest('[data-key]');if(!target)return;const row=dashboardRows.find(x=>x.key===target.dataset.key);if(row)showDashboardDetail(row);}
function showDashboardDetail(r){
  if(r.status==='SEM_BASE'){
    const actualRows=VALUE_TYPES.map(t=>`<tr><td><strong>${esc(t.label)}</strong></td><td>${r.diffs[t.key].actual??0}</td></tr>`).join('');
    const body=`<div class="notice"><strong>Conferência sem base MAPAS.</strong> Não existe cálculo de diferença até que o mapa esteja cadastrado na base. Os valores abaixo são apenas o que foi conferido.</div><div class="detail-grid" style="margin-top:12px"><div class="detail-card"><small>Conferente</small><strong>${esc(r.conference?.checker_name||'—')}</strong></div><div class="detail-card"><small>Data da conferência</small><strong>${fmtDate(r.conference_date)}</strong></div></div><table class="detail-table"><thead><tr><th>Vasilhame</th><th>Conferido</th></tr></thead><tbody>${actualRows}</tbody></table>`;
    return openModal(`Mapa ${r.map_number}`,'Sem base MAPAS',body,[]);
  }
  const rows=VALUE_TYPES.map(t=>{const d=r.diffs[t.key],cls=d.diff>0?'value-positive':d.diff<0?'value-negative':'value-zero';return `<tr><td><strong>${esc(t.label)}</strong></td><td>${d.plan}</td><td>${d.actual}</td><td class="${cls}">${d.diff>0?'+':''}${d.diff}</td><td class="${cls}">${money(d.value)}</td></tr>`;}).join('');
  const dateInfo=`Data da rota: ${fmtDate(r.source_map_date)}${r.conference_date?` • Conferido em: ${fmtDate(r.conference_date)}`:''} • ${r.city||'—'}`;
  const body=`<div class="detail-grid"><div class="detail-card"><small>Motorista</small><strong>${esc(r.driver||'—')}</strong></div><div class="detail-card"><small>Ajudante 1</small><strong>${esc(r.helper1||'—')}</strong></div><div class="detail-card"><small>Ajudante 2</small><strong>${esc(r.helper2||'—')}</strong></div><div class="detail-card"><small>Conferente</small><strong>${esc(r.conference?.checker_name||'—')}</strong></div></div><table class="detail-table"><thead><tr><th>Vasilhame</th><th>Planilha</th><th>Conferido</th><th>Diferença</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table><div class="detail-grid" style="margin-top:12px"><div class="detail-card"><small>Valor total em divergências positivas</small><strong class="value-positive">${money(r.pos)}</strong></div><div class="detail-card"><small>Valor total em divergências negativas</small><strong class="value-negative">${money(r.neg)}</strong></div></div>`;
  openModal(`Mapa ${r.map_number}`,dateInfo,body,[]);
}

// USERS ----------------------------------------------------------------------
let users=[];async function loadUsers(){if(!isAdmin())return;try{const {data,error}=await sb.from('profiles').select('*').order('name');if(error)throw error;users=data||[];renderUsers();}catch(e){toast(humanError(e),'error');}}
function renderUsers(){$('tbodyUsuarios').innerHTML=users.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(ROLE_LABELS[u.role]||u.role)}</td><td>${u.active?'<span class="status ok">Ativo</span>':'<span class="status bad">Inativo</span>'}</td><td><button class="mini-btn" data-user="${esc(u.username)}">Editar</button></td></tr>`).join('');}
function onUserTableClick(e){const b=e.target.closest('button[data-user]');if(!b)return;const u=users.find(x=>x.username===b.dataset.user);if(!u)return;$('usuarioOriginal').value=u.username;$('usuarioLogin').value=u.username;$('usuarioNome').value=u.name;$('usuarioPerfil').value=u.role==='CONFERENTE'?'COLABORADOR_ARMAZEM':u.role;$('usuarioSenha').value='';$('usuarioAtivo').checked=u.active;}
function clearUserForm(){$('usuarioOriginal').value='';$('usuarioLogin').value='';$('usuarioNome').value='';$('usuarioPerfil').value='COLABORADOR_ARMAZEM';$('usuarioSenha').value='';$('usuarioAtivo').checked=true;}
async function saveUser(e){
  e.preventDefault();
  const original=$('usuarioOriginal').value.trim();
  const body={action:original?'update':'create',originalUsername:original,username:$('usuarioLogin').value,name:$('usuarioNome').value,role:$('usuarioPerfil').value,password:$('usuarioSenha').value,active:$('usuarioAtivo').checked};
  if(!body.username.trim()||!body.name.trim())return toast('Informe usuário e nome.','error');
  if(!original&&body.password.length<6)return toast('A senha do novo usuário deve ter pelo menos 6 caracteres.','error');
  const btn=e.submitter;btn.disabled=true;btn.textContent='Salvando…';
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Sua sessão expirou. Saia do sistema e entre novamente.');
    const {data,error}=await sb.functions.invoke('admin-users',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
    if(error){
      let detail='';
      try{
        if(error.context&&typeof error.context.clone==='function'){
          const response=error.context.clone();
          try{const parsed=await response.json();detail=parsed?.error||parsed?.message||parsed?.code||'';}catch(_jsonErr){detail=await response.text().catch(()=> '');}
        }
      }catch(_e){}
      if(detail)throw new Error(detail);
      const msg=String(error.message||error);
      if(/Failed to send a request|fetch|FunctionFetchError/i.test(msg))throw new Error('A função admin-users não está acessível no Supabase. Republique a Edge Function.');
      throw new Error(msg);
    }
    if(data?.ok===false)throw new Error(data.error||'Falha ao salvar usuário.');
    toast(data?.repaired?'Usuário recuperado e salvo com sucesso.':'Usuário salvo.','success');
    clearUserForm();await loadUsers();
  }catch(err){toast(humanUserAdminError(err),'error');}
  finally{btn.disabled=false;btn.textContent='Salvar usuário';}
}
function humanUserAdminError(e){
  const m=String(e?.message||e||'Erro desconhecido');
  if(/FORBIDDEN/i.test(m))return 'Seu usuário não está com perfil ADMIN ativo no Supabase.';
  if(/AUTH_|JWT|sessão|session/i.test(m))return 'Sua sessão não foi validada pela função. Saia do Disb Gestão, entre novamente e tente de novo. Detalhe: '+m;
  if(/SENHA_MIN_6/i.test(m))return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/PERFIL_INVALIDO/i.test(m))return 'Perfil de usuário inválido.';
  if(/USUARIO_JA_EXISTE|already been registered|already exists|duplicate/i.test(m))return 'Esse usuário já existe. Tente editar o cadastro existente.';
  return m;
}

// IMPORT ---------------------------------------------------------------------
async function importBaseCsv(){if(!isAdmin())return;const file=$('importFile').files?.[0];if(!file)return toast('Selecione um arquivo CSV.','error');const type=$('importTipo').value;const out=$('importResult');out.textContent='Lendo arquivo…';try{const text=await readCsvFileText(file);const rows=parseCsvObjects(text);if(!rows.length)throw new Error('O arquivo não possui registros.');const normalized=dedupeImport(type,normalizeImport(type,rows));out.textContent=`${normalized.length} linhas reconhecidas. Enviando…`;let done=0;for(const chunk of chunks(normalized,300)){let res;if(type==='maps')res=await sb.from('maps').upsert(chunk,{onConflict:'map_number,map_date'});else if(type==='nris')res=await sb.from('nris').upsert(chunk,{onConflict:'nri'});else if(type==='conferences')res=await sb.from('container_conferences').upsert(chunk,{onConflict:'map_number,conference_date'});else res=await sb.from(type).upsert(chunk,{onConflict:importConflict(type)});if(res.error)throw res.error;done+=chunk.length;out.textContent=`Importados ${done}/${normalized.length}…`;}
    if(type==='nris'){const x=await sb.rpc('sync_nri_sequence');if(x.error)throw x.error;}out.textContent=`Concluído: ${done} registros importados.`;toast('Importação concluída.','success');localStorage.removeItem('ops_ref_cache');if(['products','units','shifts','drivers','factories','customers'].includes(type))await loadReferences(false);
  }catch(e){out.textContent=`Erro: ${humanError(e)}`;toast(humanError(e),'error');}}
function importConflict(type){return ({products:'code',units:'name',shifts:'name',drivers:'name',factories:'name',customers:'code,branch'})[type];}
function dedupeImport(type,rows){
  const fields=String(importConflict(type)||'').split(',').filter(Boolean);
  if(!fields.length)return rows;
  const m=new Map();
  rows.forEach(r=>{const k=fields.map(f=>String(r[f]??'').trim().toLowerCase()).join('||');m.set(k,r);});
  return [...m.values()];
}
function normalizeImport(type,rows){const h=(r,...aliases)=>{for(const a of aliases){const k=Object.keys(r).find(k=>normHeader(k)===normHeader(a));if(k!==undefined)return r[k];}return '';};if(type==='products')return rows.map(r=>({code:String(h(r,'Código','Codigo','Code')).trim(),name:sanitizeRefText(h(r,'Nome','Produto','Descrição','Descricao'))})).filter(x=>x.code&&x.name);if(type==='units')return rows.map(r=>({name:sanitizeRefText(h(r,'Unidade','Nome'))})).filter(x=>x.name);if(type==='shifts')return rows.map(r=>({name:sanitizeRefText(h(r,'Turno','Nome'))})).filter(x=>x.name);if(type==='drivers')return rows.map(r=>({name:sanitizeRefText(h(r,'Motorista','Nome'))})).filter(x=>x.name);if(type==='factories')return rows.map(r=>({name:sanitizeRefText(h(r,'Fábrica','Fabrica','Nome'))})).filter(x=>x.name);if(type==='customers')return rows.map(r=>({code:normalizeCode(h(r,'Código PDV','Cód PDV','Codigo PDV','Código','Codigo')),name:sanitizeRefText(h(r,'Nome','Nome Fantasia','Cliente','Razão Social','Razao Social')),city:sanitizeRefText(h(r,'Cidade')),branch:sanitizeRefText(h(r,'Filial'))})).filter(x=>x.code&&x.name);if(type==='maps')return rows.map(r=>({map_number:normalizeCode(h(r,'MAPAS','MAPA')),map_date:parseAnyDate(h(r,'DATA')),city:sanitizeRefText(h(r,'CIDADE')),driver:sanitizeRefText(h(r,'MOTORISTA')),helper1:sanitizeRefText(h(r,'AJUDANTE 1')),helper2:sanitizeRefText(h(r,'AJUDANTE 2')),g300:num(h(r,'GARRAFEIRAS DE 300ML')),g600_green:num(h(r,'GARRAFEIRAS DE 600 ML VERDE','GARRAFEIRAS DE 600ML VERDE')),g600_brown:num(h(r,'GARRAFEIRAS DE 600ML MARROM','GARRAFEIRAS DE 600 ML MARROM')),g_litrao:num(h(r,'GARRAFEIRAS DE LITRÃO','GARRAFEIRAS DE LITRAO')),keg30:num(h(r,'BARRIS DE CHOPP 30L')),keg50:num(h(r,'BARRIS DE CHOPP 50L'))})).filter(x=>x.map_number&&x.map_date);if(type==='nris')return rows.map(r=>({nri:String(h(r,'NRI')).trim(),request_id:null,product_code:String(h(r,'Código Produto','Codigo Produto')).trim(),product_name:sanitizeRefText(h(r,'Nome Produto','Produto')),unit:sanitizeRefText(h(r,'Unidade')),request_type:String(h(r,'Tipo')||'AMBEV').trim().toUpperCase()==='MARKETPLACE'?'MARKETPLACE':'AMBEV',validity_date:/sem\s*validade/i.test(String(h(r,'Validade')||''))?null:parseAnyDate(h(r,'Validade')),lot:String(h(r,'Lote')).trim().toUpperCase(),receipt_date:parseAnyDate(h(r,'Recebimento')),block_date:parseAnyDate(h(r,'Bloqueio')),checker_name:sanitizeRefText(h(r,'Conferente')),shift:sanitizeRefText(h(r,'Turno')),receipt_time:normalizeTime(h(r,'Hora')),driver:sanitizeRefText(h(r,'Motorista')),plate:String(h(r,'Placa')).trim().toUpperCase(),factory:sanitizeRefText(h(r,'Fábrica','Fabrica')),quantity:num(h(r,'Quantidade','Caixas')),status:String(h(r,'Status')||'PENDENTE').trim().toUpperCase(),created_by:null,created_by_username:sanitizeRefText(h(r,'Usuário Cadastro','Usuario Cadastro')),created_by_name:sanitizeRefText(h(r,'Nome Usuário Cadastro','Nome Usuario Cadastro')),created_at:parseAnyDateTime(h(r,'Criado em ISO','Criado em'))||new Date().toISOString(),printed_at:parseAnyDateTime(h(r,'Impresso em'))||null,removed_at:parseAnyDateTime(h(r,'Removido em'))||null})).filter(x=>x.nri&&x.product_code);if(type==='conferences')return rows.map(r=>({conference_date:parseAnyDate(h(r,'Data')),conference_time:normalizeTime(h(r,'Hora')),checker_id:null,checker_username:sanitizeRefText(h(r,'Conferente Usuário','Conferente Usuario')),checker_name:sanitizeRefText(h(r,'Conferente Nome','Conferente')),map_number:normalizeCode(h(r,'Mapa')),g300:num(h(r,'Garrafeiras de 300ml')),g600_green:num(h(r,'Garrafeiras de 600ml Verde')),g600_brown:num(h(r,'Garrafeiras de 600ml Marrom')),g_litrao:num(h(r,'Garrafeiras de Litrão','Garrafeiras de Litrao')),keg30:num(h(r,'Barris de Chopp 30L')),keg50:num(h(r,'Barris de Chopp 50L')),created_at:parseAnyDateTime(h(r,'Criado em ISO','Data/Hora'))||new Date().toISOString()})).filter(x=>x.conference_date&&x.map_number);return [];}

// MODAL / HELPERS ------------------------------------------------------------
function openModal(title,subtitle,body,actions=[]){$('modalTitle').textContent=title;$('modalSubtitle').textContent=subtitle||'';$('modalBody').innerHTML=body||'';const a=$('modalActions');a.innerHTML='';actions.forEach(x=>{const b=document.createElement('button');b.className=`btn ${x.class||'secondary'}`;b.textContent=x.label;b.addEventListener('click',x.onClick);a.appendChild(b);});$('modal').classList.add('open');}
function closeModal(){$('modal').classList.remove('open');$('modalBody').onchange=null;$('modalBody').innerHTML='';$('modalActions').innerHTML='';}
function statusBadge(s){const cls=s==='IMPRESSO'||s==='APROVADO'?'ok':s==='REPROVADO'||s==='REMOVIDO'?'bad':s==='PARCIAL'?'partial':'pending';return `<span class="status ${cls}">${esc(s)}</span>`;}
function dashStatus(s){return s==='OK'?'<span class="status ok">Sem diferença</span>':s==='DIVERGENTE'?'<span class="status bad">Com diferença</span>':'<span class="status pending">Sem base MAPAS</span>';}
function toast(msg,type=''){const t=$('toast');t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3600);}
function humanError(e){const m=String(e?.message||e?.error_description||e||'Erro desconhecido');if(m.includes('FORBIDDEN'))return 'Seu perfil não possui permissão para esta ação.';if(m.includes('JWT'))return 'Sua sessão expirou. Entre novamente.';if(m.includes('Failed to fetch'))return 'Falha de conexão. Verifique a internet.';return m;}
function humanGpsError(e){const code=e?.code;const msg=String(e?.message||e||'erro ao obter localização.');if(code===1||/PERMISSAO_LOCALIZACAO_NEGADA|permission denied|permission/i.test(msg))return 'permissão de localização não concedida. No Android, abra Configurações > Apps > Disb Gestão > Permissões > Localização e permita durante o uso.';if(code===2)return 'localização indisponível no aparelho.';if(code===3)return 'tempo esgotado ao obter GPS.';return msg;}
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
function getCapacitorGeolocation(){const cap=window.Capacitor; if(!cap) return null; return cap.Plugins?.Geolocation || (typeof cap.registerPlugin==='function'?cap.registerPlugin('Geolocation'):null);}
function isNativeCapacitor(){try{return !!window.Capacitor&&(typeof window.Capacitor.isNativePlatform==='function'?window.Capacitor.isNativePlatform():window.Capacitor.getPlatform?.()!=='web');}catch{return false;}}
function locationGranted(p){return ['granted','limited'].includes(String(p?.location||'').toLowerCase())||['granted','limited'].includes(String(p?.coarseLocation||'').toLowerCase());}
async function ensureAvariaLocationPermission(){
  if(!isNativeCapacitor())return true;
  const geo=getCapacitorGeolocation();if(!geo)return false;
  try{
    let p=typeof geo.checkPermissions==='function'?await geo.checkPermissions():null;
    if(!locationGranted(p)&&typeof geo.requestPermissions==='function')p=await geo.requestPermissions();
    if(locationGranted(p)){$('avGpsStatus').className='gps-status ok';$('avGpsStatus').textContent='Permissão de localização concedida. O GPS será capturado junto com a foto.';return true;}
    $('avGpsStatus').className='gps-status error';$('avGpsStatus').textContent='Permissão de localização não concedida. Autorize Localização nas permissões do Disb Gestão.';return false;
  }catch(e){console.warn('Falha ao solicitar permissão de localização',e);return false;}
}
async function captureGps(){
  const capGeo=getCapacitorGeolocation();
  if(capGeo&&isNativeCapacitor()){
    let permissions=typeof capGeo.checkPermissions==='function'?await capGeo.checkPermissions():null;
    if(!locationGranted(permissions)&&typeof capGeo.requestPermissions==='function')permissions=await capGeo.requestPermissions();
    if(!locationGranted(permissions))throw new Error('PERMISSAO_LOCALIZACAO_NEGADA');
    const pos=await capGeo.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0});
    return {latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,capturedAt:new Date(pos.timestamp||Date.now()).toISOString()};
  }
  return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS indisponível'));navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),err=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),reject,{enableHighAccuracy:false,timeout:10000,maximumAge:15000}),{enableHighAccuracy:true,timeout:14000,maximumAge:0});});
}
function compressImage(file,max,quality){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;if(Math.max(w,h)>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('Falha ao processar foto.'));},'image/jpeg',quality);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem inválida.'));};img.src=url;});}
function setupSignatureCanvas(){const c=$('signatureCanvas'),ctx=c.getContext('2d');ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#17202a';const pos=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};};c.addEventListener('pointerdown',e=>{drawingSignature=true;signatureDirty=true;c.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});c.addEventListener('pointermove',e=>{if(!drawingSignature)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});['pointerup','pointercancel','pointerleave'].forEach(ev=>c.addEventListener(ev,()=>drawingSignature=false));}
function clearSignature(){const c=$('signatureCanvas');c.getContext('2d').clearRect(0,0,c.width,c.height);signatureDirty=false;}
function canvasBlob(c,q){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Falha ao gerar assinatura.')),'image/jpeg',q));}

async function readCsvFileText(file){
  const buf=await file.arrayBuffer();
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(buf);
  }catch(_){
    try{return new TextDecoder('windows-1252').decode(buf);}catch(__){return new TextDecoder('iso-8859-1').decode(buf);}
  }
}
function parseCsvObjects(text){text=String(text||'').replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0]||'';const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';const matrix=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quote){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quote=false;else cell+=ch;}else{if(ch==='"')quote=true;else if(ch===delim){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));matrix.push(row);row=[];cell='';}else cell+=ch;}}if(cell||row.length){row.push(cell.replace(/\r$/,''));matrix.push(row);}const headers=(matrix.shift()||[]).map(x=>x.trim());return matrix.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
function downloadCsv(name,matrix){const csv='\uFEFF'+matrix.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

})();
