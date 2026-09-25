(() => {
'use strict';

const CFG = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const TZ = 'America/Fortaleza';
const ROLE_LABELS = {
  ADMIN:'Admin',
  COLABORADOR_ARMAZEM:'Colaborador Armazém / Conferente',
  COLABORADOR_ENTREGA:'Motorista',
  CONFERENTE:'Colaborador Armazém / Conferente',
  MOTORISTA_PUXADOR:'Motorista Puxador',
  VENDEDOR:'Vendedor',
  GERENTE_VENDAS:'Gerente de Vendas'
};

const PERMISSION_CATALOG = [
  ['NRI','NRI_PENDING_VIEW','Recebimentos e impressões pendentes'],['NRI','MARKETPLACE_RECEIVE','Recebimento Marketplace'],['NRI','NRI_CREATE','Cadastrar NRI'],['NRI','NRI_PRINT','Imprimir NRI'],['NRI','NRI_HISTORY','Histórico NRI'],['NRI','NRI_DAMAGE_HISTORY','Paletes avariados'],
  ['Avarias de Entrega','DELIVERY_DAMAGE_CREATE','Registrar avaria'],['Avarias de Entrega','DELIVERY_DAMAGE_VIEW_ALL','Visualizar todas'],['Avarias de Entrega','DELIVERY_DAMAGE_REVIEW','Aprovar / reprovar'],['Avarias de Entrega','DELIVERY_DAMAGE_POST','Lançar / entregar'],
  ['Avarias de Vendas','SALES_DAMAGE_CREATE','Cadastrar solicitação'],['Avarias de Vendas','SALES_DAMAGE_VIEW_OWN','Visualizar próprias'],['Avarias de Vendas','SALES_DAMAGE_VIEW_ALL','Visualizar todas'],['Avarias de Vendas','SALES_DAMAGE_REVIEW','Decisão do Gerente de Vendas'],['Avarias de Vendas','SALES_DAMAGE_OVERRIDE','Decisão final'],['Avarias de Vendas','SALES_DAMAGE_POST','Marcar avaria lançada'],
  ['Notificações','DAMAGE_NOTIFICATION','Notificação avaria'],
  ['Conferência','CONF_CREATE','Realizar conferência'],['Conferência','CONF_OWN_HISTORY','Minhas conferências'],['Conferência','CONF_HISTORY','Histórico completo'],['Conferência','CONF_DASHBOARD','Dashboard'],
  ['Contagem FEFO','FEFO_CREATE','Nova contagem'],['Contagem FEFO','FEFO_ACTIVE','Contagens em andamento'],['Contagem FEFO','FEFO_REPORT','Relatórios'],
  ['Puxada','PULL_TRIP','Viagem'],['Puxada','PULL_FAROL','Farol de andamento'],['Puxada','PULL_HISTORY','Histórico'],['Puxada','PULL_DASHBOARD','Dashboards'],['Puxada','PULL_GOALS','Metas'],['Puxada','PULL_CONFIG','Configurações'],['Puxada','PULL_TMA_ADJUST','Ajustar TMA'],
  ['Administração','ADMIN_USERS','Usuários e permissões'],['Administração','ADMIN_BASES','Bases / importação']
].map(([module,code,name],sort)=>({module,code,name,sort}));

const ROLE_PERMISSION_DEFAULTS = {
  ADMIN:PERMISSION_CATALOG.filter(x=>x.code!=='DAMAGE_NOTIFICATION').map(x=>x.code),
  COLABORADOR_ARMAZEM:['NRI_PENDING_VIEW','MARKETPLACE_RECEIVE','NRI_CREATE','NRI_PRINT','CONF_CREATE','CONF_OWN_HISTORY','FEFO_CREATE','FEFO_ACTIVE','FEFO_REPORT'],
  CONFERENTE:['NRI_PENDING_VIEW','MARKETPLACE_RECEIVE','NRI_CREATE','NRI_PRINT','CONF_CREATE','CONF_OWN_HISTORY','FEFO_CREATE','FEFO_ACTIVE','FEFO_REPORT'],
  COLABORADOR_ENTREGA:['DELIVERY_DAMAGE_CREATE'],
  MOTORISTA_PUXADOR:['PULL_TRIP'],
  VENDEDOR:['SALES_DAMAGE_CREATE','SALES_DAMAGE_VIEW_OWN'],
  GERENTE_VENDAS:['SALES_DAMAGE_CREATE','SALES_DAMAGE_VIEW_OWN','SALES_DAMAGE_VIEW_ALL','SALES_DAMAGE_REVIEW']
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
let myUnits = [];
let activeUnit = '';
let userUnitRows = [];
let userUnitAuditRows = [];
let myPermissions = new Set();
let permissionRows = [];
let rolePermissionRows = [];
let userPermissionRows = [];
let refs = {products:[],units:[],drivers:[],factories:[],customers:[]};
let productsByCode = new Map();
let customersByCode = new Map();
let selectedCustomerKey = '';
let nriDraftItems = [];
let nriPullLocked = false;
let nriMarketplaceLocked = false;
let nriDamageMode = false;
let nriDamagePhotos = [];
let marketplaceSuppliers = [];
let marketplaceActiveReceipt = null;
let marketplaceClockTimer = null;
let marketplaceDashboardReceipts = [];
let nriDamageIndex = new Map();
let nriDamageHistoryRows = [];
let nriEditingId = null;
let pendingNris = [];
let selectedNris = new Set();
let printOperation = null;
let historyNris = [];
let avariaItems = [];
let avariaEditingId = null;
let avPhotos = [];
let deliveryDamageSelectedProduct = null;
let deliveryDamageProductActiveIndex = -1;
let deliveryDamageProductSearchTimer = null;
let signatureDirty = false;
let drawingSignature = false;
let currentAvariaDetail = null;
let customerContactRows = [];
let deliveryDamageReceiptContext = null;
let salesDamageItems = [];
let salesDamageEditingId = null;
let salesDamagePhotos = [];
let salesDamageSelectedProduct = null;
let salesDamageProductActiveIndex = -1;
let salesDamageProductSearchTimer = null;
const SALES_DAMAGE_PRODUCT_RENDER_LIMIT = 1500;
const SALES_DAMAGE_PRODUCT_INITIAL_LIMIT = 80;
let selectedSalesCustomerKey = '';
let salesDamageMyRequests = [];
let salesDamageManageRequests = [];
let currentSalesDamageDetail = null;
let allConferences = [];
let allMaps = [];
let fefoActiveCount = null;
let fefoItems = [];
let fefoEditingItemId = null;
let fefoActiveCounts = [];
let fefoReports = [];
let fefoItemsByCount = new Map();
let rotatingAssetProducts = [];
let rotatingAssetActiveCount = null;
let rotatingAssetEntries = [];
let rotatingAssetHistory = [];
let rotatingAssetEntriesByCount = new Map();
let realtimeChannel = null;
let activeView = '';
let toastTimer = null;
let refRefreshPromise = null;
let deliveryCustomerLookupTimer = null;
let salesCustomerLookupTimer = null;
let deliveryCustomerLookupSeq = 0;
let salesCustomerLookupSeq = 0;
const REF_PAGE_SIZE = 1000;
const CUSTOMER_REF_LIMIT = 5000;
const PRODUCT_REF_LIMIT = 25000;
const REF_CACHE_KEY = 'ops_ref_cache_v140_customers5000';

const viewMeta = {
  'nri-cadastro':['Cadastro por carreta','Cadastre várias NRIs de uma vez'],
  'nri-pendentes':['Impressões pendentes','Fila atualizada em tempo real'],
  'avaria-cadastro':['Registrar avaria','Foto, GPS e assinatura'],
  'conf-cadastro':['Conferência de vasilhames','Registro físico de retorno'],
  'conf-minhas':['Minhas conferências','Histórico do usuário atual'],
  'avaria-admin':['Todas as avarias','Análise e aprovação'],
  'sales-avaria-cadastro':['Avarias de Vendas','Nova solicitação com foto por produto'],
  'sales-avaria-minhas':['Minhas avarias de vendas','Acompanhe suas solicitações'],
  'sales-avaria-gestao':['Gestão de avarias de vendas','Aprovação, reprovação e auditoria'],
  'nri-historico':['Histórico NRI','Rastreabilidade completa'],
  'nri-avarias-historico':['Paletes avariados','Nota Fiscal, fotos e rastreabilidade'],
  'conf-historico':['Histórico de conferências','Todos os registros'],
  'conf-dashboard':['Dashboard comparativo','Planejado x conferido'],
  'fefo-contagem':['Contagem FEFO','Produto, validade e posição'],
  'fefo-andamento':['Contagens em andamento','Retome uma contagem aberta'],
  'fefo-relatorios':['Relatórios FEFO','Histórico e exportação CSV'],
  'ativo-giro-contagem':['Ativo de Giro','Contagem diária com adições cumulativas'],
  'ativo-giro-historico':['Histórico de Ativo de Giro','Totais consolidados por contagem'],
  'nri-carretas':['Recebimentos pendentes','Puxada e Marketplace aguardando NRI'],
  'marketplace-recebimento':['Recebimento Marketplace','Cronômetro, fornecedor e fila para NRI'],
  'puxada-viagem':['Minha Puxada','Etapas, GPS e ocorrências'],
  'puxada-farol':['Farol de andamento','Carretas em viagem e localização'],
  'puxada-historico':['Relatório / Histórico','Ciclos, percurso e tempos'],
  'puxada-dashboard':['Dashboards da Puxada','Aderência e planificador'],
  'puxada-metas':['Metas da Puxada','Metas globais por ano'],
  'puxada-config':['Configurações da Puxada','GPS, raio de auditoria e veículos'],
  'usuarios':['Usuários e perfis','Controle de acesso'],
  'contatos-clientes':['Contatos de clientes','WhatsApp e comprovantes de avaria'],
  'bases':['Bases / importação','Migração do Google Sheets']
};

window.addEventListener('DOMContentLoaded', init);

async function prepareRuntimeCache(){
  if(!('serviceWorker' in navigator))return;
  const native=!!window.Capacitor?.isNativePlatform?.();
  if(native){
    // No APK, os arquivos web ja estao empacotados. Service Worker pode manter JS antigo
    // entre atualizacoes do APK, por isso removemos registros e caches web no modo nativo.
    try{const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}catch(e){console.warn('SW unregister',e);}
    try{if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}}catch(e){console.warn('Cache clear',e);}
    return;
  }
  try{const reg=await navigator.serviceWorker.register('sw.js?v=1.7.0-offline-login1',{updateViaCache:'none'});await reg.update();}catch(e){console.warn('SW register',e);}
}


async function init(){

  bindBaseEvents();

  updateOnlineStatus();

  window.addEventListener(
    'online',
    updateOnlineStatus
  );

  window.addEventListener(
    'offline',
    updateOnlineStatus
  );

  window.addEventListener(
    'online',
    ()=>{

      setTimeout(
        ()=>{

          recoverOnlineAuthV171()
            .catch(
              e=>
                console.warn(
                  '[OFFLINE] recuperar online',
                  e
                )
            );

        },
        300
      );

    }
  );

  await prepareRuntimeCache();


  if(!isConfigured()){

    setBackendStatus(
      'error',
      'Configure o Supabase em config.js'
    );

    showLogin(
      'Preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js.'
    );

    return;
  }


  try{

    sb=
      window.supabase.createClient(
        CFG.SUPABASE_URL,
        CFG.SUPABASE_ANON_KEY,
        {
          auth:{
            persistSession:true,
            autoRefreshToken:true,
            detectSessionInUrl:true
          },

          global:{
            fetch:(input,options={})=>
              fetch(
                input,
                {
                  ...options,
                  cache:'no-store'
                }
              )
          }
        }
      );


    // ========================================================
    // ABERTURA SEM INTERNET
    // ========================================================

    if(!navigator.onLine){

      const cached=
        offlineReadIdentityV171();

      if(cached?.user_id){

        const localUser={
          id:
            String(
              cached.user_id
            ),

          email:
            String(
              cached.email||''
            ),

          aud:
            'authenticated'
        };

        const ok=
          await loadProfile(
            localUser
          );

        if(ok){

          setBackendStatus(
            'checking',
            'Modo offline'
          );

          await startApp();

          toast(
            'Modo offline ativo. Os registros ficarao salvos neste aparelho ate a internet voltar.',
            'success'
          );

          return;
        }
      }


      setBackendStatus(
        'error',
        'Sem internet'
      );

      showLogin(
        'Sem internet. Este aparelho precisa fazer pelo menos um login online antes de usar o modo offline.'
      );

      return;
    }


    // ========================================================
    // ABERTURA ONLINE
    // ========================================================

    setBackendStatus(
      'checking',
      'Conectando ao Supabase...'
    );

    const {
      data:{
        session
      },
      error
    }=
      await sb.auth.getSession();

    if(error)throw error;


    if(session?.user){

      const ok=
        await loadProfile(
          session.user
        );

      if(ok){

        await startApp();

      }
      else{

        showLogin();

      }

    }
    else{

      showLogin();

    }


    setBackendStatus(
      'ok',
      'Supabase conectado'
    );


    sb.auth.onAuthStateChange(
      (_event,currentSession)=>{

        if(
          !currentSession
          &&
          profile
          &&
          navigator.onLine
        ){

          profile=null;
          authUser=null;

          teardownRealtime();

          showLogin();

        }
      }
    );

  }
  catch(e){

    console.error(
      '[INIT]',
      e
    );


    const networkFailure=
      !navigator.onLine
      ||
      (
        typeof offlineIsNetworkError==='function'
        &&
        offlineIsNetworkError(e)
      );


    if(networkFailure){

      const cached=
        offlineReadIdentityV171();

      if(cached?.user_id){

        try{

          const ok=
            await loadProfile({
              id:
                String(
                  cached.user_id
                ),

              email:
                String(
                  cached.email||''
                ),

              aud:
                'authenticated'
            });

          if(ok){

            setBackendStatus(
              'checking',
              'Modo offline'
            );

            await startApp();

            return;
          }

        }
        catch(_offlineError){}
      }
    }


    setBackendStatus(
      'error',
      'Falha ao conectar ao Supabase'
    );

    showLogin(
      humanError(e)
    );
  }
}

function isConfigured(){
  return /^https:\/\/.+\.supabase\.co$/i.test(String(CFG.SUPABASE_URL||'')) && String(CFG.SUPABASE_ANON_KEY||'').length>40 && !String(CFG.SUPABASE_ANON_KEY||'').includes('COLE_AQUI');
}
function setBackendStatus(type,text){ const el=$('backendStatus'); if(!el)return; el.className=`backend-status ${type}`; el.querySelector('span').textContent=text; }
function updateOnlineStatus(){ const el=$('syncPill'); if(!el)return; const online=navigator.onLine; el.classList.toggle('offline',!online); el.querySelector('span').textContent=online?'Online':'Sem internet'; }

function sanitizeLot(value){ return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function enforceLotInput(e){ const clean=sanitizeLot(e?.target?.value); if(e?.target&&e.target.value!==clean)e.target.value=clean; }

function bindBaseEvents(){
  $('formLogin').addEventListener('submit', login);
  $('btnMostrarSenha').addEventListener('click',()=>{ const i=$('loginSenha'); i.type=i.type==='password'?'text':'password'; $('btnMostrarSenha').textContent=i.type==='password'?'Mostrar':'Ocultar'; });
  $('btnSair').addEventListener('click', logout); $('btnSairMobile').addEventListener('click',logout);
  $('menuBtn').addEventListener('click',()=>toggleSidebar(true)); $('overlay').addEventListener('click',()=>toggleSidebar(false));
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
  document.querySelectorAll('.nav-area-toggle').forEach(b=>b.addEventListener('click',()=>toggleNavArea(b.closest('.nav-area'))));
  document.querySelectorAll('.nav-module-toggle').forEach(b=>b.addEventListener('click',()=>toggleNavModule(b.closest('.nav-module'))));
  $('modalClose').addEventListener('click',closeModal); $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});

  // NRI
  $('nriCodigo').addEventListener('input',e=>onOperationalProductInput('nri',e));
  $('nriCodigo').addEventListener('focus',()=>renderOperationalProductOptions('nri',$('nriCodigo').value||''));
  $('nriCodigo').addEventListener('keydown',e=>onOperationalProductKeydown('nri',e));
  $('nriProductOptions').addEventListener('click',e=>onOperationalProductOptionClick('nri',e));
  $('btnNriProductClear').addEventListener('click',()=>clearOperationalProductSelection('nri',true));
  document.addEventListener('click',e=>{if(!$('nriProductPicker')?.contains(e.target))hideOperationalProductOptions('nri');});
  $('nriTipo').addEventListener('change',updateNriTypeFields);
  $('nriSemValidade').addEventListener('change',updateNriValidityMode);
  $('nriValidade').addEventListener('input',e=>{ e.target.value=maskShortDate(e.target.value); updateBlockDate(); });
  $('nriLote').addEventListener('input',enforceLotInput);
  $('nriLote').addEventListener('keydown',e=>onMultiLotKeydown('nri',e));
  $('btnNriAddLot').addEventListener('click',()=>addMultiLot('nri'));
  $('nriLotList').addEventListener('click',e=>onMultiLotListClick('nri',e));
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
  ['damageHistSearch','damageHistType','damageHistUnit','damageHistDe','damageHistAte'].forEach(id=>$(id)?.addEventListener(id==='damageHistSearch'?'input':'change',renderNriDamageHistory));
  $('btnDamageHistRefresh')?.addEventListener('click',loadNriDamageHistory);
  $('btnDamageHistCsv')?.addEventListener('click',exportNriDamageHistoryCsv);
  $('tbodyDamageHistory')?.addEventListener('click',onNriDamageHistoryClick);
  $('nriDamageChoice')?.addEventListener('click',onNriDamageChoice);
  $('btnNriDamageCamera')?.addEventListener('click',()=>$('nriDamageCamera').click());
  $('nriDamageCamera')?.addEventListener('change',onNriDamagePhoto);
  $('nriDamagePhotoGallery')?.addEventListener('click',onNriDamagePhotoGalleryClick);
  $('formMarketplaceReceipt')?.addEventListener('submit',startMarketplaceReceipt);
  $('btnMarketFinish')?.addEventListener('click',finishMarketplaceReceipt);
  $('formMarketplaceSupplier')?.addEventListener('submit',saveMarketplaceSupplier);
  $('btnMarketSupplierNew')?.addEventListener('click',clearMarketplaceSupplierForm);
  $('marketSupplierRows')?.addEventListener('click',onMarketplaceSupplierRowsClick);

  // Avarias
  $('avData').addEventListener('change',()=>{});
  $('avPdv').addEventListener('input',onPdvInput);
  $('avMapa').addEventListener('input',()=>{$('avMapaResumo').textContent=$('avMapa').value.trim()||'—';});
  $('avClienteEscolha').addEventListener('change',onCustomerChoiceChange);
  $('avProduto').addEventListener('input',onDeliveryDamageProductInput);
  $('avProduto').addEventListener('focus',()=>renderDeliveryDamageProductOptions($('avProduto').value||''));
  $('avProduto').addEventListener('keydown',onDeliveryDamageProductKeydown);
  $('avProductOptions').addEventListener('click',onDeliveryDamageProductOptionClick);
  $('btnAvProductClear').addEventListener('click',()=>clearDeliveryDamageProductSelection(true));
  document.addEventListener('click',e=>{if(!$('avProductPicker')?.contains(e.target))hideDeliveryDamageProductOptions();});
  $('avLote').addEventListener('input',enforceLotInput);
  $('btnAvCamera').addEventListener('click',()=>$('avFotoCamera').click());
  $('avFotoCamera').addEventListener('change',onAvariaPhoto);
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
  $('btnAvariasCsv')?.addEventListener('click',exportDeliveryDamageCsv);
  $('tbodyAvariasAdmin').addEventListener('click',onAdminAvariaClick);
  setupSignatureCanvas();

  // Avarias de Vendas
  $('salesDamagePdv')?.addEventListener('input',onSalesDamagePdvInput);
  $('salesDamageCustomerChoice')?.addEventListener('change',onSalesDamageCustomerChoice);
  $('salesDamageProduct')?.addEventListener('input',onSalesDamageProductInput);
  $('salesDamageProduct')?.addEventListener('focus',()=>renderSalesDamageProductOptions($('salesDamageProduct')?.value||''));
  $('salesDamageProduct')?.addEventListener('keydown',onSalesDamageProductKeydown);
  $('salesDamageProductOptions')?.addEventListener('click',onSalesDamageProductOptionClick);
  $('btnSalesDamageProductClear')?.addEventListener('click',()=>clearSalesDamageProductSelection(true));
  document.addEventListener('click',e=>{if(!$('salesDamageProductPicker')?.contains(e.target))hideSalesDamageProductOptions();});
  $('salesDamageReason')?.addEventListener('change',updateSalesDamageValidityMode);
  $('btnSalesDamageCamera')?.addEventListener('click',()=>$('salesDamageCamera')?.click());
  $('salesDamageCamera')?.addEventListener('change',onSalesDamagePhoto);
  $('salesDamagePhotoPreview')?.addEventListener('click',onSalesDamagePhotoPreviewClick);
  $('btnSalesDamageAddItem')?.addEventListener('click',addSalesDamageItem);
  $('btnSalesDamageCancelItem')?.addEventListener('click',clearSalesDamageItemEditor);
  $('salesDamageItemList')?.addEventListener('click',onSalesDamageItemListClick);
  $('btnSalesDamageClear')?.addEventListener('click',clearSalesDamageRequest);
  $('formSalesDamage')?.addEventListener('submit',submitSalesDamage);
  $('salesDamageMySearch')?.addEventListener('input',renderSalesDamageMy);
  $('salesDamageMyStatus')?.addEventListener('change',renderSalesDamageMy);
  $('btnSalesDamageMyRefresh')?.addEventListener('click',loadSalesDamageMy);
  $('tbodySalesDamageMy')?.addEventListener('click',onSalesDamageRequestClick);
  $('salesDamageManageSearch')?.addEventListener('input',renderSalesDamageManage);
  $('salesDamageManageStatus')?.addEventListener('change',renderSalesDamageManage);
  $('btnSalesDamageRefresh')?.addEventListener('click',loadSalesDamageManage);
  $('btnSalesDamageCsv')?.addEventListener('click',exportSalesDamageCsv);
  $('tbodySalesDamageManage')?.addEventListener('click',onSalesDamageRequestClick);

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

  // Contagem FEFO
  $('btnFefoStart')?.addEventListener('click',startFefoCount);
  $('formFefoItem')?.addEventListener('submit',saveFefoItem);
  $('fefoCodigo')?.addEventListener('input',e=>onOperationalProductInput('fefo',e));
  $('fefoCodigo')?.addEventListener('focus',()=>renderOperationalProductOptions('fefo',$('fefoCodigo')?.value||''));
  $('fefoCodigo')?.addEventListener('keydown',e=>onOperationalProductKeydown('fefo',e));
  $('fefoProductOptions')?.addEventListener('click',e=>onOperationalProductOptionClick('fefo',e));
  $('btnFefoProductClear')?.addEventListener('click',()=>clearOperationalProductSelection('fefo',true));
  document.addEventListener('click',e=>{if(!$('fefoProductPicker')?.contains(e.target))hideOperationalProductOptions('fefo');});
  $('fefoValidade')?.addEventListener('input',e=>{e.target.value=maskFefoDate(e.target.value);paintFefoValidityHint();});
  $('btnFefoCancelEdit')?.addEventListener('click',clearFefoItemForm);
  $('btnFefoRefreshItems')?.addEventListener('click',()=>loadFefoCurrent());
  $('tbodyFefoItems')?.addEventListener('click',onFefoItemsClick);
  $('btnFefoFinish')?.addEventListener('click',finishFefoCount);
  $('btnFefoCancelCount')?.addEventListener('click',cancelFefoCount);
  $('btnFefoActiveRefresh')?.addEventListener('click',loadFefoActiveCounts);
  $('tbodyFefoActiveCounts')?.addEventListener('click',onFefoActiveCountsClick);
  $('btnFefoReportsRefresh')?.addEventListener('click',loadFefoReports);
  ['fefoReportSearch','fefoReportUnit','fefoReportFrom','fefoReportTo'].forEach(id=>$(id)?.addEventListener(id==='fefoReportSearch'?'input':'change',renderFefoReports));
  $('tbodyFefoReports')?.addEventListener('click',onFefoReportsClick);

  // Ativo de Giro
  $('btnAssetStart')?.addEventListener('click',startRotatingAssetCount);
  $('btnAssetRefresh')?.addEventListener('click',()=>loadRotatingAssetCurrent());
  $('btnAssetFinish')?.addEventListener('click',finishRotatingAssetCount);
  $('btnAssetCancelCount')?.addEventListener('click',cancelRotatingAssetCount);
  $('assetProductGrid')?.addEventListener('click',onRotatingAssetProductGridClick);
  $('tbodyAssetEntries')?.addEventListener('click',onRotatingAssetEntriesClick);
  $('btnAssetHistoryRefresh')?.addEventListener('click',loadRotatingAssetHistory);
  ['assetHistorySearch','assetHistoryUnit','assetHistoryFrom','assetHistoryTo'].forEach(id=>$(id)?.addEventListener(id==='assetHistorySearch'?'input':'change',renderRotatingAssetHistory));
  $('tbodyAssetHistory')?.addEventListener('click',onRotatingAssetHistoryClick);

  // Users/import
  $('formUsuario').addEventListener('submit',saveUser);
  $('btnLimparUsuario').addEventListener('click',clearUserForm);
  $('tbodyUsuarios').addEventListener('click',onUserTableClick);
  $('usuarioPerfil')?.addEventListener('change',()=>renderUserPermissionEditor(null,true));
  $('btnRestaurarPermissoes')?.addEventListener('click',()=>renderUserPermissionEditor(null,true));
  $('btnImportarBase').addEventListener('click',importBaseCsv);
  $('customerContactSearch')?.addEventListener('input',renderCustomerContactAdmin);
  $('btnCustomerContactRefresh')?.addEventListener('click',()=>loadCustomerContactAdmin());
  $('tbodyCustomerContacts')?.addEventListener('click',onCustomerContactAdminClick);
  bindPullEvents();
}


async function login(e){

  e.preventDefault();

  if(!sb)return;

  const username=
    normalizeUsername(
      $('loginUsuario').value
    );

  const password=
    $('loginSenha').value;


  if(
    !username
    ||
    !password
  ){

    return setLoginMessage(
      'Informe usuario e senha.'
    );

  }


  if(!navigator.onLine){

    setLoginMessage(
      'Sem internet. Neste aparelho, o acesso offline e automatico somente depois de pelo menos um login online.'
    );

    return;
  }


  const btn=
    $('btnEntrar');

  btn.disabled=true;
  btn.textContent='Entrando...';

  setLoginMessage('');


  try{

    const email=
      `${username}@${CFG.USER_EMAIL_DOMAIN||'disbecol.app'}`;


    const {
      data,
      error
    }=
      await sb.auth.signInWithPassword({
        email,
        password
      });


    if(error)throw error;


    const ok=
      await loadProfile(
        data.user
      );


    if(!ok){

      await sb.auth.signOut();

      throw new Error(
        'Usuario inativo ou sem perfil.'
      );

    }


    offlineRememberIdentityV171(
      data.user,
      username
    );


    $('loginSenha').value='';


    await startApp();

  }
  catch(err){

    setLoginMessage(
      loginError(err)
    );

  }
  finally{

    btn.disabled=false;
    btn.textContent='Entrar ->';

  }
}

async function loadProfile(user){
  authUser=user;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(error||!data||!data.active){profile=null;return false;}
  profile=data;
  return true;
}
async function loadMyPermissions(){

  const fallback=
    ROLE_PERMISSION_DEFAULTS[profile?.role]||[];

  myPermissions=
    new Set(fallback);

  if(!sb||!profile)return;

  try{

    const {data,error}=
      await sb.rpc('get_my_permissions');

    if(error)throw error;

    myPermissions=
      new Set((data||[]).map(String));

    if(profile.role==='ADMIN'){

      myPermissions.delete(
        'DAMAGE_NOTIFICATION'
      );

      PERMISSION_CATALOG
        .filter(
          x=>x.code!=='DAMAGE_NOTIFICATION'
        )
        .forEach(
          x=>myPermissions.add(x.code)
        );

      const {
        data:notify,
        error:notifyError
      }=await sb
        .from('user_permissions')
        .select('allowed')
        .eq('user_id',authUser.id)
        .eq(
          'permission_code',
          'DAMAGE_NOTIFICATION'
        )
        .maybeSingle();

      if(notifyError)throw notifyError;

      if(notify?.allowed===true){
        myPermissions.add(
          'DAMAGE_NOTIFICATION'
        );
      }
    }

  }
  catch(e){

    console.warn(
      'Falha ao carregar permissoes.',
      e
    );

  }
}
function hasPerm(code){

  const key=
    String(code||'');

  if(key==='DAMAGE_NOTIFICATION'){
    return myPermissions.has(key);
  }

  return (
    profile?.role==='ADMIN'
    ||
    myPermissions.has(key)
  );
}
function hasAnyPerm(codes){return String(codes||'').split(',').map(x=>x.trim()).filter(Boolean).some(hasPerm);}

async function logout(){

  offlineClearIdentityV171();

  teardownRealtime();
  teardownPullRealtime();
  stopPullTracking();

  profile=null;
  authUser=null;

  myUnits=[];
  activeUnit='';

  userUnitRows=[];
  userUnitAuditRows=[];

  myPermissions.clear();

  refs={
    products:[],
    units:[],
    drivers:[],
    factories:[],
    customers:[]
  };

  fefoActiveCount=null;
  fefoItems=[];
  fefoEditingItemId=null;
  fefoActiveCounts=[];
  fefoReports=[];
  fefoItemsByCount.clear();

  salesDamageItems=[];
  salesDamagePhotos=[];
  salesDamageMyRequests=[];
  salesDamageManageRequests=[];
  currentSalesDamageDetail=null;


  $('appShell')
    .classList
    .add('hidden');


  $('loginScreen')
    .classList
    .remove('hidden');


  try{

    if(navigator.onLine){
      await sb.auth.signOut();
    }

  }
  catch(_e){}


  setLoginMessage('');
}

function showLogin(msg=''){ $('appShell').classList.add('hidden');$('loginScreen').classList.remove('hidden');setLoginMessage(msg); }
function setLoginMessage(msg){$('loginMessage').textContent=msg||'';}
function loginError(e){ const m=String(e?.message||e||''); if(/invalid login/i.test(m))return 'Usuário ou senha inválidos.'; return humanError(e); }

async function startApp(){
  $('loginScreen').classList.add('hidden'); $('appShell').classList.remove('hidden');
  document.title='Disb Gestão';
  $('userNome').textContent=profile.name; $('userPerfil').textContent=ROLE_LABELS[profile.role]||profile.role; $('userAvatar').textContent=initials(profile.name);
  await loadMyPermissions();
  applyRole(); restoreNavNavigation(); fillDefaultDates(); updateDashboardPeriod();
  await loadReferences(true);
  prepareSalesDamageForm();
  setupRealtime();
  if(canPull())await initPullModule();
  if(canNri()) { await loadPending(); if(hasPerm('MARKETPLACE_RECEIVE'))await loadMarketplaceModule(true); if(hasPerm('NRI_PENDING_VIEW'))await loadPullNriPending(true); }
  if(canFefo()) { await refreshFefoBadge(true); }
  if(canRotatingAsset()) { await loadRotatingAssetProducts(true); if(hasPerm('ROTATING_ASSET_CREATE'))await loadRotatingAssetCurrent(true); }
  if(hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST')) loadAdminAvarias(true);
  if(hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST')) loadSalesDamageManage(true);
  const visible=[...document.querySelectorAll('.nav-item[data-view]')].find(x=>!x.classList.contains('hidden')&&!x.closest('.nav-module')?.classList.contains('hidden')&&!x.closest('.nav-area')?.classList.contains('hidden'));
  openView(visible?.dataset.view||'nri-cadastro',true);
}
function isAdmin(){return profile?.role==='ADMIN';}
function isPullDriver(){return profile?.role==='MOTORISTA_PUXADOR';}
function canNri(){return hasAnyPerm('NRI_PENDING_VIEW,MARKETPLACE_RECEIVE,NRI_CREATE,NRI_PRINT,NRI_HISTORY,NRI_DAMAGE_HISTORY');}
function canAvaria(){return hasAnyPerm('DELIVERY_DAMAGE_CREATE,DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST');}
function canConference(){return hasAnyPerm('CONF_CREATE,CONF_OWN_HISTORY,CONF_HISTORY,CONF_DASHBOARD');}
function canFefo(){return hasAnyPerm('FEFO_CREATE,FEFO_ACTIVE,FEFO_REPORT');}
function canRotatingAsset(){return hasAnyPerm('ROTATING_ASSET_CREATE,ROTATING_ASSET_HISTORY');}
function canPull(){return hasAnyPerm('PULL_TRIP,PULL_FAROL,PULL_HISTORY,PULL_DASHBOARD,PULL_GOALS,PULL_CONFIG,PULL_TMA_ADJUST');}
function canSalesDamage(){return hasAnyPerm('SALES_DAMAGE_CREATE,SALES_DAMAGE_VIEW_OWN,SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST');}
function applyRole(){
  document.querySelectorAll('[data-permission]').forEach(el=>el.classList.toggle('hidden',!hasPerm(el.dataset.permission)));
  document.querySelectorAll('[data-permission-any]').forEach(el=>el.classList.toggle('hidden',!hasAnyPerm(el.dataset.permissionAny)));
  document.querySelectorAll('.role-nri:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canNri()));
  document.querySelectorAll('.role-avaria:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canAvaria()));
  document.querySelectorAll('.role-conferencia:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canConference()));
  document.querySelectorAll('.role-fefo:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canFefo()));
  document.querySelectorAll('.role-rotating-asset:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canRotatingAsset()));
  document.querySelectorAll('.role-puxada:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!canPull()));
  document.querySelectorAll('.puxador-only:not([data-permission])').forEach(x=>x.classList.toggle('hidden',!isPullDriver()&&!hasPerm('PULL_TRIP')));
  document.querySelectorAll('.admin-only:not([data-permission]):not([data-permission-any])').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
}
function setNavAreaOpen(area,open){
  if(!area)return;
  area.classList.toggle('open',!!open);
  const btn=area.querySelector(':scope > .nav-area-toggle');
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}
function toggleNavArea(area){
  if(!area)return;
  const shouldOpen=!area.classList.contains('open');
  document.querySelectorAll('.nav-area').forEach(a=>setNavAreaOpen(a,shouldOpen&&a===area));
  // Ao trocar/abrir uma área, todos os módulos começam recolhidos.
  document.querySelectorAll('.nav-module').forEach(m=>setNavModuleOpen(m,false));
  saveNavNavigation();
}
function toggleNavModule(module){
  if(!module)return;
  const area=module.closest('.nav-area');
  if(area&&!area.classList.contains('open')){document.querySelectorAll('.nav-area').forEach(a=>setNavAreaOpen(a,a===area));}
  const shouldOpen=!module.classList.contains('open');
  document.querySelectorAll('.nav-module').forEach(m=>setNavModuleOpen(m,shouldOpen&&m===module));
  saveNavNavigation();
}
function setNavModuleOpen(module,open){
  if(!module)return;
  module.classList.toggle('open',!!open);
  const btn=module.querySelector(':scope > .nav-module-toggle');
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}
function saveNavNavigation(){
  const area=document.querySelector('.nav-area.open')?.dataset.area||'';
  try{
    localStorage.setItem('disb_nav_area_open',area);
    // Submódulos não são persistidos abertos entre sessões/trocas de área.
    localStorage.removeItem('disb_nav_module_open');
  }catch(_e){}
}
function restoreNavNavigation(){
  let areaKey='';
  try{areaKey=localStorage.getItem('disb_nav_area_open')||'';localStorage.removeItem('disb_nav_module_open');}catch(_e){}
  const areas=[...document.querySelectorAll('.nav-area')].filter(a=>!a.classList.contains('hidden'));
  const area=areas.find(a=>a.dataset.area===areaKey)||areas[0]||null;
  document.querySelectorAll('.nav-area').forEach(a=>setNavAreaOpen(a,a===area));
  document.querySelectorAll('.nav-module').forEach(m=>setNavModuleOpen(m,false));
  saveNavNavigation();
}
function openModuleForView(name){
  const item=document.querySelector(`.nav-item[data-view="${name}"]`);
  const area=item?.closest('.nav-area');
  const currentArea=document.querySelector('.nav-area.open');
  // Ao mudar de área por navegação programática, os submódulos também começam recolhidos.
  if(area&&currentArea!==area)document.querySelectorAll('.nav-module').forEach(m=>setNavModuleOpen(m,false));
  // Se o usuário clicou em uma tela dentro de um módulo já aberto da mesma área, ele permanece aberto.
  if(area)document.querySelectorAll('.nav-area').forEach(a=>setNavAreaOpen(a,a===area));
  saveNavNavigation();
}
function openView(name,force=false){
  const v=$(`view-${name}`); if(!v||v.classList.contains('hidden'))return;
  if(!force&&activeView===name){toggleSidebar(false);return;}
  activeView=name; document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); v.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===name));
  openModuleForView(name);
  const meta=viewMeta[name]||['Disb Gestão','']; $('topbarTitulo').textContent=meta[0];$('topbarSubtitulo').textContent=meta[1]; toggleSidebar(false);
  if(name==='nri-cadastro')ensureNriPlateOptions();
  if(name==='nri-pendentes')loadPending();
  if(name==='avaria-cadastro')ensureAvariaLocationPermission();
  if(name==='nri-historico')loadNriHistory();
  if(name==='nri-avarias-historico')loadNriDamageHistory();
  if(name==='avaria-admin')loadAdminAvarias();
  if(name==='sales-avaria-cadastro')prepareSalesDamageForm();
  if(name==='sales-avaria-minhas')loadSalesDamageMy();
  if(name==='sales-avaria-gestao')loadSalesDamageManage();
  if(name==='conf-minhas')loadMyConferences();
  if(name==='conf-historico')loadConferenceHistory();
  if(name==='conf-dashboard')loadDashboard();
  if(name==='fefo-contagem')loadFefoCurrent();
  if(name==='fefo-andamento')loadFefoActiveCounts();
  if(name==='fefo-relatorios')loadFefoReports();
  if(name==='ativo-giro-contagem')loadRotatingAssetCurrent();
  if(name==='ativo-giro-historico')loadRotatingAssetHistory();
  if(name==='usuarios')loadUsers();
  if(name==='contatos-clientes')loadCustomerContactAdmin();
  if(name==='marketplace-recebimento')loadMarketplaceModule();
  if(name==='nri-carretas'||name.startsWith('puxada-')) pullOnView(name);
}
function toggleSidebar(open){$('sidebar').classList.toggle('open',open);$('overlay').classList.toggle('show',open);}

function setupRealtime(){
  teardownRealtime();
  realtimeChannel=sb.channel(`ops-${authUser.id}`);
  if(canNri()) { realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'nris'},()=>debounceReload('nri')); realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'marketplace_receipts'},()=>debounceReload('marketplace')); }
  if(hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST')) realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'damage_requests'},()=>debounceReload('avaria'));
  if(canSalesDamage()){
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'sales_damage_requests'},()=>debounceReload('sales_damage'));
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'sales_damage_items'},()=>debounceReload('sales_damage'));
  }
  if(canConference()) realtimeChannel.on('postgres_changes',{event:'INSERT',schema:'public',table:'container_conferences'},()=>debounceReload('conf'));
  if(canFefo()) {
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'fefo_counts'},()=>debounceReload('fefo'));
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'fefo_count_items'},()=>debounceReload('fefo'));
  }
  if(canRotatingAsset()){
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'rotating_asset_counts'},()=>debounceReload('rotating_asset'));
    realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'rotating_asset_entries'},()=>debounceReload('rotating_asset'));
  }
  realtimeChannel.subscribe();
}
function teardownRealtime(){if(realtimeChannel&&sb){sb.removeChannel(realtimeChannel).catch(()=>{});realtimeChannel=null;}}
const reloadTimers={}; function debounceReload(type){clearTimeout(reloadTimers[type]);reloadTimers[type]=setTimeout(()=>{
  if(type==='nri'&&canNri())loadPending(true);
  if(type==='marketplace'&&canNri()){if(hasPerm('MARKETPLACE_RECEIVE'))loadMarketplaceModule(true);if(hasPerm('NRI_PENDING_VIEW'))loadPullNriPending(true);}
  if(type==='avaria'&&hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))loadAdminAvarias(true);
  if(type==='sales_damage'){if(hasPerm('SALES_DAMAGE_VIEW_OWN'))loadSalesDamageMy(true);if(hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST'))loadSalesDamageManage(true);}
  if(type==='conf'){if(activeView==='conf-minhas'&&hasPerm('CONF_OWN_HISTORY'))loadMyConferences(true);if(activeView==='conf-dashboard'&&hasPerm('CONF_DASHBOARD'))loadDashboard(true);}
  if(type==='fefo'&&canFefo()){refreshFefoBadge(true);if(activeView==='fefo-contagem'&&hasPerm('FEFO_CREATE'))loadFefoCurrent(true);if(activeView==='fefo-andamento'&&hasPerm('FEFO_ACTIVE'))loadFefoActiveCounts(true);if(activeView==='fefo-relatorios'&&hasPerm('FEFO_REPORT'))loadFefoReports(true);}
  if(type==='rotating_asset'&&canRotatingAsset()){if(activeView==='ativo-giro-contagem'&&hasPerm('ROTATING_ASSET_CREATE'))loadRotatingAssetCurrent(true);if(activeView==='ativo-giro-historico'&&hasPerm('ROTATING_ASSET_HISTORY'))loadRotatingAssetHistory(true);}
},220);}

async function fetchReferencePages(makeQuery,maxRows){
  const rows=[];
  for(let from=0;from<maxRows;from+=REF_PAGE_SIZE){
    const to=Math.min(from+REF_PAGE_SIZE-1,maxRows-1);
    const {data,error}=await makeQuery().range(from,to);
    if(error)throw error;
    const page=data||[];rows.push(...page);
    if(page.length<(to-from+1))break;
  }
  return rows;
}
function isMissingCustomerIdError(e){
  const m=String(e?.message||e||'');
  return /column .*id.* does not exist/i.test(m)||/customers.*id.*does not exist/i.test(m)||/42703/.test(String(e?.code||''));
}
async function loadCustomerReferencePages(maxRows=CUSTOMER_REF_LIMIT){
  try{
    return await fetchReferencePages(()=>sb.from('customers').select('id,code,name,city,branch').order('code').order('branch').order('id'),maxRows);
  }catch(e){
    if(!isMissingCustomerIdError(e))throw e;
    console.warn('Base customers antiga sem coluna id; usando modo compativel para consulta de PDV. Execute o SQL 18 corrigido.',e);
    return await fetchReferencePages(()=>sb.from('customers').select('code,name,city,branch').order('code').order('branch'),maxRows);
  }
}
async function queryCustomersByCodeCompat(normalized){
  const selectWithId=()=>sb.from('customers').select('id,code,name,city,branch');
  const selectLegacy=()=>sb.from('customers').select('code,name,city,branch');
  const run=async(make)=>{
    let q=await make().eq('code',normalized).order('branch').order('name').limit(50);
    if(q.error)return q;
    let rows=(q.data||[]).filter(c=>normalizeCode(c.code)===normalized);
    if(rows.length)return {data:rows,error:null};
    q=await make().like('code',`%${normalized}`).order('branch').order('name').limit(100);
    if(q.error)return q;
    rows=(q.data||[]).filter(c=>normalizeCode(c.code)===normalized);
    return {data:rows,error:null};
  };
  let out=await run(selectWithId);
  if(out.error&&isMissingCustomerIdError(out.error))out=await run(selectLegacy);
  return out;
}
async function loadReferences(useCache=false){
  if(useCache){ const cached=readRefCache(); if(cached){refs=cached;rebuildReferenceMaps();populateReferenceInputs();} }
  if(refRefreshPromise)return refRefreshPromise;
  refRefreshPromise=(async()=>{
    try{
      const [products,u,d,f,customers]=await Promise.all([
        fetchReferencePages(()=>sb.from('products').select('code,name').eq('active',true).order('code'),PRODUCT_REF_LIMIT),
        sb.from('units').select('name').eq('active',true).in('name',myUnits.length?myUnits:['__SEM_UNIDADE__']).order('name'),
        sb.from('drivers').select('name').eq('active',true).order('name'),
        sb.from('factories').select('name').eq('active',true).order('name'),
        loadCustomerReferencePages(CUSTOMER_REF_LIMIT)
      ]);
      const errors=[u,d,f].map(x=>x.error).filter(Boolean); if(errors.length)throw errors[0];
      refs=sanitizeRefs({products,units:u.data||[],drivers:d.data||[],factories:f.data||[],customers});
      localStorage.setItem(REF_CACHE_KEY,JSON.stringify({at:Date.now(),data:refs})); rebuildReferenceMaps();populateReferenceInputs();
    }catch(e){ if(!refs.products.length)toast(humanError(e),'error'); }
    finally{refRefreshPromise=null;}
  })();
  return refRefreshPromise;
}
function readRefCache(){try{localStorage.removeItem('ops_ref_cache');const x=JSON.parse(localStorage.getItem(REF_CACHE_KEY)||'null');return x&&Date.now()-x.at<12*3600e3?sanitizeRefs(x.data):null;}catch{return null;}}
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
  const unitValues=activeUnit?[activeUnit]:[];
  fillSelect('nriUnidade',unitValues,'Selecione'); fillSelect('nriMotorista',refs.drivers.map(x=>x.name),'Selecione'); fillSelect('nriFabrica',refs.factories.map(x=>x.name),'Selecione');
  if($('fefoStartUnit'))fillSelect('fefoStartUnit',unitValues,'Selecione');
  if($('fefoReportUnit'))fillSelect('fefoReportUnit',unitValues,'Unidade atual');
  if($('assetStartUnit'))fillSelect('assetStartUnit',unitValues,'Selecione');
  if($('assetHistoryUnit'))fillSelect('assetHistoryUnit',unitValues,'Unidade atual');
  fillSelect('pendUnidade',unitValues,'Unidade atual'); fillSelect('histNriUnidade',unitValues,'Unidade atual');
  ['nriUnidade','fefoStartUnit','fefoReportUnit','assetStartUnit','assetHistoryUnit','pendUnidade','histNriUnidade'].forEach(id=>{const el=$(id);if(el&&activeUnit)el.value=activeUnit;});
  updateNriTypeFields();
}
function fillSelect(id,values,placeholder){const el=$(id);const old=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}
function sanitizeRefText(v){return repairText(String(v??'')).trim();}
function repairText(v){let s=String(v??'');const map={'Ã¡':'á','Ã ': 'à','Ã¢':'â','Ã£':'ã','Ã¤':'ä','Ã©':'é','Ã¨':'è','Ãª':'ê','Ã«':'ë','Ã­':'í','Ã¬':'ì','Ã®':'î','Ã¯':'ï','Ã³':'ó','Ã²':'ò','Ã´':'ô','Ãµ':'õ','Ã¶':'ö','Ãº':'ú','Ã¹':'ù','Ã»':'û','Ã¼':'ü','Ã§':'ç','Ã':'Á','Ã€':'À','Ã‚':'Â','Ãƒ':'Ã','Ã„':'Ä','Ã‰':'É','Ãˆ':'È','ÃŠ':'Ê','Ã‹':'Ë','Ã':'Í','ÃŒ':'Ì','ÃŽ':'Î','Ã':'Ï','Ã“':'Ó','Ã’':'Ò','Ã”':'Ô','Ã•':'Õ','Ã–':'Ö','Ãš':'Ú','Ã™':'Ù','Ã›':'Û','Ãœ':'Ü','Ã‡':'Ç','â€“':'–','â€”':'—','â€˜':'‘','â€™':'’','â€œ':'“','â€':'”','â€¢':'•','Â ':' ','Âº':'º','Âª':'ª'};for(const [a,b] of Object.entries(map))s=s.split(a).join(b);s=s.replace(/Â(?=[A-Za-zÀ-ÿ])/g,'');return s;}
function sanitizeRefs(data){return {products:(data.products||[]).map(x=>({code:normalizeCode(x.code),name:sanitizeRefText(x.name)})).filter(x=>x.code&&x.name),units:(data.units||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),drivers:(data.drivers||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),factories:(data.factories||[]).map(x=>({name:sanitizeRefText(x.name)})).filter(x=>x.name),customers:(data.customers||[]).map(x=>({id:String(x.id||''),code:normalizeCode(x.code),name:sanitizeRefText(x.name),city:sanitizeRefText(x.city),branch:sanitizeRefText(x.branch)})).filter(x=>x.code&&x.name)};}

function mergeCustomerReferences(rows){
  const clean=sanitizeRefs({customers:rows||[]}).customers;if(!clean.length)return [];
  const seen=new Set(refs.customers.map(c=>String(c.id||customerKey(c))));
  clean.forEach(c=>{const key=String(c.id||customerKey(c));if(!seen.has(key)){refs.customers.push(c);seen.add(key);}});
  rebuildReferenceMaps();
  return clean;
}
async function fetchCustomersByCode(code){
  const normalized=normalizeCode(code);if(!normalized)return [];
  const cached=customersByCode.get(normalized)||[];if(cached.length)return cached;
  const {data,error}=await queryCustomersByCodeCompat(normalized);
  if(error)throw error;
  mergeCustomerReferences(data||[]);
  return customersByCode.get(normalized)||[];
}

// NRI ------------------------------------------------------------------------
function fillDefaultDates(){
  const now=new Date(); const iso=localIsoDate(now); const time=localTime(now);
  if(!$('nriRecebimento').value)$('nriRecebimento').value=iso; if(!$('nriHora').value)$('nriHora').value=time; $('nriConferente').value=profile?.name||'';
  if(!$('avData').value)$('avData').value=iso; $('avEntregador').value=profile?.name||''; if($('salesDamageDate'))$('salesDamageDate').value=iso; if($('salesDamageSeller'))$('salesDamageSeller').value=profile?.name||'';
  $('confConferente').textContent=profile?.name||'—'; if($('assetStartCounter'))$('assetStartCounter').value=profile?.name||'';if($('assetStartDate'))$('assetStartDate').value=iso; updateConfClock();
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
  if(nriPullLocked)return;
  setSelectFixedValue($('nriMotorista'),'--',marketplace);
  setSelectFixedValue($('nriFabrica'),'--',marketplace);
  const plate=$('nriPlaca');
  if(marketplace)setSelectFixedValue(plate,'--',true);
  else{setSelectFixedValue(plate,'--',false);populatePlateSelectors();ensureNriPlateOptions();}
}
function updateNriValidityMode(){
  const sem=$('nriSemValidade').checked;
  const validity=$('nriValidade');
  validity.disabled=sem;
  if(sem){validity.value='';$('nriBloqueio').value='--';}else{if($('nriBloqueio').value==='--')$('nriBloqueio').value='';updateBlockDate();}
}
function updateBlockDate(){if($('nriSemValidade').checked){$('nriBloqueio').value='--';return;}const iso=parseShortDate($('nriValidade').value);$('nriBloqueio').value=iso?formatShortDate(addDaysIso(iso,-30)):'';}
function addNriDraftItem(){
  const code=normalizeCode($('nriCodigo').value);const p=productsByCode.get(code);const semValidade=$('nriSemValidade').checked;const validity=semValidade?null:parseShortDate($('nriValidade').value);const lot=sanitizeLot($('nriLote').value);const qty=num($('nriQuantidade').value);const pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Informe um código de produto válido.','error'); if(!semValidade&&!validity)return toast('Informe a validade completa no formato dd/mm/aa ou selecione Sem Validade.','error'); if(!lot)return toast('Informe o lote.','error'); if(qty<=0)return toast('Informe a quantidade.','error'); if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  const item={id:nriEditingId||uuid(),product_code:p.code,product_name:p.name,validity_date:validity,lot,quantity:qty,pallets,block_date:validity?addDaysIso(validity,-30):null};
  const idx=nriDraftItems.findIndex(x=>x.id===item.id); if(idx>=0)nriDraftItems[idx]=item;else nriDraftItems.push(item); renderNriDraftItems();clearNriItemEditor();
}
function renderNriDraftItems(){
  const total=nriDraftItems.reduce((s,x)=>s+x.pallets,0);$('nriItemCounter').textContent=`${nriDraftItems.length} item(ns) • ${total} NRI(s)`;$('btnCadastrarCarreta').textContent=total?`Cadastrar carreta (${total} NRIs)`:'Cadastrar carreta';
  const el=$('nriItemList'); if(!nriDraftItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;} el.className='item-list';el.innerHTML=nriDraftItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product_code)} • ${esc(x.product_name)}</strong></div><div class="info"><small>Validade</small><strong>${x.validity_date?formatShortDate(x.validity_date):'Sem Validade'}</strong></div><div class="info"><small>Lote(s)</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)}</strong></div><div class="info"><small>Paletes / NRIs</small><strong>${x.pallets}</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
}
function onNriDraftListClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const row=b.closest('[data-id]');const item=nriDraftItems.find(x=>x.id===row.dataset.id);if(!item)return;if(b.dataset.act==='del'){nriDraftItems=nriDraftItems.filter(x=>x.id!==item.id);renderNriDraftItems();if(nriEditingId===item.id)clearNriItemEditor();return;}nriEditingId=item.id;$('nriCodigo').value=item.product_code;$('nriSemValidade').checked=!item.validity_date;$('nriValidade').value=formatShortDate(item.validity_date);$('nriLote').value=sanitizeLot(item.lot);$('nriQuantidade').value=item.quantity;$('nriPaletes').value=item.pallets;$('nriBloqueio').value=item.block_date?formatShortDate(item.block_date):'--';updateNriValidityMode();onProductCode();$('btnAdicionarNriItem').textContent='Salvar alteração';$('btnCancelarNriItem').classList.remove('hidden');}
function clearNriItemEditor(){nriEditingId=null;['nriCodigo','nriValidade','nriLote','nriBloqueio'].forEach(id=>$(id).value='');$('nriSemValidade').checked=false;updateNriValidityMode();$('nriQuantidade').value=1;$('nriPaletes').value=1;$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');$('btnAdicionarNriItem').textContent='+ Adicionar à carreta';$('btnCancelarNriItem').classList.add('hidden');}
function clearNriRequest(){nriDraftItems=[];renderNriDraftItems();clearNriItemEditor();clearNriPullContext();['nriUnidade','nriMotorista','nriFabrica','nriPlaca'].forEach(id=>$(id).value='');$('nriTipo').value='AMBEV';updateNriTypeFields();$('nriRecebimento').value=localIsoDate(new Date());$('nriHora').value=localTime(new Date());$('nriConferente').value=profile?.name||'';}
async function submitNriRequest(e){
  e.preventDefault();if(!nriDraftItems.length)return toast('Adicione ao menos um produto à carreta.','error');
  const requestType=$('nriTipo').value==='MARKETPLACE'?'MARKETPLACE':'AMBEV';
  const common={unit:$('nriUnidade').value,request_type:requestType,receipt_date:$('nriRecebimento').value,receipt_time:$('nriHora').value,driver:requestType==='MARKETPLACE'?'--':$('nriMotorista').value,plate:requestType==='MARKETPLACE'?'--':$('nriPlaca').value.trim(),factory:requestType==='MARKETPLACE'?'--':$('nriFabrica').value,pull_trip_id:$('nriPullTripId')?.value||null};
  const requiredBase=[common.unit,common.request_type,common.receipt_date,common.receipt_time];
  if(requiredBase.some(v=>!String(v).trim()))return toast('Preencha unidade, tipo, data e hora.','error');
  if(requestType==='AMBEV'&&[common.driver,common.plate,common.factory].some(v=>!String(v).trim()))return toast('Preencha motorista, placa e fábrica para recebimento Ambev.','error');
  const btn=$('btnCadastrarCarreta');btn.disabled=true;btn.textContent='Cadastrando…';
  try{const {data,error}=await sb.rpc('create_nri_request',{p_payload:{...common,items:nriDraftItems}});if(error)throw error;const count=data?.nris?.length||nriDraftItems.reduce((s,x)=>s+x.pallets,0);toast(`${count} NRIs cadastradas e enviadas para Impressões pendentes.`,'success');clearNriRequest();await loadPending(true);await loadPullNriPending(true);}
  catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;renderNriDraftItems();}
}
async function loadPending(silent=false){if(!canNri())return;try{const {data,error}=await sb.from('nris').select('*').eq('unit',activeUnit).eq('status','PENDENTE').order('created_at',{ascending:false}).limit(1500);if(error)throw error;pendingNris=(data||[]).map(mapNri);await loadNriDamageIndex(pendingNris);selectedNris=new Set([...selectedNris].filter(id=>pendingNris.some(x=>x.id===id)));renderPending();$('badgePendentes').textContent=pendingNris.length;}catch(e){if(!silent)toast(humanError(e),'error');}}
function mapNri(r){return {...r,codigoProduto:r.product_code,nomeProduto:r.product_name,unidade:r.unit,tipo:r.request_type||'AMBEV',validade:r.validity_date,lote:r.lot,recebimento:r.receipt_date,bloqueio:r.block_date,conferente:r.checker_name,hora:fmtTime(r.receipt_time),motorista:r.driver,placa:r.plate,fabrica:r.factory,quantidade:r.quantity};}
async function loadNriDamageIndex(records=[]){
  nriDamageIndex=new Map();
  const requestIds=[...new Set(records.map(x=>x.request_id).filter(Boolean))];
  for(let i=0;i<requestIds.length;i+=100){
    const chunk=requestIds.slice(i,i+100);
    const {data,error}=await sb.from('nri_damage_items').select('*,nri_damage_photos(*)').in('request_id',chunk);
    if(error)throw error;
    (data||[]).forEach(d=>{const arr=nriDamageIndex.get(d.request_id)||[];arr.push(d);nriDamageIndex.set(d.request_id,arr);});
  }
}
function nriDamageForRecord(r){
  const items=nriDamageIndex.get(r?.request_id)||[];
  const code=normalizeCode(r?.product_code||r?.codigoProduto||''),lot=String(r?.lot||r?.lote||'').trim().toUpperCase();
  return items.filter(d=>normalizeCode(d.product_code)===code&&String(d.lot||'').trim().toUpperCase()===lot);
}
function nriDamageSummaryHtml(r){
  const items=nriDamageForRecord(r);
  if(!items.length)return '<span class="status ok">Sem avaria</span>';
  const pallets=items.reduce((s,d)=>s+Number(d.damaged_pallets||0),0),photos=items.reduce((s,d)=>s+(d.nri_damage_photos||[]).length,0);
  return `<span class="status bad">Palete avariado</span><small>${pallets} palete(s) • ${photos} foto(s)</small>`;
}
async function showNriDamageDetail(r){
  try{
    let items=nriDamageForRecord(r);
    if(!items.length&&r?.request_id){const {data,error}=await sb.from('nri_damage_items').select('*,nri_damage_photos(*)').eq('request_id',r.request_id);if(error)throw error;items=data||[];}
    const code=normalizeCode(r?.product_code||r?.codigoProduto||''),lot=String(r?.lot||r?.lote||'').trim().toUpperCase();
    items=items.filter(d=>normalizeCode(d.product_code)===code&&String(d.lot||'').trim().toUpperCase()===lot);
    if(!items.length)return toast('Este NRI não possui palete avariado registrado.','');
    const paths=items.flatMap(d=>(d.nri_damage_photos||[]).map(ph=>ph.photo_path)).filter(Boolean);
    const pairs=await Promise.all(paths.map(async path=>{const {data}=await sb.storage.from('nri-avarias').createSignedUrl(path,3600);return [path,data?.signedUrl||''];}));
    const urls=new Map(pairs);
    const cards=items.map((d,idx)=>{const photos=[...(d.nri_damage_photos||[])].sort((a,b)=>Number(a.photo_order||0)-Number(b.photo_order||0));const gallery=photos.map((ph,i)=>`<a class="nri-damage-view-photo" href="${esc(urls.get(ph.photo_path)||'#')}" target="_blank" rel="noopener"><img src="${esc(urls.get(ph.photo_path)||'')}" alt="Foto ${i+1} do palete avariado"><span>Foto ${i+1} • abrir em tamanho maior</span></a>`).join('');return `<section class="nri-damage-view-card"><div class="nri-damage-view-head"><div><small>PRODUTO ${idx+1}</small><strong>${esc(d.product_code)} • ${esc(d.product_name)}</strong></div><span class="status bad">AVARIADO</span></div><div class="nri-damage-view-grid"><div><small>Lote</small><strong>${esc(d.lot)}</strong></div><div><small>Paletes recebidos</small><strong>${Number(d.total_pallets||0)}</strong></div><div><small>Paletes avariados</small><strong>${Number(d.damaged_pallets||0)}</strong></div><div><small>Nota Fiscal</small><strong>${esc(d.invoice_number||'—')}</strong></div><div><small>Motivo</small><strong>${esc(d.reason||'—')}</strong></div></div><div class="nri-damage-view-gallery">${gallery||'<div class="empty-state">Sem foto disponível.</div>'}</div></section>`;}).join('');
    const body=`<div class="notice nri-damage-notice"><strong>Registro de recebimento avariado</strong><br>As fotos ficam vinculadas ao produto, lote e requisição de NRI para rastreabilidade.</div><div class="detail-grid"><div class="detail-card"><small>NRI</small><strong>${esc(r.nri||'—')}</strong></div><div class="detail-card"><small>Tipo</small><strong>${esc(r.tipo||r.request_type||'—')}</strong></div><div class="detail-card"><small>Unidade</small><strong>${esc(r.unidade||r.unit||'—')}</strong></div><div class="detail-card"><small>Fornecedor / Fábrica</small><strong>${esc(r.fabrica||r.factory||'—')}</strong></div></div>${cards}`;
    openModal('Paletes avariados',`${r.nri||''} • ${r.codigoProduto||r.product_code||''} • lote ${r.lote||r.lot||''}`,body);
  }catch(e){toast(humanError(e),'error');}
}
function filteredPending(){const q=norm($('pendFiltro').value),u=$('pendUnidade').value;return pendingNris.filter(x=>(!u||x.unidade===u)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa].join(' ')).includes(q)));}
function renderPending(){const arr=filteredPending();$('tbodyPendentes').innerHTML=arr.length?arr.map(x=>{const hasDamage=nriDamageForRecord(x).length>0;return `<tr><td><input type="checkbox" data-check="${x.id}" ${selectedNris.has(x.id)?'checked':''}></td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${x.validade?fmtDate(x.validade):'Sem Validade'}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${nriDamageSummaryHtml(x)}</td><td>${fmtNum(x.quantidade)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Visualizar</button>${hasDamage?`<button class="mini-btn danger" data-act="damage" data-id="${x.id}">Ver avaria</button>`:''}<button class="mini-btn" data-act="print" data-id="${x.id}">Imprimir</button><button class="mini-btn danger" data-act="remove" data-id="${x.id}">Remover</button></div></td></tr>`;}).join(''):`<tr><td colspan="7">Nenhuma NRI pendente.</td></tr>`;}
function onPendingCheck(e){if(!e.target.matches('input[data-check]'))return;e.target.checked?selectedNris.add(e.target.dataset.check):selectedNris.delete(e.target.dataset.check);}
function onPendingClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=pendingNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);if(b.dataset.act==='damage')showNriDamageDetail(r);if(b.dataset.act==='print')startPrint([r]);if(b.dataset.act==='remove')removeNri(r);}
function toggleVisiblePendingSelection(){const arr=filteredPending();const all=arr.length&&arr.every(x=>selectedNris.has(x.id));arr.forEach(x=>all?selectedNris.delete(x.id):selectedNris.add(x.id));renderPending();}
async function removeNri(r){if(!confirm(`Remover ${r.nri} da fila?`))return;try{const {error}=await sb.rpc('remove_nris',{p_ids:[r.id]});if(error)throw error;toast('NRI removida da fila.','success');await loadPending(true);}catch(e){toast(humanError(e),'error');}}
function showNriPreview(r){openModal(`NRI ${r.nri}`,`${r.codigoProduto} • ${r.nomeProduto}`,htmlEtiqueta(r,false),[{label:'Imprimir',class:'primary',onClick:()=>{closeModal();startPrint([r],r.status==='IMPRESSO');}}]);setTimeout(()=>{const img=$('modalBody').querySelector('img[data-product]');if(img)setProductImage(img,r.codigoProduto);},10);}
async function startPrint(records,reprint=false){if(!records?.length)return toast('Selecione ao menos uma NRI.','error');printOperation={records,reprint};const frame=$('printFrame');const doc=frame.contentWindow.document;doc.open();doc.write(printDocument(records));doc.close();await wait(90);frame.contentWindow.focus();frame.contentWindow.print();openModal('Confirmar impressão','O diálogo da impressora foi aberto.','<p>Confirme somente depois de verificar se a impressão realmente foi concluída.</p>',[{label:'Cancelar / não imprimiu',class:'secondary',onClick:()=>finishPrint('CANCELADO')},{label:'Impressão concluída',class:'primary',onClick:()=>finishPrint('IMPRESSO')}]);}
async function finishPrint(result){if(!printOperation)return;const op=printOperation;printOperation=null;closeModal();if(result==='IMPRESSO'&&!op.reprint){const ids=new Set(op.records.map(x=>x.id));pendingNris=pendingNris.filter(x=>!ids.has(x.id));renderPending();$('badgePendentes').textContent=pendingNris.length;}try{const {error}=await sb.rpc('confirm_nri_print',{p_ids:op.records.map(x=>x.id),p_reprint:!!op.reprint,p_result:result});if(error)throw error;toast(result==='IMPRESSO'?'Impressão confirmada.':'Cancelamento registrado.',result==='IMPRESSO'?'success':'');}catch(e){toast(humanError(e),'error');loadPending(true);}}
function htmlEtiqueta(r,print){const img=print?`<img alt="" onerror="imgFallback(this,'${jsEsc(r.codigoProduto)}',1)" src="${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(r.codigoProduto)}.png">`:`<img alt="" data-product="1">`;const semValidade=!r.validade;const validadeTexto=semValidade?'SEM VALIDADE':fmtDate(r.validade);const bloqueioTexto=semValidade?'--':fmtDate(r.bloqueio);return `<div class="nri-preview-label"><div class="nri-top"><div class="nri-code-label">CÓDIGO:</div><div class="nri-code-value">${esc(r.codigoProduto)}</div><div class="nri-id">${esc(r.nri)}</div></div><div class="nri-product-title">${img}<strong>${esc(r.nomeProduto)}</strong></div><div class="nri-mini-strip"><div class="nri-mini-cell"><b>UNIDADE:</b>${esc(r.unidade)} <b style="margin-left:12px">TIPO:</b>${esc(r.tipo||'AMBEV')}</div></div><div class="nri-validade"><span>VALIDADE:</span><strong class="${semValidade?'sem-validade':''}">${validadeTexto}</strong></div><div class="nri-dates"><div class="nri-date-cell"><b>RECEB:</b><strong>${fmtDate(r.recebimento)}</strong></div><div class="nri-date-cell"><b>BLOQUEIO:</b><strong>${bloqueioTexto}</strong></div></div><div class="nri-meta"><div class="nri-meta-cell"><b>Conferente</b><span>${esc(r.conferente)}</span></div><div class="nri-meta-cell"><b>Hora</b><span>${esc(r.hora)}</span></div><div class="nri-meta-cell"><b>Motorista</b><span>${esc(r.motorista)}</span></div><div class="nri-meta-cell"><b>Placa</b><span>${esc(r.placa)}</span></div></div><div class="nri-bottom"><div><b>Fábrica:</b>${esc(r.fabrica)}</div><div><b>Quantidade:</b>${esc(r.quantidade)}</div><div><b>NRI:</b>${esc(r.nri)}</div></div></div>`;}
function printDocument(records){const pages=records.map(r=>`<section class="page">${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}${htmlEtiqueta(r,true)}</section>`).join('');return `<!doctype html><html><head><base href="${document.baseURI}"><meta charset="utf-8"><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#686868}.page{height:287mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always}.page:last-child{page-break-after:auto}.nri-preview-label{height:89mm;width:100%;border:1.2px solid #777;background:#fff;color:#686868;overflow:hidden}.nri-top{display:grid;grid-template-columns:auto 1fr auto;align-items:stretch;height:12mm;border-bottom:2px solid #777}.nri-code-label{display:flex;align-items:center;padding:0 2.2mm;font-size:18pt;font-weight:1000;border-right:2px solid #777}.nri-code-value{display:flex;align-items:center;padding:0 3mm;font-size:31pt;line-height:.82;font-weight:1000;color:#4b4f54}.nri-id{display:flex;align-items:center;padding:0 2mm;font-size:10pt;font-weight:900}.nri-product-title{height:18mm;border-bottom:1px solid #777;display:flex;align-items:center;justify-content:center;gap:3mm;padding:1mm 3mm;text-align:center}.nri-product-title img{width:14mm;height:14mm;object-fit:contain}.nri-product-title strong{font-size:24pt;line-height:.96;font-weight:1000}.nri-mini-strip{height:4.5mm;border-bottom:1px solid #777}.nri-mini-cell{display:flex;align-items:center;padding:.2mm 1.8mm;font-size:9pt;font-weight:700}.nri-mini-cell b{font-size:8.5pt;font-weight:1000;margin-right:1.3mm}.nri-validade{display:grid;grid-template-columns:31% 69%;height:28mm;border-bottom:1px solid #777;align-items:center}.nri-validade span{height:100%;display:flex;align-items:center;padding:1.5mm 2.5mm;border-right:1px solid #777;font-size:25pt;font-weight:1000}.nri-validade strong{font-size:58pt;line-height:.84;text-align:center;font-weight:1000;color:#4b4f54}.nri-validade strong.sem-validade{font-size:28pt;line-height:1}.nri-dates{display:grid;grid-template-columns:1fr 1fr;height:10mm;border-bottom:1px solid #777}.nri-date-cell{display:grid;grid-template-columns:auto 1fr;align-items:center}.nri-date-cell+.nri-date-cell{border-left:1px solid #777}.nri-date-cell b{padding:1mm 1.8mm;font-size:10.5pt}.nri-date-cell strong{text-align:center;padding:1mm 1.4mm;border-left:1px solid #777;font-size:13.5pt}.nri-meta{display:grid;grid-template-columns:1.55fr .85fr 1.15fr 1fr;height:7mm;border-bottom:1px solid #777}.nri-meta-cell{text-align:center;border-right:1px solid #777;overflow:hidden}.nri-meta-cell:last-child{border-right:0}.nri-meta-cell b{display:block;padding:.08mm .6mm 0;font-size:7.8pt;text-decoration:underline}.nri-meta-cell span{display:block;padding:.05mm .6mm 0;font-size:9.6pt;font-weight:700;white-space:nowrap}.nri-bottom{display:grid;grid-template-columns:1.8fr .75fr 1.1fr;height:5.5mm}.nri-bottom>div{display:flex;align-items:center;padding:.2mm 1.6mm;font-size:9.5pt;font-weight:700;border-right:1px solid #777}.nri-bottom>div:last-child{border-right:0}</style></head><body>${pages}<script>function imgFallback(img,code,i){var ex=['png','jpg','jpeg','webp'];i=i||0;if(i>=ex.length){img.style.display='none';return;}img.onerror=function(){imgFallback(img,code,i+1)};img.src='${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/'+encodeURIComponent(code)+'.'+ex[i];}<\/script></body></html>`;}
async function loadNriHistory(){if(!hasPerm('NRI_HISTORY'))return;try{let q=sb.from('nris').select('*').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(2000);const {data,error}=await q;if(error)throw error;historyNris=(data||[]).map(mapNri);await loadNriDamageIndex(historyNris);renderNriHistory();}catch(e){toast(humanError(e),'error');}}
function filteredNriHistory(){const q=norm($('histNriBusca').value),status=$('histNriStatus').value,u=$('histNriUnidade').value,de=$('histNriDe').value,ate=$('histNriAte').value;return historyNris.filter(x=>(!status||x.status===status)&&(!u||x.unidade===u)&&(!de||String(x.created_at).slice(0,10)>=de)&&(!ate||String(x.created_at).slice(0,10)<=ate)&&(!q||norm([x.nri,x.codigoProduto,x.nomeProduto,x.lote,x.placa,x.conferente,x.created_by_username,x.created_by_name].join(' ')).includes(q)));}
function renderNriHistory(){const arr=filteredNriHistory();$('tbodyHistNri').innerHTML=arr.length?arr.map(x=>{const hasDamage=nriDamageForRecord(x).length>0;return `<tr><td>${fmtDateTime(x.created_at)}</td><td><strong>${esc(x.nri)}</strong><small>${esc(x.codigoProduto)} • ${esc(x.nomeProduto)}</small></td><td>${esc(x.lote)}<small>${x.validade?fmtDate(x.validade):'Sem Validade'}</small></td><td>${esc(x.unidade)}<small>${esc(x.placa)} • ${esc(x.motorista)}</small></td><td>${nriDamageSummaryHtml(x)}</td><td>${esc(x.created_by_name||x.created_by_username||'—')}<small>${esc(x.conferente)}</small></td><td>${statusBadge(x.status)}</td><td><div class="mini-actions"><button class="mini-btn" data-act="preview" data-id="${x.id}">Ver NRI</button>${hasDamage?`<button class="mini-btn danger" data-act="damage" data-id="${x.id}">Ver avaria</button>`:''}${hasPerm('NRI_PRINT')?`<button class="mini-btn" data-act="reprint" data-id="${x.id}">Reimprimir</button>`:''}</div></td></tr>`;}).join(''):'<tr><td colspan="8">Nenhum registro.</td></tr>';}
function onNriHistoryClick(e){const b=e.target.closest('button[data-act]');if(!b)return;const r=historyNris.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.act==='preview')showNriPreview(r);else if(b.dataset.act==='damage')showNriDamageDetail(r);else if(b.dataset.act==='reprint')startPrint([r],true);}

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
function renderDeliveryCustomerMatches(matches){
  const wrap=$('avClienteDuplicado'),sel=$('avClienteEscolha');if(!wrap||!sel)return;
  sel.innerHTML='';
  if(!matches.length){wrap.classList.add('hidden');showCustomer(null);return;}
  if(matches.length===1){wrap.classList.add('hidden');showCustomer(matches[0]);return;}
  showCustomer(null);$('avClienteNome').textContent=`${matches.length} clientes encontrados — selecione abaixo`;
  sel.innerHTML='<option value="">Selecione o cliente</option>'+matches.map(c=>`<option value="${esc(customerKey(c))}">${esc(c.name)} • ${esc(c.city||'—')} • ${esc(c.branch||'Sem filial')}</option>`).join('');wrap.classList.remove('hidden');
}
function onPdvInput(){
  selectedCustomerKey='';clearTimeout(deliveryCustomerLookupTimer);
  const code=normalizeCode($('avPdv').value),matches=currentCustomerMatches();
  renderDeliveryCustomerMatches(matches);
  if(!code||matches.length)return;
  const seq=++deliveryCustomerLookupSeq;$('avClienteNome').textContent='Consultando cliente…';
  deliveryCustomerLookupTimer=setTimeout(async()=>{
    try{const found=await fetchCustomersByCode(code);if(seq!==deliveryCustomerLookupSeq||normalizeCode($('avPdv').value)!==code)return;renderDeliveryCustomerMatches(found);}
    catch(e){if(seq===deliveryCustomerLookupSeq&&normalizeCode($('avPdv').value)===code){renderDeliveryCustomerMatches([]);console.warn('Busca direta PDV',e);}}
  },300);
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
function deliveryDamageProductLabel(p){return p?`${p.code} - ${p.name}`:'';}
function hideDeliveryDamageProductOptions(){
  const box=$('avProductOptions'),input=$('avProduto');if(box)box.classList.add('hidden');if(input)input.setAttribute('aria-expanded','false');deliveryDamageProductActiveIndex=-1;
}
function renderDeliveryDamageProductSelection(){
  const info=$('avProductSelected'),clear=$('btnAvProductClear');if(!info)return;
  if(!deliveryDamageSelectedProduct){info.className='sales-product-selected muted';info.textContent='Digite para pesquisar e selecione um produto da base.';clear?.classList.add('hidden');return;}
  const p=deliveryDamageSelectedProduct;info.className='sales-product-selected chosen';info.innerHTML=`<span class="sales-product-selected-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span><small>CODIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span>`;clear?.classList.remove('hidden');hydrateSalesDamageProductImages(info);
}
function renderDeliveryDamageProductOptions(query=''){
  const box=$('avProductOptions'),input=$('avProduto');if(!box||!input)return;
  const {total,rows}=salesDamageProductSearch(query);deliveryDamageProductActiveIndex=-1;
  if(!refs.products.length){box.innerHTML='<div class="sales-product-empty">Base de produtos ainda esta carregando.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  if(!rows.length){box.innerHTML='<div class="sales-product-empty">Nenhum produto encontrado na base.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  const options=rows.map((p,i)=>`<button type="button" class="sales-product-option" role="option" data-delivery-product-code="${esc(p.code)}" data-delivery-product-index="${i}"><span class="sales-product-option-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span class="sales-product-option-text"><small>CODIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span></button>`).join('');
  const footer=total>rows.length?`<div class="sales-product-footer">${rows.length} de ${total} resultados - continue digitando para refinar</div>`:`<div class="sales-product-footer">${total} produto${total===1?'':'s'} encontrado${total===1?'':'s'}</div>`;
  box.innerHTML=options+footer;box.classList.remove('hidden');input.setAttribute('aria-expanded','true');hydrateSalesDamageProductImages(box);
}
function selectDeliveryDamageProduct(p){
  if(!p)return;deliveryDamageSelectedProduct={code:String(p.code),name:sanitizeRefText(p.name)};const input=$('avProduto');if(input)input.value=deliveryDamageProductLabel(deliveryDamageSelectedProduct);renderDeliveryDamageProductSelection();hideDeliveryDamageProductOptions();
}
function clearDeliveryDamageProductSelection(focus=false){
  deliveryDamageSelectedProduct=null;const input=$('avProduto');if(input)input.value='';renderDeliveryDamageProductSelection();hideDeliveryDamageProductOptions();if(focus)input?.focus();
}
function onDeliveryDamageProductInput(e){
  const value=String(e?.target?.value||'');if(deliveryDamageSelectedProduct&&value!==deliveryDamageProductLabel(deliveryDamageSelectedProduct)){deliveryDamageSelectedProduct=null;renderDeliveryDamageProductSelection();}
  clearTimeout(deliveryDamageProductSearchTimer);deliveryDamageProductSearchTimer=setTimeout(()=>renderDeliveryDamageProductOptions(value),60);
}
function onDeliveryDamageProductOptionClick(e){const b=e.target.closest('[data-delivery-product-code]');if(!b)return;selectDeliveryDamageProduct(productsByCode.get(String(b.dataset.deliveryProductCode)));}
function deliveryDamageProductMoveActive(delta){
  const box=$('avProductOptions');if(!box||box.classList.contains('hidden'))return false;const rows=[...box.querySelectorAll('.sales-product-option')];if(!rows.length)return false;
  deliveryDamageProductActiveIndex=Math.max(0,Math.min(rows.length-1,deliveryDamageProductActiveIndex+delta));rows.forEach((x,i)=>x.classList.toggle('active',i===deliveryDamageProductActiveIndex));rows[deliveryDamageProductActiveIndex]?.scrollIntoView({block:'nearest'});return true;
}
function onDeliveryDamageProductKeydown(e){
  if(e.key==='ArrowDown'){e.preventDefault();if($('avProductOptions')?.classList.contains('hidden'))renderDeliveryDamageProductOptions(e.target.value);deliveryDamageProductMoveActive(1);}
  else if(e.key==='ArrowUp'){e.preventDefault();deliveryDamageProductMoveActive(-1);}
  else if(e.key==='Enter'&&!$('avProductOptions')?.classList.contains('hidden')){const rows=[...$('avProductOptions').querySelectorAll('.sales-product-option')],b=rows[deliveryDamageProductActiveIndex>=0?deliveryDamageProductActiveIndex:0];if(b){e.preventDefault();selectDeliveryDamageProduct(productsByCode.get(String(b.dataset.deliveryProductCode)));}}
  else if(e.key==='Escape')hideDeliveryDamageProductOptions();
}
function addAvariaItem(){
  const selected=deliveryDamageSelectedProduct,product=deliveryDamageProductLabel(selected),lot=sanitizeLot($('avLote').value),quantity=num($('avQuantidade').value),unit=$('avUnidade').value,reason=$('avMotivo').value;
  if(!selected)return toast('Selecione um produto valido da base.','error');
  if(!lot||quantity<=0||!unit||!reason)return toast('Preencha lote, quantidade, unidade e motivo.','error');
  if(!avPhotos.length)return toast('Adicione ao menos uma foto da avaria.','error');
  if(avPhotos.some(p=>!p.gps))return toast('Todas as fotos precisam ter localização GPS.','error');
  const id=avariaEditingId||uuid();
  const item={id,product,product_code:selected.code,product_name:selected.name,lot,quantity,unit,reason,photos:avPhotos.map(p=>({...p}))};
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
  el.innerHTML=avariaItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto • Código ${esc(x.product_code||'—')}</small><strong>${esc(x.product_name||x.product)}</strong></div><div class="info"><small>Lote(s)</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)} ${esc(x.unit)}</strong></div><div class="info"><small>Motivo</small><strong>${esc(x.reason)}</strong></div><div class="info"><small>Evidências</small><strong>${x.photos.length} foto(s) • GPS ✓</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
}
function onAvariaItemListClick(e){
  const b=e.target.closest('button[data-act]');if(!b)return;const item=avariaItems.find(x=>x.id===b.closest('[data-id]').dataset.id);if(!item)return;
  if(b.dataset.act==='del'){(item.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);});avariaItems=avariaItems.filter(x=>x.id!==item.id);renderAvariaItems();return;}
  avariaEditingId=item.id;const picked=item.product_code?productsByCode.get(String(item.product_code)):refs.products.find(p=>norm(p.name)===norm(item.product_name||item.product));deliveryDamageSelectedProduct=picked?{code:String(picked.code),name:picked.name}:item.product_code?{code:String(item.product_code),name:item.product_name||item.product}:null;$('avProduto').value=deliveryDamageSelectedProduct?deliveryDamageProductLabel(deliveryDamageSelectedProduct):(item.product_name||item.product||'');renderDeliveryDamageProductSelection();hideDeliveryDamageProductOptions();$('avLote').value=sanitizeLot(item.lot);$('avQuantidade').value=item.quantity;$('avUnidade').value=item.unit;$('avMotivo').value=item.reason;
  avPhotos=(item.photos||[]).map(p=>({...p}));renderAvariaPhotoGallery();$('btnAdicionarAvItem').textContent='Salvar alteração';$('btnCancelarAvItem').classList.remove('hidden');
}
function clearAvariaItemEditor(revoke=true){
  avariaEditingId=null;
  if(revoke){const used=new Set(avariaItems.flatMap(x=>(x.photos||[]).map(p=>p.previewUrl)));avPhotos.forEach(p=>{if(p.previewUrl&&!used.has(p.previewUrl))URL.revokeObjectURL(p.previewUrl);});}
  avPhotos=[];['avLote','avQuantidade','avMotivo'].forEach(id=>$(id).value='');clearDeliveryDamageProductSelection(false);$('avUnidade').value='UNIDADE';$('avFotoCamera').value='';renderAvariaPhotoGallery();$('btnAdicionarAvItem').textContent='+ Adicionar produto';$('btnCancelarAvItem').classList.add('hidden');
}
function clearAvariaRequest(){
  avariaItems.forEach(x=>(x.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);}));avariaItems=[];renderAvariaItems();clearAvariaItemEditor(false);$('avData').value=localIsoDate(new Date());$('avEntregador').value=profile?.name||'';['avPdv','avMapa'].forEach(id=>$(id).value='');$('avClienteNome').textContent='Digite um código';$('avClienteCodigo').textContent='—';$('avCidade').textContent='—';$('avMapaResumo').textContent='—';selectedCustomerKey='';$('avClienteEscolha').innerHTML='';$('avClienteDuplicado').classList.add('hidden');clearSignature();
}
async function submitAvaria(e){
  e.preventDefault();
  let customer=selectedCustomer();
  if(!customer){
    const code=normalizeCode($('avPdv').value);
    if(code){try{const found=await fetchCustomersByCode(code);renderDeliveryCustomerMatches(found);customer=selectedCustomer();}catch(err){console.warn('Busca PDV ao salvar avaria',err);}}
  }
  if(!customer)return toast(currentCustomerMatches().length>1?'Selecione qual cliente corresponde ao PDV informado.':'Informe um PDV válido.','error');if(!$('avMapa').value.trim())return toast('Informe o mapa.','error');if(!avariaItems.length)return toast('Adicione ao menos um produto avariado.','error');if(!signatureDirty)return toast('A assinatura do cliente é obrigatória.','error');const btn=$('btnSalvarAvaria');btn.disabled=true;btn.textContent='Enviando…';
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
    const payload={unit:activeUnit,date:$('avData').value,customer_code:customer.code,customer_name:customer.name,city:customer.city,map_number:$('avMapa').value.trim(),signature_path:signaturePath,items:uploaded.map(x=>{const first=x.photos[0];return {product:x.product,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photos:x.photos,photo_path:first.photo_path,latitude:first.latitude,longitude:first.longitude,accuracy:first.accuracy,gps_at:first.gps_at};})};
    const {error}=await sb.rpc('create_damage_request',{p_payload:payload});if(error)throw error;toast('Avaria registrada com sucesso.','success');clearAvariaRequest();
  }catch(err){toast(humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar requisição';}
}
async function uploadStorage(path,blob){const {error}=await sb.storage.from('avarias').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
let adminAvarias=[];let lotNriMap=new Map();
async function loadAdminAvarias(silent=false){
  if(!hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))return;
  try{
    const {data,error}=await sb.from('damage_requests').select('*,damage_items(*,damage_item_photos(*))').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(1000);
    if(error)throw error;adminAvarias=data||[];
    const lots=[...new Set(adminAvarias.flatMap(r=>r.damage_items||[]).map(i=>String(i.lot||'').toUpperCase()).filter(Boolean))];lotNriMap=new Map();
    if(lots.length){for(const chunk of chunks(lots,100)){const q=await sb.from('nris').select('nri,lot,product_code,product_name,validity_date,unit').eq('unit',activeUnit).in('lot',chunk);if(q.error)throw q.error;(q.data||[]).forEach(n=>{const k=String(n.lot).toUpperCase();if(!lotNriMap.has(k))lotNriMap.set(k,[]);lotNriMap.get(k).push(n);});}}
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
  $('tbodyAvariasAdmin').innerHTML=arr.length?arr.map(r=>{const items=r.damage_items||[],matches=items.filter(i=>lotNriMap.has(deliveryDamageLotKey(i))).length,photos=items.reduce((n,i)=>n+itemEvidencePhotos(i).length,0);return `<tr><td>${fmtDate(r.occurrence_date)}<strong>PDV ${esc(r.customer_code)} • ${esc(r.customer_name)}</strong><small>${esc(r.city)} • Mapa ${esc(r.map_number)}</small></td><td>${esc(r.delivery_name)}</td><td><strong>${items.length} produto(s)</strong><small>${photos} foto(s)</small></td><td>${matches===items.length&&items.length?'<span class="status ok">Todos compatíveis</span>':matches?'<span class="status partial">Parcial</span>':'<span class="status bad">Não encontrados</span>'}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-id="${r.id}">Visualizar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhuma avaria.</td></tr>';
}
function exportDeliveryDamageCsv(){
  const requests=filteredAdminAvarias();
  if(!requests.length)return toast('Nao ha avarias de entrega para exportar com os filtros atuais.','error');
  const headers=['Data ocorrencia','Data/hora cadastro','Unidade','Codigo PDV','Cliente','Cidade','Mapa','Motorista','Status solicitacao','Produto','Lote','Quantidade','Unidade quantidade','Motivo','Status produto','NRI(s) compativel(is)','Qtd. fotos','Decisao por','Data decisao','Justificativa decisao','Lancado por','Data lancamento','Entregue por','Data entrega'];
  const rows=[];
  requests.forEach(r=>{
    const items=[...(r.damage_items||[])].sort((a,b)=>Number(a.item_order||0)-Number(b.item_order||0));
    if(!items.length){rows.push([r.occurrence_date||'',fmtDateTime(r.created_at),r.unit||'',r.customer_code||'',r.customer_name||'',r.city||'',r.map_number||'',r.delivery_name||'',r.status||'','','','','','','','','','','','','','','','']);return;}
    items.forEach(i=>{
      const nris=(lotNriMap.get(deliveryDamageLotKey(i))||[]).map(n=>n.nri).filter(Boolean).join(', ');
      rows.push([r.occurrence_date||'',fmtDateTime(r.created_at),r.unit||'',r.customer_code||'',r.customer_name||'',r.city||'',r.map_number||'',r.delivery_name||'',r.status||'',i.product_text||'',i.lot||'',i.quantity??'',i.quantity_unit||'',i.reason||'',i.status||'',nris,itemEvidencePhotos(i).length,i.reviewer_name||'',i.reviewed_at?fmtDateTime(i.reviewed_at):'',i.review_note||'',i.launched_by_name||'',i.launched_at?fmtDateTime(i.launched_at):'',i.delivered_by_name||'',i.delivered_at?fmtDateTime(i.delivered_at):'']);
    });
  });
  downloadCsv(`avarias_entrega_${activeUnit?norm(activeUnit).replace(/[^a-z0-9]+/g,'_')+'_':''}${localIsoDate(new Date())}.csv`,[headers,...rows]);
}
function onAdminAvariaClick(e){const b=e.target.closest('button[data-id]');if(!b)return;showAvariaDetail(b.dataset.id);}
async function showAvariaDetail(id){
  const r=adminAvarias.find(x=>x.id===id);if(!r)return;currentAvariaDetail=r;const items=r.damage_items||[];
  const paths=[r.signature_path,...items.flatMap(i=>itemEvidencePhotos(i).map(p=>p.photo_path))].filter(Boolean);
  const signedPairs=await Promise.all(paths.map(async path=>{const {data}=await sb.storage.from('avarias').createSignedUrl(path,3600);return [path,data?.signedUrl||''];}));
  const signed=new Map(signedPairs),signatureUrl=signed.get(r.signature_path)||'';
  const pending=items.filter(i=>i.status==='PENDENTE').length;
  const productsHtml=items.map((i,idx)=>{
    const match=lotNriMap.get(deliveryDamageLotKey(i))||[],photos=itemEvidencePhotos(i);
    const photoHtml=photos.map((p,pidx)=>`<div class="damage-photo-card"><div class="damage-photo-title"><strong>Foto ${pidx+1}</strong><span class="status ok">GPS ✓</span></div><img src="${esc(signed.get(p.photo_path)||'')}" alt="Foto ${pidx+1} da avaria"><iframe class="map-frame" src="https://www.google.com/maps?q=${encodeURIComponent(p.latitude+','+p.longitude)}&output=embed" loading="lazy"></iframe><small>GPS: ${p.latitude}, ${p.longitude} • ±${Math.round(p.gps_accuracy||0)} m</small></div>`).join('');
    return `<div class="damage-admin-item" data-item="${i.id}"><div class="damage-product-head"><label class="damage-check"><input type="checkbox" class="review-check" value="${i.id}" ${i.status==='PENDENTE'&&hasPerm('DELIVERY_DAMAGE_REVIEW')?'':'disabled'}><span></span></label><div><small>PRODUTO ${idx+1}</small><strong>${esc(i.product_text)}</strong></div>${statusBadge(i.status)}</div><div class="damage-summary-grid"><div><small>LOTE</small><strong>${esc(i.lot)}</strong></div><div><small>QUANTIDADE</small><strong>${fmtNum(i.quantity)} ${esc(i.quantity_unit)}</strong></div><div><small>MOTIVO</small><strong>${esc(i.reason)}</strong></div><div><small>EVIDÊNCIAS</small><strong>${photos.length} foto(s)</strong></div></div><div class="damage-lot-row">${match.length?`<span class="status ok">Lote compatível</span><span>${match.slice(0,4).map(n=>esc(n.nri)).join(', ')}</span>`:'<span class="status bad">Lote não encontrado</span>'}</div><details class="damage-evidence"><summary><span>Ver evidências</span><small>${photos.length} foto(s) • localização por foto</small></summary><div class="damage-photo-grid">${photoHtml||'<div class="empty-state">Sem foto disponível.</div>'}</div></details></div>`;
  }).join('');
  const body=`<div class="damage-request-hero"><div><small>OCORRÊNCIA</small><strong>PDV ${esc(r.customer_code)} · ${esc(r.customer_name)}</strong><span>${esc(r.city)} • Mapa ${esc(r.map_number)} • ${esc(r.delivery_name)}</span></div><div class="damage-counts"><b>${items.length}</b><span>produtos</span><b>${pending}</b><span>pendentes</span></div></div><div class="detail-grid damage-request-grid"><div class="detail-card"><small>PDV</small><strong>${esc(r.customer_name)}</strong></div><div class="detail-card"><small>Código</small><strong>${esc(r.customer_code)}</strong></div><div class="detail-card"><small>Cidade</small><strong>${esc(r.city)}</strong></div><div class="detail-card"><small>Mapa</small><strong>${esc(r.map_number)}</strong></div><div class="detail-card"><small>Motorista</small><strong>${esc(r.delivery_name)}</strong></div></div><div class="damage-selection-bar"><span id="avariaSelectionSummary">0 selecionados</span><small>Marque os produtos pendentes para aprovar ou reprovar.</small></div>${productsHtml}<details class="signature-details"><summary>Ver assinatura do cliente</summary><img src="${esc(signatureUrl)}" alt="Assinatura"></details>`;
  openModal(`Avaria • PDV ${r.customer_code}`,`${fmtDate(r.occurrence_date)} • ${r.delivery_name}`,body,hasPerm('DELIVERY_DAMAGE_REVIEW')?[{label:'Reprovar selecionados',class:'danger',onClick:()=>reviewAvaria('REPROVADO',false)},{label:'Aprovar selecionados',class:'success',onClick:()=>reviewAvaria('APROVADO',false)},{label:'Aprovar todos pendentes',class:'primary',onClick:()=>reviewAvaria('APROVADO',true)}]:[]);
  const updateSelection=()=>{const n=$('modalBody').querySelectorAll('.review-check:checked').length;const el=$('avariaSelectionSummary');if(el)el.textContent=`${n} selecionado${n===1?'':'s'}`;};
  $('modalBody').querySelectorAll('.review-check').forEach(c=>c.addEventListener('change',updateSelection));
}
async function reviewAvaria(status,all){if(!currentAvariaDetail)return;let ids;if(all)ids=(currentAvariaDetail.damage_items||[]).filter(i=>i.status==='PENDENTE').map(i=>i.id);else ids=[...$('modalBody').querySelectorAll('.review-check:checked')].map(x=>x.value);if(!ids.length)return toast('Selecione ao menos um produto pendente.','error');let note='';if(status==='REPROVADO'){const x=prompt('Observação da reprovação (opcional):','');if(x===null)return;note=x;}try{const {error}=await sb.rpc('review_damage_items',{p_item_ids:ids,p_status:status,p_note:note});if(error)throw error;toast(`${ids.length} produto(s) atualizado(s).`,'success');closeModal();await loadAdminAvarias(true);}catch(e){toast(humanError(e),'error');}}

// AVARIAS DE VENDAS ----------------------------------------------------------
function salesCustomerKey(c){return String(c?.id||customerKey(c));}
function salesDamageCustomerMatches(){return customersByCode.get(normalizeCode($('salesDamagePdv')?.value||''))||[];}
function selectedSalesCustomer(){
  const matches=salesDamageCustomerMatches();
  if(matches.length===1)return matches[0];
  if(!selectedSalesCustomerKey)return null;
  return matches.find(c=>salesCustomerKey(c)===selectedSalesCustomerKey)||null;
}
function showSalesDamageCustomer(c){
  const typed=normalizeCode($('salesDamagePdv')?.value||'');
  if($('salesDamageCustomerName'))$('salesDamageCustomerName').textContent=c?.name||(typed?'Cliente não localizado':'Digite um código');
  if($('salesDamageCustomerCode'))$('salesDamageCustomerCode').textContent=c?.code||typed||'—';
  if($('salesDamageCustomerCity'))$('salesDamageCustomerCity').textContent=c?.city||'—';
  if($('salesDamageCustomerBranch'))$('salesDamageCustomerBranch').textContent=c?.branch||'—';
}
function renderSalesDamageCustomerMatches(matches){
  const wrap=$('salesDamageCustomerDuplicate'),sel=$('salesDamageCustomerChoice');if(!wrap||!sel)return;
  sel.innerHTML='<option value="">Selecione o cliente</option>';
  if(!matches.length){wrap.classList.add('hidden');showSalesDamageCustomer(null);return;}
  if(matches.length===1){wrap.classList.add('hidden');selectedSalesCustomerKey=salesCustomerKey(matches[0]);showSalesDamageCustomer(matches[0]);return;}
  showSalesDamageCustomer(null);$('salesDamageCustomerName').textContent=`${matches.length} clientes encontrados — selecione abaixo`;
  sel.innerHTML='<option value="">Selecione o cliente</option>'+matches.map(c=>`<option value="${esc(salesCustomerKey(c))}">${esc(c.name)} • ${esc(c.city||'—')} • ${esc(c.branch||'Sem filial')}</option>`).join('');wrap.classList.remove('hidden');
}
function onSalesDamagePdvInput(){
  selectedSalesCustomerKey='';clearTimeout(salesCustomerLookupTimer);
  const code=normalizeCode($('salesDamagePdv')?.value||''),matches=salesDamageCustomerMatches();
  renderSalesDamageCustomerMatches(matches);
  if(!code||matches.length)return;
  const seq=++salesCustomerLookupSeq;if($('salesDamageCustomerName'))$('salesDamageCustomerName').textContent='Consultando cliente…';
  salesCustomerLookupTimer=setTimeout(async()=>{
    try{const found=await fetchCustomersByCode(code);if(seq!==salesCustomerLookupSeq||normalizeCode($('salesDamagePdv')?.value||'')!==code)return;renderSalesDamageCustomerMatches(found);}
    catch(e){if(seq===salesCustomerLookupSeq&&normalizeCode($('salesDamagePdv')?.value||'')===code){renderSalesDamageCustomerMatches([]);console.warn('Busca direta PDV vendas',e);}}
  },300);
}
function onSalesDamageCustomerChoice(){selectedSalesCustomerKey=$('salesDamageCustomerChoice')?.value||'';showSalesDamageCustomer(selectedSalesCustomer());}
function salesDamageProductLabel(p){return p?`${p.code} - ${p.name}`:'';}
function salesDamageProductSearch(query){
  const clean=v=>norm(v).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const q=clean(query),tokens=q.split(' ').filter(Boolean),rows=[];
  for(const p of refs.products){
    const code=String(p.code||''),name=clean(p.name),hay=`${code} ${name}`;
    if(tokens.length&&!tokens.every(t=>hay.includes(t)))continue;
    let score=9;
    if(q){
      if(code===q)score=0;
      else if(code.startsWith(q))score=1;
      else if(name===q)score=2;
      else if(name.startsWith(q))score=3;
      else if(name.split(/\s+/).some(w=>w.startsWith(q)))score=4;
      else score=5;
    }
    rows.push({p,score});
  }
  rows.sort((a,b)=>a.score-b.score||a.p.name.localeCompare(b.p.name,'pt-BR')||String(a.p.code).localeCompare(String(b.p.code),'pt-BR',{numeric:true}));
  const limit=q.length>=2?SALES_DAMAGE_PRODUCT_RENDER_LIMIT:SALES_DAMAGE_PRODUCT_INITIAL_LIMIT;
  return {total:rows.length,rows:rows.slice(0,limit).map(x=>x.p)};
}
function setSalesDamageProductImage(img,code){
  if(!img)return;
  const placeholder=img.parentElement?.querySelector('.sales-product-no-image'),ext=['png','jpg','jpeg','webp'];let i=0;
  placeholder?.classList.add('hidden');img.classList.remove('hidden');
  const next=()=>{if(i>=ext.length){img.removeAttribute('src');img.classList.add('hidden');placeholder?.classList.remove('hidden');return;}img.onload=()=>{img.onload=null;img.onerror=null;placeholder?.classList.add('hidden');img.classList.remove('hidden');};img.onerror=()=>{i++;next();};img.src=`${CFG.PRODUCT_IMAGE_FOLDER||'imagens_produtos'}/${encodeURIComponent(code)}.${ext[i]}`;};next();
}
function hydrateSalesDamageProductImages(root=document){
  root.querySelectorAll?.('img[data-sales-product-image]').forEach(img=>setSalesDamageProductImage(img,img.dataset.salesProductImage));
}
function hideSalesDamageProductOptions(){
  const box=$('salesDamageProductOptions'),input=$('salesDamageProduct');if(box)box.classList.add('hidden');if(input)input.setAttribute('aria-expanded','false');salesDamageProductActiveIndex=-1;
}
function renderSalesDamageProductSelection(){
  const info=$('salesDamageProductSelected'),clear=$('btnSalesDamageProductClear');if(!info)return;
  if(!salesDamageSelectedProduct){info.className='sales-product-selected muted';info.textContent='Digite para pesquisar e selecione um produto da base.';clear?.classList.add('hidden');return;}
  const p=salesDamageSelectedProduct;info.className='sales-product-selected chosen';info.innerHTML=`<span class="sales-product-selected-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span><small>CÓDIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span>`;clear?.classList.remove('hidden');hydrateSalesDamageProductImages(info);
}
function renderSalesDamageProductOptions(query=''){
  const box=$('salesDamageProductOptions'),input=$('salesDamageProduct');if(!box||!input)return;
  const {total,rows}=salesDamageProductSearch(query);
  salesDamageProductActiveIndex=-1;
  if(!refs.products.length){box.innerHTML='<div class="sales-product-empty">Base de produtos ainda está carregando.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  if(!rows.length){box.innerHTML='<div class="sales-product-empty">Nenhum produto encontrado na base.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  const options=rows.map((p,i)=>`<button type="button" class="sales-product-option" role="option" data-sales-product-code="${esc(p.code)}" data-sales-product-index="${i}"><span class="sales-product-option-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span class="sales-product-option-text"><small>CÓDIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span></button>`).join('');
  const footer=total>rows.length?`<div class="sales-product-footer">${rows.length} de ${total} resultados • continue digitando para refinar</div>`:`<div class="sales-product-footer">${total} produto${total===1?'':'s'} encontrado${total===1?'':'s'}</div>`;
  box.innerHTML=options+footer;box.classList.remove('hidden');input.setAttribute('aria-expanded','true');hydrateSalesDamageProductImages(box);
}
function selectSalesDamageProduct(p){
  if(!p)return;salesDamageSelectedProduct={code:String(p.code),name:sanitizeRefText(p.name)};const input=$('salesDamageProduct');if(input)input.value=salesDamageProductLabel(salesDamageSelectedProduct);renderSalesDamageProductSelection();hideSalesDamageProductOptions();
}
function clearSalesDamageProductSelection(focus=false){
  salesDamageSelectedProduct=null;const input=$('salesDamageProduct');if(input)input.value='';renderSalesDamageProductSelection();hideSalesDamageProductOptions();if(focus)input?.focus();
}
function onSalesDamageProductInput(e){
  const value=String(e?.target?.value||'');if(salesDamageSelectedProduct&&value!==salesDamageProductLabel(salesDamageSelectedProduct)){salesDamageSelectedProduct=null;renderSalesDamageProductSelection();}
  clearTimeout(salesDamageProductSearchTimer);salesDamageProductSearchTimer=setTimeout(()=>renderSalesDamageProductOptions(value),60);
}
function onSalesDamageProductOptionClick(e){
  const b=e.target.closest('[data-sales-product-code]');if(!b)return;selectSalesDamageProduct(productsByCode.get(String(b.dataset.salesProductCode)));
}
function salesDamageProductMoveActive(delta){
  const box=$('salesDamageProductOptions');if(!box||box.classList.contains('hidden'))return false;const rows=[...box.querySelectorAll('.sales-product-option')];if(!rows.length)return false;
  salesDamageProductActiveIndex=Math.max(0,Math.min(rows.length-1,salesDamageProductActiveIndex+delta));rows.forEach((x,i)=>x.classList.toggle('active',i===salesDamageProductActiveIndex));rows[salesDamageProductActiveIndex]?.scrollIntoView({block:'nearest'});return true;
}
function onSalesDamageProductKeydown(e){
  if(e.key==='ArrowDown'){e.preventDefault();if($('salesDamageProductOptions')?.classList.contains('hidden'))renderSalesDamageProductOptions(e.target.value);salesDamageProductMoveActive(1);}
  else if(e.key==='ArrowUp'){e.preventDefault();salesDamageProductMoveActive(-1);}
  else if(e.key==='Enter'&&!$('salesDamageProductOptions')?.classList.contains('hidden')){const rows=[...$('salesDamageProductOptions').querySelectorAll('.sales-product-option')],b=rows[salesDamageProductActiveIndex>=0?salesDamageProductActiveIndex:0];if(b){e.preventDefault();selectSalesDamageProduct(productsByCode.get(String(b.dataset.salesProductCode)));}}
  else if(e.key==='Escape')hideSalesDamageProductOptions();
}
function prepareSalesDamageForm(){
  if(!$('salesDamageDate'))return;
  $('salesDamageDate').value=localIsoDate(new Date());$('salesDamageSeller').value=profile?.name||'';updateSalesDamageValidityMode();renderSalesDamageProductSelection();renderSalesDamagePhoto();renderSalesDamageItems();
}
function salesDamagePhotoLimit(){return $('salesDamageReason')?.value==='VALIDADE'?2:1;}
function updateSalesDamageValidityMode(){
  const validity=$('salesDamageValidity'),wrap=$('salesDamageValidityWrap'),needed=$('salesDamageReason')?.value==='VALIDADE';if(!validity||!wrap)return;
  wrap.classList.toggle('hidden',!needed);validity.required=needed;if(!needed)validity.value='';
  const max=salesDamagePhotoLimit();
  if(salesDamagePhotos.length>max){const removed=salesDamagePhotos.slice(max);removed.forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);});salesDamagePhotos=salesDamagePhotos.slice(0,max);toast('Para este motivo é permitida apenas 1 foto. A foto excedente foi removida.','');}
  renderSalesDamagePhoto();
}
async function onSalesDamagePhoto(e){
  const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;
  const max=salesDamagePhotoLimit(),remaining=max-salesDamagePhotos.length;if(remaining<=0)return toast(`O limite para este motivo é de ${max} foto${max===1?'':'s'}.`,'error');
  for(const file of files.slice(0,remaining)){
    const sourceKey=`${file.name}|${file.size}|${file.lastModified}`;if(salesDamagePhotos.some(p=>p.sourceKey===sourceKey)){toast('Esta foto já foi adicionada.','error');continue;}
    let previewUrl='';
    try{
      if($('salesDamageGpsStatus')){$('salesDamageGpsStatus').className='gps-status';$('salesDamageGpsStatus').textContent=`Preparando foto ${salesDamagePhotos.length+1} e capturando GPS…`;}
      const blob=await compressImage(file,1280,.78);previewUrl=URL.createObjectURL(blob);const gps=await captureGps({useRecent:false});
      salesDamagePhotos.push({id:uuid(),blob,previewUrl,gps,sourceKey,fileName:file.name});renderSalesDamagePhoto();
    }catch(err){if(previewUrl)URL.revokeObjectURL(previewUrl);if($('salesDamageGpsStatus')){$('salesDamageGpsStatus').className='gps-status error';$('salesDamageGpsStatus').textContent=`Foto não adicionada: ${humanGpsError(err)}`;}toast(humanGpsError(err),'error');}
  }
}
function renderSalesDamagePhoto(){
  const box=$('salesDamagePhotoPreview'),st=$('salesDamagePhotoStatus'),gpsSt=$('salesDamageGpsStatus');if(!box||!st)return;const max=salesDamagePhotoLimit();
  st.textContent=`${salesDamagePhotos.length}/${max} foto${max===1?'':'s'}`;
  if(!salesDamagePhotos.length){box.className='photo-gallery empty';box.innerHTML='<span>Nenhuma foto adicionada.</span>';if(gpsSt){gpsSt.className='gps-status';gpsSt.textContent='Abra a câmera para tirar a foto e capturar a localização.';}return;}
  box.className='photo-gallery';box.innerHTML=salesDamagePhotos.map((p,i)=>`<div class="photo-thumb sales-photo-thumb"><img src="${esc(p.previewUrl)}" alt="Foto ${i+1} do produto"><div><strong>Foto ${i+1}</strong><small>✓ GPS capturado • ±${Math.round(p.gps?.accuracy||0)} m</small></div><button type="button" class="photo-remove" data-sales-photo-remove="${esc(p.id)}" aria-label="Remover foto">×</button></div>`).join('');
  if(gpsSt){gpsSt.className='gps-status ok';gpsSt.textContent=`${salesDamagePhotos.length} foto${salesDamagePhotos.length===1?'':'s'} com localização GPS capturada.`;}
}
function onSalesDamagePhotoPreviewClick(e){const b=e.target.closest('[data-sales-photo-remove]');if(!b)return;const ph=salesDamagePhotos.find(p=>p.id===b.dataset.salesPhotoRemove);if(ph?.previewUrl)URL.revokeObjectURL(ph.previewUrl);salesDamagePhotos=salesDamagePhotos.filter(p=>p.id!==b.dataset.salesPhotoRemove);renderSalesDamagePhoto();}
function salesReasonLabel(code){return ({VALIDADE:'Validade',QUEBRADO:'Quebrado',EMBALAGEM:'Embalagem amassada/rasgada',FURADA:'Furada',SEM_TAMPA:'Sem tampa',MAL_CHEIA:'Mal cheia',OUTROS:'Outros'})[code]||code||'—';}
function addSalesDamageItem(){
  const selected=salesDamageSelectedProduct,quantity=num($('salesDamageQuantity')?.value),unit=$('salesDamageUnit')?.value||'',reason=$('salesDamageReason')?.value||'',validity=$('salesDamageValidity')?.value||'',maxPhotos=salesDamagePhotoLimit();
  if(!selected?.code)return toast('Selecione um produto da lista da base.','error');
  if(quantity<=0||!['CAIXA','UNIDADE'].includes(unit)||!reason)return toast('Preencha quantidade, unidade e motivo.','error');
  if(reason==='VALIDADE'&&!validity)return toast('Informe a data de validade para o motivo Validade.','error');
  if(!salesDamagePhotos.length)return toast('Tire ao menos uma foto do produto avariado.','error');
  if(salesDamagePhotos.length>maxPhotos)return toast(`O limite para este motivo é de ${maxPhotos} foto${maxPhotos===1?'':'s'}.`,'error');
  if(salesDamagePhotos.some(p=>!p.gps))return toast('Todas as fotos precisam ter localização GPS.','error');
  const product=salesDamageProductLabel(selected),id=salesDamageEditingId||uuid(),item={id,product,product_code:selected.code,product_name:selected.name,quantity,unit,reason,validity_date:reason==='VALIDADE'?validity:null,photos:salesDamagePhotos.map(p=>({...p}))};
  const idx=salesDamageItems.findIndex(x=>x.id===id);if(idx>=0){const keep=new Set(item.photos.map(p=>p.previewUrl));(salesDamageItems[idx]?.photos||[]).forEach(p=>{if(p.previewUrl&&!keep.has(p.previewUrl))URL.revokeObjectURL(p.previewUrl);});salesDamageItems[idx]=item;}else salesDamageItems.push(item);
  renderSalesDamageItems();clearSalesDamageItemEditor(false);
}
function renderSalesDamageItems(){
  const box=$('salesDamageItemList'),counter=$('salesDamageItemCounter');if(!box||!counter)return;counter.textContent=`${salesDamageItems.length} produto(s)`;
  if(!salesDamageItems.length){box.className='item-list empty-state';box.textContent='Nenhum produto adicionado.';return;}
  box.className='item-list';box.innerHTML=salesDamageItems.map(x=>`<div class="item-row sales-damage-row" data-sales-item="${x.id}"><div class="info"><small>Produto • Código ${esc(x.product_code||'—')}</small><strong>${esc(x.product_name||x.product)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)} ${x.unit==='CAIXA'?'Caixa':'Unidade'}${num(x.quantity)===1?'':'s'}</strong></div><div class="info"><small>Motivo</small><strong>${esc(salesReasonLabel(x.reason))}</strong>${x.validity_date?`<small>Validade ${fmtDate(x.validity_date)}</small>`:''}</div><div class="info sales-list-photo"><strong>${(x.photos||[]).length} foto(s)</strong><small>GPS ✓</small></div><div class="mini-actions"><button type="button" class="mini-btn" data-sales-act="edit">Editar</button><button type="button" class="mini-btn danger" data-sales-act="del">Excluir</button></div></div>`).join('');
}
function onSalesDamageItemListClick(e){
  const b=e.target.closest('[data-sales-act]');if(!b)return;const row=b.closest('[data-sales-item]'),item=salesDamageItems.find(x=>x.id===row?.dataset.salesItem);if(!item)return;
  if(b.dataset.salesAct==='del'){(item.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);});salesDamageItems=salesDamageItems.filter(x=>x.id!==item.id);if(salesDamageEditingId===item.id)clearSalesDamageItemEditor(false);renderSalesDamageItems();return;}
  salesDamageEditingId=item.id;const picked=item.product_code?productsByCode.get(String(item.product_code)):refs.products.find(p=>norm(p.name)===norm(item.product_name||item.product));salesDamageSelectedProduct=picked?{code:String(picked.code),name:picked.name}:item.product_code?{code:String(item.product_code),name:item.product_name||item.product}:null;$('salesDamageProduct').value=salesDamageSelectedProduct?salesDamageProductLabel(salesDamageSelectedProduct):(item.product_name||item.product||'');renderSalesDamageProductSelection();$('salesDamageQuantity').value=item.quantity;$('salesDamageUnit').value=item.unit;$('salesDamageReason').value=item.reason;$('salesDamageValidity').value=item.validity_date||'';salesDamagePhotos=(item.photos||[]).map(p=>({...p}));updateSalesDamageValidityMode();renderSalesDamagePhoto();$('btnSalesDamageAddItem').textContent='Salvar alteração';$('btnSalesDamageCancelItem').classList.remove('hidden');
}
function clearSalesDamageItemEditor(revoke=true){
  salesDamageEditingId=null;if(revoke){const used=new Set(salesDamageItems.flatMap(x=>(x.photos||[]).map(p=>p.previewUrl)));salesDamagePhotos.forEach(p=>{if(p.previewUrl&&!used.has(p.previewUrl))URL.revokeObjectURL(p.previewUrl);});}salesDamagePhotos=[];salesDamageSelectedProduct=null;
  ['salesDamageProduct','salesDamageQuantity','salesDamageReason','salesDamageValidity'].forEach(id=>{if($(id))$(id).value='';});if($('salesDamageUnit'))$('salesDamageUnit').value='CAIXA';hideSalesDamageProductOptions();renderSalesDamageProductSelection();updateSalesDamageValidityMode();renderSalesDamagePhoto();if($('btnSalesDamageAddItem'))$('btnSalesDamageAddItem').textContent='+ Adicionar produto';$('btnSalesDamageCancelItem')?.classList.add('hidden');
}
function clearSalesDamageRequest(){
  salesDamageItems.forEach(x=>(x.photos||[]).forEach(p=>{if(p.previewUrl)URL.revokeObjectURL(p.previewUrl);}));salesDamageItems=[];clearSalesDamageItemEditor(false);selectedSalesCustomerKey='';if($('salesDamagePdv'))$('salesDamagePdv').value='';if($('salesDamageObservation'))$('salesDamageObservation').value='';if($('salesDamageCustomerChoice'))$('salesDamageCustomerChoice').innerHTML='<option value="">Selecione o cliente</option>';$('salesDamageCustomerDuplicate')?.classList.add('hidden');showSalesDamageCustomer(null);prepareSalesDamageForm();
}
async function uploadSalesDamagePhoto(path,blob){const {error}=await sb.storage.from('avarias-vendas').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
async function submitSalesDamage(e){
  e.preventDefault();if(!hasPerm('SALES_DAMAGE_CREATE'))return;
  let customer=selectedSalesCustomer();
  if(!customer?.id){
    const code=normalizeCode($('salesDamagePdv')?.value||'');
    if(code){try{const found=await fetchCustomersByCode(code);renderSalesDamageCustomerMatches(found);customer=selectedSalesCustomer();}catch(err){console.warn('Busca PDV ao salvar avaria de vendas',err);}}
  }
  if(!customer?.id)return toast(salesDamageCustomerMatches().length>1?'Selecione o cliente / filial.':'Informe um PDV válido.','error');if(!salesDamageItems.length)return toast('Adicione ao menos um produto avariado.','error');
  const btn=$('btnSalesDamageSubmit'),old=btn.textContent,uploaded=[];btn.disabled=true;btn.textContent='Enviando…';
  try{
    const key=uuid(),items=[];
    for(let i=0;i<salesDamageItems.length;i++){const x=salesDamageItems[i],photos=[];for(let j=0;j<(x.photos||[]).length;j++){const ph=x.photos[j],path=`${authUser.id}/${key}/produto_${String(i+1).padStart(2,'0')}_foto_${String(j+1).padStart(2,'0')}.jpg`;await uploadSalesDamagePhoto(path,ph.blob);uploaded.push(path);photos.push({photo_path:path,latitude:ph.gps.latitude,longitude:ph.gps.longitude,accuracy:ph.gps.accuracy||'',gps_at:ph.gps.capturedAt});}items.push({product:x.product,quantity:x.quantity,unit:x.unit,reason:x.reason,validity_date:x.validity_date||'',photos,photo_path:photos[0]?.photo_path||''});}
    const observation=String($('salesDamageObservation')?.value||'').trim().slice(0,500);
    const {data,error}=await sb.rpc(
      'create_sales_damage_request',
      {
        p_payload:{
          unit:activeUnit,
          customer_id:customer.id,
          observation,
          items
        }
      }
    );

    if(error)throw error;

    // PostgREST pode entregar retorno composto como objeto
    // ou como uma lista com uma unica linha.
    const created=Array.isArray(data)
      ? (data[0]||null)
      : data;

    window.__lastSalesDamageCreateV170={
      at:new Date().toISOString(),
      raw:data,
      created
    };

    console.log(
      '[PUSH SALES] retorno create_sales_damage_request',
      {
        isArray:Array.isArray(data),
        created
      }
    );

    if(!created?.id){
      window.__lastPushDispatchV170={
        at:new Date().toISOString(),
        kind:'sales',
        requestId:null,
        stage:'rpc-result',
        data:null,
        error:'SOLICITACAO_SEM_ID_PARA_PUSH'
      };

      throw new Error('SOLICITACAO_SEM_ID_PARA_PUSH');
    }

    console.log(
      '[PUSH SALES] request ID',
      created.id
    );

    const pushOk=await dispatchDamagePushV170(
      'sales',
      created.id
    );

    const pushDiag=window.__lastPushDispatchV170||null;

    clearSalesDamageRequest();

    if(hasPerm('SALES_DAMAGE_VIEW_OWN')){
      await loadSalesDamageMy(true);
    }

    if(hasAnyPerm(
      'SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST'
    )){
      await loadSalesDamageManage(true);
    }

    if(pushOk){

      const enviados=Number(
        pushDiag?.data?.sent||0
      );

      toast(
        `Solicitacao ${created?.request_code||''} registrada. Push enviado para ${enviados} dispositivo(s).`,
        'success'
      );

    }
    else{

      const detalhe=String(
        pushDiag?.data?.error||
        pushDiag?.error||
        pushDiag?.exception||
        'falha sem detalhe'
      ).slice(0,180);

      toast(
        `Solicitacao ${created?.request_code||''} registrada, mas o Push falhou: ${detalhe}`,
        'error'
      );

    }
  }catch(err){if(uploaded.length)await sb.storage.from('avarias-vendas').remove(uploaded).catch(()=>{});toast(humanSalesDamageError(err),'error');}
  finally{btn.disabled=false;btn.textContent=old;}
}
async function loadSalesDamageMy(silent=false){
  if(!hasPerm('SALES_DAMAGE_VIEW_OWN'))return;try{const {data,error}=await sb.from('sales_damage_requests').select('*,sales_damage_items(*,sales_damage_item_photos(*))').eq('unit',activeUnit).eq('seller_id',authUser.id).order('created_at',{ascending:false}).limit(1000);if(error)throw error;salesDamageMyRequests=data||[];renderSalesDamageMy();}catch(e){if(!silent)toast(humanSalesDamageError(e),'error');}
}
function filterSalesDamageRows(rows,searchId,statusId){const q=norm($(searchId)?.value||''),status=$(statusId)?.value||'';return rows.filter(r=>(!status||r.status===status)&&(!q||norm([r.request_code,r.seller_name,r.customer_code,r.customer_name,r.city,r.branch,...(r.sales_damage_items||[]).flatMap(i=>[i.product_text,i.reason,i.review_justification,i.final_justification,i.admin_override_justification])].join(' ')).includes(q)));}
function salesDamageStatusLabel(status){return ({PENDENTE:'Pendente',EM_ANALISE:'Em análise',PARCIAL:'Parcial',APROVADO:'Aprovado',REPROVADO:'Reprovado',LANCADO:'Lançado'})[status]||status||'—';}
function salesRequestItemsSummary(r){const items=r.sales_damage_items||[],counts={};items.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);const open=(counts.PENDENTE||0)+(counts.EM_ANALISE||0)+(counts.APROVADO||0);return `<strong>${items.length} produto(s)</strong><small>${open?`${open} aguardando conclusão`:'Fluxo concluído'}</small>`;}
function renderSalesDamageMy(){const box=$('tbodySalesDamageMy');if(!box)return;const rows=filterSalesDamageRows(salesDamageMyRequests,'salesDamageMySearch','salesDamageMyStatus');box.innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.request_code)}</strong><small>${fmtDate(r.occurrence_date)} • ${fmtDateTime(r.created_at)}</small></td><td><strong>PDV ${esc(r.customer_code)}</strong><small>${esc(r.customer_name)} • ${esc(r.city||'—')}</small></td><td>${salesRequestItemsSummary(r)}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-sales-request="${r.id}">Visualizar</button></td></tr>`).join(''):'<tr><td colspan="5">Nenhuma solicitação encontrada.</td></tr>';}
async function loadSalesDamageManage(silent=false){
  if(!hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST'))return;try{const {data,error}=await sb.from('sales_damage_requests').select('*,sales_damage_items(*,sales_damage_item_photos(*))').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(2000);if(error)throw error;salesDamageManageRequests=data||[];renderSalesDamageManage();if($('badgeSalesDamage'))$('badgeSalesDamage').textContent=salesDamageManageRequests.filter(r=>(r.sales_damage_items||[]).some(i=>['PENDENTE','EM_ANALISE','APROVADO'].includes(i.status))).length;}catch(e){if(!silent)toast(humanSalesDamageError(e),'error');}
}
function renderSalesDamageManage(){const box=$('tbodySalesDamageManage');if(!box)return;const rows=filterSalesDamageRows(salesDamageManageRequests,'salesDamageManageSearch','salesDamageManageStatus');box.innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.request_code)}</strong><small>${fmtDate(r.occurrence_date)} • ${fmtDateTime(r.created_at)}</small></td><td><strong>${esc(r.seller_name)}</strong><small>${esc(r.seller_username||'')}</small></td><td><strong>PDV ${esc(r.customer_code)}</strong><small>${esc(r.customer_name)} • ${esc(r.city||'—')}</small></td><td>${salesRequestItemsSummary(r)}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-sales-request="${r.id}">Visualizar</button></td></tr>`).join(''):'<tr><td colspan="6">Nenhuma solicitação encontrada.</td></tr>';}
function exportSalesDamageCsv(){
  const requests=filterSalesDamageRows(salesDamageManageRequests,'salesDamageManageSearch','salesDamageManageStatus');
  if(!requests.length)return toast('Nao ha avarias de vendas para exportar com os filtros atuais.','error');
  const headers=['Solicitacao','Data ocorrencia','Data/hora cadastro','Unidade','Vendedor','Usuario vendedor','Codigo PDV','Cliente','Cidade','Filial','Observacao vendedor','Status solicitacao','Produto','Quantidade','Unidade quantidade','Motivo','Validade','Status produto','Qtd. fotos','Fluxo aprovacao','GV','Data decisao GV','Justificativa GV','Decisao final por','Data decisao final','Justificativa final','Lancado por','Data lancamento','Entregue por','Data entrega'];
  const rows=[];
  requests.forEach(r=>{
    const items=[...(r.sales_damage_items||[])].sort((a,b)=>Number(a.item_order||0)-Number(b.item_order||0));
    if(!items.length){rows.push([r.request_code||'',r.occurrence_date||'',fmtDateTime(r.created_at),r.unit||'',r.seller_name||'',r.seller_username||'',r.customer_code||'',r.customer_name||'',r.city||'',r.branch||'',r.observation||'',r.status||'']);return;}
    items.forEach(i=>{
      const flow=i.final_reviewed_at?(i.reviewed_at?'GV + decisao final':'Decisao final direta'):i.reviewed_at?'Somente GV':'';
      rows.push([r.request_code||'',r.occurrence_date||'',fmtDateTime(r.created_at),r.unit||'',r.seller_name||'',r.seller_username||'',r.customer_code||'',r.customer_name||'',r.city||'',r.branch||'',r.observation||'',r.status||'',i.product_text||'',i.quantity??'',i.quantity_unit||'',salesReasonLabel(i.reason),i.validity_date||'',i.status||'',salesDamageItemPhotos(i).length,flow,i.reviewer_name||'',i.reviewed_at?fmtDateTime(i.reviewed_at):'',i.review_justification||'',i.final_reviewer_name||'',i.final_reviewed_at?fmtDateTime(i.final_reviewed_at):'',i.final_justification||'',i.launched_by_name||'',i.launched_at?fmtDateTime(i.launched_at):'',i.delivered_by_name||'',i.delivered_at?fmtDateTime(i.delivered_at):'']);
    });
  });
  downloadCsv(`avarias_vendas_${activeUnit?norm(activeUnit).replace(/[^a-z0-9]+/g,'_')+'_':''}${localIsoDate(new Date())}.csv`,[headers,...rows]);
}
function onSalesDamageRequestClick(e){const b=e.target.closest('[data-sales-request]');if(b)showSalesDamageDetail(b.dataset.salesRequest);}
function salesDamageFindRequest(id){return salesDamageManageRequests.find(x=>x.id===id)||salesDamageMyRequests.find(x=>x.id===id)||null;}
function salesItemStatusBadge(i){const cls=i.status==='APROVADO'||i.status==='LANCADO'?'ok':i.status==='REPROVADO'?'bad':i.status==='EM_ANALISE'?'partial':'pending';const label=({PENDENTE:'PENDENTE',EM_ANALISE:'EM ANÁLISE',APROVADO:'APROVADA',REPROVADO:'REPROVADA',LANCADO:'LANÇADA'})[i.status]||i.status;return `<span class="status ${cls}">${esc(label)}</span>`;}
function salesDamageItemPhotos(i){const nested=[...(i.sales_damage_item_photos||[])].sort((a,b)=>Number(a.photo_order||0)-Number(b.photo_order||0));if(nested.length)return nested;return i.photo_path?[{id:`legacy-${i.id}`,photo_order:1,photo_path:i.photo_path,latitude:null,longitude:null,accuracy:null,gps_at:null}]:[];}
async function showSalesDamageDetail(id){
  try{
    let r=salesDamageFindRequest(id);if(!r){const q=await sb.from('sales_damage_requests').select('*,sales_damage_items(*,sales_damage_item_photos(*))').eq('id',id).single();if(q.error)throw q.error;r=q.data;}currentSalesDamageDetail=r;
    const items=[...(r.sales_damage_items||[])].sort((a,b)=>Number(a.item_order||0)-Number(b.item_order||0));
    const signedByItem=new Map();for(const i of items){const photos=salesDamageItemPhotos(i);const signed=await Promise.all(photos.map(async ph=>{const {data}=await sb.storage.from('avarias-vendas').createSignedUrl(ph.photo_path,3600);return {...ph,url:data?.signedUrl||''};}));signedByItem.set(i.id,signed);}
    const canReview=hasPerm('SALES_DAMAGE_REVIEW'),canFinalize=hasPerm('SALES_DAMAGE_OVERRIDE'),canPost=hasPerm('SALES_DAMAGE_POST'),sellerView=activeView==='sales-avaria-minhas';
    const products=items.map((i,idx)=>{
      const reviewable=!sellerView&&canReview&&i.status==='PENDENTE',finalizable=!sellerView&&canFinalize&&(i.status==='PENDENTE'||i.status==='EM_ANALISE'),launchable=!sellerView&&canPost&&i.status==='APROVADO',selectable=reviewable||finalizable||launchable,selectionKind=finalizable&&!reviewable?'final':reviewable?'pending':launchable?'launch':'',photos=signedByItem.get(i.id)||[],allGps=photos.length>0&&photos.every(p=>p.latitude!=null&&p.longitude!=null&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));
      const gallery=photos.map((p,pidx)=>`<a href="${esc(p.url||'#')}" target="_blank" rel="noopener"><img src="${esc(p.url||'')}" alt="Foto ${pidx+1} do produto ${idx+1}"><span>Foto ${pidx+1}${p.latitude!=null&&p.longitude!=null?` • GPS ${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}${p.accuracy!=null?` • ±${Math.round(Number(p.accuracy)||0)} m`:''}`:' • GPS não registrado'}</span></a>`).join('');
      const managerDecision=!sellerView&&i.reviewed_at?`<div class="sales-decision ${i.status==='REPROVADO'&&!i.final_reviewed_at?'rejected':'approved'}"><strong>Decisão do Gerente de Vendas</strong><span>${esc(i.reviewer_name||'—')} • ${fmtDateTime(i.reviewed_at)}</span><p>${esc(i.review_justification||'Sem justificativa registrada.')}</p></div>`:'';
      const finalDecision=!sellerView&&i.final_reviewed_at?`<div class="sales-decision ${i.status==='REPROVADO'?'rejected':'approved'}"><strong>Decisão final</strong><span>${esc(i.final_reviewer_name||'—')} • ${fmtDateTime(i.final_reviewed_at)}</span><p>${esc(i.final_justification||'Sem justificativa registrada.')}</p></div>`:'';
      const launched=!sellerView&&i.launched_at?`<div class="sales-decision approved"><strong>Avaria lançada</strong><span>${esc(i.launched_by_name||'—')} • ${fmtDateTime(i.launched_at)}</span></div>`:'';
      return `<article class="damage-admin-item sales-review-item" data-sales-detail-item="${i.id}"><div class="damage-product-head">${selectable?`<label class="damage-check"><input type="checkbox" class="sales-review-check" value="${i.id}" data-review-kind="${selectionKind}"><span></span></label>`:''}<div><small>PRODUTO ${idx+1}</small><strong>${esc(i.product_text)}</strong></div>${salesItemStatusBadge(i)}</div><div class="damage-summary-grid"><div><small>QUANTIDADE</small><strong>${fmtNum(i.quantity)} ${i.quantity_unit==='CAIXA'?'Caixa':'Unidade'}${num(i.quantity)===1?'':'s'}</strong></div><div><small>MOTIVO</small><strong>${esc(salesReasonLabel(i.reason))}</strong></div><div><small>VALIDADE</small><strong>${i.validity_date?fmtDate(i.validity_date):'—'}</strong></div><div><small>EVIDÊNCIA</small><strong>${photos.length} foto${photos.length===1?'':'s'} • ${allGps?'GPS ✓':'GPS legado/indisponível'}</strong></div></div><div class="sales-proof sales-proof-multi">${gallery||'<span class="muted-text">Sem foto disponível.</span>'}</div>${launchable?`<div class="sales-launch-action"><button type="button" class="sales-launch-btn" data-sales-launch="${i.id}"><span>✓ Registrar avaria como lançada</span><small>Toque aqui após registrar esta avaria no sistema</small></button><div class="sales-launch-help"><strong>Etapa final do fluxo</strong><small>Após confirmar, o status deste produto muda para <b>Lançado</b>.</small></div></div>`:''}${managerDecision}${finalDecision}${launched}</article>`;
    }).join('');
    const pending=items.filter(i=>i.status==='PENDENTE').length,analysis=items.filter(i=>i.status==='EM_ANALISE').length,approved=items.filter(i=>i.status==='APROVADO').length,selectableCount=sellerView?0:items.filter(i=>((canReview||canFinalize)&&i.status==='PENDENTE')||(canFinalize&&i.status==='EM_ANALISE')||(canPost&&i.status==='APROVADO')).length;
    const needsJustification=!sellerView&&((canReview&&pending)||(canFinalize&&(pending||analysis)));
    const body=`<div class="damage-request-hero sales-request-hero"><div><small>${esc(r.request_code)}</small><strong>PDV ${esc(r.customer_code)} · ${esc(r.customer_name)}</strong><span>${esc(r.city||'—')} • ${esc(r.branch||'—')} • Vendedor: ${esc(r.seller_name)}</span></div><div class="damage-counts"><b>${items.length}</b><span>produtos</span><b>${pending+analysis+approved}</b><span>em fluxo</span></div></div><div class="detail-grid damage-request-grid"><div class="detail-card"><small>Data</small><strong>${fmtDate(r.occurrence_date)}</strong></div><div class="detail-card"><small>Vendedor</small><strong>${esc(r.seller_name)}</strong></div><div class="detail-card"><small>Código PDV</small><strong>${esc(r.customer_code)}</strong></div><div class="detail-card"><small>Filial</small><strong>${esc(r.branch||'—')}</strong></div></div>${selectableCount?`<div class="damage-selection-bar sales-selection-bar"><label class="check sales-select-all"><input id="salesDamageSelectAll" type="checkbox"> Selecionar tudo</label><span id="salesDamageSelectionSummary">0 selecionados</span><small>${pending&&canReview&&canFinalize?'Pendentes: GV ou decisão final direta. ':pending&&canReview?'Pendentes: decisão do Gerente de Vendas. ':pending&&canFinalize?'Pendentes: decisão final direta disponível. ':''}${analysis&&canFinalize?'Em análise: decisão final. ':''}${approved&&canPost?'Aprovados: prontos para marcar como lançados.':''}</small></div>`:''}${needsJustification?`<div class="sales-review-justification"><div class="field"><label>Justificativa da decisão *</label><textarea id="salesDamageDecisionJustification" rows="3" maxlength="500" placeholder="Descreva o motivo da aprovação ou reprovação."></textarea><small>A justificativa fica registrada na auditoria da solicitação.</small></div></div>`:''}${products}`;
    const actions=[];if(!sellerView&&canReview&&pending){actions.push({label:'GV • Reprovar selecionados',class:'danger',onClick:()=>reviewSalesDamage('REPROVADO')},{label:'GV • Aprovar selecionados',class:'success',onClick:()=>reviewSalesDamage('APROVADO')});}if(!sellerView&&canFinalize&&(pending||analysis)){actions.push({label:'Final • Reprovar selecionados',class:'danger',onClick:()=>finalizeSalesDamage('REPROVADO')},{label:'Final • Aprovar selecionados',class:'success',onClick:()=>finalizeSalesDamage('APROVADO')});}if(!sellerView&&canPost&&approved){actions.push({label:'✓ Marcar selecionados como lançados',class:'success',onClick:()=>markSalesDamageLaunchedBulk()});}
    openModal(`Avaria de Vendas • ${r.request_code}`,`${fmtDate(r.occurrence_date)} • ${r.seller_name} • ${salesDamageStatusLabel(r.status)}`,body,actions);
    const checks=[...($('modalBody')?.querySelectorAll('.sales-review-check')||[])],selectAll=$('salesDamageSelectAll');const update=()=>{const n=checks.filter(x=>x.checked).length;if($('salesDamageSelectionSummary'))$('salesDamageSelectionSummary').textContent=`${n} selecionado${n===1?'':'s'}`;if(selectAll){selectAll.checked=checks.length>0&&n===checks.length;selectAll.indeterminate=n>0&&n<checks.length;}};checks.forEach(x=>x.addEventListener('change',update));selectAll?.addEventListener('change',()=>{checks.forEach(x=>x.checked=selectAll.checked);update();});$('modalBody')?.querySelectorAll('[data-sales-launch]').forEach(b=>b.addEventListener('click',()=>markSalesDamageLaunched(b.dataset.salesLaunch)));
  }catch(e){toast(humanSalesDamageError(e),'error');}
}
function selectedSalesReviewIds(kind){
  const selected=[...($('modalBody')?.querySelectorAll('.sales-review-check:checked')||[])].map(x=>x.value),items=currentSalesDamageDetail?.sales_damage_items||[];
  return selected.filter(id=>{const i=items.find(x=>String(x.id)===String(id));if(!i)return false;if(kind==='pending')return i.status==='PENDENTE';if(kind==='final')return i.status==='PENDENTE'||i.status==='EM_ANALISE';if(kind==='launch')return i.status==='APROVADO';if(kind==='delivered')return i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||'');return false;});
}
async function reviewSalesDamage(status){
  const ids=selectedSalesReviewIds('pending');if(!ids.length)return toast('Selecione ao menos um produto pendente.','error');const note=String($('salesDamageDecisionJustification')?.value||'').trim();if(!note)return toast('Informe a justificativa da decisão.','error');
  try{const {error}=await sb.rpc('review_sales_damage_items',{p_item_ids:ids,p_status:status,p_justification:note});if(error)throw error;toast(status==='APROVADO'?`${ids.length} produto(s) aprovado(s) pelo GV e enviado(s) para análise final.`:`${ids.length} produto(s) reprovado(s) pelo GV.`,'success');closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);}catch(e){toast(humanSalesDamageError(e),'error');}
}
async function finalizeSalesDamage(status){
  const ids=selectedSalesReviewIds('final');if(!ids.length)return toast('Selecione ao menos um produto pendente ou em análise.','error');const note=String($('salesDamageDecisionJustification')?.value||'').trim();if(!note)return toast('Informe a justificativa da decisão final.','error');
  try{const {error}=await sb.rpc('finalize_sales_damage_items',{p_item_ids:ids,p_status:status,p_justification:note});if(error)throw error;toast(`${ids.length} produto(s) ${status==='APROVADO'?'aprovado(s)':'reprovado(s)'} na decisão final.`,'success');closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);}catch(e){toast(humanSalesDamageError(e),'error');}
}
async function markSalesDamageLaunched(itemId){
  if(!hasPerm('SALES_DAMAGE_POST'))return toast('Seu usuário não possui permissão para marcar a avaria como lançada.','error');if(!confirm('Confirmar que esta avaria já foi lançada no sistema?'))return;
  try{const {error}=await sb.rpc('mark_sales_damage_item_launched',{p_item_id:itemId});if(error)throw error;toast('Produto marcado como Lançado.','success');const requestId=currentSalesDamageDetail?.id;closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);if(requestId)await showSalesDamageDetail(requestId);}catch(e){toast(humanSalesDamageError(e),'error');}
}
async function markSalesDamageLaunchedBulk(){
  if(!hasPerm('SALES_DAMAGE_POST'))return toast('Seu usuário não possui permissão para marcar a avaria como lançada.','error');
  const ids=selectedSalesReviewIds('launch');if(!ids.length)return toast('Selecione ao menos um produto aprovado para marcar como lançado.','error');if(!confirm(`Confirmar o lançamento de ${ids.length} produto(s) no sistema?`))return;
  try{for(const itemId of ids){const {error}=await sb.rpc('mark_sales_damage_item_launched',{p_item_id:itemId});if(error)throw error;}toast(`${ids.length} produto(s) marcado(s) como Lançado.`,'success');const requestId=currentSalesDamageDetail?.id;closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);if(requestId)await showSalesDamageDetail(requestId);}catch(e){toast(humanSalesDamageError(e),'error');}
}
function humanSalesDamageError(e){const m=String(e?.message||e||'Erro em Avarias de Vendas');const map={PDV_INVALIDO:'PDV inválido ou não localizado.',PRODUTO_OBRIGATORIO:'Adicione ao menos um produto avariado.',QUANTIDADE_INVALIDA:'Informe uma quantidade maior que zero.',UNIDADE_INVALIDA:'Selecione Caixa ou Unidade.',MOTIVO_OBRIGATORIO:'Informe o motivo da avaria.',VALIDADE_OBRIGATORIA:'Para o motivo Validade, informe a data de validade.',FOTO_OBRIGATORIA:'Cada produto precisa de ao menos uma foto.',FOTOS_EXCEDIDAS:'Validade permite até 2 fotos; os demais motivos permitem 1 foto.',GPS_FOTO_OBRIGATORIO:'Todas as fotos precisam de localização GPS.',OBSERVACAO_EXCEDIDA:'A observação deve ter no máximo 500 caracteres.',JUSTIFICATIVA_OBRIGATORIA:'A justificativa é obrigatória para esta decisão.',NENHUM_ITEM_PENDENTE:'Nenhum dos produtos selecionados está pendente.',NENHUM_ITEM_EM_ANALISE:'Selecione ao menos um produto em análise.',NENHUM_ITEM_FINALIZAVEL:'Selecione ao menos um produto pendente ou em análise.',ITEM_NAO_APROVADO:'Somente produtos aprovados podem ser marcados como lançados.',FORBIDDEN:'Seu usuário não possui permissão para esta ação.'};const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];if(/sales_damage_item_photos|finalize_sales_damage_items|mark_sales_damage_item_launched/i.test(m))return 'A atualização do fluxo de Avarias de Vendas ainda não foi aplicada no Supabase. Execute o SQL 21_v1_5_1_avarias_vendas_fluxo_final_camera_gps.sql.';if(/sales_damage|avarias-vendas|relation .*does not exist/i.test(m))return 'O módulo Avarias de Vendas ainda não foi criado no Supabase. Execute primeiro o SQL 18 e depois o SQL 21 da v1.5.1.';return humanError(e);}

// CONFERENCIA ----------------------------------------------------------------
function clearConferenceForm(){$('confMapa').value='';['confG300','confG600V','confG600M','confLitrao','confB30','confB50'].forEach(id=>$(id).value=0);}
async function submitConference(e){e.preventDefault();const map=normalizeCode($('confMapa').value);if(!map)return toast('Informe o mapa.','error');const p={p_map_number:map,p_g300:intVal('confG300'),p_g600_green:intVal('confG600V'),p_g600_brown:intVal('confG600M'),p_g_litrao:intVal('confLitrao'),p_keg30:intVal('confB30'),p_keg50:intVal('confB50')};const btn=e.submitter;btn.disabled=true;btn.textContent='Registrando…';try{const {error}=await sb.rpc('create_container_conference',p);if(error)throw error;toast('Conferência registrada.','success');clearConferenceForm();}catch(err){const m=String(err.message||'');toast(m.includes('duplicate key')?'Este mapa já possui conferência na data de hoje.':humanError(err),'error');}finally{btn.disabled=false;btn.textContent='Registrar conferência';}}
let myConferences=[];async function loadMyConferences(silent=false){try{const {data,error}=await sb.from('container_conferences').select('*').eq('checker_id',authUser.id).order('created_at',{ascending:false}).limit(1000);if(error)throw error;myConferences=data||[];renderMyConferences();}catch(e){if(!silent)toast(humanError(e),'error');}}
function renderMyConferences(){const m=normalizeCode($('minhasMapa').value),d=$('minhasData').value;const arr=myConferences.filter(x=>(!m||x.map_number.includes(m))&&(!d||x.conference_date===d));$('tbodyMinhas').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)} ${fmtTime(x.conference_time)}</td><td>${esc(x.map_number)}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="8">Nenhuma conferência.</td></tr>';}
async function loadConferenceHistory(){if(!hasPerm('CONF_HISTORY'))return;try{const [c,m]=await Promise.all([sb.from('container_conferences').select('*').order('created_at',{ascending:false}).limit(3000),sb.from('maps').select('*').order('map_date',{ascending:false}).limit(5000)]);if(c.error)throw c.error;if(m.error)throw m.error;allConferences=c.data||[];allMaps=m.data||[];renderConferenceHistory();}catch(e){toast(humanError(e),'error');}}
function mapNumberKey(map){return normalizeCode(map);}
function latestMapIndexByNumber(rows=allMaps){const idx=new Map();for(const m of rows){const k=mapNumberKey(m.map_number);if(!k)continue;const prev=idx.get(k);if(!prev||String(m.map_date||'')>String(prev.map_date||''))idx.set(k,m);}return idx;}
function latestConferenceIndexByNumber(rows=allConferences){const idx=new Map();for(const c of rows){const k=mapNumberKey(c.map_number);if(!k)continue;const prev=idx.get(k);const curStamp=String(c.created_at||c.conference_date||'');const prevStamp=String(prev?.created_at||prev?.conference_date||'');if(!prev||curStamp>prevStamp)idx.set(k,c);}return idx;}
function enrichedConferenceRows(){const mapIndex=latestMapIndexByNumber();return allConferences.map(c=>({...c,map:mapIndex.get(mapNumberKey(c.map_number))||null}));}
function filteredConferenceHistory(){const map=normalizeCode($('histConfMapa').value),name=norm($('histConfConferente').value),de=$('histConfDe').value,ate=$('histConfAte').value;return enrichedConferenceRows().filter(x=>(!map||x.map_number.includes(map))&&(!name||norm(x.checker_name).includes(name))&&(!de||x.conference_date>=de)&&(!ate||x.conference_date<=ate));}
function renderConferenceHistory(){const arr=filteredConferenceHistory();$('tbodyHistConf').innerHTML=arr.length?arr.map(x=>`<tr><td>${fmtDate(x.conference_date)}</td><td>${fmtTime(x.conference_time)}</td><td>${esc(x.checker_name)}</td><td>${esc(x.map_number)}</td><td>${esc(x.map?.city||'—')}</td><td>${esc(x.map?.driver||'—')}</td><td>${esc(x.map?.helper1||'—')}</td><td>${esc(x.map?.helper2||'—')}</td><td>${x.g300}</td><td>${x.g600_green}</td><td>${x.g600_brown}</td><td>${x.g_litrao}</td><td>${x.keg30}</td><td>${x.keg50}</td></tr>`).join(''):'<tr><td colspan="14">Nenhum registro.</td></tr>';}
function exportConferenceCsv(){const arr=filteredConferenceHistory();const headers=['Data','Hora','Conferente','Mapa','Cidade','Motorista','Ajudante 1','Ajudante 2','Garrafeiras de 300ml','Garrafeiras de 600ml Verde','Garrafeiras de 600ml Marrom','Garrafeiras de Litrão','Barris de Chopp 30L','Barris de Chopp 50L'];const rows=arr.map(x=>[fmtDate(x.conference_date),fmtTime(x.conference_time),x.checker_name,x.map_number,x.map?.city||'',x.map?.driver||'',x.map?.helper1||'',x.map?.helper2||'',x.g300,x.g600_green,x.g600_brown,x.g_litrao,x.keg30,x.keg50]);downloadCsv('historico_conferencias.csv',[headers,...rows]);}

let dashboardRows=[];
async function loadDashboard(silent=false){
  if(!hasPerm('CONF_DASHBOARD'))return;
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
let users=[];
function roleDefaults(role){return new Set(ROLE_PERMISSION_DEFAULTS[role]||[]);}
function userPermissionOverrides(userId){return userPermissionRows.filter(x=>x.user_id===userId);}
function effectiveUserPermissions(user){

  if(!user){
    return roleDefaults(
      $('usuarioPerfil')?.value
      ||
      'COLABORADOR_ARMAZEM'
    );
  }

  if(user.role==='ADMIN'){

    const catalog=
      permissionRows.length
        ?permissionRows
        :PERMISSION_CATALOG;

    const out=
      new Set(
        catalog
          .filter(
            x=>x.code!=='DAMAGE_NOTIFICATION'
          )
          .map(x=>x.code)
      );

    const notify=
      userPermissionOverrides(user.id)
        .find(
          x=>
            x.permission_code===
            'DAMAGE_NOTIFICATION'
        );

    if(notify?.allowed===true){
      out.add(
        'DAMAGE_NOTIFICATION'
      );
    }

    return out;
  }

  const out=
    roleDefaults(user.role);

  userPermissionOverrides(user.id)
    .forEach(x=>{

      if(x.allowed){
        out.add(x.permission_code);
      }
      else{
        out.delete(x.permission_code);
      }

    });

  return out;
}
async function loadUsers(){
  if(!hasPerm('ADMIN_USERS'))return;
  try{
    const [u,pms,rp,up]=await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('permissions').select('*').eq('active',true).order('module').order('sort_order'),
      sb.from('role_permissions').select('*'),
      sb.from('user_permissions').select('*')
    ]);
    const err=[u,pms,rp,up].find(x=>x.error)?.error;if(err)throw err;
    users=u.data||[];permissionRows=pms.data||PERMISSION_CATALOG;rolePermissionRows=rp.data||[];userPermissionRows=up.data||[];
    renderUsers();
    if(!$('usuarioOriginal').value)renderUserPermissionEditor(null,true);
  }catch(e){toast(humanUserAdminError(e),'error');}
}
function permissionLabel(code){const x=(permissionRows.length?permissionRows:PERMISSION_CATALOG).find(p=>p.code===code);return x?.name||code;}
function renderUsers(){
  const body=$('tbodyUsuarios');if(!body)return;
  body.innerHTML=users.length?users.map(u=>{const enabled=effectiveUserPermissions(u),custom=userPermissionOverrides(u.id).length;return `<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(ROLE_LABELS[u.role]||u.role)}</td><td><strong>${enabled.size} habilitada${enabled.size===1?'':'s'}</strong><small>${u.role==='ADMIN'?'Acesso total':custom?`${custom} exceção(ões) individual(is)`:'Padrão do cargo'}</small></td><td>${u.active?'<span class="status ok">Ativo</span>':'<span class="status bad">Inativo</span>'}</td><td><button class="mini-btn" data-user="${esc(u.username)}">Editar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhum usuário cadastrado.</td></tr>';
}
function renderUserPermissionEditor(user=null,restoreRole=false){

  const box=$('usuarioPermissoes');

  if(!box)return;

  const role=
    $('usuarioPerfil')?.value
    ||
    user?.role
    ||
    'COLABORADOR_ARMAZEM';

  const catalog=
    (
      permissionRows.length
        ?permissionRows
        :PERMISSION_CATALOG
    )
    .filter(x=>x.active!==false)
    .sort(
      (a,b)=>
        String(a.module)
          .localeCompare(
            String(b.module),
            'pt-BR'
          )
        ||
        (a.sort_order??a.sort??100)
        -
        (b.sort_order??b.sort??100)
    );

  let enabled;

  if(role==='ADMIN'){

    enabled=
      new Set(
        catalog
          .filter(
            x=>x.code!=='DAMAGE_NOTIFICATION'
          )
          .map(x=>x.code)
      );

    if(user&&!restoreRole){

      const notify=
        userPermissionOverrides(user.id)
          .find(
            x=>
              x.permission_code===
              'DAMAGE_NOTIFICATION'
          );

      if(notify?.allowed===true){
        enabled.add(
          'DAMAGE_NOTIFICATION'
        );
      }
    }

  }
  else if(user&&!restoreRole){

    enabled=
      effectiveUserPermissions(user);

  }
  else if(rolePermissionRows.length){

    enabled=
      new Set(
        rolePermissionRows
          .filter(x=>x.role===role)
          .map(x=>x.permission_code)
      );

  }
  else{

    enabled=
      roleDefaults(role);

  }

  const groups=new Map();

  catalog.forEach(x=>{

    if(!groups.has(x.module)){
      groups.set(x.module,[]);
    }

    groups.get(x.module).push(x);

  });

  box.innerHTML=
    [...groups.entries()]
      .map(([module,rows])=>{

        const items=
          rows.map(x=>{

            const locked=
              role==='ADMIN'
              &&
              x.code!=='DAMAGE_NOTIFICATION';

            return `
              <label class="permission-row">

                <input
                  type="checkbox"
                  data-user-permission="${esc(x.code)}"
                  ${enabled.has(x.code)?'checked':''}
                  ${locked?'disabled':''}
                >

                <span>
                  <strong>${esc(x.name)}</strong>
                  ${
                    x.description
                      ?`<small>${esc(x.description)}</small>`
                      :''
                  }
                </span>

              </label>
            `;

          }).join('');

        return `
          <section class="permission-group">

            <div class="permission-group-title">
              <strong>${esc(module)}</strong>
              <small>
                ${
                  rows.filter(
                    x=>enabled.has(x.code)
                  ).length
                }/${rows.length}
              </small>
            </div>

            ${items}

          </section>
        `;

      })
      .join('');

  box
    .querySelectorAll(
      '[data-user-permission]'
    )
    .forEach(
      el=>
        el.addEventListener(
          'change',
          ()=>updatePermissionGroupCounts()
        )
    );

  updatePermissionGroupCounts();
}
function updatePermissionGroupCounts(){$('usuarioPermissoes')?.querySelectorAll('.permission-group').forEach(g=>{const all=g.querySelectorAll('[data-user-permission]').length,on=g.querySelectorAll('[data-user-permission]:checked').length;const s=g.querySelector('.permission-group-title small');if(s)s.textContent=`${on}/${all}`;});}
function selectedUserPermissions(){return [...($('usuarioPermissoes')?.querySelectorAll('[data-user-permission]:checked')||[])].map(x=>x.dataset.userPermission);}
function onUserTableClick(e){
  const b=e.target.closest('button[data-user]');if(!b)return;const u=users.find(x=>x.username===b.dataset.user);if(!u)return;
  $('usuarioOriginal').value=u.username;$('usuarioLogin').value=u.username;$('usuarioNome').value=u.name;$('usuarioPerfil').value=u.role;$('usuarioSenha').value='';$('usuarioAtivo').checked=u.active;renderUserPermissionEditor(u,false);
}
function clearUserForm(){$('usuarioOriginal').value='';$('usuarioLogin').value='';$('usuarioNome').value='';$('usuarioPerfil').value='COLABORADOR_ARMAZEM';$('usuarioSenha').value='';$('usuarioAtivo').checked=true;renderUserPermissionEditor(null,true);}
async function saveUser(e){
  e.preventDefault();
  const original=$('usuarioOriginal').value.trim();
  const body={action:original?'update':'create',originalUsername:original,username:$('usuarioLogin').value,name:$('usuarioNome').value,role:$('usuarioPerfil').value,password:$('usuarioSenha').value,active:$('usuarioAtivo').checked,permissions:selectedUserPermissions()};
  if(!body.username.trim()||!body.name.trim())return toast('Informe usuário e nome.','error');
  if(!original&&body.password.length<6)return toast('A senha do novo usuário deve ter pelo menos 6 caracteres.','error');
  const btn=e.submitter;btn.disabled=true;btn.textContent='Salvando…';
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Sua sessão expirou. Saia do sistema e entre novamente.');
    const {data,error}=await sb.functions.invoke('admin-users',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
    if(error){
      let detail='';
      try{if(error.context&&typeof error.context.clone==='function'){const response=error.context.clone();try{const parsed=await response.json();detail=parsed?.error||parsed?.message||parsed?.code||'';}catch(_jsonErr){detail=await response.text().catch(()=> '');}}}catch(_e){}
      if(detail)throw new Error(detail);
      const msg=String(error.message||error);if(/Failed to send a request|fetch|FunctionFetchError/i.test(msg))throw new Error('A função admin-users não está acessível no Supabase. Republique a Edge Function.');throw new Error(msg);
    }
    if(data?.ok===false)throw new Error(data.error||'Falha ao salvar usuário.');
    toast(data?.repaired?'Usuário recuperado e salvo com sucesso.':'Usuário e permissões salvos.','success');clearUserForm();await loadUsers();
  }catch(err){toast(humanUserAdminError(err),'error');}
  finally{btn.disabled=false;btn.textContent='Salvar usuário';}
}
function humanUserAdminError(e){
  const m=String(e?.message||e||'Erro desconhecido');
  if(/FORBIDDEN/i.test(m))return 'Seu usuário não possui permissão para administrar usuários.';
  if(/AUTH_|JWT|sessão|session/i.test(m))return 'Sua sessão não foi validada pela função. Saia do Disb Gestão, entre novamente e tente de novo. Detalhe: '+m;
  if(/SENHA_MIN_6/i.test(m))return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/PERFIL_INVALIDO/i.test(m))return 'Perfil de usuário inválido.';
  if(/USUARIO_JA_EXISTE|already been registered|already exists|duplicate/i.test(m))return 'Esse usuário já existe. Tente editar o cadastro existente.';
  if(/relation .*permissions|user_permissions|role_permissions/i.test(m))return 'A estrutura de permissões ainda não existe no Supabase. Execute o SQL 18_v1_4_0_permissoes_avarias_vendas.sql e republique a função admin-users.';
  return m;
}

// IMPORT ---------------------------------------------------------------------
async function importBaseCsv(){if(!hasPerm('ADMIN_BASES'))return;const file=$('importFile').files?.[0];if(!file)return toast('Selecione um arquivo CSV.','error');const type=$('importTipo').value;const out=$('importResult');out.textContent='Lendo arquivo…';try{const text=await readCsvFileText(file);const rows=parseCsvObjects(text);if(!rows.length)throw new Error('O arquivo não possui registros.');const normalized=dedupeImport(type,normalizeImport(type,rows));out.textContent=`${normalized.length} linhas reconhecidas. Enviando…`;let done=0;for(const chunk of chunks(normalized,300)){let res;if(type==='maps')res=await sb.from('maps').upsert(chunk,{onConflict:'map_number,map_date'});else if(type==='nris')res=await sb.from('nris').upsert(chunk,{onConflict:'nri'});else if(type==='conferences')res=await sb.from('container_conferences').upsert(chunk,{onConflict:'map_number,conference_date'});else res=await sb.from(type).upsert(chunk,{onConflict:importConflict(type)});if(res.error)throw res.error;done+=chunk.length;out.textContent=`Importados ${done}/${normalized.length}…`;}
    if(type==='nris'){const x=await sb.rpc('sync_nri_sequence');if(x.error)throw x.error;}out.textContent=`Concluído: ${done} registros importados.`;toast('Importação concluída.','success');localStorage.removeItem(REF_CACHE_KEY);localStorage.removeItem('ops_ref_cache');if(['products','units','drivers','factories','customers'].includes(type))await loadReferences(false);
  }catch(e){out.textContent=`Erro: ${humanError(e)}`;toast(humanError(e),'error');}}
function importConflict(type){return ({products:'code',units:'name',drivers:'name',factories:'name',customers:'code,branch'})[type];}
function dedupeImport(type,rows){
  const fields=String(importConflict(type)||'').split(',').filter(Boolean);
  if(!fields.length)return rows;
  const m=new Map();
  rows.forEach(r=>{const k=fields.map(f=>String(r[f]??'').trim().toLowerCase()).join('||');m.set(k,r);});
  return [...m.values()];
}
function normalizeImport(type,rows){const h=(r,...aliases)=>{for(const a of aliases){const k=Object.keys(r).find(k=>normHeader(k)===normHeader(a));if(k!==undefined)return r[k];}return '';};if(type==='products')return rows.map(r=>({code:String(h(r,'Código','Codigo','Code')).trim(),name:sanitizeRefText(h(r,'Nome','Produto','Descrição','Descricao'))})).filter(x=>x.code&&x.name);if(type==='units')return rows.map(r=>({name:sanitizeRefText(h(r,'Unidade','Nome'))})).filter(x=>x.name);if(type==='drivers')return rows.map(r=>({name:sanitizeRefText(h(r,'Motorista','Nome'))})).filter(x=>x.name);if(type==='factories')return rows.map(r=>({name:sanitizeRefText(h(r,'Fábrica','Fabrica','Nome'))})).filter(x=>x.name);if(type==='customers')return rows.map(r=>({code:normalizeCode(h(r,'Código PDV','Cód PDV','Codigo PDV','Código','Codigo')),name:sanitizeRefText(h(r,'Nome','Nome Fantasia','Cliente','Razão Social','Razao Social')),city:sanitizeRefText(h(r,'Cidade')),branch:sanitizeRefText(h(r,'Filial'))})).filter(x=>x.code&&x.name);if(type==='maps')return rows.map(r=>({map_number:normalizeCode(h(r,'MAPAS','MAPA')),map_date:parseAnyDate(h(r,'DATA')),city:sanitizeRefText(h(r,'CIDADE')),driver:sanitizeRefText(h(r,'MOTORISTA')),helper1:sanitizeRefText(h(r,'AJUDANTE 1')),helper2:sanitizeRefText(h(r,'AJUDANTE 2')),g300:num(h(r,'GARRAFEIRAS DE 300ML')),g600_green:num(h(r,'GARRAFEIRAS DE 600 ML VERDE','GARRAFEIRAS DE 600ML VERDE')),g600_brown:num(h(r,'GARRAFEIRAS DE 600ML MARROM','GARRAFEIRAS DE 600 ML MARROM')),g_litrao:num(h(r,'GARRAFEIRAS DE LITRÃO','GARRAFEIRAS DE LITRAO')),keg30:num(h(r,'BARRIS DE CHOPP 30L')),keg50:num(h(r,'BARRIS DE CHOPP 50L'))})).filter(x=>x.map_number&&x.map_date);if(type==='nris')return rows.map(r=>({nri:String(h(r,'NRI')).trim(),request_id:null,product_code:String(h(r,'Código Produto','Codigo Produto')).trim(),product_name:sanitizeRefText(h(r,'Nome Produto','Produto')),unit:sanitizeRefText(h(r,'Unidade')),request_type:String(h(r,'Tipo')||'AMBEV').trim().toUpperCase()==='MARKETPLACE'?'MARKETPLACE':'AMBEV',validity_date:/sem\s*validade/i.test(String(h(r,'Validade')||''))?null:parseAnyDate(h(r,'Validade')),lot:String(h(r,'Lote')).trim().toUpperCase(),receipt_date:parseAnyDate(h(r,'Recebimento')),block_date:parseAnyDate(h(r,'Bloqueio')),checker_name:sanitizeRefText(h(r,'Conferente')),receipt_time:normalizeTime(h(r,'Hora')),driver:sanitizeRefText(h(r,'Motorista')),plate:String(h(r,'Placa')).trim().toUpperCase(),factory:sanitizeRefText(h(r,'Fábrica','Fabrica')),quantity:num(h(r,'Quantidade','Caixas')),status:String(h(r,'Status')||'PENDENTE').trim().toUpperCase(),created_by:null,created_by_username:sanitizeRefText(h(r,'Usuário Cadastro','Usuario Cadastro')),created_by_name:sanitizeRefText(h(r,'Nome Usuário Cadastro','Nome Usuario Cadastro')),created_at:parseAnyDateTime(h(r,'Criado em ISO','Criado em'))||new Date().toISOString(),printed_at:parseAnyDateTime(h(r,'Impresso em'))||null,removed_at:parseAnyDateTime(h(r,'Removido em'))||null})).filter(x=>x.nri&&x.product_code);if(type==='conferences')return rows.map(r=>({conference_date:parseAnyDate(h(r,'Data')),conference_time:normalizeTime(h(r,'Hora')),checker_id:null,checker_username:sanitizeRefText(h(r,'Conferente Usuário','Conferente Usuario')),checker_name:sanitizeRefText(h(r,'Conferente Nome','Conferente')),map_number:normalizeCode(h(r,'Mapa')),g300:num(h(r,'Garrafeiras de 300ml')),g600_green:num(h(r,'Garrafeiras de 600ml Verde')),g600_brown:num(h(r,'Garrafeiras de 600ml Marrom')),g_litrao:num(h(r,'Garrafeiras de Litrão','Garrafeiras de Litrao')),keg30:num(h(r,'Barris de Chopp 30L')),keg50:num(h(r,'Barris de Chopp 50L')),created_at:parseAnyDateTime(h(r,'Criado em ISO','Data/Hora'))||new Date().toISOString()})).filter(x=>x.conference_date&&x.map_number);return [];}

// PUXADA v1.1.6 -------------------------------------------------------------
let pullActiveTrip=null;
let pullMainSteps=[];
let pullAllMainSteps=[];
let pullConfigSteps=[];
let pullOccurrenceTypes=[];
let pullProfiles=[];
let pullFactories=[];
let pullVehicles=[];
let pullSettings=null;
let pullDriverEvents=[];
let pullDriverOccurrences=[];
let pullHistory=[];
let pullHistoryEvents=[];
let pullDashTrips=[];
let pullGoals=null;
let pullMetric='TMV_OUT';
let pullRealtimeChannel=null;
let pullReloadTimer=null;
let pullTrackWatch=null;
let pullTrackLast=null;
let pullGpsLiveSample=null;
let pullGpsBestSample=null;
let pullClockTimer=null;
let pullMapInstances=[];
let pullMapContexts=new Map();

function bindPullEvents(){
  $('formPullStart')?.addEventListener('submit',startPullTrip);
  $('btnPullNextStep')?.addEventListener('click',recordPullNextStep);
  $('pullOccurrenceButtons')?.addEventListener('click',onPullOccurrenceClick);
  $('pullCycleChoice')?.addEventListener('click',onPullCycleChoice);
  $('pullOpenOccurrence')?.addEventListener('click',onPullOpenOccurrenceClick);
  $('btnAtualizarPullNri')?.addEventListener('click',()=>loadPullNriPending());
  $('pullNriCards')?.addEventListener('click',onPullNriCardsClick);
  $('btnPullFarolAtualizar')?.addEventListener('click',()=>loadPullFarol());
  $('pullFarolBusca')?.addEventListener('input',renderPullFarol);
  $('pullFarolCards')?.addEventListener('click',onPullFarolClick);
  $('btnPullHistAtualizar')?.addEventListener('click',()=>loadPullHistory());
  $('btnPullHistCsv')?.addEventListener('click',exportPullHistoryCsv);
  ['pullHistDe','pullHistAte','pullHistFactory','pullHistType'].forEach(id=>$(id)?.addEventListener('change',renderPullHistory));
  $('pullHistBusca')?.addEventListener('input',renderPullHistory);
  $('tbodyPullHistory')?.addEventListener('click',onPullHistoryClick);
  $('pullMetricTabs')?.addEventListener('click',e=>{const b=e.target.closest('button[data-metric]');if(!b)return;if($('pullDashType')?.value==='TRANSFER'&&b.dataset.metric!=='CYCLE')return toast('Para Transferência, o indicador de tempo aplicável é o Ciclo Matriz → Filial → Matriz.','');pullMetric=b.dataset.metric;[...$('pullMetricTabs').querySelectorAll('button')].forEach(x=>x.classList.toggle('active',x===b));renderPullDashboard();});
  $('btnPullDashAtualizar')?.addEventListener('click',()=>loadPullDashboard());
  ['pullDashYear','pullDashMonth','pullDashCarrier','pullDashFactory','pullDashDriver'].forEach(id=>$(id)?.addEventListener('change',renderPullDashboard));
  $('pullDashType')?.addEventListener('change',()=>{if($('pullDashType').value==='TRANSFER'){pullMetric='CYCLE';[...$('pullMetricTabs').querySelectorAll('button')].forEach(x=>x.classList.toggle('active',x.dataset.metric==='CYCLE'));}renderPullDashboard();});
  $('formPullGoals')?.addEventListener('submit',savePullGoals);
  $('pullGoalYear')?.addEventListener('change',loadPullGoals);
  $('formPullSettings')?.addEventListener('submit',savePullSettings);
  $('formPullFactory')?.addEventListener('submit',savePullFactory);
  $('btnPullFactoryGps')?.addEventListener('click',useGpsForPullFactory);
  $('pullFactoryName')?.addEventListener('change',fillPullFactoryForm);
  $('formPullVehicle')?.addEventListener('submit',savePullVehicle);
  $('btnPullVehicleNew')?.addEventListener('click',clearPullVehicleForm);
  $('pullVehicleRows')?.addEventListener('click',onPullVehicleRowsClick);
  $('formPullStep')?.addEventListener('submit',savePullStep);
  $('pullStepType')?.addEventListener('change',updatePullStepExecutorUi);
  $('pullStepFlow')?.addEventListener('change',updatePullStepExecutorUi);
  $('pullStepCode')?.addEventListener('input',updatePullStepExecutorUi);
  $('btnPullStepNew')?.addEventListener('click',clearPullStepForm);
  $('tbodyPullSteps')?.addEventListener('click',onPullStepsClick);
}

async function initPullModule(){
  if(!sb||!profile)return;
  try{
    if(canPull()||canNri()) await loadPullReferenceData();
    if(isPullDriver()) await loadPullActiveTrip();
    setupPullRealtime();
  }catch(e){console.error('Puxada init',e);if(canPull())toast(`Puxada: ${humanPullError(e)}`,'error');}
}

function pullOnView(name){
  if(name==='nri-carretas') return loadPullNriPending();
  if(name==='puxada-viagem') return loadPullActiveTrip();
  if(name==='puxada-farol') return loadPullFarol();
  if(name==='puxada-historico') return loadPullHistory();
  if(name==='puxada-dashboard') return loadPullDashboard();
  if(name==='puxada-metas'){ const y=new Date().getFullYear();if(!$('pullGoalYear').value)$('pullGoalYear').value=y;return loadPullGoals(); }
  if(name==='puxada-config') return loadPullConfig();
}

async function loadPullReferenceData(){
  const promises=[
    sb.from('pull_steps').select('*').order('step_type').order('sort_order'),
    sb.from('pull_settings').select('*').eq('singleton',true).maybeSingle(),
    sb.from('factories').select('name,active,latitude,longitude,radius_meters').eq('active',true).order('name'),
    sb.from('pull_vehicles').select('*').order('plate')
  ];
  if(hasPerm('PULL_TRIP')||hasPerm('PULL_CONFIG')) promises.push(sb.from('profiles').select('id,username,name,role,active').eq('role','MOTORISTA_PUXADOR').eq('active',true).order('name'));
  const rows=await Promise.all(promises);
  const err=rows.find(x=>x.error)?.error;if(err)throw err;
  const [steps,settings,factories,vehicles,profilesRes]=rows;
  pullMainSteps=(steps.data||[]).filter(x=>x.step_type==='MAIN'&&x.active).sort((a,b)=>a.sort_order-b.sort_order);
  pullOccurrenceTypes=(steps.data||[]).filter(x=>x.step_type==='OCCURRENCE'&&x.active).sort((a,b)=>a.sort_order-b.sort_order);
  pullSettings=settings.data||{singleton:true,gps_max_accuracy_m:200,track_interval_seconds:60,track_min_distance_m:50};
  pullFactories=factories.data||[];
  pullVehicles=vehicles.data||[];
  pullProfiles=profilesRes?.data||pullProfiles;
  populatePullReferenceInputs();
}

function populatePlateSelectors(){
  const vehicles=pullVehicles.filter(x=>x.active!==false&&String(x.plate||'').trim()).sort((a,b)=>String(a.plate).localeCompare(String(b.plate),'pt-BR'));
  const fill=(id)=>{
    const el=$(id);if(!el||el.disabled)return;
    const old=el.value;
    el.innerHTML='<option value="">Selecione</option>'+vehicles.map(x=>`<option value="${esc(x.plate)}">${esc(x.plate)}${x.carrier?` • ${esc(x.carrier)}`:''}</option>`).join('');
    if(vehicles.some(x=>x.plate===old))el.value=old;
  };
  fill('nriPlaca');
  fill('pullStartPlate');
}
let nriPlateLoadPromise=null;
async function ensureNriPlateOptions(){
  const el=$('nriPlaca');
  if(!el||el.disabled)return;
  if(pullVehicles.some(x=>x.active!==false&&String(x.plate||'').trim())){populatePlateSelectors();return;}
  if(nriPlateLoadPromise)return nriPlateLoadPromise;
  nriPlateLoadPromise=(async()=>{
    try{
      const {data,error}=await sb.from('pull_vehicles').select('id,plate,carrier,active').eq('active',true).order('plate');
      if(error)throw error;
      pullVehicles=data||[];
      populatePlateSelectors();
    }catch(err){
      console.warn('NRI - carregamento de placas',err);
      if(!el.options.length||el.options.length===1)toast('Não foi possível carregar as placas. Toque em Atualizar ou reabra o cadastro quando houver conexão.','error');
    }finally{nriPlateLoadPromise=null;}
  })();
  return nriPlateLoadPromise;
}
function populatePullReferenceInputs(){
  if($('pullStartOrigin')){
    const old=$('pullStartOrigin').value;
    const units=(refs.units||[]).filter(x=>x.active!==false).map(x=>x.name);
    $('pullStartOrigin').innerHTML='<option value="">Selecione</option>'+units.map(x=>`<option>${esc(x)}</option>`).join('');
    if(units.includes(old))$('pullStartOrigin').value=old;
  }
  if($('pullStartFactory')){
    const old=$('pullStartFactory').value;
    $('pullStartFactory').innerHTML='<option value="">Selecione</option>'+pullFactories.map(x=>`<option>${esc(x.name)}</option>`).join('');
    if(pullFactories.some(x=>x.name===old))$('pullStartFactory').value=old;
  }
  if($('pullStartDriver2')){
    const old=$('pullStartDriver2').value;
    const others=pullProfiles.filter(x=>x.id!==authUser?.id);
    $('pullStartDriver2').innerHTML='<option value="">Selecione</option>'+others.map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.username)})</option>`).join('');
    if(others.some(x=>x.id===old))$('pullStartDriver2').value=old;
  }
  populatePlateSelectors();
  const factoryOptions='<option value="">Todas</option>'+pullFactories.map(x=>`<option>${esc(x.name)}</option>`).join('');
  if($('pullHistFactory'))$('pullHistFactory').innerHTML=factoryOptions;
  if($('pullFactoryName'))$('pullFactoryName').innerHTML='<option value="">Selecione</option>'+pullFactories.map(x=>`<option>${esc(x.name)}</option>`).join('');
}

function setupPullRealtime(){
  teardownPullRealtime();
  if(!sb||(!canPull()&&!canNri()))return;
  pullRealtimeChannel=sb.channel(`pull-${authUser.id}-${Date.now()}`);
  ['pull_trips','pull_events','pull_occurrences','pull_track_points','pull_settings','marketplace_receipts'].forEach(table=>{
    pullRealtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},()=>schedulePullReload());
  });
  pullRealtimeChannel.subscribe();
}
function teardownPullRealtime(){if(pullRealtimeChannel&&sb){sb.removeChannel(pullRealtimeChannel).catch(()=>{});pullRealtimeChannel=null;}clearTimeout(pullReloadTimer);}
function schedulePullReload(){clearTimeout(pullReloadTimer);pullReloadTimer=setTimeout(async()=>{try{if(hasPerm('PULL_TRIP'))await loadPullActiveTrip(true);if(hasPerm('NRI_PENDING_VIEW'))await loadPullNriPending(true);if(activeView==='puxada-farol'&&hasPerm('PULL_FAROL'))await loadPullFarol(true);if(activeView==='puxada-historico'&&hasPerm('PULL_HISTORY'))await loadPullHistory(true);if(activeView==='puxada-dashboard'&&hasPerm('PULL_DASHBOARD'))await loadPullDashboard(true);}catch(e){console.warn(e);}},350);}

async function loadPullActiveTrip(silent=false){
  if(!isPullDriver())return;
  try{
    await loadPullReferenceData();
    const {data,error}=await sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).eq('status','IN_PROGRESS').or(`driver1_id.eq.${authUser.id},driver2_id.eq.${authUser.id}`).order('started_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    pullActiveTrip=data||null;
    if(pullActiveTrip){
      const [ev,oc]=await Promise.all([
        sb.from('pull_events').select('*').eq('trip_id',pullActiveTrip.id).order('step_order'),
        sb.from('pull_occurrences').select('*').eq('trip_id',pullActiveTrip.id).order('started_at')
      ]);
      if(ev.error)throw ev.error;if(oc.error)throw oc.error;
      pullDriverEvents=ev.data||[];pullDriverOccurrences=oc.data||[];
    }else{pullDriverEvents=[];pullDriverOccurrences=[];}
    renderPullDriver();
    syncPullTracking();
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
}

function pullNextStep(){
  if(!pullActiveTrip)return null;
  const max=pullDriverEvents.length?Math.max(...pullDriverEvents.map(x=>Number(x.step_order)||0)):-Infinity;
  return pullMainSteps.find(x=>Number(x.sort_order)>max)||null;
}
function pullIsActiveDriver(){return !!pullActiveTrip&&pullActiveTrip.active_driver_id===authUser?.id;}
function pullStepExecutorNumber(step){const n=Number(step?.executor_driver);return n===1||n===2?n:null;}
function pullStepExecutorName(step){if(!pullActiveTrip)return '';const n=pullStepExecutorNumber(step);return n===1?pullActiveTrip.driver1_name:n===2?pullActiveTrip.driver2_name:(pullActiveTrip.active_driver_name||'motorista ativo');}
function pullCanExecuteStep(step){if(!pullActiveTrip||!step)return false;const n=pullStepExecutorNumber(step);if(n===1)return pullActiveTrip.driver1_id===authUser?.id;if(n===2)return pullActiveTrip.driver2_id===authUser?.id;return pullIsActiveDriver();}
function pullGpsTarget(){return Math.min(500,Math.max(5,Number(pullSettings?.gps_max_accuracy_m||200)));}
async function refreshPullGpsTarget(){
  if(!sb)return pullGpsTarget();
  const {data,error}=await sb.from('pull_settings').select('singleton,gps_max_accuracy_m,track_interval_seconds,track_min_distance_m,updated_at').eq('singleton',true).maybeSingle();
  if(error)throw error;
  if(data)pullSettings={...(pullSettings||{}),...data};
  const target=pullGpsTarget();
  console.info(`[Puxada GPS] tolerância atual carregada do Supabase: ±${target} m`,data||null);
  return target;
}
function renderPullDriver(){
  const active=!!pullActiveTrip;
  $('pullDriverStartCard')?.classList.toggle('hidden',active);
  $('pullDriverActive')?.classList.toggle('hidden',!active);
  if(!active){
    stopPullTracking();stopPullClock();
    if($('pullStartGps')){$('pullStartGps').className='gps-status';$('pullStartGps').textContent=`Tolerância GPS carregada: até ±${pullGpsTarget()} m. A localização será capturada ao iniciar.`;}
    return;
  }
  $('pullActiveCode').textContent=pullActiveTrip.trip_code||'Puxada';
  $('pullActivePlate').textContent=pullActiveTrip.plate||'—';
  $('pullActiveFactory').textContent=pullActiveTrip.factory||'—';
  $('pullActiveDriver').textContent=pullActiveTrip.active_driver_name||'—';
  $('pullActiveSummary').textContent=`${pullActiveTrip.origin_unit} → ${pullActiveTrip.factory} • ${pullActiveTrip.carrier||'Ambev'} • M1 ${pullActiveTrip.driver1_name} + M2 ${pullActiveTrip.driver2_name} • início ${fmtDateTime(pullActiveTrip.started_at)}`;
  const next=pullNextStep();
  const nextNo=next?pullMainStepNumber(next):null;
  const responsible=next?pullStepExecutorName(next):'';
  const executorNo=next?pullStepExecutorNumber(next):null;
  const openOcc=pullDriverOccurrences.find(x=>x.status==='OPEN');
  const occurrenceLocksStep=!!openOcc&&!!next&&next.required!==false;
  $('pullNextStepName').textContent=next?`${nextNo}. ${next.name}`:'Todas as etapas concluídas';
  const canPoint=!!next&&pullCanExecuteStep(next)&&!occurrenceLocksStep;
  $('btnPullNextStep').disabled=!canPoint;
  $('btnPullNextStep').textContent=!next?'Ciclo concluído':occurrenceLocksStep?`Finalize ${openOcc.occurrence_name}`:canPoint?'Registrar próxima etapa':`Aguardando ${responsible}`;
  let hint=nextNo?`Etapa ${nextNo} de ${pullMainSteps.length} • responsável: ${executorNo?`Motorista ${executorNo} — `:''}${responsible}. GPS exigido ≤ ${pullGpsTarget()} m.`:'Todas as etapas principais foram concluídas.';
  if(next?.requires_factory_geofence){const f=pullFactories.find(x=>x.name===pullActiveTrip.factory);hint+=f?.radius_meters?` Raio de auditoria da fábrica: ${f.radius_meters} m; estar fora do raio não impede o registro.`:' A fábrica ainda não possui raio de auditoria configurado.';}
  if(occurrenceLocksStep)hint=`Ocorrência “${openOcc.occurrence_name}” em andamento. Finalize a ocorrência antes de registrar a etapa obrigatória ${nextNo}. ${next.name}.`;
  else if(next&&!pullCanExecuteStep(next))hint=`Esta etapa deve ser registrada por ${executorNo?`Motorista ${executorNo} — `:''}${responsible}. O seu acesso à viagem continua disponível para acompanhamento.`;
  $('pullNextStepHint').textContent=hint;
  const occBox=$('pullOpenOccurrence');
  if(openOcc){occBox.classList.remove('hidden');occBox.innerHTML=`<div><small>OCORRÊNCIA EM ANDAMENTO</small><strong>${esc(openOcc.occurrence_name)}</strong><span>Iniciada ${fmtDateTime(openOcc.started_at)} por ${esc(openOcc.started_by_name)}</span></div><button class="btn primary" data-end-occ="${openOcc.id}" ${pullIsActiveDriver()?'':'disabled'}>Encerrar ocorrência</button>`;}
  else{occBox.classList.add('hidden');occBox.innerHTML='';}
  $('pullOccurrenceButtons').innerHTML=pullOccurrenceTypes.map(x=>`<button class="btn secondary" data-occ="${x.id}" ${(!pullIsActiveDriver()||!!openOcc)?'disabled':''}>+ ${esc(x.name)}</button>`).join('');
  const timeline=[...pullDriverEvents.map(x=>({kind:'STEP',at:x.recorded_at,name:pullNumberedStepName(x),user:x.user_name,gps:`${Number(x.latitude).toFixed(5)}, ${Number(x.longitude).toFixed(5)}`,extra:`precisão ±${Math.round(Number(x.gps_accuracy)||0)} m${x.geofence_status==='INSIDE'?` • dentro do raio • ${Math.round(x.distance_factory_m||0)} m`:x.geofence_status==='OUTSIDE'?` • fora do raio • ${Math.round(x.distance_factory_m||0)} m • permitido`:''}`})),...pullDriverOccurrences.map(x=>({kind:'OCC',at:x.started_at,name:x.occurrence_name,user:x.started_by_name,gps:`${Number(x.start_latitude).toFixed(5)}, ${Number(x.start_longitude).toFixed(5)}`,extra:x.status==='OPEN'?'Em andamento':`Encerrada ${fmtDateTime(x.ended_at)}`}))].sort((a,b)=>new Date(a.at)-new Date(b.at));
  const tl=$('pullDriverTimeline');
  if(!timeline.length){tl.className='pull-timeline empty-state';tl.textContent='Nenhuma etapa.';}else{tl.className='pull-timeline';tl.innerHTML=timeline.map(x=>`<div class="pull-timeline-item ${x.kind==='OCC'?'occurrence':''}"><span class="dot"></span><div><small>${fmtDateTime(x.at)}</small><strong>${esc(x.name)}</strong><span>${esc(x.user)} • ${esc(x.gps)}${x.extra?` • ${esc(x.extra)}`:''}</span></div></div>`).join('');}
  startPullClock();
}
function startPullClock(){stopPullClock();const tick=()=>{if(!$('pullActiveElapsed')||!pullActiveTrip)return;const sec=Math.max(0,Math.floor((Date.now()-new Date(pullActiveTrip.started_at).getTime())/1000));$('pullActiveElapsed').textContent=fmtDurationSeconds(sec);};tick();pullClockTimer=setInterval(tick,1000);}
function stopPullClock(){if(pullClockTimer){clearInterval(pullClockTimer);pullClockTimer=null;}}

async function startPullTrip(e){
  e.preventDefault();
  const origin=$('pullStartOrigin').value;
  const plate=String($('pullStartPlate').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const factory=$('pullStartFactory').value;
  const partner='Ambev';
  const driver2=$('pullStartDriver2').value;
  if(!origin||!plate||!factory||!driver2)return toast('Informe origem, placa, fábrica e Motorista 2.','error');
  const btn=$('btnPullStart');btn.disabled=true;btn.textContent='Atualizando configuração…';$('pullStartGps').className='gps-status';$('pullStartGps').textContent='Consultando tolerância GPS atual no Supabase…';
  try{
    const target=await refreshPullGpsTarget();
    btn.textContent='Capturando GPS…';$('pullStartGps').textContent=`Buscando GPS (limite atual ≤ ${target} m)…`;
    const gps=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>{$('pullStartGps').textContent=`GPS atual ±${Math.round(s.accuracy)} m • limite carregado ≤ ${target} m…`;}});
    $('pullStartGps').className='gps-status ok';$('pullStartGps').textContent=`GPS pronto • precisão ±${Math.round(gps.accuracy||0)} m`;
    btn.textContent='Iniciando…';
    const {data,error}=await sb.rpc('start_pull_trip',{p_origin_unit:origin,p_plate:plate,p_factory:factory,p_carrier:partner,p_driver2:driver2,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy,p_device_at:gps.capturedAt});
    if(error)throw error;pullActiveTrip=data;toast('Puxada iniciada com GPS validado. O ciclo já está disponível para os dois motoristas.','success');await loadPullActiveTrip();
  }catch(err){$('pullStartGps').className='gps-status error';$('pullStartGps').textContent=`Não foi possível iniciar: ${humanGpsOrPullError(err)}`;toast(humanGpsOrPullError(err),'error');}
  finally{btn.disabled=false;btn.textContent='Iniciar viagem';}
}

async function recordPullNextStep(){
  if(!pullActiveTrip)return;
  const step=pullNextStep();if(!step||!pullCanExecuteStep(step))return;
  const openOcc=pullDriverOccurrences.find(x=>x.status==='OPEN');
  if(openOcc&&step.required!==false){
    toast(`Finalize a ocorrência “${openOcc.occurrence_name}” antes de registrar a próxima etapa obrigatória.`,'error');
    renderPullDriver();
    return;
  }
  const btn=$('btnPullNextStep');btn.disabled=true;btn.textContent='Atualizando configuração…';
  const hint=$('pullNextStepHint');const baseHint=hint?.textContent||'';
  try{
    const target=await refreshPullGpsTarget();
    btn.textContent='Capturando GPS…';
    const gps=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>{if(hint)hint.textContent=`Buscando posição… sinal atual ±${Math.round(s.accuracy)} m • limite carregado ≤ ${target} m.`;}});
    if(hint)hint.textContent=`GPS validado: ±${Math.round(gps.accuracy)} m. Registrando etapa…`;
    btn.textContent='Registrando…';
    const {data,error}=await sb.rpc('record_pull_step',{p_trip_id:pullActiveTrip.id,p_step_id:step.id,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy,p_exception_reason:'',p_device_at:gps.capturedAt});
    if(error)throw error;
    const ended=data?.trip?.status==='ARRIVED';
    const ev=data?.event||{};
    if(step.action_code==='ARRIVE_FACTORY'){
      const dist=Number(ev.distance_factory_m);const radius=Number(ev.factory_radius_m);
      const audit=ev.geofence_status==='INSIDE'?`Dentro do raio de auditoria • ${Math.round(dist||0)} m do ponto cadastrado.`:ev.geofence_status==='OUTSIDE'?`Fora do raio de auditoria • ${Math.round(dist||0)} m do ponto cadastrado (raio ${Math.round(radius||0)} m). Registro permitido.`:'Raio de auditoria não configurado para esta fábrica.';
      toast(`Chegada à fábrica registrada com precisão ±${Math.round(gps.accuracy)} m. ${audit}`,'success');
    }else toast(ended?(pullActiveTrip?.cycle_type==='TRANSFER'?'Transferência finalizada com chegada à Matriz Caicó.':'Ciclo encerrado na revenda. A carreta já foi enviada para NRIs.'):`Etapa registrada • GPS ±${Math.round(gps.accuracy)} m.`,'success');
    await loadPullActiveTrip();
  }catch(err){if(hint)hint.textContent=baseHint;toast(humanGpsOrPullError(err),'error');}
  finally{btn.disabled=false;renderPullDriver();}
}

async function onPullOccurrenceClick(e){const b=e.target.closest('button[data-occ]');if(!b||b.disabled||!pullActiveTrip)return;const step=pullOccurrenceTypes.find(x=>x.id===b.dataset.occ);if(!step)return;const note=prompt(`Observação para ${step.name} (opcional):`,'')||'';b.disabled=true;const old=b.textContent;try{b.textContent='Atualizando configuração…';const target=await refreshPullGpsTarget();const gps=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>b.textContent=`GPS ±${Math.round(s.accuracy)} m / limite ${target} m…`});b.textContent='Registrando…';const {error}=await sb.rpc('start_pull_occurrence',{p_trip_id:pullActiveTrip.id,p_step_id:step.id,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy,p_note:note});if(error)throw error;toast(step.duration_mode==='INTERVAL'?`${step.name} iniciado.`:`${step.name} registrado.`,'success');await loadPullActiveTrip();}catch(err){toast(humanGpsOrPullError(err),'error');}finally{b.disabled=false;b.textContent=old;}}
async function onPullOpenOccurrenceClick(e){const b=e.target.closest('[data-end-occ]');if(!b||b.disabled)return;const old=b.textContent;b.disabled=true;try{b.textContent='Atualizando configuração…';const target=await refreshPullGpsTarget();const gps=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>b.textContent=`GPS ±${Math.round(s.accuracy)} m / limite ${target} m…`});b.textContent='Encerrando…';const {error}=await sb.rpc('end_pull_occurrence',{p_occurrence_id:b.dataset.endOcc,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy});if(error)throw error;toast('Ocorrência encerrada.','success');await loadPullActiveTrip();}catch(err){toast(humanGpsOrPullError(err),'error');}finally{b.disabled=false;b.textContent=old;}}

function syncPullTracking(){
  const next=pullNextStep();
  if(!isPullDriver()||!pullActiveTrip||!next||!pullCanExecuteStep(next)||pullActiveTrip.status!=='IN_PROGRESS'){stopPullTracking();return;}
  if(pullTrackWatch!==null)return;
  const minInterval=Math.max(30,Number(pullSettings?.track_interval_seconds||60))*1000;
  const minDistance=Math.max(0,Number(pullSettings?.track_min_distance_m||50));
  const maxAccuracy=pullGpsTarget();
  const handle=async p=>{try{const point=gpsSample(p);rememberPullGpsSample(point);if(point.accuracy>maxAccuracy)return;const now=Date.now();if(pullTrackLast){const elapsed=now-pullTrackLast.at;const d=distanceMeters(point.latitude,point.longitude,pullTrackLast.latitude,pullTrackLast.longitude);if(elapsed<minInterval&&d<minDistance)return;}pullTrackLast={...point,at:now};await sb.rpc('record_pull_track_point',{p_trip_id:pullActiveTrip.id,p_latitude:point.latitude,p_longitude:point.longitude,p_accuracy:point.accuracy,p_device_at:point.capturedAt});}catch(e){console.warn('Rastreio Puxada',e);}};
  const capGeo=getCapacitorGeolocation();
  if(capGeo&&isNativeCapacitor()&&typeof capGeo.watchPosition==='function'){
    capGeo.watchPosition({enableHighAccuracy:true,timeout:30000,maximumAge:0,minimumUpdateInterval:1000},(pos,err)=>{if(pos)handle(pos);else if(err)console.warn(err);}).then(id=>{pullTrackWatch={kind:'cap',id};}).catch(e=>console.warn(e));
  }else if(navigator.geolocation){const id=navigator.geolocation.watchPosition(handle,e=>console.warn(e),{enableHighAccuracy:true,maximumAge:0,timeout:30000});pullTrackWatch={kind:'web',id};}
}
function stopPullTracking(){if(pullTrackWatch){try{if(pullTrackWatch.kind==='cap'){const geo=getCapacitorGeolocation();geo?.clearWatch?.({id:pullTrackWatch.id});}else navigator.geolocation?.clearWatch(pullTrackWatch.id);}catch(_e){}pullTrackWatch=null;}pullTrackLast=null;}

async function loadPullNriPending(silent=false){
  if(!hasPerm('NRI_PENDING_VIEW'))return;
  try{const {data,error}=await sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).eq('status','ARRIVED').eq('nri_status','PENDING').order('ended_at',{ascending:false}).limit(200);if(error)throw error;const rows=data||[];$('badgePullNri').textContent=rows.length;const el=$('pullNriCards');if(!rows.length){el.className='pull-card-grid empty-state';el.textContent='Nenhuma carreta pendente.';return;}el.className='pull-card-grid';el.innerHTML=rows.map(t=>`<article class="pull-card"><div class="pull-card-head"><div><small>${esc(t.trip_code)}</small><strong>${esc(t.plate)}</strong></div><span class="status pending">Aguardando NRI</span></div><div class="pull-card-body"><span><b>Fábrica:</b> ${esc(t.factory)}</span><span><b>Motorista:</b> ${esc(t.ended_by_name||'—')}</span><span><b>Recebida:</b> ${fmtDateTime(t.ended_at)}</span><span><b>Unidade:</b> ${esc(t.origin_unit)}</span></div><button class="btn primary wide" data-pull-nri="${t.id}">Cadastrar NRIs</button></article>`).join('');el._pullRows=rows;}catch(e){if(!silent)toast(humanPullError(e),'error');}
}
function onPullNriCardsClick(e){const b=e.target.closest('[data-pull-nri]');if(!b)return;const rows=$('pullNriCards')._pullRows||[];const t=rows.find(x=>x.id===b.dataset.pullNri);if(t)prefillNriFromPull(t);}
function prefillNriFromPull(t){
  clearNriRequest();nriPullLocked=true;$('nriPullTripId').value=t.id;
  const end=new Date(t.ended_at);
  const unitSel=$('nriUnidade');
  if(unitSel){
    [...unitSel.options].filter(o=>o.dataset.fixed==='__fixed_value__').forEach(o=>o.remove());
    if(![...unitSel.options].some(o=>o.value===t.origin_unit)){const o=document.createElement('option');o.value=t.origin_unit;o.textContent=t.origin_unit;unitSel.appendChild(o);}
    unitSel.value=t.origin_unit;unitSel.disabled=false;unitSel.required=true;
  }
  $('nriTipo').value='AMBEV';$('nriTipo').disabled=true;$('nriTipo').required=false;
  $('nriRecebimento').value=localIsoDate(end);$('nriRecebimento').disabled=true;
  $('nriHora').value=localTime(end);$('nriHora').disabled=true;
  setSelectFixedValue($('nriMotorista'),t.ended_by_name||t.active_driver_name||'—',true);
  setSelectFixedValue($('nriPlaca'),t.plate,true);
  setSelectFixedValue($('nriFabrica'),t.factory,true);
  $('nriPullBanner').classList.remove('hidden');$('nriPullBanner').innerHTML=`<strong>${esc(t.trip_code)} • ${esc(t.plate)}</strong><span>Dados da carreta preenchidos automaticamente pela Puxada. A unidade pode ser ajustada antes do cadastro dos produtos, lotes, validades e NRIs.</span>`;
  openView('nri-cadastro',true);
}
function clearNriPullContext(){
  nriPullLocked=false;if(!$('nriPullTripId'))return;$('nriPullTripId').value='';$('nriPullBanner').classList.add('hidden');$('nriPullBanner').innerHTML='';
  [$('nriUnidade'),$('nriMotorista'),$('nriFabrica')].forEach(sel=>{if(!sel)return;[...sel.options].filter(o=>o.dataset.fixed==='__fixed_value__').forEach(o=>o.remove());sel.disabled=false;sel.required=true;});
  $('nriTipo').disabled=false;$('nriTipo').required=true;$('nriRecebimento').disabled=false;$('nriHora').disabled=false;setSelectFixedValue($('nriPlaca'),'--',false);
  populateReferenceInputs();populatePlateSelectors();
}

async function loadPullFarol(silent=false){
  if(!hasPerm('PULL_FAROL'))return;
  try{await loadPullReferenceData();const {data,error}=await sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).eq('status','IN_PROGRESS').order('started_at');if(error)throw error;const trips=data||[];$('badgePullAtivos').textContent=trips.length;if(!trips.length){$('pullFarolCards')._rows=[];renderPullFarol();return;}const ids=trips.map(x=>x.id);const [ev,tp]=await Promise.all([sb.from('pull_events').select('*').in('trip_id',ids).order('recorded_at',{ascending:false}),sb.from('pull_track_points').select('*').in('trip_id',ids).order('recorded_at',{ascending:false}).limit(2000)]);if(ev.error)throw ev.error;if(tp.error)throw tp.error;const eventBy=new Map(),trackBy=new Map();(ev.data||[]).forEach(x=>{if(!eventBy.has(x.trip_id))eventBy.set(x.trip_id,x);});(tp.data||[]).forEach(x=>{if(!trackBy.has(x.trip_id))trackBy.set(x.trip_id,x);});$('pullFarolCards')._rows=trips.map(t=>({...t,last_event:eventBy.get(t.id)||null,last_track:trackBy.get(t.id)||null}));renderPullFarol();}catch(e){if(!silent)toast(humanPullError(e),'error');}
}
function renderPullFarol(){const box=$('pullFarolCards');const q=norm($('pullFarolBusca')?.value||'');const rows=(box?._rows||[]).filter(t=>!q||norm([t.origin_unit,t.plate,t.carrier,t.factory,t.driver1_name,t.driver2_name,t.active_driver_name].join(' ')).includes(q));if(!rows.length){box.className='pull-card-grid empty-state';box.textContent='Nenhuma Puxada em andamento.';return;}box.className='pull-card-grid';box.innerHTML=rows.map(t=>{const last=t.last_track||t.last_event;const age=last?Math.max(0,Math.round((Date.now()-new Date(last.recorded_at).getTime())/60000)):null;return `<article class="pull-card farol"><div class="pull-card-head"><div><small>${esc(t.trip_code)}</small><strong>${esc(t.plate)} • ${esc(t.factory)}</strong></div>${pullFarolBadge(t,last)}</div><div class="pull-card-body"><span><b>Origem:</b> ${esc(t.origin_unit||'—')}</span><span><b>Parceiro:</b> ${esc(t.carrier||'—')}</span><span><b>Motorista atual:</b> ${esc(t.active_driver_name||'—')}</span><span><b>Etapa:</b> ${esc(t.last_event?pullNumberedStepName(t.last_event):'1. Saída da revenda')}</span><span><b>Início:</b> ${fmtDateTime(t.started_at)}</span><span><b>Último GPS:</b> ${last?`${age} min atrás`:'Sem rastreio'}</span></div><button class="btn secondary wide" data-pull-detail="${t.id}">Ver mapa e linha do tempo</button></article>`;}).join('');}
function pullFarolBadge(t,last){if(!last)return '<span class="status bad">Sem GPS</span>';const age=(Date.now()-new Date(last.recorded_at).getTime())/60000;if(age>10)return '<span class="status pending">GPS atrasado</span>';return '<span class="status ok">Em andamento</span>';}
function onPullFarolClick(e){const b=e.target.closest('[data-pull-detail]');if(b)openPullTripDetail(b.dataset.pullDetail,true);}

async function loadPullHistory(silent=false){
  if(!hasAnyPerm('PULL_HISTORY,PULL_TMA_ADJUST'))return;
  try{
    await loadPullReferenceData();
    let q=sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).order('started_at',{ascending:false}).limit(1500);
    const de=$('pullHistDe')?.value,ate=$('pullHistAte')?.value;
    if(de)q=q.gte('started_at',`${de}T00:00:00-03:00`);
    if(ate)q=q.lte('started_at',`${ate}T23:59:59-03:00`);
    const {data,error}=await q;if(error)throw error;
    pullHistory=data||[];
    pullHistoryEvents=await loadPullHistoryEvents(pullHistory.map(x=>x.id));
    renderPullHistory();
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
}
async function loadPullHistoryEvents(ids){
  if(!ids?.length)return [];
  const out=[];
  for(let i=0;i<ids.length;i+=75){
    const chunk=ids.slice(i,i+75);
    const {data,error}=await sb.from('pull_events').select('trip_id,step_id,step_name,action_code,step_order,recorded_at,user_name,latitude,longitude,gps_accuracy,geofence_status,distance_factory_m,factory_radius_m').in('trip_id',chunk).order('step_order');
    if(error)throw error;
    out.push(...(data||[]));
  }
  return out;
}
function filteredPullHistoryRows(){
  const q=norm($('pullHistBusca')?.value||''),factory=$('pullHistFactory')?.value||'';
  return pullHistory.filter(t=>(!factory||t.factory===factory)&&(!q||norm([t.trip_code,t.origin_unit,t.plate,t.carrier,t.factory,t.driver1_name,t.driver2_name,t.ended_by_name].join(' ')).includes(q)));
}
function pullHistoryEventLookup(){
  const map=new Map();
  pullHistoryEvents.forEach(e=>{const key=`${e.trip_id}|${e.action_code}`;if(!map.has(key))map.set(key,e);});
  return map;
}
function pullHistoryStageEvent(lookup,tripId,step){return lookup.get(`${tripId}|${step.action_code}`)||null;}
function renderPullHistoryHead(){
  const head=$('pullHistoryHead');if(!head)return;
  const stages=pullMainSteps.map((s,i)=>`<th class="pull-history-stage-head"><span>${i+1}</span>${esc(s.name)}</th>`).join('');
  head.innerHTML=`<th>Viagem</th><th>Origem</th><th>Placa / Fábrica</th><th>Motoristas</th>${stages}<th>TMV Ida</th><th>TMA Fábrica</th><th>TMV Volta</th><th>TMA Revenda</th><th>Ciclo</th><th>NRI</th><th>Ações</th>`;
}
function renderPullHistory(){
  if(!$('tbodyPullHistory'))return;
  renderPullHistoryHead();
  const rows=filteredPullHistoryRows(),lookup=pullHistoryEventLookup();
  const totalCols=4+pullMainSteps.length+7;
  $('tbodyPullHistory').innerHTML=rows.length?rows.map(t=>{
    const m=pullTripMetrics(t);
    const stageCells=pullMainSteps.map((step,i)=>{const ev=pullHistoryStageEvent(lookup,t.id,step);return `<td class="pull-history-stage-cell">${ev?`<strong>${fmtDateTime(ev.recorded_at)}</strong><small>${esc(ev.user_name||'—')} • GPS ±${Math.round(Number(ev.gps_accuracy)||0)} m</small>`:'—'}</td>`;}).join('');
    return `<tr><td><strong>${esc(t.trip_code)}</strong><small>${pullTripStatusLabel(t)}</small></td><td>${esc(t.origin_unit||'—')}</td><td>${esc(t.plate)}<small>${esc(t.factory)}</small></td><td>${esc(t.driver1_name)}<small>${esc(t.driver2_name)}</small></td>${stageCells}<td>${fmtMinutes(m.TMV_OUT)}</td><td>${fmtMinutes(m.FACTORY)}</td><td>${fmtMinutes(m.TMV_RETURN)}</td><td>${m.UNIT==null?'Aguardando':`${fmtMinutes(m.UNIT)}${Number(t.tma_adjust_minutes)>0?`<small>Bruto ${fmtMinutes(m.UNIT_RAW)} • -${fmtMinutes(t.tma_adjust_minutes)}</small>`:''}`}</td><td>${m.CYCLE==null?'Aguardando':fmtMinutes(m.CYCLE)}</td><td>${t.nri_status==='COMPLETED'?'<span class="status ok">Concluído</span>':t.nri_status==='PENDING'?'<span class="status pending">Pendente</span>':'—'}</td><td><div class="mini-actions"><button class="mini-btn" data-hist-detail="${t.id}">Detalhar</button>${t.next_started_at?`<button class="mini-btn" data-tma-adjust="${t.id}">Ajustar TMA</button>`:''}</div></td></tr>`;
  }).join(''):`<tr><td colspan="${totalCols}">Nenhuma viagem.</td></tr>`;
}
function exportPullHistoryCsv(){
  const rows=filteredPullHistoryRows();if(!rows.length)return toast('Não há viagens para exportar com os filtros atuais.','error');
  const lookup=pullHistoryEventLookup();
  const stageHeaders=pullMainSteps.map((s,i)=>`${i+1}. ${s.name}`);
  const headers=['Viagem','Status','Origem','Placa','Fábrica','Parceiro','Motorista 1','Motorista 2',...stageHeaders,'TMV Ida','TMA Fábrica','TMV Volta','TMA Revenda bruto','Horas a diminuir','TMA Revenda ajustado','Ciclo','NRI'];
  const matrix=rows.map(t=>{
    const m=pullTripMetrics(t);
    const stageValues=pullMainSteps.map(step=>{const ev=pullHistoryStageEvent(lookup,t.id,step);if(!ev)return '';const lat=Number(ev.latitude),lon=Number(ev.longitude),acc=Number(ev.gps_accuracy);const gps=Number.isFinite(lat)&&Number.isFinite(lon)?` | GPS ${lat.toFixed(6)}, ${lon.toFixed(6)}${Number.isFinite(acc)?` | ±${Math.round(acc)} m`:''}`:'';return `${fmtDateTime(ev.recorded_at)} | ${ev.user_name||''}${gps}`;});
    return [t.trip_code,pullTripStatusLabel(t),t.origin_unit,t.plate,t.factory,t.carrier||'Ambev',t.driver1_name,t.driver2_name,...stageValues,fmtMinutes(m.TMV_OUT),fmtMinutes(m.FACTORY),fmtMinutes(m.TMV_RETURN),fmtMinutes(m.UNIT_RAW),fmtMinutes(Number(t.tma_adjust_minutes||0)),fmtMinutes(m.UNIT),fmtMinutes(m.CYCLE),t.nri_status||''];
  });
  downloadCsv(`historico_puxada_${localIsoDate(new Date())}.csv`,[headers,...matrix]);
}
function pullTripStatusLabel(t){return t.status==='IN_PROGRESS'?'Em andamento':t.kpi_status==='WAITING_NEXT_START'?'Viagem finalizada • aguardando próxima saída':t.kpi_status==='CLOSED'?'Ciclo KPI fechado':'Cancelado';}
function onPullHistoryClick(e){const d=e.target.closest('[data-hist-detail]');if(d)return openPullTripDetail(d.dataset.histDetail,false);const a=e.target.closest('[data-tma-adjust]');if(a)return openPullTmaAdjust(a.dataset.tmaAdjust);}

async function openPullTripDetail(id,live=false){
  try{
    const t=(pullHistory.find(x=>x.id===id)||($('pullFarolCards')?._rows||[]).find(x=>x.id===id))||((await sb.from('pull_trips').select('*').eq('id',id).single()).data);
    if(!t)throw new Error('CICLO_NAO_ENCONTRADO');
    const [ev,oc,tp,aud,nri]=await Promise.all([
      sb.from('pull_events').select('*').eq('trip_id',id).order('recorded_at'),
      sb.from('pull_occurrences').select('*').eq('trip_id',id).order('started_at'),
      sb.from('pull_track_points').select('*').eq('trip_id',id).order('recorded_at').limit(5000),
      sb.from('pull_tma_adjust_audit').select('*').eq('trip_id',id).order('changed_at',{ascending:false}),
      sb.from('nri_requests').select('id,created_at').eq('pull_trip_id',id)
    ]);
    [ev,oc,tp,aud,nri].forEach(r=>{if(r.error)throw r.error;});
    const m=pullTripMetrics(t);
    const transfer=t.cycle_type==='TRANSFER';
    const mapId=`pullMap-${String(id).replace(/-/g,'')}`;
    const timeline=[
      ...(ev.data||[]).map(x=>({kind:'STEP',mapKey:String(x.id||`${x.action_code||'STEP'}-${x.step_order||''}-${x.recorded_at||''}`),at:x.recorded_at,title:pullNumberedStepName(x),detail:`${x.user_name} • ${Number(x.latitude).toFixed(5)}, ${Number(x.longitude).toFixed(5)} • precisão ±${Math.round(x.gps_accuracy||0)} m${x.geofence_status==='INSIDE'?` • dentro do raio de auditoria (${Math.round(x.distance_factory_m||0)} m)`:x.geofence_status==='OUTSIDE'?` • fora do raio de auditoria (${Math.round(x.distance_factory_m||0)} m)${x.exception_reason?` • ${x.exception_reason}`:''}`:''}`})),
      ...(oc.data||[]).map(x=>({kind:'OCC',mapKey:'',at:x.started_at,title:`Ocorrência: ${x.occurrence_name}`,detail:`${x.started_by_name}${x.ended_at?` • ${fmtDurationMinutes(minutesBetween(x.started_at,x.ended_at))}`:' • em andamento'}${x.note?` • ${x.note}`:''}`}))
    ].sort((a,b)=>new Date(a.at)-new Date(b.at));
    const body=`<div class="detail-grid"><div class="detail-card"><small>Origem</small><strong>${esc(t.origin_unit||'—')}</strong></div><div class="detail-card"><small>${transfer?'Placa / rota':'Placa / fábrica'}</small><strong>${esc(t.plate)} • ${esc(transfer?'Matriz → Filial → Matriz':t.factory)}</strong></div><div class="detail-card"><small>${transfer?'Tipo':'Parceiro'}</small><strong>${esc(transfer?'Transferência':t.carrier||'Ambev')}</strong></div><div class="detail-card"><small>${transfer?'Motorista':'Motoristas'}</small><strong>${esc(t.driver1_name)}${transfer?'':` / ${esc(t.driver2_name)}`}</strong></div><div class="detail-card"><small>Início</small><strong>${fmtDateTime(t.started_at)}</strong></div><div class="detail-card"><small>Fim da viagem</small><strong>${fmtDateTime(t.ended_at)}</strong></div></div>${transfer?`<div class="pull-metric-strip"><span>Tipo <b>Transferência</b></span><span>Ciclo Matriz → Filial → Matriz <b>${m.CYCLE==null?'Aguardando':fmtMinutes(m.CYCLE)}</b></span></div>`:`<div class="pull-metric-strip"><span>TMV Ida <b>${fmtMinutes(m.TMV_OUT)}</b></span><span>TMA Fábrica <b>${fmtMinutes(m.FACTORY)}</b></span><span>TMV Volta <b>${fmtMinutes(m.TMV_RETURN)}</b></span><span>TMA Revenda <b>${m.UNIT==null?'Aguardando':fmtMinutes(m.UNIT)}</b></span><span>Ciclo <b>${m.CYCLE==null?'Aguardando':fmtMinutes(m.CYCLE)}</b></span></div>`}${t.tma_adjust_minutes>0?`<div class="notice"><strong>TMA ajustado:</strong> bruto ${fmtMinutes(m.UNIT_RAW)} − ${fmtMinutes(t.tma_adjust_minutes)} = <b>${fmtMinutes(m.UNIT)}</b><br>${esc(t.tma_adjust_reason)} • por ${esc(t.tma_adjusted_by_name||'Admin')} em ${fmtDateTime(t.tma_adjusted_at)}</div>`:''}<div id="${mapId}" class="pull-map"></div><div class="section-title">Linha do tempo</div><div class="pull-timeline">${timeline.map(x=>`<div class="pull-timeline-item ${x.kind==='OCC'?'occurrence':''}"><span class="dot"></span><div><small>${fmtDateTime(x.at)}</small><strong>${esc(x.title)}</strong><span>${esc(x.detail)}</span>${x.mapKey?`<button type="button" class="pull-map-jump" data-pull-map-jump="${esc(x.mapKey)}" data-pull-map-id="${esc(mapId)}">Ver no mapa</button>`:''}</div></div>`).join('')}</div>${transfer?'':`<div class="notice"><strong>NRIs vinculados:</strong> ${(nri.data||[]).length}</div>`}${(aud.data||[]).length?`<details><summary>Auditoria de ajustes TMA (${aud.data.length})</summary>${aud.data.map(a=>`<div class="audit-row">${fmtDateTime(a.changed_at)} • ${esc(a.changed_by_name)} • ${fmtMinutes(a.old_minutes)} → ${fmtMinutes(a.new_minutes)} • ${esc(a.new_reason||'sem ajuste')}</div>`).join('')}</details>`:''}`;
    const actions=[];
    if(hasPerm('PULL_TMA_ADJUST')&&!transfer&&!live&&t.next_started_at)actions.push({label:'Ajustar TMA Revenda',class:'secondary',onClick:()=>{closeModal();openPullTmaAdjust(t.id);}});
    openModal(`${transfer?'TRANSFERÊNCIA':'PUXADA'} • ${t.trip_code} • ${t.plate}`,pullTripStatusLabel(t),body,actions);
    setTimeout(()=>{
      renderPullMap(mapId,t,tp.data||[],ev.data||[]);
      const modalBody=$('modalBody');
      if(modalBody)modalBody.onclick=e=>{const b=e.target.closest('[data-pull-map-jump]');if(b)focusPullMapPoint(b.dataset.pullMapId,b.dataset.pullMapJump);};
    },120);
  }catch(e){toast(humanPullError(e),'error');}
}
function renderPullMap(mapId,t,track,events){
  const el=$(mapId);if(!el||!window.L)return null;
  try{
    const old=pullMapContexts.get(mapId);
    if(old?.map){try{old.map.remove();}catch(_e){}}
    pullMapContexts.delete(mapId);
    const map=L.map(el);pullMapInstances.push(map);
    const markers=new Map();
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    const trackPts=(track||[]).map(x=>[Number(x.latitude),Number(x.longitude)]).filter(x=>x.every(Number.isFinite));
    const eventRows=(events||[]).filter(x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))).sort((a,b)=>(Number(a.step_order)||0)-(Number(b.step_order)||0)||new Date(a.recorded_at)-new Date(b.recorded_at));
    const eventPts=eventRows.map(x=>[Number(x.latitude),Number(x.longitude)]);
    if(trackPts.length>1)L.polyline(trackPts).addTo(map);
    else if(eventPts.length>1)L.polyline(eventPts).addTo(map);
    eventRows.forEach((ev,idx)=>{
      const n=pullMainStepNumber(ev)||idx+1;
      const key=String(ev.id||`${ev.action_code||'STEP'}-${ev.step_order||''}-${ev.recorded_at||''}`);
      const icon=L.divIcon({className:'pull-stage-marker-shell',html:`<span class="pull-stage-map-marker">${n}</span>`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-18]});
      const audit=ev.geofence_status==='INSIDE'?`<br>Dentro do raio • ${Math.round(Number(ev.distance_factory_m)||0)} m`:ev.geofence_status==='OUTSIDE'?`<br>Fora do raio • ${Math.round(Number(ev.distance_factory_m)||0)} m`:'';
      const marker=L.marker([Number(ev.latitude),Number(ev.longitude)],{icon}).addTo(map).bindPopup(`<strong>Etapa ${n}: ${esc(ev.step_name||'Etapa')}</strong><br>${esc(fmtDateTime(ev.recorded_at))}<br>${esc(ev.user_name||'')}${audit}`);
      markers.set(key,marker);
    });
    const boundsPts=[...trackPts,...eventPts];
    if(boundsPts.length)map.fitBounds(L.latLngBounds(boundsPts).pad(.15));else map.setView([-6.5,-36.5],6);
    const f=pullFactories.find(x=>x.name===t.factory);
    if(f?.latitude!=null&&f?.longitude!=null){L.marker([f.latitude,f.longitude]).addTo(map).bindPopup(`Fábrica ${esc(f.name)}`);if(f.radius_meters)L.circle([f.latitude,f.longitude],{radius:Number(f.radius_meters)}).addTo(map);}
    const ctx={map,markers,container:el};
    pullMapContexts.set(mapId,ctx);
    return ctx;
  }catch(e){console.warn(e);return null;}
}
function focusPullMapPoint(mapId,mapKey){
  const ctx=pullMapContexts.get(mapId);
  const marker=ctx?.markers?.get(String(mapKey||''));
  if(!ctx||!marker)return toast('Não foi possível localizar esta etapa no mapa.','error');
  const point=marker.getLatLng();
  ctx.container?.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>{try{ctx.map.invalidateSize();ctx.map.flyTo(point,Math.max(17,ctx.map.getZoom()||0),{animate:true,duration:.55});marker.openPopup();}catch(e){console.warn(e);}},180);
}
function cleanupPullMaps(){
  pullMapContexts.forEach(ctx=>{try{ctx.map?.remove();}catch(_e){}});
  pullMapContexts.clear();
  pullMapInstances=[];
}

function openPullTmaAdjust(id){if(!hasPerm('PULL_TMA_ADJUST'))return toast('Seu usuário não possui permissão para ajustar TMA.','error');const t=pullHistory.find(x=>x.id===id);if(!t||!t.ended_at||!t.next_started_at)return toast('O TMA Revenda ainda não está fechado.','error');const raw=minutesBetween(t.ended_at,t.next_started_at);const current=Number(t.tma_adjust_minutes||0);const suggested=current||pullSuggestedDiscountForTrip(id);const body=`<div class="notice">TMA bruto desta placa: <strong>${fmtMinutes(raw)}</strong>. O dashboard utilizará TMA bruto menos o desconto autorizado e registrado em auditoria.</div><div class="field"><label>Horas a diminuir (HH:MM)</label><input id="modalTmaDiscount" value="${minutesToInput(suggested)}" placeholder="00:00"></div><div class="field"><label>Motivo do ajuste ${suggested?'*':''}</label><textarea id="modalTmaReason" rows="3" placeholder="Ex.: descanso regulamentar / ponto fechado">${esc(t.tma_adjust_reason||'')}</textarea></div>`;openModal(`Ajustar TMA • ${t.plate}`,t.trip_code,body,[{label:'Salvar ajuste',class:'primary',onClick:async()=>{const mins=parseDurationInput($('modalTmaDiscount').value);const reason=$('modalTmaReason').value.trim();if(mins==null)return toast('Informe o desconto em HH:MM.','error');if(mins>0&&!reason)return toast('Informe o motivo do ajuste.','error');try{const {error}=await sb.rpc('adjust_pull_tma',{p_trip_id:t.id,p_minutes:mins,p_reason:reason});if(error)throw error;closeModal();toast('TMA ajustado e auditado.','success');await loadPullHistory();}catch(e){toast(humanPullError(e),'error');}}}]);}
function pullSuggestedDiscountForTrip(_id){return 0;}

async function loadPullDashboard(silent=false){
  if(!hasPerm('PULL_DASHBOARD'))return;
  try{
    await loadPullReferenceData();
    const [trips,market]=await Promise.all([sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).neq('status','CANCELLED').order('started_at'),sb.from('marketplace_receipts').select('*').eq('unit',activeUnit).order('started_at')]);
    if(trips.error)throw trips.error;if(market.error)throw market.error;
    pullDashTrips=trips.data||[];marketplaceDashboardReceipts=market.data||[];populatePullDashboardFilters();await loadPullDashboardGoal();renderPullDashboard();
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
}
function populatePullDashboardFilters(){const years=[...new Set([...pullDashTrips.map(t=>new Date(t.started_at).getFullYear()),...marketplaceDashboardReceipts.map(r=>new Date(r.started_at).getFullYear())])].sort((a,b)=>b-a);const cy=new Date().getFullYear();if(!years.includes(cy))years.unshift(cy);const oldY=$('pullDashYear').value;$('pullDashYear').innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');$('pullDashYear').value=years.includes(Number(oldY))?oldY:String(years[0]||cy);$('pullDashMonth').innerHTML='<option value="">Todos</option>'+Array.from({length:12},(_,i)=>`<option value="${i+1}">${new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(new Date(2020,i,1))}</option>`).join('');const vals=(key)=>[...new Set(pullDashTrips.map(x=>String(x[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));fillPullDashSelect('pullDashCarrier',vals('carrier'),'Todas');fillPullDashSelect('pullDashFactory',vals('factory'),'Todas');const drivers=[...new Set(pullDashTrips.flatMap(x=>[x.driver1_name,x.driver2_name]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));fillPullDashSelect('pullDashDriver',drivers,'Todos');}
function fillPullDashSelect(id,values,label){const el=$(id),old=el.value;el.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('');if(values.includes(old))el.value=old;}
async function loadPullDashboardGoal(){const y=Number($('pullDashYear').value||new Date().getFullYear());const {data,error}=await sb.from('pull_goals').select('*').eq('year',y).maybeSingle();if(error)throw error;pullGoals=data||null;}
function filteredPullDashTrips(){const y=Number($('pullDashYear').value),m=Number($('pullDashMonth').value||0),carrier=$('pullDashCarrier').value,factory=$('pullDashFactory').value,driver=$('pullDashDriver').value;return pullDashTrips.filter(t=>{const d=new Date(t.started_at);return d.getFullYear()===y&&(!m||d.getMonth()+1===m)&&(!carrier||t.carrier===carrier)&&(!factory||t.factory===factory)&&(!driver||t.driver1_name===driver||t.driver2_name===driver);});}
function renderPullDashboard(){if(!hasPerm('PULL_DASHBOARD')||!$('pullDashYear'))return;loadPullDashboardGoal().then(()=>renderPullDashboardCore()).catch(e=>toast(humanPullError(e),'error'));}
function renderPullDashboardCore(){
  const rows=filteredPullDashTrips();
  renderPullDashboardOverview(rows);
  renderPullArrivalHistogram(rows);
  const planner=pullMetric==='PLANNER';
  $('pullDashKpis').classList.toggle('hidden',planner);
  $('pullPlannerWrap').classList.toggle('hidden',!planner);
  $('pullMetricBreakdowns').classList.toggle('hidden',planner);
  $('pullDashBarsCard').classList.toggle('hidden',planner);
  if(planner){renderPullPlanner(rows);return;}
  const vals=rows.map(t=>({trip:t,val:pullTripMetrics(t)[pullMetric]})).filter(x=>x.val!=null);
  const target=pullTargetForMetric(pullMetric),adhTarget=pullAdherenceTargetForMetric(pullMetric);
  const avg=vals.length?vals.reduce((s,x)=>s+x.val,0)/vals.length:null;
  const within=target?vals.filter(x=>x.val<=target).length:0;
  const adh=vals.length&&target?within/vals.length*100:null;
  $('pullKpiTrips').textContent=vals.length;$('pullKpiAvg').textContent=fmtMinutes(avg);$('pullKpiTarget').textContent=fmtMinutes(target);$('pullKpiWithin').textContent=within;$('pullKpiAdherence').textContent=adh==null?'—':`${adh.toFixed(1).replace('.',',')}%`;$('pullKpiAdhTarget').textContent=adhTarget==null?'—':`${Number(adhTarget).toFixed(1).replace('.',',')}%`;$('pullKpiFactories').textContent=new Set(vals.map(x=>x.trip.factory)).size;$('pullKpiPlates').textContent=new Set(vals.map(x=>x.trip.plate)).size;
  renderPullBars(vals,target);renderPullBreakdowns(vals,target);
}
function renderPullDashboardOverview(rows){
  if(!$('pullOverviewTrips'))return;
  const completed=rows.filter(t=>t.ended_at).length;
  const inProgress=rows.filter(t=>t.status==='IN_PROGRESS').length;
  const cycleVals=rows.map(t=>pullTripMetrics(t).CYCLE).filter(v=>v!=null);
  const arrivals=rows.filter(t=>t.arrived_factory_at);
  $('pullOverviewTrips').textContent=rows.length;
  $('pullOverviewCompleted').textContent=completed;
  $('pullOverviewProgress').textContent=inProgress;
  $('pullOverviewCycle').textContent=fmtMinutes(cycleVals.length?cycleVals.reduce((a,b)=>a+b,0)/cycleVals.length:null);
  $('pullOverviewArrivals').textContent=arrivals.length;
  $('pullOverviewPeak').textContent=arrivalPeakLabel(arrivals);
}
function localMinuteOfDay(value){if(!value)return null;try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const h=Number(parts.find(x=>x.type==='hour')?.value),m=Number(parts.find(x=>x.type==='minute')?.value);return Number.isFinite(h)&&Number.isFinite(m)?(h%24)*60+m:null;}catch{return null;}}
function minuteLabel(m){if(m==null||!Number.isFinite(m))return '—';m=((Math.round(m)%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function arrivalPeakLabel(rows){const bins=Array(24).fill(0);rows.forEach(t=>{const m=localMinuteOfDay(t.arrived_factory_at);if(m!=null)bins[Math.floor(m/60)]++;});const max=Math.max(...bins);if(!max)return '—';const h=bins.indexOf(max);return `${String(h).padStart(2,'0')}:00–${String(h).padStart(2,'0')}:59`;}
function arrivalStats(rows){const mins=rows.map(t=>localMinuteOfDay(t.arrived_factory_at)).filter(v=>v!=null).sort((a,b)=>a-b);if(!mins.length)return {n:0,median:null,first:null,last:null,peak:'—'};const mid=Math.floor(mins.length/2),median=mins.length%2?mins[mid]:(mins[mid-1]+mins[mid])/2;return {n:mins.length,median,first:mins[0],last:mins[mins.length-1],peak:arrivalPeakLabel(rows)};}
function renderPullArrivalHistogram(rows){
  const arrivals=rows.filter(t=>t.arrived_factory_at);
  const bins=Array.from({length:24},(_,hour)=>({hour,count:0}));
  arrivals.forEach(t=>{const m=localMinuteOfDay(t.arrived_factory_at);if(m!=null)bins[Math.floor(m/60)].count++;});
  const max=Math.max(1,...bins.map(x=>x.count));
  const hist=$('pullArrivalHistogram');
  if(hist)hist.innerHTML=bins.map(x=>`<div class="pull-hist-bin" title="${String(x.hour).padStart(2,'0')}:00–${String(x.hour).padStart(2,'0')}:59 • ${x.count} chegada${x.count===1?'':'s'}"><strong>${x.count||''}</strong><div><i style="height:${x.count?Math.max(7,x.count/max*100):0}%"></i></div><span>${String(x.hour).padStart(2,'0')}h</span></div>`).join('');
  const s=arrivalStats(arrivals);if($('pullArrivalCount'))$('pullArrivalCount').textContent=s.n;if($('pullArrivalMedian'))$('pullArrivalMedian').textContent=minuteLabel(s.median);if($('pullArrivalPeak'))$('pullArrivalPeak').textContent=s.peak;if($('pullArrivalRange'))$('pullArrivalRange').textContent=s.n?`${minuteLabel(s.first)}–${minuteLabel(s.last)}`:'—';
  const by=new Map();arrivals.forEach(t=>{const k=t.factory||'Sem fábrica';if(!by.has(k))by.set(k,[]);by.get(k).push(t);});
  const factoryRows=[...by].map(([factory,ts])=>({factory,...arrivalStats(ts)})).sort((a,b)=>b.n-a.n||a.factory.localeCompare(b.factory,'pt-BR'));
  if($('tbodyPullArrivalFactory'))$('tbodyPullArrivalFactory').innerHTML=factoryRows.length?factoryRows.map(r=>`<tr><td><strong>${esc(r.factory)}</strong></td><td>${r.n}</td><td>${esc(r.peak)}</td><td>${minuteLabel(r.median)}</td><td>${minuteLabel(r.first)}</td><td>${minuteLabel(r.last)}</td></tr>`).join(''):'<tr><td colspan="6">Sem chegadas à fábrica no filtro selecionado.</td></tr>';
}
function pullTargetForMetric(metric){const g=pullGoals;if(!g)return null;return Number({TMV_OUT:g.tmv_out_target_minutes,FACTORY:g.factory_target_minutes,TMV_RETURN:g.tmv_return_target_minutes,UNIT:g.unit_target_minutes,CYCLE:g.cycle_target_minutes}[metric]||0)||null;}
function pullAdherenceTargetForMetric(metric){const g=pullGoals;if(!g)return null;return Number({TMV_OUT:g.tmv_out_adherence,FACTORY:g.factory_adherence,TMV_RETURN:g.tmv_return_adherence,UNIT:g.unit_adherence,CYCLE:g.cycle_adherence}[metric]);}
function renderPullBars(vals,target){const by=new Map();vals.forEach(x=>{const d=new Date(x.trip.started_at),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;if(!by.has(k))by.set(k,[]);by.get(k).push(x.val);});const arr=[...by].map(([k,v])=>({k,avg:v.reduce((a,b)=>a+b,0)/v.length}));$('pullDashChartTitle').textContent='Evolução por mês';if(!arr.length){$('pullDashBars').className='pull-bars empty-state';$('pullDashBars').textContent='Sem dados.';return;}const max=Math.max(...arr.map(x=>x.avg),target||0,1);$('pullDashBars').className='pull-bars';$('pullDashBars').innerHTML=arr.map(x=>`<div class="pull-bar-row"><span>${fmtMonthKey(x.k)}</span><div class="pull-bar-track"><i style="width:${Math.max(2,x.avg/max*100)}%" class="${target&&x.avg<=target?'ok':'bad'}"></i></div><strong>${fmtMinutes(x.avg)}</strong></div>`).join('');}
function renderPullBreakdowns(vals,target){const group=(title,keyFn)=>{const m=new Map();vals.forEach(x=>{let keys=keyFn(x.trip);if(!Array.isArray(keys))keys=[keys];keys.filter(Boolean).forEach(k=>{if(!m.has(k))m.set(k,[]);m.get(k).push(x.val);});});const rows=[...m].map(([k,a])=>{const avg=a.reduce((s,v)=>s+v,0)/a.length,within=target?a.filter(v=>v<=target).length:0,adh=target?a.length?within/a.length*100:0:null;return {k,avg,n:a.length,adh};}).sort((a,b)=>a.avg-b.avg);return `<div class="pull-break-card"><h3>${esc(title)}</h3><div class="table-wrap"><table><thead><tr><th>${esc(title)}</th><th>Viagens</th><th>Tempo médio</th><th>Aderência</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.k)}</td><td>${r.n}</td><td>${fmtMinutes(r.avg)}</td><td>${r.adh==null?'—':`${r.adh.toFixed(1).replace('.',',')}%`}</td></tr>`).join(''):'<tr><td colspan="4">Sem dados</td></tr>'}</tbody></table></div></div>`;};$('pullDashBreakdownTables').innerHTML=group('Fábrica / destino',t=>t.factory)+group('Placa',t=>t.plate)+group('Motorista',t=>[t.driver1_name,t.driver2_name])+group('Dia',t=>fmtDate(t.started_at));}
function renderPullPlanner(rows){const by=new Map();rows.forEach(t=>{const d=new Date(t.started_at),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;if(!by.has(k))by.set(k,[]);by.get(k).push(t);});const metrics=['TMV_OUT','FACTORY','TMV_RETURN','UNIT','CYCLE'];$('tbodyPullPlanner').innerHTML=[...by].map(([k,ts])=>{let cells='';metrics.forEach(metric=>{const vals=ts.map(t=>pullTripMetrics(t)[metric]).filter(v=>v!=null),avg=vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null,target=pullTargetForMetric(metric),adh=target&&vals.length?vals.filter(v=>v<=target).length/vals.length*100:null;cells+=`<td>${fmtMinutes(avg)}</td><td>${fmtMinutes(target)}</td><td>${adh==null?'—':adh.toFixed(1).replace('.',',')+'%'}</td>`;});return `<tr><td><strong>${fmtMonthKey(k)}</strong></td>${cells}</tr>`;}).join('')||'<tr><td colspan="16">Sem dados.</td></tr>';}

async function loadPullGoals(){if(!hasPerm('PULL_GOALS'))return;const y=Number($('pullGoalYear').value||new Date().getFullYear());$('pullGoalYear').value=y;try{const {data,error}=await sb.from('pull_goals').select('*').eq('year',y).maybeSingle();if(error)throw error;const g=data||{};$('goalTmvOut').value=minutesToInput(g.tmv_out_target_minutes||0);$('goalFactory').value=minutesToInput(g.factory_target_minutes||0);$('goalTmvReturn').value=minutesToInput(g.tmv_return_target_minutes||0);$('goalUnit').value=minutesToInput(g.unit_target_minutes||0);$('goalCycle').value=minutesToInput(g.cycle_target_minutes||0);$('goalTmvOutAdh').value=g.tmv_out_adherence??85;$('goalFactoryAdh').value=g.factory_adherence??85;$('goalTmvReturnAdh').value=g.tmv_return_adherence??85;$('goalUnitAdh').value=g.unit_adherence??85;$('goalCycleAdh').value=g.cycle_adherence??85;}catch(e){toast(humanPullError(e),'error');}}
async function savePullGoals(e){e.preventDefault();const parse=id=>{const v=parseDurationInput($(id).value);if(v==null)throw new Error(`Tempo inválido em ${id}. Use HH:MM.`);return v;};try{const row={year:Number($('pullGoalYear').value),tmv_out_target_minutes:parse('goalTmvOut'),factory_target_minutes:parse('goalFactory'),tmv_return_target_minutes:parse('goalTmvReturn'),unit_target_minutes:parse('goalUnit'),cycle_target_minutes:parse('goalCycle'),tmv_out_adherence:num($('goalTmvOutAdh').value),factory_adherence:num($('goalFactoryAdh').value),tmv_return_adherence:num($('goalTmvReturnAdh').value),unit_adherence:num($('goalUnitAdh').value),cycle_adherence:num($('goalCycleAdh').value),updated_by:authUser.id,updated_at:new Date().toISOString()};const {error}=await sb.from('pull_goals').upsert(row,{onConflict:'year'});if(error)throw error;toast('Metas salvas.','success');}catch(err){toast(humanPullError(err),'error');}}

async function loadPullConfig(){if(!hasPerm('PULL_CONFIG'))return;try{await loadPullReferenceData();$('pullGpsAccuracy').value=Math.min(500,Math.max(5,Number(pullSettings?.gps_max_accuracy_m||200)));$('pullTrackInterval').value=pullSettings?.track_interval_seconds??60;$('pullTrackDistance').value=pullSettings?.track_min_distance_m??50;renderPullFactoryList();renderPullVehicleRows();renderPullSteps();updatePullStepExecutorUi();}catch(e){toast(humanPullError(e),'error');}}
async function savePullSettings(e){e.preventDefault();try{const gps=Math.min(500,Math.max(5,intVal('pullGpsAccuracy')||200));$('pullGpsAccuracy').value=gps;const row={singleton:true,gps_max_accuracy_m:gps,track_interval_seconds:intVal('pullTrackInterval'),track_min_distance_m:intVal('pullTrackDistance'),updated_by:authUser.id,updated_at:new Date().toISOString()};const {error}=await sb.from('pull_settings').upsert(row,{onConflict:'singleton'});if(error)throw error;pullSettings={...(pullSettings||{}),...row};toast(`Configuração salva. Etapas exigirão GPS de até ±${gps} m.`,'success');}catch(err){toast(humanPullError(err),'error');}}
function renderPullFactoryList(){$('pullFactoryList').innerHTML=pullFactories.map(f=>`<button type="button" class="compact-row" data-factory-edit="${esc(f.name)}"><span><strong>${esc(f.name)}</strong><small>${f.latitude==null?'Localização de auditoria não configurada':`${Number(f.latitude).toFixed(5)}, ${Number(f.longitude).toFixed(5)} • raio de auditoria ${f.radius_meters||'—'} m`}</small></span><span>Editar</span></button>`).join('')||'<div class="empty-state">Nenhuma fábrica.</div>';$('pullFactoryList').onclick=e=>{const b=e.target.closest('[data-factory-edit]');if(!b)return;$('pullFactoryName').value=b.dataset.factoryEdit;fillPullFactoryForm();};}
function fillPullFactoryForm(){const f=pullFactories.find(x=>x.name===$('pullFactoryName').value);$('pullFactoryOriginal').value=f?.name||'';$('pullFactoryLat').value=f?.latitude??'';$('pullFactoryLon').value=f?.longitude??'';$('pullFactoryRadius').value=f?.radius_meters??'';}
async function useGpsForPullFactory(){const b=$('btnPullFactoryGps');b.disabled=true;const old=b.textContent;b.textContent='Atualizando configuração…';try{const target=await refreshPullGpsTarget();b.textContent='Capturando…';const g=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>b.textContent=`GPS ±${Math.round(s.accuracy)} m / limite ${target} m…`});$('pullFactoryLat').value=g.latitude.toFixed(7);$('pullFactoryLon').value=g.longitude.toFixed(7);toast(`Localização capturada com precisão ±${Math.round(g.accuracy||0)} m.`,'success');}catch(e){toast(humanGpsOrPullError(e),'error');}finally{b.disabled=false;b.textContent=old;}}
async function savePullFactory(e){e.preventDefault();const name=$('pullFactoryName').value;if(!name)return toast('Selecione a fábrica.','error');try{const {error}=await sb.from('factories').update({latitude:num($('pullFactoryLat').value),longitude:num($('pullFactoryLon').value),radius_meters:intVal('pullFactoryRadius')}).eq('name',name);if(error)throw error;toast('Localização e raio de auditoria da fábrica salvos.','success');await loadPullReferenceData();fillPullFactoryForm();renderPullFactoryList();}catch(err){toast(humanPullError(err),'error');}}
function clearPullVehicleForm(){$('pullVehicleId').value='';$('pullVehiclePlate').value='';$('pullVehicleCarrier').value='';$('pullVehicleActive').checked=true;}
function renderPullVehicleRows(){$('pullVehicleRows').innerHTML=pullVehicles.map(v=>`<button type="button" class="compact-row" data-vehicle-edit="${v.id}"><span><strong>${esc(v.plate)}</strong><small>${esc(v.carrier||'Sem transportadora')} • ${v.active?'ativo':'inativo'}</small></span><span>Editar</span></button>`).join('')||'<div class="empty-state">Nenhum veículo cadastrado.</div>';}
function onPullVehicleRowsClick(e){const b=e.target.closest('[data-vehicle-edit]');if(!b)return;const v=pullVehicles.find(x=>x.id===b.dataset.vehicleEdit);if(!v)return;$('pullVehicleId').value=v.id;$('pullVehiclePlate').value=v.plate;$('pullVehicleCarrier').value=v.carrier||'';$('pullVehicleActive').checked=v.active;}
async function savePullVehicle(e){e.preventDefault();const id=$('pullVehicleId').value,row={plate:String($('pullVehiclePlate').value||'').toUpperCase().replace(/[^A-Z0-9]/g,''),carrier:$('pullVehicleCarrier').value.trim(),active:$('pullVehicleActive').checked,updated_at:new Date().toISOString()};if(!row.plate)return toast('Informe a placa.','error');if(!row.carrier)return toast('Informe o parceiro / transportadora do veículo.','error');try{const r=id?await sb.from('pull_vehicles').update(row).eq('id',id):await sb.from('pull_vehicles').insert(row);if(r.error)throw r.error;toast('Veículo salvo.','success');clearPullVehicleForm();await loadPullReferenceData();renderPullVehicleRows();}catch(err){toast(humanPullError(err),'error');}}
function clearPullStepForm(){$('pullStepId').value='';$('pullStepName').value='';$('pullStepType').value='MAIN';$('pullStepCode').disabled=false;$('pullStepCode').value='';$('pullStepOrder').value=100;$('pullStepDuration').value='POINT';$('pullStepExecutor').value='1';$('pullStepGeofence').checked=false;$('pullStepDiscount').checked=false;$('pullStepActive').checked=true;updatePullStepExecutorUi();}
function renderPullSteps(){const all=[...pullMainSteps,...pullOccurrenceTypes].sort((a,b)=>a.step_type.localeCompare(b.step_type)||a.sort_order-b.sort_order);$('tbodyPullSteps').innerHTML=all.map(s=>`<tr><td>${s.sort_order}</td><td><strong>${esc(s.name)}</strong></td><td>${s.step_type==='MAIN'?'Principal':'Ocorrência'}</td><td>${s.step_type==='MAIN'?`<span class="status partial">Motorista ${Number(s.executor_driver)===2?'2':'1'}</span>`:'Motorista ativo'}</td><td><code>${esc(s.action_code)}</code></td><td>${s.requires_factory_geofence?'Auditoria de raio ':''}${s.duration_mode==='INTERVAL'?'Intervalo ':''}${s.suggest_tma_discount?'Sugere desconto':''}</td><td>${s.active?'<span class="status ok">Ativa</span>':'<span class="status bad">Inativa</span>'}</td><td><button class="mini-btn" data-step-edit="${s.id}">Editar</button></td></tr>`).join('');}
function onPullStepsClick(e){const b=e.target.closest('[data-step-edit]');if(!b)return;const s=[...pullMainSteps,...pullOccurrenceTypes].find(x=>x.id===b.dataset.stepEdit);if(!s)return;$('pullStepId').value=s.id;$('pullStepName').value=s.name;$('pullStepType').value=s.step_type;$('pullStepCode').value=s.action_code;$('pullStepCode').disabled=['START_TRIP','ARRIVE_FACTORY','LEAVE_FACTORY','DRIVER_SWAP_OUT','DRIVER_SWAP_RETURN','ARRIVE_UNIT'].includes(s.action_code);$('pullStepOrder').value=s.sort_order;$('pullStepDuration').value=s.duration_mode;$('pullStepExecutor').value=String(Number(s.executor_driver)===2?2:1);$('pullStepGeofence').checked=s.requires_factory_geofence;$('pullStepDiscount').checked=s.suggest_tma_discount;$('pullStepActive').checked=s.active;updatePullStepExecutorUi();}
async function savePullStep(e){e.preventDefault();const id=$('pullStepId').value;const type=$('pullStepType').value;const action=$('pullStepCode').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_');const executor=action==='START_TRIP'?1:Number($('pullStepExecutor').value||1);const row={name:$('pullStepName').value.trim(),step_type:type,action_code:action,sort_order:Number($('pullStepOrder').value),duration_mode:$('pullStepDuration').value,executor_driver:type==='MAIN'?executor:null,requires_factory_geofence:$('pullStepGeofence').checked,suggest_tma_discount:$('pullStepDiscount').checked,active:$('pullStepActive').checked,required:type==='MAIN'};if(!row.name||!row.action_code)return toast('Informe nome e código da etapa.','error');if(type==='MAIN'&&![1,2].includes(row.executor_driver))return toast('Selecione Motorista 1 ou Motorista 2 como responsável.','error');try{const r=id?await sb.from('pull_steps').update(row).eq('id',id):await sb.from('pull_steps').insert(row);if(r.error)throw r.error;toast('Etapa/ocorrência salva.','success');clearPullStepForm();await loadPullReferenceData();renderPullSteps();}catch(err){toast(humanPullError(err),'error');}}

function updatePullStepExecutorUi(){const type=$('pullStepType')?.value;const code=String($('pullStepCode')?.value||'').trim().toUpperCase();const sel=$('pullStepExecutor');const note=$('pullStepExecutorNote');if(!sel)return;if(type!=='MAIN'){sel.disabled=true;if(note)note.textContent='Ocorrências continuam vinculadas ao motorista ativo.';return;}sel.disabled=code==='START_TRIP';if(code==='START_TRIP')sel.value='1';if(note)note.textContent=code==='START_TRIP'?'A saída inicial é sempre registrada pelo Motorista 1.':'Escolha qual dos dois motoristas deverá apontar esta etapa.';}
function pullMainStepNumber(stepOrEvent){
  if(!stepOrEvent)return null;
  const id=stepOrEvent.step_id||stepOrEvent.id||'';
  const code=stepOrEvent.action_code||'';
  const order=Number(stepOrEvent.step_order??stepOrEvent.sort_order);
  let idx=pullMainSteps.findIndex(s=>(id&&s.id===id)||(code&&s.action_code===code));
  if(idx<0&&Number.isFinite(order))idx=pullMainSteps.findIndex(s=>Number(s.sort_order)===order);
  return idx>=0?idx+1:null;
}
function pullNumberedStepName(stepOrEvent){const n=pullMainStepNumber(stepOrEvent);const name=stepOrEvent?.step_name||stepOrEvent?.name||'Etapa';return n?`${n}. ${name}`:name;}

function pullTripMetrics(t){const adj=Math.max(0,Number(t.tma_adjust_minutes||0));const unitRaw=t.ended_at&&t.next_started_at?Math.max(0,minutesBetween(t.ended_at,t.next_started_at)):null;return {TMV_OUT:t.started_at&&t.arrived_factory_at?minutesBetween(t.started_at,t.arrived_factory_at):null,FACTORY:t.arrived_factory_at&&t.left_factory_at?minutesBetween(t.arrived_factory_at,t.left_factory_at):null,TMV_RETURN:t.left_factory_at&&t.ended_at?minutesBetween(t.left_factory_at,t.ended_at):null,UNIT_RAW:unitRaw,UNIT:unitRaw==null?null:Math.max(0,unitRaw-adj),CYCLE:t.started_at&&t.next_started_at?Math.max(0,minutesBetween(t.started_at,t.next_started_at)-adj):null};}
function minutesBetween(a,b){if(!a||!b)return null;const n=(new Date(b)-new Date(a))/60000;return Number.isFinite(n)?Math.max(0,n):null;}
function fmtMinutes(v){if(v==null||!Number.isFinite(Number(v)))return '—';const m=Math.max(0,Math.round(Number(v))),h=Math.floor(m/60),mm=m%60;return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;}
function fmtDurationMinutes(v){return fmtMinutes(v);}
function fmtDurationSeconds(sec){const s=Math.max(0,Math.floor(sec||0)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;}
function minutesToInput(v){return fmtMinutes(Number(v)||0);}
function parseDurationInput(v){const s=String(v||'').trim();if(!s)return 0;const m=s.match(/^(\d{1,4}):([0-5]\d)$/);if(!m)return null;return Number(m[1])*60+Number(m[2]);}
function distanceMeters(a,b,c,d){const R=6371000,p=x=>x*Math.PI/180,dp=p(c-a),dl=p(d-b),q=Math.sin(dp/2)**2+Math.cos(p(a))*Math.cos(p(c))*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function fmtMonthKey(k){const [y,m]=String(k).split('-');return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1)).replace('.','');}
function humanPullError(e){const m=String(e?.message||e||'Erro na Puxada');const map={ETAPA_MOTORISTA_1:'Esta etapa deve ser registrada pelo Motorista 1.',ETAPA_MOTORISTA_2:'Esta etapa deve ser registrada pelo Motorista 2.',GPS_PRECISAO_INSUFICIENTE:'O GPS ainda não atingiu a precisão máxima permitida. Aguarde alguns segundos em local aberto e tente novamente.',MOTORISTA_2_INVALIDO:'Motorista 2 inválido ou inativo.',MOTORISTA_2_DEVE_SER_OUTRO_USUARIO:'O Motorista 2 precisa ser outro usuário.',MOTORISTA_COM_CICLO_EM_ANDAMENTO:'Um dos motoristas já possui uma Puxada em andamento.',PLACA_COM_CICLO_EM_ANDAMENTO:'Esta placa já possui uma Puxada em andamento.',MOTORISTA_NAO_ESTA_ATIVO:'A etapa deve ser apontada pelo motorista que está conduzindo neste trecho.',FABRICA_INVALIDA:'Fábrica inválida.',ORIGEM_INVALIDA:'Selecione uma origem ativa para a viagem.',PARCEIRO_OBRIGATORIO:'Selecione o parceiro / transportadora da viagem.',UNIDADE_PADRAO_PUXADA_NAO_CONFIGURADA:'Versão antiga do banco: aplique a atualização SQL da Puxada.',ETAPA_INICIO_NAO_CONFIGURADA:'A etapa inicial da Puxada não está configurada.',CICLO_NAO_ENCONTRADO:'Ciclo não encontrado.',CICLO_NAO_ESTA_EM_ANDAMENTO:'Este ciclo não está mais em andamento.',ETAPA_FORA_DE_SEQUENCIA:'Essa não é a próxima etapa esperada.',SEM_PROXIMA_ETAPA:'Não há próxima etapa.',GPS_BAIXA_PRECISAO:'Versão antiga do banco ainda está bloqueando precisão baixa. Aplique a atualização SQL.',FORA_RAIO_FABRICA:'Versão antiga do banco ainda está bloqueando o raio da fábrica. Aplique a atualização SQL.',OCORRENCIA_EM_ANDAMENTO:'Existe uma ocorrência em andamento. Finalize a ocorrência antes de registrar a próxima etapa obrigatória.',JA_EXISTE_OCORRENCIA_ABERTA:'Já existe uma ocorrência com duração em andamento.',OCORRENCIA_NAO_ESTA_ABERTA:'A ocorrência já foi encerrada.',MOTIVO_AJUSTE_OBRIGATORIO:'Informe o motivo do ajuste de TMA.',AJUSTE_MAIOR_QUE_TMA_BRUTO:'As horas a diminuir não podem ser maiores que o TMA bruto.',PUXADA_NAO_DISPONIVEL_PARA_NRI:'Esta carreta não está mais disponível para cadastro de NRI.'};const key=Object.keys(map).find(k=>m.includes(k));return key?map[key]:humanError(e);}
function humanGpsOrPullError(e){const m=String(e?.message||e||'');return /PERMISSAO_LOCALIZACAO|permission|GPS|location|geolocation|PositionError/i.test(m)?humanGpsError(e):humanPullError(e);}


// V1.2.1 - Marketplace, avaria no NRI, Transferencia, histogramas e evidencias -----------------
function activeMarketplaceSuppliers(){return marketplaceSuppliers.filter(x=>x.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));}
function populateMarketplaceInputs(){
  if($('marketUnit'))fillSelect('marketUnit',(refs.units||[]).map(x=>x.name),'Selecione');
  if($('marketChecker'))$('marketChecker').value=profile?.name||'';
  const sel=$('marketSupplier');if(sel){const old=sel.value;sel.innerHTML='<option value="">Selecione</option>'+activeMarketplaceSuppliers().map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');if(activeMarketplaceSuppliers().some(x=>x.id===old))sel.value=old;}
}
async function loadMarketplaceSuppliers(){
  if(!canNri())return;
  let q=sb.from('marketplace_suppliers').select('*').order('name');
  if(!hasPerm('PULL_CONFIG'))q=q.eq('active',true);
  const {data,error}=await q;if(error)throw error;marketplaceSuppliers=data||[];populateMarketplaceInputs();renderMarketplaceSuppliers();
}
async function loadMarketplaceModule(silent=false){
  if(!hasPerm('MARKETPLACE_RECEIVE'))return;
  try{
    await loadMarketplaceSuppliers();
    const {data,error}=await sb.from('marketplace_receipts').select('*').eq('unit',activeUnit).eq('checker_id',authUser.id).eq('status','IN_PROGRESS').order('started_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;marketplaceActiveReceipt=data||null;renderMarketplaceReceipt();
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
}
function renderMarketplaceReceipt(){
  const active=!!marketplaceActiveReceipt;
  $('marketStartCard')?.classList.toggle('hidden',active);$('marketActiveCard')?.classList.toggle('hidden',!active);
  stopMarketplaceClock();if(!active)return;
  $('marketActiveCode').textContent=marketplaceActiveReceipt.receipt_code||'Marketplace';
  $('marketActiveSummary').textContent=`${marketplaceActiveReceipt.unit} • ${marketplaceActiveReceipt.supplier_name} • ${marketplaceActiveReceipt.checker_name} • início ${fmtDateTime(marketplaceActiveReceipt.started_at)}`;
  const tick=()=>{if(!$('marketActiveElapsed')||!marketplaceActiveReceipt)return;const sec=Math.max(0,Math.floor((Date.now()-new Date(marketplaceActiveReceipt.started_at))/1000));$('marketActiveElapsed').textContent=fmtDurationSeconds(sec);};tick();marketplaceClockTimer=setInterval(tick,1000);
}
function stopMarketplaceClock(){if(marketplaceClockTimer){clearInterval(marketplaceClockTimer);marketplaceClockTimer=null;}}
async function startMarketplaceReceipt(e){
  e.preventDefault();const unit=$('marketUnit').value,supplier=$('marketSupplier').value;if(!unit||!supplier)return toast('Selecione unidade e fornecedor.','error');
  const b=$('btnMarketStart');b.disabled=true;b.textContent='Iniciando…';try{const {data,error}=await sb.rpc('start_marketplace_receipt',{p_unit:unit,p_supplier_id:supplier});if(error)throw error;marketplaceActiveReceipt=data;toast('Recebimento Marketplace iniciado. O cronômetro está em andamento.','success');renderMarketplaceReceipt();}catch(err){toast(humanPullError(err),'error');}finally{b.disabled=false;b.textContent='Iniciar recebimento';}
}
async function finishMarketplaceReceipt(){
  if(!marketplaceActiveReceipt)return;const b=$('btnMarketFinish');b.disabled=true;b.textContent='Finalizando…';try{const {data,error}=await sb.rpc('finish_marketplace_receipt',{p_receipt_id:marketplaceActiveReceipt.id});if(error)throw error;const sec=data?.duration_seconds??Math.floor((Date.now()-new Date(marketplaceActiveReceipt.started_at))/1000);toast(`Recebimento finalizado em ${fmtDurationSeconds(sec)}. Disponível em Recebimentos pendentes para cadastrar NRIs.`,'success');marketplaceActiveReceipt=null;renderMarketplaceReceipt();await loadPullNriPending(true);}catch(err){toast(humanPullError(err),'error');}finally{b.disabled=false;b.textContent='Finalizar recebimento';}
}
function clearMarketplaceSupplierForm(){if(!$('marketSupplierId'))return;$('marketSupplierId').value='';$('marketSupplierName').value='';$('marketSupplierActive').checked=true;}
function renderMarketplaceSuppliers(){const el=$('marketSupplierRows');if(!el)return;el.innerHTML=marketplaceSuppliers.length?marketplaceSuppliers.map(x=>`<button type="button" class="compact-row" data-market-supplier="${x.id}"><span><strong>${esc(x.name)}</strong><small>${x.active?'Ativo':'Inativo'}</small></span><span>Editar</span></button>`).join(''):'<div class="empty-state">Nenhum fornecedor cadastrado.</div>';}
function onMarketplaceSupplierRowsClick(e){const b=e.target.closest('[data-market-supplier]');if(!b)return;const x=marketplaceSuppliers.find(v=>v.id===b.dataset.marketSupplier);if(!x)return;$('marketSupplierId').value=x.id;$('marketSupplierName').value=x.name;$('marketSupplierActive').checked=x.active;}
async function saveMarketplaceSupplier(e){e.preventDefault();if(!hasPerm('PULL_CONFIG'))return;const id=$('marketSupplierId').value;const row={name:$('marketSupplierName').value.trim(),active:$('marketSupplierActive').checked,updated_at:new Date().toISOString()};if(!row.name)return toast('Informe o fornecedor.','error');try{const r=id?await sb.from('marketplace_suppliers').update(row).eq('id',id):await sb.from('marketplace_suppliers').insert(row);if(r.error)throw r.error;toast('Fornecedor Marketplace salvo.','success');clearMarketplaceSupplierForm();await loadMarketplaceSuppliers();}catch(err){toast(humanPullError(err),'error');}}

function onNriDamageChoice(e){const b=e.target.closest('[data-nri-damage]');if(!b)return;setNriDamageMode(b.dataset.nriDamage==='YES');}
function setNriDamageMode(on){nriDamageMode=!!on;$('nriDamageDetails')?.classList.toggle('hidden',!nriDamageMode);document.querySelectorAll('[data-nri-damage]').forEach(b=>b.classList.toggle('active',(b.dataset.nriDamage==='YES')===nriDamageMode));renderNriDamagePhotos();}
async function onNriDamagePhoto(e){
  const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;const remaining=5-nriDamagePhotos.length;if(remaining<=0)return toast('O limite é de 5 fotos por produto avariado.','error');
  for(const file of files.slice(0,remaining)){try{const blob=await compressImage(file,1280,.76);nriDamagePhotos.push({id:uuid(),blob,previewUrl:URL.createObjectURL(blob)});}catch(err){toast(humanError(err),'error');}}
  if(files.length>remaining)toast(`Foram adicionadas apenas ${remaining} foto(s). O limite é 5.`,'');renderNriDamagePhotos();
}
function renderNriDamagePhotos(){const el=$('nriDamagePhotoGallery');if(!el)return;el.innerHTML=nriDamagePhotos.map((x,i)=>`<div class="photo-thumb"><img src="${x.previewUrl}" alt="Foto ${i+1}"><button type="button" data-nri-damage-photo="${x.id}" title="Remover">×</button><small>${i+1}/5</small></div>`).join('');const st=$('nriDamagePhotoStatus');if(st)st.textContent=nriDamageMode?(nriDamagePhotos.length?`${nriDamagePhotos.length} foto(s) adicionada(s).`:'Nenhuma foto adicionada. Pelo menos 1 foto é obrigatória.'):'Palete sem avaria.';}
function onNriDamagePhotoGalleryClick(e){const b=e.target.closest('[data-nri-damage-photo]');if(!b)return;nriDamagePhotos=nriDamagePhotos.filter(x=>x.id!==b.dataset.nriDamagePhoto);renderNriDamagePhotos();}
function resetNriDamageEditor(){nriDamageMode=false;nriDamagePhotos=[];if($('nriDamagePallets'))$('nriDamagePallets').value=1;if($('nriDamageReason'))$('nriDamageReason').value='';if($('nriDamageInvoice'))$('nriDamageInvoice').value='';setNriDamageMode(false);}

updateNriTypeFields = function(){
  const marketplace=$('nriTipo').value==='MARKETPLACE';
  if(nriPullLocked||nriMarketplaceLocked)return;
  setSelectFixedValue($('nriMotorista'),'--',marketplace);
  const f=$('nriFabrica');
  if(marketplace){
    [...f.options].filter(o=>o.dataset.fixed==='__fixed_value__').forEach(o=>o.remove());const old=f.value;f.disabled=false;f.required=true;f.innerHTML='<option value="">Selecione o fornecedor</option>'+activeMarketplaceSuppliers().map(x=>`<option>${esc(x.name)}</option>`).join('');if(activeMarketplaceSuppliers().some(x=>x.name===old))f.value=old;
  }else{fillSelect('nriFabrica',refs.factories.map(x=>x.name),'Selecione');f.disabled=false;f.required=true;}
  const plate=$('nriPlaca');
  if(marketplace)setSelectFixedValue(plate,'--',true);
  else{setSelectFixedValue(plate,'--',false);populatePlateSelectors();ensureNriPlateOptions();}
};

addNriDraftItem = function(){
  const code=normalizeCode($('nriCodigo').value),p=productsByCode.get(code),sem=$('nriSemValidade').checked,validity=sem?null:parseShortDate($('nriValidade').value),lot=sanitizeLot($('nriLote').value),qty=num($('nriQuantidade').value),pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Informe um código de produto válido.','error');if(!sem&&!validity)return toast('Informe a validade completa no formato dd/mm/aa ou selecione Sem Validade.','error');if(!lot)return toast('Informe o lote.','error');if(qty<=0)return toast('Informe a quantidade.','error');if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  const damagedPallets=nriDamageMode?Math.trunc(num($('nriDamagePallets').value)):0,reason=nriDamageMode?$('nriDamageReason').value.trim():'',invoiceNumber=nriDamageMode?$('nriDamageInvoice').value.trim():'';
  if(nriDamageMode&&(!damagedPallets||damagedPallets<1||damagedPallets>pallets))return toast(`Informe entre 1 e ${pallets} palete(s) avariado(s).`,'error');if(nriDamageMode&&!reason)return toast('Selecione o motivo do avariado.','error');if(nriDamageMode&&!invoiceNumber)return toast('Informe o Número da Nota Fiscal do palete avariado.','error');if(nriDamageMode&&(nriDamagePhotos.length<1||nriDamagePhotos.length>5))return toast('Palete avariado exige de 1 a 5 fotos.','error');
  const item={id:nriEditingId||uuid(),product_code:p.code,product_name:p.name,validity_date:validity,lot,quantity:qty,pallets,block_date:validity?addDaysIso(validity,-30):null,pallet_damaged:nriDamageMode,damaged_pallets:damagedPallets,damage_reason:reason,invoice_number:invoiceNumber,damagePhotos:[...nriDamagePhotos]};
  const idx=nriDraftItems.findIndex(x=>x.id===item.id);if(idx>=0)nriDraftItems[idx]=item;else nriDraftItems.push(item);renderNriDraftItems();clearNriItemEditor();
};
renderNriDraftItems = function(){
  const total=nriDraftItems.reduce((s,x)=>s+x.pallets,0);$('nriItemCounter').textContent=`${nriDraftItems.length} item(ns) • ${total} NRI(s)`;$('btnCadastrarCarreta').textContent=total?`Cadastrar carreta (${total} NRIs)`:'Cadastrar carreta';const el=$('nriItemList');if(!nriDraftItems.length){el.className='item-list empty-state';el.textContent='Nenhum produto adicionado.';return;}el.className='item-list';el.innerHTML=nriDraftItems.map(x=>`<div class="item-row" data-id="${x.id}"><div class="info"><small>Produto</small><strong>${esc(x.product_code)} • ${esc(x.product_name)}</strong></div><div class="info"><small>Validade</small><strong>${x.validity_date?formatShortDate(x.validity_date):'Sem Validade'}</strong></div><div class="info"><small>Lote(s)</small><strong>${esc(x.lot)}</strong></div><div class="info"><small>Quantidade</small><strong>${fmtNum(x.quantity)}</strong></div><div class="info"><small>Paletes / NRIs</small><strong>${x.pallets}</strong></div><div class="info"><small>Palete avariado</small><strong>${x.pallet_damaged?`Sim • ${x.damaged_pallets} • NF ${esc(x.invoice_number||'—')} • ${esc(x.damage_reason)} • ${(x.damagePhotos||[]).length} foto(s)`:'Não'}</strong></div><div class="mini-actions"><button class="mini-btn" data-act="edit">Editar</button><button class="mini-btn danger" data-act="del">Excluir</button></div></div>`).join('');
};
onNriDraftListClick = function(e){const b=e.target.closest('button[data-act]');if(!b)return;const row=b.closest('[data-id]'),item=nriDraftItems.find(x=>x.id===row.dataset.id);if(!item)return;if(b.dataset.act==='del'){nriDraftItems=nriDraftItems.filter(x=>x.id!==item.id);renderNriDraftItems();if(nriEditingId===item.id)clearNriItemEditor();return;}nriEditingId=item.id;$('nriCodigo').value=item.product_code;$('nriSemValidade').checked=!item.validity_date;$('nriValidade').value=formatShortDate(item.validity_date);$('nriLote').value=sanitizeLot(item.lot);$('nriQuantidade').value=item.quantity;$('nriPaletes').value=item.pallets;$('nriBloqueio').value=item.block_date?formatShortDate(item.block_date):'--';nriDamagePhotos=[...(item.damagePhotos||[])];$('nriDamagePallets').value=item.damaged_pallets||1;$('nriDamageReason').value=item.damage_reason||'';$('nriDamageInvoice').value=item.invoice_number||'';setNriDamageMode(!!item.pallet_damaged);updateNriValidityMode();onProductCode();$('btnAdicionarNriItem').textContent='Salvar alteração';$('btnCancelarNriItem').classList.remove('hidden');};
clearNriItemEditor = function(){nriEditingId=null;['nriCodigo','nriValidade','nriLote','nriBloqueio'].forEach(id=>$(id).value='');$('nriSemValidade').checked=false;updateNriValidityMode();$('nriQuantidade').value=1;$('nriPaletes').value=1;$('produtoPlaceholder').classList.remove('hidden');$('produtoImagem').classList.add('hidden');$('produtoInfo').classList.add('hidden');$('btnAdicionarNriItem').textContent='+ Adicionar à carreta';$('btnCancelarNriItem').classList.add('hidden');resetNriDamageEditor();};
function clearNriSourceContext(){
  nriPullLocked=false;nriMarketplaceLocked=false;if($('nriPullTripId'))$('nriPullTripId').value='';if($('nriMarketplaceReceiptId'))$('nriMarketplaceReceiptId').value='';$('nriPullBanner')?.classList.add('hidden');if($('nriPullBanner'))$('nriPullBanner').innerHTML='';
  [$('nriUnidade'),$('nriMotorista'),$('nriFabrica')].forEach(sel=>{if(!sel)return;[...sel.options].filter(o=>o.dataset.fixed==='__fixed_value__').forEach(o=>o.remove());sel.disabled=false;sel.required=true;});$('nriTipo').disabled=false;$('nriTipo').required=true;$('nriRecebimento').disabled=false;$('nriHora').disabled=false;setSelectFixedValue($('nriPlaca'),'--',false);populateReferenceInputs();populatePlateSelectors();
}
clearNriPullContext = function(){clearNriSourceContext();};
clearNriRequest = function(){nriDraftItems=[];renderNriDraftItems();clearNriItemEditor();clearNriSourceContext();['nriUnidade','nriMotorista','nriFabrica','nriPlaca'].forEach(id=>$(id).value='');$('nriTipo').value='AMBEV';updateNriTypeFields();$('nriRecebimento').value=localIsoDate(new Date());$('nriHora').value=localTime(new Date());$('nriConferente').value=profile?.name||'';};
async function uploadNriDamageBlob(path,blob){const {error}=await sb.storage.from('nri-avarias').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
submitNriRequest = async function(e){
  e.preventDefault();if(!nriDraftItems.length)return toast('Adicione ao menos um produto à carreta.','error');const requestType=$('nriTipo').value==='MARKETPLACE'?'MARKETPLACE':'AMBEV';const common={unit:$('nriUnidade').value,request_type:requestType,receipt_date:$('nriRecebimento').value,receipt_time:$('nriHora').value,driver:requestType==='MARKETPLACE'?'--':$('nriMotorista').value,plate:requestType==='MARKETPLACE'?'--':$('nriPlaca').value.trim(),factory:$('nriFabrica').value,pull_trip_id:$('nriPullTripId')?.value||null,marketplace_receipt_id:$('nriMarketplaceReceiptId')?.value||null};
  if([common.unit,common.request_type,common.receipt_date,common.receipt_time].some(v=>!String(v).trim()))return toast('Preencha unidade, tipo, data e hora.','error');if(requestType==='AMBEV'&&[common.driver,common.plate,common.factory].some(v=>!String(v).trim()))return toast('Preencha motorista, placa e fábrica para recebimento Ambev.','error');if(requestType==='MARKETPLACE'&&!common.factory)return toast('Selecione o fornecedor do Marketplace.','error');
  const btn=$('btnCadastrarCarreta');btn.disabled=true;btn.textContent='Enviando fotos…';const uploaded=[];
  try{
    const key=`${Date.now()}-${uuid()}`,items=[];
    for(const item of nriDraftItems){const out={...item};delete out.damagePhotos;out.damage_photos=[];if(item.pallet_damaged){for(let i=0;i<(item.damagePhotos||[]).length;i++){const ph=item.damagePhotos[i],path=`${authUser.id}/${key}/${item.product_code}-${item.id}-${i+1}.jpg`;await uploadNriDamageBlob(path,ph.blob);uploaded.push(path);out.damage_photos.push({photo_path:path});}}items.push(out);}
    btn.textContent='Cadastrando…';const {data,error}=await sb.rpc('create_nri_request',{p_payload:{...common,items}});if(error)throw error;const count=data?.nris?.length||nriDraftItems.reduce((s,x)=>s+x.pallets,0);toast(`${count} NRIs cadastradas e enviadas para Impressões pendentes.`,'success');clearNriRequest();await loadPending(true);await loadPullNriPending(true);
  }catch(err){if(uploaded.length)sb.storage.from('nri-avarias').remove(uploaded).catch(()=>{});toast(humanPullError(err),'error');}finally{btn.disabled=false;renderNriDraftItems();}
};

loadPullNriPending = async function(silent=false){
  if(!hasPerm('NRI_PENDING_VIEW'))return;
  try{
    const [pr,mr]=await Promise.all([
      sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).eq('cycle_type','PULL').eq('status','ARRIVED').eq('nri_status','PENDING').order('ended_at',{ascending:false}).limit(200),
      sb.from('marketplace_receipts').select('*').eq('unit',activeUnit).eq('status','PENDING_NRI').eq('nri_status','PENDING').order('ended_at',{ascending:false}).limit(200)
    ]);
    if(pr.error)throw pr.error;if(mr.error)throw mr.error;
    const rows=[
      ...(pr.data||[]).map(x=>({...x,_source:'PULL',_sort:x.ended_at})),
      ...(mr.data||[]).map(x=>({...x,_source:'MARKETPLACE',_sort:x.ended_at}))
    ].sort((a,b)=>new Date(b._sort)-new Date(a._sort));
    $('badgePullNri').textContent=rows.length;
    const el=$('pullNriCards');
    if(!rows.length){el.className='pull-card-grid empty-state';el.textContent='Nenhum recebimento pendente.';return;}
    const canCreate=hasPerm('NRI_CREATE');
    const action=(attr,id)=>canCreate?`<button class="btn primary wide" ${attr}="${id}">Cadastrar NRIs</button>`:`<div class="notice compact">Somente consulta • sem permissão para cadastrar NRI.</div>`;
    el.className='pull-card-grid';
    el.innerHTML=rows.map(x=>x._source==='PULL'
      ?`<article class="pull-card"><div class="pull-card-head"><div><small>PUXADA • ${esc(x.trip_code)}</small><strong>${esc(x.plate)}</strong></div><span class="status pending">Aguardando NRI</span></div><div class="pull-card-body"><span><b>Fábrica:</b> ${esc(x.factory)}</span><span><b>Motorista:</b> ${esc(x.ended_by_name||'—')}</span><span><b>Recebida:</b> ${fmtDateTime(x.ended_at)}</span><span><b>Unidade:</b> ${esc(x.origin_unit)}</span></div>${action('data-pull-nri',x.id)}</article>`
      :`<article class="pull-card marketplace"><div class="pull-card-head"><div><small>MARKETPLACE • ${esc(x.receipt_code)}</small><strong>${esc(x.supplier_name)}</strong></div><span class="status pending">Aguardando NRI</span></div><div class="pull-card-body"><span><b>Fornecedor:</b> ${esc(x.supplier_name)}</span><span><b>Conferente:</b> ${esc(x.checker_name)}</span><span><b>Finalizado:</b> ${fmtDateTime(x.ended_at)}</span><span><b>Unidade:</b> ${esc(x.unit)}</span><span><b>Tempo:</b> ${fmtDurationSeconds(x.duration_seconds||0)}</span></div>${action('data-market-nri',x.id)}</article>`
    ).join('');
    el._pendingRows=rows;
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
};
onPullNriCardsClick = function(e){
  const p=e.target.closest('[data-pull-nri]'),m=e.target.closest('[data-market-nri]');
  if(!p&&!m)return;
  if(!hasPerm('NRI_CREATE'))return toast('Seu usuário possui apenas consulta dos recebimentos pendentes.','error');
  const rows=$('pullNriCards')._pendingRows||[];
  if(p){const t=rows.find(x=>x._source==='PULL'&&x.id===p.dataset.pullNri);if(t)prefillNriFromPull(t);}
  else{const r=rows.find(x=>x._source==='MARKETPLACE'&&x.id===m.dataset.marketNri);if(r)prefillNriFromMarketplace(r);}
};
prefillNriFromPull = function(t){clearNriRequest();nriPullLocked=true;$('nriPullTripId').value=t.id;const end=new Date(t.ended_at),unitSel=$('nriUnidade');if(unitSel){[...unitSel.options].filter(o=>o.dataset.fixed==='__fixed_value__').forEach(o=>o.remove());if(![...unitSel.options].some(o=>o.value===t.origin_unit)){const o=document.createElement('option');o.value=t.origin_unit;o.textContent=t.origin_unit;unitSel.appendChild(o);}unitSel.value=t.origin_unit;unitSel.disabled=false;unitSel.required=true;}$('nriTipo').value='AMBEV';$('nriTipo').disabled=true;$('nriTipo').required=false;$('nriRecebimento').value=localIsoDate(end);$('nriRecebimento').disabled=true;$('nriHora').value=localTime(end);$('nriHora').disabled=true;setSelectFixedValue($('nriMotorista'),t.ended_by_name||t.active_driver_name||'—',true);setSelectFixedValue($('nriPlaca'),t.plate,true);setSelectFixedValue($('nriFabrica'),t.factory,true);$('nriPullBanner').classList.remove('hidden');$('nriPullBanner').innerHTML=`<strong>${esc(t.trip_code)} • ${esc(t.plate)}</strong><span>Dados preenchidos automaticamente pela Puxada. A unidade pode ser ajustada antes do cadastro dos NRIs.</span>`;openView('nri-cadastro',true);};
function prefillNriFromMarketplace(r){clearNriRequest();nriMarketplaceLocked=true;$('nriMarketplaceReceiptId').value=r.id;const end=new Date(r.ended_at);setSelectFixedValue($('nriUnidade'),r.unit,true);$('nriTipo').value='MARKETPLACE';$('nriTipo').disabled=true;$('nriTipo').required=false;$('nriRecebimento').value=localIsoDate(end);$('nriRecebimento').disabled=true;$('nriHora').value=localTime(end);$('nriHora').disabled=true;setSelectFixedValue($('nriMotorista'),'--',true);setSelectFixedValue($('nriPlaca'),'--',true);setSelectFixedValue($('nriFabrica'),r.supplier_name,true);$('nriPullBanner').classList.remove('hidden');$('nriPullBanner').innerHTML=`<strong>${esc(r.receipt_code)} • Marketplace</strong><span>Unidade, data, hora, conferente e fornecedor foram preenchidos pelo recebimento. No NRI, a Fábrica será registrada como ${esc(r.supplier_name)}.</span>`;openView('nri-cadastro',true);}

function pullStepsForCycle(type){const flow=type==='TRANSFER'?'TRANSFER':'PULL';return pullAllMainSteps.filter(x=>(x.flow_type||'PULL')===flow).sort((a,b)=>a.sort_order-b.sort_order);}
loadPullReferenceData = async function(){
  const promises=[sb.from('pull_steps').select('*').order('step_type').order('sort_order'),sb.from('pull_settings').select('*').eq('singleton',true).maybeSingle(),sb.from('factories').select('name,active,latitude,longitude,radius_meters').eq('active',true).order('name'),sb.from('pull_vehicles').select('*').order('plate')];if(hasPerm('PULL_TRIP')||hasPerm('PULL_CONFIG'))promises.push(sb.from('profiles').select('id,username,name,role,active').eq('role','MOTORISTA_PUXADOR').eq('active',true).order('name'));const rows=await Promise.all(promises),err=rows.find(x=>x.error)?.error;if(err)throw err;const [steps,settings,factories,vehicles,profilesRes]=rows;const all=steps.data||[];pullConfigSteps=all.map(x=>({...x,flow_type:x.flow_type||(x.step_type==='OCCURRENCE'?'BOTH':'PULL')}));pullAllMainSteps=pullConfigSteps.filter(x=>x.step_type==='MAIN'&&x.active).sort((a,b)=>a.sort_order-b.sort_order);pullMainSteps=pullStepsForCycle(pullActiveTrip?.cycle_type||'PULL');pullOccurrenceTypes=pullConfigSteps.filter(x=>x.step_type==='OCCURRENCE'&&x.active).sort((a,b)=>a.sort_order-b.sort_order);pullSettings=settings.data||{singleton:true,gps_max_accuracy_m:200,track_interval_seconds:60,track_min_distance_m:50};pullFactories=factories.data||[];pullVehicles=vehicles.data||[];pullProfiles=profilesRes?.data||pullProfiles;populatePullReferenceInputs();
};
function onPullCycleChoice(e){const b=e.target.closest('[data-pull-cycle]');if(!b)return;const type=b.dataset.pullCycle;$('pullStartCycleType').value=type;document.querySelectorAll('[data-pull-cycle]').forEach(x=>x.classList.toggle('active',x===b));$('pullStartPullFields').classList.toggle('hidden',type!=='PULL');$('pullStartTransferFields').classList.toggle('hidden',type!=='TRANSFER');$('pullStartOrigin').required=type==='PULL';$('pullStartFactory').required=type==='PULL';$('pullStartDriver2').required=type==='PULL';$('pullTransferDriver').textContent=profile?.name||'—';if($('pullStartGps'))$('pullStartGps').textContent=`${type==='TRANSFER'?'Transferência Matriz → Filial → Matriz':'Puxada'} • GPS exigido até ±${pullGpsTarget()} m.`;}
pullNextStep = function(){if(!pullActiveTrip)return null;const steps=pullStepsForCycle(pullActiveTrip.cycle_type);const max=pullDriverEvents.length?Math.max(...pullDriverEvents.map(x=>Number(x.step_order)||0)):-Infinity;return steps.find(x=>Number(x.sort_order)>max)||null;};
pullMainStepNumber = function(stepOrEvent){if(!stepOrEvent)return null;const id=stepOrEvent.step_id||stepOrEvent.id||'',code=stepOrEvent.action_code||'',order=Number(stepOrEvent.step_order??stepOrEvent.sort_order);let steps=pullAllMainSteps;const matched=steps.find(s=>(id&&s.id===id)||(code&&s.action_code===code));if(matched)steps=pullStepsForCycle(matched.flow_type);else if(pullActiveTrip)steps=pullStepsForCycle(pullActiveTrip.cycle_type);let idx=steps.findIndex(s=>(id&&s.id===id)||(code&&s.action_code===code));if(idx<0&&Number.isFinite(order))idx=steps.findIndex(s=>Number(s.sort_order)===order);return idx>=0?idx+1:null;};
const renderPullDriverV119=renderPullDriver;
renderPullDriver = function(){pullMainSteps=pullStepsForCycle(pullActiveTrip?.cycle_type||'PULL');renderPullDriverV119();if(!pullActiveTrip){onPullCycleChoice({target:document.querySelector(`[data-pull-cycle="${$('pullStartCycleType')?.value||'PULL'}"]`)});return;}const transfer=pullActiveTrip.cycle_type==='TRANSFER';if($('pullActiveTypeLabel'))$('pullActiveTypeLabel').textContent=transfer?'TRANSFERÊNCIA EM ANDAMENTO':'PUXADA EM ANDAMENTO';if($('pullActiveFactory')?.previousElementSibling)$('pullActiveFactory').previousElementSibling.textContent=transfer?'DESTINO / ROTA':'FÁBRICA';if(transfer){$('pullActiveFactory').textContent='Filial Pau dos Ferros → Matriz Caicó';$('pullActiveSummary').textContent=`Matriz Caicó → Filial Pau dos Ferros → Matriz Caicó • ${pullActiveTrip.plate} • ${pullActiveTrip.driver1_name} • início ${fmtDateTime(pullActiveTrip.started_at)}`;}};
startPullTrip = async function(e){e.preventDefault();const type=$('pullStartCycleType')?.value==='TRANSFER'?'TRANSFER':'PULL';if(type==='TRANSFER'&&activeUnit!=='Matriz Caicó')return toast('A Transferência deve ser iniciada com a unidade atual Matriz Caicó.','error');const plate=String($('pullStartPlate').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!plate)return toast('Informe a placa do veículo.','error');const origin=$('pullStartOrigin').value,factory=$('pullStartFactory').value,driver2=$('pullStartDriver2').value;if(type==='PULL'&&(!origin||!factory||!driver2))return toast('Informe origem, placa, fábrica e Motorista 2.','error');const btn=$('btnPullStart');btn.disabled=true;btn.textContent='Atualizando configuração…';$('pullStartGps').className='gps-status';$('pullStartGps').textContent='Consultando tolerância GPS atual no Supabase…';try{const target=await refreshPullGpsTarget();btn.textContent='Capturando GPS…';const gps=await captureGps({maxAccuracy:target,maxWaitMs:15000,onProgress:s=>{$('pullStartGps').textContent=`GPS atual ±${Math.round(s.accuracy)} m • limite ≤ ${target} m…`;}});$('pullStartGps').className='gps-status ok';$('pullStartGps').textContent=`GPS pronto • precisão ±${Math.round(gps.accuracy||0)} m`;btn.textContent='Iniciando…';const rpc=type==='TRANSFER'?'start_transfer_trip':'start_pull_trip',args=type==='TRANSFER'?{p_plate:plate,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy,p_device_at:gps.capturedAt}:{p_origin_unit:origin,p_plate:plate,p_factory:factory,p_carrier:'Ambev',p_driver2:driver2,p_latitude:gps.latitude,p_longitude:gps.longitude,p_accuracy:gps.accuracy,p_device_at:gps.capturedAt};const {data,error}=await sb.rpc(rpc,args);if(error)throw error;pullActiveTrip=data;toast(type==='TRANSFER'?'Transferência iniciada. Etapas: Matriz → Filial → Matriz.':'Puxada iniciada com GPS validado. O ciclo já está disponível para os dois motoristas.','success');await loadPullActiveTrip();}catch(err){$('pullStartGps').className='gps-status error';$('pullStartGps').textContent=`Não foi possível iniciar: ${humanGpsOrPullError(err)}`;toast(humanGpsOrPullError(err),'error');}finally{btn.disabled=false;btn.textContent='Iniciar ciclo';}};

renderPullFarol = function(){
  const box=$('pullFarolCards'),q=norm($('pullFarolBusca')?.value||''),rows=(box?._rows||[]).filter(t=>!q||norm([t.origin_unit,t.plate,t.carrier,t.factory,t.driver1_name,t.driver2_name,t.active_driver_name,t.cycle_type].join(' ')).includes(q));
  if(!rows.length){box.className='pull-card-grid empty-state';box.textContent='Nenhum ciclo em andamento.';return;}
  box.className='pull-card-grid';box.innerHTML=rows.map(t=>{const transfer=t.cycle_type==='TRANSFER',last=t.last_track||t.last_event,age=last?Math.max(0,Math.round((Date.now()-new Date(last.recorded_at).getTime())/60000)):null;return `<article class="pull-card farol"><div class="pull-card-head"><div><small>${transfer?'TRANSFERÊNCIA':'PUXADA'} • ${esc(t.trip_code)}</small><strong>${esc(t.plate)} • ${esc(transfer?'Filial Pau dos Ferros / Matriz':t.factory)}</strong></div>${pullFarolBadge(t,last)}</div><div class="pull-card-body"><span><b>Origem:</b> ${esc(t.origin_unit||'—')}</span><span><b>${transfer?'Rota':'Parceiro'}:</b> ${esc(transfer?'Matriz → Filial → Matriz':t.carrier||'—')}</span><span><b>Motorista atual:</b> ${esc(t.active_driver_name||'—')}</span><span><b>Etapa:</b> ${esc(t.last_event?pullNumberedStepName(t.last_event):'1. Início')}</span><span><b>Início:</b> ${fmtDateTime(t.started_at)}</span><span><b>Último GPS:</b> ${last?`${age} min atrás`:'Sem rastreio'}</span></div><button class="btn secondary wide" data-pull-detail="${t.id}">Ver mapa e linha do tempo</button></article>`;}).join('');
};

filteredPullHistoryRows = function(){const q=norm($('pullHistBusca')?.value||''),factory=$('pullHistFactory')?.value||'',type=$('pullHistType')?.value||'';return pullHistory.filter(t=>(!type||t.cycle_type===type)&&(!factory||t.factory===factory)&&(!q||norm([t.trip_code,t.origin_unit,t.plate,t.carrier,t.factory,t.driver1_name,t.driver2_name,t.ended_by_name,t.cycle_type].join(' ')).includes(q)));};
function pullHistoryStages(){const type=$('pullHistType')?.value||'';if(type)return pullStepsForCycle(type);return [...pullStepsForCycle('PULL'),...pullStepsForCycle('TRANSFER')];}
renderPullHistoryHead = function(){const head=$('pullHistoryHead');if(!head)return;const stages=pullHistoryStages().map((s,i)=>`<th class="pull-history-stage-head"><span>${pullMainStepNumber(s)||i+1}</span>${esc((!$('pullHistType')?.value?`${s.flow_type==='TRANSFER'?'Transferência':'Puxada'} · `:'')+s.name)}</th>`).join('');head.innerHTML=`<th>Viagem / Tipo</th><th>Origem</th><th>Placa / Fábrica-destino</th><th>Motoristas</th>${stages}<th>TMV Ida</th><th>TMA Fábrica</th><th>TMV Volta</th><th>TMA Revenda</th><th>Ciclo</th><th>NRI</th><th>Ações</th>`;};
renderPullHistory = function(){if(!$('tbodyPullHistory'))return;const hf=$('pullHistFactory');if(hf){const old=hf.value,vals=[...new Set(pullHistory.map(t=>t.factory).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));hf.innerHTML='<option value="">Todas</option>'+vals.map(v=>`<option>${esc(v)}</option>`).join('');if(vals.includes(old))hf.value=old;}renderPullHistoryHead();const rows=filteredPullHistoryRows(),lookup=pullHistoryEventLookup(),stages=pullHistoryStages(),totalCols=4+stages.length+7;$('tbodyPullHistory').innerHTML=rows.length?rows.map(t=>{const m=pullTripMetrics(t),stageCells=stages.map(step=>{if((step.flow_type||'PULL')!==(t.cycle_type||'PULL'))return '<td class="pull-history-stage-cell">—</td>';const ev=pullHistoryStageEvent(lookup,t.id,step);return `<td class="pull-history-stage-cell">${ev?`<strong>${fmtDateTime(ev.recorded_at)}</strong><small>${esc(ev.user_name||'—')} • GPS ±${Math.round(Number(ev.gps_accuracy)||0)} m</small>`:'—'}</td>`;}).join(''),transfer=t.cycle_type==='TRANSFER';return `<tr><td><strong>${esc(t.trip_code)}</strong><small>${transfer?'Transferência':'Puxada'} • ${pullTripStatusLabel(t)}</small></td><td>${esc(t.origin_unit||'—')}</td><td>${esc(t.plate)}<small>${esc(t.factory)}</small></td><td>${esc(t.driver1_name)}${transfer?'':`<small>${esc(t.driver2_name)}</small>`}</td>${stageCells}<td>${fmtMinutes(m.TMV_OUT)}</td><td>${fmtMinutes(m.FACTORY)}</td><td>${fmtMinutes(m.TMV_RETURN)}</td><td>${m.UNIT==null?'—':fmtMinutes(m.UNIT)}</td><td>${m.CYCLE==null?'Aguardando':fmtMinutes(m.CYCLE)}</td><td>${transfer?'—':nriPendingHistoryBadge(t.nri_status)}</td><td><div class="mini-actions"><button class="mini-btn" data-hist-detail="${t.id}">Detalhar</button>${hasPerm('PULL_TMA_ADJUST')&&!transfer&&t.next_started_at?`<button class="mini-btn" data-tma-adjust="${t.id}">Ajustar TMA</button>`:''}</div></td></tr>`;}).join(''):`<tr><td colspan="${totalCols}">Nenhum ciclo.</td></tr>`;};
exportPullHistoryCsv = function(){const rows=filteredPullHistoryRows();if(!rows.length)return toast('Não há ciclos para exportar com os filtros atuais.','error');const lookup=pullHistoryEventLookup(),stages=pullHistoryStages(),headers=['Viagem','Tipo','Status','Origem','Placa','Fábrica/Destino','Parceiro','Motorista 1','Motorista 2',...stages.map(s=>`${s.flow_type==='TRANSFER'?'Transferência':'Puxada'} - ${s.name}`),'TMV Ida','TMA Fábrica','TMV Volta','TMA Revenda bruto','Horas a diminuir','TMA Revenda ajustado','Ciclo','NRI'],matrix=rows.map(t=>{const m=pullTripMetrics(t),stageValues=stages.map(step=>{if((step.flow_type||'PULL')!==(t.cycle_type||'PULL'))return '';const ev=pullHistoryStageEvent(lookup,t.id,step);return ev?`${fmtDateTime(ev.recorded_at)} | ${ev.user_name||''} | GPS ${Number(ev.latitude).toFixed(6)}, ${Number(ev.longitude).toFixed(6)} | ±${Math.round(Number(ev.gps_accuracy)||0)} m`:'';});return [t.trip_code,t.cycle_type==='TRANSFER'?'Transferência':'Puxada',pullTripStatusLabel(t),t.origin_unit,t.plate,t.factory,t.carrier||'Ambev',t.driver1_name,t.cycle_type==='TRANSFER'?'':t.driver2_name,...stageValues,fmtMinutes(m.TMV_OUT),fmtMinutes(m.FACTORY),fmtMinutes(m.TMV_RETURN),fmtMinutes(m.UNIT_RAW),fmtMinutes(Number(t.tma_adjust_minutes||0)),fmtMinutes(m.UNIT),fmtMinutes(m.CYCLE),t.cycle_type==='TRANSFER'?'':t.nri_status||''];});downloadCsv(`historico_ciclos_${localIsoDate(new Date())}.csv`,[headers,...matrix]);};
pullTripStatusLabel = function(t){if(t.status==='IN_PROGRESS')return 'Em andamento';if(t.cycle_type==='TRANSFER'&&t.ended_at)return 'Transferência finalizada';return t.kpi_status==='WAITING_NEXT_START'?'Viagem finalizada • aguardando próxima saída':t.kpi_status==='CLOSED'?'Ciclo KPI fechado':'Cancelado';};
pullTripMetrics = function(t){const transfer=t.cycle_type==='TRANSFER',adj=Math.max(0,Number(t.tma_adjust_minutes||0));if(transfer)return {TMV_OUT:null,FACTORY:null,TMV_RETURN:null,UNIT_RAW:null,UNIT:null,CYCLE:t.started_at&&t.ended_at?minutesBetween(t.started_at,t.ended_at):null};const unitRaw=t.ended_at&&t.next_started_at?Math.max(0,minutesBetween(t.ended_at,t.next_started_at)):null;return {TMV_OUT:t.started_at&&t.arrived_factory_at?minutesBetween(t.started_at,t.arrived_factory_at):null,FACTORY:t.arrived_factory_at&&t.left_factory_at?minutesBetween(t.arrived_factory_at,t.left_factory_at):null,TMV_RETURN:t.left_factory_at&&t.ended_at?minutesBetween(t.left_factory_at,t.ended_at):null,UNIT_RAW:unitRaw,UNIT:unitRaw==null?null:Math.max(0,unitRaw-adj),CYCLE:t.started_at&&t.next_started_at?Math.max(0,minutesBetween(t.started_at,t.next_started_at)-adj):null};};
filteredPullDashTrips = function(){const y=Number($('pullDashYear').value),m=Number($('pullDashMonth').value||0),carrier=$('pullDashCarrier').value,factory=$('pullDashFactory').value,driver=$('pullDashDriver').value,type=$('pullDashType')?.value||'';return pullDashTrips.filter(t=>{const d=new Date(t.started_at);return d.getFullYear()===y&&(!m||d.getMonth()+1===m)&&(!type||t.cycle_type===type)&&(!carrier||t.carrier===carrier)&&(!factory||t.factory===factory)&&(!driver||t.driver1_name===driver||t.driver2_name===driver);});};
renderPullDashboardOverview = function(rows){if(!$('pullOverviewTrips'))return;const completed=rows.filter(t=>t.ended_at).length,inProgress=rows.filter(t=>t.status==='IN_PROGRESS').length,cycleVals=rows.map(t=>pullTripMetrics(t).CYCLE).filter(v=>v!=null),type=$('pullDashType')?.value||'',label=$('pullOverviewArrivals')?.previousElementSibling;let arrivals=[],peak='—';if(type==='PULL'){arrivals=rows.filter(t=>t.arrived_factory_at);peak=arrivalPeakLabel(arrivals);if(label)label.textContent='Chegadas à fábrica';}else{arrivals=rows.filter(t=>t.ended_at);peak=cycleEndMinuteStats(arrivals).peak;if(label)label.textContent=type==='TRANSFER'?'Chegadas à Matriz':'Finais de ciclo';}$('pullOverviewTrips').textContent=rows.length;$('pullOverviewCompleted').textContent=completed;$('pullOverviewProgress').textContent=inProgress;$('pullOverviewCycle').textContent=fmtMinutes(cycleVals.length?cycleVals.reduce((a,b)=>a+b,0)/cycleVals.length:null);$('pullOverviewArrivals').textContent=arrivals.length;$('pullOverviewPeak').textContent=peak;};
const renderPullArrivalHistogramV119=renderPullArrivalHistogram;
renderPullArrivalHistogram = function(rows){renderPullArrivalHistogramV119(rows.filter(t=>(t.cycle_type||'PULL')==='PULL'));};
function cycleEndMinuteStats(rows){const mins=rows.map(t=>localMinuteOfDay(t.ended_at)).filter(v=>v!=null).sort((a,b)=>a-b);if(!mins.length)return {n:0,median:null,first:null,last:null,peak:'—'};const bins=Array(24).fill(0);mins.forEach(m=>bins[Math.floor(m/60)]++);const max=Math.max(...bins),h=bins.indexOf(max),mid=Math.floor(mins.length/2),median=mins.length%2?mins[mid]:(mins[mid-1]+mins[mid])/2;return {n:mins.length,median,first:mins[0],last:mins[mins.length-1],peak:`${String(h).padStart(2,'0')}:00–${String(h).padStart(2,'0')}:59`};}
function renderPullFinalArrivalHistogram(rows){const arrivals=rows.filter(t=>t.ended_at),bins=Array.from({length:24},(_,hour)=>({hour,count:0}));arrivals.forEach(t=>{const m=localMinuteOfDay(t.ended_at);if(m!=null)bins[Math.floor(m/60)].count++;});const max=Math.max(1,...bins.map(x=>x.count)),hist=$('pullFinalArrivalHistogram');if(hist)hist.innerHTML=bins.map(x=>`<div class="pull-hist-bin" title="${String(x.hour).padStart(2,'0')}:00–${String(x.hour).padStart(2,'0')}:59 • ${x.count} chegada${x.count===1?'':'s'}"><strong>${x.count||''}</strong><div><i style="height:${x.count?Math.max(7,x.count/max*100):0}%"></i></div><span>${String(x.hour).padStart(2,'0')}h</span></div>`).join('');const st=cycleEndMinuteStats(arrivals);$('pullFinalArrivalCount').textContent=st.n;$('pullFinalArrivalPeak').textContent=st.peak;$('pullFinalArrivalMedian').textContent=minuteLabel(st.median);$('pullFinalArrivalRange').textContent=st.n?`${minuteLabel(st.first)}–${minuteLabel(st.last)}`:'—';const by=new Map();arrivals.forEach(t=>{const type=t.cycle_type==='TRANSFER'?'Transferência':'Puxada',dest=t.cycle_type==='TRANSFER'?'Matriz Caicó':t.origin_unit||'Revenda',key=`${type}|${dest}`;if(!by.has(key))by.set(key,{type,dest,rows:[]});by.get(key).rows.push(t);});const rs=[...by.values()].map(x=>({...x,...cycleEndMinuteStats(x.rows)})).sort((a,b)=>b.n-a.n);$('tbodyPullFinalArrivalUnit').innerHTML=rs.length?rs.map(r=>`<tr><td><strong>${esc(r.dest)}</strong></td><td>${esc(r.type)}</td><td>${r.n}</td><td>${esc(r.peak)}</td><td>${minuteLabel(r.median)}</td><td>${minuteLabel(r.first)}</td><td>${minuteLabel(r.last)}</td></tr>`).join(''):'<tr><td colspan="7">Sem finais de ciclo no filtro selecionado.</td></tr>';}
function medianNumber(values){const a=[...values].filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function marketplaceReceiptRowsForDashboard(){const y=Number($('pullDashYear')?.value||new Date().getFullYear()),m=Number($('pullDashMonth')?.value||0);return marketplaceDashboardReceipts.filter(r=>{const d=new Date(r.started_at);return r.started_at&&d.getFullYear()===y&&(!m||d.getMonth()+1===m);});}
function marketplaceStartStats(rows){const mins=rows.map(r=>localMinuteOfDay(r.started_at)).filter(v=>v!=null).sort((a,b)=>a-b);if(!mins.length)return {n:0,median:null,first:null,last:null,peak:'—'};const bins=Array(24).fill(0);mins.forEach(m=>bins[Math.floor(m/60)]++);const max=Math.max(...bins),h=bins.indexOf(max),mid=Math.floor(mins.length/2),median=mins.length%2?mins[mid]:(mins[mid-1]+mins[mid])/2;return {n:mins.length,median,first:mins[0],last:mins[mins.length-1],peak:`${String(h).padStart(2,'0')}:00–${String(h).padStart(2,'0')}:59`};}
function renderMarketplaceReceiptHistogram(){
  if(!$('marketReceiptHistogram'))return;
  const rows=marketplaceReceiptRowsForDashboard(),bins=Array.from({length:24},(_,hour)=>({hour,count:0}));
  rows.forEach(r=>{const m=localMinuteOfDay(r.started_at);if(m!=null)bins[Math.floor(m/60)].count++;});
  const top=Math.max(1,...bins.map(b=>b.count));
  $('marketReceiptHistogram').innerHTML=bins.map(b=>`<div class="pull-hist-bin" title="${String(b.hour).padStart(2,'0')}:00–${String(b.hour).padStart(2,'0')}:59 • ${b.count} recebimento${b.count===1?'':'s'} iniciado${b.count===1?'':'s'}"><strong>${b.count||''}</strong><div><i style="height:${b.count?Math.max(7,b.count/top*100):0}%"></i></div><span>${String(b.hour).padStart(2,'0')}h</span></div>`).join('');
  const st=marketplaceStartStats(rows);
  $('marketReceiptCount').textContent=st.n;$('marketReceiptAvg').textContent=st.peak;$('marketReceiptMedian').textContent=minuteLabel(st.median);$('marketReceiptMax').textContent=st.n?`${minuteLabel(st.first)}–${minuteLabel(st.last)}`:'—';
  const groups=new Map();rows.forEach(r=>{const key=`${r.unit}|${r.supplier_name}`;if(!groups.has(key))groups.set(key,{unit:r.unit,supplier:r.supplier_name,rows:[]});groups.get(key).rows.push(r);});
  const rs=[...groups.values()].map(g=>({...g,...marketplaceStartStats(g.rows)})).sort((a,b)=>b.n-a.n||a.supplier.localeCompare(b.supplier,'pt-BR'));
  $('tbodyMarketplaceReceiptHistogram').innerHTML=rs.length?rs.map(r=>`<tr><td><strong>${esc(r.supplier)}</strong></td><td>${esc(r.unit)}</td><td>${r.n}</td><td>${esc(r.peak)}</td><td>${minuteLabel(r.median)}</td><td>${minuteLabel(r.first)}</td><td>${minuteLabel(r.last)}</td></tr>`).join(''):'<tr><td colspan="7">Sem recebimentos Marketplace iniciados no período.</td></tr>';
}

const renderPullDashboardCoreV119=renderPullDashboardCore;
renderPullDashboardCore = function(){renderPullDashboardCoreV119();const rows=filteredPullDashTrips(),type=$('pullDashType')?.value||'';renderPullFinalArrivalHistogram(rows);renderMarketplaceReceiptHistogram();const factoryCard=$('pullArrivalHistogram')?.closest('.pull-arrival-card');if(factoryCard)factoryCard.classList.toggle('hidden',type==='TRANSFER');};

clearPullStepForm = function(){$('pullStepId').value='';$('pullStepName').value='';$('pullStepType').value='MAIN';$('pullStepFlow').value='PULL';$('pullStepCode').disabled=false;$('pullStepCode').value='';$('pullStepOrder').value=100;$('pullStepDuration').value='POINT';$('pullStepExecutor').value='1';$('pullStepGeofence').checked=false;$('pullStepDiscount').checked=false;$('pullStepActive').checked=true;updatePullStepExecutorUi();};
renderPullSteps = function(){const all=[...pullConfigSteps].sort((a,b)=>a.step_type.localeCompare(b.step_type)||String(a.flow_type).localeCompare(String(b.flow_type))||a.sort_order-b.sort_order);$('tbodyPullSteps').innerHTML=all.map(s=>`<tr><td>${s.sort_order}</td><td><strong>${esc(s.name)}</strong></td><td>${s.step_type==='MAIN'?'Principal':'Ocorrência'}</td><td>${s.flow_type==='TRANSFER'?'Transferência':s.flow_type==='BOTH'?'Ambos':'Puxada'}</td><td>${s.step_type==='MAIN'?`<span class="status partial">Motorista ${Number(s.executor_driver)===2?'2':'1'}</span>`:'Motorista ativo'}</td><td><code>${esc(s.action_code)}</code></td><td>${s.requires_factory_geofence?'Auditoria de raio ':''}${s.duration_mode==='INTERVAL'?'Intervalo ':''}${s.suggest_tma_discount?'Sugere desconto':''}</td><td>${s.active?'<span class="status ok">Ativa</span>':'<span class="status bad">Inativa</span>'}</td><td><button class="mini-btn" data-step-edit="${s.id}">Editar</button></td></tr>`).join('');};
onPullStepsClick = function(e){const b=e.target.closest('[data-step-edit]');if(!b)return;const s=pullConfigSteps.find(x=>x.id===b.dataset.stepEdit);if(!s)return;$('pullStepId').value=s.id;$('pullStepName').value=s.name;$('pullStepType').value=s.step_type;$('pullStepFlow').value=s.flow_type|| (s.step_type==='OCCURRENCE'?'BOTH':'PULL');$('pullStepCode').value=s.action_code;$('pullStepCode').disabled=['START_TRIP','ARRIVE_FACTORY','LEAVE_FACTORY','DRIVER_SWAP_OUT','DRIVER_SWAP_RETURN','ARRIVE_UNIT','TRANSFER_START','TRANSFER_ARRIVE_BRANCH','TRANSFER_LEAVE_BRANCH','TRANSFER_ARRIVE_MATRIX'].includes(s.action_code);$('pullStepOrder').value=s.sort_order;$('pullStepDuration').value=s.duration_mode;$('pullStepExecutor').value=String(Number(s.executor_driver)===2?2:1);$('pullStepGeofence').checked=s.requires_factory_geofence;$('pullStepDiscount').checked=s.suggest_tma_discount;$('pullStepActive').checked=s.active;updatePullStepExecutorUi();};
savePullStep = async function(e){e.preventDefault();const id=$('pullStepId').value,type=$('pullStepType').value,flow=$('pullStepFlow').value,action=$('pullStepCode').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_'),fixedStart=['START_TRIP','TRANSFER_START'].includes(action),executor=fixedStart?1:Number($('pullStepExecutor').value||1),row={name:$('pullStepName').value.trim(),step_type:type,flow_type:type==='OCCURRENCE'?(flow||'BOTH'):(flow==='TRANSFER'?'TRANSFER':'PULL'),action_code:action,sort_order:Number($('pullStepOrder').value),duration_mode:$('pullStepDuration').value,executor_driver:type==='MAIN'?executor:null,requires_factory_geofence:$('pullStepGeofence').checked,suggest_tma_discount:$('pullStepDiscount').checked,active:$('pullStepActive').checked,required:type==='MAIN'};if(!row.name||!row.action_code)return toast('Informe nome e código da etapa.','error');if(type==='MAIN'&&![1,2].includes(row.executor_driver))return toast('Selecione Motorista 1 ou Motorista 2 como responsável.','error');try{const r=id?await sb.from('pull_steps').update(row).eq('id',id):await sb.from('pull_steps').insert(row);if(r.error)throw r.error;toast('Etapa/ocorrência salva.','success');clearPullStepForm();await loadPullReferenceData();renderPullSteps();}catch(err){toast(humanPullError(err),'error');}};
updatePullStepExecutorUi = function(){const type=$('pullStepType')?.value,code=String($('pullStepCode')?.value||'').trim().toUpperCase(),flow=$('pullStepFlow'),sel=$('pullStepExecutor'),note=$('pullStepExecutorNote');if(!sel)return;if(type==='OCCURRENCE'){sel.disabled=true;if(flow&&flow.value==='PULL')flow.value='BOTH';if(note)note.textContent='Ocorrências podem ser compartilhadas pelos dois fluxos e são vinculadas ao motorista ativo.';return;}if(flow&&flow.value==='BOTH')flow.value='PULL';sel.disabled=['START_TRIP','TRANSFER_START'].includes(code);if(sel.disabled)sel.value='1';if(note)note.textContent=sel.disabled?'A etapa inicial é sempre registrada pelo Motorista 1.':'Escolha quem deverá apontar esta etapa.';};

const humanPullErrorV119=humanPullError;
humanPullError = function(e){const m=String(e?.message||e||'');const extra={MOTORISTA_COM_CICLO_EM_ANDAMENTO:'Um dos motoristas já possui um ciclo em andamento.',FORNECEDOR_MARKETPLACE_INVALIDO:'Fornecedor Marketplace inválido ou inativo.',RECEBIMENTO_MARKETPLACE_EM_ANDAMENTO:'Você já possui um recebimento Marketplace em andamento.',RECEBIMENTO_MARKETPLACE_NAO_ENCONTRADO:'Recebimento Marketplace não encontrado.',RECEBIMENTO_MARKETPLACE_NAO_ESTA_EM_ANDAMENTO:'Este recebimento Marketplace já foi finalizado.',MARKETPLACE_NAO_DISPONIVEL_PARA_NRI:'Este recebimento Marketplace não está mais disponível para NRI.',FORNECEDOR_MARKETPLACE_OBRIGATORIO:'Informe o fornecedor do Marketplace.',QTD_PALETE_AVARIADO_INVALIDA:'A quantidade de paletes avariados é inválida.',MOTIVO_PALETE_AVARIADO_OBRIGATORIO:'Selecione o motivo do palete avariado.',FOTO_PALETE_AVARIADO_OBRIGATORIA:'Adicione pelo menos uma foto do palete avariado.',MAXIMO_5_FOTOS_PALETE_AVARIADO:'São permitidas no máximo 5 fotos por produto avariado.',NOTA_FISCAL_PALETE_AVARIADO_OBRIGATORIA:'Informe o Número da Nota Fiscal do palete avariado.',MATRIZ_CAICO_NAO_CONFIGURADA:'A unidade Matriz Caicó precisa estar ativa no cadastro de unidades.',FILIAL_PAU_DOS_FERROS_NAO_CONFIGURADA:'A unidade Filial Pau dos Ferros precisa estar ativa no cadastro de unidades.',ETAPA_INICIO_TRANSFERENCIA_NAO_CONFIGURADA:'A etapa inicial da Transferência não está configurada.'};const key=Object.keys(extra).find(k=>m.includes(k));return key?extra[key]:humanPullErrorV119(e);};


// MODAL / HELPERS ------------------------------------------------------------
// ---------------------------------------------------------------------------
// CONTAGEM FEFO - v1.3.1
// Funcionalidades adaptadas do DisbStock V1.6 para Supabase / multiusuario.
// ---------------------------------------------------------------------------
async function refreshFefoBadge(silent=false){
  if(!canFefo()||!sb)return;
  try{
    const {count,error}=await sb.from('fefo_counts').select('id',{count:'exact',head:true}).eq('unit',activeUnit).eq('status','IN_PROGRESS');
    if(error)throw error;
    if($('badgeFefoAtivas'))$('badgeFefoAtivas').textContent=String(count||0);
  }catch(e){if(!silent)toast(humanFefoError(e),'error');}
}

async function fetchFefoCounts(status){
  const out=[];let from=0;const page=1000;
  while(true){
    let q=sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('status',status).order('started_at',{ascending:false}).range(from,from+page-1);
    const {data,error}=await q;if(error)throw error;
    const rows=data||[];out.push(...rows);
    if(rows.length<page)break;
    from+=page;
  }
  return out;
}

async function fetchFefoItemsForCounts(ids){
  const clean=[...new Set((ids||[]).filter(Boolean))];
  if(!clean.length)return [];
  const out=[];const page=1000;
  for(const group of chunks(clean,40)){
    let from=0;
    while(true){
      const {data,error}=await sb.from('fefo_count_items').select('*').in('count_id',group).order('validity_date',{ascending:true}).order('created_at',{ascending:true}).range(from,from+page-1);
      if(error)throw error;
      const rows=data||[];out.push(...rows);
      if(rows.length<page)break;
      from+=page;
    }
  }
  return out;
}

async function fetchFefoItemsForCount(id){
  return fetchFefoItemsForCounts(id?[id]:[]);
}

function rememberFefoItems(rows,replaceIds=[]){
  (replaceIds||[]).forEach(id=>fefoItemsByCount.delete(id));
  const grouped=new Map();
  (rows||[]).forEach(x=>{if(!grouped.has(x.count_id))grouped.set(x.count_id,[]);grouped.get(x.count_id).push(x);});
  grouped.forEach((items,id)=>fefoItemsByCount.set(id,items.sort(fefoItemSort)));
  (replaceIds||[]).forEach(id=>{if(!fefoItemsByCount.has(id))fefoItemsByCount.set(id,[]);});
}

function fefoItemSort(a,b){
  return String(a.validity_date||'9999-12-31').localeCompare(String(b.validity_date||'9999-12-31')) || String(a.product_code||'').localeCompare(String(b.product_code||''),'pt-BR',{numeric:true}) || new Date(a.created_at||0)-new Date(b.created_at||0);
}

async function loadFefoCurrent(silent=false){
  if(!hasPerm('FEFO_CREATE')||!sb)return;
  try{
    let row=null;
    if(fefoActiveCount?.id){
      const r=await sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('id',fefoActiveCount.id).eq('status','IN_PROGRESS').maybeSingle();
      if(r.error)throw r.error;
      row=r.data||null;
    }
    if(!row){
      const r=await sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('counter_id',authUser.id).eq('status','IN_PROGRESS').order('started_at',{ascending:false}).limit(1).maybeSingle();
      if(r.error)throw r.error;
      row=r.data||null;
    }
    fefoActiveCount=row;
    fefoItems=row?await fetchFefoItemsForCount(row.id):[];
    if(row)rememberFefoItems(fefoItems,[row.id]);
    renderFefoCurrent();
    await refreshFefoBadge(true);
  }catch(e){
    if(!silent)toast(humanFefoError(e),'error');
  }
}

function renderFefoCurrent(){
  if(!$('fefoStartCard'))return;
  $('fefoStartCounter').value=profile?.name||'';
  const active=!!fefoActiveCount;
  $('fefoStartCard').classList.toggle('hidden',active);
  $('fefoActiveArea').classList.toggle('hidden',!active);
  if(!active){
    clearFefoItemForm();
    if($('tbodyFefoItems'))$('tbodyFefoItems').innerHTML='';
    return;
  }

  fefoItems.sort(fefoItemSort);
  $('fefoActiveCode').textContent=fefoActiveCount.count_code||'FEFO';
  $('fefoActiveSummary').textContent=`${fefoActiveCount.unit} • ${fefoActiveCount.counter_name} • iniciada em ${fmtDateTime(fefoActiveCount.started_at)}`;
  $('fefoActiveItemsCount').textContent=String(fefoItems.length);
  const earliest=fefoItems.map(x=>x.validity_date).filter(Boolean).sort()[0];
  $('fefoActiveEarliest').textContent=earliest?fmtDate(earliest):'—';
  $('btnFefoFinish').disabled=!fefoItems.length;

  $('tbodyFefoItems').innerHTML=fefoItems.length?fefoItems.map(x=>{
    const v=fefoValidityInfo(x.validity_date);
    return `<tr><td><strong>${esc(x.product_code)}</strong><small>${esc(x.product_name)}</small></td><td><span class="fefo-validity ${v.className}">${fmtDate(x.validity_date)}</span><small>${esc(v.label)}</small></td><td>${esc(x.street||'—')}</td><td>${Number(x.pallet||0)}</td><td>${Number(x.layer||0)}</td><td>${Number(x.box||0)}</td><td>${Number(x.loose_unit||0)}</td><td><div class="mini-actions"><button class="mini-btn" data-fefo-edit="${x.id}">Editar</button><button class="mini-btn danger" data-fefo-delete="${x.id}">Excluir</button></div></td></tr>`;
  }).join(''):'<tr><td colspan="8">Nenhum produto registrado nesta contagem.</td></tr>';
}

function onFefoProductCode(){
  const code=normalizeCode($('fefoCodigo').value);
  const p=productsByCode.get(code);
  const placeholder=$('fefoProdutoPlaceholder'),img=$('fefoProdutoImagem'),info=$('fefoProdutoInfo');
  if(!p){
    placeholder.classList.remove('hidden');placeholder.textContent=code?'Produto não cadastrado':'Digite o código para carregar o produto.';
    img.classList.add('hidden');info.classList.add('hidden');
    return;
  }
  placeholder.classList.add('hidden');info.classList.remove('hidden');
  $('fefoProdutoCodigo').textContent=`Código ${p.code}`;$('fefoProdutoNome').textContent=p.name;
  img.classList.remove('hidden');setProductImage(img,p.code);
}

function maskFefoDate(v){
  const d=String(v||'').replace(/\D/g,'').slice(0,8);
  if(d.length<=2)return d;
  if(d.length<=4)return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}
function parseFefoDate(v){
  const m=String(v||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return '';
  const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
  const dt=new Date(Date.UTC(y,mo-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return '';
  return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function formatFefoDateInput(iso){
  if(!iso)return '';
  const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:'';
}
function fefoValidityInfo(iso){
  if(!iso)return {days:null,className:'',label:'Sem validade'};
  const today=Date.parse(`${localIsoDate(new Date())}T00:00:00Z`),target=Date.parse(`${iso}T00:00:00Z`);
  const days=Math.round((target-today)/86400000);
  if(days<0)return {days,className:'expired',label:`Data vencida há ${Math.abs(days)} dia${Math.abs(days)===1?'':'s'}`};
  if(days===0)return {days,className:'warning',label:'Vence hoje'};
  if(days<=30)return {days,className:'warning',label:`Vence em ${days} dia${days===1?'':'s'}`};
  return {days,className:'ok',label:`${days} dias até o vencimento`};
}
function paintFefoValidityHint(){
  const el=$('fefoValidityHint');if(!el)return;
  const iso=parseFefoDate($('fefoValidade').value);
  if(!iso){el.textContent='Informe a validade no formato DD/MM/AAAA.';el.className='field-help';return;}
  const v=fefoValidityInfo(iso);el.textContent=v.label;el.className=`field-help fefo-date-help ${v.className}`;
}
function fefoIntValue(id){return Math.max(0,Math.trunc(num($(id).value)));}

async function startFefoCount(){
  if(!canFefo())return;
  const unit=$('fefoStartUnit').value;
  if(!unit)return toast('Selecione a unidade da contagem.','error');
  const btn=$('btnFefoStart'),old=btn.textContent;btn.disabled=true;btn.textContent='Iniciando…';
  try{
    const {data,error}=await sb.rpc('start_fefo_count',{p_unit:unit});if(error)throw error;
    fefoActiveCount=data;fefoItems=[];clearFefoItemForm();renderFefoCurrent();await refreshFefoBadge(true);
    toast(`Contagem ${data.count_code} iniciada.`,'success');
    setTimeout(()=>$('fefoCodigo')?.focus(),80);
  }catch(e){
    const msg=humanFefoError(e);toast(msg,'error');
    if(String(e?.message||'').includes('FEFO_CONTAGEM_EM_ANDAMENTO'))await loadFefoCurrent(true);
  }finally{btn.disabled=false;btn.textContent=old;}
}

async function saveFefoItem(e){
  e.preventDefault();
  if(!fefoActiveCount)return toast('Inicie ou retome uma contagem primeiro.','error');
  const code=normalizeCode($('fefoCodigo').value),product=productsByCode.get(code);
  if(!code||!product)return toast('Produto não cadastrado. Confira o código.','error');
  const validity=parseFefoDate($('fefoValidade').value);
  if(!validity)return toast('Informe uma validade válida no formato DD/MM/AAAA.','error');
  const vinfo=fefoValidityInfo(validity);
  if(vinfo.days<0&&!window.confirm('Data vencida\n\nEssa data já passou. Deseja continuar?'))return;

  const btn=$('btnFefoSaveItem'),old=btn.textContent;btn.disabled=true;btn.textContent=fefoEditingItemId?'Atualizando…':'Salvando…';
  try{
    const args={
      p_count_id:fefoActiveCount.id,
      p_product_code:product.code,
      p_validity_date:validity,
      p_street:$('fefoRua').value.trim(),
      p_pallet:fefoIntValue('fefoPalete'),
      p_layer:fefoIntValue('fefoLastro'),
      p_box:fefoIntValue('fefoCaixa'),
      p_loose_unit:fefoIntValue('fefoUnidadeQtd'),
      p_item_id:fefoEditingItemId||null
    };
    const {error}=await sb.rpc('save_fefo_item',args);if(error)throw error;
    toast(fefoEditingItemId?'Produto atualizado.':'Produto salvo na contagem.','success');
    clearFefoItemForm();
    fefoItems=await fetchFefoItemsForCount(fefoActiveCount.id);rememberFefoItems(fefoItems,[fefoActiveCount.id]);renderFefoCurrent();
    setTimeout(()=>$('fefoCodigo')?.focus(),80);
  }catch(err){toast(humanFefoError(err),'error');}
  finally{btn.disabled=false;btn.textContent=fefoEditingItemId?'Atualizar Produto':'Salvar Produto';}
}

function clearFefoItemForm(){
  fefoEditingItemId=null;
  if($('fefoItemId'))$('fefoItemId').value='';
  if($('fefoCodigo'))$('fefoCodigo').value='';
  if($('fefoValidade'))$('fefoValidade').value='';
  if($('fefoRua'))$('fefoRua').value='';
  ['fefoPalete','fefoLastro','fefoCaixa','fefoUnidadeQtd'].forEach(id=>{if($(id))$(id).value='0';});
  if($('fefoItemFormTitle'))$('fefoItemFormTitle').textContent='Adicionar produto';
  if($('btnFefoSaveItem'))$('btnFefoSaveItem').textContent='Salvar Produto';
  if($('btnFefoCancelEdit'))$('btnFefoCancelEdit').classList.add('hidden');
  if($('fefoValidityHint')){$('fefoValidityHint').textContent='Informe a validade do produto.';$('fefoValidityHint').className='field-help';}
  if($('fefoProdutoPlaceholder')){$('fefoProdutoPlaceholder').classList.remove('hidden');$('fefoProdutoPlaceholder').textContent='Digite o código para carregar o produto.';}
  if($('fefoProdutoImagem'))$('fefoProdutoImagem').classList.add('hidden');
  if($('fefoProdutoInfo'))$('fefoProdutoInfo').classList.add('hidden');
}

function onFefoItemsClick(e){
  const edit=e.target.closest('[data-fefo-edit]');if(edit)return editFefoItem(edit.dataset.fefoEdit);
  const del=e.target.closest('[data-fefo-delete]');if(del)return deleteFefoItem(del.dataset.fefoDelete);
}
function editFefoItem(id){
  const x=fefoItems.find(r=>r.id===id);if(!x)return;
  fefoEditingItemId=x.id;$('fefoItemId').value=x.id;$('fefoCodigo').value=x.product_code;$('fefoValidade').value=formatFefoDateInput(x.validity_date);$('fefoRua').value=x.street||'';$('fefoPalete').value=x.pallet||0;$('fefoLastro').value=x.layer||0;$('fefoCaixa').value=x.box||0;$('fefoUnidadeQtd').value=x.loose_unit||0;
  $('fefoItemFormTitle').textContent='Atualizar Produto';$('btnFefoSaveItem').textContent='Atualizar Produto';$('btnFefoCancelEdit').classList.remove('hidden');onFefoProductCode();paintFefoValidityHint();
  $('formFefoItem').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteFefoItem(id){
  const x=fefoItems.find(r=>r.id===id);if(!x)return;
  if(!window.confirm(`Excluir ${x.product_code} - ${x.product_name} desta contagem?`))return;
  try{const {error}=await sb.rpc('delete_fefo_item',{p_item_id:id});if(error)throw error;if(fefoEditingItemId===id)clearFefoItemForm();fefoItems=await fetchFefoItemsForCount(fefoActiveCount.id);rememberFefoItems(fefoItems,[fefoActiveCount.id]);renderFefoCurrent();toast('Produto excluído.','success');}catch(e){toast(humanFefoError(e),'error');}
}

async function finishFefoCount(){
  if(!fefoActiveCount)return;
  if(!fefoItems.length)return toast('Adicione pelo menos um produto antes de finalizar.','error');
  if(!window.confirm(`Finalizar a contagem ${fefoActiveCount.count_code}?\n\nDepois de finalizada, os itens não poderão ser alterados.`))return;
  const btn=$('btnFefoFinish'),old=btn.textContent;btn.disabled=true;btn.textContent='Finalizando…';
  try{
    const countBefore={...fefoActiveCount},itemsBefore=[...fefoItems].sort(fefoItemSort);
    const {data,error}=await sb.rpc('finish_fefo_count',{p_count_id:fefoActiveCount.id});if(error)throw error;
    const finished={...countBefore,...data};
    fefoActiveCount=null;fefoItems=[];clearFefoItemForm();renderFefoCurrent();await refreshFefoBadge(true);
    fefoReports=[finished,...fefoReports.filter(x=>x.id!==finished.id)];fefoItemsByCount.set(finished.id,itemsBefore);
    openModal('Contagem Finalizada',finished.count_code,`<div class="fefo-finished"><span class="fefo-finished-icon">✓</span><h3>Conferência Finalizada</h3><p>${esc(finished.unit)} • ${itemsBefore.length} item${itemsBefore.length===1?'':'s'} registrado${itemsBefore.length===1?'':'s'}.</p><p>O relatório permanece salvo no Supabase e pode ser baixado novamente em <strong>FEFO → Relatórios</strong>.</p></div>`,[
      {label:'Baixar CSV',class:'primary',onClick:()=>downloadFefoCsv(finished,itemsBefore)},
      {label:'Fechar',class:'secondary',onClick:closeModal}
    ]);
  }catch(e){toast(humanFefoError(e),'error');}
  finally{btn.disabled=false;btn.textContent=old;}
}

async function cancelFefoCount(){
  if(!fefoActiveCount)return;
  if(!window.confirm(`Cancelar a contagem ${fefoActiveCount.count_code}?\n\nEla sairá da lista de contagens em andamento.`))return;
  try{const {error}=await sb.rpc('cancel_fefo_count',{p_count_id:fefoActiveCount.id});if(error)throw error;fefoActiveCount=null;fefoItems=[];clearFefoItemForm();renderFefoCurrent();await refreshFefoBadge(true);toast('Contagem cancelada.','success');}catch(e){toast(humanFefoError(e),'error');}
}

async function loadFefoActiveCounts(silent=false){
  if(!hasPerm('FEFO_ACTIVE')||!sb)return;
  try{
    fefoActiveCounts=await fetchFefoCounts('IN_PROGRESS');
    const items=await fetchFefoItemsForCounts(fefoActiveCounts.map(x=>x.id));rememberFefoItems(items,fefoActiveCounts.map(x=>x.id));
    renderFefoActiveCounts();await refreshFefoBadge(true);
  }catch(e){if(!silent)toast(humanFefoError(e),'error');}
}
function renderFefoActiveCounts(){
  if(!$('tbodyFefoActiveCounts'))return;
  $('tbodyFefoActiveCounts').innerHTML=fefoActiveCounts.length?fefoActiveCounts.map(c=>{const items=fefoItemsByCount.get(c.id)||[],action=hasPerm('FEFO_CREATE')?`<button class="mini-btn" data-fefo-resume="${c.id}">Retomar</button>`:`<button class="mini-btn" data-fefo-view="${c.id}">Visualizar</button>`;return `<tr><td><strong>${esc(c.count_code)}</strong><small>Em andamento</small></td><td>${esc(c.unit)}</td><td>${esc(c.counter_name)}</td><td>${fmtDateTime(c.started_at)}</td><td>${items.length}</td><td>${action}</td></tr>`;}).join(''):'<tr><td colspan="6">Nenhuma contagem em andamento.</td></tr>';
}
function onFefoActiveCountsClick(e){const resume=e.target.closest('[data-fefo-resume]');if(resume)return resumeFefoCount(resume.dataset.fefoResume);const view=e.target.closest('[data-fefo-view]');if(view)return openFefoReport(view.dataset.fefoView);}
async function resumeFefoCount(id){
  try{
    let c=fefoActiveCounts.find(x=>x.id===id)||null;
    if(!c){const r=await sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('id',id).eq('status','IN_PROGRESS').single();if(r.error)throw r.error;c=r.data;}
    fefoActiveCount=c;fefoItems=fefoItemsByCount.get(id)||await fetchFefoItemsForCount(id);rememberFefoItems(fefoItems,[id]);clearFefoItemForm();openView('fefo-contagem',true);renderFefoCurrent();
  }catch(e){toast(humanFefoError(e),'error');}
}

async function loadFefoReports(silent=false){
  if(!hasPerm('FEFO_REPORT')||!sb)return;
  try{
    fefoReports=await fetchFefoCounts('COMPLETED');
    const items=await fetchFefoItemsForCounts(fefoReports.map(x=>x.id));rememberFefoItems(items,fefoReports.map(x=>x.id));
    renderFefoReports();
  }catch(e){if(!silent)toast(humanFefoError(e),'error');}
}
function filteredFefoReports(){
  const q=String($('fefoReportSearch')?.value||'').trim().toLowerCase(),unit=$('fefoReportUnit')?.value||'',from=$('fefoReportFrom')?.value||'',to=$('fefoReportTo')?.value||'';
  return fefoReports.filter(c=>{
    const at=String(c.completed_at||c.started_at||'').slice(0,10),items=fefoItemsByCount.get(c.id)||[];
    if(unit&&c.unit!==unit)return false;if(from&&at<from)return false;if(to&&at>to)return false;
    if(q){const hay=[c.count_code,c.unit,c.counter_name,c.counter_username,...items.flatMap(i=>[i.product_code,i.product_name,i.street,fmtDate(i.validity_date)])].join(' ').toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
}
function renderFefoReports(){
  if(!$('tbodyFefoReports'))return;
  const rows=filteredFefoReports();
  $('tbodyFefoReports').innerHTML=rows.length?rows.map(c=>{const items=fefoItemsByCount.get(c.id)||[],earliest=items.map(x=>x.validity_date).filter(Boolean).sort()[0];return `<tr><td><strong>${esc(c.count_code)}</strong></td><td>${esc(c.unit)}</td><td>${esc(c.counter_name)}</td><td>${fmtDateTime(c.started_at)}</td><td>${fmtDateTime(c.completed_at)}</td><td>${items.length}</td><td>${earliest?fmtDate(earliest):'—'}</td><td><div class="mini-actions"><button class="mini-btn" data-fefo-report="${c.id}">Visualizar</button><button class="mini-btn" data-fefo-csv="${c.id}">CSV</button></div></td></tr>`;}).join(''):'<tr><td colspan="8">Nenhum relatório encontrado.</td></tr>';
}
function onFefoReportsClick(e){
  const detail=e.target.closest('[data-fefo-report]');if(detail)return openFefoReport(detail.dataset.fefoReport);
  const csv=e.target.closest('[data-fefo-csv]');if(csv){const c=fefoReports.find(x=>x.id===csv.dataset.fefoCsv);if(c)downloadFefoCsv(c,fefoItemsByCount.get(c.id)||[]);return;}
}
function openFefoReport(id){
  const c=fefoReports.find(x=>x.id===id)||fefoActiveCounts.find(x=>x.id===id);if(!c)return;
  const items=[...(fefoItemsByCount.get(c.id)||[])].sort(fefoItemSort),earliest=items.map(x=>x.validity_date).filter(Boolean).sort()[0];
  const body=`<div class="detail-grid"><div class="detail-card"><small>Unidade</small><strong>${esc(c.unit)}</strong></div><div class="detail-card"><small>Responsável</small><strong>${esc(c.counter_name)}</strong></div><div class="detail-card"><small>Início</small><strong>${fmtDateTime(c.started_at)}</strong></div><div class="detail-card"><small>Finalização</small><strong>${fmtDateTime(c.completed_at)}</strong></div><div class="detail-card"><small>Itens</small><strong>${items.length}</strong></div><div class="detail-card"><small>Menor validade</small><strong>${earliest?fmtDate(earliest):'—'}</strong></div></div><div class="table-wrap"><table class="fefo-table"><thead><tr><th>Código</th><th>Produto</th><th>Validade</th><th>Rua</th><th>Palete</th><th>Lastro</th><th>Caixa</th><th>Unidade</th></tr></thead><tbody>${items.map(x=>{const v=fefoValidityInfo(x.validity_date);return `<tr><td><strong>${esc(x.product_code)}</strong></td><td>${esc(x.product_name)}</td><td><span class="fefo-validity ${v.className}">${fmtDate(x.validity_date)}</span><small>${esc(v.label)}</small></td><td>${esc(x.street||'—')}</td><td>${Number(x.pallet||0)}</td><td>${Number(x.layer||0)}</td><td>${Number(x.box||0)}</td><td>${Number(x.loose_unit||0)}</td></tr>`;}).join('')||'<tr><td colspan="8">Nenhum item.</td></tr>'}</tbody></table></div>`;
  openModal(`FEFO • ${c.count_code}`,c.status==='COMPLETED'?'Contagem finalizada':'Contagem em andamento',body,[
    {label:'Baixar CSV',class:'primary',onClick:()=>downloadFefoCsv(c,items)},
    {label:'Fechar',class:'secondary',onClick:closeModal}
  ]);
}

function fefoCsvCell(v){const s=String(v??'');return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function fefoCsvText(items){
  const rows=[['codigo','nome','validade','rua','palete','lastro','caixa','unidade'],...[...(items||[])].sort(fefoItemSort).map(x=>[x.product_code,x.product_name,fmtDate(x.validity_date),x.street||'',Number(x.pallet||0),Number(x.layer||0),Number(x.box||0),Number(x.loose_unit||0)])];
  return '\uFEFF'+rows.map(r=>r.map(fefoCsvCell).join(';')).join('\r\n');
}
function fefoFileStamp(v){
  const d=new Date(v||Date.now());
  try{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}`;}catch{return localIsoDate(d).replace(/-/g,'');}
}
function fefoFileName(count){return `contagem_${fefoFileStamp(count?.completed_at||count?.started_at)}.csv`;}
function downloadFefoCsv(count,items){
  const blob=new Blob([fefoCsvText(items)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fefoFileName(count);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function humanFefoError(e){
  const m=String(e?.message||e||'Erro na Contagem FEFO');
  const map={
    FEFO_CONTAGEM_EM_ANDAMENTO:'Você já possui uma contagem FEFO em andamento. Retome a contagem existente.',
    FEFO_CONTAGEM_NAO_ENCONTRADA:'Contagem FEFO não encontrada.',
    FEFO_CONTAGEM_FINALIZADA:'Esta contagem já foi finalizada ou cancelada.',
    FEFO_PRODUTO_NAO_CADASTRADO:'Produto não cadastrado.',
    FEFO_VALIDADE_OBRIGATORIA:'Informe a validade do produto.',
    FEFO_LOTE_OBRIGATORIO:'Informe ao menos um lote do produto.',
    FEFO_ITEM_NAO_ENCONTRADO:'Item da contagem não encontrado.',
    FEFO_CONTAGEM_SEM_ITENS:'Adicione pelo menos um produto antes de finalizar.',
    UNIDADE_INVALIDA:'Selecione uma unidade ativa.',
    FORBIDDEN:'Seu perfil não possui permissão para esta ação.'
  };
  const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];
  if(/relation .*fefo_/i.test(m)||/fefo_counts.*does not exist/i.test(m))return 'O módulo FEFO ainda não foi criado no Supabase. Execute o SQL 17_v1_3_0_contagem_fefo.sql.';
  return humanError(e);
}


function openModal(title,subtitle,body,actions=[]){$('modalTitle').textContent=title;$('modalSubtitle').textContent=subtitle||'';$('modalBody').innerHTML=body||'';const a=$('modalActions');a.innerHTML='';actions.forEach(x=>{const b=document.createElement('button');b.className=`btn ${x.class||'secondary'}`;b.textContent=x.label;b.addEventListener('click',x.onClick);a.appendChild(b);});$('modal').classList.add('open');}
function closeModal(){cleanupPullMaps();$('modal').classList.remove('open');$('modalBody').onchange=null;$('modalBody').onclick=null;$('modalBody').innerHTML='';$('modalActions').innerHTML='';}
function statusBadge(s){const cls=s==='IMPRESSO'||s==='APROVADO'||s==='LANCADO'?'ok':s==='REPROVADO'||s==='REPROVADO_ADMIN'||s==='REMOVIDO'?'bad':s==='PARCIAL'||s==='EM_ANALISE'?'partial':'pending';const labels={REPROVADO_ADMIN:'REPROVADO',EM_ANALISE:'EM ANÁLISE',LANCADO:'LANÇADO'};return `<span class="status ${cls}">${esc(labels[s]||s)}</span>`;}
function dashStatus(s){return s==='OK'?'<span class="status ok">Sem diferença</span>':s==='DIVERGENTE'?'<span class="status bad">Com diferença</span>':'<span class="status pending">Sem base MAPAS</span>';}
function toast(msg,type=''){const t=$('toast');t.textContent=msg;t.className=`toast show ${type}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3600);}
function humanError(e){const m=String(e?.message||e?.error_description||e||'Erro desconhecido');if(m.includes('FORBIDDEN'))return 'Seu perfil não possui permissão para esta ação.';if(m.includes('JWT'))return 'Sua sessão expirou. Entre novamente.';if(m.includes('Failed to fetch'))return 'Falha de conexão. Verifique a internet.';return m;}
function humanGpsError(e){const code=e?.code;const msg=String(e?.message||e||'erro ao obter localização.');if(/GPS_PRECISAO_APROXIMADA/i.test(msg))return 'o Android está fornecendo localização aproximada. Abra Configurações > Apps > Disb Gestão > Permissões > Localização e ative “Usar localização precisa”.';if(/GPS_PRECISAO_INSUFICIENTE/i.test(msg)){const best=e?.bestAccuracy??Number(msg.split(':')[1]);const max=e?.maxAccuracy??Number(msg.split(':')[2])??200;return Number.isFinite(best)?`a melhor precisão obtida foi ±${Math.round(best)} m. É necessário chegar a ±${Math.round(max||200)} m ou menos. Aguarde alguns segundos em local aberto, com Localização Precisa ativada, e tente novamente.`:`não foi possível obter uma posição com precisão de até ±${Math.round(max||200)} m. Confirme Localização Precisa e tente em local aberto.`;}if(code===1||/PERMISSAO_LOCALIZACAO_NEGADA|permission denied|permission/i.test(msg))return 'permissão de localização não concedida. No Android, abra Configurações > Apps > Disb Gestão > Permissões > Localização e permita durante o uso, com Localização Precisa ativada.';if(code===2)return 'localização indisponível no aparelho. Confirme se o GPS do celular está ativado.';if(code===3)return 'tempo esgotado ao obter GPS. Aguarde sinal melhor e tente novamente.';return msg;}
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
async function loadNriDamageHistory(silent=false){
  if(!hasPerm('NRI_DAMAGE_HISTORY'))return;
  try{
    const dmg=await sb.from('nri_damage_items').select('*,nri_damage_photos(*)').order('created_at',{ascending:false}).limit(3000);
    if(dmg.error)throw dmg.error;
    const items=dmg.data||[],requestIds=[...new Set(items.map(x=>x.request_id).filter(Boolean))];
    const requests=[];for(let i=0;i<requestIds.length;i+=100){const q=await sb.from('nri_requests').select('*').in('id',requestIds.slice(i,i+100));if(q.error)throw q.error;requests.push(...(q.data||[]));}
    const nris=[];for(let i=0;i<requestIds.length;i+=100){const q=await sb.from('nris').select('id,nri,request_id,product_code,product_name,lot,quantity,status,created_at').in('request_id',requestIds.slice(i,i+100));if(q.error)throw q.error;nris.push(...(q.data||[]));}
    const pullIds=[...new Set(requests.map(x=>x.pull_trip_id).filter(Boolean))],marketIds=[...new Set(requests.map(x=>x.marketplace_receipt_id).filter(Boolean))],pulls=[],markets=[];
    for(let i=0;i<pullIds.length;i+=100){const q=await sb.from('pull_trips').select('id,trip_code,started_at,ended_at,plate,factory,origin_unit').in('id',pullIds.slice(i,i+100));if(q.error)throw q.error;pulls.push(...(q.data||[]));}
    for(let i=0;i<marketIds.length;i+=100){const q=await sb.from('marketplace_receipts').select('id,receipt_code,started_at,ended_at,duration_seconds,supplier_name,unit,checker_name').in('id',marketIds.slice(i,i+100));if(q.error)throw q.error;markets.push(...(q.data||[]));}
    const reqMap=new Map(requests.map(x=>[x.id,x])),pullMap=new Map(pulls.map(x=>[x.id,x])),marketMap=new Map(markets.map(x=>[x.id,x]));
    const nrisByReq=new Map();nris.forEach(n=>{const a=nrisByReq.get(n.request_id)||[];a.push(n);nrisByReq.set(n.request_id,a);});
    nriDamageHistoryRows=items.map(d=>{
      const req=reqMap.get(d.request_id)||{},all=nrisByReq.get(d.request_id)||[],matches=all.filter(n=>String(n.product_code||'')===String(d.product_code||'')&&String(n.lot||'').toUpperCase()===String(d.lot||'').toUpperCase()),p=pullMap.get(req.pull_trip_id)||null,m=marketMap.get(req.marketplace_receipt_id)||null;
      const sourceType=req.marketplace_receipt_id?'MARKETPLACE':req.pull_trip_id?'PULL':'MANUAL',sourceCode=m?.receipt_code||p?.trip_code||'Cadastro manual';
      return {...d,request:req,nris:matches,sourceType,sourceCode,sourceStartedAt:m?.started_at||p?.started_at||null,sourceEndedAt:m?.ended_at||p?.ended_at||null,sourceDurationSeconds:m?.duration_seconds??null};
    });
    populateDamageHistoryUnits();renderNriDamageHistory();
  }catch(e){if(!silent)toast(humanPullError(e),'error');}
}
function populateDamageHistoryUnits(){const sel=$('damageHistUnit');if(!sel)return;const old=sel.value,vals=[...new Set(nriDamageHistoryRows.map(x=>x.request?.unit).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));sel.innerHTML='<option value="">Todas</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(vals.includes(old))sel.value=old;}
function filteredNriDamageHistory(){const q=norm($('damageHistSearch')?.value||''),type=$('damageHistType')?.value||'',unit=$('damageHistUnit')?.value||'',de=$('damageHistDe')?.value||'',ate=$('damageHistAte')?.value||'';return nriDamageHistoryRows.filter(x=>{const req=x.request||{},day=String(x.created_at||'').slice(0,10),nris=(x.nris||[]).map(n=>n.nri).join(' '),hay=[x.invoice_number,nris,x.product_code,x.product_name,x.lot,x.reason,req.unit,req.factory,req.plate,req.driver,req.checker_name,x.sourceCode].join(' ');return (!type||req.request_type===type)&&(!unit||req.unit===unit)&&(!de||day>=de)&&(!ate||day<=ate)&&(!q||norm(hay).includes(q));});}
function damageHistoryOriginLabel(x){if(x.sourceType==='MARKETPLACE')return 'Marketplace';if(x.sourceType==='PULL')return 'Puxada';return 'Cadastro manual';}
function damageHistoryNriList(x){return (x.nris||[]).map(n=>n.nri).filter(Boolean).join(', ')||'—';}
function renderNriDamageHistory(){if(!$('tbodyDamageHistory'))return;const arr=filteredNriDamageHistory(),pallets=arr.reduce((s,x)=>s+Number(x.damaged_pallets||0),0),photos=arr.reduce((s,x)=>s+(x.nri_damage_photos||[]).length,0),invoices=new Set(arr.map(x=>String(x.invoice_number||'').trim()).filter(Boolean));$('damageHistKpiRecords').textContent=arr.length;$('damageHistKpiPallets').textContent=pallets;$('damageHistKpiPhotos').textContent=photos;$('damageHistKpiInvoices').textContent=invoices.size;$('tbodyDamageHistory').innerHTML=arr.length?arr.map(x=>{const r=x.request||{},photoCount=(x.nri_damage_photos||[]).length;return `<tr><td>${fmtDateTime(x.created_at)}</td><td><span class="status ${x.sourceType==='MARKETPLACE'?'partial':'ok'}">${esc(damageHistoryOriginLabel(x))}</span></td><td><strong>${esc(x.sourceCode)}</strong><small>${x.sourceStartedAt?`Início ${fmtDateTime(x.sourceStartedAt)}`:'—'}</small></td><td><strong>${esc(x.invoice_number||'—')}</strong></td><td>${esc(r.unit||'—')}</td><td>${esc(r.factory||'—')}</td><td>${r.receipt_date?fmtDate(r.receipt_date):'—'}<small>${r.receipt_time?fmtTime(r.receipt_time):'—'}</small></td><td>${esc(r.checker_name||'—')}</td><td>${esc(r.plate||'—')}</td><td>${esc(r.driver||'—')}</td><td class="damage-history-nris">${esc(damageHistoryNriList(x))}</td><td><strong>${esc(x.product_code)}</strong><small>${esc(x.product_name)}</small></td><td>${esc(x.lot)}</td><td>${Number(x.total_pallets||0)}</td><td><strong>${Number(x.damaged_pallets||0)}</strong></td><td>${esc(x.reason||'—')}</td><td>${photoCount}</td><td><button class="mini-btn danger" data-damage-history="${x.id}">Ver detalhe</button></td></tr>`;}).join(''):'<tr><td colspan="18">Nenhum palete avariado encontrado.</td></tr>';}
async function onNriDamageHistoryClick(e){const b=e.target.closest('[data-damage-history]');if(!b)return;const row=nriDamageHistoryRows.find(x=>x.id===b.dataset.damageHistory);if(row)await showNriDamageHistoryDetail(row);}
async function showNriDamageHistoryDetail(x){try{const photos=[...(x.nri_damage_photos||[])].sort((a,b)=>Number(a.photo_order||0)-Number(b.photo_order||0)),pairs=await Promise.all(photos.map(async ph=>{const {data}=await sb.storage.from('nri-avarias').createSignedUrl(ph.photo_path,3600);return {...ph,url:data?.signedUrl||''};})),r=x.request||{};const gallery=pairs.map((ph,i)=>`<a class="nri-damage-view-photo" href="${esc(ph.url||'#')}" target="_blank" rel="noopener"><img src="${esc(ph.url||'')}" alt="Foto ${i+1} do palete avariado"><span>Foto ${i+1} • abrir em tamanho maior</span></a>`).join('');const body=`<div class="detail-grid damage-history-detail-grid"><div class="detail-card"><small>Nota Fiscal</small><strong>${esc(x.invoice_number||'—')}</strong></div><div class="detail-card"><small>Origem</small><strong>${esc(damageHistoryOriginLabel(x))}</strong></div><div class="detail-card"><small>Operação</small><strong>${esc(x.sourceCode)}</strong></div><div class="detail-card"><small>Unidade</small><strong>${esc(r.unit||'—')}</strong></div><div class="detail-card"><small>Fornecedor / Fábrica</small><strong>${esc(r.factory||'—')}</strong></div><div class="detail-card"><small>Conferente</small><strong>${esc(r.checker_name||'—')}</strong></div><div class="detail-card"><small>NRI(s)</small><strong>${esc(damageHistoryNriList(x))}</strong></div><div class="detail-card"><small>Produto</small><strong>${esc(x.product_code)} • ${esc(x.product_name)}</strong></div><div class="detail-card"><small>Lote</small><strong>${esc(x.lot)}</strong></div><div class="detail-card"><small>Paletes recebidos</small><strong>${Number(x.total_pallets||0)}</strong></div><div class="detail-card"><small>Paletes avariados</small><strong>${Number(x.damaged_pallets||0)}</strong></div><div class="detail-card"><small>Motivo</small><strong>${esc(x.reason||'—')}</strong></div></div><div class="section-title pull-subtitle">Evidências fotográficas (${pairs.length})</div><div class="nri-damage-view-gallery">${gallery||'<div class="empty-state">Sem fotos disponíveis.</div>'}</div>`;openModal('Palete avariado',`NF ${x.invoice_number||'—'} • ${x.product_code} • lote ${x.lot}`,body);}catch(e){toast(humanPullError(e),'error');}}
function exportNriDamageHistoryCsv(){const arr=filteredNriDamageHistory(),headers=['Data/hora do registro da avaria','Data/hora da requisição NRI','Origem','Código da operação','Nota Fiscal','Unidade','Tipo NRI','Fornecedor/Fábrica','Data recebimento','Hora recebimento','Conferente','Placa','Motorista','Início operação','Fim operação','Duração Marketplace (s)','NRI(s)','Status NRI(s)','Produto código','Produto nome','Lote','Quantidade produto','Paletes recebidos','Paletes avariados','Motivo','Quantidade fotos','Foto 1','Foto 2','Foto 3','Foto 4','Foto 5','Usuário ID do registro','Pull Trip ID','Marketplace Receipt ID','Request ID','Damage ID'];const rows=arr.map(x=>{const r=x.request||{},photos=[...(x.nri_damage_photos||[])].sort((a,b)=>Number(a.photo_order||0)-Number(b.photo_order||0)),nr=x.nris||[],q=nr[0]?.quantity??'';return [fmtDateTime(x.created_at),fmtDateTime(r.created_at),damageHistoryOriginLabel(x),x.sourceCode,x.invoice_number||'',r.unit||'',r.request_type||'',r.factory||'',r.receipt_date||'',r.receipt_time||'',r.checker_name||'',r.plate||'',r.driver||'',x.sourceStartedAt?fmtDateTime(x.sourceStartedAt):'',x.sourceEndedAt?fmtDateTime(x.sourceEndedAt):'',x.sourceDurationSeconds??'',damageHistoryNriList(x),[...new Set(nr.map(n=>n.status).filter(Boolean))].join(', '),x.product_code,x.product_name,x.lot,q,x.total_pallets,x.damaged_pallets,x.reason,photos.length,...Array.from({length:5},(_,i)=>photos[i]?.photo_path||''),x.created_by||'',r.pull_trip_id||'',r.marketplace_receipt_id||'',x.request_id,x.id];});downloadCsv(`historico_paletes_avariados_${localIsoDate(new Date())}.csv`,[headers,...rows]);}

function fmtDateTime(v){if(!v)return '—';try{return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'medium'}).format(new Date(v));}catch{return String(v);}}
function localIsoDate(d){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function localTime(d){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);}
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
function preciseLocationGranted(p){return ['granted','limited'].includes(String(p?.location||'').toLowerCase());}
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
function gpsSample(pos){
  return {latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:Number(pos.coords.accuracy)||99999,capturedAt:new Date(pos.timestamp||Date.now()).toISOString()};
}
function bestGpsSample(samples){return samples.reduce((best,p)=>!best||p.accuracy<best.accuracy?p:best,null);}
function rememberPullGpsSample(sample){if(!sample||!Number.isFinite(sample.latitude)||!Number.isFinite(sample.longitude))return;pullGpsLiveSample=sample;if(!pullGpsBestSample||sample.accuracy<pullGpsBestSample.accuracy||Date.now()-new Date(pullGpsBestSample.capturedAt).getTime()>30000)pullGpsBestSample=sample;}
function recentGpsSample(maxAgeMs=15000){const s=pullGpsLiveSample;if(!s)return null;const age=Date.now()-new Date(s.capturedAt).getTime();return age>=0&&age<=maxAgeMs?s:null;}
function gpsAccuracyError(best,maxAccuracy){const err=new Error(`GPS_PRECISAO_INSUFICIENTE:${best?Math.round(best.accuracy):'SEM_SINAL'}:${maxAccuracy}`);err.code='GPS_PRECISAO_INSUFICIENTE';err.bestAccuracy=best?.accuracy??null;err.maxAccuracy=maxAccuracy;return err;}
function waitMs(ms){return new Promise(r=>setTimeout(r,ms));}
function browserHighAccuracyPosition(timeout=12000){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('GPS indisponível'));
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout,maximumAge:0});
  });
}
async function captureGps({maxAccuracy=null,maxWaitMs=15000,onProgress=null,useRecent=true}={}){
  const limit=maxAccuracy==null?null:Math.max(1,Number(maxAccuracy));
  const recent=useRecent?recentGpsSample(12000):null;
  if(recent&&(!limit||recent.accuracy<=limit)){onProgress?.(recent);return recent;}
  const samples=[];let best=recent||null;let lastError=null;let settled=false;let watchId=null;let timer=null;
  const capGeo=getCapacitorGeolocation();
  const accept=sample=>{samples.push(sample);rememberPullGpsSample(sample);if(!best||sample.accuracy<best.accuracy)best=sample;onProgress?.(best);return !limit||sample.accuracy<=limit;};
  if(capGeo&&isNativeCapacitor()){
    let p=typeof capGeo.checkPermissions==='function'?await capGeo.checkPermissions():null;
    if(!locationGranted(p)&&typeof capGeo.requestPermissions==='function')p=await capGeo.requestPermissions({permissions:['location','coarseLocation']});
    if(limit&&!preciseLocationGranted(p)&&typeof capGeo.requestPermissions==='function')p=await capGeo.requestPermissions({permissions:['location']});
    if(!locationGranted(p))throw new Error('PERMISSAO_LOCALIZACAO_NEGADA');
    if(limit&&p&&!preciseLocationGranted(p))throw new Error('GPS_PRECISAO_APROXIMADA');
    return await new Promise(async(resolve,reject)=>{
      const cleanup=async()=>{if(timer)clearTimeout(timer);if(watchId!=null){try{await capGeo.clearWatch({id:watchId});}catch(_e){}}};
      const finish=async(sample,err)=>{if(settled)return;settled=true;await cleanup();sample?resolve(sample):reject(err||lastError||new Error('GPS indisponível'));};
      timer=setTimeout(()=>finish(limit&&best&&best.accuracy<=limit?best:null,limit?gpsAccuracyError(best,limit):(best?null:lastError||new Error('GPS indisponível'))),maxWaitMs);
      try{
        watchId=await capGeo.watchPosition({enableHighAccuracy:true,timeout:maxWaitMs,maximumAge:0,minimumUpdateInterval:750},(pos,err)=>{if(err){lastError=err;return;}if(!pos)return;const sample=gpsSample(pos);if(accept(sample))finish(sample,null);});
        if(settled&&watchId!=null){try{await capGeo.clearWatch({id:watchId});}catch(_e){}}
      }catch(e){lastError=e;if(best&&(!limit||best.accuracy<=limit))finish(best,null);else finish(null,limit?gpsAccuracyError(best,limit):e);}
    });
  }
  if(!navigator.geolocation)throw new Error('GPS indisponível');
  return await new Promise((resolve,reject)=>{
    let id=null;
    const cleanup=()=>{if(timer)clearTimeout(timer);if(id!=null)navigator.geolocation.clearWatch(id);};
    const finish=(sample,err)=>{if(settled)return;settled=true;cleanup();sample?resolve(sample):reject(err||lastError||new Error('GPS indisponível'));};
    timer=setTimeout(()=>finish(limit&&best&&best.accuracy<=limit?best:null,limit?gpsAccuracyError(best,limit):(best?null:lastError||new Error('GPS indisponível'))),maxWaitMs);
    id=navigator.geolocation.watchPosition(pos=>{const sample=gpsSample(pos);if(accept(sample))finish(sample,null);},err=>{lastError=err;},{enableHighAccuracy:true,timeout:maxWaitMs,maximumAge:0});
  });
}
function compressImage(file,max,quality){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;if(Math.max(w,h)>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(b=>{URL.revokeObjectURL(url);b?resolve(b):reject(new Error('Falha ao processar foto.'));},'image/jpeg',quality);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem inválida.'));};img.src=url;});}
function paintSignatureBackground(c){const ctx=c.getContext('2d');ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.restore();}
function setupSignatureCanvas(){const c=$('signatureCanvas'),ctx=c.getContext('2d');paintSignatureBackground(c);ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#17202a';const pos=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};};c.addEventListener('pointerdown',e=>{drawingSignature=true;signatureDirty=true;c.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});c.addEventListener('pointermove',e=>{if(!drawingSignature)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});['pointerup','pointercancel','pointerleave'].forEach(ev=>c.addEventListener(ev,()=>drawingSignature=false));}
function clearSignature(){const c=$('signatureCanvas'),ctx=c.getContext('2d');ctx.save();ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.restore();ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#17202a';signatureDirty=false;}
function canvasBlob(c,q){return new Promise((resolve,reject)=>{const out=document.createElement('canvas');out.width=c.width;out.height=c.height;const ctx=out.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(c,0,0);out.toBlob(b=>b?resolve(b):reject(new Error('Falha ao gerar assinatura.')),'image/jpeg',q);});}

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


// V1.5.0 - seletor visual de produtos em NRI/FEFO + multiplos lotes -----------------
const operationalProductPickerState={
  nri:{input:'nriCodigo',picker:'nriProductPicker',options:'nriProductOptions',selected:'nriProductSelected',clear:'btnNriProductClear',selectedProduct:null,activeIndex:-1,timer:null},
  fefo:{input:'fefoCodigo',picker:'fefoProductPicker',options:'fefoProductOptions',selected:'fefoProductSelected',clear:'btnFefoProductClear',selectedProduct:null,activeIndex:-1,timer:null}
};
let nriLots=[];
let fefoLots=[];

function operationalProductLabel(p){return p?`${p.code} - ${p.name}`:'';}
function operationalProductState(kind){return operationalProductPickerState[kind]||null;}
function selectedOperationalProduct(kind){return operationalProductState(kind)?.selectedProduct||null;}
function hideOperationalProductOptions(kind){const st=operationalProductState(kind);if(!st)return;const box=$(st.options),input=$(st.input);box?.classList.add('hidden');input?.setAttribute('aria-expanded','false');st.activeIndex=-1;}
function renderOperationalProductSelection(kind){
  const st=operationalProductState(kind);if(!st)return;const info=$(st.selected),clear=$(st.clear);if(!info)return;
  if(!st.selectedProduct){info.className='sales-product-selected muted';info.textContent='Digite para pesquisar e selecione um produto da base.';clear?.classList.add('hidden');return;}
  const p=st.selectedProduct;info.className='sales-product-selected chosen';info.innerHTML=`<span class="sales-product-selected-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span><small>CÓDIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span>`;clear?.classList.remove('hidden');hydrateSalesDamageProductImages(info);
}
function renderOperationalProductOptions(kind,query=''){
  const st=operationalProductState(kind);if(!st)return;const box=$(st.options),input=$(st.input);if(!box||!input)return;
  const {total,rows}=salesDamageProductSearch(query);st.activeIndex=-1;
  if(!refs.products.length){box.innerHTML='<div class="sales-product-empty">Base de produtos ainda está carregando.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  if(!rows.length){box.innerHTML='<div class="sales-product-empty">Nenhum produto encontrado na base.</div>';box.classList.remove('hidden');input.setAttribute('aria-expanded','true');return;}
  box.innerHTML=rows.map((p,i)=>`<button type="button" class="sales-product-option" role="option" data-operational-product-code="${esc(p.code)}" data-operational-product-index="${i}"><span class="sales-product-option-image"><img loading="lazy" data-sales-product-image="${esc(p.code)}" alt=""><span class="sales-product-no-image">Sem foto</span></span><span class="sales-product-option-text"><small>CÓDIGO ${esc(p.code)}</small><strong>${esc(p.name)}</strong></span></button>`).join('')+(total>rows.length?`<div class="sales-product-footer">${rows.length} de ${total} resultados • continue digitando para refinar</div>`:`<div class="sales-product-footer">${total} produto${total===1?'':'s'} encontrado${total===1?'':'s'}</div>`);
  box.classList.remove('hidden');input.setAttribute('aria-expanded','true');hydrateSalesDamageProductImages(box);
}
function selectOperationalProduct(kind,p){
  const st=operationalProductState(kind);if(!st||!p)return;st.selectedProduct={code:String(p.code),name:sanitizeRefText(p.name)};const input=$(st.input);if(input)input.value=operationalProductLabel(st.selectedProduct);renderOperationalProductSelection(kind);hideOperationalProductOptions(kind);
}
function selectOperationalProductByCode(kind,code){const p=productsByCode.get(normalizeCode(code));if(p)selectOperationalProduct(kind,p);else clearOperationalProductSelection(kind,false);}
function clearOperationalProductSelection(kind,focus=false){const st=operationalProductState(kind);if(!st)return;st.selectedProduct=null;const input=$(st.input);if(input)input.value='';renderOperationalProductSelection(kind);hideOperationalProductOptions(kind);if(focus)input?.focus();}
function onOperationalProductInput(kind,e){const st=operationalProductState(kind);if(!st)return;const value=String(e?.target?.value||'');if(st.selectedProduct&&value!==operationalProductLabel(st.selectedProduct)){st.selectedProduct=null;renderOperationalProductSelection(kind);}clearTimeout(st.timer);st.timer=setTimeout(()=>renderOperationalProductOptions(kind,value),60);}
function onOperationalProductOptionClick(kind,e){const b=e.target.closest('[data-operational-product-code]');if(!b)return;selectOperationalProduct(kind,productsByCode.get(String(b.dataset.operationalProductCode)));}
function operationalProductMoveActive(kind,delta){const st=operationalProductState(kind);if(!st)return false;const box=$(st.options);if(!box||box.classList.contains('hidden'))return false;const rows=[...box.querySelectorAll('.sales-product-option')];if(!rows.length)return false;st.activeIndex=Math.max(0,Math.min(rows.length-1,st.activeIndex+delta));rows.forEach((x,i)=>x.classList.toggle('active',i===st.activeIndex));rows[st.activeIndex]?.scrollIntoView({block:'nearest'});return true;}
function onOperationalProductKeydown(kind,e){const st=operationalProductState(kind);if(!st)return;if(e.key==='ArrowDown'){e.preventDefault();if($(st.options)?.classList.contains('hidden'))renderOperationalProductOptions(kind,e.target.value);operationalProductMoveActive(kind,1);}else if(e.key==='ArrowUp'){e.preventDefault();operationalProductMoveActive(kind,-1);}else if(e.key==='Enter'&&!$(st.options)?.classList.contains('hidden')){const rows=[...$(st.options).querySelectorAll('.sales-product-option')],b=rows[st.activeIndex>=0?st.activeIndex:0];if(b){e.preventDefault();selectOperationalProduct(kind,productsByCode.get(String(b.dataset.operationalProductCode)));}}else if(e.key==='Escape')hideOperationalProductOptions(kind);}

function splitMultiLots(value){
  const raw=String(value||'').trim();if(!raw)return [];
  const parts=raw.split(/\s+(?:-|–|—)\s+|[,;|\n]+/).map(sanitizeLot).filter(Boolean);
  return [...new Set(parts)];
}
function multiLotArray(kind){return kind==='nri'?nriLots:fefoLots;}
function setMultiLotArray(kind,arr){if(kind==='nri')nriLots=arr;else fefoLots=arr;}
function multiLotConfig(kind){return kind==='nri'?{input:'nriLote',list:'nriLotList'}:{input:'fefoLote',list:'fefoLotList'};}
function serializeMultiLots(lots){return [...new Set((lots||[]).map(sanitizeLot).filter(Boolean))].join(' - ');}
function renderMultiLots(kind){const cfg=multiLotConfig(kind),el=$(cfg.list),lots=multiLotArray(kind);if(!el)return;if(!lots.length){el.className='multi-lot-list empty';el.innerHTML='<span>Nenhum lote adicionado.</span>';return;}el.className='multi-lot-list';el.innerHTML=lots.map(l=>`<span class="multi-lot-chip">${esc(l)}<button type="button" data-remove-lot="${esc(l)}" aria-label="Remover lote ${esc(l)}">×</button></span>`).join('');}
function addMultiLot(kind,rawValue=null){const cfg=multiLotConfig(kind),input=$(cfg.input),lot=sanitizeLot(rawValue==null?input?.value:rawValue);if(!lot){if(rawValue==null)toast('Digite um lote antes de adicionar.','error');return false;}const lots=multiLotArray(kind);if(!lots.includes(lot))lots.push(lot);if(input)input.value='';renderMultiLots(kind);return true;}
function collectMultiLots(kind){const cfg=multiLotConfig(kind),lots=[...multiLotArray(kind)],typed=sanitizeLot($(cfg.input)?.value);if(typed&&!lots.includes(typed))lots.push(typed);return lots;}
function setMultiLots(kind,value){setMultiLotArray(kind,splitMultiLots(value));const cfg=multiLotConfig(kind);if($(cfg.input))$(cfg.input).value='';renderMultiLots(kind);}
function clearMultiLots(kind){setMultiLotArray(kind,[]);const cfg=multiLotConfig(kind);if($(cfg.input))$(cfg.input).value='';renderMultiLots(kind);}
function onMultiLotKeydown(kind,e){if(e.key==='Enter'){e.preventDefault();addMultiLot(kind);}}
function onMultiLotListClick(kind,e){const b=e.target.closest('[data-remove-lot]');if(!b)return;const lot=b.dataset.removeLot;setMultiLotArray(kind,multiLotArray(kind).filter(x=>x!==lot));renderMultiLots(kind);}

addNriDraftItem = function(){
  const p=selectedOperationalProduct('nri'),sem=$('nriSemValidade').checked,validity=sem?null:parseShortDate($('nriValidade').value),lots=collectMultiLots('nri'),lot=serializeMultiLots(lots),qty=num($('nriQuantidade').value),pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Selecione um produto válido da base.','error');if(!sem&&!validity)return toast('Informe a validade completa no formato dd/mm/aa ou selecione Sem Validade.','error');if(!lots.length)return toast('Informe ao menos um lote.','error');if(qty<=0)return toast('Informe a quantidade.','error');if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  const damagedPallets=nriDamageMode?Math.trunc(num($('nriDamagePallets').value)):0,reason=nriDamageMode?$('nriDamageReason').value.trim():'',invoiceNumber=nriDamageMode?$('nriDamageInvoice').value.trim():'';
  if(nriDamageMode&&(!damagedPallets||damagedPallets<1||damagedPallets>pallets))return toast(`Informe entre 1 e ${pallets} palete(s) avariado(s).`,'error');if(nriDamageMode&&!reason)return toast('Selecione o motivo do avariado.','error');if(nriDamageMode&&!invoiceNumber)return toast('Informe o Número da Nota Fiscal do palete avariado.','error');if(nriDamageMode&&(nriDamagePhotos.length<1||nriDamagePhotos.length>5))return toast('Palete avariado exige de 1 a 5 fotos.','error');
  const item={id:nriEditingId||uuid(),product_code:p.code,product_name:p.name,validity_date:validity,lot,lots,quantity:qty,pallets,block_date:validity?addDaysIso(validity,-30):null,pallet_damaged:nriDamageMode,damaged_pallets:damagedPallets,damage_reason:reason,invoice_number:invoiceNumber,damagePhotos:[...nriDamagePhotos]};
  const idx=nriDraftItems.findIndex(x=>x.id===item.id);if(idx>=0)nriDraftItems[idx]=item;else nriDraftItems.push(item);renderNriDraftItems();clearNriItemEditor();
};
onNriDraftListClick = function(e){const b=e.target.closest('button[data-act]');if(!b)return;const row=b.closest('[data-id]'),item=nriDraftItems.find(x=>x.id===row.dataset.id);if(!item)return;if(b.dataset.act==='del'){nriDraftItems=nriDraftItems.filter(x=>x.id!==item.id);renderNriDraftItems();if(nriEditingId===item.id)clearNriItemEditor();return;}nriEditingId=item.id;selectOperationalProductByCode('nri',item.product_code);$('nriSemValidade').checked=!item.validity_date;$('nriValidade').value=formatShortDate(item.validity_date);setMultiLots('nri',item.lot);$('nriQuantidade').value=item.quantity;$('nriPaletes').value=item.pallets;$('nriBloqueio').value=item.block_date?formatShortDate(item.block_date):'--';nriDamagePhotos=[...(item.damagePhotos||[])];$('nriDamagePallets').value=item.damaged_pallets||1;$('nriDamageReason').value=item.damage_reason||'';$('nriDamageInvoice').value=item.invoice_number||'';setNriDamageMode(!!item.pallet_damaged);updateNriValidityMode();$('btnAdicionarNriItem').textContent='Salvar alteração';$('btnCancelarNriItem').classList.remove('hidden');};
clearNriItemEditor = function(){nriEditingId=null;clearOperationalProductSelection('nri',false);if($('nriValidade'))$('nriValidade').value='';if($('nriBloqueio'))$('nriBloqueio').value='';clearMultiLots('nri');$('nriSemValidade').checked=false;updateNriValidityMode();$('nriQuantidade').value=1;$('nriPaletes').value=1;$('btnAdicionarNriItem').textContent='+ Adicionar à carreta';$('btnCancelarNriItem').classList.add('hidden');resetNriDamageEditor();};

fefoItemSort = function(a,b){return String(a.validity_date||'9999-12-31').localeCompare(String(b.validity_date||'9999-12-31'))||String(a.product_code||'').localeCompare(String(b.product_code||''),'pt-BR',{numeric:true})||String(a.lot||'').localeCompare(String(b.lot||''),'pt-BR')||new Date(a.created_at||0)-new Date(b.created_at||0);};
renderFefoCurrent = function(){
  if(!$('fefoStartCard'))return;$('fefoStartCounter').value=profile?.name||'';const active=!!fefoActiveCount;$('fefoStartCard').classList.toggle('hidden',active);$('fefoActiveArea').classList.toggle('hidden',!active);
  if(!active){clearFefoItemForm();if($('tbodyFefoItems'))$('tbodyFefoItems').innerHTML='';return;}
  fefoItems.sort(fefoItemSort);$('fefoActiveCode').textContent=fefoActiveCount.count_code||'FEFO';$('fefoActiveSummary').textContent=`${fefoActiveCount.unit} • ${fefoActiveCount.counter_name} • iniciada em ${fmtDateTime(fefoActiveCount.started_at)}`;$('fefoActiveItemsCount').textContent=String(fefoItems.length);const earliest=fefoItems.map(x=>x.validity_date).filter(Boolean).sort()[0];$('fefoActiveEarliest').textContent=earliest?fmtDate(earliest):'—';$('btnFefoFinish').disabled=!fefoItems.length;
  $('tbodyFefoItems').innerHTML=fefoItems.length?fefoItems.map(x=>{const v=fefoValidityInfo(x.validity_date);return `<tr><td><strong>${esc(x.product_code)}</strong><small>${esc(x.product_name)}</small></td><td><span class="fefo-validity ${v.className}">${fmtDate(x.validity_date)}</span><small>${esc(v.label)}</small></td><td>${esc(x.street||'—')}</td><td>${Number(x.pallet||0)}</td><td>${Number(x.layer||0)}</td><td>${Number(x.box||0)}</td><td>${Number(x.loose_unit||0)}</td><td><div class="mini-actions"><button class="mini-btn" data-fefo-edit="${x.id}">Editar</button><button class="mini-btn danger" data-fefo-delete="${x.id}">Excluir</button></div></td></tr>`;}).join(''):'<tr><td colspan="8">Nenhum produto registrado nesta contagem.</td></tr>';
};
saveFefoItem = async function(e){
  e.preventDefault();if(!fefoActiveCount)return toast('Inicie ou retome uma contagem primeiro.','error');const product=selectedOperationalProduct('fefo');if(!product)return toast('Selecione um produto válido da base.','error');const validity=parseFefoDate($('fefoValidade').value);if(!validity)return toast('Informe uma validade válida no formato DD/MM/AAAA.','error');const vinfo=fefoValidityInfo(validity);if(vinfo.days<0&&!window.confirm('Data vencida\n\nEssa data já passou. Deseja continuar?'))return;
  const btn=$('btnFefoSaveItem'),old=btn.textContent;btn.disabled=true;btn.textContent=fefoEditingItemId?'Atualizando…':'Salvando…';
  try{const args={p_count_id:fefoActiveCount.id,p_product_code:product.code,p_validity_date:validity,p_lot:'',p_street:$('fefoRua').value.trim(),p_pallet:fefoIntValue('fefoPalete'),p_layer:fefoIntValue('fefoLastro'),p_box:fefoIntValue('fefoCaixa'),p_loose_unit:fefoIntValue('fefoUnidadeQtd'),p_item_id:fefoEditingItemId||null};const {error}=await sb.rpc('save_fefo_item',args);if(error)throw error;toast(fefoEditingItemId?'Produto atualizado.':'Produto salvo na contagem.','success');clearFefoItemForm();fefoItems=await fetchFefoItemsForCount(fefoActiveCount.id);rememberFefoItems(fefoItems,[fefoActiveCount.id]);renderFefoCurrent();setTimeout(()=>$('fefoCodigo')?.focus(),80);}catch(err){toast(humanFefoError(err),'error');}finally{btn.disabled=false;btn.textContent=fefoEditingItemId?'Atualizar Produto':'Salvar Produto';}
};
clearFefoItemForm = function(){fefoEditingItemId=null;if($('fefoItemId'))$('fefoItemId').value='';clearOperationalProductSelection('fefo',false);if($('fefoValidade'))$('fefoValidade').value='';if($('fefoRua'))$('fefoRua').value='';['fefoPalete','fefoLastro','fefoCaixa','fefoUnidadeQtd'].forEach(id=>{if($(id))$(id).value='0';});if($('fefoItemFormTitle'))$('fefoItemFormTitle').textContent='Adicionar produto';if($('btnFefoSaveItem'))$('btnFefoSaveItem').textContent='Salvar Produto';if($('btnFefoCancelEdit'))$('btnFefoCancelEdit').classList.add('hidden');if($('fefoValidityHint')){$('fefoValidityHint').textContent='Informe a validade do produto.';$('fefoValidityHint').className='field-help';}};
editFefoItem = function(id){const x=fefoItems.find(r=>r.id===id);if(!x)return;fefoEditingItemId=x.id;$('fefoItemId').value=x.id;selectOperationalProductByCode('fefo',x.product_code);$('fefoValidade').value=formatFefoDateInput(x.validity_date);$('fefoRua').value=x.street||'';$('fefoPalete').value=x.pallet||0;$('fefoLastro').value=x.layer||0;$('fefoCaixa').value=x.box||0;$('fefoUnidadeQtd').value=x.loose_unit||0;$('fefoItemFormTitle').textContent='Atualizar Produto';$('btnFefoSaveItem').textContent='Atualizar Produto';$('btnFefoCancelEdit').classList.remove('hidden');paintFefoValidityHint();$('formFefoItem').scrollIntoView({behavior:'smooth',block:'start'});};
filteredFefoReports = function(){const q=String($('fefoReportSearch')?.value||'').trim().toLowerCase(),unit=$('fefoReportUnit')?.value||'',from=$('fefoReportFrom')?.value||'',to=$('fefoReportTo')?.value||'';return fefoReports.filter(c=>{const at=String(c.completed_at||c.started_at||'').slice(0,10),items=fefoItemsByCount.get(c.id)||[];if(unit&&c.unit!==unit)return false;if(from&&at<from)return false;if(to&&at>to)return false;if(q){const hay=[c.count_code,c.unit,c.counter_name,c.counter_username,...items.flatMap(i=>[i.product_code,i.product_name,i.lot,i.street,fmtDate(i.validity_date)])].join(' ').toLowerCase();if(!hay.includes(q))return false;}return true;});};
openFefoReport = function(id){const c=fefoReports.find(x=>x.id===id)||fefoActiveCounts.find(x=>x.id===id);if(!c)return;const items=[...(fefoItemsByCount.get(c.id)||[])].sort(fefoItemSort),earliest=items.map(x=>x.validity_date).filter(Boolean).sort()[0];const body=`<div class="detail-grid"><div class="detail-card"><small>Unidade</small><strong>${esc(c.unit)}</strong></div><div class="detail-card"><small>Responsável</small><strong>${esc(c.counter_name)}</strong></div><div class="detail-card"><small>Início</small><strong>${fmtDateTime(c.started_at)}</strong></div><div class="detail-card"><small>Finalização</small><strong>${fmtDateTime(c.completed_at)}</strong></div><div class="detail-card"><small>Itens</small><strong>${items.length}</strong></div><div class="detail-card"><small>Menor validade</small><strong>${earliest?fmtDate(earliest):'—'}</strong></div></div><div class="table-wrap"><table class="fefo-table"><thead><tr><th>Código</th><th>Produto</th><th>Validade</th><th>Rua</th><th>Palete</th><th>Lastro</th><th>Caixa</th><th>Unidade</th></tr></thead><tbody>${items.map(x=>{const v=fefoValidityInfo(x.validity_date);return `<tr><td><strong>${esc(x.product_code)}</strong></td><td>${esc(x.product_name)}</td><td><span class="fefo-validity ${v.className}">${fmtDate(x.validity_date)}</span><small>${esc(v.label)}</small></td><td>${esc(x.street||'—')}</td><td>${Number(x.pallet||0)}</td><td>${Number(x.layer||0)}</td><td>${Number(x.box||0)}</td><td>${Number(x.loose_unit||0)}</td></tr>`;}).join('')||'<tr><td colspan="8">Nenhum item.</td></tr>'}</tbody></table></div>`;openModal(`FEFO • ${c.count_code}`,c.status==='COMPLETED'?'Contagem finalizada':'Contagem em andamento',body,[{label:'Baixar CSV',class:'primary',onClick:()=>downloadFefoCsv(c,items)},{label:'Fechar',class:'secondary',onClick:closeModal}]);};
fefoCsvText = function(items){const rows=[['codigo','nome','validade','rua','palete','lastro','caixa','unidade'],...[...(items||[])].sort(fefoItemSort).map(x=>[x.product_code,x.product_name,fmtDate(x.validity_date),x.street||'',Number(x.pallet||0),Number(x.layer||0),Number(x.box||0),Number(x.loose_unit||0)])];return '\uFEFF'+rows.map(r=>r.map(fefoCsvCell).join(';')).join('\r\n');};


// ATIVO DE GIRO ----------------------------------------------------------------
function assetQty(v){return Math.max(0,Math.trunc(num(v)));}
function assetInputId(productId,field){return `asset-${productId}-${field}`;}
function assetInputValue(productId,field){return assetQty($(assetInputId(productId,field))?.value||0);}
function normalizeAssetLocation(v){return String(v||'PATIO').toUpperCase()==='REFUGO'?'REFUGO':'PATIO';}
function assetLocationLabel(v){return normalizeAssetLocation(v)==='REFUGO'?'Refugo':'Pátio';}
function assetLocationClass(v){return normalizeAssetLocation(v)==='REFUGO'?'refugo':'patio';}
function assetLocationValue(productId){
  const row=document.querySelector(`[data-asset-product="${CSS.escape(String(productId))}"]`);
  return normalizeAssetLocation(row?.dataset.assetLocation||'PATIO');
}
function assetTotalLabel(t){return `P ${t?.pallet_gfa||0} • L ${t?.layer_gfa||0} • C ${t?.box_gfa||0} • A ${t?.loose||0} • U ${t?.units||0}`;}
function blankAssetTotal(extra={}){return {product_id:'',sap_code:'',asset_code:'',description:'',pallet_gfa:0,layer_gfa:0,box_gfa:0,loose:0,units:0,entries:0,...extra};}
function aggregateRotatingAssetEntries(entries,location=''){
  const loc=location?normalizeAssetLocation(location):'';const out=new Map();
  (entries||[]).forEach(e=>{
    const entryLoc=normalizeAssetLocation(e.location);if(loc&&entryLoc!==loc)return;
    let t=out.get(e.product_id);
    if(!t){t=blankAssetTotal({product_id:e.product_id,sap_code:e.sap_code||'',asset_code:e.asset_code||'',description:e.product_description||''});out.set(e.product_id,t);}
    t.pallet_gfa+=Number(e.pallet_gfa||0);t.layer_gfa+=Number(e.layer_gfa||0);t.box_gfa+=Number(e.box_gfa||0);t.loose+=Number(e.loose||0);t.units+=Number(e.units||0);t.entries++;
  });
  return out;
}
function aggregateRotatingAssetGrandTotal(entries,location){
  const map=aggregateRotatingAssetEntries(entries,location),total=blankAssetTotal({location:normalizeAssetLocation(location)});
  map.forEach(t=>{total.pallet_gfa+=t.pallet_gfa;total.layer_gfa+=t.layer_gfa;total.box_gfa+=t.box_gfa;total.loose+=t.loose;total.units+=t.units;total.entries+=t.entries;});
  return total;
}
function assetLocationChoice(productId){
  return `<div class="asset-location-choice choice-toggle" data-asset-location-choice="${productId}"><button type="button" class="choice-btn success-choice active" data-asset-location="PATIO" data-asset-location-product="${productId}">Pátio</button><button type="button" class="choice-btn danger-choice" data-asset-location="REFUGO" data-asset-location-product="${productId}">Refugo</button></div>`;
}
function setRotatingAssetLocation(productId,location){
  const row=document.querySelector(`[data-asset-product="${CSS.escape(String(productId))}"]`);if(!row)return;
  const loc=normalizeAssetLocation(location);row.dataset.assetLocation=loc;
  row.querySelectorAll('[data-asset-location]').forEach(b=>b.classList.toggle('active',normalizeAssetLocation(b.dataset.assetLocation)===loc));
}
async function loadRotatingAssetProducts(silent=false){
  if(!canRotatingAsset()||!sb)return;
  try{
    const {data,error}=await sb.from('rotating_asset_products').select('*').eq('active',true).order('sort_order').order('description');
    if(error)throw error;rotatingAssetProducts=data||[];renderRotatingAssetCurrent();
  }catch(e){if(!silent)toast(humanRotatingAssetError(e),'error');}
}
async function fetchRotatingAssetEntries(countIds){
  const ids=[...new Set((countIds||[]).filter(Boolean))];if(!ids.length)return [];
  const out=[];
  for(let i=0;i<ids.length;i+=25){
    const group=ids.slice(i,i+25);let from=0;const page=1000;
    while(true){
      const {data,error}=await sb.from('rotating_asset_entries').select('*').in('count_id',group).order('created_at',{ascending:false}).range(from,from+page-1);
      if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<page)break;from+=page;
    }
  }
  return out;
}
async function loadRotatingAssetCurrent(silent=false){
  if(!hasPerm('ROTATING_ASSET_CREATE')||!sb)return;
  try{
    if(!rotatingAssetProducts.length)await loadRotatingAssetProducts(true);
    const {data,error}=await sb.from('rotating_asset_counts').select('*').eq('unit',activeUnit).eq('counter_id',authUser.id).eq('status','IN_PROGRESS').order('started_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;rotatingAssetActiveCount=data||null;rotatingAssetEntries=data?await fetchRotatingAssetEntries([data.id]):[];renderRotatingAssetCurrent();
  }catch(e){if(!silent)toast(humanRotatingAssetError(e),'error');}
}
function renderRotatingAssetCurrent(){
  if(!$('assetStartCard'))return;
  if($('assetStartCounter'))$('assetStartCounter').value=profile?.name||'';
  if($('assetStartDate')&&!$('assetStartDate').value)$('assetStartDate').value=localIsoDate(new Date());
  const active=!!rotatingAssetActiveCount;
  $('assetStartCard').classList.toggle('hidden',active);$('assetActiveArea').classList.toggle('hidden',!active);
  if(!active){if($('assetProductGrid'))$('assetProductGrid').innerHTML='';if($('tbodyAssetEntries'))$('tbodyAssetEntries').innerHTML='';return;}
  const patioTotals=aggregateRotatingAssetEntries(rotatingAssetEntries,'PATIO'),refugoTotals=aggregateRotatingAssetEntries(rotatingAssetEntries,'REFUGO');
  $('assetActiveCode').textContent=rotatingAssetActiveCount.count_code||'AG';
  $('assetActiveSummary').textContent=`${rotatingAssetActiveCount.unit} • ${fmtDate(rotatingAssetActiveCount.count_date)} • ${rotatingAssetActiveCount.counter_name}`;
  $('assetActiveEntriesCount').textContent=String(rotatingAssetEntries.length);$('assetEntryCounter').textContent=`${rotatingAssetEntries.length} adições`;
  $('btnAssetFinish').disabled=!rotatingAssetEntries.length;
  $('assetProductGrid').innerHTML=rotatingAssetProducts.length?rotatingAssetProducts.map(p=>{
    const patio=patioTotals.get(p.id)||blankAssetTotal(),refugo=refugoTotals.get(p.id)||blankAssetTotal();
    const qty=(field,label)=>`<label class="asset-mobile-label">${label}</label><input id="${assetInputId(p.id,field)}" class="asset-qty-input" type="number" min="0" step="1" inputmode="numeric" value="0">`;
    return `<div class="asset-count-row" data-asset-product="${p.id}" data-asset-location="PATIO"><div data-label="COD. SAP">${esc(p.sap_code||'—')}</div><div data-label="COD.">${esc(p.asset_code||'—')}</div><div class="asset-desc" data-label="DESCRIÇÃO"><strong>${esc(p.description)}</strong><small>Pátio: ${patio.entries} • Refugo: ${refugo.entries} adição${patio.entries+refugo.entries===1?'':'ões'}</small></div><div class="asset-location-cell" data-label="LOCAL"><label class="asset-mobile-label">LOCAL DO ATIVO</label>${assetLocationChoice(p.id)}</div><div data-label="PALET/GFA">${qty('pallet','PALET/GFA')}</div><div data-label="LASTRO/GFA">${qty('layer','LASTRO/GFA')}</div><div data-label="CAIXA/GFA">${qty('box','CAIXA/GFA')}</div><div data-label="AVULSO">${qty('loose','AVULSO')}</div><div data-label="UNIDADES">${qty('units','UNIDADES')}</div><div class="asset-running-total" data-label="TOTAL ATUAL"><div class="asset-total-location patio"><span>Pátio</span><strong>${assetTotalLabel(patio)}</strong></div><div class="asset-total-location refugo"><span>Refugo</span><strong>${assetTotalLabel(refugo)}</strong></div></div><div data-label="AÇÃO"><button type="button" class="btn primary asset-add-btn" data-asset-add="${p.id}">Adicionar à contagem</button></div></div>`;
  }).join(''):'<div class="empty-state">Nenhum ativo cadastrado. Execute o SQL 20.</div>';
  const recent=[...rotatingAssetEntries].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,80);
  $('tbodyAssetEntries').innerHTML=recent.length?recent.map(e=>`<tr><td>${new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(e.created_at))}</td><td><strong>${esc(e.product_description)}</strong><small>${esc(e.sap_code||'—')} • ${esc(e.asset_code||'—')}</small></td><td><span class="asset-location-badge ${assetLocationClass(e.location)}">${assetLocationLabel(e.location)}</span></td><td>${Number(e.pallet_gfa||0)}</td><td>${Number(e.layer_gfa||0)}</td><td>${Number(e.box_gfa||0)}</td><td>${Number(e.loose||0)}</td><td>${Number(e.units||0)}</td><td><button class="mini-btn danger" data-asset-delete="${e.id}">Excluir</button></td></tr>`).join(''):'<tr><td colspan="9">Nenhuma adição registrada.</td></tr>';
}
async function startRotatingAssetCount(){
  const unit=$('assetStartUnit')?.value||'';if(!unit)return toast('Selecione a unidade da contagem.','error');
  const btn=$('btnAssetStart'),old=btn.textContent;btn.disabled=true;btn.textContent='Iniciando…';
  try{const {data,error}=await sb.rpc('start_rotating_asset_count',{p_unit:unit,p_count_date:$('assetStartDate')?.value||localIsoDate(new Date())});if(error)throw error;rotatingAssetActiveCount=data;rotatingAssetEntries=[];await loadRotatingAssetProducts(true);renderRotatingAssetCurrent();toast(`Contagem ${data.count_code} iniciada.`,'success');}
  catch(e){toast(humanRotatingAssetError(e),'error');await loadRotatingAssetCurrent(true);}finally{btn.disabled=false;btn.textContent=old;}
}
function onRotatingAssetProductGridClick(e){
  const b=e.target.closest('[data-asset-add]');
  if(b){addRotatingAssetEntry(b.dataset.assetAdd,b);return;}
  const loc=e.target.closest('[data-asset-location-product][data-asset-location]');
  if(loc){setRotatingAssetLocation(loc.dataset.assetLocationProduct,loc.dataset.assetLocation);}
}
async function addRotatingAssetEntry(productId,btn){
  if(!rotatingAssetActiveCount)return toast('Inicie uma contagem primeiro.','error');
  const product=rotatingAssetProducts.find(p=>p.id===productId);if(!product)return toast('Ativo não encontrado.','error');
  const args={p_count_id:rotatingAssetActiveCount.id,p_product_id:product.id,p_pallet_gfa:assetInputValue(product.id,'pallet'),p_layer_gfa:assetInputValue(product.id,'layer'),p_box_gfa:assetInputValue(product.id,'box'),p_loose:assetInputValue(product.id,'loose'),p_units:assetInputValue(product.id,'units'),p_location:assetLocationValue(product.id)};
  if(args.p_pallet_gfa+args.p_layer_gfa+args.p_box_gfa+args.p_loose+args.p_units<=0)return toast('Informe ao menos uma quantidade maior que zero.','error');
  const old=btn.textContent;btn.disabled=true;btn.textContent='Adicionando…';
  try{const {error}=await sb.rpc('add_rotating_asset_entry',args);if(error)throw error;['pallet','layer','box','loose','units'].forEach(f=>{const el=$(assetInputId(product.id,f));if(el)el.value='0';});rotatingAssetEntries=await fetchRotatingAssetEntries([rotatingAssetActiveCount.id]);renderRotatingAssetCurrent();toast(`${product.description} • ${assetLocationLabel(args.p_location)}: adição registrada.`,'success');}
  catch(e){toast(humanRotatingAssetError(e),'error');}finally{btn.disabled=false;btn.textContent=old;}
}
function onRotatingAssetEntriesClick(e){const b=e.target.closest('[data-asset-delete]');if(b)deleteRotatingAssetEntry(b.dataset.assetDelete);}
async function deleteRotatingAssetEntry(id){
  const entry=rotatingAssetEntries.find(x=>x.id===id);if(!entry)return;if(!window.confirm(`Excluir esta adição de ${entry.product_description} (${assetLocationLabel(entry.location)})?\n\nOs totais serão recalculados.`))return;
  try{const {error}=await sb.rpc('delete_rotating_asset_entry',{p_entry_id:id});if(error)throw error;rotatingAssetEntries=await fetchRotatingAssetEntries([rotatingAssetActiveCount.id]);renderRotatingAssetCurrent();toast('Adição excluída e totais recalculados.','success');}catch(e){toast(humanRotatingAssetError(e),'error');}
}
async function finishRotatingAssetCount(){
  if(!rotatingAssetActiveCount)return;if(!rotatingAssetEntries.length)return toast('Adicione ao menos uma quantidade antes de finalizar.','error');
  if(!window.confirm(`Finalizar ${rotatingAssetActiveCount.count_code}?\n\nOs totais de Pátio e Refugo serão gravados separadamente no histórico.`))return;
  const btn=$('btnAssetFinish'),old=btn.textContent;btn.disabled=true;btn.textContent='Finalizando…';
  try{const {error}=await sb.rpc('finish_rotating_asset_count',{p_count_id:rotatingAssetActiveCount.id});if(error)throw error;toast('Contagem finalizada e enviada ao histórico.','success');rotatingAssetActiveCount=null;rotatingAssetEntries=[];renderRotatingAssetCurrent();if(hasPerm('ROTATING_ASSET_HISTORY'))loadRotatingAssetHistory(true);}
  catch(e){toast(humanRotatingAssetError(e),'error');}finally{btn.disabled=false;btn.textContent=old;}
}
async function cancelRotatingAssetCount(){
  if(!rotatingAssetActiveCount)return;if(!window.confirm(`Cancelar ${rotatingAssetActiveCount.count_code}?\n\nOs lançamentos desta contagem serão mantidos para auditoria, mas ela ficará como cancelada.`))return;
  try{const {error}=await sb.rpc('cancel_rotating_asset_count',{p_count_id:rotatingAssetActiveCount.id});if(error)throw error;rotatingAssetActiveCount=null;rotatingAssetEntries=[];renderRotatingAssetCurrent();toast('Contagem cancelada.','success');}catch(e){toast(humanRotatingAssetError(e),'error');}
}
async function loadRotatingAssetHistory(silent=false){
  if(!hasPerm('ROTATING_ASSET_HISTORY')||!sb)return;
  try{
    if(!rotatingAssetProducts.length)await loadRotatingAssetProducts(true);
    const {data,error}=await sb.from('rotating_asset_counts').select('*').eq('unit',activeUnit).eq('status','COMPLETED').order('count_date',{ascending:false}).order('completed_at',{ascending:false}).limit(500);if(error)throw error;
    rotatingAssetHistory=data||[];const entries=await fetchRotatingAssetEntries(rotatingAssetHistory.map(x=>x.id));rotatingAssetEntriesByCount=new Map();entries.forEach(e=>{if(!rotatingAssetEntriesByCount.has(e.count_id))rotatingAssetEntriesByCount.set(e.count_id,[]);rotatingAssetEntriesByCount.get(e.count_id).push(e);});renderRotatingAssetHistory();
  }catch(e){if(!silent)toast(humanRotatingAssetError(e),'error');}
}
function filteredRotatingAssetHistory(){
  const q=String($('assetHistorySearch')?.value||'').trim().toLowerCase(),unit=$('assetHistoryUnit')?.value||'',from=$('assetHistoryFrom')?.value||'',to=$('assetHistoryTo')?.value||'';
  return rotatingAssetHistory.filter(c=>{if(unit&&c.unit!==unit)return false;if(from&&c.count_date<from)return false;if(to&&c.count_date>to)return false;if(q){const entries=rotatingAssetEntriesByCount.get(c.id)||[];const hay=[c.count_code,c.unit,c.counter_name,c.counter_username,...entries.flatMap(e=>[e.sap_code,e.asset_code,e.product_description,assetLocationLabel(e.location)])].join(' ').toLowerCase();if(!hay.includes(q))return false;}return true;});
}
function renderRotatingAssetHistory(){
  if(!$('tbodyAssetHistory'))return;const rows=filteredRotatingAssetHistory();$('tbodyAssetHistory').innerHTML=rows.length?rows.map(c=>{const entries=rotatingAssetEntriesByCount.get(c.id)||[],patio=aggregateRotatingAssetGrandTotal(entries,'PATIO'),refugo=aggregateRotatingAssetGrandTotal(entries,'REFUGO');return `<tr><td><strong>${esc(c.count_code)}</strong></td><td>${fmtDate(c.count_date)}</td><td>${esc(c.unit)}</td><td>${esc(c.counter_name)}</td><td>${entries.length}</td><td><div class="asset-history-location-summary patio"><strong>${patio.entries} adições</strong><small>${assetTotalLabel(patio)}</small></div></td><td><div class="asset-history-location-summary refugo"><strong>${refugo.entries} adições</strong><small>${assetTotalLabel(refugo)}</small></div></td><td>${fmtDateTime(c.completed_at)}</td><td><div class="mini-actions"><button class="mini-btn" data-asset-history-view="${c.id}">Ver totais</button><button class="mini-btn" data-asset-history-csv="${c.id}">CSV</button></div></td></tr>`;}).join(''):'<tr><td colspan="9">Nenhuma contagem encontrada.</td></tr>';
}
function rotatingAssetTotalRows(entries){
  const order=new Map(rotatingAssetProducts.map((p,i)=>[p.id,i])),entryMeta=new Map();(entries||[]).forEach(e=>{if(!entryMeta.has(e.product_id))entryMeta.set(e.product_id,e);});
  const productIds=[...new Set((entries||[]).map(e=>e.product_id))].sort((a,b)=>(order.get(a)??999)-(order.get(b)??999));
  const patio=aggregateRotatingAssetEntries(entries,'PATIO'),refugo=aggregateRotatingAssetEntries(entries,'REFUGO'),rows=[];
  productIds.forEach(productId=>{
    const meta=rotatingAssetProducts.find(p=>p.id===productId)||entryMeta.get(productId)||{};
    [['PATIO',patio],['REFUGO',refugo]].forEach(([location,map])=>{
      const t=map.get(productId)||blankAssetTotal({product_id:productId,sap_code:meta.sap_code||'',asset_code:meta.asset_code||'',description:meta.description||meta.product_description||''});
      rows.push({...t,location});
    });
  });
  return rows;
}
function onRotatingAssetHistoryClick(e){const view=e.target.closest('[data-asset-history-view]');if(view)return openRotatingAssetHistory(view.dataset.assetHistoryView);const csv=e.target.closest('[data-asset-history-csv]');if(csv)return downloadRotatingAssetHistoryCsv(csv.dataset.assetHistoryCsv);}
function rotatingAssetHistoryViewRows(entries,view='TOTAL'){
  const mode=String(view||'TOTAL').toUpperCase();
  const order=new Map(rotatingAssetProducts.map((p,i)=>[p.id,i]));
  const entryMeta=new Map();
  (entries||[]).forEach(e=>{if(!entryMeta.has(e.product_id))entryMeta.set(e.product_id,e);});
  const productIds=[...new Set((entries||[]).map(e=>e.product_id))].sort((a,b)=>(order.get(a)??999)-(order.get(b)??999));
  const totals=mode==='TOTAL'?aggregateRotatingAssetEntries(entries):aggregateRotatingAssetEntries(entries,mode);
  return productIds.map(productId=>{
    const meta=rotatingAssetProducts.find(p=>p.id===productId)||entryMeta.get(productId)||{};
    const t=totals.get(productId);
    if(!t||!t.entries)return null;
    return {...t,location:mode};
  }).filter(Boolean);
}
function rotatingAssetHistoryViewLabel(view){const mode=String(view||'TOTAL').toUpperCase();return mode==='REFUGO'?'Refugo':mode==='PATIO'?'Pátio':'Total';}
function rotatingAssetHistoryViewClass(view){const mode=String(view||'TOTAL').toUpperCase();return mode==='REFUGO'?'refugo':mode==='PATIO'?'patio':'total';}
function rotatingAssetHistoryTableRowsHtml(rows,view){
  const label=rotatingAssetHistoryViewLabel(view),cls=rotatingAssetHistoryViewClass(view);
  if(!rows.length)return '<tr><td colspan="9" class="asset-history-empty-view">Nenhum ativo encontrado nesta página.</td></tr>';
  return rows.map(r=>`<tr><td>${esc(r.sap_code||'—')}</td><td>${esc(r.asset_code||'—')}</td><td><strong>${esc(r.description)}</strong><small>${r.entries} adição${r.entries===1?'':'ões'}</small></td><td><span class="asset-location-badge ${cls}">${label}</span></td><td>${r.pallet_gfa}</td><td>${r.layer_gfa}</td><td>${r.box_gfa}</td><td>${r.loose}</td><td>${r.units}</td></tr>`).join('');
}
function openRotatingAssetHistory(id){
  const c=rotatingAssetHistory.find(x=>x.id===id);if(!c)return;
  const entries=rotatingAssetEntriesByCount.get(id)||[],patio=aggregateRotatingAssetGrandTotal(entries,'PATIO'),refugo=aggregateRotatingAssetGrandTotal(entries,'REFUGO');
  const total=aggregateRotatingAssetGrandTotal(entries);
  const initialRows=rotatingAssetHistoryViewRows(entries,'TOTAL');
  const body=`<div class="detail-grid asset-history-detail-grid"><div class="detail-card"><small>Data</small><strong>${fmtDate(c.count_date)}</strong></div><div class="detail-card"><small>Unidade</small><strong>${esc(c.unit)}</strong></div><div class="detail-card"><small>Conferente</small><strong>${esc(c.counter_name)}</strong></div><div class="detail-card"><small>Adições</small><strong>${entries.length}</strong></div></div><div class="asset-history-total-cards"><div class="asset-history-total-card patio"><span>Pátio</span><strong>${assetTotalLabel(patio)}</strong><small>${patio.entries} adição${patio.entries===1?'':'ões'}</small></div><div class="asset-history-total-card refugo"><span>Refugo</span><strong>${assetTotalLabel(refugo)}</strong><small>${refugo.entries} adição${refugo.entries===1?'':'ões'}</small></div></div><div class="asset-history-view-tabs" role="tablist" aria-label="Visualização dos totais do Ativo de Giro"><button type="button" class="asset-history-view-tab active" data-asset-history-tab="TOTAL">TOTAL</button><button type="button" class="asset-history-view-tab patio" data-asset-history-tab="PATIO">PÁTIO</button><button type="button" class="asset-history-view-tab refugo" data-asset-history-tab="REFUGO">REFUGO</button></div><div class="asset-history-view-caption"><strong id="assetHistoryViewTitle">Total</strong><span id="assetHistoryViewSummary">Pátio + Refugo • ${assetTotalLabel(total)}</span></div><div class="table-wrap"><table class="asset-history-total-table"><thead><tr><th>COD. SAP</th><th>COD.</th><th>Descrição</th><th>Visão</th><th>Palet/GFA</th><th>Lastro/GFA</th><th>Caixa/GFA</th><th>Avulso</th><th>Unidades</th></tr></thead><tbody id="assetHistoryViewTbody">${rotatingAssetHistoryTableRowsHtml(initialRows,'TOTAL')}</tbody></table></div>`;
  openModal(`Ativo de Giro • ${c.count_code}`,`${fmtDate(c.count_date)} • ${c.unit}`,body,[{label:'Baixar CSV',class:'primary',onClick:()=>downloadRotatingAssetHistoryCsv(c.id)},{label:'Fechar',class:'secondary',onClick:closeModal}]);
  const modalBody=$('modalBody');
  const renderView=view=>{
    const mode=String(view||'TOTAL').toUpperCase(),rows=rotatingAssetHistoryViewRows(entries,mode);
    const totals=mode==='PATIO'?patio:mode==='REFUGO'?refugo:total;
    const title=rotatingAssetHistoryViewLabel(mode);
    const summary=mode==='TOTAL'?`Pátio + Refugo • ${assetTotalLabel(totals)}`:`${totals.entries} adição${totals.entries===1?'':'ões'} • ${assetTotalLabel(totals)}`;
    const tbody=$('assetHistoryViewTbody');if(tbody)tbody.innerHTML=rotatingAssetHistoryTableRowsHtml(rows,mode);
    if($('assetHistoryViewTitle'))$('assetHistoryViewTitle').textContent=title;
    if($('assetHistoryViewSummary'))$('assetHistoryViewSummary').textContent=summary;
    modalBody?.querySelectorAll('[data-asset-history-tab]').forEach(btn=>{const active=btn.dataset.assetHistoryTab===mode;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false');});
  };
  modalBody?.querySelectorAll('[data-asset-history-tab]').forEach(btn=>btn.addEventListener('click',()=>renderView(btn.dataset.assetHistoryTab)));
}
function downloadRotatingAssetHistoryCsv(id){
  const c=rotatingAssetHistory.find(x=>x.id===id);if(!c)return;const rows=rotatingAssetTotalRows(rotatingAssetEntriesByCount.get(id)||[]);downloadCsv(`ativo_giro_${String(c.count_date||'').replaceAll('-','')}_${c.count_code}.csv`,[['contagem','data','unidade','conferente','cod_sap','cod','descricao','local','palet_gfa','lastro_gfa','caixa_gfa','avulso','unidades'],...rows.map(r=>[c.count_code,c.count_date,c.unit,c.counter_name,r.sap_code,r.asset_code,r.description,assetLocationLabel(r.location),r.pallet_gfa,r.layer_gfa,r.box_gfa,r.loose,r.units])]);
}
function humanRotatingAssetError(e){
  const m=String(e?.message||e||'Erro no Ativo de Giro');const map={ATIVO_GIRO_CONTAGEM_NAO_ENCONTRADA:'Contagem de Ativo de Giro não encontrada.',ATIVO_GIRO_CONTAGEM_FINALIZADA:'Esta contagem já foi finalizada ou cancelada.',ATIVO_GIRO_PRODUTO_INVALIDO:'Ativo inválido ou inativo.',ATIVO_GIRO_LOCAL_INVALIDO:'Selecione Pátio ou Refugo.',ATIVO_GIRO_QUANTIDADE_OBRIGATORIA:'Informe ao menos uma quantidade maior que zero.',ATIVO_GIRO_LANCAMENTO_NAO_ENCONTRADO:'Adição não encontrada.',ATIVO_GIRO_CONTAGEM_SEM_LANCAMENTOS:'Adicione ao menos uma quantidade antes de finalizar.',UNIDADE_INVALIDA:'Selecione uma unidade válida.',FORBIDDEN:'Seu usuário não possui permissão para esta ação.'};const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];if(/location.*rotating_asset_entries|add_rotating_asset_entry/i.test(m))return 'A atualização Pátio/Refugo do Ativo de Giro ainda não foi aplicada no Supabase. Execute o SQL 23_v1_5_1_ativo_giro_patio_refugo.sql.';if(/rotating_asset|relation .* does not exist/i.test(m))return 'O módulo Ativo de Giro ainda não foi criado no Supabase. Execute o SQL 20_v1_5_0_ativo_giro_sidebar.sql.';return humanError(e);
}


// V1.5.1 - FLUXO DE AVARIAS, COMPROVANTE WHATSAPP, CONTATOS E DESCARTE NRI ------
function statusBadge(s){
  const status=String(s||'').toUpperCase();
  const cls={PENDENTE:'pending',EM_ANALISE:'analysis',PARCIAL:'partial',APROVADO:'approved',LANCADO:'launched',ENTREGUE:'delivered',REPROVADO:'rejected',REPROVADO_ADMIN:'rejected',REMOVIDO:'rejected',IMPRESSO:'approved',COMPLETED:'approved',DISCARDED:'discarded'}[status]||'pending';
  const labels={EM_ANALISE:'EM ANÁLISE',LANCADO:'LANÇADO NO SISTEMA',ENTREGUE:'ENTREGUE',REPROVADO_ADMIN:'REPROVADO',DISCARDED:'PENDÊNCIA DESCARTADA'};
  return `<span class="status ${cls}">${esc(labels[status]||status||'—')}</span>`;
}

function nriPendingHistoryBadge(status){
  if(status==='COMPLETED')return '<span class="status approved">Concluído</span>';
  if(status==='PENDING')return '<span class="status pending">Pendente</span>';
  if(status==='DISCARDED')return '<span class="status discarded">Pendência descartada</span>';
  return '—';
}

loadPullNriPending = async function(silent=false){
  if(!hasPerm('NRI_PENDING_VIEW'))return;
  try{
    const [pr,mr]=await Promise.all([
      sb.from('pull_trips').select('*').eq('origin_unit',activeUnit).eq('cycle_type','PULL').eq('status','ARRIVED').eq('nri_status','PENDING').order('ended_at',{ascending:false}).limit(200),
      sb.from('marketplace_receipts').select('*').eq('unit',activeUnit).eq('status','PENDING_NRI').eq('nri_status','PENDING').order('ended_at',{ascending:false}).limit(200)
    ]);
    if(pr.error)throw pr.error;if(mr.error)throw mr.error;
    const rows=[...(pr.data||[]).map(x=>({...x,_source:'PULL',_sort:x.ended_at})),...(mr.data||[]).map(x=>({...x,_source:'MARKETPLACE',_sort:x.ended_at}))].sort((a,b)=>new Date(b._sort)-new Date(a._sort));
    $('badgePullNri').textContent=rows.length;
    const el=$('pullNriCards');
    if(!rows.length){el.className='pull-card-grid empty-state';el.textContent='Nenhum recebimento pendente.';return;}
    const canCreate=hasPerm('NRI_CREATE');
    const actions=(source,attr,id)=>canCreate?`<div class="pending-nri-actions"><button class="btn primary" ${attr}="${id}">Cadastrar NRIs</button><button class="btn secondary pending-discard-btn" data-discard-nri-source="${source}" data-discard-nri-id="${id}">Descartar pendência</button></div>`:`<div class="notice compact">Somente consulta • sem permissão para cadastrar ou descartar pendência de NRI.</div>`;
    el.className='pull-card-grid';
    el.innerHTML=rows.map(x=>x._source==='PULL'
      ?`<article class="pull-card"><div class="pull-card-head"><div><small>PUXADA • ${esc(x.trip_code)}</small><strong>${esc(x.plate)}</strong></div><span class="status pending">Aguardando NRI</span></div><div class="pull-card-body"><span><b>Fábrica:</b> ${esc(x.factory)}</span><span><b>Motorista:</b> ${esc(x.ended_by_name||'—')}</span><span><b>Recebida:</b> ${fmtDateTime(x.ended_at)}</span><span><b>Unidade:</b> ${esc(x.origin_unit)}</span></div>${actions('PULL','data-pull-nri',x.id)}</article>`
      :`<article class="pull-card marketplace"><div class="pull-card-head"><div><small>MARKETPLACE • ${esc(x.receipt_code)}</small><strong>${esc(x.supplier_name)}</strong></div><span class="status pending">Aguardando NRI</span></div><div class="pull-card-body"><span><b>Fornecedor:</b> ${esc(x.supplier_name)}</span><span><b>Conferente:</b> ${esc(x.checker_name)}</span><span><b>Finalizado:</b> ${fmtDateTime(x.ended_at)}</span><span><b>Unidade:</b> ${esc(x.unit)}</span><span><b>Tempo:</b> ${fmtDurationSeconds(x.duration_seconds||0)}</span></div>${actions('MARKETPLACE','data-market-nri',x.id)}</article>`
    ).join('');
    el._pendingRows=rows;
  }catch(e){if(!silent)toast(humanNriPendingError(e),'error');}
};

onPullNriCardsClick = async function(e){
  const discard=e.target.closest('[data-discard-nri-id]');
  if(discard){
    if(!hasPerm('NRI_CREATE'))return toast('Seu usuário não possui permissão para descartar esta pendência.','error');
    const source=discard.dataset.discardNriSource,id=discard.dataset.discardNriId;
    if(!confirm('Descartar somente a pendência de emissão de NRI? O histórico da Puxada ou do recebimento Marketplace será preservado.'))return;
    discard.disabled=true;
    try{
      const {error}=await sb.rpc('discard_nri_pending',{p_source_type:source,p_source_id:id,p_reason:'Recebimento já chegou com NRI.'});
      if(error)throw error;
      toast('Pendência de NRI descartada. O histórico do recebimento foi preservado.','success');
      await loadPullNriPending(true);
    }catch(err){toast(humanNriPendingError(err),'error');}
    finally{discard.disabled=false;}
    return;
  }
  const p=e.target.closest('[data-pull-nri]'),m=e.target.closest('[data-market-nri]');
  if(!p&&!m)return;
  if(!hasPerm('NRI_CREATE'))return toast('Seu usuário possui apenas consulta dos recebimentos pendentes.','error');
  const rows=$('pullNriCards')._pendingRows||[];
  if(p){const t=rows.find(x=>x._source==='PULL'&&x.id===p.dataset.pullNri);if(t)prefillNriFromPull(t);}
  else{const r=rows.find(x=>x._source==='MARKETPLACE'&&x.id===m.dataset.marketNri);if(r)prefillNriFromMarketplace(r);}
};

function humanNriPendingError(e){
  const m=String(e?.message||e||'Erro na pendência de NRI');
  const map={PENDENCIA_NRI_NAO_ENCONTRADA:'Esta pendência já foi concluída, descartada ou não existe.',TIPO_ORIGEM_INVALIDO:'Origem de recebimento inválida.',FORBIDDEN:'Seu usuário não possui permissão para esta ação.'};
  const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];
  if(/discard_nri_pending|DISCARDED/i.test(m))return 'A atualização para descarte de pendência de NRI ainda não foi aplicada no Supabase. Execute o SQL 24_v1_5_1_fluxo_avarias_comprovante_contatos_nri.sql.';
  return humanError(e);
}

function normalizeWhatsappPhone(value){
  let d=String(value||'').replace(/\D/g,'');
  if(d.startsWith('00'))d=d.slice(2);
  if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;
  return /^55\d{10,11}$/.test(d)?d:'';
}
function formatWhatsappPhone(value){
  let d=normalizeWhatsappPhone(value);if(!d)return String(value||'');d=d.slice(2);
  return d.length===11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
}
async function getCustomerContacts(customerId,customerCode=''){
  let query=sb.from('customer_contacts').select('id,customer_id,customer_code,phone_normalized,label,source,updated_at,updated_by_name').order('updated_at',{ascending:false});
  if(customerId)query=query.eq('customer_id',customerId);
  else if(customerCode)query=query.eq('customer_code',normalizeCode(customerCode));
  else return [];
  const {data,error}=await query;if(error)throw error;return data||[];
}
function deliveryDamageReceiptMessage(ctx){
  const items=(ctx.items||[]).map(x=>{
    const code=String(x.product_code||'').trim();
    const name=String(x.product_name||x.product||'Produto').trim();
    const product=code?`${code} - ${name}`:name;
    const unit=x.unit==='CAIXA'?'caixa'+(num(x.quantity)===1?'':'s'):'unidade'+(num(x.quantity)===1?'':'s');
    return `• ${product} — *${fmtNum(x.quantity)} ${unit}*`;
  }).join('\n');
  const e={doc:'\uD83D\uDCC4',user:'\uD83D\uDC64',numbers:'\uD83D\uDD22',map:'\uD83D\uDDFA\uFE0F',calendar:'\uD83D\uDCC5',box:'\uD83D\uDCE6',note:'\uD83D\uDCDD',phone:'\uD83D\uDCDE'};
  return `${e.doc} *COMPROVANTE DE AVARIA*\n\n${e.user} *Cliente:* ${ctx.customer.name}\n${e.numbers} *PDV:* ${ctx.customer.code}\n${e.map} *Mapa:* ${ctx.map_number}\n${e.calendar} *Data:* ${fmtDate(ctx.date)}\n\n${e.box} *Produto(s) avariado(s):*\n${items}\n\n${e.note} *Observação:*\nO produto avariado será enviado junto ao *próximo pedido realizado pelo cliente*.\n\n${e.phone} *Precisa de mais informações?*\nEntre em contato com nossa *Central de Atendimento* pelo número:\n*(84) 9 9609-9264*`;
}
function whatsappReceiptUrl(phone,ctx){
  const normalized=normalizeWhatsappPhone(phone);return normalized?`https://wa.me/${normalized}?text=${encodeURIComponent(deliveryDamageReceiptMessage(ctx))}`:'';
}
function openWhatsappReceipt(phone,ctx){
  const url=whatsappReceiptUrl(phone,ctx);if(!url)return toast('Número de WhatsApp inválido. Informe DDD + telefone.','error');
  const opened=window.open(url,'_blank');if(!opened)window.location.href=url;
}
function openAllWhatsappReceipts(contacts,ctx){
  const phones=[...new Set((contacts||[]).map(x=>normalizeWhatsappPhone(x.phone_normalized)).filter(Boolean))];
  if(!phones.length)return toast('Nenhum WhatsApp válido cadastrado para este cliente.','error');
  if(phones.length===1)return openWhatsappReceipt(phones[0],ctx);
  if(!confirm(`Abrir o comprovante para ${phones.length} contatos? O WhatsApp solicitará a confirmação de cada envio.`))return;
  phones.forEach((phone,i)=>setTimeout(()=>{const url=whatsappReceiptUrl(phone,ctx);if(url)window.open(url,'_blank');},i*450));
}
async function saveCustomerContactForReceipt(ctx,phone,label=''){
  const normalized=normalizeWhatsappPhone(phone);if(!normalized)return toast('Informe um telefone válido com DDD.','error');
  try{
    const {error}=await sb.rpc('save_customer_contact',{p_customer_id:ctx.customer.id,p_customer_code:ctx.customer.code,p_phone:normalized,p_label:String(label||'').trim()});if(error)throw error;
    toast('Contato salvo no cliente.','success');
    await openDeliveryDamageReceipt(ctx);
  }catch(e){toast(humanCustomerContactError(e),'error');}
}
async function openDeliveryDamageReceipt(ctx){
  deliveryDamageReceiptContext=ctx;
  let contacts=[];let contactError='';
  try{contacts=await getCustomerContacts(ctx.customer.id,ctx.customer.code);}catch(e){contactError=humanCustomerContactError(e);}
  const last=contacts.reduce((max,x)=>!max||String(x.updated_at)>String(max)?x.updated_at:max,'');
  const contactHtml=contacts.length?contacts.map((c,i)=>`<div class="receipt-contact-row"><div><strong>${esc(c.label||`Contato ${i+1}`)}</strong><span>${esc(formatWhatsappPhone(c.phone_normalized))}</span></div><button type="button" class="btn whatsapp-btn" data-send-receipt-phone="${esc(c.phone_normalized)}">Enviar comprovante</button></div>`).join(''):`<div class="empty-state">Nenhum WhatsApp cadastrado para este cliente.</div>`;
  const sendAll=contacts.length>1?`<div class="receipt-send-all"><button type="button" id="btnDeliveryReceiptSendAll" class="btn whatsapp-btn">Enviar para todos os ${contacts.length} contatos</button><small>O WhatsApp abre cada conversa com o comprovante preenchido; confirme o envio em cada contato.</small></div>`:'';
  const body=`<div class="receipt-proof-card"><div class="receipt-proof-head"><div><small>COMPROVANTE DE AVARIA</small><strong>PDV ${esc(ctx.customer.code)} • ${esc(ctx.customer.name)}</strong><span>Mapa ${esc(ctx.map_number)} • ${fmtDate(ctx.date)}</span></div><span class="status approved">REGISTRADA</span></div><div class="receipt-products">${(ctx.items||[]).map(x=>`<div><strong>${esc(x.product_name||x.product||'Produto')}</strong><span>${fmtNum(x.quantity)} ${x.unit==='CAIXA'?'Caixa':'Unidade'}${num(x.quantity)===1?'':'s'}</span></div>`).join('')}</div><p class="receipt-observation"><strong>Observação:</strong> O produto avariado será enviado junto ao próximo pedido realizado pelo cliente.</p></div><div class="section-title">WhatsApp do cliente</div>${contactError?`<div class="notice error">${esc(contactError)}</div>`:''}${sendAll}<div class="receipt-contact-list">${contactHtml}</div><div class="contact-last-update">${last?`Atualizado por último em ${fmtDate(last)}`:'Ainda sem atualização de contato.'}</div><div class="manual-contact-card"><strong>Novo contato</strong><small>Se o número não estiver na lista, digite abaixo. Ele será salvo automaticamente para este cliente.</small><div class="grid grid-3"><div class="field span-2"><label>WhatsApp</label><input id="deliveryReceiptNewPhone" inputmode="tel" placeholder="Ex.: (84) 99999-9999"></div><div class="field"><label>Identificação</label><input id="deliveryReceiptNewLabel" placeholder="Ex.: Recebedor"></div></div><div class="actions right"><button type="button" id="btnDeliveryReceiptAddPhone" class="btn secondary">Salvar novo contato</button></div></div>`;
  openModal('Avaria registrada',`Comprovante para ${ctx.customer.name}`,body,[{label:'Fechar',class:'secondary',onClick:closeModal}]);
  $('btnDeliveryReceiptSendAll')?.addEventListener('click',()=>openAllWhatsappReceipts(contacts,ctx));
  $('modalBody')?.querySelectorAll('[data-send-receipt-phone]').forEach(b=>b.addEventListener('click',()=>openWhatsappReceipt(b.dataset.sendReceiptPhone,ctx)));
  $('btnDeliveryReceiptAddPhone')?.addEventListener('click',()=>saveCustomerContactForReceipt(ctx,$('deliveryReceiptNewPhone')?.value||'',$('deliveryReceiptNewLabel')?.value||''));
}

async function submitAvaria(e){
  e.preventDefault();
  let customer=selectedCustomer();
  if(!customer){const code=normalizeCode($('avPdv').value);if(code){try{const found=await fetchCustomersByCode(code);renderDeliveryCustomerMatches(found);customer=selectedCustomer();}catch(err){console.warn('Busca PDV ao salvar avaria',err);}}}
  if(!customer)return toast(currentCustomerMatches().length>1?'Selecione qual cliente corresponde ao PDV informado.':'Informe um PDV válido.','error');
  if(!$('avMapa').value.trim())return toast('Informe o mapa.','error');
  if(!avariaItems.length)return toast('Adicione ao menos um produto avariado.','error');
  if(!signatureDirty)return toast('A assinatura do cliente é obrigatória.','error');
  const btn=$('btnSalvarAvaria');btn.disabled=true;btn.textContent='Enviando…';
  const receiptCtx={customer:{...customer},date:$('avData').value,map_number:$('avMapa').value.trim(),items:avariaItems.map(x=>({product:x.product,product_code:x.product_code,product_name:x.product_name,quantity:x.quantity,unit:x.unit,reason:x.reason}))};
  try{
    const reqKey=uuid(),sigBlob=await canvasBlob($('signatureCanvas'),.82),signaturePath=`${authUser.id}/${reqKey}/assinatura.jpg`;await uploadStorage(signaturePath,sigBlob);
    const uploaded=[];
    for(let i=0;i<avariaItems.length;i++){
      const x=avariaItems[i],photos=[];
      for(let j=0;j<x.photos.length;j++){
        const p=x.photos[j],path=`${authUser.id}/${reqKey}/produto_${String(i+1).padStart(2,'0')}_foto_${String(j+1).padStart(2,'0')}.jpg`;await uploadStorage(path,p.blob);photos.push({photo_path:path,latitude:p.gps.latitude,longitude:p.gps.longitude,accuracy:p.gps.accuracy||'',gps_at:p.gps.capturedAt});
      }
      uploaded.push({...x,photos});
    }
    const payload={date:receiptCtx.date,customer_code:customer.code,customer_name:customer.name,city:customer.city,map_number:receiptCtx.map_number,signature_path:signaturePath,items:uploaded.map(x=>{const first=x.photos[0];return {product:x.product,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photos:x.photos,photo_path:first.photo_path,latitude:first.latitude,longitude:first.longitude,accuracy:first.accuracy,gps_at:first.gps_at};})};
    const {data,error}=await sb.rpc('create_damage_request',{p_payload:payload});if(error)throw error;
    receiptCtx.request_id=data;toast('Avaria registrada com sucesso.','success');clearAvariaRequest();await openDeliveryDamageReceipt(receiptCtx);
  }catch(err){toast(humanDeliveryDamageError(err),'error');}
  finally{btn.disabled=false;btn.textContent='Registrar requisição';}
}

async function loadAdminAvarias(silent=false){
  if(!hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))return;
  try{
    const {data,error}=await sb.from('damage_requests').select('*,damage_items(*,damage_item_photos(*))').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(1000);if(error)throw error;adminAvarias=data||[];
    const lots=[...new Set(adminAvarias.flatMap(r=>r.damage_items||[]).map(i=>String(i.lot||'').toUpperCase()).filter(Boolean))];lotNriMap=new Map();
    if(lots.length){for(const chunk of chunks(lots,100)){const q=await sb.from('nris').select('nri,lot,product_code,product_name,validity_date,unit').eq('unit',activeUnit).in('lot',chunk);if(q.error)throw q.error;(q.data||[]).forEach(n=>{const k=String(n.lot).toUpperCase();if(!lotNriMap.has(k))lotNriMap.set(k,[]);lotNriMap.get(k).push(n);});}}
    renderAdminAvarias();
    if($('badgeAvarias'))$('badgeAvarias').textContent=adminAvarias.filter(r=>(r.damage_items||[]).some(i=>['PENDENTE','APROVADO','LANCADO'].includes(i.status))).length;
  }catch(e){if(!silent)toast(humanDeliveryDamageError(e),'error');}
}
function renderAdminAvarias(){
  const arr=filteredAdminAvarias();
  $('tbodyAvariasAdmin').innerHTML=arr.length?arr.map(r=>{const items=r.damage_items||[],matches=items.filter(i=>lotNriMap.has(deliveryDamageLotKey(i))).length,photos=items.reduce((n,i)=>n+itemEvidencePhotos(i).length,0);return `<tr><td>${fmtDate(r.occurrence_date)}<strong>PDV ${esc(r.customer_code)} • ${esc(r.customer_name)}</strong><small>${esc(r.city)} • Mapa ${esc(r.map_number)}</small></td><td>${esc(r.delivery_name)}</td><td><strong>${items.length} produto(s)</strong><small>${photos} foto(s)</small></td><td>${matches===items.length&&items.length?'<span class="status approved">Todos compatíveis</span>':matches?'<span class="status partial">Parcial</span>':'<span class="status rejected">Não encontrados</span>'}</td><td>${statusBadge(r.status)}</td><td><button class="mini-btn" data-id="${r.id}">Visualizar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhuma avaria.</td></tr>';
}
function selectedDeliveryDamageIds(kind){return [...($('modalBody')?.querySelectorAll(`.delivery-review-check[data-review-kind="${kind}"]:checked`)||[])].map(x=>x.value);}
async function showAvariaDetail(id){
  const r=adminAvarias.find(x=>x.id===id);if(!r)return;currentAvariaDetail=r;const items=[...(r.damage_items||[])].sort((a,b)=>Number(a.item_order||0)-Number(b.item_order||0));
  const paths=[r.signature_path,...items.flatMap(i=>itemEvidencePhotos(i).map(p=>p.photo_path))].filter(Boolean);
  const signedPairs=await Promise.all(paths.map(async path=>{const {data}=await sb.storage.from('avarias').createSignedUrl(path,3600);return [path,data?.signedUrl||''];}));
  const signed=new Map(signedPairs),signatureUrl=signed.get(r.signature_path)||'',canReview=hasPerm('DELIVERY_DAMAGE_REVIEW'),canPost=hasPerm('DELIVERY_DAMAGE_POST');
  const productsHtml=items.map((i,idx)=>{
    const match=lotNriMap.get(deliveryDamageLotKey(i))||[],photos=itemEvidencePhotos(i),reviewable=canReview&&i.status==='PENDENTE',launchable=canPost&&i.status==='APROVADO',deliverable=canPost&&i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||''),selectable=reviewable||launchable||deliverable,kind=reviewable?'review':launchable?'launch':deliverable?'deliver':'';
    const photoHtml=photos.map((p,pidx)=>`<div class="damage-photo-card"><div class="damage-photo-title"><strong>Foto ${pidx+1}</strong><span class="status approved">GPS ✓</span></div><img src="${esc(signed.get(p.photo_path)||'')}" alt="Foto ${pidx+1} da avaria"><iframe class="map-frame" src="https://www.google.com/maps?q=${encodeURIComponent(p.latitude+','+p.longitude)}&output=embed" loading="lazy"></iframe><small>GPS: ${p.latitude}, ${p.longitude} • ±${Math.round(p.gps_accuracy||0)} m</small></div>`).join('');
    const decision=i.reviewed_at?`<div class="sales-decision ${i.status==='REPROVADO'?'rejected':'approved'}"><strong>Decisão</strong><span>${esc(i.reviewer_name||'—')} • ${fmtDateTime(i.reviewed_at)}</span><p>${esc(i.review_note||'Sem justificativa registrada.')}</p></div>`:'';
    const launched=i.launched_at?`<div class="sales-decision launched"><strong>Lançado no Sistema</strong><span>${esc(i.launched_by_name||'—')} • ${fmtDateTime(i.launched_at)}</span></div>`:'';
    const delivered=i.delivered_at?`<div class="sales-decision delivered"><strong>Entregue</strong><span>${esc(i.delivered_by_name||'—')} • ${fmtDateTime(i.delivered_at)}</span></div>`:'';
    const postAction=launchable?`<div class="sales-launch-action"><button type="button" class="delivery-launch-btn" data-delivery-launch="${i.id}"><span>✓ Registrar como lançado no sistema</span><small>Confirme depois de lançar esta avaria no sistema</small></button></div>`:deliverable?`<div class="sales-launch-action"><button type="button" class="delivery-delivered-btn" data-delivery-delivered="${i.id}"><span>✓ Marcar como entregue</span><small>Somente o usuário que registrou o lançamento pode confirmar a entrega</small></button></div>`:(canPost&&i.status==='LANCADO'?`<div class="sales-launch-help"><strong>Aguardando o usuário do lançamento</strong><small>${esc(i.launched_by_name||'Outro usuário')} deve marcar esta avaria como entregue.</small></div>`:'');
    return `<div class="damage-admin-item" data-item="${i.id}"><div class="damage-product-head">${selectable?`<label class="damage-check"><input type="checkbox" class="delivery-review-check" value="${i.id}" data-review-kind="${kind}"><span></span></label>`:''}<div><small>PRODUTO ${idx+1}</small><strong>${esc(i.product_text)}</strong></div>${statusBadge(i.status)}</div><div class="damage-summary-grid"><div><small>LOTE</small><strong>${esc(i.lot)}</strong></div><div><small>QUANTIDADE</small><strong>${fmtNum(i.quantity)} ${esc(i.quantity_unit)}</strong></div><div><small>MOTIVO</small><strong>${esc(i.reason)}</strong></div><div><small>EVIDÊNCIAS</small><strong>${photos.length} foto(s)</strong></div></div><div class="damage-lot-row">${match.length?`<span class="status approved">Lote compatível</span><span>${match.slice(0,4).map(n=>esc(n.nri)).join(', ')}</span>`:'<span class="status rejected">Lote não encontrado</span>'}</div><details class="damage-evidence"><summary><span>Ver evidências</span><small>${photos.length} foto(s) • localização por foto</small></summary><div class="damage-photo-grid">${photoHtml||'<div class="empty-state">Sem foto disponível.</div>'}</div></details>${postAction}${decision}${launched}${delivered}</div>`;
  }).join('');
  const pending=items.filter(i=>i.status==='PENDENTE').length,approved=items.filter(i=>i.status==='APROVADO').length,launched=items.filter(i=>i.status==='LANCADO').length,canDeliverCount=items.filter(i=>i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||'')).length,selectableCount=(canReview?pending:0)+(canPost?approved+canDeliverCount:0);
  const body=`<div class="damage-request-hero"><div><small>OCORRÊNCIA</small><strong>PDV ${esc(r.customer_code)} · ${esc(r.customer_name)}</strong><span>${esc(r.city)} • Mapa ${esc(r.map_number)} • ${esc(r.delivery_name)}</span></div><div class="damage-counts"><b>${items.length}</b><span>produtos</span><b>${pending+approved+launched}</b><span>em fluxo</span></div></div><div class="detail-grid damage-request-grid"><div class="detail-card"><small>PDV</small><strong>${esc(r.customer_name)}</strong></div><div class="detail-card"><small>Código</small><strong>${esc(r.customer_code)}</strong></div><div class="detail-card"><small>Cidade</small><strong>${esc(r.city)}</strong></div><div class="detail-card"><small>Mapa</small><strong>${esc(r.map_number)}</strong></div><div class="detail-card"><small>Motorista</small><strong>${esc(r.delivery_name)}</strong></div></div>${selectableCount?`<div class="damage-selection-bar delivery-selection-bar"><label class="check delivery-select-all"><input id="deliveryDamageSelectAll" type="checkbox"> Selecionar tudo</label><span id="avariaSelectionSummary">0 selecionados</span><small>${pending&&canReview?'Pendentes: aprovação ou reprovação. ':''}${approved&&canPost?'Aprovados: prontos para lançamento. ':''}${canDeliverCount&&canPost?'Lançados por você: prontos para marcar como entregues.':''}</small></div>`:''}${pending&&canReview?`<div class="sales-review-justification"><div class="field"><label>Justificativa da decisão *</label><textarea id="deliveryDamageDecisionJustification" rows="3" maxlength="500" placeholder="Descreva o motivo da aprovação ou reprovação."></textarea></div></div>`:''}${productsHtml}<details class="signature-details"><summary>Ver assinatura do cliente</summary><img src="${esc(signatureUrl)}" alt="Assinatura"></details>`;
  const actions=[];
  if(canReview&&pending)actions.push({label:'Reprovar selecionados',class:'danger',onClick:()=>reviewAvaria('REPROVADO',false)},{label:'Aprovar selecionados',class:'success',onClick:()=>reviewAvaria('APROVADO',false)});
  if(canPost&&approved)actions.push({label:'✓ Marcar como lançada',class:'success delivery-modal-action delivery-modal-launch',onClick:markDeliveryDamageLaunchedBulk});
  if(canPost&&canDeliverCount)actions.push({label:'✓ Marcar como entregue',class:'primary delivery-modal-action delivery-modal-deliver',onClick:markDeliveryDamageDeliveredBulk});
  openModal(`Avaria • PDV ${r.customer_code}`,`${fmtDate(r.occurrence_date)} • ${r.delivery_name}`,body,actions);
  const checks=[...($('modalBody')?.querySelectorAll('.delivery-review-check')||[])],selectAll=$('deliveryDamageSelectAll');const update=()=>{const n=checks.filter(x=>x.checked).length;const el=$('avariaSelectionSummary');if(el)el.textContent=`${n} selecionado${n===1?'':'s'}`;if(selectAll){selectAll.checked=checks.length>0&&n===checks.length;selectAll.indeterminate=n>0&&n<checks.length;}};checks.forEach(c=>c.addEventListener('change',update));selectAll?.addEventListener('change',()=>{checks.forEach(c=>c.checked=selectAll.checked);update();});
  $('modalBody')?.querySelectorAll('[data-delivery-launch]').forEach(b=>b.addEventListener('click',()=>markDeliveryDamageLaunched(b.dataset.deliveryLaunch)));
  $('modalBody')?.querySelectorAll('[data-delivery-delivered]').forEach(b=>b.addEventListener('click',()=>markDeliveryDamageDelivered(b.dataset.deliveryDelivered)));
}
async function reviewAvaria(status,all=false){
  if(!currentAvariaDetail)return;let ids=all?(currentAvariaDetail.damage_items||[]).filter(i=>i.status==='PENDENTE').map(i=>i.id):selectedDeliveryDamageIds('review');if(!ids.length)return toast('Selecione ao menos um produto pendente.','error');
  const note=String($('deliveryDamageDecisionJustification')?.value||'').trim();if(!note)return toast('Informe a justificativa da decisão.','error');
  try{const {error}=await sb.rpc('review_damage_items',{p_item_ids:ids,p_status:status,p_note:note});if(error)throw error;toast(`${ids.length} produto(s) ${status==='APROVADO'?'aprovado(s)':'reprovado(s)'}.`,'success');closeModal();await loadAdminAvarias(true);}catch(e){toast(humanDeliveryDamageError(e),'error');}
}
async function markDeliveryDamageLaunched(itemId){
  if(!hasPerm('DELIVERY_DAMAGE_POST'))return toast('Seu usuário não possui permissão para registrar o lançamento.','error');if(!confirm('Confirmar que esta avaria foi lançada no sistema?'))return;
  try{const {error}=await sb.rpc('mark_damage_item_launched',{p_item_id:itemId});if(error)throw error;toast('Avaria marcada como Lançada no Sistema.','success');const id=currentAvariaDetail?.id;closeModal();await loadAdminAvarias(true);if(id)await showAvariaDetail(id);}catch(e){toast(humanDeliveryDamageError(e),'error');}
}
async function markDeliveryDamageLaunchedBulk(){
  const ids=selectedDeliveryDamageIds('launch');if(!ids.length)return toast('Selecione ao menos um produto aprovado.','error');if(!confirm(`Confirmar o lançamento de ${ids.length} produto(s) no sistema?`))return;
  try{for(const id of ids){const {error}=await sb.rpc('mark_damage_item_launched',{p_item_id:id});if(error)throw error;}toast(`${ids.length} produto(s) marcado(s) como Lançado no Sistema.`,'success');const req=currentAvariaDetail?.id;closeModal();await loadAdminAvarias(true);if(req)await showAvariaDetail(req);}catch(e){toast(humanDeliveryDamageError(e),'error');}
}
async function markDeliveryDamageDelivered(itemId){
  if(!hasPerm('DELIVERY_DAMAGE_POST'))return toast('Seu usuário não possui permissão para confirmar a entrega.','error');if(!confirm('Confirmar que esta avaria foi entregue ao cliente?'))return;
  try{const {error}=await sb.rpc('mark_damage_item_delivered',{p_item_id:itemId});if(error)throw error;toast('Avaria marcada como Entregue.','success');const id=currentAvariaDetail?.id;closeModal();await loadAdminAvarias(true);if(id)await showAvariaDetail(id);}catch(e){toast(humanDeliveryDamageError(e),'error');}
}
async function markDeliveryDamageDeliveredBulk(){
  const ids=selectedDeliveryDamageIds('deliver');if(!ids.length)return toast('Selecione ao menos um produto lançado por você.','error');if(!confirm(`Confirmar a entrega de ${ids.length} produto(s)?`))return;
  try{for(const id of ids){const {error}=await sb.rpc('mark_damage_item_delivered',{p_item_id:id});if(error)throw error;}toast(`${ids.length} produto(s) marcado(s) como Entregue.`,'success');const req=currentAvariaDetail?.id;closeModal();await loadAdminAvarias(true);if(req)await showAvariaDetail(req);}catch(e){toast(humanDeliveryDamageError(e),'error');}
}
function humanDeliveryDamageError(e){
  const m=String(e?.message||e||'Erro em Avarias de Entrega');const map={JUSTIFICATIVA_OBRIGATORIA:'Informe a justificativa da decisão.',NENHUM_ITEM_PENDENTE:'Nenhum produto pendente foi selecionado.',ITEM_NAO_APROVADO:'Somente avarias aprovadas podem ser marcadas como lançadas.',ITEM_NAO_LANCADO:'Somente avarias lançadas podem ser marcadas como entregues.',SOMENTE_USUARIO_LANCAMENTO:'Somente o usuário que marcou a avaria como lançada pode confirmar a entrega.',FORBIDDEN:'Seu usuário não possui permissão para esta ação.'};const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];if(/mark_damage_item_launched|mark_damage_item_delivered|delivery_damage_items/i.test(m))return 'A atualização do fluxo de Avarias ainda não foi aplicada no Supabase. Execute o SQL 24_v1_5_1_fluxo_avarias_comprovante_contatos_nri.sql.';return humanError(e);
}

function salesDamageStatusLabel(status){return ({PENDENTE:'Pendente',EM_ANALISE:'Em análise',PARCIAL:'Parcial',APROVADO:'Aprovado',REPROVADO:'Reprovado',LANCADO:'Lançado no Sistema',ENTREGUE:'Entregue'})[status]||status||'—';}
function salesItemStatusBadge(i){return statusBadge(i.status);}
function salesRequestItemsSummary(r){const items=r.sales_damage_items||[],counts={};items.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);const open=(counts.PENDENTE||0)+(counts.EM_ANALISE||0)+(counts.APROVADO||0)+(counts.LANCADO||0);return `<strong>${items.length} produto(s)</strong><small>${open?`${open} aguardando conclusão`:'Fluxo concluído'}</small>`;}
async function loadSalesDamageManage(silent=false){
  if(!hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST'))return;
  try{const {data,error}=await sb.from('sales_damage_requests').select('*,sales_damage_items(*,sales_damage_item_photos(*))').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(2000);if(error)throw error;salesDamageManageRequests=data||[];renderSalesDamageManage();if($('badgeSalesDamage'))$('badgeSalesDamage').textContent=salesDamageManageRequests.filter(r=>(r.sales_damage_items||[]).some(i=>['PENDENTE','EM_ANALISE','APROVADO','LANCADO'].includes(i.status))).length;}catch(e){if(!silent)toast(humanSalesDamageError(e),'error');}
}
async function showSalesDamageDetail(id){
  try{
    let r=salesDamageFindRequest(id);if(!r){const q=await sb.from('sales_damage_requests').select('*,sales_damage_items(*,sales_damage_item_photos(*))').eq('id',id).single();if(q.error)throw q.error;r=q.data;}currentSalesDamageDetail=r;
    const items=[...(r.sales_damage_items||[])].sort((a,b)=>Number(a.item_order||0)-Number(b.item_order||0)),signedByItem=new Map();
    for(const i of items){const photos=salesDamageItemPhotos(i);const signed=await Promise.all(photos.map(async ph=>{const {data}=await sb.storage.from('avarias-vendas').createSignedUrl(ph.photo_path,3600);return {...ph,url:data?.signedUrl||''};}));signedByItem.set(i.id,signed);}
    const canReview=hasPerm('SALES_DAMAGE_REVIEW'),canFinalize=hasPerm('SALES_DAMAGE_OVERRIDE'),canPost=hasPerm('SALES_DAMAGE_POST'),sellerView=activeView==='sales-avaria-minhas';
    const products=items.map((i,idx)=>{
      const reviewable=!sellerView&&canReview&&i.status==='PENDENTE',finalizable=!sellerView&&canFinalize&&(i.status==='PENDENTE'||i.status==='EM_ANALISE'),launchable=!sellerView&&canPost&&i.status==='APROVADO',deliverable=!sellerView&&canPost&&i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||''),selectable=reviewable||finalizable||launchable||deliverable,selectionKind=finalizable&&!reviewable?'final':reviewable?'pending':launchable?'launch':deliverable?'delivered':'',photos=signedByItem.get(i.id)||[],allGps=photos.length>0&&photos.every(p=>p.latitude!=null&&p.longitude!=null&&Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));
      const gallery=photos.map((p,pidx)=>`<a href="${esc(p.url||'#')}" target="_blank" rel="noopener"><img src="${esc(p.url||'')}" alt="Foto ${pidx+1} do produto ${idx+1}"><span>Foto ${pidx+1}${p.latitude!=null&&p.longitude!=null?` • GPS ${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}${p.accuracy!=null?` • ±${Math.round(Number(p.accuracy)||0)} m`:''}`:' • GPS não registrado'}</span></a>`).join('');
      const managerDecision=!sellerView&&i.reviewed_at?`<div class="sales-decision ${i.status==='REPROVADO'&&!i.final_reviewed_at?'rejected':'approved'}"><strong>Decisão do Gerente de Vendas</strong><span>${esc(i.reviewer_name||'—')} • ${fmtDateTime(i.reviewed_at)}</span><p>${esc(i.review_justification||'Sem justificativa registrada.')}</p></div>`:'';
      const finalDecision=!sellerView&&i.final_reviewed_at?`<div class="sales-decision ${i.status==='REPROVADO'?'rejected':'approved'}"><strong>Decisão final</strong><span>${esc(i.final_reviewer_name||'—')} • ${fmtDateTime(i.final_reviewed_at)}</span><p>${esc(i.final_justification||'Sem justificativa registrada.')}</p></div>`:'';
      const launched=!sellerView&&i.launched_at?`<div class="sales-decision launched"><strong>Lançado no Sistema</strong><span>${esc(i.launched_by_name||'—')} • ${fmtDateTime(i.launched_at)}</span></div>`:'';
      const delivered=!sellerView&&i.delivered_at?`<div class="sales-decision delivered"><strong>Entregue</strong><span>${esc(i.delivered_by_name||'—')} • ${fmtDateTime(i.delivered_at)}</span></div>`:'';
      const postAction=launchable?`<div class="sales-launch-action"><button type="button" class="sales-launch-btn" data-sales-launch="${i.id}"><span>✓ Registrar avaria como lançada no sistema</span><small>Toque aqui após registrar esta avaria no sistema</small></button></div>`:deliverable?`<div class="sales-launch-action"><button type="button" class="sales-delivered-btn" data-sales-delivered="${i.id}"><span>✓ Marcar avaria como entregue</span><small>Somente o usuário do lançamento pode confirmar a entrega</small></button></div>`:(!sellerView&&canPost&&i.status==='LANCADO'?`<div class="sales-launch-help"><strong>Aguardando o usuário do lançamento</strong><small>${esc(i.launched_by_name||'Outro usuário')} deve confirmar a entrega.</small></div>`:'');
      return `<article class="damage-admin-item sales-review-item" data-sales-detail-item="${i.id}"><div class="damage-product-head">${selectable?`<label class="damage-check"><input type="checkbox" class="sales-review-check" value="${i.id}" data-review-kind="${selectionKind}"><span></span></label>`:''}<div><small>PRODUTO ${idx+1}</small><strong>${esc(i.product_text)}</strong></div>${salesItemStatusBadge(i)}</div><div class="damage-summary-grid"><div><small>QUANTIDADE</small><strong>${fmtNum(i.quantity)} ${i.quantity_unit==='CAIXA'?'Caixa':'Unidade'}${num(i.quantity)===1?'':'s'}</strong></div><div><small>MOTIVO</small><strong>${esc(salesReasonLabel(i.reason))}</strong></div><div><small>VALIDADE</small><strong>${i.validity_date?fmtDate(i.validity_date):'—'}</strong></div><div><small>EVIDÊNCIA</small><strong>${photos.length} foto${photos.length===1?'':'s'} • ${allGps?'GPS ✓':'GPS legado/indisponível'}</strong></div></div><div class="sales-proof sales-proof-multi">${gallery||'<span class="muted-text">Sem foto disponível.</span>'}</div>${postAction}${managerDecision}${finalDecision}${launched}${delivered}</article>`;
    }).join('');
    const pending=items.filter(i=>i.status==='PENDENTE').length,analysis=items.filter(i=>i.status==='EM_ANALISE').length,approved=items.filter(i=>i.status==='APROVADO').length,launched=items.filter(i=>i.status==='LANCADO').length,deliverable=items.filter(i=>i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||'')).length,selectableCount=sellerView?0:items.filter(i=>((canReview||canFinalize)&&i.status==='PENDENTE')||(canFinalize&&i.status==='EM_ANALISE')||(canPost&&i.status==='APROVADO')||(canPost&&i.status==='LANCADO'&&String(i.launched_by||'')===String(authUser?.id||''))).length;
    const needsJustification=!sellerView&&((canReview&&pending)||(canFinalize&&(pending||analysis)));
    const requestObservation=String(r.observation||'').trim();
    const observationHtml=requestObservation?`<div class="sales-request-observation-card"><div><small>OBSERVAÇÃO DO VENDEDOR</small><strong>Informação para análise</strong></div><p>${esc(requestObservation)}</p></div>`:'';
    const body=`<div class="damage-request-hero sales-request-hero"><div><small>${esc(r.request_code)}</small><strong>PDV ${esc(r.customer_code)} · ${esc(r.customer_name)}</strong><span>${esc(r.city||'—')} • ${esc(r.branch||'—')} • Vendedor: ${esc(r.seller_name)}</span></div><div class="damage-counts"><b>${items.length}</b><span>produtos</span><b>${pending+analysis+approved+launched}</b><span>em fluxo</span></div></div><div class="detail-grid damage-request-grid"><div class="detail-card"><small>Data</small><strong>${fmtDate(r.occurrence_date)}</strong></div><div class="detail-card"><small>Vendedor</small><strong>${esc(r.seller_name)}</strong></div><div class="detail-card"><small>Código PDV</small><strong>${esc(r.customer_code)}</strong></div><div class="detail-card"><small>Filial</small><strong>${esc(r.branch||'—')}</strong></div></div>${observationHtml}${selectableCount?`<div class="damage-selection-bar sales-selection-bar"><label class="check sales-select-all"><input id="salesDamageSelectAll" type="checkbox"> Selecionar tudo</label><span id="salesDamageSelectionSummary">0 selecionados</span><small>${pending&&canReview&&canFinalize?'Pendentes: GV ou decisão final direta. ':pending&&canReview?'Pendentes: decisão do Gerente de Vendas. ':pending&&canFinalize?'Pendentes: decisão final direta disponível. ':''}${analysis&&canFinalize?'Em análise: decisão final. ':''}${approved&&canPost?'Aprovados: prontos para lançamento. ':''}${deliverable&&canPost?'Lançados por você: prontos para entrega.':''}</small></div>`:''}${needsJustification?`<div class="sales-review-justification"><div class="field"><label>Justificativa da decisão *</label><textarea id="salesDamageDecisionJustification" rows="3" maxlength="500" placeholder="Descreva o motivo da aprovação ou reprovação."></textarea><small>A justificativa fica registrada na auditoria da solicitação.</small></div></div>`:''}${products}`;
    const actions=[];if(!sellerView&&canReview&&pending)actions.push({label:'GV • Reprovar selecionados',class:'danger',onClick:()=>reviewSalesDamage('REPROVADO')},{label:'GV • Aprovar selecionados',class:'success',onClick:()=>reviewSalesDamage('APROVADO')});if(!sellerView&&canFinalize&&(pending||analysis))actions.push({label:'Final • Reprovar selecionados',class:'danger',onClick:()=>finalizeSalesDamage('REPROVADO')},{label:'Final • Aprovar selecionados',class:'success',onClick:()=>finalizeSalesDamage('APROVADO')});if(!sellerView&&canPost&&approved)actions.push({label:'✓ Marcar selecionados como lançados',class:'success',onClick:markSalesDamageLaunchedBulk});if(!sellerView&&canPost&&deliverable)actions.push({label:'✓ Marcar selecionados como entregues',class:'primary',onClick:markSalesDamageDeliveredBulk});
    openModal(`Avaria de Vendas • ${r.request_code}`,`${fmtDate(r.occurrence_date)} • ${r.seller_name} • ${salesDamageStatusLabel(r.status)}`,body,actions);
    const checks=[...($('modalBody')?.querySelectorAll('.sales-review-check')||[])],selectAll=$('salesDamageSelectAll');const update=()=>{const n=checks.filter(x=>x.checked).length;if($('salesDamageSelectionSummary'))$('salesDamageSelectionSummary').textContent=`${n} selecionado${n===1?'':'s'}`;if(selectAll){selectAll.checked=checks.length>0&&n===checks.length;selectAll.indeterminate=n>0&&n<checks.length;}};checks.forEach(x=>x.addEventListener('change',update));selectAll?.addEventListener('change',()=>{checks.forEach(x=>x.checked=selectAll.checked);update();});$('modalBody')?.querySelectorAll('[data-sales-launch]').forEach(b=>b.addEventListener('click',()=>markSalesDamageLaunched(b.dataset.salesLaunch)));$('modalBody')?.querySelectorAll('[data-sales-delivered]').forEach(b=>b.addEventListener('click',()=>markSalesDamageDelivered(b.dataset.salesDelivered)));
  }catch(e){toast(humanSalesDamageError(e),'error');}
}
async function markSalesDamageDelivered(itemId){
  if(!hasPerm('SALES_DAMAGE_POST'))return toast('Seu usuário não possui permissão para confirmar a entrega.','error');if(!confirm('Confirmar que esta avaria foi entregue ao cliente?'))return;
  try{const {error}=await sb.rpc('mark_sales_damage_item_delivered',{p_item_id:itemId});if(error)throw error;toast('Produto marcado como Entregue.','success');const requestId=currentSalesDamageDetail?.id;closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);if(requestId)await showSalesDamageDetail(requestId);}catch(e){toast(humanSalesDamageError(e),'error');}
}
async function markSalesDamageDeliveredBulk(){
  const ids=selectedSalesReviewIds('delivered');if(!ids.length)return toast('Selecione ao menos um produto lançado por você.','error');if(!confirm(`Confirmar a entrega de ${ids.length} produto(s)?`))return;
  try{for(const itemId of ids){const {error}=await sb.rpc('mark_sales_damage_item_delivered',{p_item_id:itemId});if(error)throw error;}toast(`${ids.length} produto(s) marcado(s) como Entregue.`,'success');const requestId=currentSalesDamageDetail?.id;closeModal();await loadSalesDamageManage(true);if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);if(requestId)await showSalesDamageDetail(requestId);}catch(e){toast(humanSalesDamageError(e),'error');}
}
function humanSalesDamageError(e){
  const m=String(e?.message||e||'Erro em Avarias de Vendas');const map={PDV_INVALIDO:'PDV inválido ou não localizado.',PRODUTO_OBRIGATORIO:'Adicione ao menos um produto avariado.',QUANTIDADE_INVALIDA:'Informe uma quantidade maior que zero.',UNIDADE_INVALIDA:'Selecione Caixa ou Unidade.',MOTIVO_OBRIGATORIO:'Informe o motivo da avaria.',VALIDADE_OBRIGATORIA:'Para o motivo Validade, informe a data de validade.',FOTO_OBRIGATORIA:'Cada produto precisa de ao menos uma foto.',FOTOS_EXCEDIDAS:'Validade permite até 2 fotos; os demais motivos permitem 1 foto.',GPS_FOTO_OBRIGATORIO:'Todas as fotos precisam de localização GPS.',OBSERVACAO_EXCEDIDA:'A observação deve ter no máximo 500 caracteres.',JUSTIFICATIVA_OBRIGATORIA:'A justificativa é obrigatória para esta decisão.',NENHUM_ITEM_PENDENTE:'Nenhum dos produtos selecionados está pendente.',NENHUM_ITEM_EM_ANALISE:'Selecione ao menos um produto em análise.',NENHUM_ITEM_FINALIZAVEL:'Selecione ao menos um produto pendente ou em análise.',ITEM_NAO_APROVADO:'Somente produtos aprovados podem ser marcados como lançados.',ITEM_NAO_LANCADO:'Somente produtos lançados podem ser marcados como entregues.',SOMENTE_USUARIO_LANCAMENTO:'Somente o usuário que marcou a avaria como lançada pode confirmar a entrega.',FORBIDDEN:'Seu usuário não possui permissão para esta ação.'};const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];if(/mark_sales_damage_item_delivered|delivered_at|sales_damage_item_photos|finalize_sales_damage_items|mark_sales_damage_item_launched/i.test(m))return 'A atualização do fluxo completo de Avarias ainda não foi aplicada no Supabase. Execute o SQL 24_v1_5_1_fluxo_avarias_comprovante_contatos_nri.sql.';if(/sales_damage|avarias-vendas|relation .*does not exist/i.test(m))return 'O módulo Avarias de Vendas ainda não foi criado no Supabase. Execute os SQLs anteriores e depois o SQL 24.';return humanError(e);
}

async function loadCustomerContactAdmin(silent=false){
  if(!hasPerm('ADMIN_BASES'))return;
  try{
    customerContactRows=await fetchReferencePages(()=>sb.from('customer_contacts').select('id,customer_id,customer_code,phone_normalized,label,source,updated_at,updated_by_name').order('updated_at',{ascending:false}),10000);
    renderCustomerContactAdmin();
  }catch(e){if(!silent)toast(humanCustomerContactError(e),'error');}
}
function customerContactsForCustomer(id){return customerContactRows.filter(x=>String(x.customer_id)===String(id));}
function customerContactLastUpdated(rows){return rows.reduce((max,x)=>!max||String(x.updated_at)>String(max)?x.updated_at:max,'');}
function renderCustomerContactAdmin(){
  const body=$('tbodyCustomerContacts');if(!body)return;const q=norm($('customerContactSearch')?.value||'');
  let customers=refs.customers.filter(c=>{const contacts=customerContactsForCustomer(c.id),hay=[c.code,c.name,c.city,c.branch,...contacts.map(x=>formatWhatsappPhone(x.phone_normalized))].join(' ');return !q||norm(hay).includes(q);});
  if(!q)customers=customers.filter(c=>customerContactsForCustomer(c.id).length).slice(0,300);else customers=customers.slice(0,300);
  body.innerHTML=customers.length?customers.map(c=>{const contacts=customerContactsForCustomer(c.id),last=customerContactLastUpdated(contacts),phones=contacts.length?contacts.map(x=>`<span class="contact-phone-chip">${esc(formatWhatsappPhone(x.phone_normalized))}</span>`).join(' '):'<span class="muted-text">Sem contato</span>';return `<tr><td><strong>${esc(c.code)}</strong></td><td><strong>${esc(c.name)}</strong></td><td>${esc(c.city||'—')}<small>${esc(c.branch||'—')}</small></td><td><div class="contact-phone-list">${phones}</div></td><td>${last?`Atualizado por último em <strong>${fmtDate(last)}</strong>`:'—'}</td><td><button type="button" class="mini-btn" data-customer-contact-manage="${esc(c.id)}">Gerenciar</button></td></tr>`;}).join(''):'<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';
}
function onCustomerContactAdminClick(e){const b=e.target.closest('[data-customer-contact-manage]');if(b)openCustomerContactAdmin(b.dataset.customerContactManage);}
function customerRefById(id){return refs.customers.find(c=>String(c.id)===String(id));}
async function openCustomerContactAdmin(customerId){
  const c=customerRefById(customerId);if(!c)return toast('Cliente não encontrado na base carregada.','error');const contacts=customerContactsForCustomer(customerId),last=customerContactLastUpdated(contacts);
  const rows=contacts.length?contacts.map(x=>`<div class="admin-contact-row"><div><strong>${esc(x.label||'Contato')}</strong><span>${esc(formatWhatsappPhone(x.phone_normalized))}</span><small>${esc(x.source||'APP')} • atualizado por ${esc(x.updated_by_name||'—')} em ${fmtDate(x.updated_at)}</small></div><button type="button" class="mini-btn danger" data-contact-delete="${x.id}">Excluir</button></div>`).join(''):'<div class="empty-state">Este cliente ainda não possui contato cadastrado.</div>';
  const body=`<div class="detail-grid"><div class="detail-card"><small>PDV</small><strong>${esc(c.code)}</strong></div><div class="detail-card"><small>Cliente</small><strong>${esc(c.name)}</strong></div><div class="detail-card"><small>Cidade</small><strong>${esc(c.city||'—')}</strong></div><div class="detail-card"><small>Última atualização</small><strong>${last?fmtDate(last):'—'}</strong></div></div><div class="section-title">WhatsApp(s)</div><div class="admin-contact-list">${rows}</div><div class="manual-contact-card"><strong>Adicionar / atualizar contato</strong><div class="grid grid-3"><div class="field span-2"><label>WhatsApp</label><input id="adminCustomerContactPhone" inputmode="tel" placeholder="DDD + telefone"></div><div class="field"><label>Identificação</label><input id="adminCustomerContactLabel" placeholder="Ex.: Financeiro"></div></div><div class="actions right"><button type="button" id="btnAdminCustomerContactSave" class="btn primary">Salvar contato</button></div></div>`;
  openModal(`Contatos • PDV ${c.code}`,c.name,body,[{label:'Fechar',class:'secondary',onClick:closeModal}]);
  $('btnAdminCustomerContactSave')?.addEventListener('click',async()=>{const phone=$('adminCustomerContactPhone')?.value||'',label=$('adminCustomerContactLabel')?.value||'';const normalized=normalizeWhatsappPhone(phone);if(!normalized)return toast('Informe um telefone válido com DDD.','error');try{const {error}=await sb.rpc('save_customer_contact',{p_customer_id:c.id,p_customer_code:c.code,p_phone:normalized,p_label:String(label).trim()});if(error)throw error;toast('Contato salvo.','success');await loadCustomerContactAdmin(true);await openCustomerContactAdmin(c.id);}catch(e){toast(humanCustomerContactError(e),'error');}});
  $('modalBody')?.querySelectorAll('[data-contact-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Excluir este contato do cliente?'))return;try{const {error}=await sb.rpc('delete_customer_contact',{p_contact_id:b.dataset.contactDelete});if(error)throw error;toast('Contato excluído.','success');await loadCustomerContactAdmin(true);await openCustomerContactAdmin(c.id);}catch(e){toast(humanCustomerContactError(e),'error');}}));
}
function humanCustomerContactError(e){
  const m=String(e?.message||e||'Erro nos contatos de clientes');const map={TELEFONE_INVALIDO:'Informe um telefone válido com DDD.',CLIENTE_NAO_ENCONTRADO:'Cliente não encontrado.',FORBIDDEN:'Seu usuário não possui permissão para alterar este contato.'};const key=Object.keys(map).find(k=>m.includes(k));if(key)return map[key];if(/customer_contacts|save_customer_contact|delete_customer_contact/i.test(m))return 'A base de contatos ainda não foi criada no Supabase. Execute o SQL 24_v1_5_1_fluxo_avarias_comprovante_contatos_nri.sql.';return humanError(e);
}

// V1.6.0 - OFFLINE-FIRST + CORRECOES OPERACIONAIS ----------------------------
const OFFLINE_DB_NAME='disb_gestao_offline_v160';
const OFFLINE_DB_VERSION=1;
const OFFLINE_PROFILE_KEY='disb_profile_cache_v160';

const OFFLINE_PERMS_KEY='disb_permissions_cache_v160';

const OFFLINE_AUTH_KEY=
  'disb_offline_auth_v171';

const OFFLINE_UNIT_CACHE_PREFIX=
  'disb_units_cache_v171_';

const OFFLINE_AUTH_MAX_AGE_MS=
  14*24*60*60*1000;


function offlineReadIdentityV171(){

  try{

    const row=
      JSON.parse(
        localStorage.getItem(
          OFFLINE_AUTH_KEY
        )
        ||
        'null'
      );

    if(
      !row?.user_id
      ||
      !row?.at
    ){
      return null;
    }

    if(
      Date.now()
      -
      Number(row.at)
      >
      OFFLINE_AUTH_MAX_AGE_MS
    ){
      return null;
    }

    return row;

  }
  catch(_e){

    return null;

  }
}


function offlineRememberIdentityV171(
  user,
  username=''
){

  if(!user?.id)return;

  try{

    localStorage.setItem(
      OFFLINE_AUTH_KEY,
      JSON.stringify({
        user_id:
          String(user.id),

        email:
          String(
            user.email||''
          ),

        username:
          normalizeUsername(
            username
            ||
            profile?.username
            ||
            ''
          ),

        at:
          Date.now()
      })
    );

  }
  catch(_e){}
}


function offlineClearIdentityV171(){

  try{

    localStorage.removeItem(
      OFFLINE_AUTH_KEY
    );

  }
  catch(_e){}
}


function offlineUnitCacheKeyV171(
  userId=authUser?.id
){

  return (
    OFFLINE_UNIT_CACHE_PREFIX
    +
    String(userId||'anon')
  );

}


function offlineReadUnitAccessV171(
  userId=authUser?.id
){

  try{

    const row=
      JSON.parse(
        localStorage.getItem(
          offlineUnitCacheKeyV171(
            userId
          )
        )
        ||
        'null'
      );

    if(
      !row
      ||
      !Array.isArray(row.units)
    ){
      return null;
    }

    return row;

  }
  catch(_e){

    return null;

  }
}


function offlineSaveUnitAccessV171(
  units
){

  try{

    localStorage.setItem(
      offlineUnitCacheKeyV171(),
      JSON.stringify({
        user_id:
          authUser?.id||'',

        units:[
          ...new Set(
            (units||[])
              .map(
                x=>
                  String(
                    x||''
                  ).trim()
              )
              .filter(Boolean)
          )
        ],

        active_unit:
          String(
            activeUnit||''
          ),

        at:
          Date.now()
      })
    );

  }
  catch(_e){}
}


async function recoverOnlineAuthV171(){

  if(
    !navigator.onLine
    ||
    !sb
    ||
    !authUser?.id
  ){
    return false;
  }

  try{

    const {
      data:{
        session
      },
      error
    }=
      await sb.auth.getSession();

    if(
      error
      ||
      !session?.user
      ||
      String(
        session.user.id
      )
      !==
      String(
        authUser.id
      )
    ){

      console.warn(
        '[OFFLINE] Sessao ainda nao restaurada.',
        error||null
      );

      return false;
    }

    const ok=
      await loadProfile(
        session.user
      );

    if(!ok){
      return false;
    }

    await loadMyPermissions();

    await loadReferences(true);

    setupRealtime();

    setBackendStatus(
      'ok',
      'Supabase conectado'
    );

    await syncOfflineQueue({
      silent:false
    });

    return true;

  }
  catch(e){

    console.warn(
      '[OFFLINE] Falha ao recuperar conexao',
      e
    );

    return false;

  }
}

let offlineDbPromise=null;
let offlineSyncRunning=false;
let offlineSyncPromise=null;
let offlineSyncTimer=null;
let offlineSyncLastError='';
let offlinePillBound=false;

function offlineDb(){
  if(offlineDbPromise)return offlineDbPromise;
  offlineDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(OFFLINE_DB_NAME,OFFLINE_DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('queue')){
        const s=db.createObjectStore('queue',{keyPath:'id'});
        s.createIndex('user_id','user_id',{unique:false});
        s.createIndex('created_at','created_at',{unique:false});
        s.createIndex('type','type',{unique:false});
      }
      if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Falha ao abrir banco offline.'));
  });
  return offlineDbPromise;
}
async function offlinePut(store,value){
  const db=await offlineDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar offline.'));});
}
async function offlineDelete(store,key){
  const db=await offlineDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Falha ao excluir registro offline.'));});
}
async function offlineGet(store,key){
  const db=await offlineDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('Falha ao ler registro offline.'));});
}
async function offlineGetAll(store){
  const db=await offlineDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('Falha ao ler fila offline.'));});
}
function offlineUserStateKey(key){return `${authUser?.id||'anon'}:${key}`;}
async function offlineStateSet(key,value){return offlinePut('state',{key:offlineUserStateKey(key),user_id:authUser?.id||'',value,updated_at:new Date().toISOString()});}
async function offlineStateGet(key){const row=await offlineGet('state',offlineUserStateKey(key));return row?.value??null;}
async function offlineQueueRows(){const rows=await offlineGetAll('queue');return rows.filter(x=>String(x.user_id||'')===String(authUser?.id||'')).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));}
async function offlinePendingCount(){try{return (await offlineQueueRows()).length;}catch{return 0;}}
async function offlineQueueAdd(type,payload,id=uuid()){
  const row={id,user_id:authUser?.id||'',type,payload,created_at:new Date().toISOString(),status:'PENDING',tries:0,last_error:''};
  await offlinePut('queue',row);updateOnlineStatus();return row;
}
async function offlineQueueUpdate(row){row.updated_at=new Date().toISOString();await offlinePut('queue',row);updateOnlineStatus();return row;}
async function offlineQueueFind(predicate){return (await offlineQueueRows()).find(predicate)||null;}
function offlineIsNetworkError(err){const m=String(err?.message||err||'');return !navigator.onLine||/failed to fetch|networkerror|network request failed|load failed|fetch failed|connection|internet/i.test(m);}
function offlineLocalId(prefix){return `local-${prefix}-${uuid()}`;}
function offlineIsLocalId(v){return String(v||'').startsWith('local-');}

async function offlineDamageReceipts(){return (await offlineStateGet('damage_receipts'))||[];}
async function offlineSaveDamageReceipt(ctx){const rows=await offlineDamageReceipts();if(!rows.some(x=>x.offline_operation_id===ctx.offline_operation_id)){rows.push(ctx);await offlineStateSet('damage_receipts',rows);}return rows;}
async function offlineOpenNextDamageReceipt(){
  const rows=await offlineDamageReceipts();if(!rows.length)return false;
  if(!navigator.onLine)return toast('O comprovante precisa de internet para abrir o WhatsApp.','error');
  const ctx=rows.shift();await offlineStateSet('damage_receipts',rows);updateOnlineStatus();await openDeliveryDamageReceipt(ctx);return true;
}

updateOnlineStatus = function(){
  const el=$('syncPill');if(!el)return;
  const online=navigator.onLine;el.classList.toggle('offline',!online);el.classList.toggle('syncing',offlineSyncRunning);
  Promise.all([offlinePendingCount(),offlineDamageReceipts().then(x=>x.length).catch(()=>0)]).then(([pending,receipts])=>{
    const span=el.querySelector('span');if(!span)return;
    if(offlineSyncRunning)span.textContent=pending?`Sincronizando ${pending}…`:'Sincronizando…';
    else if(!online)span.textContent=pending?`Sem internet • ${pending} pendente${pending===1?'':'s'}`:'Sem internet';
    else if(receipts)span.textContent=`Online • ${receipts} comprovante${receipts===1?'':'s'}`;
    else if(pending)span.textContent=`Online • ${pending} pendente${pending===1?'':'s'}`;
    else span.textContent='Online • sincronizado';
    el.title=receipts?'Toque para abrir o próximo comprovante.':pending?'Toque para sincronizar agora.':'Dados sincronizados.';
  });
  if(online&&authUser&&!offlineSyncRunning){clearTimeout(offlineSyncTimer);offlineSyncTimer=setTimeout(()=>syncOfflineQueue({silent:true}),600);}
};

const loadProfileV151=loadProfile;

loadProfile = async function(user){

  authUser=user;


  if(navigator.onLine){

    try{

      const {
        data,
        error
      }=
        await sb
          .from('profiles')
          .select('*')
          .eq(
            'id',
            user.id
          )
          .single();


      if(error)throw error;


      if(
        !data
        ||
        !data.active
      ){

        profile=null;

        return false;
      }


      profile=data;


      localStorage.setItem(
        OFFLINE_PROFILE_KEY,
        JSON.stringify({
          user_id:
            user.id,

          profile:
            data,

          at:
            Date.now()
        })
      );


      offlineRememberIdentityV171(
        user,
        data.username||''
      );


      return true;

    }
    catch(e){

      console.warn(
        'Perfil online indisponivel; tentando cache local.',
        e
      );

    }
  }


  try{

    const cached=
      JSON.parse(
        localStorage.getItem(
          OFFLINE_PROFILE_KEY
        )
        ||
        'null'
      );


    if(
      cached?.user_id===user.id
      &&
      cached.profile?.active!==false
    ){

      profile=
        cached.profile;


      setBackendStatus(
        'checking',
        'Modo offline - perfil local'
      );


      return true;
    }

  }
  catch(_e){}


  if(navigator.onLine){

    return loadProfileV151(
      user
    );

  }


  profile=null;

  return false;
};

loadMyPermissions = async function(){

  const fallback=
    ROLE_PERMISSION_DEFAULTS[profile?.role]||[];

  myPermissions=
    new Set(fallback);

  if(!sb||!profile)return;

  if(navigator.onLine){

    try{

      const {data,error}=
        await sb.rpc(
          'get_my_permissions'
        );

      if(error)throw error;

      myPermissions=
        new Set(
          (data||[]).map(String)
        );

      if(profile.role==='ADMIN'){

        myPermissions.delete(
          'DAMAGE_NOTIFICATION'
        );

        PERMISSION_CATALOG
          .filter(
            x=>x.code!=='DAMAGE_NOTIFICATION'
          )
          .forEach(
            x=>myPermissions.add(x.code)
          );

        const {
          data:notify,
          error:notifyError
        }=await sb
          .from('user_permissions')
          .select('allowed')
          .eq(
            'user_id',
            authUser.id
          )
          .eq(
            'permission_code',
            'DAMAGE_NOTIFICATION'
          )
          .maybeSingle();

        if(notifyError){
          throw notifyError;
        }

        if(notify?.allowed===true){

          myPermissions.add(
            'DAMAGE_NOTIFICATION'
          );

        }
      }

      localStorage.setItem(
        OFFLINE_PERMS_KEY,
        JSON.stringify({
          user_id:authUser?.id,
          permissions:[
            ...myPermissions
          ],
          at:Date.now()
        })
      );

      return;

    }
    catch(e){

      console.warn(
        'Permissoes online indisponiveis; usando cache.',
        e
      );

    }
  }

  try{

    const cache=
      JSON.parse(
        localStorage.getItem(
          OFFLINE_PERMS_KEY
        )||'null'
      );

    if(
      cache?.user_id===authUser?.id
      &&
      Array.isArray(
        cache.permissions
      )
    ){

      myPermissions=
        new Set(
          cache.permissions
        );

    }

  }
  catch(_e){}
};
readRefCache = function(){
  try{localStorage.removeItem('ops_ref_cache');const x=JSON.parse(localStorage.getItem(REF_CACHE_KEY)||'null');if(!x?.data)return null;if(!navigator.onLine||Date.now()-Number(x.at||0)<12*3600e3)return sanitizeRefs(x.data);return null;}catch{return null;}
};

async function saveFefoOfflineSnapshot(){try{await offlineStateSet('fefo_current',{count:fefoActiveCount,items:fefoItems});}catch(e){console.warn('FEFO cache offline',e);}}
async function restoreFefoOfflineSnapshot(){try{const s=await offlineStateGet('fefo_current');if(!s)return false;fefoActiveCount=s.count||null;fefoItems=s.items||[];renderFefoCurrent();return !!fefoActiveCount;}catch{return false;}}
async function resolveOfflineFefoCountId(id){if(!offlineIsLocalId(id))return id;return await offlineStateGet(`fefo_count_map:${id}`);}

loadFefoCurrent = async function(silent=false){
  if(!hasPerm('FEFO_CREATE')||!sb)return;
  try{
    const cached=await offlineStateGet('fefo_current');
    if(cached?.count&&offlineIsLocalId(cached.count.id)){
      const pending=await offlineQueueFind(x=>x.type==='FEFO_START'&&x.payload?.local_count_id===cached.count.id);
      if(pending){fefoActiveCount=cached.count;fefoItems=cached.items||[];renderFefoCurrent();if(navigator.onLine)syncOfflineQueue({silent:true});return;}
    }
    if(!navigator.onLine){await restoreFefoOfflineSnapshot();return;}
    let row=null;
    if(fefoActiveCount?.id&&!offlineIsLocalId(fefoActiveCount.id)){
      const r=await sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('id',fefoActiveCount.id).eq('status','IN_PROGRESS').maybeSingle();if(r.error)throw r.error;row=r.data||null;
    }
    if(!row){const r=await sb.from('fefo_counts').select('*').eq('unit',activeUnit).eq('counter_id',authUser.id).eq('status','IN_PROGRESS').order('started_at',{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;row=r.data||null;}
    fefoActiveCount=row;fefoItems=row?await fetchFefoItemsForCount(row.id):[];if(row)rememberFefoItems(fefoItems,[row.id]);renderFefoCurrent();await saveFefoOfflineSnapshot();await refreshFefoBadge(true);
  }catch(e){const restored=await restoreFefoOfflineSnapshot();if(!restored&&!silent)toast(humanFefoError(e),'error');}
};

const renderFefoCurrentV151=renderFefoCurrent;
renderFefoCurrent = function(){
  renderFefoCurrentV151();if(!fefoActiveCount)return;
  const summary=$('fefoActiveSummary');if(summary&&offlineIsLocalId(fefoActiveCount.id))summary.textContent+=` • ${navigator.onLine?'sincronização pendente':'salvo neste aparelho'}`;
  if(fefoActiveCount._finishPending){$('btnFefoFinish').disabled=true;$('btnFefoFinish').textContent='Finalização pendente';}
  const body=$('tbodyFefoItems');if(body){body.querySelectorAll('tr').forEach((tr,i)=>{const item=fefoItems[i];if(item?._offline){tr.classList.add('offline-pending-row');const first=tr.querySelector('td');if(first)first.insertAdjacentHTML('beforeend','<small class="offline-row-note">⏳ aguardando sincronização</small>');}});}
};

startFefoCount = async function(){
  if(!canFefo())return;const unit=$('fefoStartUnit').value;if(!unit)return toast('Selecione a unidade da contagem.','error');
  const btn=$('btnFefoStart'),old=btn.textContent;btn.disabled=true;btn.textContent='Iniciando…';
  try{
    const localId=offlineLocalId('fefo-count'),op=await offlineQueueAdd('FEFO_START',{local_count_id:localId,unit});
    fefoActiveCount={id:localId,count_code:`OFF-${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}).replace(':','')}`,unit,counter_id:authUser.id,counter_name:profile.name,counter_username:profile.username,status:'IN_PROGRESS',started_at:new Date().toISOString(),_offline:true};fefoItems=[];clearFefoItemForm();renderFefoCurrent();await saveFefoOfflineSnapshot();
    if(navigator.onLine){await syncOfflineQueue({silent:true});await loadFefoCurrent(true);toast(fefoActiveCount&&!offlineIsLocalId(fefoActiveCount.id)?`Contagem ${fefoActiveCount.count_code} iniciada.`:'Contagem salva e aguardando sincronização.','success');}
    if(!navigator.onLine)toast('Sem internet: contagem iniciada e salva neste aparelho.','success');
    setTimeout(()=>$('fefoCodigo')?.focus(),80);
  }catch(e){toast(`Não foi possível iniciar a contagem offline: ${humanFefoError(e)}`,'error');}
  finally{btn.disabled=false;btn.textContent=old;}
};

saveFefoItem = async function(e){
  e.preventDefault();if(!fefoActiveCount)return toast('Inicie ou retome uma contagem primeiro.','error');const product=selectedOperationalProduct('fefo');if(!product)return toast('Selecione um produto válido da base.','error');const validity=parseFefoDate($('fefoValidade').value);if(!validity)return toast('Informe uma validade válida no formato DD/MM/AAAA.','error');const vinfo=fefoValidityInfo(validity);if(vinfo.days<0&&!window.confirm('Data vencida\n\nEssa data já passou. Deseja continuar?'))return;
  const btn=$('btnFefoSaveItem'),old=btn.textContent;btn.disabled=true;btn.textContent=fefoEditingItemId?'Atualizando…':'Salvando…';
  try{
    const editId=fefoEditingItemId||null,localItemId=editId&&offlineIsLocalId(editId)?editId:offlineLocalId('fefo-item');
    const args={p_count_id:fefoActiveCount.id,p_product_code:product.code,p_validity_date:validity,p_lot:'',p_street:$('fefoRua').value.trim(),p_pallet:fefoIntValue('fefoPalete'),p_layer:fefoIntValue('fefoLastro'),p_box:fefoIntValue('fefoCaixa'),p_loose_unit:fefoIntValue('fefoUnidadeQtd'),p_item_id:editId&&!offlineIsLocalId(editId)?editId:null,local_item_id:localItemId};
    let op=null;
    if(editId&&offlineIsLocalId(editId))op=await offlineQueueFind(x=>x.type==='FEFO_ITEM'&&x.payload?.local_item_id===editId);
    if(op){op.payload={...op.payload,...args};op.status='PENDING';op.last_error='';await offlineQueueUpdate(op);}else await offlineQueueAdd('FEFO_ITEM',args);
    const optimistic={id:editId||localItemId,count_id:fefoActiveCount.id,product_code:product.code,product_name:product.name,validity_date:validity,lot:'',street:args.p_street,pallet:args.p_pallet,layer:args.p_layer,box:args.p_box,loose_unit:args.p_loose_unit,created_at:(fefoItems.find(x=>x.id===editId)?.created_at)||new Date().toISOString(),_offline:true};
    const idx=fefoItems.findIndex(x=>x.id===optimistic.id);if(idx>=0)fefoItems[idx]=optimistic;else fefoItems.push(optimistic);clearFefoItemForm();renderFefoCurrent();await saveFefoOfflineSnapshot();
    if(navigator.onLine){await syncOfflineQueue({silent:true});await loadFefoCurrent(true);toast(editId?'Produto atualizado.':'Produto salvo na contagem.','success');}else toast(editId?'Alteração salva neste aparelho.':'Produto salvo neste aparelho.','success');
    setTimeout(()=>$('fefoCodigo')?.focus(),80);
  }catch(err){toast(humanFefoError(err),'error');}
  finally{btn.disabled=false;btn.textContent=fefoEditingItemId?'Atualizar Produto':'Salvar Produto';}
};

deleteFefoItem = async function(id){
  const x=fefoItems.find(r=>String(r.id)===String(id));if(!x)return;if(!window.confirm(`Excluir ${x.product_code} - ${x.product_name} desta contagem?`))return;
  try{
    if(offlineIsLocalId(id)){const op=await offlineQueueFind(q=>q.type==='FEFO_ITEM'&&q.payload?.local_item_id===id);if(op)await offlineDelete('queue',op.id);}else await offlineQueueAdd('FEFO_DELETE',{p_item_id:id});
    fefoItems=fefoItems.filter(r=>String(r.id)!==String(id));if(fefoEditingItemId===id)clearFefoItemForm();renderFefoCurrent();await saveFefoOfflineSnapshot();
    if(navigator.onLine){await syncOfflineQueue({silent:true});await loadFefoCurrent(true);}toast(navigator.onLine?'Produto excluído.':'Exclusão salva neste aparelho.','success');
  }catch(e){toast(humanFefoError(e),'error');}
};

finishFefoCount = async function(){
  if(!fefoActiveCount)return;if(!fefoItems.length)return toast('Adicione pelo menos um produto antes de finalizar.','error');if(fefoActiveCount._finishPending)return toast('Esta finalização já está aguardando sincronização.','');
  if(!window.confirm(`Finalizar a contagem ${fefoActiveCount.count_code}?\n\nSe estiver sem internet, a finalização será enviada automaticamente quando a conexão voltar.`))return;
  const btn=$('btnFefoFinish'),old=btn.textContent;btn.disabled=true;btn.textContent='Finalizando…';
  try{await offlineQueueAdd('FEFO_FINISH',{p_count_id:fefoActiveCount.id});fefoActiveCount._finishPending=true;renderFefoCurrent();await saveFefoOfflineSnapshot();if(navigator.onLine){await syncOfflineQueue({silent:true});await loadFefoCurrent(true);if(!fefoActiveCount)toast('Contagem finalizada e sincronizada.','success');else toast('Finalização aguardando sincronização.','');}else toast('Finalização salva no aparelho. Será sincronizada quando houver internet.','success');}
  catch(e){toast(humanFefoError(e),'error');}
  finally{btn.disabled=false;if(fefoActiveCount&&!fefoActiveCount._finishPending)btn.textContent=old;}
};

async function cachePullOfflineSnapshot(){try{await offlineStateSet('pull_snapshot',{trip:pullActiveTrip,events:pullDriverEvents,occurrences:pullDriverOccurrences,mainSteps:pullMainSteps,occurrenceTypes:pullOccurrenceTypes,settings:pullSettings,factories:pullFactories,vehicles:pullVehicles,profiles:pullProfiles});}catch(e){console.warn('Puxada cache',e);}}
async function restorePullOfflineSnapshot(){try{const s=await offlineStateGet('pull_snapshot');if(!s)return false;pullActiveTrip=s.trip||null;pullDriverEvents=s.events||[];pullDriverOccurrences=s.occurrences||[];pullMainSteps=s.mainSteps||[];pullOccurrenceTypes=s.occurrenceTypes||[];pullSettings=s.settings||pullSettings;pullFactories=s.factories||[];pullVehicles=s.vehicles||[];pullProfiles=s.profiles||[];populatePullReferenceInputs();renderPullDriver();return !!pullActiveTrip;}catch{return false;}}

const loadPullReferenceDataV151=loadPullReferenceData;
loadPullReferenceData = async function(){
  if(!navigator.onLine){const ok=await restorePullOfflineSnapshot();if(ok||pullMainSteps.length)return;}
  try{await loadPullReferenceDataV151();await cachePullOfflineSnapshot();}catch(e){const ok=await restorePullOfflineSnapshot();if(!ok)throw e;}
};
refreshPullGpsTarget = async function(){
  if(!navigator.onLine)return pullGpsTarget();
  try{const {data,error}=await sb.from('pull_settings').select('singleton,gps_max_accuracy_m,track_interval_seconds,track_min_distance_m,updated_at').eq('singleton',true).maybeSingle();if(error)throw error;if(data)pullSettings={...(pullSettings||{}),...data};await cachePullOfflineSnapshot();return pullGpsTarget();}catch(e){console.warn('GPS: usando tolerância em cache.',e);return pullGpsTarget();}
};
loadPullActiveTrip = async function(silent=false){

  if(!isPullDriver())return;

  if(!navigator.onLine){

    const ok=
      await restorePullOfflineSnapshot();

    if(!ok&&!silent){
      toast(
        'Nenhuma viagem recente disponível no aparelho.',
        'error'
      );
    }

    return;
  }

  try{

    await loadPullReferenceData();

    const {data,error}=
      await sb
        .from('pull_trips')
        .select('*')
        .eq(
          'origin_unit',
          activeUnit
        )
        .eq(
          'status',
          'IN_PROGRESS'
        )
        .or(
          `driver1_id.eq.${authUser.id},driver2_id.eq.${authUser.id}`
        )
        .order(
          'started_at',
          {ascending:false}
        )
        .limit(1)
        .maybeSingle();

    if(error)throw error;

    pullActiveTrip=
      data||null;

    // IMPORTANTE:
    // somente agora sabemos se o ciclo atual
    // e PULL ou TRANSFER.
    pullMainSteps=
      pullStepsForCycle(
        pullActiveTrip?.cycle_type
        ||
        'PULL'
      );

    if(pullActiveTrip){

      const [ev,oc]=
        await Promise.all([

          sb
            .from('pull_events')
            .select('*')
            .eq(
              'trip_id',
              pullActiveTrip.id
            )
            .order('step_order'),

          sb
            .from('pull_occurrences')
            .select('*')
            .eq(
              'trip_id',
              pullActiveTrip.id
            )
            .order('started_at')

        ]);

      if(ev.error)throw ev.error;
      if(oc.error)throw oc.error;

      pullDriverEvents=
        ev.data||[];

      pullDriverOccurrences=
        oc.data||[];

    }
    else{

      pullDriverEvents=[];
      pullDriverOccurrences=[];

    }

    renderPullDriver();
    syncPullTracking();

    await cachePullOfflineSnapshot();

  }
  catch(e){

    console.error(
      '[PUXADA] Falha ao carregar viagem ativa',
      e
    );

    if(
      !navigator.onLine
      ||
      offlineIsNetworkError(e)
    ){

      const ok=
        await restorePullOfflineSnapshot();

      if(!ok&&!silent){
        toast(
          humanPullError(e),
          'error'
        );
      }

      return;
    }

    if(!silent){
      toast(
        humanPullError(e),
        'error'
      );
    }
  }
};
async function pendingPullStepOperation(
  tripId,
  stepId
){

  return await offlineQueueFind(
    row=>
      row.type==='PULL_STEP'
      &&
      String(
        row.payload?.p_trip_id||''
      )===String(tripId||'')
      &&
      String(
        row.payload?.p_step_id||''
      )===String(stepId||'')
  );
}


async function reconcilePullStepQueueRow(row){

  if(
    !row
    ||
    row.type!=='PULL_STEP'
    ||
    !navigator.onLine
  ){
    return false;
  }

  const p=row.payload||{};

  if(
    !p.p_trip_id
    ||
    !p.p_step_id
  ){
    return false;
  }

  const [eventResult,tripResult]=
    await Promise.all([

      sb
        .from('pull_events')
        .select('id,trip_id,step_id,step_order')
        .eq(
          'trip_id',
          p.p_trip_id
        )
        .eq(
          'step_id',
          p.p_step_id
        )
        .limit(1),

      sb
        .from('pull_trips')
        .select('id,status,cycle_type')
        .eq(
          'id',
          p.p_trip_id
        )
        .maybeSingle()

    ]);

  if(eventResult.error){
    throw eventResult.error;
  }

  if(tripResult.error){
    throw tripResult.error;
  }

  // A etapa ja chegou ao servidor.
  // A pendencia local e apenas duplicada.
  if(
    (eventResult.data||[]).length
  ){

    console.info(
      '[PUXADA OFFLINE] removendo etapa ja sincronizada',
      {
        operation_id:row.id,
        trip_id:p.p_trip_id,
        step_id:p.p_step_id
      }
    );

    await offlineDelete(
      'queue',
      row.id
    );

    return true;
  }

  // O ciclo ja terminou.
  // Uma operacao antiga nao pode bloquear
  // a proxima viagem do motorista.
  if(
    !tripResult.data
    ||
    tripResult.data.status!=='IN_PROGRESS'
  ){

    console.warn(
      '[PUXADA OFFLINE] removendo pendencia de ciclo encerrado',
      {
        operation_id:row.id,
        trip_id:p.p_trip_id,
        step_id:p.p_step_id,
        status:
          tripResult.data?.status
          ||
          'NAO_ENCONTRADO'
      }
    );

    await offlineDelete(
      'queue',
      row.id
    );

    return true;
  }

  return false;
}


recordPullNextStep = async function(){

  if(!pullActiveTrip)return;

  const step=
    pullNextStep();

  if(
    !step
    ||
    !pullCanExecuteStep(step)
  ){
    return;
  }

  const openOcc=
    pullDriverOccurrences
      .find(
        x=>x.status==='OPEN'
      );

  if(
    openOcc
    &&
    step.required!==false
  ){

    toast(
      `Finalize a ocorrência “${openOcc.occurrence_name}” antes de registrar a próxima etapa obrigatória.`,
      'error'
    );

    renderPullDriver();

    return;
  }

  const btn=
    $('btnPullNextStep');

  const hint=
    $('pullNextStepHint');

  const baseHint=
    hint?.textContent||'';

  btn.disabled=true;
  btn.textContent='Capturando GPS…';

  try{

    const target=
      await refreshPullGpsTarget();

    const gps=
      await captureGps({
        maxAccuracy:target,
        maxWaitMs:15000,
        onProgress:s=>{

          if(hint){

            hint.textContent=
              `Buscando posição… sinal atual ±${Math.round(s.accuracy)} m • limite ≤ ${target} m.`;

          }
        }
      });

    // Nao cria duas operacoes para
    // a mesma viagem + mesma etapa.
    let op=
      await pendingPullStepOperation(
        pullActiveTrip.id,
        step.id
      );

    if(op){

      op.status='PENDING';
      op.last_error='';

      // Mantemos a coordenada mais recente.
      op.payload={
        ...op.payload,
        p_latitude:gps.latitude,
        p_longitude:gps.longitude,
        p_accuracy:gps.accuracy,
        p_device_at:gps.capturedAt
      };

      await offlineQueueUpdate(op);

      console.warn(
        '[PUXADA] reutilizando etapa que ja estava pendente',
        {
          operation_id:op.id,
          trip_id:pullActiveTrip.id,
          step_id:step.id
        }
      );

    }
    else{

      op=
        await offlineQueueAdd(
          'PULL_STEP',
          {
            p_trip_id:
              pullActiveTrip.id,

            p_step_id:
              step.id,

            p_latitude:
              gps.latitude,

            p_longitude:
              gps.longitude,

            p_accuracy:
              gps.accuracy,

            p_exception_reason:
              '',

            p_device_at:
              gps.capturedAt
          }
        );

    }

    // Movimento otimista na tela,
    // mas sem duplicar o mesmo passo.
    const alreadyLocal=
      pullDriverEvents.some(
        x=>
          String(x.step_id)
          ===
          String(step.id)
      );

    if(!alreadyLocal){

      pullDriverEvents.push({

        id:
          offlineLocalId(
            'pull-event'
          ),

        trip_id:
          pullActiveTrip.id,

        step_id:
          step.id,

        step_name:
          step.name,

        action_code:
          step.action_code,

        step_order:
          step.sort_order,

        user_id:
          authUser.id,

        user_name:
          profile.name,

        recorded_at:
          gps.capturedAt
          ||
          new Date().toISOString(),

        device_at:
          gps.capturedAt,

        latitude:
          gps.latitude,

        longitude:
          gps.longitude,

        gps_accuracy:
          gps.accuracy,

        geofence_status:
          'PENDING_SYNC',

        exception_reason:
          '',

        _offline:
          true,

        offline_operation_id:
          op.id

      });
    }

    const after=
      pullMainSteps.find(
        x=>
          Number(x.sort_order)
          >
          Number(step.sort_order)
      );

    if(after?.executor_driver===1){

      pullActiveTrip.active_driver_id=
        pullActiveTrip.driver1_id;

      pullActiveTrip.active_driver_name=
        pullActiveTrip.driver1_name;

    }

    if(after?.executor_driver===2){

      pullActiveTrip.active_driver_id=
        pullActiveTrip.driver2_id;

      pullActiveTrip.active_driver_name=
        pullActiveTrip.driver2_name;

    }

    await cachePullOfflineSnapshot();

    renderPullDriver();

    if(navigator.onLine){

      btn.textContent=
        'Sincronizando…';

      await syncOfflineQueue({
        silent:true
      });

      // A operacao precisa realmente ter
      // desaparecido da fila.
      const pending=
        await offlineGet(
          'queue',
          op.id
        );

      if(pending){

        const detail=
          String(
            pending.last_error
            ||
            'aguardando sincronização'
          );

        throw new Error(
          `ETAPA_AGUARDANDO_SINCRONIZACAO:${detail}`
        );
      }

      await loadPullActiveTrip(true);

      toast(
        'Etapa registrada e sincronizada.',
        'success'
      );

    }
    else{

      toast(
        'Sem sinal: etapa salva no aparelho e será sincronizada automaticamente.',
        'success'
      );

    }

  }
  catch(err){

    if(hint){
      hint.textContent=
        baseHint;
    }

    if(navigator.onLine){

      await loadPullActiveTrip(true);

    }

    const message=
      String(
        err?.message||err||''
      );

    if(
      message.includes(
        'ETAPA_AGUARDANDO_SINCRONIZACAO'
      )
    ){

      toast(
        'A etapa ficou salva no aparelho, mas ainda não chegou ao servidor. O sistema tentará novamente sem criar outra etapa duplicada.',
        'error'
      );

    }
    else{

      toast(
        humanGpsOrPullError(err),
        'error'
      );

    }

  }
  finally{

    btn.disabled=false;

    renderPullDriver();

  }
};
const renderPullDriverV151=renderPullDriver;
renderPullDriver = function(){renderPullDriverV151();const tl=$('pullDriverTimeline');if(tl){tl.querySelectorAll('.pull-timeline-item').forEach((el,i)=>{const ordered=[...pullDriverEvents.map(x=>({kind:'STEP',raw:x})),...pullDriverOccurrences.map(x=>({kind:'OCC',raw:x}))].sort((a,b)=>new Date(a.raw.recorded_at||a.raw.started_at)-new Date(b.raw.recorded_at||b.raw.started_at));if(ordered[i]?.raw?._offline)el.classList.add('offline-pending-row');});}const hint=$('pullNextStepHint');if(hint&&!navigator.onLine&&pullActiveTrip)hint.textContent+=` • OFFLINE: a etapa ficará salva neste aparelho até a conexão voltar.`;};

const syncPullTrackingV151=syncPullTracking;
syncPullTracking = function(){if(!navigator.onLine){stopPullTracking();return;}return syncPullTrackingV151();};

async function offlineUploadDamageStorage(path,blob){const {error}=await sb.storage.from('avarias').upload(path,blob,{contentType:'image/jpeg',upsert:true});if(error)throw error;}

submitAvaria = async function(e){
  e.preventDefault();let customer=selectedCustomer();if(!customer){const code=normalizeCode($('avPdv').value);if(code){try{const found=await fetchCustomersByCode(code);renderDeliveryCustomerMatches(found);customer=selectedCustomer();}catch(err){console.warn('Busca PDV ao salvar avaria',err);}}}if(!customer)return toast(currentCustomerMatches().length>1?'Selecione qual cliente corresponde ao PDV informado.':'Informe um PDV válido.','error');if(!$('avMapa').value.trim())return toast('Informe o mapa.','error');if(!avariaItems.length)return toast('Adicione ao menos um produto avariado.','error');if(!signatureDirty)return toast('A assinatura do cliente é obrigatória.','error');
  const btn=$('btnSalvarAvaria');btn.disabled=true;btn.textContent='Salvando…';
  try{
    const opId=uuid(),sigBlob=await canvasBlob($('signatureCanvas'),.82),receiptCtx={offline_operation_id:opId,unit:activeUnit,customer:{...customer},date:$('avData').value,map_number:$('avMapa').value.trim(),items:avariaItems.map(x=>({product:x.product,product_code:x.product_code,product_name:x.product_name,quantity:x.quantity,unit:x.unit,reason:x.reason}))};
    const payload={receiptCtx,signature_blob:sigBlob,unit:activeUnit,date:receiptCtx.date,customer:{...customer},map_number:receiptCtx.map_number,items:avariaItems.map(x=>({product:x.product,product_code:x.product_code,product_name:x.product_name,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photos:(x.photos||[]).map(p=>({blob:p.blob,gps:{...p.gps}}))}))};
    await offlineQueueAdd('DAMAGE_CREATE',payload,opId);clearAvariaRequest();
    if(navigator.onLine){await syncOfflineQueue({silent:true});const still=await offlineGet('queue',opId);if(!still){toast('Avaria registrada e sincronizada.','success');await offlineOpenNextDamageReceipt();}else toast(`Avaria salva no aparelho. Sincronização pendente: ${still.last_error||'aguardando conexão'}.`,'');}
    if(!navigator.onLine)toast('Sem sinal: avaria salva no aparelho. Ela será enviada automaticamente quando a internet voltar.','success');
  }catch(err){toast(`Não foi possível salvar a avaria no aparelho: ${humanDeliveryDamageError(err)}`,'error');}
  finally{btn.disabled=false;btn.textContent='Registrar requisição';}
};

function deliveryDamageItemProductCode(item){const direct=normalizeCode(item?.product_code||'');if(direct)return direct;const text=String(item?.product_text||item?.product||'');return normalizeCode(text.split(/\s+-\s+|\s+•\s+/)[0]||'');}
function deliveryDamageLotKey(item){return `${deliveryDamageItemProductCode(item)}|${sanitizeLot(item?.lot)}`;}
loadAdminAvarias = async function(silent=false){
  if(!hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))return;
  try{const {data,error}=await sb.from('damage_requests').select('*,damage_items(*,damage_item_photos(*))').eq('unit',activeUnit).order('created_at',{ascending:false}).limit(1000);if(error)throw error;adminAvarias=data||[];const codes=[...new Set(adminAvarias.flatMap(r=>r.damage_items||[]).map(deliveryDamageItemProductCode).filter(Boolean))];lotNriMap=new Map();for(const chunk of chunks(codes,100)){const q=await sb.from('nris').select('nri,lot,product_code,product_name,validity_date,unit').eq('unit',activeUnit).in('product_code',chunk);if(q.error)throw q.error;(q.data||[]).forEach(n=>{splitMultiLots(n.lot).forEach(lot=>{const k=`${normalizeCode(n.product_code)}|${sanitizeLot(lot)}`;if(!lotNriMap.has(k))lotNriMap.set(k,[]);lotNriMap.get(k).push(n);});});}renderAdminAvarias();if($('badgeAvarias'))$('badgeAvarias').textContent=adminAvarias.filter(r=>(r.damage_items||[]).some(i=>['PENDENTE','APROVADO','LANCADO'].includes(i.status))).length;}catch(e){if(!silent)toast(humanDeliveryDamageError(e),'error');}
};

addNriDraftItem = function(){
  const p=selectedOperationalProduct('nri'),sem=$('nriSemValidade').checked,validity=sem?null:parseShortDate($('nriValidade').value),typed=sanitizeLot($('nriLote').value),savedLots=[...nriLots].map(sanitizeLot).filter(Boolean),lots=[...new Set([...savedLots,typed].filter(Boolean))],qty=num($('nriQuantidade').value),pallets=Math.trunc(num($('nriPaletes').value));
  if(!p)return toast('Selecione um produto válido da base.','error');
  if(!sem&&!validity)return toast('Informe a validade completa no formato dd/mm/aa ou selecione Sem Validade.','error');
  if(!lots.length)return toast('Adicione ao menos um lote.','error');
  if(qty<=0)return toast('Informe a quantidade.','error');
  if(pallets<1)return toast('Informe a quantidade de paletes.','error');
  if(lots.length>1&&pallets!==lots.length)return toast(`Para ${lots.length} lotes diferentes, informe ${lots.length} em Paletes / NRIs. Cada lote será salvo em uma NRI distinta.`,'error');
  const damagedPallets=nriDamageMode?Math.trunc(num($('nriDamagePallets').value)):0,reason=nriDamageMode?$('nriDamageReason').value.trim():'',invoiceNumber=nriDamageMode?$('nriDamageInvoice').value.trim():'';
  if(nriDamageMode&&(!damagedPallets||damagedPallets<1||damagedPallets>pallets))return toast(`Informe entre 1 e ${pallets} palete(s) avariado(s).`,'error');
  if(nriDamageMode&&!reason)return toast('Selecione o motivo do avariado.','error');
  if(nriDamageMode&&!invoiceNumber)return toast('Informe o Número da Nota Fiscal do palete avariado.','error');
  if(nriDamageMode&&(nriDamagePhotos.length<1||nriDamagePhotos.length>5))return toast('Palete avariado exige de 1 a 5 fotos.','error');
  const base={product_code:p.code,product_name:p.name,validity_date:validity,quantity:qty,block_date:validity?addDaysIso(validity,-30):null,pallet_damaged:nriDamageMode,damage_reason:reason,invoice_number:invoiceNumber,damagePhotos:[...nriDamagePhotos]};
  if(nriEditingId){
    const lot=lots[0];
    if(lots.length>1)return toast('Na edição, mantenha um lote por linha. Exclua a linha e adicione novamente para dividir em vários lotes.','error');
    const item={...base,id:nriEditingId,lot,lots:[lot],pallets,damaged_pallets:damagedPallets};
    const idx=nriDraftItems.findIndex(x=>x.id===nriEditingId);if(idx>=0)nriDraftItems[idx]=item;
  }else if(lots.length===1){
    const lot=lots[0];nriDraftItems.push({...base,id:uuid(),lot,lots:[lot],pallets,damaged_pallets:damagedPallets});
  }else{
    lots.forEach((lot,index)=>nriDraftItems.push({...base,id:uuid(),lot,lots:[lot],pallets:1,damaged_pallets:nriDamageMode?(index<damagedPallets?1:0):0,pallet_damaged:nriDamageMode&&index<damagedPallets}));
  }
  renderNriDraftItems();clearNriItemEditor();
};
function assetRowByProductId(productId){return [...document.querySelectorAll('[data-asset-product]')].find(r=>String(r.dataset.assetProduct)===String(productId))||null;}
assetLocationValue = function(productId){return normalizeAssetLocation(assetRowByProductId(productId)?.dataset.assetLocation||'PATIO');};
setRotatingAssetLocation = function(productId,location){const row=assetRowByProductId(productId);if(!row)return;const loc=normalizeAssetLocation(location);row.dataset.assetLocation=loc;row.querySelectorAll('[data-asset-location]').forEach(b=>b.classList.toggle('active',normalizeAssetLocation(b.dataset.assetLocation)===loc));};
addRotatingAssetEntry = async function(productId,btn){
  if(!rotatingAssetActiveCount)return toast('Inicie uma contagem primeiro.','error');const product=rotatingAssetProducts.find(p=>String(p.id)===String(productId));if(!product)return toast('Ativo não encontrado. Atualize a tela e tente novamente.','error');const old=btn.textContent;btn.disabled=true;btn.textContent='Adicionando…';
  try{const args={p_count_id:rotatingAssetActiveCount.id,p_product_id:product.id,p_pallet_gfa:assetInputValue(product.id,'pallet'),p_layer_gfa:assetInputValue(product.id,'layer'),p_box_gfa:assetInputValue(product.id,'box'),p_loose:assetInputValue(product.id,'loose'),p_units:assetInputValue(product.id,'units'),p_location:assetLocationValue(product.id)};if(args.p_pallet_gfa+args.p_layer_gfa+args.p_box_gfa+args.p_loose+args.p_units<=0)return toast('Informe ao menos uma quantidade maior que zero.','error');const {data,error}=await sb.rpc('add_rotating_asset_entry',args);if(error)throw error;if(!data?.id)throw new Error('ATIVO_GIRO_LANCAMENTO_SEM_RETORNO');rotatingAssetEntries=[data,...rotatingAssetEntries.filter(x=>String(x.id)!==String(data.id))];['pallet','layer','box','loose','units'].forEach(f=>{const el=$(assetInputId(product.id,f));if(el)el.value='0';});renderRotatingAssetCurrent();toast(`${product.description} • ${assetLocationLabel(args.p_location)}: adição registrada.`,'success');}
  catch(e){console.error('Ativo de Giro - adicionar',e);toast(humanRotatingAssetError(e),'error');}
  finally{btn.disabled=false;btn.textContent=old;}
};

function assetAdminEntryRows(entries){return [...entries].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(e=>`<tr><td>${fmtDateTime(e.created_at)}</td><td><strong>${esc(e.product_description)}</strong><small>${esc(e.sap_code||'—')} • ${esc(e.asset_code||'—')}</small></td><td><span class="asset-location-badge ${assetLocationClass(e.location)}">${assetLocationLabel(e.location)}</span></td><td>${Number(e.pallet_gfa||0)}</td><td>${Number(e.layer_gfa||0)}</td><td>${Number(e.box_gfa||0)}</td><td>${Number(e.loose||0)}</td><td>${Number(e.units||0)}</td><td>${esc(e.created_by_name||'—')}</td><td><button class="mini-btn" data-asset-admin-edit="${e.id}">Editar</button></td></tr>`).join('');}
function assetAuditDiff(a){const parts=[];[['Local','old_location','new_location'],['Palet/GFA','old_pallet_gfa','new_pallet_gfa'],['Lastro/GFA','old_layer_gfa','new_layer_gfa'],['Caixa/GFA','old_box_gfa','new_box_gfa'],['Avulso','old_loose','new_loose'],['Unidades','old_units','new_units']].forEach(([label,o,n])=>{if(String(a[o])!==String(a[n]))parts.push(`${label}: ${a[o]} → ${a[n]}`);});return parts.join(' • ')||'Sem diferença numérica';}
async function openRotatingAssetEntryAdminEdit(entryId,countId){
  const entries=rotatingAssetEntriesByCount.get(countId)||[],e=entries.find(x=>String(x.id)===String(entryId));if(!e)return toast('Lançamento não encontrado.','error');
  const body=`<div class="notice warning">A correção ficará registrada na auditoria com usuário, data, valores anteriores e motivo.</div><div class="detail-card asset-edit-product"><small>ATIVO</small><strong>${esc(e.product_description)}</strong><span>${esc(e.sap_code||'—')} • ${esc(e.asset_code||'—')}</span></div><div class="grid grid-3"><div class="field"><label>Local</label><select id="assetAdminLocation"><option value="PATIO" ${normalizeAssetLocation(e.location)==='PATIO'?'selected':''}>Pátio</option><option value="REFUGO" ${normalizeAssetLocation(e.location)==='REFUGO'?'selected':''}>Refugo</option></select></div><div class="field"><label>Palet/GFA</label><input id="assetAdminPallet" type="number" min="0" value="${Number(e.pallet_gfa||0)}"></div><div class="field"><label>Lastro/GFA</label><input id="assetAdminLayer" type="number" min="0" value="${Number(e.layer_gfa||0)}"></div><div class="field"><label>Caixa/GFA</label><input id="assetAdminBox" type="number" min="0" value="${Number(e.box_gfa||0)}"></div><div class="field"><label>Avulso</label><input id="assetAdminLoose" type="number" min="0" value="${Number(e.loose||0)}"></div><div class="field"><label>Unidades</label><input id="assetAdminUnits" type="number" min="0" value="${Number(e.units||0)}"></div><div class="field span-3"><label>Motivo da correção *</label><textarea id="assetAdminReason" rows="3" maxlength="500" placeholder="Ex.: Conferente informou 10 unidades, correto é 8."></textarea></div></div>`;
  openModal('Corrigir Ativo de Giro','Ajuste administrativo auditado',body,[{label:'Salvar correção',class:'primary',onClick:async()=>{const reason=String($('assetAdminReason')?.value||'').trim();if(!reason)return toast('Informe o motivo da correção.','error');try{const args={p_entry_id:e.id,p_pallet_gfa:assetQty($('assetAdminPallet').value),p_layer_gfa:assetQty($('assetAdminLayer').value),p_box_gfa:assetQty($('assetAdminBox').value),p_loose:assetQty($('assetAdminLoose').value),p_units:assetQty($('assetAdminUnits').value),p_location:$('assetAdminLocation').value,p_reason:reason};const {error}=await sb.rpc('admin_update_rotating_asset_entry',args);if(error)throw error;const fresh=await fetchRotatingAssetEntries([countId]);rotatingAssetEntriesByCount.set(countId,fresh);toast('Correção salva e registrada na auditoria.','success');await openRotatingAssetHistory(countId);}catch(err){toast(humanRotatingAssetError(err),'error');}}},{label:'Cancelar',class:'secondary',onClick:()=>openRotatingAssetHistory(countId)}]);
}

openRotatingAssetHistory = async function(id){
  const c=rotatingAssetHistory.find(x=>String(x.id)===String(id));if(!c)return;const entries=rotatingAssetEntriesByCount.get(c.id)||[],patio=aggregateRotatingAssetGrandTotal(entries,'PATIO'),refugo=aggregateRotatingAssetGrandTotal(entries,'REFUGO'),total=aggregateRotatingAssetGrandTotal(entries),initialRows=rotatingAssetHistoryViewRows(entries,'TOTAL');let audit=[];
  if(isAdmin()){try{const q=await sb.from('rotating_asset_entry_audit').select('*').eq('count_id',c.id).order('changed_at',{ascending:false}).limit(500);if(q.error)throw q.error;audit=q.data||[];}catch(e){console.warn('Auditoria ativo de giro',e);}}
  const adminBlock=isAdmin()?`<div class="section-title asset-admin-section-title">Ajustes administrativos</div><p class="asset-admin-help">O Admin pode corrigir lançamentos digitados incorretamente. Toda alteração fica registrada.</p><div class="table-wrap"><table class="asset-admin-entry-table"><thead><tr><th>Hora</th><th>Ativo</th><th>Local</th><th>Palet</th><th>Lastro</th><th>Caixa</th><th>Avulso</th><th>Unid.</th><th>Conferente</th><th>Ação</th></tr></thead><tbody>${assetAdminEntryRows(entries)||'<tr><td colspan="10">Sem lançamentos.</td></tr>'}</tbody></table></div><div class="section-title">Histórico de correções</div><div class="asset-audit-list">${audit.length?audit.map(a=>`<div class="asset-audit-item"><div><strong>${esc(a.product_description)}</strong><span>${esc(assetAuditDiff(a))}</span><small>${esc(a.changed_by_name)} • ${fmtDateTime(a.changed_at)} • Motivo: ${esc(a.reason)}</small></div></div>`).join(''):'<div class="empty-state">Nenhuma correção administrativa registrada.</div>'}</div>`:'';
  const body=`<div class="detail-grid asset-history-detail-grid"><div class="detail-card"><small>Data</small><strong>${fmtDate(c.count_date)}</strong></div><div class="detail-card"><small>Unidade</small><strong>${esc(c.unit)}</strong></div><div class="detail-card"><small>Conferente</small><strong>${esc(c.counter_name)}</strong></div><div class="detail-card"><small>Adições</small><strong>${entries.length}</strong></div></div><div class="asset-history-total-cards"><div class="asset-history-total-card patio"><span>Pátio</span><strong>${assetTotalLabel(patio)}</strong><small>${patio.entries} adição${patio.entries===1?'':'ões'}</small></div><div class="asset-history-total-card refugo"><span>Refugo</span><strong>${assetTotalLabel(refugo)}</strong><small>${refugo.entries} adição${refugo.entries===1?'':'ões'}</small></div></div><div class="asset-history-view-tabs" role="tablist"><button type="button" class="asset-history-view-tab active" data-asset-history-tab="TOTAL">TOTAL</button><button type="button" class="asset-history-view-tab patio" data-asset-history-tab="PATIO">PÁTIO</button><button type="button" class="asset-history-view-tab refugo" data-asset-history-tab="REFUGO">REFUGO</button></div><div class="asset-history-view-caption"><strong id="assetHistoryViewTitle">Total</strong><span id="assetHistoryViewSummary">Pátio + Refugo • ${assetTotalLabel(total)}</span></div><div class="table-wrap"><table class="asset-history-total-table"><thead><tr><th>COD. SAP</th><th>COD.</th><th>Descrição</th><th>Visão</th><th>Palet/GFA</th><th>Lastro/GFA</th><th>Caixa/GFA</th><th>Avulso</th><th>Unidades</th></tr></thead><tbody id="assetHistoryViewTbody">${rotatingAssetHistoryTableRowsHtml(initialRows,'TOTAL')}</tbody></table></div>${adminBlock}`;
  openModal(`Ativo de Giro • ${c.count_code}`,`${fmtDate(c.count_date)} • ${c.unit}`,body,[{label:'Baixar CSV',class:'primary',onClick:()=>downloadRotatingAssetHistoryCsv(c.id)},{label:'Fechar',class:'secondary',onClick:closeModal}]);const modalBody=$('modalBody');const renderView=view=>{const mode=String(view||'TOTAL').toUpperCase(),rows=rotatingAssetHistoryViewRows(entries,mode),totals=mode==='PATIO'?patio:mode==='REFUGO'?refugo:total,title=rotatingAssetHistoryViewLabel(mode),summary=mode==='TOTAL'?`Pátio + Refugo • ${assetTotalLabel(totals)}`:`${totals.entries} adição${totals.entries===1?'':'ões'} • ${assetTotalLabel(totals)}`;if($('assetHistoryViewTbody'))$('assetHistoryViewTbody').innerHTML=rotatingAssetHistoryTableRowsHtml(rows,mode);if($('assetHistoryViewTitle'))$('assetHistoryViewTitle').textContent=title;if($('assetHistoryViewSummary'))$('assetHistoryViewSummary').textContent=summary;modalBody?.querySelectorAll('[data-asset-history-tab]').forEach(btn=>{const active=btn.dataset.assetHistoryTab===mode;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false');});};modalBody?.querySelectorAll('[data-asset-history-tab]').forEach(btn=>btn.addEventListener('click',()=>renderView(btn.dataset.assetHistoryTab)));modalBody?.querySelectorAll('[data-asset-admin-edit]').forEach(btn=>btn.addEventListener('click',()=>openRotatingAssetEntryAdminEdit(btn.dataset.assetAdminEdit,c.id)));
};

const humanRotatingAssetErrorV151=humanRotatingAssetError;
humanRotatingAssetError = function(e){const m=String(e?.message||e||'');if(m.includes('ATIVO_GIRO_MOTIVO_AJUSTE_OBRIGATORIO'))return 'Informe o motivo da correção.';if(m.includes('ATIVO_GIRO_LANCAMENTO_SEM_RETORNO'))return 'O servidor não confirmou a adição. Execute o SQL 25 e tente novamente.';return humanRotatingAssetErrorV151(e);};

async function processOfflineRecord(row){
  if(row.type==='FEFO_START'){
    const {data,error}=await sb.rpc('offline_sync_fefo_start',{p_operation_id:row.id,p_unit:row.payload.unit});if(error)throw error;if(!data?.id)throw new Error('FEFO_SYNC_START_SEM_RETORNO');await offlineStateSet(`fefo_count_map:${row.payload.local_count_id}`,data.id);const snap=await offlineStateGet('fefo_current');if(snap?.count?.id===row.payload.local_count_id){snap.count={...data,_offline:false};snap.items=(snap.items||[]).map(i=>({...i,count_id:data.id}));await offlineStateSet('fefo_current',snap);}return data;
  }
  if(row.type==='FEFO_ITEM'){
    const countId=await resolveOfflineFefoCountId(row.payload.p_count_id);if(!countId)throw new Error('FEFO_AGUARDANDO_INICIO');const itemId=row.payload.p_item_id&&!offlineIsLocalId(row.payload.p_item_id)?row.payload.p_item_id:null;const {data,error}=await sb.rpc('offline_sync_fefo_item',{p_operation_id:row.id,p_count_id:countId,p_product_code:row.payload.p_product_code,p_validity_date:row.payload.p_validity_date,p_lot:'',p_street:row.payload.p_street,p_pallet:row.payload.p_pallet,p_layer:row.payload.p_layer,p_box:row.payload.p_box,p_loose_unit:row.payload.p_loose_unit,p_item_id:itemId});if(error)throw error;return data;
  }
  if(row.type==='FEFO_DELETE'){const {data,error}=await sb.rpc('offline_sync_fefo_delete',{p_operation_id:row.id,p_item_id:row.payload.p_item_id});if(error)throw error;return data;}
  if(row.type==='FEFO_FINISH'){const countId=await resolveOfflineFefoCountId(row.payload.p_count_id);if(!countId)throw new Error('FEFO_AGUARDANDO_INICIO');const {data,error}=await sb.rpc('offline_sync_fefo_finish',{p_operation_id:row.id,p_count_id:countId});if(error)throw error;await offlineStateSet('fefo_current',{count:null,items:[]});return data;}
  if(row.type==='PULL_STEP'){const p=row.payload,{data,error}=await sb.rpc('offline_sync_pull_step',{p_operation_id:row.id,p_trip_id:p.p_trip_id,p_step_id:p.p_step_id,p_latitude:p.p_latitude,p_longitude:p.p_longitude,p_accuracy:p.p_accuracy,p_exception_reason:p.p_exception_reason||'',p_device_at:p.p_device_at});if(error)throw error;return data;}
  if(row.type==='DAMAGE_CREATE'){
    const p=row.payload,base=`${authUser.id}/offline_${row.id}`,signaturePath=`${base}/assinatura.jpg`;await offlineUploadDamageStorage(signaturePath,p.signature_blob);const uploaded=[];
    for(let i=0;i<p.items.length;i++){const x=p.items[i],photos=[];for(let j=0;j<(x.photos||[]).length;j++){const ph=x.photos[j],path=`${base}/produto_${String(i+1).padStart(2,'0')}_foto_${String(j+1).padStart(2,'0')}.jpg`;await offlineUploadDamageStorage(path,ph.blob);photos.push({photo_path:path,latitude:ph.gps.latitude,longitude:ph.gps.longitude,accuracy:ph.gps.accuracy||'',gps_at:ph.gps.capturedAt});}uploaded.push({...x,photos});}
    const serverPayload={unit:p.unit||p.receiptCtx?.unit||activeUnit,date:p.date,customer_code:p.customer.code,customer_name:p.customer.name,city:p.customer.city,map_number:p.map_number,signature_path:signaturePath,items:uploaded.map(x=>{const first=x.photos[0];return {product:x.product,lot:x.lot,quantity:x.quantity,unit:x.unit,reason:x.reason,photos:x.photos,photo_path:first?.photo_path||'',latitude:first?.latitude,longitude:first?.longitude,accuracy:first?.accuracy,gps_at:first?.gps_at};})};const {data,error}=await sb.rpc('offline_sync_damage_request',{p_operation_id:row.id,p_payload:serverPayload});if(error)throw error;const ctx={...p.receiptCtx,request_id:data?.request_id||null};await offlineSaveDamageReceipt(ctx);await dispatchDamagePushV170('delivery',data?.request_id||null);return data;
  }
  throw new Error(`TIPO_OFFLINE_DESCONHECIDO:${row.type}`);
}

async function syncOfflineQueue({
  silent=false
}={}){

  if(
    !navigator.onLine
    ||
    !sb
    ||
    !authUser
  ){
    return false;
  }

  // Cada chamada entra atras da chamada anterior.
  // Nenhuma sincronizacao e simplesmente ignorada.
  const previous=
    offlineSyncPromise;

  const current=
    (async()=>{

      if(previous){

        try{
          await previous;
        }
        catch(_e){}

      }

      if(
        !navigator.onLine
        ||
        !sb
        ||
        !authUser
      ){
        return false;
      }

      offlineSyncRunning=true;
      offlineSyncLastError='';

      updateOnlineStatus();

      let success=0;
      let touchedFefo=false;
      let touchedPull=false;
      let touchedDamage=false;

      try{

        const rows=
          await offlineQueueRows();

        for(const row of rows){

          try{

            // Antes de reenviar uma etapa,
            // verifica se o servidor ja a recebeu
            // ou se aquela viagem ja terminou.
            if(
              row.type==='PULL_STEP'
              &&
              await reconcilePullStepQueueRow(
                row
              )
            ){

              success++;
              touchedPull=true;

              continue;
            }

            row.status='SYNCING';

            row.tries=
              Number(row.tries||0)+1;

            row.last_error='';

            await offlineQueueUpdate(row);

            await processOfflineRecord(row);

            await offlineDelete(
              'queue',
              row.id
            );

            success++;

            if(
              row.type.startsWith(
                'FEFO_'
              )
            ){
              touchedFefo=true;
            }

            if(
              row.type==='PULL_STEP'
            ){
              touchedPull=true;
            }

            if(
              row.type==='DAMAGE_CREATE'
            ){
              touchedDamage=true;
            }

          }
          catch(e){

            // Pode ter acontecido:
            // servidor processou a etapa,
            // mas o navegador perdeu a resposta.
            if(row.type==='PULL_STEP'){

              try{

                if(
                  await reconcilePullStepQueueRow(
                    row
                  )
                ){

                  success++;
                  touchedPull=true;

                  continue;
                }

              }
              catch(reconcileError){

                console.warn(
                  '[PUXADA] falha ao reconciliar fila',
                  reconcileError
                );

              }
            }

            row.status='ERROR';

            row.last_error=
              String(
                e?.message
                ||
                e
                ||
                'Erro de sincronização'
              );

            offlineSyncLastError=
              row.last_error;

            await offlineQueueUpdate(row);

            console.warn(
              'Fila offline',
              row.type,
              row.id,
              e
            );

            // Se realmente perdeu internet,
            // nao adianta tentar os demais.
            if(
              offlineIsNetworkError(e)
              ||
              !navigator.onLine
            ){
              break;
            }

            // Um erro logico antigo nao pode
            // bloquear outras viagens/modulos.
            continue;
          }
        }

        if(
          touchedFefo
          &&
          hasPerm('FEFO_CREATE')
        ){
          await loadFefoCurrent(true);
        }

        if(
          touchedPull
          &&
          isPullDriver()
        ){
          await loadPullActiveTrip(true);
        }

        if(
          touchedDamage
          &&
          success
          &&
          !silent
        ){

          toast(
            'Avaria sincronizada. Toque no status Online para abrir o comprovante.',
            'success'
          );

        }

        if(
          success
          &&
          !silent
          &&
          !touchedDamage
        ){

          toast(
            `${success} registro${success===1?'':'s'} sincronizado${success===1?'':'s'}.`,
            'success'
          );

        }

        return !offlineSyncLastError;

      }
      finally{

        offlineSyncRunning=false;

        updateOnlineStatus();

      }

    })();

  offlineSyncPromise=
    current;

  try{

    return await current;

  }
  finally{

    if(
      offlineSyncPromise===current
    ){
      offlineSyncPromise=null;
    }

  }
}
const startAppV151=startApp;
startApp = async function(){await startAppV151();if(!offlinePillBound){$('syncPill')?.addEventListener('click',async()=>{if(navigator.onLine)await syncOfflineQueue({silent:false});if(await offlineOpenNextDamageReceipt())return;if(!navigator.onLine)toast('Sem internet. Os registros continuarão salvos no aparelho.','');else if(!(await offlinePendingCount()))toast('Tudo sincronizado.','success');});offlinePillBound=true;}updateOnlineStatus();if(navigator.onLine)syncOfflineQueue({silent:true});};


// V1.6.0 - CONTROLE POR UNIDADE ---------------------------------------------
const UNIT_ACCESS_CACHE_PREFIX='disb_active_unit_v160_';
function unitAccessKey(){return `${UNIT_ACCESS_CACHE_PREFIX}${authUser?.id||'anon'}`;}
function currentUnit(){return activeUnit||'';}
function hasCurrentUnit(){return !!activeUnit&&myUnits.includes(activeUnit);}
function userUnitsFor(userId){return userUnitRows.filter(x=>String(x.user_id)===String(userId)).map(x=>String(x.unit_name)).sort((a,b)=>a.localeCompare(b,'pt-BR'));}
function renderActiveUnitSelector(){
  const el=$('activeUnitSelect');if(!el)return;
  el.innerHTML=myUnits.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
  if(activeUnit&&myUnits.includes(activeUnit))el.value=activeUnit;
  el.disabled=myUnits.length<=1;
  const wrap=$('activeUnitSwitcher');if(wrap)wrap.classList.toggle('unit-single',myUnits.length<=1);
}

async function loadUnitAccess(){

  if(
    !sb
    ||
    !authUser
  ){
    return false;
  }


  const applyUnits=(units)=>{

    myUnits=[
      ...new Set(
        (units||[])
          .map(
            x=>
              String(
                x||''
              ).trim()
          )
          .filter(Boolean)
      )
    ];


    let saved='';

    try{

      saved=
        localStorage.getItem(
          unitAccessKey()
        )
        ||
        '';

    }
    catch(_e){}


    const local=
      offlineReadUnitAccessV171(
        authUser.id
      );


    const preferred=
      saved
      ||
      local?.active_unit
      ||
      '';


    activeUnit=
      myUnits.includes(
        preferred
      )
        ?preferred
        :(myUnits[0]||'');


    renderActiveUnitSelector();


    return !!activeUnit;
  };


  // ========================================================
  // OFFLINE
  // ========================================================

  if(!navigator.onLine){

    const local=
      offlineReadUnitAccessV171(
        authUser.id
      );


    if(local?.units?.length){

      applyUnits(
        local.units
      );


      setBackendStatus(
        'checking',
        'Modo offline - unidade local'
      );


      return true;
    }


    myUnits=[];
    activeUnit='';

    return false;
  }


  // ========================================================
  // ONLINE
  // ========================================================

  try{

    const {
      data,
      error
    }=
      await sb.rpc(
        'get_my_units'
      );


    if(error)throw error;


    const units=
      (data||[])
        .map(
          x=>
            String(
              x?.unit_name
              ??
              x
              ??
              ''
            ).trim()
        )
        .filter(Boolean);


    applyUnits(
      units
    );


    offlineSaveUnitAccessV171(
      myUnits
    );


    return !!activeUnit;

  }
  catch(error){

    console.warn(
      'Unidades do usuario',
      error
    );


    const local=
      offlineReadUnitAccessV171(
        authUser.id
      );


    if(local?.units?.length){

      applyUnits(
        local.units
      );

      return true;
    }


    myUnits=[];
    activeUnit='';

    return false;
  }
}

function resetUnitScopedState(){
  pendingNris=[];historyNris=[];selectedNris.clear();adminAvarias=[];salesDamageMyRequests=[];salesDamageManageRequests=[];
  fefoActiveCount=null;fefoItems=[];fefoEditingItemId=null;fefoActiveCounts=[];fefoReports=[];fefoItemsByCount.clear();
  rotatingAssetActiveCount=null;rotatingAssetEntries=[];rotatingAssetHistory=[];rotatingAssetEntriesByCount.clear();
  marketplaceActiveReceipt=null;marketplaceDashboardReceipts=[];pullActiveTrip=null;pullDriverEvents=[];pullDriverOccurrences=[];pullHistory=[];
}
async function changeActiveUnit(next){
  next=String(next||'').trim();if(!myUnits.includes(next)||next===activeUnit)return;
  activeUnit=next;try{localStorage.setItem(unitAccessKey(),activeUnit);}catch(_e){}
  resetUnitScopedState();renderActiveUnitSelector();refRefreshPromise=null;refs.units=myUnits.map(name=>({name}));populateReferenceInputs();
  await loadReferences(false);
  if(canNri()){await loadPending(true);if(hasPerm('MARKETPLACE_RECEIVE'))await loadMarketplaceModule(true);if(hasPerm('NRI_PENDING_VIEW'))await loadPullNriPending(true);}
  if(canFefo())await refreshFefoBadge(true);
  if(canRotatingAsset()){await loadRotatingAssetProducts(true);if(hasPerm('ROTATING_ASSET_CREATE'))await loadRotatingAssetCurrent(true);}
  if(hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))await loadAdminAvarias(true);
  if(hasPerm('SALES_DAMAGE_VIEW_OWN'))await loadSalesDamageMy(true);
  if(hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST'))await loadSalesDamageManage(true);
  if(canPull())await initPullModule();
  if(activeView)openView(activeView,true);
  toast(`Unidade atual: ${activeUnit}`,'success');
}

const loadProfileBeforeUnitScope=loadProfile;
loadProfile=async function(user){
  const ok=await loadProfileBeforeUnitScope(user);if(!ok)return false;
  await loadUnitAccess();return true;
};

function renderUserUnitEditor(user=null){
  const box=$('usuarioUnidades');if(!box)return;
  const selected=new Set(user?userUnitsFor(user.id):(activeUnit?[activeUnit]:[]));
  const units=refs.units.length?myUnits.length?[...new Set([...refs.units.map(x=>x.name),...myUnits])]:refs.units.map(x=>x.name):myUnits;
  box.innerHTML=units.length?units.sort((a,b)=>a.localeCompare(b,'pt-BR')).map(u=>`<label class="user-unit-row"><input type="checkbox" data-user-unit="${esc(u)}" ${selected.has(u)?'checked':''}><span>${esc(u)}</span></label>`).join(''):'<div class="empty-state">Nenhuma unidade disponível.</div>';
}
function selectedUserUnits(){return [...($('usuarioUnidades')?.querySelectorAll('[data-user-unit]:checked')||[])].map(x=>x.dataset.userUnit);}

loadUsers=async function(){
  if(!hasPerm('ADMIN_USERS'))return;
  try{
    const [u,pms,rp,up,uu,audit]=await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('permissions').select('*').eq('active',true).order('module').order('sort_order'),
      sb.from('role_permissions').select('*'),
      sb.from('user_permissions').select('*'),
      sb.from('user_units').select('*').order('unit_name'),
      sb.from('user_unit_access_audit').select('*').order('changed_at',{ascending:false}).limit(500)
    ]);
    const err=[u,pms,rp,up,uu,audit].find(x=>x.error)?.error;if(err)throw err;
    users=u.data||[];permissionRows=pms.data||PERMISSION_CATALOG;rolePermissionRows=rp.data||[];userPermissionRows=up.data||[];userUnitRows=uu.data||[];userUnitAuditRows=audit.data||[];
    renderUsers();if(!$('usuarioOriginal').value){renderUserPermissionEditor(null,true);renderUserUnitEditor(null);}
  }catch(e){toast(humanUserAdminError(e),'error');}
};
renderUsers=function(){
  const body=$('tbodyUsuarios');if(!body)return;
  body.innerHTML=users.length?users.map(u=>{const enabled=effectiveUserPermissions(u),custom=userPermissionOverrides(u.id).length,units=userUnitsFor(u.id);return `<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(ROLE_LABELS[u.role]||u.role)}</td><td><strong>${units.length?units.map(esc).join('<br>'):'Sem unidade'}</strong></td><td><strong>${enabled.size} habilitada${enabled.size===1?'':'s'}</strong><small>${u.role==='ADMIN'?'Acesso do perfil Admin':custom?`${custom} exceção(ões) individual(is)`:'Padrão do cargo'}</small></td><td>${u.active?'<span class="status ok">Ativo</span>':'<span class="status bad">Inativo</span>'}</td><td><button class="mini-btn" data-user="${esc(u.username)}">Editar</button></td></tr>`;}).join(''):'<tr><td colspan="7">Nenhum usuário cadastrado.</td></tr>';
};
onUserTableClick=function(e){
  const b=e.target.closest('button[data-user]');if(!b)return;const u=users.find(x=>x.username===b.dataset.user);if(!u)return;
  $('usuarioOriginal').value=u.username;$('usuarioLogin').value=u.username;$('usuarioNome').value=u.name;$('usuarioPerfil').value=u.role;$('usuarioSenha').value='';$('usuarioAtivo').checked=u.active;renderUserPermissionEditor(u,false);renderUserUnitEditor(u);
};
clearUserForm=function(){$('usuarioOriginal').value='';$('usuarioLogin').value='';$('usuarioNome').value='';$('usuarioPerfil').value='COLABORADOR_ARMAZEM';$('usuarioSenha').value='';$('usuarioAtivo').checked=true;renderUserPermissionEditor(null,true);renderUserUnitEditor(null);};
function adminUserErrorText(value){
  if(value==null)return '';
  if(typeof value==='string')return value;
  if(value instanceof Error)return value.message||String(value);
  if(typeof value==='object'){
    const parts=[value.message,value.error,value.details,value.hint,value.code].map(x=>typeof x==='string'?x.trim():'').filter(Boolean);
    if(parts.length)return parts.join(' | ');
    try{return JSON.stringify(value);}catch(_e){return String(value);}
  }
  return String(value);
}

saveUser=async function(e){
  e.preventDefault();
  const original=$('usuarioOriginal').value.trim();
  const units=selectedUserUnits();
  const body={action:original?'update':'create',originalUsername:original,username:$('usuarioLogin').value,name:$('usuarioNome').value,role:$('usuarioPerfil').value,password:$('usuarioSenha').value,active:$('usuarioAtivo').checked,permissions:selectedUserPermissions(),units};
  if(!body.username.trim()||!body.name.trim())return toast('Informe usuário e nome.','error');
  if(body.active&&!units.length)return toast('Selecione ao menos uma unidade para o usuário.','error');
  if(!original&&body.password.length<6)return toast('A senha do novo usuário deve ter pelo menos 6 caracteres.','error');
  const btn=e.submitter||document.querySelector('#formUsuario button[type="submit"], #formUsuario button:not([type])');
  if(btn){btn.disabled=true;btn.textContent='Salvando…';}
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Sua sessão expirou. Saia do sistema e entre novamente.');
    const {data,error}=await sb.functions.invoke('admin-users',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
    if(error){
      let detail='';
      try{
        if(error.context&&typeof error.context.clone==='function'){
          const response=error.context.clone();
          try{
            const parsed=await response.json();
            detail=adminUserErrorText(parsed?.error??parsed?.message??parsed);
          }catch(_jsonErr){detail=await response.text().catch(()=> '');}
        }
      }catch(_e){}
      throw new Error(detail||adminUserErrorText(error)||'Falha ao chamar a função admin-users.');
    }
    if(data?.ok===false)throw new Error(adminUserErrorText(data?.error??data)||'Falha ao salvar usuário.');
    toast(data?.repaired?'Usuário recuperado e salvo com sucesso.':'Usuário, permissões e unidades salvos.','success');
    clearUserForm();
    await loadUsers();
  }catch(err){
    console.error('Falha ao salvar usuário',err);
    toast(humanUserAdminError(err),'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Salvar usuário';}
  }
};

const humanUserAdminErrorUnitBase=humanUserAdminError;
humanUserAdminError=function(e){
  const m=adminUserErrorText(e)||'Erro desconhecido ao salvar usuário.';
  if(m.includes('UNIDADE_OBRIGATORIA'))return 'Selecione ao menos uma unidade para o usuário.';
  if(m.includes('UNIDADE_INVALIDA'))return 'Uma das unidades selecionadas é inválida ou está inativa.';
  if(/admin_set_user_units|42883/i.test(m))return 'O hotfix de unidades ainda não foi aplicado. Execute o SQL 27 e republique a função admin-users.';
  if(/user_units|user_unit_access_audit|get_my_units/i.test(m))return 'A estrutura de unidades apresentou erro no Supabase. Confira se os SQLs 26 e 27 foram executados. Detalhe: '+m;
  return humanUserAdminErrorUnitBase(new Error(m));
};

const startAppBeforeUnitScope=startApp;
startApp=async function(){
  await startAppBeforeUnitScope();renderActiveUnitSelector();
  const select=$('activeUnitSelect');if(select&&!select.dataset.bound){select.addEventListener('change',e=>changeActiveUnit(e.target.value));select.dataset.bound='1';}
  if(!hasCurrentUnit())toast('Seu usuário não possui unidade associada. Solicite ao Admin a liberação em Usuários e perfis.','error');
};


// =============================================================================
// v1.7.0 - PUSH NOTIFICATIONS REAIS (PWA / WINDOWS + APK ANDROID)
// =============================================================================
const PUSH_CHANNEL_V170='disb_avarias';
const PUSH_DEVICE_KEY_V170='disb_push_device_key_v170';
let pushNativeListenersBoundV170=false;
let pushLocalCounterV170=0;

function getCapacitorPushV170(){
  const cap=window.Capacitor;if(!cap)return null;
  return cap.Plugins?.PushNotifications || (typeof cap.registerPlugin==='function'?cap.registerPlugin('PushNotifications'):null);
}
function getCapacitorLocalV170(){
  const cap=window.Capacitor;if(!cap)return null;
  return cap.Plugins?.LocalNotifications || (typeof cap.registerPlugin==='function'?cap.registerPlugin('LocalNotifications'):null);
}
function pushDeviceKeyV170(){
  try{let k=localStorage.getItem(PUSH_DEVICE_KEY_V170);if(!k){k=uuid();localStorage.setItem(PUSH_DEVICE_KEY_V170,k);}return k;}catch(_e){return uuid();}
}
function pushViewForKindV170(kind){
  if(kind==='delivery')return hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST')?'avaria-admin':'avaria-cadastro';
  return hasAnyPerm('SALES_DAMAGE_VIEW_ALL,SALES_DAMAGE_REVIEW,SALES_DAMAGE_OVERRIDE,SALES_DAMAGE_POST')?'sales-avaria-gestao':'sales-avaria-minhas';
}
function openPushViewV170(view){
  const target=String(view||'').trim();if(!target)return;
  const el=$(`view-${target}`);if(el&&!el.classList.contains('hidden'))openView(target,true);
}
function pushPayloadDataV170(payload){
  const data=payload?.data||payload?.notification?.data||payload?.extra||{};
  return {view:String(data?.view||''),kind:String(data?.kind||''),request_id:String(data?.request_id||'')};
}
function pushTitleBodyV170(payload){
  return {title:String(payload?.title||payload?.notification?.title||'Disb Gestão'),body:String(payload?.body||payload?.notification?.body||'Nova atualização disponível.')};
}
function showPushInAppV170(payload){
  const stack=$('damageNotificationStack');if(!stack)return;
  const data=pushPayloadDataV170(payload),tb=pushTitleBodyV170(payload),kind=data.kind==='sales'?'sales':'delivery';
  const card=document.createElement('div');card.className=`damage-notification-card ${kind}`;card.setAttribute('role','button');card.tabIndex=0;
  const icon=kind==='sales'?'&#128722;':'&#128666;';
  card.innerHTML=`<div class="damage-notification-icon">${icon}</div><div class="damage-notification-content"><strong>${esc(tb.title)}</strong><span>${esc(tb.body)}</span><small>Clique para abrir</small></div><button type="button" class="damage-notification-close" aria-label="Fechar">&times;</button>`;
  const open=()=>{card.remove();openPushViewV170(data.view||pushViewForKindV170(kind));};
  card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});card.querySelector('.damage-notification-close')?.addEventListener('click',e=>{e.stopPropagation();card.remove();});
  stack.prepend(card);
}
function base64UrlToBytesV170(value){
  const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
async function savePushDeviceV170(channel,data={}){
  if(!sb)throw new Error('SUPABASE_PUSH_INDISPONIVEL');
  if(!authUser?.id)throw new Error('USUARIO_PUSH_NAO_AUTENTICADO');

  const unit=String(activeUnit||'').trim();

  if(!unit)throw new Error('UNIDADE_PUSH_NAO_DEFINIDA');

  const row={
    user_id:authUser.id,
    device_key:pushDeviceKeyV170(),
    channel,
    unit,
    subscription:channel==='WEB'?(data.subscription||null):null,
    fcm_token:channel==='FCM'?String(data.token||''):null,
    platform:isNativeCapacitor()?'ANDROID':'WEB',
    device_name:isNativeCapacitor()?'Disb Gestao Android':'Disb Gestao PWA',
    user_agent:String(navigator.userAgent||'').slice(0,900),
    active:true,
    last_seen_at:new Date().toISOString()
  };

  console.log('[PUSH] Tentando salvar dispositivo',{
    channel:row.channel,
    unit:row.unit,
    user_id:row.user_id,
    platform:row.platform
  });

  const {data:saved,error}=await sb
    .from('push_devices')
    .upsert(row,{
      onConflict:'user_id,device_key,channel'
    })
    .select('id,user_id,channel,unit,active')
    .single();

  if(error){
    console.error('[PUSH] ERRO push_devices',error);

    throw new Error(
      'PUSH_DATABASE: '+
      String(error?.message||error?.code||error)
    );
  }

  if(!saved?.id){
    throw new Error('DISPOSITIVO_PUSH_NAO_GRAVADO');
  }

  console.log('[PUSH] DISPOSITIVO REGISTRADO',saved);

  return true;
}
async function deactivatePushDeviceV170(){
  if(!sb||!authUser)return;
  try{await sb.from('push_devices').update({active:false,last_seen_at:new Date().toISOString()}).eq('user_id',authUser.id).eq('device_key',pushDeviceKeyV170());}catch(e){console.warn('Desativar push',e);}
}
async function getVapidPublicKeyV170(){
  const {
    data:{session},
    error:sessionError
  }=await sb.auth.getSession();

  if(sessionError){
    console.error('[PUSH] Erro ao obter sessao',sessionError);
    throw new Error('SESSAO_PUSH_ERRO');
  }

  if(!session?.access_token){
    throw new Error('SESSAO_PUSH_EXPIRADA');
  }

  console.log('[PUSH] Solicitando VAPID');

  const {data,error}=await sb.functions.invoke(
    'push-notifications',
    {
      body:{
        action:'config'
      },
      headers:{
        Authorization:`Bearer ${session.access_token}`
      }
    }
  );

  if(error){
    console.error('[PUSH] Erro Edge Function config',error);

    throw new Error(
      'EDGE_CONFIG_PUSH: '+
      String(error?.message||error)
    );
  }

  if(data?.error){
    throw new Error(
      'EDGE_CONFIG_PUSH: '+
      String(data.error)
    );
  }

  if(!data?.vapid_public_key){
    throw new Error('VAPID_NAO_CONFIGURADO');
  }

  console.log('[PUSH] VAPID recebida');

  return String(data.vapid_public_key);
}
async function registerWebPushV170({requestPermission=false}={}){
  console.log('[PUSH] Iniciando registro WEB',{
    requestPermission,
    permission:('Notification' in window?Notification.permission:'unsupported'),
    unit:String(activeUnit||''),
    user:authUser?.id||''
  });

  if(!('serviceWorker' in navigator)){
    throw new Error('SERVICE_WORKER_NAO_SUPORTADO');
  }

  if(!('PushManager' in window)){
    throw new Error('PUSH_MANAGER_NAO_SUPORTADO');
  }

  if(!('Notification' in window)){
    throw new Error('NOTIFICATION_API_NAO_SUPORTADA');
  }

  let permission=Notification.permission;

  if(requestPermission&&permission!=='granted'){
    permission=await Notification.requestPermission();
  }

  console.log('[PUSH] Permissao',permission);

  if(permission!=='granted'){
    throw new Error('PERMISSAO_NOTIFICACOES_NEGADA');
  }

  const reg=await navigator.serviceWorker.ready;

  if(!reg){
    throw new Error('SERVICE_WORKER_NAO_PRONTO');
  }

  console.log('[PUSH] Service Worker pronto');

  let sub=await reg.pushManager.getSubscription();

  if(!sub){
    console.log('[PUSH] Criando subscription');

    const key=await getVapidPublicKeyV170();

    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToBytesV170(key)
    });
  }
  else{
    console.log('[PUSH] Subscription existente');
  }

  if(!sub){
    throw new Error('SUBSCRIPTION_PUSH_NAO_CRIADA');
  }

  const subscription=sub.toJSON();

  if(!subscription?.endpoint){
    throw new Error('SUBSCRIPTION_SEM_ENDPOINT');
  }

  console.log('[PUSH] Endpoint pronto');

  const saved=await savePushDeviceV170(
    'WEB',
    {
      subscription
    }
  );

  if(!saved){
    throw new Error('DISPOSITIVO_PUSH_NAO_GRAVADO');
  }

  console.log('[PUSH] Registro WEB concluido');

  return true;
}
async function nativeForegroundSystemNotificationV170(payload){
  const local=getCapacitorLocalV170();if(!local)return false;try{let p=await local.checkPermissions();if(String(p?.display||'').toLowerCase()!=='granted')return false;const tb=pushTitleBodyV170(payload),data=pushPayloadDataV170(payload);pushLocalCounterV170=(pushLocalCounterV170+1)%1000;const id=(Math.floor(Date.now()/1000)%2000000000)+pushLocalCounterV170;await local.schedule({notifications:[{id,title:tb.title,body:tb.body,channelId:PUSH_CHANNEL_V170,extra:data}]});return true;}catch(e){console.warn('Notificação local de push',e);return false;}
}
async function setupNativePushV170({requestPermission=false}={}){
  const push=getCapacitorPushV170();if(!push)throw new Error('PUSH_ANDROID_INDISPONIVEL');
  if(!pushNativeListenersBoundV170){
    await push.addListener('registration',async token=>{try{await savePushDeviceV170('FCM',{token:token?.value||''});await updatePushButtonV170();}catch(e){console.warn('Salvar token FCM',e);}});
    await push.addListener('registrationError',e=>console.error('FCM registration',e));
    await push.addListener('pushNotificationReceived',async notification=>{showPushInAppV170(notification);await nativeForegroundSystemNotificationV170(notification);});
    await push.addListener('pushNotificationActionPerformed',action=>openPushViewV170(pushPayloadDataV170(action?.notification).view));
    pushNativeListenersBoundV170=true;
  }
  try{await push.createChannel({id:PUSH_CHANNEL_V170,name:'Avarias',description:'Novas avarias de entrega e vendas',importance:5,visibility:1,vibration:true});}catch(_e){}
  const local=getCapacitorLocalV170();if(local){try{await local.createChannel({id:PUSH_CHANNEL_V170,name:'Avarias',description:'Novas avarias de entrega e vendas',importance:5,visibility:1,vibration:true});}catch(_e){}}
  let permission=await push.checkPermissions();if(requestPermission&&String(permission?.receive||'').toLowerCase()!=='granted')permission=await push.requestPermissions();if(String(permission?.receive||'').toLowerCase()!=='granted')throw new Error('PERMISSAO_NOTIFICACOES_NEGADA');
  if(local&&requestPermission){try{const lp=await local.checkPermissions();if(String(lp?.display||'').toLowerCase()!=='granted')await local.requestPermissions();}catch(_e){}}
  await push.register();return true;
}
async function pushPermissionStatusV170(){
  if(isNativeCapacitor()){const push=getCapacitorPushV170();if(!push)return 'unsupported';try{const p=await push.checkPermissions(),v=String(p?.receive||'').toLowerCase();return v==='granted'?'granted':v==='denied'?'denied':'default';}catch{return 'default';}}
  if(!('Notification' in window)||!('PushManager' in window))return 'unsupported';return Notification.permission;
}
async function updatePushButtonV170(){

  const btn=$('btnNotifications');

  if(!btn)return;

  const allowed=
    hasPerm(
      'DAMAGE_NOTIFICATION'
    );

  btn.classList.toggle(
    'hidden',
    !allowed
  );

  if(!allowed){

    btn.classList.remove(
      'enabled',
      'denied',
      'attention'
    );

    btn.title=
      'Notificacao avaria nao habilitada no perfil';

    return;
  }

  const status=
    await pushPermissionStatusV170();

  btn.classList.toggle(
    'enabled',
    status==='granted'
  );

  btn.classList.toggle(
    'denied',
    status==='denied'
  );

  btn.classList.toggle(
    'attention',
    status==='default'
  );

  btn.title=
    status==='granted'
      ?'Push de avarias ativado neste dispositivo'
      :status==='denied'
        ?'Notificacoes bloqueadas neste dispositivo'
        :'Clique para ativar notificacoes neste dispositivo';
}
async function enablePushNotificationsV170(){

  if(
    !hasPerm(
      'DAMAGE_NOTIFICATION'
    )
  ){

    toast(
      'Seu perfil nao possui a permissao Notificacao avaria.',
      'error'
    );

    return false;
  }

  try{

    if(isNativeCapacitor()){

      await setupNativePushV170({
        requestPermission:true
      });

    }
    else{

      await registerWebPushV170({
        requestPermission:true
      });

    }

    toast(
      'Notificacoes ativadas e dispositivo registrado.',
      'success'
    );

    return true;

  }
  catch(e){

    const m=
      String(e?.message||e||'');

    console.error(
      '[PUSH] Falha completa',
      e
    );

    let mensagem=
      'Push: '+m;

    if(
      m.includes(
        'PERMISSAO_NOTIFICACOES_NEGADA'
      )
    ){
      mensagem=
        'As notificacoes estao bloqueadas neste dispositivo.';
    }

    toast(
      mensagem,
      'error'
    );

    return false;

  }
  finally{

    await updatePushButtonV170();

  }
}
async function refreshPushRegistrationV170(){

  if(
    !authUser
    ||
    !activeUnit
    ||
    !navigator.onLine
  ){
    return false;
  }

  if(
    !hasPerm(
      'DAMAGE_NOTIFICATION'
    )
  ){

    await deactivatePushDeviceV170();

    await updatePushButtonV170();

    return false;
  }

  try{

    const status=
      await pushPermissionStatusV170();

    if(status!=='granted'){
      return false;
    }

    if(isNativeCapacitor()){

      await setupNativePushV170({
        requestPermission:false
      });

    }
    else{

      await registerWebPushV170({
        requestPermission:false
      });

    }

    return true;

  }
  catch(e){

    console.warn(
      'Atualizar registro push',
      e
    );

    return false;

  }
}
async function dispatchDamagePushV170(kind,requestId){
  if(!sb||!authUser||!navigator.onLine||!requestId){

    const motivos=[];

    if(!sb)motivos.push('SUPABASE_AUSENTE');
    if(!authUser)motivos.push('USUARIO_AUSENTE');
    if(!navigator.onLine)motivos.push('OFFLINE');
    if(!requestId)motivos.push('REQUEST_ID_AUSENTE');

    window.__lastPushDispatchV170={
      at:new Date().toISOString(),
      kind,
      requestId:requestId||null,
      stage:'precheck',
      data:null,
      error:'PRECHECK_PUSH:'+motivos.join(',')
    };

    console.warn(
      '[PUSH DISPATCH] parametros ausentes',
      window.__lastPushDispatchV170
    );

    return false;
  }

  try{
    console.log('[PUSH DISPATCH] iniciando',{
      kind,
      requestId,
      user:authUser.id,
      unit:activeUnit
    });

    const {
      data:{session},
      error:sessionError
    }=await sb.auth.getSession();

    if(sessionError){
      throw new Error(
        'SESSAO_PUSH_ERRO: '+
        String(sessionError?.message||sessionError)
      );
    }

    if(!session?.access_token){
      throw new Error('SESSAO_PUSH_EXPIRADA');
    }

    const {data,error}=await sb.functions.invoke(
      'push-notifications',
      {
        body:{
          action:'dispatch',
          kind,
          request_id:requestId
        },
        headers:{
          Authorization:`Bearer ${session.access_token}`
        }
      }
    );

    console.log('[PUSH DISPATCH] retorno',{
      data,
      error
    });

    window.__lastPushDispatchV170={
      at:new Date().toISOString(),
      kind,
      requestId,
      data,
      error:error?String(error?.message||error):null
    };

    if(error){
      const msg=String(
        error?.message||
        error?.context?.statusText||
        error
      );

      toast(
        'Push: erro ao chamar servidor. '+msg,
        'error'
      );

      console.error('[PUSH DISPATCH] erro Edge Function',error);

      return false;
    }

    if(data?.error){

      toast(
        'Push: servidor recusou o envio. '+String(data.error),
        'error'
      );

      console.error('[PUSH DISPATCH] servidor',data);

      return false;
    }

    const recipients=Number(data?.recipients||0);
    const sent=Number(data?.sent||0);
    const failed=Number(data?.failed||0);
    const errors=Array.isArray(data?.errors)?data.errors:[];

    console.log('[PUSH DISPATCH] resultado',{
      recipients,
      sent,
      failed,
      errors
    });

    if(!recipients){

      console.log(
        '[PUSH DISPATCH] nenhum perfil com Notificacao avaria habilitada nesta unidade'
      );

      return true;
    }

    if(failed>0 || sent===0){

      const detail=errors.length
        ? ' Erro: '+String(errors[0]).slice(0,180)
        : '';

      toast(
        `Push: ${recipients} destinatario(s), ${sent} enviado(s), ${failed} falha(s).${detail}`,
        'error'
      );

      return false;
    }

    toast(
      `Push: ${recipients} destinatario(s), ${sent} enviado(s), ${failed} falha(s).`,
      'success'
    );

    return true;
  }
  catch(e){

    const msg=String(e?.message||e||'ERRO_PUSH');

    console.error(
      '[PUSH DISPATCH] excecao',
      kind,
      requestId,
      e
    );

    window.__lastPushDispatchV170={
      at:new Date().toISOString(),
      kind,
      requestId,
      exception:msg
    };

    toast(
      'Push: '+msg,
      'error'
    );

    return false;
  }
}
async function initPushNotificationsV170(){

  const btn=$('btnNotifications');

  if(
    btn
    &&
    !btn.dataset.pushV170
  ){

    btn.addEventListener(
      'click',
      enablePushNotificationsV170
    );

    btn.dataset.pushV170='1';
  }

  if(
    !hasPerm(
      'DAMAGE_NOTIFICATION'
    )
  ){

    await deactivatePushDeviceV170();

    await updatePushButtonV170();

    return;
  }

  const status=
    await pushPermissionStatusV170();

  if(status==='granted'){

    try{

      if(isNativeCapacitor()){

        await setupNativePushV170({
          requestPermission:false
        });

      }
      else{

        await registerWebPushV170({
          requestPermission:false
        });

      }

    }
    catch(e){

      console.warn(
        'Inicializar Push',
        e
      );

    }
  }

  await updatePushButtonV170();

  let pending='';

  try{

    pending=
      new URLSearchParams(
        location.search
      ).get(
        'notificationView'
      )||'';

  }
  catch(_e){}

  if(pending){

    setTimeout(
      ()=>openPushViewV170(pending),
      150
    );

    try{

      history.replaceState(
        {},
        '',
        location.pathname+
        location.hash
      );

    }
    catch(_e){}
  }
}
if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='DISB_OPEN_PUSH_NOTIFICATION')openPushViewV170(e.data.view);});}

// Realtime permanece somente para atualizar telas; o alerta externo agora vem do Push remoto.
setupRealtime=function(){
  teardownRealtime();
  realtimeChannel=sb.channel(`ops-${authUser.id}`);
  if(canNri()){realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'nris'},()=>debounceReload('nri'));realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'marketplace_receipts'},()=>debounceReload('marketplace'));}
  if(hasAnyPerm('DELIVERY_DAMAGE_VIEW_ALL,DELIVERY_DAMAGE_REVIEW,DELIVERY_DAMAGE_POST'))realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'damage_requests'},()=>debounceReload('avaria'));
  if(canSalesDamage()){realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'sales_damage_requests'},()=>debounceReload('sales_damage'));realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'sales_damage_items'},()=>debounceReload('sales_damage'));}
  if(canConference())realtimeChannel.on('postgres_changes',{event:'INSERT',schema:'public',table:'container_conferences'},()=>debounceReload('conf'));
  if(canFefo()){realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'fefo_counts'},()=>debounceReload('fefo'));realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'fefo_count_items'},()=>debounceReload('fefo'));}
  if(canRotatingAsset()){realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'rotating_asset_counts'},()=>debounceReload('rotating_asset'));realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table:'rotating_asset_entries'},()=>debounceReload('rotating_asset'));}
  realtimeChannel.subscribe();
};


// V1.7.0 - LOGIN / OPERACAO OFFLINE APK -----------------------

const loadReferencesOnlineV171=
  loadReferences;

loadReferences=async function(
  useCache=false
){

  if(!navigator.onLine){

    const cached=
      readRefCache();

    if(cached){

      refs=cached;

      rebuildReferenceMaps();

      populateReferenceInputs();

    }
    else{

      console.warn(
        '[OFFLINE] Base local de produtos/clientes ainda nao existe.'
      );

    }

    return;
  }


  return await loadReferencesOnlineV171(
    useCache
  );
};


const setupRealtimeOnlineV171=
  setupRealtime;

setupRealtime=function(){

  if(!navigator.onLine){

    teardownRealtime();

    return;
  }


  return setupRealtimeOnlineV171();
};


const initPushNotificationsOnlineV171=
  initPushNotificationsV170;

initPushNotificationsV170=
  async function(){

    if(!navigator.onLine){

      try{
        await updatePushButtonV170();
      }
      catch(_e){}

      return;
    }


    return await initPushNotificationsOnlineV171();
  };


const deactivatePushDeviceOnlineV171=
  deactivatePushDeviceV170;

deactivatePushDeviceV170=
  async function(){

    if(!navigator.onLine){
      return;
    }

    return await deactivatePushDeviceOnlineV171();
  };


const changeActiveUnitBeforePushV170=changeActiveUnit;
changeActiveUnit=async function(next){await changeActiveUnitBeforePushV170(next);await refreshPushRegistrationV170();};

const logoutBeforePushV170=logout;
logout=async function(){await deactivatePushDeviceV170();return logoutBeforePushV170();};

const startAppBeforePushV170=startApp;
startApp=async function(){await startAppBeforePushV170();await initPushNotificationsV170();};

})();
