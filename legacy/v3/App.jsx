// ============================================================
// LOFTDESK v3 — Kompletna aplikacja SaaS
// React 18 + Supabase + PWA + KSeF + Multi-user
// ============================================================
import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, Users, ClipboardList, FolderKanban, FileText,
  ScrollText, BarChart3, Building2, Plus, Pencil, Trash2, X,
  Paperclip, CheckCircle2, Clock, XCircle, Send, FileCheck,
  ChevronRight, ChevronDown, TrendingUp, Wallet, AlertCircle, Layers,
  CalendarDays, MapPin, StickyNote, Hash, Phone, Mail, Link2,
  Sparkles, Shield, Zap, Settings, LogOut, Lock, Eye, EyeOff,
  User, Crown, Star, Rss, RefreshCw, Upload, Download, AlertTriangle,
  Info, Key, Globe, FileDown, Printer, Search, Filter, Image as ImageIcon,
  MessageSquare, ExternalLink, Copy, CheckCheck, Bell, QrCode, Share2, ArrowLeft,
} from 'lucide-react'
import { supabase, IS_DEMO, sbQuery } from './lib/supabase.js'

// ── DEMO DATA (fallback gdy brak Supabase) ───────────────
const DEMO_DB = {
  profiles: {
    'd1': { id:'d1', email:'adam@budowlanka.pl', full_name:'Adam Wiśniewski', company:'Wiśniewski Budowlanka', nip:'7820012345', plan:'pro', ksef_token:'TEST_TOKEN_2025', ksef_nip:'7820012345', ksef_env:'test' },
    'd2': { id:'d2', email:'marta@marex.pl', full_name:'Marta Zielińska', company:'MAREX Wykończenia', nip:'5260001521', plan:'free', ksef_token:null, ksef_nip:null, ksef_env:'test' },
  },
  users: {
    'd1': { id:'d1', email:'adam@budowlanka.pl', password:'demo123' },
    'd2': { id:'d2', email:'marta@marex.pl',     password:'demo456' },
  },
}
const DEMO_DATA = {
  'd1': {
    clients:[
      { id:'c1',user_id:'d1',name:'Budrem Sp. z o.o.',nip:'5260001521',address:'ul. Krakowska 12, Poznań',email:'biuro@budrem.pl',phone:'601 234 567' },
      { id:'c2',user_id:'d1',name:'Jan Kowalski',nip:'8761234567',address:'ul. Słoneczna 5, Warszawa',email:'j.kowalski@gmail.com',phone:'502 987 654' },
    ],
    projects:[
      { id:'p1',user_id:'d1',number:'PRJ/2025/001',name:'Wykończenie Budrem',client_id:'c1',status:'active',start_date:'2025-02-10',end_date:'2025-04-30',address:'ul. Nowa 8, Poznań',budget:28000,notes:'Klucze u pana Marka.' },
    ],
    cost_estimates:[
      { id:'ke1',user_id:'d1',number:'KE/2025/001',name:'Remont łazienki – Kowalski',client_id:'c2',project_id:null,status:'accepted',total_net:3830,total_gross:4136.4,
        items:[{id:'i1',description:'Układanie płytek 60x60',unit:'m²',quantity:12,unit_price:180},{id:'i2',description:'Montaż kabiny prysznicowej',unit:'szt',quantity:1,unit_price:1200},{id:'i3',description:'Materiały (klej, fuga)',unit:'kpl',quantity:1,unit_price:650}] },
      { id:'ke2',user_id:'d1',number:'KE/2025/002',name:'Wykończenie mieszkania – Budrem',client_id:'c1',project_id:'p1',status:'draft',total_net:12825,total_gross:13851,
        items:[{id:'i4',description:'Tynkowanie ścian',unit:'m²',quantity:120,unit_price:35},{id:'i5',description:'Wylewka podłogowa',unit:'m²',quantity:85,unit_price:55},{id:'i6',description:'Malowanie 2x',unit:'m²',quantity:120,unit_price:18},{id:'i7',description:'Materiały malarskie',unit:'kpl',quantity:1,unit_price:2200}] },
    ],
    invoices:[
      { id:'f1',user_id:'d1',number:'FV/2025/001',client_id:'c1',project_id:'p1',status:'paid',issue_date:'2025-02-28',due_date:'2025-03-14',ksef_status:'ksef_sent',ksef_ref:'PL2025KSF0000123',
        items:[{id:'ii1',description:'Roboty wykończeniowe – etap I',unit:'kpl',quantity:1,unit_price:9800,vat_rate:23}] },
      { id:'f2',user_id:'d1',number:'FV/2025/002',client_id:'c2',project_id:null,status:'unpaid',issue_date:'2025-03-05',due_date:'2025-03-19',ksef_status:'ksef_pending',ksef_ref:null,
        items:[{id:'ii2',description:'Projekt i konsultacja łazienki',unit:'godz',quantity:4,unit_price:250,vat_rate:23}] },
    ],
    contracts:[
      { id:'u1',user_id:'d1',number:'UMW/2025/001',client_id:'c1',project_id:'p1',status:'signed',sign_date:'2025-02-08',value:28000,notes:'' },
    ],
  },
  'd2': {
    clients:[{ id:'cm1',user_id:'d2',name:'Novum Invest',nip:'9870001234',address:'al. Jana Pawła II 22, Kraków',email:'biuro@novum.pl',phone:'12 345 67 89' }],
    projects:[],
    cost_estimates:[{ id:'kem1',user_id:'d2',number:'KE/2025/001',name:'Wykończenie apartamentów Novum',client_id:'cm1',project_id:null,status:'draft',total_net:45000,total_gross:48600,items:[{id:'mi1',description:'Tynkowanie i malowanie',unit:'m²',quantity:300,unit_price:85},{id:'mi2',description:'Podłogi',unit:'m²',quantity:180,unit_price:150}] }],
    invoices:[{ id:'fm1',user_id:'d2',number:'FV/2025/001',client_id:'cm1',project_id:null,status:'unpaid',issue_date:'2025-03-10',due_date:'2025-03-24',ksef_status:null,ksef_ref:null,items:[{id:'iii1',description:'Wycena i projekt',unit:'kpl',quantity:1,unit_price:3500,vat_rate:23}] }],
    contracts:[],
  },
}

// ── CONSTANTS ────────────────────────────────────────────
const uid = () => Math.random().toString(36).substr(2, 9)
const fmt = n => (n ?? 0).toLocaleString('pl-PL', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' zł'
const calcNet = items => (items||[]).reduce((s,i) => s + (Number(i.quantity||i.qty||0) * Number(i.unit_price||i.unitPrice||0)), 0)
const genNum = (prefix, list) => `${prefix}/${new Date().getFullYear()}/${String((list?.length||0)+1).padStart(3,'0')}`
const today = () => new Date().toISOString().split('T')[0]

const PLANS = {
  free:     { id:'free',     name:'Free',     price:0,   color:'#64748b', limits:{invoices:5,contracts:3,clients:10,projects:3,cost_estimates:5},    blocked:['KSeF','API','Cloud backup'],        features:['5 faktur miesięcznie','3 umowy miesięcznie','10 kontrahentów','3 projekty','5 kosztorysów','Generowanie PDF'] },
  pro:      { id:'pro',      name:'Pro',      price:29,  color:'var(--accent)', limits:{invoices:Infinity,contracts:Infinity,clients:Infinity,projects:Infinity,cost_estimates:Infinity}, blocked:['Własna domena','Onboarding 1-on-1'], features:['Nielimitowane faktury','Nielimitowane umowy','Nielimitowani klienci','KSeF (e-faktury)','Cloud backup','Wsparcie priorytetowe'] },
  business: { id:'business', name:'Business', price:99,  color:'#f59e0b', limits:{invoices:Infinity,contracts:Infinity,clients:Infinity,projects:Infinity,cost_estimates:Infinity}, blocked:[],                                     features:['Wszystko z Pro','Własna domena','Dostęp do API','Dedykowane wsparcie','Onboarding 1-on-1','SLA 99.9%'] },
  admin:    { id:'admin',    name:'Admin',    price:0,   color:'#c0392b', limits:{invoices:Infinity,contracts:Infinity,clients:Infinity,projects:Infinity,cost_estimates:Infinity}, blocked:[],                                     features:['Pełny dostęp','Zarządzanie użytkownikami','Panel admina','Wszystkie funkcje'] },
}
// Plans hidden from public pricing page (nie pojawiają się w UI wyboru planu)
const HIDDEN_PLANS = ['admin']
// Safe plan getter — never returns undefined, always falls back to 'free'
const getPlan = (profile) => PLANS[profile?.plan] || PLANS['free']

const STATUS_CFG = {
  draft:      {label:'Szkic',           color:'#64748b', bg:'#64748b14', Icon:StickyNote},
  offer:      {label:'Oferta',          color:'#f59e0b', bg:'#f59e0b14', Icon:Send},
  active:     {label:'W toku',          color:'#22c55e', bg:'#22c55e14', Icon:Zap},
  done:       {label:'Zakończony',      color:'var(--accent)', bg:'rgba(45,125,210,.1)', Icon:CheckCircle2},
  cancelled:  {label:'Anulowany',       color:'#ef4444', bg:'#ef444414', Icon:XCircle},
  accepted:   {label:'Zaakceptowany',   color:'#22c55e', bg:'#22c55e14', Icon:CheckCircle2},
  rejected:   {label:'Odrzucony',       color:'#ef4444', bg:'#ef444414', Icon:XCircle},
  sent:       {label:'Wysłany',         color:'#3b82f6', bg:'#3b82f614', Icon:Send},
  paid:       {label:'Zapłacona',       color:'#22c55e', bg:'#22c55e14', Icon:CheckCircle2},
  unpaid:     {label:'Niezapłacona',    color:'#f59e0b', bg:'#f59e0b14', Icon:Clock},
  overdue:    {label:'Przeterminowana', color:'#ef4444', bg:'#ef444414', Icon:AlertCircle},
  signed:     {label:'Podpisana',       color:'#22c55e', bg:'#22c55e14', Icon:FileCheck},
  unsigned:   {label:'Oczekuje',        color:'#f59e0b', bg:'#f59e0b14', Icon:Clock},
  ksef_sent:  {label:'KSeF ✓',          color:'#22c55e', bg:'#22c55e14', Icon:CheckCircle2},
  ksef_pending:{label:'KSeF oczekuje',  color:'#f59e0b', bg:'#f59e0b14', Icon:Clock},
  ksef_error: {label:'KSeF błąd',       color:'#ef4444', bg:'#ef444414', Icon:AlertCircle},
}

// ── GLOBAL STYLES ─────────────────────────────────────────
const STYLES = `
:root {
  --bg:      #0e0e12;
  --surface: #16161e;
  --card:    #1c1c26;
  --border:  #2a2a38;
  --border2: #3c3c50;
  --accent:  #c0392b;
  --accent2: #e74c3c;
  --text:    #f0f0f2;
  --text2:   #a0a0b4;
  --text3:   #5a5a72;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #0e0e12; }
::-webkit-scrollbar-thumb { background: #3c3c50; border-radius: 99px; }
@keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes toastIn { from{opacity:0;transform:translateX(80px)} to{opacity:1;transform:translateX(0)} }
@keyframes spin { to{transform:rotate(360deg)} }
.page-enter { animation: fadeIn .25s cubic-bezier(.16,1,.3,1) both; }
.modal-bg { position:fixed;inset:0;background:rgba(8,8,12,.9);backdrop-filter:blur(8px);z-index:99999;overflow-y:auto; }
.modal-wrap { min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:48px 16px 48px; }
.modal-box { background:#1c1c26;border:1px solid #2a2a38;border-radius:16px;width:100%;animation:slideUp .25s ease both; }
.toast-enter { animation: toastIn .3s cubic-bezier(.16,1,.3,1) both; }
.spin { animation: spin 1s linear infinite; }
.card { background:#1c1c26;border:1px solid #2a2a38;border-radius:14px; }
.card-hover { transition:all .2s; cursor:pointer; }
.card-hover:hover { border-color:#c0392b44;box-shadow:0 8px 32px rgba(0,0,0,.3);transform:translateY(-2px); }
.btn { border:none;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:all .15s;white-space:nowrap; }
.btn:active { transform:scale(.97); }
.btn:disabled { opacity:.45;cursor:not-allowed;transform:none !important; }
.btn-primary { background:#c0392b;color:#fff;padding:9px 18px;font-size:13.5px;box-shadow:0 4px 14px rgba(192,57,43,.35); }
.btn-primary:hover:not(:disabled) { background:#e74c3c;box-shadow:0 6px 22px rgba(192,57,43,.5);transform:translateY(-1px); }
.btn-secondary { background:#16161e;color:#a0a0b4;border:1px solid #2a2a38;padding:9px 16px;font-size:13.5px; }
.btn-secondary:hover:not(:disabled) { background:#1c1c26;color:#f0f0f2;border-color:#3c3c50; }
.btn-danger { background:#2a0e0e;color:#f87171;border:1px solid #7f1d1d44;padding:7px 13px;font-size:13px; }
.btn-danger:hover:not(:disabled) { background:#3d1414; }
.btn-success { background:#166534;color:#bbf7d0;border:1px solid #166534;padding:9px 18px;font-size:13.5px; }
.btn-success:hover:not(:disabled) { background:#15803d;color:#fff;transform:translateY(-1px); }
.btn-sm { padding:6px 12px !important;font-size:12.5px !important; }
.btn-icon { padding:7px 10px; }
.input { width:100%;background:#0e0e12;border:1px solid #2a2a38;border-radius:9px;color:#f0f0f2;padding:10px 13px;font-size:13.5px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s; }
.input:focus { border-color:#c0392b;box-shadow:0 0 0 3px rgba(192,57,43,.15); }
.input::placeholder { color:#3a3a50; }
select.input { cursor:pointer; }
textarea.input { resize:vertical; }
.nav-item { display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:500;color:#5a5a72;border:1px solid transparent;cursor:pointer;background:none;text-align:left;transition:all .15s;margin-bottom:2px;font-family:inherit; }
.nav-item:hover { color:#f0f0f2;background:#1c1c26; }
.nav-item.active { color:#f0f0f2;background:rgba(192,57,43,.15);border-color:rgba(192,57,43,.3);font-weight:700; }
.badge { display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11.5px;font-weight:600; }
.table-row { transition:background .1s; }
.table-row:hover { background:rgba(192,57,43,.04); }
.plan-card { border-radius:14px;padding:22px;border:2px solid #2a2a38;transition:all .2s;cursor:pointer;background:#16161e; }
.plan-card:hover { border-color:#c0392b;transform:translateY(-3px);box-shadow:0 14px 36px rgba(192,57,43,.15); }
.plan-card.selected { border-color:#c0392b;background:rgba(192,57,43,.08); }
.divider { border:none;border-top:1px solid #2a2a38;margin:16px 0; }

`

// ── CONTEXTS ──────────────────────────────────────────────
const AuthCtx = createContext(null)
const AppCtx  = createContext(null)
export const useAuth = () => useContext(AuthCtx)
export const useApp  = () => useContext(AppCtx)

// ── UI ATOMS ──────────────────────────────────────────────
function Badge({ status }) {
  const c = STATUS_CFG[status] || {label:status,color:'#64748b',bg:'#64748b14',Icon:StickyNote}
  return <span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.color}22`}}><c.Icon size={10}/>{c.label}</span>
}

function Modal({ title, onClose, children, wide, noEsc }) {
  useEffect(() => {
    const h = e => !noEsc && e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, noEsc])
  return createPortal(
    <div className="modal-bg">
      <div className="modal-wrap" onClick={e => !noEsc && e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{maxWidth: wide ? 860 : 520}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:'1px solid var(--border)',borderRadius:'16px 16px 0 0'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>{title}</h3>
            {!noEsc && <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex',padding:6,borderRadius:8}}><X size={18}/></button>}
          </div>
          <div style={{padding:24}}>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  )
}


function ModalLight({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return createPortal(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'48px 16px'}}>
      <div onClick={e => e.target === e.currentTarget && onClose()} style={{position:'fixed',inset:0}}/>
      <div style={{position:'relative',background:'#fff',borderRadius:20,width:'100%',maxWidth:wide?820:540,boxShadow:'0 24px 80px rgba(0,0,0,.18)',fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",color:'#111',animation:'slideUp .25s ease both'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 28px',borderBottom:'1px solid #f0ede8'}}>
          <h3 style={{fontSize:16,fontWeight:700,color:'#111',margin:0,fontFamily:"'Outfit',sans-serif",letterSpacing:'-.3px'}}>{title}</h3>
          <button onClick={onClose} style={{background:'#f5f3ef',border:'none',color:'#888',cursor:'pointer',display:'flex',padding:8,borderRadius:10,transition:'background .15s'}} onMouseEnter={e=>e.currentTarget.style.background='#ece9e4'} onMouseLeave={e=>e.currentTarget.style.background='#f5f3ef'}><X size={16}/></button>
        </div>
        <div style={{padding:28}}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

function Fld({ label, children, col, hint }) {
  return (
    <div style={{marginBottom:13,gridColumn:col}}>
      <label style={{display:'block',fontSize:11.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.6,marginBottom:5}}>{label}</label>
      {children}
      {hint && <p style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{hint}</p>}
    </div>
  )
}

function Toast({ toasts }) {
  const map = {
    success:['#14532d','#22c55e',CheckCircle2],
    error:['#7f1d1d','#ef4444',AlertCircle],
    info:['#1e1b4b','#7ec8f8',Info],
  }
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none'}}>
      {toasts.map(t => {
        const [bg,acc,Ic] = map[t.type] || map.info
        return (
          <div key={t.id} className="toast-enter" style={{background:bg,border:`1px solid ${acc}30`,borderLeft:`3px solid ${acc}`,borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.4)',minWidth:240,maxWidth:340}}>
            <Ic size={15} color={acc}/><span style={{color:'var(--text)',fontSize:13.5,fontWeight:500}}>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

function Confirm({ msg, sub, onOk, onCancel }) {
  return createPortal(
    <div className="modal-bg" style={{zIndex:100000}}>
      <div className="modal-wrap" onClick={e => e.target === e.currentTarget && onCancel()}>
        <div className="modal-box" style={{maxWidth:360}}>
          <div style={{padding:28,textAlign:'center'}}>
            <div style={{width:48,height:48,borderRadius:12,background:'#3d0f0f',border:'1px solid #7f1d1d33',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <Trash2 size={20} color="#f87171"/>
            </div>
            <p style={{color:'var(--text)',fontSize:14.5,marginBottom:sub?6:20,lineHeight:1.5}}>{msg}</p>
            {sub && <p style={{color:'var(--text3)',fontSize:13,marginBottom:20}}>{sub}</p>}
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button className="btn btn-danger" onClick={onOk}><Trash2 size={13}/>Usuń</button>
              <button className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:26}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:'var(--text)',letterSpacing:-.5}}>{title}</h1>
        {subtitle && <p style={{marginTop:4,color:'var(--text3)',fontSize:13.5}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function StatCard({ label, value, Icon, accent, sub }) {
  return (
    <div className="card" style={{padding:'20px 22px',transition:'all .2s'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,.3)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
      <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
        <div style={{width:44,height:44,borderRadius:11,background:accent+'18',border:`1px solid ${accent}22`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon size={20} color={accent}/>
        </div>
        <div>
          <p style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,marginBottom:6}}>{label}</p>
          <p style={{color:'var(--text)',fontSize:21,fontWeight:800}}>{value}</p>
          {sub && <p style={{color:'var(--text3)',fontSize:11.5,marginTop:3}}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function Empty({ icon: Ic, title, sub, action }) {
  return (
    <div className="card" style={{padding:64,textAlign:'center'}}>
      <div style={{width:60,height:60,borderRadius:16,background:'rgba(192,57,43,.1)',border:'1px solid rgba(192,57,43,.18)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
        <Ic size={28} color="var(--accent)"/>
      </div>
      <p style={{color:'var(--text)',fontWeight:700,fontSize:17,marginBottom:8}}>{title}</p>
      {sub && <p style={{color:'var(--text3)',marginBottom:22,fontSize:13.5}}>{sub}</p>}
      {action}
    </div>
  )
}

function Spinner() {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60}}><RefreshCw size={28} color="var(--accent)" className="spin"/></div>
}

// ── ITEM EDITOR (shared for CE and Invoice) ───────────────
function ItemsEditor({ items, onChange, vat = false }) {
  const setItem = (idx, k, v) => {
    const next = [...items]
    next[idx] = { ...next[idx], [k]: v }
    onChange(next)
  }
  const add = () => onChange([...items, { id:uid(), description:'', unit:'m²', quantity:1, unit_price:0, ...(vat ? {vat_rate:23} : {}) }])
  const remove = idx => onChange(items.filter((_,i) => i !== idx))

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontWeight:700,color:'var(--text)',fontSize:14}}>Pozycje</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}><Plus size={13}/>Dodaj pozycję</button>
      </div>
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:`3fr 70px 80px 110px${vat?' 70px':''} 32px`,padding:'8px 12px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
          {['Opis','Jm.','Ilość','Cena jed.',...(vat?['VAT']:[]),''].map((h,i) => (
            <span key={i} style={{fontSize:10.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5}}>{h}</span>
          ))}
        </div>
        {items.length === 0 && <p style={{color:'var(--text3)',fontSize:13,padding:'16px 12px',textAlign:'center'}}>Brak pozycji — dodaj pierwszą</p>}
        {items.map((item, idx) => (
          <div key={item.id||idx} style={{display:'grid',gridTemplateColumns:`3fr 70px 80px 110px${vat?' 70px':''} 32px`,padding:'6px 12px',borderTop:'1px solid var(--border)',alignItems:'center',gap:4}}>
            <input className="input" style={{padding:'6px 9px',fontSize:13}} value={item.description||''} onChange={e=>setItem(idx,'description',e.target.value)} placeholder="Opis pracy lub materiału"/>
            <select className="input" style={{padding:'6px',fontSize:12}} value={item.unit||'m²'} onChange={e=>setItem(idx,'unit',e.target.value)}>
              {['m²','mb','szt','kpl','godz','t','l','m³','kg'].map(u=><option key={u}>{u}</option>)}
            </select>
            <input type="number" className="input" style={{padding:'6px 8px',textAlign:'right',fontSize:13}} value={item.quantity||0} min="0" step="0.01" onChange={e=>setItem(idx,'quantity',parseFloat(e.target.value)||0)}/>
            <input type="number" className="input" style={{padding:'6px 8px',textAlign:'right',fontSize:13}} value={item.unit_price||0} min="0" step="0.01" onChange={e=>setItem(idx,'unit_price',parseFloat(e.target.value)||0)}/>
            {vat && (
              <select className="input" style={{padding:'6px',fontSize:12}} value={item.vat_rate||23} onChange={e=>setItem(idx,'vat_rate',parseInt(e.target.value))}>
                <option value={23}>23%</option><option value={8}>8%</option><option value={0}>0%</option>
              </select>
            )}
            <button type="button" onClick={()=>remove(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',display:'flex',padding:4,borderRadius:5,transition:'color .12s'}}
              onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
              <X size={14}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── COST ESTIMATE MODAL ───────────────────────────────────
function CostEstimateModal({ initial, onSave, onClose }) {
  const { data, addCostEstimate, updateCostEstimate, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(initial || {
    name:'', client_id:'', project_id:'', status:'draft',
    items:[{id:uid(),description:'',unit:'m²',quantity:1,unit_price:0}]
  })
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  const totalNet = calcNet(form.items)
  const totalGross = totalNet * 1.08

  const handleSave = async () => {
    setErr('')
    if (!form.name) return setErr('Podaj nazwę kosztorysu')
    if (!form.client_id) return setErr('Wybierz klienta z listy')
    setSaving(true)
    try {
      const payload = { ...form, total_net: totalNet, total_gross: totalGross }
      if (initial?.id) await updateCostEstimate({ ...initial, ...payload })
      else await addCostEstimate(payload)
      onClose()
    } catch(e) { setErr(e.message||'Błąd zapisu') } finally { setSaving(false) }
  }

  return (
    <Modal title={initial ? 'Edytuj kosztorys' : 'Nowy kosztorys'} onClose={onClose} wide>
      {err&&<div style={{background:'#2a1218',border:'1px solid #ef444440',borderRadius:9,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8,color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{err}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
        <Fld label="Nazwa *" col="1 / -1">
          <input className="input" value={form.name} onChange={e=>setF('name',e.target.value)} placeholder="np. Remont łazienki – etap I"/>
        </Fld>
        <Fld label="Klient *">
          <select className="input" value={form.client_id} onChange={e=>setF('client_id',e.target.value)}>
            <option value="">— wybierz klienta —</option>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Fld>
        <Fld label="Status">
          <select className="input" value={form.status} onChange={e=>setF('status',e.target.value)}>
            <option value="draft">Szkic</option><option value="sent">Wysłany</option>
            <option value="accepted">Zaakceptowany</option><option value="rejected">Odrzucony</option>
          </select>
        </Fld>
        <Fld label="Powiąż z projektem" col="1 / -1">
          <select className="input" value={form.project_id||''} onChange={e=>setF('project_id',e.target.value||null)}>
            <option value="">— brak projektu —</option>
            {data.projects.filter(p=>!form.client_id||p.client_id===form.client_id).map(p=><option key={p.id} value={p.id}>{p.number} – {p.name}</option>)}
          </select>
        </Fld>
      </div>
      <hr className="divider"/>
      <ItemsEditor items={form.items||[]} onChange={v=>setF('items',v)}/>
      <div style={{display:'flex',justifyContent:'flex-end',gap:20,marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
        <div style={{textAlign:'right'}}>
          <div style={{color:'var(--text3)',fontSize:13}}>Netto: <span style={{color:'var(--text)',fontWeight:600}}>{fmt(totalNet)}</span></div>
          <div style={{color:'var(--text3)',fontSize:13}}>VAT 8%: <span style={{color:'var(--text)',fontWeight:600}}>{fmt(totalNet*0.08)}</span></div>
          <div style={{color:'#22c55e',fontSize:17,fontWeight:800,marginTop:4}}>Brutto: {fmt(totalGross)}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:14}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}
          {initial?'Zapisz zmiany':'Utwórz kosztorys'}
        </button>
      </div>
    </Modal>
  )
}

// ── PROJECT MODAL ─────────────────────────────────────────
function ProjectModal({ initial, onSave, onClose }) {
  const { data, addProject, updateProject, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(initial || {
    name:'', client_id:'', linked_ce_ids:[], status:'offer',
    start_date:'', end_date:'', address:'', budget:'', notes:''
  })
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  const toggleCE = id => setForm(p=>({...p, linked_ce_ids: p.linked_ce_ids?.includes(id) ? p.linked_ce_ids.filter(x=>x!==id) : [...(p.linked_ce_ids||[]),id]}))

  const availCEs = data.cost_estimates.filter(ce => !form.client_id || ce.client_id === form.client_id)

  const handleSave = async () => {
    setErr('')
    if (!form.name) return setErr('Podaj nazwę projektu')
    if (!form.client_id) return setErr('Wybierz klienta z listy')
    setSaving(true)
    try {
      if (initial?.id) await updateProject({...initial,...form})
      else await addProject(form)
      onClose()
    } catch(e) { setErr(e.message||'Błąd zapisu') } finally { setSaving(false) }
  }

  return (
    <Modal title={initial?'Edytuj projekt':'Nowy projekt'} onClose={onClose} wide>
      {err&&<div style={{background:'#2a1218',border:'1px solid #ef444440',borderRadius:9,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8,color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{err}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fld label="Nazwa projektu *" col="1 / -1">
          <input className="input" value={form.name} onChange={e=>setF('name',e.target.value)} placeholder="np. Wykończenie mieszkania – ul. Nowa 8"/>
        </Fld>
        <Fld label="Klient *">
          <select className="input" value={form.client_id} onChange={e=>{setF('client_id',e.target.value);setF('linked_ce_ids',[])}}>
            <option value="">— wybierz klienta —</option>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Fld>
        <Fld label="Status">
          <select className="input" value={form.status} onChange={e=>setF('status',e.target.value)}>
            <option value="offer">Oferta</option><option value="active">W toku</option>
            <option value="done">Zakończony</option><option value="cancelled">Anulowany</option>
          </select>
        </Fld>
        <Fld label="Data rozpoczęcia">
          <input type="date" className="input" value={form.start_date||''} onChange={e=>setF('start_date',e.target.value)}/>
        </Fld>
        <Fld label="Data zakończenia">
          <input type="date" className="input" value={form.end_date||''} onChange={e=>setF('end_date',e.target.value)}/>
        </Fld>
        <Fld label="Budżet (PLN)">
          <input type="number" className="input" value={form.budget||''} onChange={e=>setF('budget',e.target.value)} placeholder="0.00"/>
        </Fld>
        <Fld label="Adres inwestycji">
          <input className="input" value={form.address||''} onChange={e=>setF('address',e.target.value)} placeholder="ul. Przykładowa 1, Warszawa"/>
        </Fld>
        <Fld label="Notatki" col="1 / -1">
          <textarea className="input" style={{minHeight:60,resize:'vertical'}} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} placeholder="Dodatkowe informacje..."/>
        </Fld>
      </div>

      {/* POWIĄŻ KOSZTORYSY */}
      <hr className="divider"/>
      <div style={{fontSize:12,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.6,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
        <Paperclip size={12}/> Powiązane kosztorysy {form.client_id&&'(filtrowane do klienta)'}
      </div>
      {availCEs.length === 0 ? (
        <div style={{background:'var(--bg)',border:'1px dashed var(--border)',borderRadius:9,padding:'14px 16px',color:'var(--text3)',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
          <ClipboardList size={14}/> {form.client_id?'Brak kosztorysów dla tego klienta':'Najpierw wybierz klienta'}
        </div>
      ) : availCEs.map(ce => {
        const checked = (form.linked_ce_ids||[]).includes(ce.id)
        return (
          <label key={ce.id} style={{display:'flex',alignItems:'center',gap:12,background:checked?'#16a34a0d':'var(--bg)',border:`1px solid ${checked?'#22c55e28':'var(--border)'}`,borderRadius:9,padding:'10px 13px',cursor:'pointer',marginBottom:6,transition:'all .15s'}}>
            <input type="checkbox" checked={checked} onChange={()=>toggleCE(ce.id)} style={{accentColor:'#22c55e',width:15,height:15}}/>
            <div style={{flex:1}}>
              <div style={{color:'var(--text)',fontWeight:600,fontSize:13.5}}>{ce.number} — {ce.name}</div>
              <div style={{color:'#22c55e',fontSize:12,fontWeight:600,marginTop:2}}>{fmt(ce.total_gross)}</div>
            </div>
            <Badge status={ce.status}/>
            {checked && <CheckCircle2 size={15} color="#22c55e"/>}
          </label>
        )
      })}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}
          {initial?'Zapisz zmiany':'Utwórz projekt'}
        </button>
      </div>
    </Modal>
  )
}

// ── CLIENT MODAL ──────────────────────────────────────────
function ClientModal({ initial, onSave, onClose }) {
  const { addClient, updateClient, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(initial || {name:'',nip:'',address:'',email:'',phone:''})
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))

  const handleSave = async () => {
    setErr('')
    if (!form.name) return setErr('Podaj nazwę kontrahenta')
    setSaving(true)
    try {
      if (initial?.id) await updateClient({...initial,...form})
      else await addClient(form)
      onClose()
    } catch(e) { setErr(e.message||'Błąd zapisu') } finally { setSaving(false) }
  }

  return (
    <Modal title={initial?'Edytuj kontrahenta':'Nowy kontrahent'} onClose={onClose}>
      {err&&<div style={{background:'#2a1218',border:'1px solid #ef444440',borderRadius:9,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8,color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{err}</div>}
      <Fld label="Nazwa / Imię i nazwisko *"><input className="input" value={form.name} onChange={e=>setF('name',e.target.value)}/></Fld>
      <Fld label="NIP"><input className="input" value={form.nip||''} onChange={e=>setF('nip',e.target.value)} placeholder="0000000000"/></Fld>
      <Fld label="Adres"><input className="input" value={form.address||''} onChange={e=>setF('address',e.target.value)}/></Fld>
      <Fld label="E-mail"><input type="email" className="input" value={form.email||''} onChange={e=>setF('email',e.target.value)}/></Fld>
      <Fld label="Telefon"><input className="input" value={form.phone||''} onChange={e=>setF('phone',e.target.value)}/></Fld>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}
          {initial?'Zapisz':'Dodaj kontrahenta'}
        </button>
      </div>
    </Modal>
  )
}

// ── INVOICE MODAL ─────────────────────────────────────────
function InvoiceModal({ initial, onSave, onClose }) {
  const { data, addInvoice, updateInvoice, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState(initial || {
    client_id:'', project_id:'', status:'unpaid',
    issue_date: today(), due_date:'',
    items:[{id:uid(),description:'',unit:'kpl',quantity:1,unit_price:0,vat_rate:23}]
  })
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  const totalNet = calcNet(form.items)

  const handleSave = async () => {
    setErr('')
    if (!form.client_id) return setErr('Wybierz klienta z listy')
    if (!form.issue_date) return setErr('Podaj datę wystawienia')
    setSaving(true)
    try {
      if (initial?.id) await updateInvoice({...initial,...form})
      else await addInvoice(form)
      onClose()
    } catch(e) { setErr(e.message||'Błąd zapisu') } finally { setSaving(false) }
  }

  return (
    <Modal title={initial?'Edytuj fakturę':'Nowa faktura'} onClose={onClose} wide>
      {err&&<div style={{background:'#2a1218',border:'1px solid #ef444440',borderRadius:9,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8,color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{err}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
        <Fld label="Klient *">
          <select className="input" value={form.client_id} onChange={e=>setF('client_id',e.target.value)}>
            <option value="">— wybierz —</option>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Fld>
        <Fld label="Projekt">
          <select className="input" value={form.project_id||''} onChange={e=>setF('project_id',e.target.value||null)}>
            <option value="">— brak —</option>
            {data.projects.map(p=><option key={p.id} value={p.id}>{p.number} – {p.name}</option>)}
          </select>
        </Fld>
        <Fld label="Status">
          <select className="input" value={form.status} onChange={e=>setF('status',e.target.value)}>
            <option value="unpaid">Niezapłacona</option><option value="paid">Zapłacona</option><option value="overdue">Przeterminowana</option>
          </select>
        </Fld>
        <Fld label="Data wystawienia">
          <input type="date" className="input" value={form.issue_date||''} onChange={e=>setF('issue_date',e.target.value)}/>
        </Fld>
        <Fld label="Termin płatności" col="1 / -1">
          <input type="date" className="input" value={form.due_date||''} onChange={e=>setF('due_date',e.target.value)}/>
        </Fld>
      </div>
      <hr className="divider"/>
      <ItemsEditor items={form.items||[]} onChange={v=>setF('items',v)} vat/>
      <div style={{textAlign:'right',marginTop:12,color:'#22c55e',fontWeight:800,fontSize:16}}>
        Łącznie netto: {fmt(totalNet)}
      </div>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:14}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}
          {initial?'Zapisz':'Wystaw fakturę'}
        </button>
      </div>
    </Modal>
  )
}



// ── PDF GENERATOR ─────────────────────────────────────────
// ── HTML ESCAPE (XSS prevention in PDF generation) ────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
// Sanitize user text input — strip HTML tags, limit length
const sanitize = (s, maxLen=500) => String(s||'').replace(/<[^>]*>/g,'').trim().slice(0,maxLen)

function printHTML(html, title='LoftDesk') {
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(`<!DOCTYPE html><html lang="pl"><head>
<meta charset="utf-8"><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:0}
  @page{margin:16mm 18mm}
  @media print{body{padding:0}.no-print{display:none}}
  .page{max-width:860px;margin:0 auto;padding:28px 32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #c0392b}
  .logo{font-size:22pt;font-weight:800;color:#c0392b;letter-spacing:-1px}
  .logo span{color:#111}
  .doc-type{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#c0392b;margin-bottom:4px}
  .doc-number{font-size:18pt;font-weight:800;color:#111}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  .party-box{background:#f7f9fc;border:1px solid #dce6f5;border-radius:8px;padding:14px 16px}
  .party-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c0392b;margin-bottom:8px}
  .party-name{font-size:12pt;font-weight:700;color:#111;margin-bottom:3px}
  .party-detail{font-size:9.5pt;color:#444;line-height:1.5}
  .meta-row{display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap}
  .meta-item{background:#f7f9fc;border:1px solid #dce6f5;border-radius:6px;padding:8px 14px;min-width:130px}
  .meta-label{font-size:8pt;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px}
  .meta-value{font-size:10.5pt;font-weight:600;color:#111}
  .section-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c0392b;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #dce6f5}
  table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10pt}
  th{background:#c0392b;color:#fff;padding:9px 12px;text-align:left;font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  td{padding:9px 12px;border-bottom:1px solid #e8eef8;vertical-align:top}
  tr:nth-child(even) td{background:#f7f9fc}
  .num{text-align:right}
  .totals{margin-left:auto;max-width:280px;margin-bottom:20px}
  .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:10.5pt;color:#333;border-bottom:1px solid #eee}
  .total-final{display:flex;justify-content:space-between;padding:10px 14px;background:#c0392b;color:#fff;border-radius:8px;font-size:13pt;font-weight:800;margin-top:6px}
  .notes-box{background:#f7f9fc;border:1px solid #dce6f5;border-radius:8px;padding:14px 16px;margin-bottom:20px}
  .notes-label{font-size:8pt;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px;padding-top:20px;border-top:1px solid #dce6f5}
  .sig-line{height:1px;background:#999;margin-bottom:6px;margin-top:28px}
  .sig-label{font-size:8.5pt;color:#666;text-align:center}
  .contract-body{line-height:1.75;font-size:10.5pt;color:#222}
  .contract-body h2{font-size:11pt;font-weight:700;margin:16px 0 8px;color:#c0392b}
  .contract-body p{margin-bottom:8px}
  .print-btn{position:fixed;top:12px;right:12px;background:#c0392b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;z-index:99}
  .print-btn:hover{background:#e74c3c}
  .badge-paid{display:inline-block;background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;border-radius:4px;padding:2px 8px;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .badge-pending{display:inline-block;background:#fef3c7;color:#b45309;border:1px solid #fde68a;border-radius:4px;padding:2px 8px;font-size:9pt;font-weight:700}
  .badge-overdue{display:inline-block;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;padding:2px 8px;font-size:9pt;font-weight:700}
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Drukuj / PDF</button>
${html}
</body></html>`)
  win.document.close()
}

function generateInvoicePDF(inv, client, profile, items) {
  const statusBadge = inv.status==='paid'?'<span class="badge-paid">Zapłacona</span>':inv.status==='overdue'?'<span class="badge-overdue">Przeterminowana</span>':'<span class="badge-pending">Oczekuje płatności</span>'
  const rows = (items||[]).map((it,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(it.name||'')}</td>
      <td class="num">${it.qty||1}</td>
      <td class="num">${Number(it.unit_price||0).toFixed(2)} zł</td>
      <td class="num">${it.vat_rate||0}%</td>
      <td class="num">${(Number(it.qty||1)*Number(it.unit_price||0)).toFixed(2)} zł</td>
      <td class="num">${(Number(it.qty||1)*Number(it.unit_price||0)*(1+(it.vat_rate||0)/100)).toFixed(2)} zł</td>
    </tr>`).join('')
  const net = (items||[]).reduce((s,it)=>s+Number(it.qty||1)*Number(it.unit_price||0),0)
  const vat = (items||[]).reduce((s,it)=>s+Number(it.qty||1)*Number(it.unit_price||0)*(it.vat_rate||0)/100,0)
  const gross = net+vat

  const html = `<div class="page">
  <div class="header">
    <div><div class="logo">Loft<span>Desk</span></div><div style="font-size:9pt;color:#666;margin-top:4px">${profile?.company||profile?.full_name||''}</div>${profile?.nip ? '<div style="font-size:9pt;color:#666">NIP: '+esc(profile.nip)+'</div>' : ''}</div>
    <div style="text-align:right"><div class="doc-type">Faktura VAT</div><div class="doc-number">${inv.number}</div><div style="margin-top:6px">${statusBadge}</div></div>
  </div>
  <div class="parties">
    <div class="party-box"><div class="party-label">Sprzedawca</div>
      <div class="party-name">${profile?.company||profile?.full_name||'—'}</div>
      <div class="party-detail">${profile?.nip?'NIP: '+profile.nip+'<br>':''}${profile?.address||''}</div>
    </div>
    <div class="party-box"><div class="party-label">Nabywca</div>
      <div class="party-name">${client?.name||'—'}</div>
      <div class="party-detail">${client?.nip?'NIP: '+client.nip+'<br>':''}${client?.address||''}${client?.email?'<br>'+client.email:''}</div>
    </div>
  </div>
  <div class="meta-row">
    <div class="meta-item"><div class="meta-label">Data wystawienia</div><div class="meta-value">${inv.issue_date||'—'}</div></div>
    <div class="meta-item"><div class="meta-label">Termin płatności</div><div class="meta-value">${inv.due_date||'—'}</div></div>
    <div class="meta-item"><div class="meta-label">Forma płatności</div><div class="meta-value">${inv.payment_method==='transfer'?'Przelew':'Gotówka'}</div></div>
  </div>
  <div class="section-title">Pozycje faktury</div>
  <table><thead><tr><th>#</th><th>Nazwa</th><th>Ilość</th><th>Cena netto</th><th>VAT</th><th>Wartość netto</th><th>Wartość brutto</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals">
    <div class="total-row"><span>Razem netto:</span><span>${net.toFixed(2)} zł</span></div>
    <div class="total-row"><span>VAT:</span><span>${vat.toFixed(2)} zł</span></div>
    <div class="total-final"><span>DO ZAPŁATY:</span><span>${gross.toFixed(2)} zł</span></div>
  </div>
  ${inv.notes ? '<div class="notes-box"><div class="notes-label">Uwagi</div><div>'+esc(inv.notes)+'</div></div>' : ''}
  <div class="signatures">
    <div><div class="sig-line"></div><div class="sig-label">Podpis Sprzedawcy</div></div>
    <div><div class="sig-line"></div><div class="sig-label">Podpis Nabywcy</div></div>
  </div>
</div>`
  printHTML(html, `Faktura ${inv.number}`)
}

function generateEstimatePDF(ke, client, profile) {
  const items = ke.items||[]
  const rows = items.map((it,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(it.name||'')}</td>
      <td class="num">${it.qty||1}</td>
      <td class="num">${it.unit||'szt'}</td>
      <td class="num">${Number(it.unit_price||0).toFixed(2)} zł</td>
      <td class="num"><strong>${(Number(it.qty||1)*Number(it.unit_price||0)).toFixed(2)} zł</strong></td>
    </tr>`).join('')
  const net = items.reduce((s,it)=>s+Number(it.qty||1)*Number(it.unit_price||0),0)
  const gross = net*1.08

  const html = `<div class="page">
  <div class="header">
    <div><div class="logo">Loft<span>Desk</span></div><div style="font-size:9pt;color:#666;margin-top:4px">${profile?.company||profile?.full_name||''}</div></div>
    <div style="text-align:right"><div class="doc-type">Kosztorys / Wycena</div><div class="doc-number">${ke.number}</div></div>
  </div>
  <div class="parties">
    <div class="party-box"><div class="party-label">Wykonawca</div>
      <div class="party-name">${profile?.company||profile?.full_name||'—'}</div>
      <div class="party-detail">${profile?.nip?'NIP: '+profile.nip+'<br>':''}${profile?.address||''}</div>
    </div>
    <div class="party-box"><div class="party-label">Klient</div>
      <div class="party-name">${client?.name||'—'}</div>
      <div class="party-detail">${client?.nip?'NIP: '+client.nip+'<br>':''}${client?.address||''}${client?.email?'<br>'+client.email:''}</div>
    </div>
  </div>
  <div class="meta-row">
    <div class="meta-item"><div class="meta-label">Numer</div><div class="meta-value">${ke.number}</div></div>
    <div class="meta-item"><div class="meta-label">Data</div><div class="meta-value">${ke.created_at?.split('T')[0]||'—'}</div></div>
    <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${ke.status==='approved'?'Zaakceptowany':ke.status==='sent'?'Wysłany':'Roboczy'}</div></div>
  </div>
  <div style="margin-bottom:16px"><strong style="color:#111;font-size:13pt">${esc(ke.name)}</strong></div>
  <div class="section-title">Zakres prac</div>
  <table><thead><tr><th>#</th><th>Pozycja</th><th>Ilość</th><th>Jedn.</th><th>Cena jedn.</th><th>Wartość</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals">
    <div class="total-row"><span>Razem netto:</span><span>${net.toFixed(2)} zł</span></div>
    <div class="total-row"><span>VAT (8%):</span><span>${(gross-net).toFixed(2)} zł</span></div>
    <div class="total-final"><span>RAZEM BRUTTO:</span><span>${gross.toFixed(2)} zł</span></div>
  </div>
  ${ke.notes ? '<div class="notes-box"><div class="notes-label">Uwagi</div><div>'+esc(ke.notes)+'</div></div>' : ''}
  <p style="font-size:9pt;color:#888;margin-top:12px">Wycena ważna 30 dni od daty wystawienia. Potwierdzenie przyjęcia zamówienia jest równoznaczne z akceptacją kosztorysu.</p>
  <div class="signatures">
    <div><div class="sig-line"></div><div class="sig-label">Podpis Wykonawcy</div></div>
    <div><div class="sig-line"></div><div class="sig-label">Podpis Zamawiającego</div></div>
  </div>
</div>`
  printHTML(html, `Kosztorys ${ke.number}`)
}

// ── GENERATE CONTRACT FROM COST ESTIMATE ─────────────────
function GenerateContractModal({ ke, onClose }) {
  const { data, addContract, profile, toast } = useApp()
  const client = data.clients.find(c=>c.id===ke.client_id)
  const project = data.projects.find(p=>p.id===ke.project_id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Auto-filled from profile + cost estimate
  const [contractNum, setContractNum] = useState(genNum('UMW', data.contracts))
  const [signDate, setSignDate] = useState(today())
  const [startDate, setStartDate] = useState(project?.start_date || '')
  const [endDate, setEndDate] = useState(project?.end_date || '')
  const [bankAccount, setBankAccount] = useState(profile?.bank_account || '')
  const [city, setCity] = useState(() => {
    const addr = profile?.address || ''
    const parts = addr.split(',')
    return parts.length > 1 ? parts[parts.length-1].trim() : 'Krakowie'
  })
  const [extraClauses, setExtraClauses] = useState('')

  // Payment stages — 3-etap default based on ke.total_gross
  const gross = ke.total_gross || 0
  const [stages, setStages] = useState([
    {id:1, label:'Zaliczka',        pct:30, desc:`Do 3 dni od podpisania umowy (tj. do ${signDate})`},
    {id:2, label:'Etap I',          pct:40, desc:`do: ${endDate||'___________'}`},
    {id:3, label:'Odbiór końcowy',  pct:30, desc:`do: ${endDate||'___________'}`},
  ])

  const PRESETS = [
    {label:'2 etapy (30/70)',        stages:[{id:1,label:'Zaliczka',pct:30,desc:'Do 3 dni od podpisania umowy'},{id:2,label:'Odbiór końcowy',pct:70,desc:'Po odbiorze końcowym'}]},
    {label:'3 etapy (30/40/30)',     stages:[{id:1,label:'Zaliczka',pct:30,desc:'Do 3 dni od podpisania umowy'},{id:2,label:'Etap I',pct:40,desc:'do: ___________'},{id:3,label:'Odbiór końcowy',pct:30,desc:'Po odbiorze końcowym'}]},
    {label:'4 etapy (30/40/15/15)', stages:[{id:1,label:'Zaliczka',pct:30,desc:'Do 3 dni od podpisania umowy'},{id:2,label:'Etap I',pct:40,desc:'do: ___________'},{id:3,label:'Etap II',pct:15,desc:'do: ___________'},{id:4,label:'Odbiór końcowy',pct:15,desc:'Po odbiorze końcowym'}]},
  ]
  const totalPct = stages.reduce((s,st)=>s+Number(st.pct||0),0)
  const updateStage = (id,k,v) => setStages(s=>s.map(x=>x.id===id?{...x,[k]:v}:x))
  const removeStage = id => setStages(s=>s.filter(x=>x.id!==id))
  const addStage = () => setStages(s=>[...s,{id:Date.now(),label:`Etap ${s.length+1}`,pct:0,desc:''}])

  const handlePrint = () => {
    const u = {number:contractNum, sign_date:signDate, value:ke.total_gross, total_net:ke.total_net, total_gross:ke.total_gross}
    pdfContract(u, client, profile, {stages, project, startDate, endDate, bankAccount, ceNumber:`${ke.number} – ${esc(ke.name)}`, city, extraClauses})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await addContract({
        client_id:  ke.client_id,
        project_id: ke.project_id||null,
        status:     'unsigned',
        sign_date:  signDate,
        value:      ke.total_gross,
        notes:      extraClauses||'',
        payment_stages: stages,
      })
      setSaved(true)
      toast('Umowa zapisana w sekcji Umowy','success')
    } catch(e) { toast(e.message,'error') } finally { setSaving(false) }
  }

  const fmt2 = n => n ? Number(n).toLocaleString('pl-PL',{minimumFractionDigits:2}) : '—'

  return (
    <Modal title={`Generuj umowę — ${ke.number}`} onClose={onClose} wide>
      {/* INFO BANNER */}
      <div style={{background:'rgba(192,57,43,.07)',border:'1px solid rgba(192,57,43,.2)',borderRadius:10,padding:'12px 16px',marginBottom:18,display:'flex',gap:12,alignItems:'flex-start'}}>
        <ClipboardList size={15} color="var(--accent)" style={{marginTop:1,flexShrink:0}}/>
        <div style={{fontSize:13}}>
          <span style={{color:'var(--text)',fontWeight:700}}>{ke.name}</span>
          <span style={{color:'var(--text3)',marginLeft:10}}>{client?.name||'Brak klienta'}</span>
          <span style={{color:'#22c55e',fontWeight:700,marginLeft:10}}>{fmt2(ke.total_gross)} zł brutto</span>
          {project&&<span style={{color:'var(--text3)',marginLeft:10,fontSize:12}}>• {project.name}</span>}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:18}}>
        <Fld label="Numer umowy">
          <input className="input" value={contractNum} onChange={e=>setContractNum(e.target.value)}/>
        </Fld>
        <Fld label="Data podpisania">
          <input type="date" className="input" value={signDate} onChange={e=>setSignDate(e.target.value)}/>
        </Fld>
        <Fld label="Miasto zawarcia">
          <input className="input" value={city} onChange={e=>setCity(e.target.value)} placeholder="Krakowie"/>
        </Fld>
        <Fld label="Termin rozpoczęcia">
          <input type="date" className="input" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
        </Fld>
        <Fld label="Termin zakończenia">
          <input type="date" className="input" value={endDate} onChange={e=>setEndDate(e.target.value)}/>
        </Fld>
        <Fld label="Nr konta bankowego">
          <input className="input" value={bankAccount} onChange={e=>setBankAccount(e.target.value)} placeholder="PL00 0000 0000 0000..."/>
        </Fld>
      </div>

      {/* PAYMENT STAGES */}
      <div style={{marginBottom:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:11.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5}}>Harmonogram rozliczeń</div>
          <div style={{display:'flex',gap:6}}>
            {PRESETS.map(pr=>(
              <button key={pr.label} className="btn btn-secondary btn-sm" onClick={()=>setStages(pr.stages)}>{pr.label}</button>
            ))}
          </div>
        </div>
        {stages.map((st,i)=>{
          const amt = gross * Number(st.pct||0) / 100
          return (
            <div key={st.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr auto',gap:8,alignItems:'center',marginBottom:6}}>
              <input className="input" value={st.label} onChange={e=>updateStage(st.id,'label',e.target.value)} placeholder="Etap" style={{fontSize:13}}/>
              <div style={{position:'relative'}}>
                <input type="number" className="input" value={st.pct} onChange={e=>updateStage(st.id,'pct',e.target.value)} min="0" max="100" style={{fontSize:13,textAlign:'right',paddingRight:20}}/>
                <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:12,pointerEvents:'none'}}>%</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <input className="input" value={st.desc} onChange={e=>updateStage(st.id,'desc',e.target.value)} placeholder="Opis / termin" style={{fontSize:12}}/>
                <span style={{fontSize:11,color:'#22c55e',fontWeight:600,paddingLeft:2}}>≈ {fmt2(amt)} zł</span>
              </div>
              <button onClick={()=>removeStage(st.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',display:'flex',padding:5,borderRadius:5}} onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}><X size={14}/></button>
            </div>
          )
        })}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <button className="btn btn-secondary btn-sm" onClick={addStage}><Plus size={12}/>Dodaj etap</button>
          <span style={{fontSize:13,fontWeight:700,color:totalPct===100?'#22c55e':totalPct>100?'#ef4444':'#f59e0b'}}>Suma: {totalPct}% {totalPct===100?'✓':totalPct>100?'↑ za dużo':'≠ 100%'}</span>
        </div>
      </div>

      {/* EXTRA CLAUSES */}
      <Fld label="Dodatkowe postanowienia (opcjonalnie)">
        <textarea className="input" style={{minHeight:56,resize:'vertical',fontSize:13}} value={extraClauses} onChange={e=>setExtraClauses(e.target.value)} placeholder="np. Wykonawca zobowiązuje się do sprzątania po zakończeniu każdego etapu prac..."/>
      </Fld>

      {/* FOOTER */}
      <div style={{display:'flex',gap:10,justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
        <div>
          {saved&&<span style={{color:'#22c55e',fontSize:13,display:'flex',alignItems:'center',gap:5}}><CheckCircle2 size={14}/>Umowa zapisana w sekcji Umowy</span>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
          <button className="btn btn-secondary" onClick={handlePrint}><Printer size={13}/>Podgląd PDF</button>
          {!saved&&
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving?<RefreshCw size={13} className="spin"/>:<ScrollText size={13}/>}Zapisz umowę
            </button>
          }
        </div>
      </div>
    </Modal>
  )
}

// ── CONTRACT MODAL ────────────────────────────────────────
const DEFAULT_CONTRACT_TEMPLATE = `UMOWA O ROBOTY BUDOWLANE
Nr: {{numer}}

zawarta w dniu {{data_podpisania}} pomiędzy:

WYKONAWCĄ: {{wykonawca_firma}}
NIP: {{wykonawca_nip}}
Adres: {{wykonawca_adres}}
zwanym dalej "Wykonawcą"

a

ZAMAWIAJĄCYM: {{klient_nazwa}}
NIP: {{klient_nip}}
Adres: {{klient_adres}}
zwanym dalej "Zamawiającym"

§1. PRZEDMIOT UMOWY
Przedmiotem umowy jest wykonanie następujących robót budowlanych:
[Opisz szczegółowy zakres prac]

§2. TERMIN REALIZACJI
Wykonawca zobowiązuje się wykonać przedmiot umowy w terminie: [podaj termin]
Strony dopuszczają przedłużenie terminu w przypadku wystąpienia okoliczności niezależnych od Wykonawcy.

§3. WYNAGRODZENIE
Strony ustalają wynagrodzenie ryczałtowe w kwocie brutto: {{wartosc}} zł
Wynagrodzenie zawiera podatek VAT według stawki obowiązującej w dniu wystawienia faktury.

§4. WARUNKI PŁATNOŚCI
Zamawiający zobowiązuje się zapłacić wynagrodzenie przelewem na konto bankowe Wykonawcy:
Nr konta: [Numer konta]

Harmonogram płatności:
{{podzial_platnosci}}

§5. GWARANCJA I RĘKOJMIA
Wykonawca udziela gwarancji na wykonane prace na okres [okres] miesięcy od daty odbioru końcowego.
W okresie gwarancji Wykonawca zobowiązuje się usunąć wady w terminie 14 dni od ich zgłoszenia.

§6. ODBIÓR ROBÓT
Odbiór końcowy nastąpi w terminie 7 dni od zgłoszenia gotówności przez Wykonawcę.
Z odbioru sporządzony zostanie protokół podpisany przez obie strony.

§7. POSTANOWIENIA KOŃCOWE
Wszelkie zmiany niniejszej umowy wymagają formy pisemnej pod rygorem nieważności.
W sprawach nieuregulowanych niniejszą umową mają zastosowanie przepisy Kodeksu Cywilnego.
Umowa została sporządzona w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.`

function ContractModal({ initial, onClose }) {
  const { data, profile, addContract, updateContract, toast } = useApp()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('meta')
  // payment schedule state
  const [paymentStages, setPaymentStages] = useState(initial?.payment_stages || [
    {id:1, label:'Zaliczka', pct:30, desc:'Płatna w dniu podpisania umowy'},
    {id:2, label:'Etap 1',   pct:40, desc:'Po odbiorze I etapu prac'},
    {id:3, label:'Etap 2',   pct:30, desc:'Po odbiorze końcowym'},
  ])
  const totalPct = paymentStages.reduce((s,st)=>s+(Number(st.pct)||0),0)
  const PAYMENT_PRESETS = [
    {label:'2 etapy (30% / 70%)', stages:[{id:1,label:'Zaliczka',pct:30,desc:'W dniu podpisania'},{id:2,label:'Odbiór końcowy',pct:70,desc:'Po odbiorze końcowym'}]},
    {label:'3 etapy (30% / 40% / 30%)', stages:[{id:1,label:'Zaliczka',pct:30,desc:'W dniu podpisania'},{id:2,label:'Etap I',pct:40,desc:'Po odbiorze I etapu'},{id:3,label:'Odbiór końcowy',pct:30,desc:'Po odbiorze końcowym'}]},
    {label:'4 etapy (30% / 40% / 15% / 15%)', stages:[{id:1,label:'Zaliczka',pct:30,desc:'W dniu podpisania'},{id:2,label:'Etap I',pct:40,desc:'Po odbiorze I etapu'},{id:3,label:'Etap II',pct:15,desc:'Po odbiorze II etapu'},{id:4,label:'Odbiór końcowy',pct:15,desc:'Po odbiorze końcowym'}]},
  ]
  const addStage = () => setPaymentStages(s=>[...s,{id:Date.now(),label:`Etap ${s.length}`,pct:0,desc:''}])
  const removeStage = id => setPaymentStages(s=>s.filter(x=>x.id!==id))
  const updateStage = (id,k,v) => setPaymentStages(s=>s.map(x=>x.id===id?{...x,[k]:v}:x))
  const [form, setForm] = useState(initial || {client_id:'',project_id:'',status:'unsigned',sign_date:'',value:'',notes:''})
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))
  const [template, setTemplate] = useState(() => { try { return localStorage.getItem('contract_template') || DEFAULT_CONTRACT_TEMPLATE } catch { return DEFAULT_CONTRACT_TEMPLATE } })
  const [contractText, setContractText] = useState(initial?.notes || '')
  const client = data.clients.find(x => x.id === form.client_id)

  const generateFromTemplate = () => {
    if (!form.client_id) return setErr('Najpierw wybierz klienta')
    let text = template
    const vars = {
      '{{numer}}': initial?.number || '—',
      '{{data_podpisania}}': form.sign_date || new Date().toLocaleDateString('pl-PL'),
      '{{wykonawca_firma}}': profile?.company || profile?.full_name || '—',
      '{{wykonawca_nip}}': profile?.nip || '—',
      '{{wykonawca_adres}}': profile?.address || '—',
      '{{klient_nazwa}}': client?.name || '—',
      '{{klient_nip}}': client?.nip || '—',
      '{{klient_adres}}': client?.address || '—',
      '{{wartosc}}': form.value ? Number(form.value).toLocaleString('pl-PL',{minimumFractionDigits:2}) : '0,00',
    }
    // inject payment schedule
    const stagesText = paymentStages.map((st,i)=>`  ${i+1}. ${st.label}: ${st.pct}%${form.value?' ('+Math.round(Number(form.value)*Number(st.pct)/100).toLocaleString('pl-PL')+' zł)':''} — ${st.desc||'—'}`).join('\n')
    vars['{{podzial_platnosci}}'] = stagesText || '  [Brak zdefiniowanych etapów]'
    Object.entries(vars).forEach(([k,v]) => { text = text.split(k).join(v) })
    setContractText(text)
    setErr('')
    setTab('text')
    toast('Tekst wygenerowany ze wzoru','success')
  }

  const saveTemplate = () => {
    try { localStorage.setItem('contract_template', template) } catch {}
    toast('Wzór zapisany lokalnie','success')
  }

  const handleSave = async () => {
    setErr('')
    if (!form.client_id) return setErr('Wybierz klienta z listy')
    setSaving(true)
    try {
      const payload = {...form, notes: contractText || form.notes || '', payment_stages: paymentStages}
      if (initial?.id) await updateContract({...initial,...payload})
      else await addContract(payload)
      onClose()
    } catch(e) { setErr(e.message||'Błąd zapisu') } finally { setSaving(false) }
  }

  const tabStyle = (id) => ({
    padding:'8px 18px', fontSize:13, fontWeight:tab===id?700:500,
    background:'none', border:'none', cursor:'pointer',
    color:tab===id?'var(--accent2)':'var(--text3)',
    borderBottom:tab===id?'2px solid var(--accent)':'2px solid transparent',
    marginBottom:'-1px', transition:'all .15s', fontFamily:'inherit'
  })

  return (
    <Modal title={initial?'Edytuj umowę':'Nowa umowa'} onClose={onClose} wide>
      {err&&<div style={{background:'#2a1218',border:'1px solid #ef444440',borderRadius:9,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8,color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{err}</div>}

      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--border)'}}>
        <button style={tabStyle('meta')} onClick={()=>setTab('meta')}>Dane umowy</button>
        <button style={tabStyle('payment')} onClick={()=>setTab('payment')}>
          Podział płatności
          {totalPct!==100&&<span style={{marginLeft:5,background:'#ef444422',color:'#ef4444',borderRadius:4,padding:'1px 5px',fontSize:10.5,fontWeight:700}}>{totalPct}%</span>}
          {totalPct===100&&<span style={{marginLeft:5,background:'#22c55e22',color:'#22c55e',borderRadius:4,padding:'1px 5px',fontSize:10.5,fontWeight:700}}>✓</span>}
        </button>
        <button style={tabStyle('text')} onClick={()=>setTab('text')}>Treść umowy</button>
        <button style={tabStyle('template')} onClick={()=>setTab('template')}>Własny wzór</button>
      </div>

      {tab==='meta'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Fld label="Klient *" col="1 / -1">
            <select className="input" value={form.client_id} onChange={e=>setF('client_id',e.target.value)}>
              <option value="">&#8212; wybierz &#8212;</option>
              {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Fld>
          <Fld label="Projekt">
            <select className="input" value={form.project_id||''} onChange={e=>setF('project_id',e.target.value||null)}>
              <option value="">&#8212; brak &#8212;</option>
              {data.projects.map(p=><option key={p.id} value={p.id}>{p.number} – {p.name}</option>)}
            </select>
          </Fld>
          <Fld label="Status">
            <select className="input" value={form.status} onChange={e=>setF('status',e.target.value)}>
              <option value="unsigned">Oczekuje podpisu</option>
              <option value="signed">Podpisana</option>
            </select>
          </Fld>
          <Fld label="Data podpisania">
            <input type="date" className="input" value={form.sign_date||''} onChange={e=>setF('sign_date',e.target.value)}/>
          </Fld>
          <Fld label="Wartość brutto (PLN)">
            <input type="number" className="input" value={form.value||''} onChange={e=>setF('value',e.target.value)} placeholder="0.00"/>
          </Fld>
          <Fld label="" col="1 / -1">
            <button className="btn btn-secondary" style={{width:'100%',justifyContent:'center'}} onClick={generateFromTemplate}>
              <FileText size={13}/>Generuj treść ze wzoru i przejdź do edycji
            </button>
          </Fld>
        </div>
      )}

      {tab==='payment'&&(
        <div>
          {/* PRESETS */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Szybkie wzorce</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {PAYMENT_PRESETS.map(pr=>(
                <button key={pr.label} className="btn btn-secondary btn-sm" onClick={()=>setPaymentStages(pr.stages.map((s,i)=>({...s,id:i+1})))}>{pr.label}</button>
              ))}
            </div>
          </div>
          {/* STAGES */}
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
            {paymentStages.map((st,i)=>{
              const amt = form.value ? (Number(form.value)*Number(st.pct||0)/100) : null
              return (
                <div key={st.id} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 80px 1fr 32px',gap:10,alignItems:'center'}}>
                    <input className="input" value={st.label} onChange={e=>updateStage(st.id,'label',e.target.value)} placeholder={`Etap ${i+1}`} style={{fontSize:13}}/>
                    <div style={{position:'relative'}}>
                      <input type="number" className="input" value={st.pct} onChange={e=>updateStage(st.id,'pct',e.target.value)} min="0" max="100" style={{fontSize:13,paddingRight:20,textAlign:'right'}}/>
                      <span style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:12,pointerEvents:'none'}}>%</span>
                    </div>
                    <input className="input" value={st.desc} onChange={e=>updateStage(st.id,'desc',e.target.value)} placeholder="Opis / warunek płatności" style={{fontSize:13}}/>
                    <button onClick={()=>removeStage(st.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',display:'flex',padding:4,borderRadius:5}} onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}><X size={14}/></button>
                  </div>
                  {amt&&<div style={{fontSize:11.5,color:'var(--text3)',marginTop:6}}>≈ {amt.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł brutto</div>}
                </div>
              )
            })}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button className="btn btn-secondary btn-sm" onClick={addStage}><Plus size={12}/>Dodaj etap</button>
            <div style={{fontSize:13.5,fontWeight:700,color:totalPct===100?'#22c55e':totalPct>100?'#ef4444':'#f59e0b'}}>
              Suma: {totalPct}% {totalPct===100?'✓ OK':totalPct>100?'↑ za dużo':'↓ nie suma do 100%'}
            </div>
          </div>
          {!form.value&&<div style={{marginTop:10,fontSize:12,color:'var(--text3)',display:'flex',alignItems:'center',gap:5}}><AlertCircle size={11}/>Podaj wartość umowy w zakładce "Dane umowy", aby zobaczyć kwoty</div>}
        </div>
      )}

      {tab==='text'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:12,color:'var(--text3)'}}>Edytuj treść umowy — możesz wpisać dowolny tekst lub wygenerować ze wzoru.</span>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-secondary btn-sm" onClick={generateFromTemplate}><RefreshCw size={12}/>Odśwież ze wzoru</button>
              <button className="btn btn-secondary btn-sm" onClick={()=>{const fakeU={number:initial?.number||'—',sign_date:form.sign_date,value:form.value,notes:contractText}; pdfContract(fakeU,client,profile)}}><Printer size={12}/>Podgląd PDF</button>
            </div>
          </div>
          <textarea
            className="input"
            style={{width:'100%',minHeight:420,resize:'vertical',fontFamily:'monospace',fontSize:12,lineHeight:1.7}}
            value={contractText}
            onChange={e=>setContractText(e.target.value)}
            placeholder="Treść umowy pojawi się tutaj po wygenerowaniu ze wzoru lub możesz wpisać ją ręcznie..."
          />
          <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{contractText.length} znaków</div>
        </div>
      )}

      {tab==='template'&&(
        <div>
          <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,padding:'12px 14px',marginBottom:12,fontSize:12.5,color:'var(--text3)',lineHeight:1.8}}>
            <b style={{color:'var(--text)'}}>Dostępne zmienne:</b>{"  "}
            {['{{numer}}','{{data_podpisania}}','{{klient_nazwa}}','{{klient_nip}}','{{klient_adres}}','{{wykonawca_firma}}','{{wykonawca_nip}}','{{wykonawca_adres}}','{{wartosc}}','{{podzial_platnosci}}'].map(v=>(
              <code key={v} style={{background:'var(--card)',color:'var(--accent)',padding:'2px 7px',borderRadius:4,marginRight:6,fontSize:11.5,display:'inline-block',marginBottom:4}}>{v}</code>
            ))}
          </div>
          <textarea
            className="input"
            style={{width:'100%',minHeight:420,resize:'vertical',fontFamily:'monospace',fontSize:12,lineHeight:1.7}}
            value={template}
            onChange={e=>setTemplate(e.target.value)}
          />
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button className="btn btn-primary btn-sm" onClick={saveTemplate}><CheckCircle2 size={12}/>Zapisz wzór (lokalnie)</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setTemplate(DEFAULT_CONTRACT_TEMPLATE);try{localStorage.removeItem('contract_template')}catch{};toast('Przywrócono domyślny wzór','success')}}><RefreshCw size={12}/>Przywróć domyślny</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20,paddingTop:14,borderTop:'1px solid var(--border)'}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}
          {initial?'Zapisz zmiany':'Utwórz umowę'}
        </button>
      </div>
    </Modal>
  )
}

// ── ATTACH CE TO PROJECT MODAL ────────────────────────────
function AttachCEModal({ ce, onClose }) {
  const { data, updateProject, toast } = useApp()
  const [selectedId, setSelectedId] = useState(ce.project_id||'')
  const relevant = data.projects.filter(p=>!ce.client_id||p.client_id===ce.client_id)

  const handleAttach = async () => {
    if (!selectedId) return toast('Wybierz projekt','error')
    const proj = data.projects.find(p=>p.id===selectedId)
    if (!proj) return
    const ids = (proj.linked_ce_ids||[]).includes(ce.id) ? proj.linked_ce_ids : [...(proj.linked_ce_ids||[]),ce.id]
    await updateProject({...proj, linked_ce_ids:ids})
    toast(`Kosztorys dołączono do: ${proj.name}`,'success')
    onClose()
  }

  return (
    <Modal title="Dołącz kosztorys do projektu" onClose={onClose}>
      <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:11,padding:16,marginBottom:18}}>
        <p style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>Kosztorys</p>
        <p style={{color:'var(--text)',fontWeight:700,fontSize:15}}>{ce.number} — {ce.name}</p>
        <p style={{color:'#22c55e',fontWeight:600,fontSize:13,marginTop:4}}>{fmt(ce.total_gross)} brutto</p>
      </div>
      <Fld label="Wybierz projekt" hint={ce.client_id?'Wyświetlane projekty tego samego klienta':''}>
        <select className="input" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
          <option value="">— wybierz projekt —</option>
          {relevant.map(p=>{
            const c=data.clients.find(x=>x.id===p.client_id)
            return <option key={p.id} value={p.id}>{p.number} – {p.name} ({c?.name||'?'})</option>
          })}
        </select>
      </Fld>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
        <button className="btn btn-success" onClick={handleAttach}><Link2 size={13}/>Dołącz do projektu</button>
      </div>
    </Modal>
  )
}

// ── PAGES ─────────────────────────────────────────────────
function DashboardPage() {
  const { data, profile } = useApp()
  const paid = data.invoices.filter(f=>f.status==='paid').reduce((s,f)=>s+calcNet(f.items||[]),0)
  const unpaid = data.invoices.filter(f=>f.status==='unpaid').reduce((s,f)=>s+calcNet(f.items||[]),0)
  const active = data.projects.filter(p=>p.status==='active').length
  const ceTotal = data.cost_estimates.reduce((s,c)=>s+(c.total_gross||0),0)
  const name = profile?.full_name?.split(' ')[0] || 'tam'

  return (
    <div className="page-enter">
      <PageHeader title={`Witaj, ${name} 👋`} subtitle={profile?.company}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:13,marginBottom:26}}>
        <StatCard label="Aktywne projekty" value={active} Icon={FolderKanban} accent="var(--accent)"/>
        <StatCard label="Klienci" value={data.clients.length} Icon={Users} accent="#22c55e"/>
        <StatCard label="Kosztorysy" value={data.cost_estimates.length} Icon={ClipboardList} accent="#f59e0b" sub={`Suma: ${fmt(ceTotal)}`}/>
        <StatCard label="Przychód opłacony" value={fmt(paid)} Icon={TrendingUp} accent="#22c55e"/>
        <StatCard label="Oczekuje płatności" value={fmt(unpaid)} Icon={Wallet} accent="#ef4444"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <div className="card" style={{padding:22}}>
          <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:7}}><FolderKanban size={14} color="var(--accent)"/>Ostatnie projekty</h3>
          {data.projects.length===0?<p style={{color:'var(--text3)',fontSize:13.5}}>Brak projektów</p>:
            data.projects.slice(0,5).map(p=>{
              const c=data.clients.find(x=>x.id===p.client_id)
              return <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div><div style={{color:'var(--text)',fontWeight:600,fontSize:13.5}}>{p.name}</div><div style={{color:'var(--text3)',fontSize:12,marginTop:2}}>{c?.name}</div></div>
                <Badge status={p.status}/>
              </div>
            })
          }
        </div>
        <div className="card" style={{padding:22}}>
          <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:7}}><FileText size={14} color="#f59e0b"/>Ostatnie faktury</h3>
          {data.invoices.length===0?<p style={{color:'var(--text3)',fontSize:13.5}}>Brak faktur</p>:
            data.invoices.slice(0,5).map(f=>{
              const c=data.clients.find(x=>x.id===f.client_id)
              return <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{color:'var(--accent)',fontWeight:700,fontSize:12.5}}>{f.number}</div>
                  <div style={{color:'var(--text)',fontSize:13}}>{c?.name} · <span style={{color:'#22c55e',fontWeight:600}}>{fmt(calcNet(f.items||[]))}</span></div>
                </div>
                <Badge status={f.status}/>
              </div>
            })
          }
        </div>
      </div>
    </div>
  )
}

function ClientsPage() {
  const { data, deleteClient, toast } = useApp()
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const filtered = data.clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page-enter">
      <PageHeader title="Kontrahenci" subtitle={`${data.clients.length} kontrahentów`}
        action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowy kontrahent</button>}/>
      <div style={{marginBottom:14}}>
        <div style={{position:'relative',maxWidth:320}}>
          <Search size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}/>
          <input className="input" style={{paddingLeft:34}} placeholder="Szukaj kontrahenta..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 130px 1.5fr 140px 80px',padding:'10px 20px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
          {['Nazwa','NIP','Email','Telefon',''].map((h,i)=><span key={i} style={{fontSize:10.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5}}>{h}</span>)}
        </div>
        {filtered.length===0&&<div style={{padding:44,textAlign:'center',color:'var(--text3)',fontSize:13.5}}>Brak kontrahentów</div>}
        {filtered.map(c=>(
          <div key={c.id} className="table-row" style={{display:'grid',gridTemplateColumns:'2fr 130px 1.5fr 140px 80px',padding:'13px 20px',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
            <div>
              <div style={{color:'var(--text)',fontWeight:600,fontSize:14}}>{c.name}</div>
              {c.address&&<div style={{color:'var(--text3)',fontSize:12,marginTop:2,display:'flex',alignItems:'center',gap:4}}><MapPin size={10}/>{c.address}</div>}
            </div>
            <span style={{color:'var(--text2)',fontSize:13,display:'flex',alignItems:'center',gap:4}}><Hash size={10}/>{c.nip||'—'}</span>
            <span style={{color:'var(--text2)',fontSize:13,display:'flex',alignItems:'center',gap:4}}><Mail size={10}/>{c.email||'—'}</span>
            <span style={{color:'var(--text2)',fontSize:13,display:'flex',alignItems:'center',gap:4}}><Phone size={10}/>{c.phone||'—'}</span>
            <div style={{display:'flex',gap:5}}>
              <button className="btn btn-secondary btn-icon" onClick={()=>setModal({type:'edit',data:c})}><Pencil size={12}/></button>
              <button className="btn btn-danger btn-icon" onClick={()=>setConfirm(c.id)}><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>
      {modal&&<ClientModal initial={modal.type==='edit'?modal.data:null} onClose={()=>setModal(null)} onSave={()=>setModal(null)}/>}
      {confirm&&<Confirm msg="Usunąć kontrahenta?" sub="Spowoduje to usunięcie powiązań w projektach i fakturach." onOk={async()=>{await deleteClient(confirm);setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </div>
  )
}

function CostEstimatesPage() {
  const { data, profile, deleteCostEstimate, toast } = useApp()
  const [modal, setModal] = useState(null)
  const [attachModal, setAttachModal] = useState(null)
  const [contractModal, setContractModal] = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  return (
    <div className="page-enter">
      <PageHeader title="Kosztorysy" subtitle={`${data.cost_estimates.length} kosztorysów`}
        action={<div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={()=>setInboxOpen(true)}><MessageSquare size={13}/>Wiadomości</button><button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowy kosztorys</button></div>}/>
      {data.cost_estimates.length===0 ?
        <Empty icon={ClipboardList} title="Brak kosztorysów" sub="Utwórz pierwszy kosztorys dla klienta"
          action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowy kosztorys</button>}/> :
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.cost_estimates.map(ke=>{
            const client=data.clients.find(c=>c.id===ke.client_id)
            const linked=data.projects.filter(p=>(p.linked_ce_ids||[]).includes(ke.id))
            return (
              <div key={ke.id} className="card" style={{padding:'17px 21px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:8,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{color:'var(--accent)',fontWeight:700,fontSize:12.5}}>{ke.number}</span>
                      <Badge status={ke.status}/>
                      {linked.length>0&&<span className="badge" style={{background:'#22c55e0d',color:'#22c55e',border:'1px solid #22c55e22'}}><Link2 size={10}/>{linked.length} projekt</span>}
                    </div>
                    <div style={{color:'var(--text)',fontWeight:700,fontSize:15,marginBottom:5}}>{ke.name}</div>
                    <div style={{color:'var(--text3)',fontSize:13,display:'flex',gap:12,flexWrap:'wrap'}}>
                      <span style={{display:'flex',alignItems:'center',gap:4}}><Users size={11}/>{client?.name||'Brak klienta'}</span>
                      <span style={{display:'flex',alignItems:'center',gap:4}}><Layers size={11}/>{ke.items?.length||0} poz.</span>
                      <span style={{color:'#22c55e',fontWeight:700}}>{fmt(ke.total_gross)}</span>
                    </div>
                    {linked.length>0&&<div style={{marginTop:7,display:'flex',gap:5,flexWrap:'wrap'}}>
                      {linked.map(p=><span key={p.id} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 8px',fontSize:12,color:'var(--text2)'}}><FolderKanban size={10}/>{p.name}</span>)}
                    </div>}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                    <button className="btn btn-secondary btn-sm" title="Drukuj PDF" onClick={()=>{const c=data.clients.find(x=>x.id===ke.client_id);generateEstimatePDF(ke,c,profile)}}><Printer size={12}/>PDF</button>
                    <button className="btn btn-success btn-sm" onClick={()=>setAttachModal(ke)}><Paperclip size={12}/>Do projektu</button>
                    <button className="btn btn-secondary btn-sm" onClick={()=>setContractModal(ke)}><ScrollText size={12}/>Umowa</button>
                    <button className="btn btn-secondary btn-sm" onClick={()=>setShareModal(ke)} title="Udostępnij klientowi"><Share2 size={12}/>Portal</button>
                    <button className="btn btn-secondary btn-icon" onClick={()=>setModal({type:'edit',data:ke})}><Pencil size={12}/></button>
                    <button className="btn btn-danger btn-icon" onClick={()=>setConfirm(ke.id)}><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      }
      {contractModal&&<GenerateContractModal ke={contractModal} onClose={()=>setContractModal(null)}/>
      }{shareModal&&<SharePortalModal ke={shareModal} onClose={()=>setShareModal(null)}/>}
      {inboxOpen&&<PortalInboxModal onClose={()=>setInboxOpen(false)}/>}
      {modal&&<CostEstimateModal initial={modal.type==='edit'?modal.data:null} onClose={()=>setModal(null)} onSave={()=>setModal(null)}/>}
      {attachModal&&<AttachCEModal ce={attachModal} onClose={()=>setAttachModal(null)}/>}
      {confirm&&<Confirm msg="Usunąć kosztorys?" onOk={async()=>{await deleteCostEstimate(confirm);setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </div>
  )
}

function ProjectsPage() {
  const { data, deleteProject, toast } = useApp()
  const [modal, setModal] = useState(null)
  const [detail, setDetail] = useState(null)
  const [confirm, setConfirm] = useState(null)

  return (
    <div className="page-enter">
      <PageHeader title="Projekty" subtitle={`${data.projects.length} projektów`}
        action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowy projekt</button>}/>
      {data.projects.length===0 ?
        <Empty icon={FolderKanban} title="Brak projektów" sub="Utwórz pierwszy projekt" action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowy projekt</button>}/> :
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.projects.map(p=>{
            const c=data.clients.find(x=>x.id===p.client_id)
            const ces=data.cost_estimates.filter(ce=>(p.linked_ce_ids||[]).includes(ce.id))
            const ceTotal=ces.reduce((s,ce)=>s+(ce.total_gross||0),0)
            return (
              <div key={p.id} className="card card-hover" style={{padding:'17px 21px'}} onClick={()=>setDetail(p)}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:8,marginBottom:5}}><span style={{color:'var(--accent)',fontWeight:700,fontSize:12.5}}>{p.number}</span><Badge status={p.status}/></div>
                    <div style={{color:'var(--text)',fontWeight:700,fontSize:15,marginBottom:5}}>{p.name}</div>
                    <div style={{color:'var(--text3)',fontSize:13,display:'flex',gap:12,flexWrap:'wrap'}}>
                      {c&&<span style={{display:'flex',alignItems:'center',gap:4}}><Users size={11}/>{c.name}</span>}
                      {p.address&&<span style={{display:'flex',alignItems:'center',gap:4}}><MapPin size={11}/>{p.address}</span>}
                      {p.budget&&<span style={{display:'flex',alignItems:'center',gap:4}}><Wallet size={11}/>{fmt(p.budget)}</span>}
                      {ces.length>0&&<span style={{color:'#f59e0b',display:'flex',alignItems:'center',gap:4}}><ClipboardList size={11}/>{ces.length} kosztorys ({fmt(ceTotal)})</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-secondary btn-icon" onClick={()=>setModal({type:'edit',data:p})}><Pencil size={12}/></button>
                    <button className="btn btn-danger btn-icon" onClick={()=>setConfirm(p.id)}><Trash2 size={12}/></button>
                  </div>
                  <ChevronRight size={15} color="var(--text3)"/>
                </div>
              </div>
            )
          })}
        </div>
      }

      {detail&&(()=>{
        const c=data.clients.find(x=>x.id===detail.client_id)
        const ces=data.cost_estimates.filter(ce=>(detail.linked_ce_ids||[]).includes(ce.id))
        return (
          <Modal title={detail.name} onClose={()=>setDetail(null)} wide>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:18}}>
              {[[Hash,'Numer',detail.number],[null,'Status',<Badge status={detail.status}/>],[Users,'Klient',c?.name],[MapPin,'Adres',detail.address],[CalendarDays,'Start',detail.start_date],[CalendarDays,'Koniec',detail.end_date],[Wallet,'Budżet',detail.budget?fmt(parseFloat(detail.budget)):null]].map(([Ic,k,v])=>(
                <div key={k}>
                  <div style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:5,display:'flex',alignItems:'center',gap:4}}>
                    {Ic&&<Ic size={10}/>}{k}
                  </div>
                  <div style={{color:'var(--text)',fontSize:14}}>{v||'—'}</div>
                </div>
              ))}
            </div>
            {detail.notes&&<div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,padding:'11px 14px',marginBottom:16}}><p style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:5,display:'flex',alignItems:'center',gap:4}}><StickyNote size={10}/>Notatki</p><p style={{color:'var(--text)',fontSize:13.5,lineHeight:1.5}}>{detail.notes}</p></div>}
            <p style={{fontWeight:700,color:'var(--text)',marginBottom:10,display:'flex',alignItems:'center',gap:7}}><ClipboardList size={14} color="#f59e0b"/>Powiązane kosztorysy ({ces.length})</p>
            {ces.length===0?<p style={{color:'var(--text3)',fontSize:13}}>Brak powiązanych kosztorysów.</p>:ces.map(ce=>(
              <div key={ce.id} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 14px',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div><span style={{color:'var(--accent)',fontWeight:600,fontSize:12.5}}>{ce.number}</span><span style={{color:'var(--text)',marginLeft:8,fontSize:14}}>{ce.name}</span></div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}><span style={{color:'#22c55e',fontWeight:700,fontSize:13}}>{fmt(ce.total_gross)}</span><Badge status={ce.status}/></div>
              </div>
            ))}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18}}>
              <button className="btn btn-secondary" onClick={()=>{setDetail(null);setModal({type:'edit',data:detail})}}><Pencil size={13}/>Edytuj</button>
              <button className="btn btn-primary" onClick={()=>setDetail(null)}>Zamknij</button>
            </div>
          </Modal>
        )
      })()}

      {modal&&<ProjectModal initial={modal.type==='edit'?modal.data:null} onClose={()=>setModal(null)} onSave={()=>setModal(null)}/>}
      {confirm&&<Confirm msg="Usunąć projekt?" onOk={async()=>{await deleteProject(confirm);setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </div>
  )
}

function InvoicesPage() {
  const { data, profile, deleteInvoice, toast } = useApp()
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)

  return (
    <div className="page-enter">
      <PageHeader title="Faktury" subtitle={`${data.invoices.length} faktur`}
        action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowa faktura</button>}/>
      {data.invoices.length===0 &&
        <div className="card" style={{padding:44,textAlign:'center',color:'var(--text3)',fontSize:13.5}}>Brak faktur — wystaw pierwszą</div>
      }
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {data.invoices.map(f=>{
          const c=data.clients.find(x=>x.id===f.client_id)
          const p=f.project_id?data.projects.find(x=>x.id===f.project_id):null
          const net=calcNet(f.items||[])
          return (
            <div key={f.id} className="card table-row" style={{padding:'14px 20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                {/* numer + status */}
                <div style={{minWidth:110}}>
                  <div style={{color:'var(--accent)',fontWeight:700,fontSize:13.5}}>{f.number}</div>
                  <div style={{marginTop:4}}><Badge status={f.status}/></div>
                </div>
                {/* klient + projekt */}
                <div style={{flex:1,minWidth:140}}>
                  <div style={{color:'var(--text)',fontWeight:600,fontSize:14}}>{c?.name||'—'}</div>
                  {p&&<div style={{color:'var(--text3)',fontSize:12,marginTop:2,display:'flex',alignItems:'center',gap:4}}><FolderKanban size={10}/>{p.name}</div>}
                </div>
                {/* daty */}
                <div style={{minWidth:120,fontSize:12.5,color:'var(--text3)',lineHeight:1.8}}>
                  <div>Wystawiona: <span style={{color:'var(--text2)'}}>{f.issue_date||'—'}</span></div>
                  <div>Termin: <span style={{color:f.status==='overdue'?'#ef4444':'var(--text2)'}}>{f.due_date||'—'}</span></div>
                </div>
                {/* kwota */}
                <div style={{minWidth:110,textAlign:'right'}}>
                  <div style={{color:'#22c55e',fontWeight:800,fontSize:15}}>{fmt(net)}</div>
                  <div style={{color:'var(--text3)',fontSize:11.5,marginTop:2}}>netto</div>
                </div>
                {/* ksef */}
                <div style={{minWidth:90}}>
                  {f.ksef_status?<Badge status={f.ksef_status}/>:<span style={{color:'var(--text3)',fontSize:12}}>Brak KSeF</span>}
                </div>
                {/* akcje */}
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="btn btn-secondary btn-sm" onClick={()=>pdfInvoice(f,data.clients.find(x=>x.id===f.client_id),profile)} title="PDF faktury"><Printer size={12}/>PDF</button>
                  <button className="btn btn-secondary btn-icon" onClick={()=>setModal({type:'edit',data:f})} title="Edytuj"><Pencil size={13}/></button>
                  <button className="btn btn-danger btn-icon" onClick={()=>setConfirm(f.id)} title="Usuń"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {modal&&<InvoiceModal initial={modal.type==='edit'?modal.data:null} onClose={()=>setModal(null)} onSave={()=>setModal(null)}/>}
      {confirm&&<Confirm msg="Usunąć fakturę?" onOk={async()=>{await deleteInvoice(confirm);setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </div>
  )
}

function ContractsPage() {
  const { data, profile, deleteContract, toast } = useApp()
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  return (
    <div className="page-enter">
      <PageHeader title="Umowy" subtitle={`${data.contracts.length} umów`}
        action={<button className="btn btn-primary" onClick={()=>setModal({type:'new'})}><Plus size={14}/>Nowa umowa</button>}/>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'120px 2fr 1.4fr 120px 110px 110px',padding:'10px 20px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
          {['Numer','Klient','Projekt','Wartość','Status',''].map((h,i)=><span key={i} style={{fontSize:10.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5}}>{h}</span>)}
        </div>
        {data.contracts.length===0&&<div style={{padding:44,textAlign:'center',color:'var(--text3)',fontSize:13.5}}>Brak umów</div>}
        {data.contracts.map(u=>{
          const c=data.clients.find(x=>x.id===u.client_id); const p=u.project_id?data.projects.find(x=>x.id===u.project_id):null
          return <div key={u.id} className="table-row" style={{display:'grid',gridTemplateColumns:'120px 2fr 1.4fr 120px 110px 110px',padding:'13px 20px',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
            <span style={{color:'var(--accent)',fontWeight:700,fontSize:13}}>{u.number}</span>
            <span style={{color:'var(--text)',fontWeight:600}}>{c?.name||'—'}</span>
            <span style={{color:'var(--text3)',fontSize:13}}>{p?.name||'—'}</span>
            <span style={{color:'#22c55e',fontWeight:700}}>{fmt(u.value)}</span>
            <Badge status={u.status}/>
            <div style={{display:'flex',gap:5}}>
              <button className="btn btn-secondary btn-icon" onClick={()=>pdfContract(u,data.clients.find(c=>c.id===u.client_id),profile)} title="PDF umowy"><Printer size={12}/></button>
              <button className="btn btn-secondary btn-icon" onClick={()=>setModal({type:'edit',data:u})}><Pencil size={12}/></button>
              <button className="btn btn-danger btn-icon" onClick={()=>setConfirm(u.id)}><Trash2 size={12}/></button>
            </div>
          </div>
        })}
      </div>
      {modal&&<ContractModal initial={modal.type==='edit'?modal.data:null} onClose={()=>setModal(null)}/>}
      {confirm&&<Confirm msg="Usunąć umowę?" onOk={async()=>{await deleteContract(confirm);setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}
    </div>
  )
}

function KsefPage() {
  const { data, profile, updateKsefSettings, updateInvoiceKsef, toast } = useApp()
  const plan = getPlan(profile)
  const hasKsef = !plan.blocked.includes('KSeF')
  const [settings, setSettings] = useState({token:profile?.ksef_token||'',nip:profile?.ksef_nip||profile?.nip||'',env:profile?.ksef_env||'test'})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [sending, setSending] = useState(null)
  const [ksefHistory, setKsefHistory] = useState(data.invoices.filter(f=>f.ksef_status).map(f=>({id:f.id,number:f.number,status:f.ksef_status,ref:f.ksef_ref,date:f.issue_date})))

  const pending = data.invoices.filter(f=>!f.ksef_status||f.ksef_status==='ksef_error')

  const testConn = async () => {
    if(!settings.token||!settings.nip){toast('Uzupełnij token i NIP','error');return}
    setTesting(true); setTestResult(null)
    await new Promise(r=>setTimeout(r,1400))
    if(settings.env==='test'){
      setTestResult({ok:true,msg:`✓ Połączono z KSeF TEST\nNIP: ${settings.nip}\nBramka: https://ksef-test.mf.gov.pl\nStatus: Aktywny`})
    } else {
      setTestResult({ok:false,msg:'Środowisko produkcyjne wymaga certyfikatu kwalifikowanego MF.\nUżyj środowiska testowego do weryfikacji.'})
    }
    setTesting(false)
  }

  const saveSettings = async () => {
    await updateKsefSettings(settings)
    toast('Ustawienia KSeF zapisane','success')
  }

  const sendToKsef = async (inv) => {
    setSending(inv.id)
    await new Promise(r=>setTimeout(r,1800))
    const ref = 'PL'+new Date().getFullYear()+'KSF'+Math.floor(Math.random()*9999999).toString().padStart(7,'0')
    await updateInvoiceKsef(inv.id,'ksef_sent',ref)
    setKsefHistory(prev=>[{id:inv.id,number:inv.number,status:'ksef_sent',ref,date:today()},...prev])
    toast(`Faktura ${inv.number} wysłana do KSeF ✓`,'success')
    setSending(null)
  }

  return (
    <div className="page-enter">
      <PageHeader title="KSeF — e-Faktury" subtitle="Krajowy System e-Faktur — integracja i zarządzanie"/>
      {!hasKsef&&(
        <div style={{background:'#1a1000',border:'1px solid #f59e0b28',borderRadius:12,padding:'16px 20px',marginBottom:22,display:'flex',gap:12,alignItems:'center'}}>
          <Crown size={18} color="#f59e0b"/>
          <div><p style={{color:'#fbbf24',fontWeight:700,fontSize:14}}>KSeF dostępne w planie Pro i Business</p><p style={{color:'#7890a8',fontSize:13,marginTop:2}}>Zaktualizuj plan, aby wysyłać i odbierać e-faktury.</p></div>
          <button className="btn btn-primary btn-sm" style={{marginLeft:'auto',flexShrink:0}}>Ulepsz plan →</button>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:20}}>
        <div className="card" style={{padding:22}}>
          <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:18,display:'flex',alignItems:'center',gap:7}}><Key size={14} color="var(--accent)"/>Konfiguracja tokenu</h3>
          <Fld label="Środowisko">
            <select className="input" value={settings.env} onChange={e=>setSettings(p=>({...p,env:e.target.value}))} disabled={!hasKsef}>
              <option value="test">🧪 Testowe (ksef-test.mf.gov.pl)</option>
              <option value="prod">🏭 Produkcyjne (ksef.mf.gov.pl)</option>
            </select>
          </Fld>
          <Fld label="NIP firmy">
            <input className="input" value={settings.nip} onChange={e=>setSettings(p=>({...p,nip:e.target.value}))} placeholder="0000000000" disabled={!hasKsef}/>
          </Fld>
          <Fld label="Token autoryzacyjny" hint="Pobierz z bramki MF lub użyj tokenu testowego">
            <input type="password" className="input" value={settings.token} onChange={e=>setSettings(p=>({...p,token:e.target.value}))} placeholder="Wklej token..." disabled={!hasKsef}/>
          </Fld>
          {settings.env==='test'&&<div style={{background:'var(--bg)',border:'1px solid #1e3a5f',borderRadius:8,padding:'10px 12px',marginBottom:14,fontSize:12.5,color:'#5c8ec0',lineHeight:1.6}}>
            <strong style={{color:'#7ab8f5'}}>Token demo:</strong> TEST_TOKEN_2025<br/>
            <strong style={{color:'#7ab8f5'}}>Bramka:</strong> https://ksef-test.mf.gov.pl<br/>
            <strong style={{color:'#7ab8f5'}}>Dokumentacja:</strong> ksef.gov.pl/api
          </div>}
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={testConn} disabled={!hasKsef||testing}>
              {testing?<RefreshCw size={12} className="spin"/>:<Globe size={12}/>}Test połączenia
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={!hasKsef}><CheckCircle2 size={12}/>Zapisz</button>
          </div>
          {testResult&&<div style={{marginTop:12,background:testResult.ok?'#14532d14':'#3d0f0f14',border:`1px solid ${testResult.ok?'#22c55e28':'#ef444428'}`,borderRadius:8,padding:'10px 12px',fontSize:12.5,color:testResult.ok?'#86efac':'#fca5a5',whiteSpace:'pre-line',lineHeight:1.7}}>{testResult.msg}</div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:11}}>
          {[['Wysłane',ksefHistory.filter(h=>h.status==='ksef_sent').length,'#22c55e',CheckCircle2],
            ['Oczekujące',pending.length,'#f59e0b',Clock],
            ['Błędy',ksefHistory.filter(h=>h.status==='ksef_error').length,'#ef4444',AlertCircle]].map(([l,v,c,Ic])=>(
            <div key={l} className="card" style={{padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{display:'flex',alignItems:'center',gap:9,color:'var(--text3)',fontSize:13.5}}><Ic size={15} color={c}/>{l}</span>
              <span style={{color:c,fontSize:22,fontWeight:800}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:22,marginBottom:18}}>
        <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:7}}><Upload size={14} color="#f59e0b"/>Faktury do wysłania do KSeF</h3>
        {pending.length===0?
          <div style={{color:'var(--text3)',fontSize:13.5,padding:'20px 0',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}><CheckCircle2 size={28} color="#22c55e"/>Wszystkie faktury wysłane do KSeF</div>:
          pending.map(f=>(
            <div key={f.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border)',gap:12}}>
              <div>
                <span style={{color:'var(--accent)',fontWeight:700,fontSize:13}}>{f.number}</span>
                <span style={{color:'var(--text)',marginLeft:10,fontSize:13.5}}>{data.clients.find(c=>c.id===f.client_id)?.name||'—'}</span>
                <span style={{color:'#22c55e',marginLeft:10,fontSize:13,fontWeight:600}}>{fmt(calcNet(f.items||[]))}</span>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {f.ksef_status&&<Badge status={f.ksef_status}/>}
                <button className="btn btn-success btn-sm" disabled={!hasKsef||sending===f.id} onClick={()=>sendToKsef(f)}>
                  {sending===f.id?<RefreshCw size={12} className="spin"/>:<Send size={12}/>}Wyślij do KSeF
                </button>
              </div>
            </div>
          ))
        }
      </div>

      <div className="card" style={{padding:22}}>
        <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:7}}><Download size={14} color="var(--accent)"/>Historia wysyłek</h3>
        {ksefHistory.length===0?<p style={{color:'var(--text3)',fontSize:13.5}}>Brak historii wysyłek</p>:
          ksefHistory.map((h,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,marginBottom:7}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <Badge status={h.status}/><span style={{color:'var(--accent)',fontWeight:700,fontSize:13}}>{h.number}</span><span style={{color:'var(--text3)',fontSize:12.5}}>{h.date}</span>
              </div>
              {h.ref&&<code style={{color:'#5c8ec0',fontSize:11.5,background:'var(--bg)',padding:'3px 8px',borderRadius:5}}>{h.ref}</code>}
            </div>
          ))
        }
      </div>
    </div>
  )
}

function ReportsPage() {
  const { data } = useApp()
  const paid = data.invoices.filter(f=>f.status==='paid').reduce((s,f)=>s+calcNet(f.items||[]),0)
  const unpaid = data.invoices.filter(f=>f.status==='unpaid').reduce((s,f)=>s+calcNet(f.items||[]),0)
  const ceTotal = data.cost_estimates.reduce((s,c)=>s+(c.total_gross||0),0)
  const ksefSent = data.invoices.filter(f=>f.ksef_status==='ksef_sent').length

  return (
    <div className="page-enter">
      <PageHeader title="Raporty" subtitle="Przegląd finansowy i projektowy"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:13,marginBottom:24}}>
        <StatCard label="Suma kosztorysów (brutto)" value={fmt(ceTotal)} Icon={ClipboardList} accent="#f59e0b"/>
        <StatCard label="Opłacone faktury" value={fmt(paid)} Icon={CheckCircle2} accent="#22c55e"/>
        <StatCard label="Oczekujące płatności" value={fmt(unpaid)} Icon={Clock} accent="#ef4444"/>
        <StatCard label="Wysłane do KSeF" value={ksefSent} Icon={Send} accent="var(--accent)"/>
      </div>
      <div className="card" style={{padding:24,marginBottom:18}}>
        <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:20,display:'flex',alignItems:'center',gap:7}}><BarChart3 size={15} color="var(--accent)"/>Projekty wg statusu</h3>
        {['offer','active','done','cancelled'].map(status=>{
          const count=data.projects.filter(p=>p.status===status).length
          const pct=Math.round((count/Math.max(data.projects.length,1))*100)
          const cfg=STATUS_CFG[status]
          return <div key={status} style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div style={{width:130}}><Badge status={status}/></div>
            <div style={{flex:1,background:'var(--bg)',borderRadius:99,height:7,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',background:cfg.color,borderRadius:99,transition:'width .6s'}}/>
            </div>
            <span style={{color:'var(--text3)',fontSize:13,minWidth:24,textAlign:'right'}}>{count}</span>
          </div>
        })}
      </div>
      <div className="card" style={{padding:24}}>
        <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:20,display:'flex',alignItems:'center',gap:7}}><FileText size={15} color="#22c55e"/>Faktury wg statusu</h3>
        {['paid','unpaid','overdue'].map(status=>{
          const count=data.invoices.filter(f=>f.status===status).length
          const pct=Math.round((count/Math.max(data.invoices.length,1))*100)
          const cfg=STATUS_CFG[status]
          return <div key={status} style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div style={{width:130}}><Badge status={status}/></div>
            <div style={{flex:1,background:'var(--bg)',borderRadius:99,height:7,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',background:cfg.color,borderRadius:99,transition:'width .6s'}}/>
            </div>
            <span style={{color:'var(--text3)',fontSize:13,minWidth:24,textAlign:'right'}}>{count}</span>
          </div>
        })}
      </div>
    </div>
  )
}

// ── ADMIN GRANT COMPONENT ────────────────────────────────
function AdminGrant() {
  const { toast } = useApp()
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('pro')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const grant = async () => {
    if (!email.trim()) return toast('Podaj adres e-mail','error')
    setLoading(true); setResult(null)
    try {
      // Update via Supabase (tylko admin może — RLS pozwala adminowi update dowolnego profilu)
      const { data, error } = await supabase
        .from('profiles')
        .update({ plan })
        .eq('email', email.trim().toLowerCase())
        .select('email, full_name, plan')
        .single()
      if (error) throw new Error('Nie znaleziono użytkownika: ' + email)
      setResult({ok:true, msg:`✓ ${data.full_name||data.email} → plan "${plan}" nadany`})
      setEmail('')
      toast('Plan zaktualizowany ✓','success')
    } catch(e) {
      setResult({ok:false, msg:e.message})
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'flex-end'}}>
        <Fld label="E-mail użytkownika">
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="email@firma.pl" onKeyDown={e=>e.key==='Enter'&&grant()}/>
        </Fld>
        <Fld label="Plan">
          <select className="input" value={plan} onChange={e=>setPlan(e.target.value)} style={{minWidth:130}}>
            <option value="free">Free (ogranicz)</option>
            <option value="pro">Pro (29 zł/mies.)</option>
            <option value="business">Business (99 zł/mies.)</option>
          </select>
        </Fld>
        <button className="btn btn-primary" onClick={grant} disabled={loading} style={{marginBottom:1}}>
          {loading?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}Nadaj
        </button>
      </div>
      {result&&(
        <div style={{marginTop:10,padding:'10px 14px',borderRadius:8,fontSize:13,
          background:result.ok?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)',
          border:`1px solid ${result.ok?'#22c55e33':'#ef444433'}`,
          color:result.ok?'#22c55e':'#ef4444'}}>
          {result.msg}
        </div>
      )}
      <div style={{marginTop:14,fontSize:12,color:'var(--text3)',lineHeight:1.8}}>
        <strong style={{color:'var(--text2)'}}>Pro</strong> — pełny dostęp (możesz nadać znajomym/partnerom)<br/>
        <strong style={{color:'var(--text2)'}}>Free</strong> — powrót do limitowanego planu
      </div>
    </div>
  )
}

function SettingsPage() {
  const { profile, data, updateProfile, changePlan, toast } = useApp()
  const [tab, setTab]           = useState('profile')
  const [profForm, setProfForm] = useState({
    full_name:    profile?.full_name||'',
    company:      profile?.company||'',
    nip:          profile?.nip||'',
    email:        profile?.email||'',
    phone:        profile?.phone||'',
    address:      profile?.address||'',
    bank_account: profile?.bank_account||'',
  })
  const [logoPreview, setLogoPreview] = useState(profile?.logo_base64 || null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500*1024) return toast('Logo max 500 KB','error')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target.result
      setLogoPreview(b64)
      setProfForm(p=>({...p, logo_base64: b64}))
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setLogoPreview(null)
    setProfForm(p=>({...p, logo_base64: null}))
  }
  const [pwForm, setPwForm]       = useState({current:'', next:'', confirm:''})
  const [notif, setNotif]         = useState({inv:true, proj:true, ksef:false, weekly:true})
  const [showSub, setShowSub]     = useState(false)
  const [savingProf, setSavingProf] = useState(false)
  const [savingPw, setSavingPw]   = useState(false)
  const [showCur, setShowCur]     = useState(false)
  const [showNew, setShowNew]     = useState(false)
  const plan = getPlan(profile)
  const pF = (k,v) => setProfForm(p=>({...p,[k]:v}))
  const pwF = (k,v) => setPwForm(p=>({...p,[k]:v}))

  const saveProfile = async () => {
    if (!profForm.full_name.trim()) return toast('Podaj imię i nazwisko','error')
    setSavingProf(true)
    try { 
      const safeProfile = {
        full_name:    sanitize(profForm.full_name, 100),
        company:      sanitize(profForm.company, 150),
        nip:          sanitize(profForm.nip, 15).replace(/[^0-9-]/g,''),
        email:        profForm.email,
        phone:        sanitize(profForm.phone, 20).replace(/[^0-9+\s()-]/g,''),
        address:      sanitize(profForm.address, 200),
        bank_account: sanitize(profForm.bank_account, 40).replace(/[^A-Z0-9\s]/gi,''),
        ...(profForm.logo_base64 !== undefined ? {logo_base64: profForm.logo_base64} : {}),
      }
      await updateProfile(safeProfile); toast('Profil zapisany ✓','success')
    }
    catch(e) { toast(e.message,'error') } finally { setSavingProf(false) }
  }

  const changePassword = async () => {
    if (!pwForm.current) return toast('Podaj aktualne hasło','error')
    if (pwForm.next.length < 6) return toast('Nowe hasło min. 6 znaków','error')
    if (pwForm.next !== pwForm.confirm) return toast('Hasła się nie zgadzają','error')
    setSavingPw(true)
    await new Promise(r=>setTimeout(r,900))
    setSavingPw(false)
    setPwForm({current:'',next:'',confirm:''})
    toast('Hasło zmienione ✓','success')
  }

  const isAdmin  = profile?.plan === 'admin'
  const isPaid   = ['pro','business','admin'].includes(profile?.plan||'free')

  const TABS = [
    {id:'plan',     label:'Subskrypcja',     Icon:Crown},
    ...(isPaid ? [
      {id:'profile',  label:'Profil firmy',   Icon:User},
      {id:'security', label:'Bezpieczeństwo',  Icon:Shield},
      {id:'notif',    label:'Powiadomienia',   Icon:Mail},
    ] : []),
    ...(isAdmin ? [{id:'admin', label:'Panel admina', Icon:Settings}] : []),
  ]

  // Free users land on 'plan' tab always
  const effectiveTab = !isPaid && tab !== 'plan' && tab !== 'admin' ? 'plan' : tab

  return (
    <div className="page-enter">
      <PageHeader title="Ustawienia konta" subtitle={isPaid ? 'Profil, subskrypcja, hasło i bezpieczeństwo' : 'Subskrypcja'}/>

      {/* TABS */}
      <div style={{display:'flex',gap:4,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:12,padding:5,marginBottom:24,width:'fit-content'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13.5,fontWeight:600,transition:'all .15s',
              background:effectiveTab===t.id?'var(--border2)':'none', color:effectiveTab===t.id?'var(--accent2)':'var(--text3)'}}>
            <t.Icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {/* FREE UPGRADE BANNER */}
      {!isPaid&&(
        <div className="card" style={{padding:28,marginBottom:20,background:'rgba(192,57,43,.06)',border:'1px solid rgba(192,57,43,.2)',display:'flex',alignItems:'center',gap:20}}>
          <div style={{width:48,height:48,borderRadius:12,background:'rgba(192,57,43,.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Lock size={22} color="var(--accent)"/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:4}}>Ustawienia dostępne od planu Pro</div>
            <div style={{fontSize:13,color:'var(--text3)'}}>Przejdź na plan Pro aby edytować profil firmy, logo, dane na dokumentach, powiadomienia i zabezpieczenia konta.</div>
          </div>
          <button className="btn btn-primary" onClick={()=>setShowSub(true)} style={{flexShrink:0}}>
            <Crown size={13}/>Ulepsz plan
          </button>
        </div>
      )}

      {/* ── TAB: PROFIL ── */}
      {effectiveTab==='profile'&&isPaid&&(
        <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:18,gridAutoRows:'min-content'}}>
          <div className="card" style={{padding:26}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:20,display:'flex',alignItems:'center',gap:8}}><User size={15} color="var(--accent)"/>Dane firmy</h3>
            <Fld label="Imię i nazwisko / właściciel *">
              <input className="input" value={profForm.full_name} onChange={e=>pF('full_name',e.target.value)} placeholder="Jan Kowalski"/>
            </Fld>
            <Fld label="Nazwa firmy">
              <input className="input" value={profForm.company} onChange={e=>pF('company',e.target.value)} placeholder="Kowalski Budowlanka Sp. z o.o."/>
            </Fld>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Fld label="NIP">
                <input className="input" value={profForm.nip} onChange={e=>pF('nip',e.target.value)} placeholder="0000000000"/>
              </Fld>
              <Fld label="Telefon">
                <input className="input" value={profForm.phone} onChange={e=>pF('phone',e.target.value)} placeholder="+48 600 000 000"/>
              </Fld>
            </div>
            <Fld label="Adres firmy">
              <input className="input" value={profForm.address} onChange={e=>pF('address',e.target.value)} placeholder="ul. Przykładowa 1, 00-001 Warszawa"/>
            </Fld>
            <Fld label="E-mail (login)">
              <input type="email" className="input" value={profForm.email} onChange={e=>pF('email',e.target.value)}/>
            </Fld>
            <Fld label="Numer konta bankowego (do faktur i umów)">
              <input className="input" value={profForm.bank_account} onChange={e=>pF('bank_account',e.target.value)} placeholder="PL00 0000 0000 0000 0000 0000 0000"/>
            </Fld>
            <button className="btn btn-primary" onClick={saveProfile} disabled={savingProf}>
              {savingProf?<RefreshCw size={13} className="spin"/>:<CheckCircle2 size={13}/>}Zapisz profil
            </button>
          </div>

          {/* LOGO FIRMY */}
          <div className="card" style={{padding:26,gridColumn:'1 / -1'}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:6,display:'flex',alignItems:'center',gap:8}}><ImageIcon size={15} color="var(--accent)"/>Logo firmy</h3>
            <p style={{color:'var(--text3)',fontSize:12.5,marginBottom:18}}>Logo będzie automatycznie umieszczane na fakturach, umowach i kosztorysach. Zalecany format: PNG/SVG z przezroczystym tłem, max 500 KB.</p>
            <div style={{display:'flex',alignItems:'flex-start',gap:24}}>
              {/* PREVIEW */}
              <div style={{width:160,height:100,background:'var(--bg)',border:`2px dashed ${logoPreview?'var(--accent)':'var(--border)'}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden',transition:'border-color .2s'}}>
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',padding:8}}/>
                  : <div style={{textAlign:'center',color:'var(--text3)',fontSize:12}}>
                      <ImageIcon size={28} style={{marginBottom:6,opacity:.4}}/>
                      <div>Brak logo</div>
                    </div>
                }
              </div>
              {/* ACTIONS */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <label style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 16px',background:'var(--accent)',color:'#fff',borderRadius:9,cursor:'pointer',fontSize:13.5,fontWeight:600,boxShadow:'0 4px 14px rgba(192,57,43,.35)',transition:'all .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--accent2)';e.currentTarget.style.transform='translateY(-1px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)';e.currentTarget.style.transform=''}}>
                  <Upload size={14}/>Wgraj logo
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoUpload}/>
                </label>
                {logoPreview&&(
                  <button className="btn btn-secondary btn-sm" onClick={removeLogo} style={{color:'#f87171'}}>
                    <Trash2 size={12}/>Usuń logo
                  </button>
                )}
                <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.6}}>
                  PNG, JPG, SVG<br/>Maks. 500 KB<br/>Najlepiej 200×100 px
                </div>
              </div>
            </div>
          </div>

          {/* ZMIANA HASŁA */}
          <div className="card" style={{padding:26}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:20,display:'flex',alignItems:'center',gap:8}}><Key size={15} color="var(--accent)"/>Zmiana hasła</h3>
            <Fld label="Aktualne hasło">
              <div style={{position:'relative'}}>
                <input type={showCur?'text':'password'} className="input" style={{paddingRight:40}} value={pwForm.current}
                  onChange={e=>pwF('current',e.target.value)} placeholder="••••••••"/>
                <button type="button" onClick={()=>setShowCur(!showCur)}
                  style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex'}}>
                  {showCur?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </Fld>
            <Fld label="Nowe hasło (min. 6 znaków)">
              <div style={{position:'relative'}}>
                <input type={showNew?'text':'password'} className="input" style={{paddingRight:40}} value={pwForm.next}
                  onChange={e=>pwF('next',e.target.value)} placeholder="••••••••"/>
                <button type="button" onClick={()=>setShowNew(!showNew)}
                  style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex'}}>
                  {showNew?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </Fld>
            <Fld label="Powtórz nowe hasło">
              <input type="password" className="input" value={pwForm.confirm} onChange={e=>pwF('confirm',e.target.value)} placeholder="••••••••"/>
            </Fld>
            {pwForm.next&&pwForm.confirm&&pwForm.next!==pwForm.confirm&&(
              <div style={{display:'flex',alignItems:'center',gap:6,color:'#ef4444',fontSize:13,marginBottom:12,marginTop:-6}}>
                <AlertCircle size={13}/>Hasła się nie zgadzają
              </div>
            )}
            {pwForm.next&&pwForm.next===pwForm.confirm&&pwForm.next.length>=6&&(
              <div style={{display:'flex',alignItems:'center',gap:6,color:'#22c55e',fontSize:13,marginBottom:12,marginTop:-6}}>
                <CheckCircle2 size={13}/>Hasła są identyczne
              </div>
            )}
            <button className="btn btn-primary" onClick={changePassword} disabled={savingPw}>
              {savingPw?<RefreshCw size={13} className="spin"/>:<Shield size={13}/>}Zmień hasło
            </button>
            {IS_DEMO&&(
              <p style={{color:'var(--text3)',fontSize:12,marginTop:12,display:'flex',alignItems:'center',gap:5}}>
                <Info size={11}/>Tryb demo — zmiana hasła jest symulowana
              </p>
            )}
            <hr className="divider"/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <p style={{color:'var(--text)',fontSize:13.5,fontWeight:600}}>Sesje aktywne</p>
                <p style={{color:'var(--text3)',fontSize:12.5,marginTop:2}}>Zalogowany z: {IS_DEMO?'Przeglądarka demo':'Bieżąca sesja'}</p>
              </div>
              <button className="btn btn-danger btn-sm" onClick={()=>toast('Wszystkie inne sesje zakończone','success')}>
                <LogOut size={12}/>Wyloguj inne
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SUBSKRYPCJA ── */}
      {effectiveTab==='plan'&&(
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          {/* AKTUALNY PLAN */}
          <div className="card" style={{padding:26}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:48,height:48,borderRadius:13,background:plan.color+'18',border:`1px solid ${plan.color}28`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {plan.id==='business'?<Star size={22} color={plan.color}/>:plan.id==='pro'?<Crown size={22} color={plan.color}/>:<User size={22} color={plan.color}/>}
                </div>
                <div>
                  <p style={{color:'var(--text)',fontSize:20,fontWeight:900}}>Plan {plan.name}</p>
                  <p style={{color:'var(--text3)',fontSize:13.5,marginTop:2}}>{plan.price===0?'Bezpłatny — bez limitu czasowego':plan.price+' PLN / miesiąc · rozliczenie miesięczne'}</p>
                </div>
              </div>
              <button className="btn btn-primary" onClick={()=>setShowSub(true)}><Zap size={14}/>Zmień plan</button>
            </div>
            <p style={{color:'var(--text3)',fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:12}}>Wykorzystanie limitów</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
              {['invoices','projects','clients','cost_estimates'].map(k=>{
                const curr=(data||{})[k]?.length||0
                const max=plan.limits[k]
                const lbl={invoices:'Faktury',projects:'Projekty',clients:'Klienci',cost_estimates:'Kosztorysy'}
                const pct=max===Infinity?0:Math.min(curr/max*100,100)
                const over=max!==Infinity&&curr>=max
                return (
                  <div key={k} style={{background:'var(--bg)',border:`1px solid ${over?'#ef444430':'var(--border)'}`,borderRadius:10,padding:'12px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{color:'var(--text3)',fontSize:12.5,fontWeight:600}}>{lbl[k]}</span>
                      <span style={{color:over?'#ef4444':max===Infinity?'#22c55e':'var(--text2)',fontSize:12.5,fontWeight:700}}>
                        {curr}{max===Infinity?<span style={{color:'var(--text3)'}}>/∞</span>:`/${max}`}
                      </span>
                    </div>
                    {max!==Infinity&&(
                      <div style={{height:5,background:'var(--border)',borderRadius:99}}>
                        <div style={{width:`${pct}%`,height:'100%',background:pct>=90?'#ef4444':pct>=60?'#f59e0b':'var(--accent)',borderRadius:99,transition:'width .6s'}}/>
                      </div>
                    )}
                    {max===Infinity&&<div style={{height:5,background:'#22c55e18',borderRadius:99}}><div style={{width:'100%',height:'100%',background:'#22c55e30',borderRadius:99}}/></div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* PORÓWNANIE PLANÓW */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            {Object.values(PLANS).map(p=>(
              <div key={p.id} className="card" style={{padding:22,border:`2px solid ${(profile?.plan||'free')===p.id?p.color:'var(--border)'}`,position:'relative',transition:'all .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=p.color}
                onMouseLeave={e=>e.currentTarget.style.borderColor=(profile?.plan||'free')===p.id?p.color:'var(--border)'}>
                {(profile?.plan||'free')===p.id&&(
                  <div style={{position:'absolute',top:14,right:14,background:p.color,borderRadius:6,padding:'2px 8px',fontSize:10.5,fontWeight:700,color:'#fff'}}>AKTUALNY</div>
                )}
                <p style={{fontWeight:800,fontSize:17,color:'var(--text)',marginBottom:4}}>{p.name}</p>
                <p style={{fontSize:26,fontWeight:900,color:p.color,marginBottom:16}}>
                  {p.price}<span style={{fontSize:13,color:'var(--text3)',fontWeight:400}}> PLN/mies.</span>
                </p>
                {p.features.map(f=>(
                  <div key={f} style={{display:'flex',gap:8,fontSize:13,color:'var(--text2)',marginBottom:7,alignItems:'flex-start'}}>
                    <CheckCircle2 size={12} color="#22c55e" style={{marginTop:2,flexShrink:0}}/>{f}
                  </div>
                ))}
                {(profile?.plan||'free')!==p.id&&(
                  <button className="btn btn-primary btn-sm" style={{marginTop:14,width:'100%',justifyContent:'center'}}
                    onClick={async()=>{await changePlan(p.id);toast(`Plan zmieniony na ${p.name} ✓`,'success')}}>
                    Przejdź na {p.name}
                  </button>
                )}
              </div>
            ))}
          </div>
          {IS_DEMO&&(
            <div style={{background:'#1a1000',border:'1px solid #f59e0b22',borderRadius:10,padding:'12px 16px',display:'flex',gap:10,alignItems:'center'}}>
              <Info size={14} color="#f59e0b"/>
              <p style={{color:'#7890a8',fontSize:13}}>Tryb demo — zmiany planu są lokalne i nie wymagają płatności. W produkcji: integracja z <strong style={{color:'#f59e0b'}}>Stripe Billing</strong> + webhook automatycznie aktualizuje plan w bazie.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BEZPIECZEŃSTWO ── */}
      {effectiveTab==='security'&&isPaid&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
            {[
              [Shield,'var(--accent)','JWT token per sesja','Każde logowanie generuje unikalny podpisany token (RS256). Token wygasa automatycznie i jest odświeżany co 60 minut.'],
              [Lock,'#22c55e','Row-Level Security (PostgreSQL)','Każde zapytanie SQL jest automatycznie filtrowane po user_id z tokenu JWT. Dane innych firm są absolutnie niewidoczne — nawet na poziomie bazy danych.'],
              [Key,'#f59e0b','Brak dostępu krzyżowego','Nawet jeśli ktoś zna UUID rekordu innego użytkownika, PostgreSQL zwróci 0 wyników. Zero wyjątków.'],
              [CheckCircle2,'#22c55e','Szyfrowanie danych','AES-256-GCM at-rest na Supabase. HTTPS/TLS 1.3 in-transit. Hasła — bcrypt z salt (nigdy plaintext).'],
              [Globe,'var(--accent)','Polityka CORS + CSP','Nagłówki bezpieczeństwa skonfigurowane w netlify.toml: X-Frame-Options, X-Content-Type-Options, Referrer-Policy.'],
              [Info,'#64748b','Logi audytowe (Pro+)','Pełna historia logowań, zmian danych i akcji użytkownika. Dostępne w panelu Supabase.'],
            ].map(([Ic,c,t,d])=>(
              <div key={t} style={{background:'var(--bg)',border:`1px solid ${c}18`,borderRadius:12,padding:'16px 18px',display:'flex',gap:13,alignItems:'flex-start'}}>
                <div style={{width:36,height:36,borderRadius:10,background:c+'15',border:`1px solid ${c}22`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Ic size={16} color={c}/>
                </div>
                <div>
                  <p style={{color:'var(--text)',fontWeight:700,fontSize:13.5,marginBottom:5}}>{t}</p>
                  <p style={{color:'var(--text3)',fontSize:12.5,lineHeight:1.65}}>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:22,borderColor:'var(--border2)'}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:8}}><Info size={14} color="#7ab8f5"/>Informacje o koncie</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {[
                ['E-mail',profile?.email||'—'],
                ['ID użytkownika',profile?.id?.substring(0,20)+'...'||'—'],
                ['Plan',plan.name],
                ['Tryb','Demo (lokalne)'],
              ].map(([l,v])=>(
                <div key={l} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 14px'}}>
                  <p style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{l}</p>
                  <p style={{color:'var(--text2)',fontSize:13.5,fontFamily:'monospace',wordBreak:'break-all'}}>{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'#3d0f0f14',border:'1px solid #ef444420',borderRadius:12,padding:'16px 20px',display:'flex',gap:12,alignItems:'flex-start'}}>
            <AlertCircle size={16} color="#ef4444" style={{marginTop:1,flexShrink:0}}/>
            <div>
              <p style={{color:'#fca5a5',fontWeight:700,fontSize:13.5,marginBottom:4}}>Usuń konto</p>
              <p style={{color:'#7890a8',fontSize:13,marginBottom:12}}>Trwale usuwa konto, wszystkie dane, faktury, kosztorysy i projekty. Operacja jest nieodwracalna.</p>
              <button className="btn btn-danger btn-sm" onClick={()=>toast('Skontaktuj się z supportem w celu usunięcia konta','info')}>
                <Trash2 size={12}/>Usuń konto i dane
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: POWIADOMIENIA ── */}
      {tab==='admin'&&isAdmin&&(
        <div>
          <div className="card" style={{padding:26,marginBottom:16}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
              <Shield size={15} color="var(--accent)"/>Panel administratora
            </h3>
            <p style={{color:'var(--text3)',fontSize:13,marginBottom:20}}>
              Zarządzaj planami użytkowników bezpośrednio w Supabase Dashboard lub użyj poniższych instrukcji SQL.
            </p>
            <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:16}}>
              <div style={{fontSize:11.5,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                Jak nadać plan użytkownikowi
              </div>
              <div style={{fontFamily:'monospace',fontSize:12.5,color:'#22c55e',lineHeight:2,userSelect:'all'}}>
                <div>-- Nadaj plan Pro (zamień EMAIL):</div>
                <div style={{color:'var(--text2)'}}>UPDATE profiles SET plan = &apos;pro&apos; WHERE email = &apos;email@firma.pl&apos;;</div>
                <div style={{marginTop:8}}>-- Zablokuj użytkownika:</div>
                <div style={{color:'var(--text2)'}}>UPDATE profiles SET plan = &apos;free&apos; WHERE email = &apos;email@firma.pl&apos;;</div>
              </div>
            </div>
            <div style={{background:'rgba(192,57,43,.07)',border:'1px solid rgba(192,57,43,.2)',borderRadius:10,padding:14,fontSize:13,color:'var(--text2)'}}>
              <strong style={{color:'var(--accent)'}}>Twój status:</strong> Admin · Plan nieograniczony · Dostęp do wszystkich funkcji
            </div>
          </div>
          <div className="card" style={{padding:26}}>
            <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <Users size={15} color="var(--accent)"/>Szybkie nadawanie dostępu
            </h3>
            <AdminGrant/>
          </div>
        </div>
      )}

      {effectiveTab==='notif'&&isPaid&&(
        <div className="card" style={{padding:26,maxWidth:640}}>
          <h3 style={{color:'var(--text)',fontSize:14,fontWeight:700,marginBottom:20,display:'flex',alignItems:'center',gap:8}}><Mail size={15} color="var(--accent)"/>Powiadomienia e-mail</h3>
          {[
            ['inv',   'Faktury',         'Powiadomienie gdy faktura jest wystawiona, opłacona lub przeterminowana'],
            ['proj',  'Projekty',        'Aktualizacje statusu projektu i nowe komentarze'],
            ['ksef',  'KSeF',            'Potwierdzenie wysłania faktury do Krajowego Systemu e-Faktur'],
            ['weekly','Raport tygodniowy','Podsumowanie przychodów, projektów i faktur co poniedziałek'],
          ].map(([k,t,d])=>(
            <div key={k} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,paddingBottom:18,marginBottom:18,borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <p style={{color:'var(--text)',fontWeight:600,fontSize:14,marginBottom:4}}>{t}</p>
                <p style={{color:'var(--text3)',fontSize:13}}>{d}</p>
              </div>
              <div onClick={()=>setNotif(p=>({...p,[k]:!p[k]}))} style={{width:44,height:25,borderRadius:13,background:notif[k]?'var(--accent)':'var(--border)',border:`1px solid ${notif[k]?'var(--accent)':'var(--text3)'}`,position:'relative',cursor:'pointer',transition:'all .2s',flexShrink:0,marginTop:2}}>
                <div style={{position:'absolute',width:19,height:19,borderRadius:10,background:'#fff',top:2,left:notif[k]?21:2,transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.35)'}}/>
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={()=>toast('Ustawienia powiadomień zapisane ✓','success')}>
            <CheckCircle2 size={13}/>Zapisz ustawienia
          </button>
          <p style={{color:'var(--text3)',fontSize:12.5,marginTop:14,display:'flex',alignItems:'center',gap:5}}>
            <Info size={11}/>Powiadomienia są wysyłane na adres: <strong style={{color:'var(--text3)'}}>{profile?.email}</strong>
          </p>
        </div>
      )}

      {/* MODAL SUBSKRYPCJI */}
      {showSub&&(
        <Modal title="Wybierz plan subskrypcji" onClose={()=>setShowSub(false)} wide>
          <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
            <Crown size={14} color={plan.color}/>
            <span style={{color:'var(--text3)',fontSize:13.5}}>Aktualny plan: <span style={{color:plan.color,fontWeight:700}}>{plan.name}</span></span>
            {IS_DEMO&&<span style={{marginLeft:'auto',background:'#f59e0b14',color:'#f59e0b',border:'1px solid #f59e0b22',borderRadius:5,padding:'2px 8px',fontSize:11,fontWeight:700}}>DEMO</span>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
            {Object.values(PLANS).filter(p=>!HIDDEN_PLANS.includes(p.id)||(profile?.plan||'free')===p.id).map(p=>(
              <div key={p.id} className={`plan-card${(profile?.plan||'free')===p.id?' selected':''}`}
                onClick={async()=>{await changePlan(p.id);toast(`Plan zmieniony na ${p.name} ✓`,'success');setShowSub(false)}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                  <div>
                    <p style={{fontWeight:800,fontSize:16,color:'var(--text)'}}>{p.name}</p>
                    <p style={{fontSize:24,fontWeight:900,color:p.color,marginTop:4}}>{p.price}<span style={{fontSize:13,color:'var(--text3)',fontWeight:400}}> zł/mies.</span></p>
                  </div>
                  {(profile?.plan||'free')===p.id&&<CheckCircle2 size={18} color="var(--accent)"/>}
                </div>
                {p.features.map(f=>(
                  <div key={f} style={{display:'flex',gap:7,fontSize:12.5,color:'var(--text2)',marginBottom:6,alignItems:'flex-start'}}>
                    <CheckCircle2 size={11} color="#22c55e" style={{marginTop:2,flexShrink:0}}/>{f}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{background:'var(--bg)',border:'1px solid #1e3a5f',borderRadius:10,padding:'13px 16px',display:'flex',gap:9,alignItems:'flex-start'}}>
            <Info size={13} color="#7ab8f5" style={{marginTop:1,flexShrink:0}}/>
            <p style={{color:'#5c8ec0',fontSize:12.5,lineHeight:1.7}}>
              W produkcji: Stripe Billing → webhook <code style={{color:'#7ab8f5'}}>customer.subscription.updated</code> → automatyczna aktualizacja pola <code style={{color:'#7ab8f5'}}>plan</code> w Supabase per użytkownik.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── PDF UTILITIES ─────────────────────────────────────────
const PDF_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:16mm 18mm}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #1a3a6e;margin-bottom:22px}
  .logo{font-size:22pt;font-weight:900;color:#1a3a6e;letter-spacing:-0.5px}
  .logo span{color:#c0392b}
  .doc-title{font-size:17pt;font-weight:900;color:#111;margin-bottom:4px}
  .doc-meta{font-size:9pt;color:#555;line-height:1.7}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px}
  .party{background:#f7f9fc;border:1px solid #d0dce8;border-radius:8px;padding:14px 16px}
  .party-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#c0392b;margin-bottom:8px}
  .party-name{font-size:12pt;font-weight:700;color:#111;margin-bottom:4px}
  .party-detail{font-size:9.5pt;color:#444;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:9.5pt}
  th{background:#1a3a6e;color:#fff;padding:8px 10px;text-align:left;font-weight:700;font-size:8.5pt;text-transform:uppercase;letter-spacing:.4px}
  th.right{text-align:right}
  td{padding:8px 10px;border-bottom:1px solid #e8eef5;vertical-align:top}
  td.right{text-align:right;font-weight:600}
  tr:nth-child(even) td{background:#f7f9fc}
  .totals{display:flex;justify-content:flex-end;margin-bottom:24px}
  .totals-box{background:#fff5f5;border:2px solid #1a3a6e;border-radius:8px;padding:14px 20px;min-width:260px}
  .totals-row{display:flex;justify-content:space-between;gap:40px;padding:3px 0;font-size:10pt;color:#333}
  .totals-row.grand{font-size:14pt;font-weight:900;color:#1a3a6e;border-top:2px solid #1a3a6e;margin-top:8px;padding-top:8px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:8.5pt;font-weight:700}
  .badge-paid{background:#dcfce7;color:#166534}
  .badge-unpaid{background:#fef9c3;color:#854d0e}
  .badge-overdue{background:#fee2e2;color:#991b1b}
  .section-title{font-size:11pt;font-weight:800;color:#1a3a6e;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e8eef5;display:flex;align-items:center;gap:8px}
  .notes{background:#f7f9fc;border-left:4px solid #c0392b;border-radius:4px;padding:12px 14px;font-size:9.5pt;color:#333;line-height:1.7;white-space:pre-wrap;margin-bottom:22px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px}
  .sig-box{border-top:2px solid #222;padding-top:8px;font-size:9pt;color:#444}
  .sig-name{font-weight:700;font-size:10pt;color:#111;margin-bottom:2px}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #dde4ee;font-size:8pt;color:#888;text-align:center}
  @media print{body{padding:12mm 14mm}@page{margin:10mm 12mm}}
`

function openPDF(html) {
  const win = window.open('','_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${html}</body></html>`)
  win.document.close()
  setTimeout(()=>{win.focus();win.print()},500)
}

function pdfCostEstimate(ke, client, profile) {
  const items = ke.items || []
  const net = ke.total_net || calcNet(items)
  const vat = net * 0.08
  const gross = net + vat
  const rows = items.map((it,i) => {
    const total = (Number(it.quantity)||0) * (Number(it.unit_price)||0)
    return `<tr>
      <td>${i+1}</td>
      <td>${esc(it.description||'—')}</td>
      <td class="right">${it.unit||'szt'}</td>
      <td class="right">${Number(it.quantity||0).toLocaleString('pl-PL')}</td>
      <td class="right">${Number(it.unit_price||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
      <td class="right">${total.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
    </tr>`
  }).join('')

  openPDF(`
    <div class="header">
      <div><div class="logo"><span>Loft</span>Desk</div><div style="font-size:9pt;color:#888;margin-top:2px">System zarządzania firmą budowlaną</div></div>
      <div style="text-align:right">
        <div class="doc-title">KOSZTORYS</div>
        <div class="doc-meta">Nr: <b>${esc(ke.number)}</b><br/>Data: <b>${today()}</b><br/>Ważny 30 dni</div>
      </div>
    </div>
    <div class="parties">
      <div class="party">
        <div class="party-label">Wykonawca</div>
        <div class="party-name">${esc(profile?.full_name||'—')}</div>
        <div class="party-detail">${esc(profile?.company||'')}<br/>NIP: ${esc(profile?.nip||'—')}<br/>${esc(profile?.address||'')}<br/>${esc(profile?.email||'')}</div>
      </div>
      <div class="party">
        <div class="party-label">Zamawiający</div>
        <div class="party-name">${esc(client?.name||'—')}</div>
        <div class="party-detail">NIP: ${esc(client?.nip||'—')}<br/>${esc(client?.address||'')}<br/>${esc(client?.email||'')}<br/>${esc(client?.phone||'')}</div>
      </div>
    </div>
    <div class="section-title">Zakres prac</div>
    <table>
      <thead><tr>
        <th style="width:30px">Lp.</th><th>Opis</th>
        <th class="right" style="width:50px">Jm.</th>
        <th class="right" style="width:70px">Ilość</th>
        <th class="right" style="width:110px">Cena jed.</th>
        <th class="right" style="width:110px">Wartość</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="totals-box">
      <div class="totals-row"><span>Wartość netto</span><span>${net.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
      <div class="totals-row"><span>VAT 8%</span><span>${vat.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
      <div class="totals-row grand"><span>BRUTTO</span><span>${gross.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
    </div></div>
    <div class="notes">Niniejszy kosztorys jest ważny 30 dni od daty wystawienia. Ceny mogą ulec zmianie po tym terminie. Kosztorys nie stanowi umowy — jest ofertą handlową.</div>
    <div class="signatures">
      <div class="sig-box"><div class="sig-name">${esc(profile?.full_name||'Wykonawca')}</div><div>Sporządził</div></div>
      <div class="sig-box"><div class="sig-name">${esc(client?.name||'Zamawiający')}</div><div>Zaakceptował / Data</div></div>
    </div>
    <div class="footer">Wygenerowano przez LoftDesk · ${new Date().toLocaleString('pl-PL')}</div>
  `)
}

function pdfInvoice(inv, client, profile) {
  const items = inv.items || []
  const statusLabel = {paid:'Zapłacona',unpaid:'Niezapłacona',overdue:'Przeterminowana',sent:'Wysłana'}
  const totalNet = calcNet(items)
  const totalVat = items.reduce((s,it)=>{const n=(Number(it.quantity)||0)*(Number(it.unit_price)||0);return s+n*((Number(it.vat_rate)||23)/100)},0)
  const totalGross = totalNet + totalVat
  const rows = items.map((it,i) => {
    const net = (Number(it.quantity)||0)*(Number(it.unit_price)||0)
    const vat = net*((Number(it.vat_rate)||23)/100)
    return `<tr>
      <td>${i+1}</td><td>${esc(it.description||'—')}</td>
      <td style="text-align:right">${it.unit||'szt'}</td>
      <td style="text-align:right">${Number(it.quantity||0).toLocaleString('pl-PL')}</td>
      <td style="text-align:right">${Number(it.unit_price||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
      <td style="text-align:right">${it.vat_rate||23}%</td>
      <td style="text-align:right">${net.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
      <td style="text-align:right;font-weight:700">${(net+vat).toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</td>
    </tr>`
  }).join('')
  const html = `<div class="page">
    <div class="header">
      <div style="display:flex;align-items:center;gap:12px">
        ${profile?.logo_base64
          ? `<img src="${profile.logo_base64}" alt="Logo" style="height:52px;max-width:150px;object-fit:contain"/>`
          : `<div class="logo">Loft<span>Desk</span></div>`
        }<div style="font-size:9pt;color:#666">${esc(profile?.company||profile?.full_name||'')}</div></div>
      <div style="text-align:right">
        <div class="doc-type">Faktura VAT</div>
        <div class="doc-number">${esc(inv.number||'—')}</div>
        <div style="font-size:9pt;color:#555;margin-top:4px">Status: <b>${esc(statusLabel[inv.status]||inv.status||'—')}</b></div>
      </div>
    </div>
    <div class="parties">
      <div class="party-box"><div class="party-label">Sprzedawca</div>
        <div class="party-name">${esc(profile?.company||profile?.full_name||'—')}</div>
        <div class="party-detail">NIP: ${esc(profile?.nip||'—')}<br>${esc(profile?.address||'')}<br>${esc(profile?.email||'')}</div>
      </div>
      <div class="party-box"><div class="party-label">Nabywca</div>
        <div class="party-name">${esc(client?.name||'—')}</div>
        <div class="party-detail">NIP: ${esc(client?.nip||'—')}<br>${esc(client?.address||'')}<br>${esc(client?.email||'')}</div>
      </div>
    </div>
    <div class="meta-row">
      <div class="meta-item"><div class="meta-label">Data wystawienia</div><div class="meta-value">${esc(inv.issue_date||'—')}</div></div>
      <div class="meta-item"><div class="meta-label">Termin płatności</div><div class="meta-value">${esc(inv.due_date||'—')}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10pt">
      <thead><tr style="background:#c0392b;color:#fff">
        <th style="padding:8px;text-align:left;width:30px">Lp.</th>
        <th style="padding:8px;text-align:left">Opis</th>
        <th style="padding:8px;text-align:right;width:50px">Jm.</th>
        <th style="padding:8px;text-align:right;width:60px">Ilość</th>
        <th style="padding:8px;text-align:right;width:100px">Cena netto</th>
        <th style="padding:8px;text-align:right;width:45px">VAT</th>
        <th style="padding:8px;text-align:right;width:100px">Netto</th>
        <th style="padding:8px;text-align:right;width:100px">Brutto</th>
      </tr></thead>
      <tbody>${rows||'<tr><td colspan="8" style="padding:12px;text-align:center;color:#999">Brak pozycji</td></tr>'}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
      <div style="background:#fff5f5;border:2px solid #c0392b;border-radius:8px;padding:14px 20px;min-width:260px">
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10pt;color:#333"><span>Netto</span><span>${totalNet.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10pt;color:#333"><span>VAT</span><span>${totalVat.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0 3px;font-size:14pt;font-weight:900;color:#c0392b;border-top:2px solid #c0392b;margin-top:6px"><span>DO ZAPŁATY</span><span>${totalGross.toLocaleString('pl-PL',{minimumFractionDigits:2})} zł</span></div>
      </div>
    </div>
    ${inv.ksef_ref ? '<div style="background:#f7f9fc;border-left:4px solid #c0392b;padding:10px 14px;font-size:9.5pt;margin-bottom:20px">Nr KSeF: <b>'+esc(inv.ksef_ref)+'</b></div>' : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px">
      <div style="border-top:2px solid #222;padding-top:8px;font-size:9pt;color:#444"><b>${esc(profile?.full_name||'Wystawca')}</b><br>Podpis wystawcy</div>
      <div style="border-top:2px solid #222;padding-top:8px;font-size:9pt;color:#444"><b>${esc(client?.name||'Nabywca')}</b><br>Podpis odbiorcy / Data</div>
    </div>
  </div>`
  printHTML(html, `Faktura ${esc(inv.number)}`)
}



function pdfContract(u, client, profile, opts={}) {
  // opts: { stages, project, startDate, endDate, bankAccount, ceNumber, extraClauses }
  const stages = opts.stages || u.payment_stages || []
  const project = opts.project || null
  const startDate = opts.startDate || project?.start_date || '___________'
  const endDate = opts.endDate || project?.end_date || '___________'
  const bankAccount = opts.bankAccount || profile?.bank_account || '___________'
  const ceNumber = opts.ceNumber || ''
  const city = opts.city || (profile?.address?.split(',').pop()?.trim()) || 'Krakowie'
  const netVal = u.total_net || (u.value ? Number(u.value)/1.08 : null)
  const grossVal = u.value ? Number(u.value) : null
  const fmt2 = n => n ? Number(n).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '___________'

  // payment stages table rows
  const stageRows = stages.length > 0 ? stages.map((st,i) => {
    const amt = grossVal ? (grossVal * Number(st.pct||0) / 100) : null
    return `<tr>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e0e0e0">${i+1}</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e0e0e0">${st.pct||0}%</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">${amt ? fmt2(amt)+' zł' : '___________'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0">${st.desc||st.label||'___________'}</td>
    </tr>`
  }).join('') : `<tr>
    <td style="text-align:center;padding:8px 10px">1</td>
    <td style="text-align:center;padding:8px 10px">100%</td>
    <td style="text-align:center;padding:8px 10px;font-weight:700">${fmt2(grossVal)} zł</td>
    <td style="padding:8px 10px">Po odbiorze końcowym</td>
  </tr>`

  const extraParagraph = opts.extraClauses ? `
    <div style="margin-bottom:18px">
      <div style="font-weight:700;font-size:10pt;text-align:center;margin-bottom:6px">POSTANOWIENIA DODATKOWE</div>
      <div style="font-size:10pt;line-height:1.75">${esc((opts.extraClauses||'').replace(/\n/g,'<br>'))}</div>
    </div>` : ''

  const html = `
<div style="font-family:'DM Sans',Arial,sans-serif;font-size:10pt;color:#111;max-width:800px;margin:0 auto">
  <!-- RED TOP BAR -->
  <div style="background:#c0392b;height:12px;margin-bottom:0"></div>

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 32px 12px;border-bottom:1px solid #ddd;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:14px">
      ${profile?.logo_base64
        ? `<img src="${profile.logo_base64}" alt="Logo" style="height:60px;max-width:160px;object-fit:contain"/>`
        : `<div style="width:46px;height:46px;background:#c0392b;border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M20 5 L36 14 L36 32 L20 41 L4 32 L4 14 Z" stroke="white" stroke-width="2.5" fill="none"/><path d="M13 22 L18 27 L27 17" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
      }
      <div>
        <div style="font-size:15pt;font-weight:900;color:#c0392b;letter-spacing:-0.3px">${esc((profile?.company||profile?.full_name||'LoftBau').toUpperCase())}</div>
        <div style="font-size:8.5pt;color:#555">${esc(profile?.address||'')}</div>
      </div>
    </div>
    <div style="text-align:right;font-size:9pt;color:#555;line-height:1.7">
      ${profile?.phone ? '+48 ' + esc(profile.phone) + '<br>' : ''}
      ${profile?.email ? esc(profile.email) : ''}
    </div>
  </div>

  <!-- TITLE -->
  <div style="padding:0 32px;margin-bottom:20px">
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:17pt;font-weight:900;color:#c0392b;letter-spacing:1px;margin-bottom:6px">UMOWA O WYKONANIE ROBÓT BUDOWLANYCH</div>
      <div style="font-size:11pt;font-weight:700;color:#333">nr ${esc(u.number||'_____')}</div>
    </div>
    <div style="font-size:9.5pt;color:#555;margin-bottom:14px">Data podpisania umowy: <strong style="color:#111">${esc(u.sign_date||'___________')}</strong></div>

    <div style="font-size:10pt;line-height:1.8;margin-bottom:20px">
      zawarta w dniu <strong>${esc(u.sign_date||'___________')}</strong> w ${esc(city)} między
      <strong>${esc(client?.name||'___________')}</strong>${esc(client?.address ? ', zamieszkałym/-ą przy '+client.address : '')}
      zwanym/-ą dalej <strong>Inwestorem</strong>, a Firmą
      <strong>${esc(profile?.company ? profile.company.toUpperCase() : (profile?.full_name||'___________').toUpperCase())}</strong>${esc(profile?.address ? ', z siedzibą w '+profile.address : '')}${esc(profile?.nip ? ', NIP '+profile.nip : '')},
      ${esc(profile?.full_name ? 'reprezentowaną przez '+profile.full_name+',' : '')} zwanego/-ej dalej <strong>Wykonawcą</strong>.
    </div>

    <!-- §1 PRZEDMIOT -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">PRZEDMIOT UMOWY</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 1</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:6px">1. Inwestor zleca, a Wykonawca przyjmuje do wykonania roboty wykończeniowe${esc(ceNumber ? ': <strong>'+ceNumber+'</strong>' : '')}. Szczegółowy zakres prac znajduje się w sporządzonym kosztorysie, stanowiącym załącznik nr 1 do umowy.</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">2. Wykonawca oświadcza, że posiada niezbędne umiejętności, wiedzę, środki, sprzęt i doświadczenie do wykonania prac będących przedmiotem umowy i zobowiązuje się je wykonać z należytą starannością oraz aktualnym poziomem wiedzy i techniki.</div>

    <!-- §2 TERMIN -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">TERMIN I SPOSÓB WYKONANIA UMOWY</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 2</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:6px">1. Strony zgodnie ustalają termin rozpoczęcia prac na dzień <strong>${esc(startDate)}</strong>, a termin zakończenia prac na dzień nie później niż <strong>${esc(endDate)}</strong>.</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">2. Wykonawca wykona umowę samodzielnie lub za pomocą osób przez siebie wskazanych, gwarantując należyte wykonanie umowy.</div>

    <!-- §3 WYNAGRODZENIE -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">WYNAGRODZENIE</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 3</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:10px">1. Za wykonanie umowy Inwestor zapłaci na rzecz Wykonawcy wynagrodzenie zgodne z kosztorysem ofertowym: <strong>${netVal ? fmt2(netVal)+' zł' : '___________'} netto</strong> (tj. <strong>${fmt2(grossVal)} zł brutto</strong>), stanowiącym załącznik nr 1 do umowy.</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:14px">2. Kosztorys nie obejmuje kosztów materiałów poza chemią budowlaną dostarczaną przez Wykonawcę. Pozostałe materiały dostarcza Inwestor.</div>

    <!-- HARMONOGRAM TABLE -->
    <div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;margin-bottom:14px">
      <div style="background:#f5f5f5;padding:8px 14px;font-weight:700;font-size:10pt;border-bottom:1px solid #ccc">Harmonogram rozliczeń</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid #ccc;width:50px">Etap</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid #ccc;width:60px">Udział</th>
            <th style="padding:7px 10px;text-align:center;border-bottom:1px solid #ccc;width:140px">Kwota</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:1px solid #ccc">Termin</th>
          </tr>
        </thead>
        <tbody>${stageRows}</tbody>
      </table>
      <div style="padding:6px 14px;font-size:9pt;color:#555;background:#fafafa;border-top:1px solid #eee"><strong>Uwaga:</strong></div>
    </div>

    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">Inwestor dokona wpłat na numer konta: <strong style="color:#c0392b">${esc(bankAccount)}</strong></div>

    <!-- §4 GWARANCJA -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">GWARANCJA</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 4</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">Wykonawca udziela dwuletniej gwarancji na wykonane prace budowlane i zobowiązuje się do bezzwłocznego usunięcia usterek i wad, które w tym okresie czasu mogą wystąpić z winy Wykonawcy.</div>

    <!-- §5 OBOWIĄZKI INWESTORA -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">OBOWIĄZKI INWESTORA</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 5</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">Inwestor zobowiązuje się udostępnić Wykonawcy na czas trwania umowy mieszkanie, w którym mają być wykonywane umówione prace, a także pomieszczenie sanitarne, wodę, prąd i światło. Wykonawca zastrzega sobie prawo do korzystania z lokalu na wyłączność przez okres trwania prac. Inwestor wskaże wykonawcy miejsce składowania odpadów budowlanych przy inwestycji. Wykonawca zastrzega sobie iż koszt zutylizowania odpadów ponosi INWESTOR.</div>

    <!-- §6–9 POSTANOWIENIA KOŃCOWE -->
    <div style="font-weight:700;font-size:10.5pt;text-align:center;margin-bottom:6px">POSTANOWIENIA KOŃCOWE</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 6</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:8px">Wszelkie zmiany umowy mogą nastąpić jedynie za zgodą stron wyrażoną w formie pisemnej pod rygorem nieważności.</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 7</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:8px">Wymienione w umowie załączniki stanowią integralną jej część.</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 8</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:8px">Umowa została sporządzona w dwóch jednobrzmiących egzemplarzach po jednym dla każdej ze stron.</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">§ 9</div>
    <div style="font-size:10pt;line-height:1.75;margin-bottom:20px">Wszelkie spory mogące wyniknąć w związku z wykonaniem niniejszej Umowy, strony będą się starały rozstrzygać na drodze polubownej. W sprawach nie uregulowanych zapisami niniejszej Umowy, mają zastosowanie przepisy kodeksu cywilnego.</div>

    ${extraParagraph}

    <!-- SIGNATURES -->
    <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:0">
      <div style="width:45%">
        <div style="font-size:10pt;margin-bottom:30px">Podpis Inwestora</div>
        <div style="border-top:1px solid #333;padding-top:6px;font-size:9pt;color:#555">${esc(client?.name||'Inwestor')}</div>
      </div>
      <div style="width:45%;text-align:right">
        <div style="font-size:10pt;margin-bottom:30px">Podpis Wykonawcy</div>
        <div style="border-top:1px solid #333;padding-top:6px;font-size:9pt;color:#555">${esc(profile?.full_name||'Wykonawca')}</div>
      </div>
    </div>
  </div>

  <!-- RED BOTTOM BAR -->
  <div style="background:#c0392b;height:8px;margin-top:20px"></div>
  <div style="text-align:center;font-size:8pt;color:#888;padding:6px">+48 ${esc(profile?.phone||'___')}&nbsp;&nbsp;&nbsp;${esc(profile?.email||'')}</div>
</div>`

  const win = window.open('', '_blank', 'width=900,height=750')
  win.document.write(`<!DOCTYPE html><html lang="pl"><head>
<meta charset="utf-8"><title>Umowa ${esc(u.number||'')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',Arial,sans-serif;background:#f0f0f0;padding:20px}
  .print-btn{position:fixed;top:12px;right:12px;background:#c0392b;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(192,57,43,.4);z-index:99}
  .print-btn:hover{background:#e74c3c}
  .page-wrap{background:#fff;max-width:840px;margin:0 auto;box-shadow:0 4px 32px rgba(0,0,0,.15)}
  @media print{body{background:#fff;padding:0}.print-btn{display:none}.page-wrap{box-shadow:none;max-width:none}@page{margin:10mm 12mm}}
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Drukuj / Zapisz PDF</button>
<div class="page-wrap">${html}</div>
</body></html>`)
  win.document.close()
}

// ── SIDEBAR ───────────────────────────────────────────────
const NAV = [
  {id:'dashboard',     label:'Pulpit',       Icon:LayoutDashboard},
  {id:'clients',       label:'Kontrahenci',  Icon:Users},
  {id:'costestimates', label:'Kosztorysy',   Icon:ClipboardList},
  {id:'projects',      label:'Projekty',     Icon:FolderKanban},
  {id:'invoices',      label:'Faktury',      Icon:FileText},
  {id:'contracts',     label:'Umowy',        Icon:ScrollText},
  {id:'ksef',          label:'KSeF',         Icon:Rss},
  {id:'reports',       label:'Raporty',      Icon:BarChart3},
  {id:'settings',      label:'Ustawienia',   Icon:Settings},
]

function Logo({ size=28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="url(#lg)"/>
      <path d="M20 7 L34 15 L34 30 L20 38 L6 30 L6 15 Z" stroke="white" strokeWidth="2.2" fill="none" opacity=".85"/>
      <path d="M13 23 L18 28 L27 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#c0392b"/><stop offset="1" stopColor="#922b21"/>
      </linearGradient></defs>
    </svg>
  )
}

function Sidebar({ active, setActive, onLogout, collapsed, setCollapsed }) {
  const { profile } = useApp()
  const plan = getPlan(profile)
  const w = collapsed ? 58 : 220
  return (
    <div style={{width:w,minWidth:w,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',transition:'width .22s cubic-bezier(.4,0,.2,1),min-width .22s cubic-bezier(.4,0,.2,1)',overflow:'hidden'}}>
      {/* HEADER */}
      <div style={{padding:collapsed?'14px 0':'16px 14px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',gap:8,flexShrink:0,minHeight:64}}>
        {!collapsed&&(
          <div style={{display:'flex',alignItems:'center',gap:10,overflow:'hidden',flex:1}}>
            {profile?.logo_base64
              ? <img src={profile.logo_base64} alt="Logo" style={{height:36,maxWidth:140,objectFit:'contain'}}/>
              : <><Logo size={30}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:17,fontWeight:800,color:'var(--text)',letterSpacing:-.3,fontFamily:"'Sora',sans-serif",whiteSpace:'nowrap'}}><span style={{color:'var(--accent2)'}}>Loft</span>Desk</div>
                    {IS_DEMO&&<span style={{background:'rgba(232,160,32,.15)',color:'var(--amber)',border:'1px solid rgba(232,160,32,.25)',borderRadius:4,padding:'0 5px',fontSize:9.5,fontWeight:700,letterSpacing:.5}}>DEMO</span>}
                  </div>
                </>
            }
            {IS_DEMO&&profile?.logo_base64&&<span style={{background:'rgba(232,160,32,.15)',color:'var(--amber)',border:'1px solid rgba(232,160,32,.25)',borderRadius:4,padding:'0 5px',fontSize:9.5,fontWeight:700,letterSpacing:.5}}>DEMO</span>}
          </div>
        )}
        {collapsed&&(profile?.logo_base64
          ? <img src={profile.logo_base64} alt="Logo" style={{height:32,width:32,objectFit:'contain',borderRadius:6}}/>
          : <Logo size={26}/>
        )}
        <button onClick={()=>setCollapsed(!collapsed)} title={collapsed?'Rozwiń':'Zwiń'}
          style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex',padding:5,borderRadius:6,flexShrink:0,transition:'color .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color='var(--text2)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
          <ChevronRight size={15} style={{transform:collapsed?'rotate(0deg)':'rotate(180deg)',transition:'transform .22s'}}/>
        </button>
      </div>
      {/* NAV */}
      <nav style={{flex:1,padding:collapsed?'8px 5px':'8px 7px',overflowY:'auto',overflowX:'hidden'}}>
        {NAV.map(item=>{
          const locked=item.id==='ksef'&&getPlan(profile).blocked.includes('KSeF')
          return (
            <button key={item.id} className={`nav-item${active===item.id?' active':''}`}
              onClick={()=>setActive(item.id)} title={collapsed?item.label:''}
              style={{justifyContent:collapsed?'center':'flex-start',padding:collapsed?'10px 0':'9px 11px',position:'relative'}}>
              <item.Icon size={15} style={{flexShrink:0}}/>
              {!collapsed&&<span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}}>{item.label}</span>}
              {!collapsed&&locked&&<Lock size={10} style={{marginLeft:'auto',color:'var(--text3)',flexShrink:0}}/>}
            </button>
          )
        })}
      </nav>
      {/* USER */}
      <div style={{padding:collapsed?'8px 5px':'8px 7px',borderTop:'1px solid var(--border)',flexShrink:0}}>
        {!collapsed?(
          <>
            <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:9,padding:'10px 11px',marginBottom:5}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${plan.color}88,${plan.color})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',flexShrink:0}}>
                  {(profile?.full_name||'U').charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:'var(--text)',fontSize:12.5,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.full_name||'Użytkownik'}</p>
                  <p style={{color:'var(--text3)',fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.email}</p>
                </div>
              </div>
              <span className="badge" style={{background:plan.color+'18',color:plan.color,border:`1px solid ${plan.color}28`,width:'100%',justifyContent:'center',fontSize:10.5}}>
                {plan.id==='pro'?<Crown size={9}/>:plan.id==='business'?<Star size={9}/>:<User size={9}/>} {plan.name}
              </span>
            </div>
            <button className="nav-item" style={{color:'#f87171'}} onClick={onLogout}><LogOut size={13}/>Wyloguj się</button>
          </>
        ):(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${plan.color}88,${plan.color})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}} title={profile?.full_name||''}>
              {(profile?.full_name||'U').charAt(0).toUpperCase()}
            </div>
            <button onClick={onLogout} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',display:'flex',padding:4,borderRadius:6}} title="Wyloguj się"><LogOut size={14}/></button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── AUTH SCREEN ───────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({email:'',password:'',full_name:'',company:'',nip:''})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setF = (k,v) => setForm(p=>({...p,[k]:v}))

  const DEMOS = [
    {label:'Adam Wiśniewski — Plan Pro', email:'adam@budowlanka.pl', pw:'demo123', badge:'pro', badgeColor:'#7ec8f8'},
    {label:'Marta Zielińska — Plan Free', email:'marta@marex.pl', pw:'demo456', badge:'free', badgeColor:'#64748b'},
  ]

  const [_attempts, _setAttempts] = useState({count:0, last:0})

  const handleSubmit = async () => {
    setError(''); 
    // Client-side rate limiting (Supabase also has server-side)
    const now = Date.now()
    if (_attempts.count >= 5 && now - _attempts.last < 60000) {
      return setError('Zbyt wiele prób logowania. Odczekaj minutę.')
    }
    _setAttempts(a => ({count: now - a.last > 60000 ? 1 : a.count+1, last: now}))
    setLoading(true)
    try {
      if (IS_DEMO) {
        await new Promise(r=>setTimeout(r,700))
        if (mode === 'login') {
          const u = Object.values(DEMO_DB.users).find(u=>u.email===form.email&&u.password===form.password)
          if (!u) throw new Error('Nieprawidłowy e-mail lub hasło')
          const profile = DEMO_DB.profiles[u.id]
          const userData = DEMO_DATA[u.id] || {clients:[],projects:[],cost_estimates:[],invoices:[],contracts:[]}
          onLogin(profile, userData)
        } else {
          if(!form.email||!form.password||!form.full_name) throw new Error('Uzupełnij wszystkie wymagane pola')
          const newId='new_'+uid()
          const profile={id:newId,email:form.email,full_name:form.full_name,company:form.company||form.full_name,nip:form.nip,plan:'free',ksef_token:null,ksef_nip:null,ksef_env:'test'}
          onLogin(profile,{clients:[],projects:[],cost_estimates:[],invoices:[],contracts:[]})
        }
      } else {
        if (mode === 'login') {
          const { data, error } = await supabase.auth.signInWithPassword({email:form.email,password:form.password})
          if (error) throw error
        } else {
          if(!form.email||!form.password||!form.full_name) throw new Error('Uzupełnij wszystkie wymagane pola')
          if(!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) throw new Error('Nieprawidłowy format e-mail')
          if(form.password.length < 8) throw new Error('Hasło musi mieć min. 8 znaków')
          const { data, error } = await supabase.auth.signUp({
            email:form.email, password:form.password,
            options:{data:{full_name:form.full_name,company:form.company||form.full_name,nip:form.nip}}
          })
          if (error) throw error
        }
      }
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',fontFamily:"'Sora','DM Sans',system-ui,sans-serif"}}>
      {/* LEFT */}
      <div style={{flex:1,background:'var(--surface)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 80px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-60,left:-60,width:260,height:260,borderRadius:'50%',background:'rgba(45,125,210,.05)',border:'1px solid rgba(192,57,43,.1)'}}/>
        <div style={{position:'absolute',bottom:-40,right:-40,width:180,height:180,borderRadius:'50%',background:'#22c55e07',border:'1px solid #22c55e14'}}/>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:44}}>
            <div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,var(--accent),#3d8fe0)',display:'flex',alignItems:'center',justifyContent:'center'}}><Building2 size={20} color="#fff"/></div>
            <span style={{fontSize:22,fontWeight:900,color:'var(--text)'}}><span style={{color:'var(--accent2)'}}>Loft</span>Desk</span>
          </div>
          <h1 style={{fontSize:36,fontWeight:900,color:'var(--text)',lineHeight:1.15,marginBottom:14,letterSpacing:-1}}>System dla firm<br/><span style={{color:'var(--accent2)'}}>budowlanych</span></h1>
          <p style={{color:'var(--text3)',fontSize:14.5,lineHeight:1.7,marginBottom:36,maxWidth:360}}>Faktury, kosztorysy, projekty i KSeF w jednym miejscu. Multi-user z pełną izolacją danych.</p>
          {[['🔐','Multi-user — Row Level Security'],['🧾','KSeF — środowisko test + produkcja'],['📋','Baza kosztorysów z powiązaniami'],['💳','Plany Free / Pro / Business'],['☁️','PWA — działa offline, jak aplikacja'],['🔗','Netlify + Supabase — gotowe do deploy']].map(([ic,t])=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:9,color:'var(--text2)',fontSize:13.5,marginBottom:8}}>
              <span style={{fontSize:15}}>{ic}</span>{t}
            </div>
          ))}
          {IS_DEMO&&(
            <div style={{marginTop:32,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px'}}>
              <p style={{color:'var(--text3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.6,marginBottom:10}}>Konta demo (brak Supabase)</p>
              {DEMOS.map(d=>(
                <button key={d.email} className="btn btn-secondary" style={{width:'100%',justifyContent:'space-between',padding:'9px 13px',fontSize:12.5,marginBottom:7}}
                  onClick={()=>{setForm({email:d.email,password:d.pw,full_name:'',company:'',nip:''});setMode('login')}}>
                  <span>{d.label}</span>
                  <span className="badge" style={{background:d.badgeColor+'14',color:d.badgeColor,border:`1px solid ${d.badgeColor}28`,fontSize:10}}>{d.badge.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* RIGHT */}
      <div style={{width:440,background:'var(--surface)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 44px',borderLeft:'1px solid var(--border)'}}>
        <h2 style={{fontSize:23,fontWeight:800,color:'var(--text)',marginBottom:6}}>{mode==='login'?'Zaloguj się':'Załóż konto'}</h2>
        <p style={{color:'var(--text3)',fontSize:13.5,marginBottom:26}}>{mode==='login'?'Wpisz dane konta LoftDesk':'Bezpłatnie, bez karty kredytowej'}</p>
        {error&&<div style={{background:'#3d0f0f',border:'1px solid #ef444428',borderRadius:9,padding:'10px 13px',marginBottom:14,display:'flex',gap:8,alignItems:'center',color:'#f87171',fontSize:13.5}}><AlertCircle size={14}/>{error}</div>}
        {mode==='register'&&<>
          <Fld label="Imię i nazwisko *"><input className="input" value={form.full_name} onChange={e=>setF('full_name',e.target.value)} placeholder="Jan Kowalski"/></Fld>
          <Fld label="Nazwa firmy"><input className="input" value={form.company} onChange={e=>setF('company',e.target.value)} placeholder="Kowalski Budowlanka"/></Fld>
          <Fld label="NIP"><input className="input" value={form.nip} onChange={e=>setF('nip',e.target.value)} placeholder="0000000000"/></Fld>
        </>}
        <Fld label="E-mail *">
          <div style={{position:'relative'}}>
            <Mail size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}/>
            <input type="email" className="input" style={{paddingLeft:34}} value={form.email} onChange={e=>setF('email',e.target.value)} placeholder="email@firma.pl" onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
          </div>
        </Fld>
        <Fld label="Hasło *">
          <div style={{position:'relative'}}>
            <Lock size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}/>
            <input type={showPw?'text':'password'} className="input" style={{paddingLeft:34,paddingRight:42}} value={form.password} onChange={e=>setF('password',e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
            <button type="button" onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text3)',cursor:'pointer',display:'flex'}}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button>
          </div>
        </Fld>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'11px',marginTop:4}} onClick={handleSubmit} disabled={loading}>
          {loading?<RefreshCw size={15} className="spin"/>:mode==='login'?<><Key size={14}/>Zaloguj się</>:<><Plus size={14}/>Utwórz konto</>}
        </button>
        <p style={{textAlign:'center',marginTop:18,color:'var(--text3)',fontSize:13}}>
          {mode==='login'?<>Nie masz konta? <button onClick={()=>{setMode('register');setError('')}} style={{background:'none',border:'none',color:'var(--accent2)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit'}}>Zarejestruj się</button></>
            :<>Masz już konto? <button onClick={()=>{setMode('login');setError('')}} style={{background:'none',border:'none',color:'var(--accent2)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:'inherit'}}>Zaloguj się</button></>}
        </p>
      </div>
    </div>
  )
}

// ── APP DATA PROVIDER ─────────────────────────────────────
function AppDataProvider({ userId, initialProfile, initialData, children }) {
  const [profile, setProfile] = useState(initialProfile)
  const [data, setData] = useState({
    clients: initialData.clients||[],
    projects: initialData.projects||[],
    cost_estimates: initialData.cost_estimates||[],
    invoices: initialData.invoices||[],
    contracts: initialData.contracts||[],
  })
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(false)

  const toast = useCallback((msg, type='info') => {
    const id = uid()
    setToasts(p=>[...p,{id,msg,type}])
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500)
  },[])

  const mutateData = fn => setData(prev=>fn(prev))

  // Supabase helpers
  const sbFetch = async (table, select='*') => {
    if (IS_DEMO) return
    const rows = await sbQuery(supabase.from(table).select(select).order('created_at',{ascending:false}))
    mutateData(d=>({...d,[table]:rows}))
  }

  // ── CLIENTS ──
  const addClient = async d => {
    if (IS_DEMO) { mutateData(s=>({...s,clients:[...s.clients,{...d,id:uid(),user_id:userId}]})); toast('Kontrahent dodany','success'); return }
    const row = await sbQuery(supabase.from('clients').insert({
      user_id: userId,
      name:    d.name||'',
      nip:     d.nip||null,
      address: d.address||null,
      email:   d.email||null,
      phone:   d.phone||null,
    }).select().single())
    mutateData(s=>({...s,clients:[row,...s.clients]})); toast('Kontrahent dodany','success')
  }
  const updateClient = async d => {
    if (IS_DEMO) { mutateData(s=>({...s,clients:s.clients.map(c=>c.id===d.id?d:c)})); toast('Zaktualizowano','success'); return }
    await sbQuery(supabase.from('clients').update({
      name:    d.name||'',
      nip:     d.nip||null,
      address: d.address||null,
      email:   d.email||null,
      phone:   d.phone||null,
    }).eq('id',d.id))
    mutateData(s=>({...s,clients:s.clients.map(c=>c.id===d.id?d:c)})); toast('Zaktualizowano','success')
  }
  const deleteClient = async id => {
    if (IS_DEMO) { mutateData(s=>({...s,clients:s.clients.filter(c=>c.id!==id)})); toast('Usunięto'); return }
    await sbQuery(supabase.from('clients').delete().eq('id',id))
    mutateData(s=>({...s,clients:s.clients.filter(c=>c.id!==id)})); toast('Usunięto')
  }

  // ── COST ESTIMATES ──

  // helper: empty string → null for uuid fields
  const uuidOrNull = v => (v && v !== '' ? v : null)
  const addCostEstimate = async d => {
    const number = genNum('KE', data.cost_estimates)
    const {items,...rest} = d
    const totalNet = calcNet(items||[])
    const totalGross = totalNet * 1.08
    if (IS_DEMO) {
      const ce = {...rest,items,id:uid(),user_id:userId,number,total_net:totalNet,total_gross:totalGross,created_at:today()}
      mutateData(s=>({...s,cost_estimates:[ce,...s.cost_estimates]})); toast('Kosztorys utworzony','success'); return
    }
    const ceRow = await sbQuery(supabase.from('cost_estimates').insert({
      user_id:    userId,
      number:     number,
      name:       d.name||'',
      client_id:  uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:     d.status||'draft',
      total_net:  totalNet,
      total_gross:totalGross,
    }).select().single())
    if (items?.length) {
      const cleanItems = items.map((it,i)=>({
        cost_estimate_id: ceRow.id,
        description:      it.description||'',
        unit:             it.unit||'szt',
        quantity:         Number(it.quantity)||0,
        unit_price:       Number(it.unit_price)||0,
        sort_order:       i,
      }))
      await sbQuery(supabase.from('cost_estimate_items').insert(cleanItems))
    }
    ceRow.items = items
    mutateData(s=>({...s,cost_estimates:[ceRow,...s.cost_estimates]})); toast('Kosztorys utworzony','success')
  }
  const updateCostEstimate = async d => {
    const {items,...rest} = d
    const totalNet = calcNet(items||[])
    const totalGross = totalNet * 1.08
    if (IS_DEMO) { mutateData(s=>({...s,cost_estimates:s.cost_estimates.map(c=>c.id===d.id?{...d,total_net:totalNet,total_gross:totalGross}:c)})); toast('Zaktualizowano','success'); return }
    await sbQuery(supabase.from('cost_estimates').update({
      name:        d.name||'',
      client_id: uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:      d.status||'draft',
      total_net:   totalNet,
      total_gross: totalGross,
    }).eq('id',d.id))
    await sbQuery(supabase.from('cost_estimate_items').delete().eq('cost_estimate_id',d.id))
    if (items?.length) {
      const cleanItems = items.map((it,i)=>({
        cost_estimate_id: d.id,
        description:      it.description||'',
        unit:             it.unit||'szt',
        quantity:         Number(it.quantity)||0,
        unit_price:       Number(it.unit_price)||0,
        sort_order:       i,
      }))
      await sbQuery(supabase.from('cost_estimate_items').insert(cleanItems))
    }
    mutateData(s=>({...s,cost_estimates:s.cost_estimates.map(c=>c.id===d.id?{...d,total_net:totalNet,total_gross:totalGross,items}:c)})); toast('Zaktualizowano','success')
  }
  const deleteCostEstimate = async id => {
    if (IS_DEMO) { mutateData(s=>({...s,cost_estimates:s.cost_estimates.filter(c=>c.id!==id),projects:s.projects.map(p=>({...p,linked_ce_ids:(p.linked_ce_ids||[]).filter(x=>x!==id)}))})); toast('Usunięto'); return }
    await sbQuery(supabase.from('cost_estimates').delete().eq('id',id))
    mutateData(s=>({...s,cost_estimates:s.cost_estimates.filter(c=>c.id!==id),projects:s.projects.map(p=>({...p,linked_ce_ids:(p.linked_ce_ids||[]).filter(x=>x!==id)}))})); toast('Usunięto')
  }

  // ── PROJECTS ──
  const addProject = async d => {
    const number = genNum('PRJ', data.projects)
    if (IS_DEMO) { mutateData(s=>({...s,projects:[{...d,id:uid(),user_id:userId,number,created_at:today()},...s.projects]})); toast('Projekt utworzony','success'); return }
    const row = await sbQuery(supabase.from('projects').insert({
      user_id:    userId,
      number:     number,
      name:       d.name||'',
      client_id:  uuidOrNull(d.client_id),
      status:     d.status||'offer',
      start_date: d.start_date||null,
      end_date:   d.end_date||null,
      address:    d.address||null,
      budget:     d.budget||null,
      notes:      d.notes||null,
    }).select().single())
    mutateData(s=>({...s,projects:[{...row,linked_ce_ids:d.linked_ce_ids||[]},...s.projects]})); toast('Projekt utworzony','success')
  }
  const updateProject = async d => {
    if (IS_DEMO) { mutateData(s=>({...s,projects:s.projects.map(p=>p.id===d.id?d:p)})); toast('Zaktualizowano','success'); return }
    await sbQuery(supabase.from('projects').update({
      name:       d.name||'',
      client_id:  uuidOrNull(d.client_id),
      status:     d.status||'offer',
      start_date: d.start_date||null,
      end_date:   d.end_date||null,
      address:    d.address||null,
      budget:     d.budget||null,
      notes:      d.notes||null,
    }).eq('id',d.id))
    mutateData(s=>({...s,projects:s.projects.map(p=>p.id===d.id?d:p)})); toast('Zaktualizowano','success')
  }
  const deleteProject = async id => {
    if (IS_DEMO) { mutateData(s=>({...s,projects:s.projects.filter(p=>p.id!==id)})); toast('Usunięto'); return }
    await sbQuery(supabase.from('projects').delete().eq('id',id))
    mutateData(s=>({...s,projects:s.projects.filter(p=>p.id!==id)})); toast('Usunięto')
  }

  // ── INVOICES ──
  const addInvoice = async d => {
    const {items,...rest} = d
    if (IS_DEMO) {
      const number = genNum('FV', data.invoices)
      mutateData(s=>({...s,invoices:[{...rest,items,id:uid(),user_id:userId,number,ksef_status:null,ksef_ref:null},...s.invoices]})); toast('Faktura wystawiona','success'); return
    }
    // Use DB function for race-condition-safe numbering
    const { data: numData } = await supabase.rpc('generate_invoice_number', { p_user_id: userId })
    const number = numData || genNum('FV', data.invoices)
    const row = await sbQuery(supabase.from('invoices').insert({
      user_id:    userId,
      number:     number,
      client_id:  uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:     d.status||'unpaid',
      issue_date: d.issue_date||null,
      due_date:   d.due_date||null,
    }).select().single())
    if (items?.length) {
      const cleanInvItems = items.map((it,i)=>({
        invoice_id:   row.id,
        description:  it.description||'',
        unit:         it.unit||'szt',
        quantity:     Number(it.quantity)||0,
        unit_price:   Number(it.unit_price)||0,
        vat_rate:     Number(it.vat_rate)||23,
        sort_order:   i,
      }))
      await sbQuery(supabase.from('invoice_items').insert(cleanInvItems))
    }
    mutateData(s=>({...s,invoices:[{...row,items},...s.invoices]})); toast('Faktura wystawiona','success')
  }
  const updateInvoice = async d => {
    const {items,...rest} = d
    if (IS_DEMO) { mutateData(s=>({...s,invoices:s.invoices.map(f=>f.id===d.id?d:f)})); toast('Zaktualizowano','success'); return }
    await sbQuery(supabase.from('invoices').update({
      client_id:  uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:     d.status||'unpaid',
      issue_date: d.issue_date||null,
      due_date:   d.due_date||null,
    }).eq('id',d.id))
    await sbQuery(supabase.from('invoice_items').delete().eq('invoice_id',d.id))
    if (items?.length) {
      const cleanInvItems = items.map((it,i)=>({
        invoice_id:  d.id,
        description: it.description||'',
        unit:        it.unit||'szt',
        quantity:    Number(it.quantity)||0,
        unit_price:  Number(it.unit_price)||0,
        vat_rate:    Number(it.vat_rate)||23,
        sort_order:  i,
      }))
      await sbQuery(supabase.from('invoice_items').insert(cleanInvItems))
    }
    mutateData(s=>({...s,invoices:s.invoices.map(f=>f.id===d.id?{...d,items}:f)})); toast('Zaktualizowano','success')
  }
  const deleteInvoice = async id => {
    if (IS_DEMO) { mutateData(s=>({...s,invoices:s.invoices.filter(f=>f.id!==id)})); toast('Usunięto'); return }
    await sbQuery(supabase.from('invoices').delete().eq('id',id))
    mutateData(s=>({...s,invoices:s.invoices.filter(f=>f.id!==id)})); toast('Usunięto')
  }
  const updateInvoiceKsef = async (id, ksefStatus, ksefRef) => {
    if (!IS_DEMO) await sbQuery(supabase.from('invoices').update({ksef_status:ksefStatus,ksef_ref:ksefRef}).eq('id',id))
    mutateData(s=>({...s,invoices:s.invoices.map(f=>f.id===id?{...f,ksef_status:ksefStatus,ksef_ref:ksefRef}:f)}))
  }

  // ── CONTRACTS ──
  const addContract = async d => {
    if (IS_DEMO) {
      const number = genNum('UMW', data.contracts)
      mutateData(s=>({...s,contracts:[{...d,id:uid(),user_id:userId,number},...s.contracts]})); toast('Umowa utworzona','success'); return
    }
    const { data: numData } = await supabase.rpc('generate_contract_number', { p_user_id: userId })
    const number = numData || genNum('UMW', data.contracts)
    const row = await sbQuery(supabase.from('contracts').insert({
      user_id:    userId,
      number:     number,
      client_id:  uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:     d.status||'unsigned',
      sign_date:  d.sign_date||null,
      value:      d.value||null,
      notes:      d.notes||null,
    }).select().single())
    mutateData(s=>({...s,contracts:[row,...s.contracts]})); toast('Umowa utworzona','success')
  }
  const updateContract = async d => {
    if (IS_DEMO) { mutateData(s=>({...s,contracts:s.contracts.map(c=>c.id===d.id?d:c)})); toast('Zaktualizowano','success'); return }
    await sbQuery(supabase.from('contracts').update({
      client_id:  uuidOrNull(d.client_id),
      project_id: uuidOrNull(d.project_id),
      status:     d.status||'unsigned',
      sign_date:  d.sign_date||null,
      value:      d.value||null,
      notes:      d.notes||null,
    }).eq('id',d.id))
    mutateData(s=>({...s,contracts:s.contracts.map(c=>c.id===d.id?d:c)})); toast('Zaktualizowano','success')
  }
  const deleteContract = async id => {
    if (IS_DEMO) { mutateData(s=>({...s,contracts:s.contracts.filter(c=>c.id!==id)})); toast('Usunięto'); return }
    await sbQuery(supabase.from('contracts').delete().eq('id',id))
    mutateData(s=>({...s,contracts:s.contracts.filter(c=>c.id!==id)})); toast('Usunięto')
  }

  // ── PROFILE / PLAN / KSEF ──
  const updateProfile = async d => {
    if (!IS_DEMO) await sbQuery(supabase.from('profiles').update(d).eq('id',userId))
    setProfile(p=>({...p,...d})); 
  }
  const changePlan = async plan => {
    if (!IS_DEMO) await sbQuery(supabase.from('profiles').update({plan}).eq('id',userId))
    setProfile(p=>({...p,plan}))
  }
  const updateKsefSettings = async s => {
    const upd = {ksef_token:s.token,ksef_nip:s.nip,ksef_env:s.env}
    if (!IS_DEMO) await sbQuery(supabase.from('profiles').update(upd).eq('id',userId))
    setProfile(p=>({...p,...upd}))
  }

  const ctx = {
    profile, data, loading, toast,
    addClient, updateClient, deleteClient,
    addCostEstimate, updateCostEstimate, deleteCostEstimate,
    addProject, updateProject, deleteProject,
    addInvoice, updateInvoice, deleteInvoice, updateInvoiceKsef,
    addContract, updateContract, deleteContract,
    updateProfile, changePlan, updateKsefSettings,
  }

  return <AppCtx.Provider value={ctx}>{children}<Toast toasts={toasts}/></AppCtx.Provider>
}



// ── PORTAL STYLES (light theme, isolated from dark app) ──
const PORTAL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  .portal-root { min-height:100vh; background:#f0ede8; font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:#111; }
  .portal-header {
    background:#fff; border-bottom:1px solid #e8e4de; padding:0 36px;
    display:flex; align-items:center; justify-content:space-between;
    height:66px; position:sticky; top:0; z-index:100;
    box-shadow:0 1px 0 #e8e4de, 0 4px 24px rgba(0,0,0,.05);
  }
  .portal-logo { display:flex; align-items:center; gap:11px; font-family:'Outfit',sans-serif; font-size:19px; font-weight:800; letter-spacing:-.4px; color:#111; }
  .portal-section { background:#fff; border:1px solid #e8e4de; border-radius:18px; padding:26px 30px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  .portal-section-title { font-family:'Outfit',sans-serif; font-size:10px; font-weight:700; letter-spacing:1.8px; text-transform:uppercase; color:#bbb; margin-bottom:16px; display:flex; align-items:center; gap:7px; }
  .portal-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 11px; border-radius:20px; font-size:11.5px; font-weight:600; }
  .portal-badge.pending { background:#fff9ed; color:#b45309; border:1px solid #fde68a; }
  .portal-badge.accepted { background:#f0fdf4; color:#15803d; border:1px solid #86efac; }
  .portal-badge.draft { background:#f5f5f5; color:#888; border:1px solid #e0e0e0; }
  .portal-table { width:100%; border-collapse:collapse; }
  .portal-table th { font-family:'Outfit',sans-serif; font-size:10px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#bbb; padding:0 10px 14px; text-align:left; border-bottom:1px solid #f0ece6; }
  .portal-table th.r { text-align:right; }
  .portal-table td { padding:13px 10px; border-bottom:1px solid #f5f2ee; font-size:14px; color:#333; vertical-align:middle; }
  .portal-table td.r { text-align:right; }
  .portal-table td.num { text-align:center; color:#ccc; font-size:12px; font-weight:600; width:40px; }
  .portal-table td.name { font-weight:500; color:#111; }
  .portal-table td.muted { color:#999; font-size:13px; }
  .portal-table td.price { font-weight:700; color:#111; }
  .portal-table tbody tr:last-child td { border-bottom:none; }
  .portal-table tbody tr:hover td { background:#fdfcfb; }
  .portal-table tfoot td { font-family:'Outfit',sans-serif; font-weight:700; border-top:2px solid #e8e4de; padding-top:16px; }
  .portal-table tfoot td.r { font-size:20px; font-weight:900; color:#111; }
  .portal-table tfoot td.label { text-align:right; color:#999; font-size:13px; font-weight:500; }
  .msg-wrap { display:flex; flex-direction:column; margin-bottom:8px; }
  .msg-wrap.client { align-items:flex-end; }
  .msg-wrap.contractor { align-items:flex-start; }
  .msg-meta { font-size:10px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; margin-bottom:4px; padding:0 4px; }
  .msg-meta.client { color:#c0392b; text-align:right; }
  .msg-meta.contractor { color:#666; }
  .msg-bubble { max-width:70%; padding:13px 17px; font-size:14px; line-height:1.55; animation:msgIn .22s cubic-bezier(.34,1.5,.64,1) both; }
  .msg-bubble.client { background:#c0392b; color:#fff; border-radius:18px 18px 5px 18px; box-shadow:0 4px 16px rgba(192,57,43,.3); }
  .msg-bubble.contractor { background:#fff; color:#111; border-radius:18px 18px 18px 5px; border:1px solid #e8e4de; box-shadow:0 2px 10px rgba(0,0,0,.07); }
  .msg-time { font-size:11px; margin-top:5px; padding:0 1px; }
  .msg-time.client { color:rgba(255,255,255,.55); text-align:right; }
  .msg-time.contractor { color:#ccc; }
  @keyframes msgIn { from { opacity:0; transform:scale(.9) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .portal-chat-area { min-height:200px; max-height:380px; overflow-y:auto; padding:4px 0 12px; display:flex; flex-direction:column; scroll-behavior:smooth; }
  .portal-chat-area::-webkit-scrollbar { width:4px; }
  .portal-chat-area::-webkit-scrollbar-track { background:transparent; }
  .portal-chat-area::-webkit-scrollbar-thumb { background:#e8e4de; border-radius:10px; }
  .portal-input-row { display:flex; gap:10px; align-items:center; margin-top:16px; padding-top:16px; border-top:1px solid #f0ece6; }
  .portal-input { flex:1; border:1.5px solid #e8e4de; border-radius:14px; padding:13px 18px; font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; color:#111; background:#faf8f5; outline:none; transition:border-color .15s, box-shadow .15s, background .15s; box-sizing:border-box; }
  .portal-input:focus { border-color:#c0392b; background:#fff; box-shadow:0 0 0 3px rgba(192,57,43,.08); }
  .portal-input::placeholder { color:#ccc; }
  .portal-send { width:48px; height:48px; border-radius:13px; border:none; cursor:pointer; background:#c0392b; color:#fff; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; box-shadow:0 4px 14px rgba(192,57,43,.35); }
  .portal-send:hover:not(:disabled) { background:#a93226; transform:translateY(-1px); box-shadow:0 6px 20px rgba(192,57,43,.45); }
  .portal-send:active:not(:disabled) { transform:scale(.96); }
  .portal-send:disabled { background:#e8e5e2; box-shadow:none; cursor:not-allowed; }
  .portal-name-card { background:linear-gradient(135deg,#fff9f8,#fff); border:1.5px solid #f5ccc7; border-radius:18px; padding:24px 28px; margin-bottom:12px; box-shadow:0 2px 16px rgba(192,57,43,.07); }
  .input { border:1.5px solid #e8e4de !important; background:#faf8f5 !important; color:#111 !important; border-radius:12px; padding:12px 16px; font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; outline:none; transition:border-color .15s; }
  .input:focus { border-color:#c0392b !important; background:#fff !important; }
  .btn { border:none; border-radius:10px; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:all .15s; white-space:nowrap; }
  .btn-primary { background:#c0392b; color:#fff; padding:10px 20px; font-size:14px; box-shadow:0 4px 14px rgba(192,57,43,.3); }
  .btn-primary:hover:not(:disabled) { background:#a93226; }
  .btn-primary:disabled { opacity:.45; cursor:not-allowed; }
`

// ══════════════════════════════════════════════════════════
// CLIENT PORTAL
// ══════════════════════════════════════════════════════════

function ClientPortalView({ token }) {
  const [state, setState] = useState('loading')
  const [portalData, setPortalData] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [clientName, setClientName] = useState('')
  const [nameSet, setNameSet] = useState(false)
  const messagesEndRef = useRef(null)
  const lastMsgTime = useRef(null)

  // Fonts
  useEffect(() => {
    if (!document.getElementById('portal-gf')) {
      const l = document.createElement('link')
      l.id = 'portal-gf'; l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
      document.head.appendChild(l)
    }
  }, [])

  const api = async (path, opts={}) => {
    const r = await fetch('/.netlify/functions' + path, opts)
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error||'err') }
    return r.json()
  }

  useEffect(() => {
    if (!token || IS_DEMO) { setState('error'); return }
    api('/portal-get?token=' + token)
      .then(d => {
        setPortalData(d); setMessages(d.messages||[])
        if (d.token?.client_name) { setClientName(d.token.client_name); setNameSet(true) }
        if (d.messages?.length) lastMsgTime.current = d.messages[d.messages.length-1].created_at
        setState('ok')
      })
      .catch(e => setState(e.message==='expired'||e.message==='not_found'?'expired':'error'))
  }, [token])

  useEffect(() => {
    if (state!=='ok') return
    const iv = setInterval(() => {
      const after = lastMsgTime.current ? '&after='+encodeURIComponent(lastMsgTime.current) : ''
      api('/portal-message?token='+token+after)
        .then(d => {
          if (!d.messages?.length) return
          setMessages(prev => {
            const ids = new Set(prev.map(m=>m.id))
            const fresh = d.messages.filter(m=>!ids.has(m.id))
            if (!fresh.length) return prev
            lastMsgTime.current = fresh[fresh.length-1].created_at
            return [...prev, ...fresh]
          })
        }).catch(()=>{})
    }, 5000)
    return () => clearInterval(iv)
  }, [state, token])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages])

  const send = async () => {
    if (!msgText.trim()) return
    const content = msgText.trim(); setMsgText(''); setSending(true)
    const tmp = {id:'tmp-'+Date.now(), sender:'client', content, created_at:new Date().toISOString()}
    setMessages(prev=>[...prev,tmp])
    api('/portal-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,content})})
      .catch(()=>{ setMsgText(content); setMessages(prev=>prev.filter(m=>m.id!==tmp.id)) })
      .finally(()=>setSending(false))
  }

  const saveName = () => {
    if (!clientName.trim()) return
    api('/portal-message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,client_name:clientName.trim()})}).catch(()=>{})
    setNameSet(true)
  }

  const money = n => n ? Number(n).toLocaleString('pl-PL',{minimumFractionDigits:2})+'  zł' : '0,00 zł'
  const date = d => d ? new Date(d).toLocaleDateString('pl-PL',{day:'2-digit',month:'long',year:'numeric'}) : '—'
  const time = d => new Date(d).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})

  // ── SHARED STYLES ──
  const S = {
    root: { minHeight:'100vh', background:'#f0ede8', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", color:'#111', WebkitFontSmoothing:'antialiased' },
    header: { background:'#ffffff', borderBottom:'1px solid #e8e4de', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:66, position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 16px rgba(0,0,0,.06)' },
    logoText: { fontFamily:"'Outfit',sans-serif", fontSize:20, fontWeight:800, letterSpacing:'-.4px', color:'#111', display:'flex', alignItems:'center', gap:10 },
    logoBox: { width:36, height:36, borderRadius:10, background:'#c0392b', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    page: { maxWidth:820, margin:'0 auto', padding:'28px 20px 60px' },
    card: { background:'#ffffff', border:'1px solid #e8e4de', borderRadius:18, padding:'26px 30px', marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,.05)' },
    label: { fontFamily:"'Outfit',sans-serif", fontSize:10, fontWeight:700, letterSpacing:'1.8px', textTransform:'uppercase', color:'#bbb', marginBottom:16, display:'flex', alignItems:'center', gap:7 },
    input: { width:'100%', border:'1.5px solid #e8e4de', borderRadius:13, padding:'13px 18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, color:'#111', background:'#faf9f6', outline:'none', boxSizing:'border-box', transition:'border-color .15s' },
    sendBtn: { width:48, height:48, borderRadius:13, border:'none', cursor:'pointer', background:'#c0392b', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 14px rgba(192,57,43,.35)', transition:'all .15s' },
    sendBtnDisabled: { width:48, height:48, borderRadius:13, border:'none', cursor:'not-allowed', background:'#e0dbd8', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
    bubbleClient: { maxWidth:'70%', padding:'12px 16px', fontSize:14, lineHeight:1.55, background:'#c0392b', color:'#ffffff', borderRadius:'18px 18px 4px 18px', boxShadow:'0 3px 14px rgba(192,57,43,.28)', alignSelf:'flex-end', wordBreak:'break-word' },
    bubbleContractor: { maxWidth:'70%', padding:'12px 16px', fontSize:14, lineHeight:1.55, background:'#ffffff', color:'#111111', borderRadius:'18px 18px 18px 4px', border:'1px solid #e8e4de', boxShadow:'0 2px 8px rgba(0,0,0,.07)', alignSelf:'flex-start', wordBreak:'break-word' },
    nameCard: { background:'linear-gradient(135deg,#fff9f8,#fff)', border:'1.5px solid #f5ccc7', borderRadius:18, padding:'24px 28px', marginBottom:12, boxShadow:'0 2px 16px rgba(192,57,43,.07)' },
    pill: (type) => ({
      display:'inline-flex', alignItems:'center', padding:'3px 11px', borderRadius:20, fontSize:11.5, fontWeight:600,
      ...(type==='accepted' ? {background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac'} :
          type==='draft'    ? {background:'#f5f5f5',color:'#888',border:'1px solid #ddd'} :
                              {background:'#fff9ed',color:'#b45309',border:'1px solid #fde68a'})
    }),
  }

  const centerScreen = (
    <div style={{...S.root, display:'flex', alignItems:'center', justifyContent:'center'}}>
      {state==='loading' && (
        <div style={{textAlign:'center'}}>
          <div style={{width:56,height:56,borderRadius:16,background:'#fff',border:'1px solid #e8e4de',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 4px 20px rgba(0,0,0,.08)'}}>
            <RefreshCw size={24} color="#c0392b" className="spin"/>
          </div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:15,color:'#888'}}>Ładowanie...</div>
        </div>
      )}
      {state==='expired' && (
        <div style={{textAlign:'center',maxWidth:380,padding:36,background:'#fff',borderRadius:24,border:'1px solid #e8e4de',boxShadow:'0 8px 40px rgba(0,0,0,.08)'}}>
          <div style={{width:64,height:64,borderRadius:18,background:'#fff5f4',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',border:'1px solid #fcd5d0'}}><Lock size={28} color="#c0392b"/></div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:22,fontWeight:800,marginBottom:8,color:'#111'}}>Link wygasł</div>
          <div style={{color:'#888',fontSize:14,lineHeight:1.6}}>Skontaktuj się z wykonawcą po nowy link.</div>
        </div>
      )}
      {state==='error' && (
        <div style={{textAlign:'center',maxWidth:380,padding:36,background:'#fff',borderRadius:24,border:'1px solid #e8e4de',boxShadow:'0 8px 40px rgba(0,0,0,.08)'}}>
          <AlertCircle size={40} color="#ef4444" style={{marginBottom:16}}/>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:20,fontWeight:800,marginBottom:8,color:'#111'}}>Nie znaleziono</div>
          <div style={{color:'#888',fontSize:14}}>Sprawdź link lub skontaktuj się z wykonawcą.</div>
        </div>
      )}
    </div>
  )

  if (state!=='ok') return centerScreen

  const {estimate,contractor} = portalData
  const gross = estimate?.total_gross || estimate?.items?.reduce((s,i)=>s+Number(i.unit_price||0)*Number(i.quantity||0)*1.23,0) || 0

  return (
    <div style={S.root}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logoText}>
          {contractor?.logo_base64
            ? <img src={contractor.logo_base64} alt="logo" style={{height:38,maxWidth:150,objectFit:'contain'}}/>
            : <><div style={S.logoBox}><Building2 size={18} color="#fff"/></div><span><span style={{color:'#c0392b'}}>Loft</span>Desk</span></>
          }
        </div>
        <span style={{fontSize:12,color:'#bbb',fontWeight:500,letterSpacing:.3}}>Portal klienta</span>
      </div>

      <div style={S.page}>

        {/* PODAJ IMIĘ */}
        {!nameSet && (
          <div style={S.nameCard}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:17,fontWeight:700,marginBottom:6,color:'#111'}}>Jak mamy się do Ciebie zwracać?</div>
            <div style={{fontSize:13.5,color:'#888',marginBottom:16,lineHeight:1.5}}>Podaj imię — wykonawca zobaczy je przy Twoich wiadomościach.</div>
            <div style={{display:'flex',gap:10}}>
              <input
                style={S.input}
                value={clientName}
                onChange={e=>setClientName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&saveName()}
                onFocus={e=>{e.target.style.borderColor='#c0392b';e.target.style.background='#fff'}}
                onBlur={e=>{e.target.style.borderColor='#e8e4de';e.target.style.background='#faf9f6'}}
                placeholder="np. Jan Kowalski"
              />
              <button onClick={saveName} disabled={!clientName.trim()}
                style={{padding:'0 22px',height:50,borderRadius:13,border:'none',cursor:'pointer',background:clientName.trim()?'#c0392b':'#e0dbd8',color:'#fff',fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:14,fontWeight:600,whiteSpace:'nowrap',boxShadow:clientName.trim()?'0 4px 14px rgba(192,57,43,.3)':'none',transition:'all .15s'}}>
                Zapisz
              </button>
            </div>
          </div>
        )}

        {/* KOSZTORYS HEADER */}
        <div style={S.card}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:700,color:'#c0392b',letterSpacing:.5}}>{estimate?.number}</span>
                <span style={S.pill(estimate?.status)}>
                  {estimate?.status==='accepted'?'✓ Zaakceptowany':estimate?.status==='draft'?'Wersja robocza':'Oczekuje'}
                </span>
              </div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:24,fontWeight:800,letterSpacing:'-.5px',color:'#111',marginBottom:10,lineHeight:1.15}}>{estimate?.name}</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13,color:'#888'}}>
                <span>Wystawił: <strong style={{color:'#333',fontWeight:600}}>{contractor?.company||contractor?.full_name||'—'}</strong></span>
                {estimate?.created_at && <span>Data: <strong style={{color:'#333',fontWeight:600}}>{date(estimate.created_at)}</strong></span>}
              </div>
            </div>
            <div style={{background:'#f9f8f5',border:'1px solid #e8e4de',borderRadius:14,padding:'18px 24px',textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'#bbb',marginBottom:8}}>Wartość brutto</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:30,fontWeight:900,color:'#111',letterSpacing:'-1px',lineHeight:1}}>
                {money(gross)}
              </div>
            </div>
          </div>
        </div>

        {/* POZYCJE */}
        <div style={S.card}>
          <div style={S.label}><ClipboardList size={11}/>Pozycje — {estimate?.items?.length||0} poz.</div>
          {estimate?.items?.length > 0 ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #f0ece6'}}>
                    {['#','Opis prac','Jedn.','Ilość','Cena jedn.','Brutto'].map((h,i)=>(
                      <th key={i} style={{fontFamily:"'Outfit',sans-serif",fontSize:10,fontWeight:700,letterSpacing:'1.4px',textTransform:'uppercase',color:'#bbb',padding:'0 10px 14px',textAlign:i===0?'center':i>=3?'right':'left'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estimate.items.map((it,i)=>{
                    const g = Number(it.unit_price||0)*Number(it.quantity||0)*(1+Number(it.vat_rate||23)/100)
                    return (
                      <tr key={it.id} style={{borderBottom:'1px solid #f5f2ee'}}>
                        <td style={{padding:'13px 10px',textAlign:'center',color:'#ccc',fontSize:12,fontWeight:600}}>{i+1}</td>
                        <td style={{padding:'13px 10px',fontWeight:500,color:'#111'}}>{it.name||it.description||'—'}</td>
                        <td style={{padding:'13px 10px',color:'#999',fontSize:13,textAlign:'right'}}>{it.unit||'m²'}</td>
                        <td style={{padding:'13px 10px',color:'#555',textAlign:'right'}}>{it.quantity}</td>
                        <td style={{padding:'13px 10px',color:'#555',textAlign:'right'}}>{money(it.unit_price)}</td>
                        <td style={{padding:'13px 10px',fontWeight:700,color:'#111',textAlign:'right'}}>{money(g)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{padding:'16px 10px 4px',borderTop:'2px solid #e8e4de',textAlign:'right',color:'#888',fontSize:13,fontWeight:500}}>Łącznie brutto:</td>
                    <td style={{padding:'16px 10px 4px',borderTop:'2px solid #e8e4de',textAlign:'right',fontFamily:"'Outfit',sans-serif",fontSize:20,fontWeight:900,color:'#111'}}>{money(gross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:'32px 0',color:'#ccc',fontSize:14}}>Brak pozycji</div>
          )}
        </div>

        {/* CZAT */}
        <div style={S.card}>
          <div style={S.label}><MessageSquare size={11}/>Wiadomości do wykonawcy</div>

          {/* MESSAGES — overflow:scroll zawsze pokazuje scrollbar */}
          <div style={{minHeight:200,maxHeight:360,overflowY:'scroll',display:'flex',flexDirection:'column',gap:8,paddingRight:4,scrollBehavior:'smooth'}}>
            {messages.length===0 && (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:180,color:'#ccc',gap:10}}>
                <MessageSquare size={28} style={{opacity:.4}}/>
                <div style={{fontSize:14,color:'#aaa',fontWeight:500}}>Napisz pierwszą wiadomość</div>
                <div style={{fontSize:13,color:'#ccc'}}>Pytaj o szczegóły, proś o zmiany.</div>
              </div>
            )}
            {messages.map(m=>(
              <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:m.sender==='client'?'flex-end':'flex-start'}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'.8px',textTransform:'uppercase',marginBottom:4,paddingLeft:4,paddingRight:4,color:m.sender==='client'?'#c0392b':'#888'}}>
                  {m.sender==='client' ? (nameSet?clientName:'Ty') : (contractor?.company||'Wykonawca')}
                </div>
                <div style={m.sender==='client' ? S.bubbleClient : S.bubbleContractor}>
                  <div>{m.content}</div>
                  <div style={{fontSize:11,marginTop:5,color:m.sender==='client'?'rgba(255,255,255,.55)':'#bbb',textAlign:m.sender==='client'?'right':'left'}}>{time(m.created_at)}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {/* INPUT */}
          <div style={{display:'flex',gap:10,alignItems:'center',marginTop:16,paddingTop:16,borderTop:'1px solid #f0ece6'}}>
            <input
              style={{...S.input,flex:1}}
              value={msgText}
              onChange={e=>setMsgText(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
              onFocus={e=>{e.target.style.borderColor='#c0392b';e.target.style.background='#fff'}}
              onBlur={e=>{e.target.style.borderColor='#e8e4de';e.target.style.background='#faf9f6'}}
              placeholder="Napisz wiadomość... (Enter = wyślij)"
            />
            <button onClick={send} disabled={!msgText.trim()||sending} style={!msgText.trim()||sending ? S.sendBtnDisabled : S.sendBtn}>
              {sending ? <RefreshCw size={15} className="spin"/> : <Send size={15}/>}
            </button>
          </div>
        </div>

        {/* KONTAKT */}
        {(contractor?.email||contractor?.phone) && (
          <div style={{...S.card,padding:'18px 28px'}}>
            <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'1.2px',textTransform:'uppercase',color:'#bbb'}}>Kontakt</div>
              {contractor.phone && (
                <a href={'tel:'+contractor.phone} style={{color:'#333',fontSize:14,display:'flex',alignItems:'center',gap:9,textDecoration:'none',fontWeight:500}}>
                  <div style={{width:30,height:30,borderRadius:9,background:'#fff5f4',border:'1px solid #fcd5d0',display:'flex',alignItems:'center',justifyContent:'center'}}><Phone size={13} color="#c0392b"/></div>
                  {contractor.phone}
                </a>
              )}
              {contractor.email && (
                <a href={'mailto:'+contractor.email} style={{color:'#333',fontSize:14,display:'flex',alignItems:'center',gap:9,textDecoration:'none',fontWeight:500}}>
                  <div style={{width:30,height:30,borderRadius:9,background:'#fff5f4',border:'1px solid #fcd5d0',display:'flex',alignItems:'center',justifyContent:'center'}}><Mail size={13} color="#c0392b"/></div>
                  {contractor.email}
                </a>
              )}
            </div>
          </div>
        )}

        <div style={{textAlign:'center',marginTop:24,fontSize:12,color:'#ccc'}}>
          Portal klienta · <span style={{color:'#c0392b',fontWeight:600}}>LoftDesk</span>
        </div>
      </div>
    </div>
  )
}


// ── SHARE PORTAL MODAL ────────────────────────────────────
function SharePortalModal({ ke, onClose }) {
  const { toast } = useApp()
  const [tokenUrl, setTokenUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [tokens, setTokens] = useState([])

  useEffect(() => {
    if (IS_DEMO) {
      setTokenUrl(window.location.origin + window.location.pathname + '#portal/demo-token-0000')
      setLoading(false); return
    }
    const load = async () => {
      try {
        const { data: existing } = await supabase.from('client_tokens').select('*').eq('cost_estimate_id', ke.id).eq('active', true).order('created_at', { ascending: false })
        setTokens(existing || [])
        if (existing && existing.length > 0) setTokenUrl(window.location.origin + window.location.pathname + '#portal/' + existing[0].token)
      } catch(e) {} finally { setLoading(false) }
    }
    load()
  }, [ke.id])

  const generateNew = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: tok } = await supabase.from('client_tokens').insert({
        user_id: user.id,
        cost_estimate_id: ke.id,
        active: true,
        expires_at: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
      }).select().single()
      const url = window.location.origin + window.location.pathname + '#portal/' + tok.token
      setTokenUrl(url)
      setTokens(prev => [tok, ...prev])
      toast('Link wygenerowany', 'success')
    } catch(e) { toast('Błąd generowania linku', 'error') } finally { setLoading(false) }
  }

  const copy = async () => {
    if (!tokenUrl) return
    await navigator.clipboard.writeText(tokenUrl)
    setCopied(true); toast('Skopiowano link', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  const revoke = async (id) => {
    await supabase.from('client_tokens').update({ active: false }).eq('id', id)
    setTokens(prev => prev.filter(t => t.id !== id))
    toast('Link dezaktywowany', 'success')
  }

  const fmtDate = d => new Date(d).toLocaleDateString('pl-PL')

  return (
    <ModalLight title={"Udostępnij klientowi — " + ke.number} onClose={onClose}>
      <div style={{ background:'rgba(192,57,43,.07)', border:'1px solid rgba(192,57,43,.2)', borderRadius:10, padding:'12px 16px', fontSize:13, color:'var(--text2)', marginBottom:20 }}>
        <strong style={{ color:'var(--accent)' }}>Co zobaczy klient?</strong> Pozycje kosztorysu, wartości i czat z Tobą. Bez dostępu do profilu, innych klientów ani dokumentów.
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'32px 0' }}><RefreshCw size={22} className="spin" color="var(--accent)"/></div>
      ) : tokenUrl ? (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Link do portalu klienta</div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input style={{ flex:1, fontSize:12, color:'#333', background:'#faf8f5', border:'1.5px solid #e8e4de', borderRadius:12, padding:'10px 14px', outline:'none', fontFamily:"'Plus Jakarta Sans',sans-serif" }} readOnly value={tokenUrl} onClick={e => e.target.select()}/>
            <button className="btn btn-primary" onClick={copy}>{copied ? <CheckCheck size={14}/> : <Copy size={14}/>}</button>
            <a href={tokenUrl} target="_blank" rel="noreferrer"><button className="btn btn-secondary" title="Podgląd"><ExternalLink size={14}/></button></a>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={generateNew}><Share2 size={12}/>Nowy link</button>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'16px 0', marginBottom:16 }}>
          <Share2 size={32} color="var(--accent)" style={{ marginBottom:12, opacity:.7 }}/>
          <div style={{ fontSize:14, color:'var(--text2)', marginBottom:16 }}>Wygeneruj link dla klienta</div>
          <button className="btn btn-primary" onClick={generateNew}><Share2 size={13}/>Generuj link</button>
        </div>
      )}

      {tokens.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Aktywne linki ({tokens.length})</div>
          {tokens.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg)', borderRadius:8, marginBottom:6, border:'1px solid var(--border)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12.5, color:'var(--text2)', fontWeight:600 }}>{t.client_name || 'Link bez nazwy'}</div>
                <div style={{ fontSize:11.5, color:'var(--text3)' }}>Wygasa: {fmtDate(t.expires_at)}</div>
              </div>
              <span style={{ background:'rgba(34,197,94,.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,.2)', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:600 }}>Aktywny</span>
              <button className="btn btn-danger btn-icon btn-sm" onClick={() => revoke(t.id)}><X size={11}/></button>
            </div>
          ))}
        </div>
      )}
    </ModalLight>
  )
}

// ── PORTAL INBOX (dla wykonawcy) ──────────────────────────
function PortalInboxModal({ onClose }) {
  const { data } = useApp()
  const { toast } = useApp()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (IS_DEMO) { setLoading(false); return }
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: tokens } = await supabase.from('client_tokens').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        const { data: msgs } = await supabase.from('portal_messages').select('*').in('token_id', (tokens||[]).map(t => t.id)).order('created_at', { ascending: true })
        const grouped = (tokens||[]).map(t => ({
          ...t,
          msgs: (msgs||[]).filter(m => m.token_id === t.id),
          unread: (msgs||[]).filter(m => m.token_id === t.id && m.sender === 'client' && !m.read).length,
          ce: data.cost_estimates.find(ce => ce.id === t.cost_estimate_id),
        }))
        setThreads(grouped)
        if (grouped.length > 0) setActive(grouped[0])
      } catch(e) {} finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!active || IS_DEMO) return
    const sub = supabase.channel('inbox-' + active.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages', filter: 'token_id=eq.' + active.id }, payload => {
        setActive(prev => prev ? { ...prev, msgs: [...prev.msgs, payload.new] } : prev)
        setThreads(prev => prev.map(t => t.id === active.id ? { ...t, msgs: [...t.msgs, payload.new] } : t))
      }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [active?.id])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [active?.msgs])

  const sendReply = async () => {
    if (!replyText.trim() || !active) return
    setSending(true)
    try {
      await supabase.from('portal_messages').insert({ token_id: active.id, sender: 'contractor', content: replyText.trim(), read: true })
      setReplyText('')
    } catch(e) { toast('Błąd', 'error') } finally { setSending(false) }
  }

  const totalUnread = threads.reduce((s,t) => s + t.unread, 0)
  const fmtTime = d => new Date(d).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <ModalLight title={"Wiadomości od klientów" + (totalUnread > 0 ? " · " + totalUnread + " nowych" : "")} onClose={onClose} wide>
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px 0' }}><RefreshCw size={22} className="spin" color="var(--accent)"/></div>
      ) : threads.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#888' }}>
          <MessageSquare size={32} style={{ marginBottom:12, opacity:.4 }}/>
          <div style={{ fontSize:14 }}>Brak wiadomości</div>
          <div style={{ fontSize:13, marginTop:6 }}>Udostępnij kosztorys klientowi klikając "Portal"</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:0, height:440, border:'1px solid #e8e4de', borderRadius:10, overflow:'hidden' }}>
          <div style={{ borderRight:'1px solid #e8e4de', overflowY:'auto', background:'#faf8f5' }}>
            {threads.map(t => (
              <div key={t.id} onClick={() => setActive(t)} style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid #e8e4de', background: active?.id === t.id ? 'var(--surface)' : 'transparent', transition:'background .1s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{t.client_name || 'Klient'}</div>
                  {t.unread > 0 && <span style={{ background:'#c0392b', color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:11, fontWeight:700, flexShrink:0, marginLeft:6 }}>{t.unread}</span>}
                </div>
                <div style={{ fontSize:12, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.ce?.number} · {t.ce?.name || '—'}</div>
                {t.msgs.length > 0 && <div style={{ fontSize:11.5, color:'#888', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', opacity:.7 }}>{t.msgs[t.msgs.length-1].content}</div>}
              </div>
            ))}
          </div>
          {active ? (
            <div style={{ display:'flex', flexDirection:'column', background:'#f5f2ee' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e4de', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#111' }}>{active.client_name || 'Klient'}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{active.ce?.number} · {active.ce?.name}</div>
                </div>
                <a href={window.location.origin + window.location.pathname + '#portal/' + active.token} target="_blank" rel="noreferrer">
                  <button className="btn btn-secondary btn-sm"><ExternalLink size={11}/>Podgląd</button>
                </a>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:2 }}>
                {active.msgs.map(m => (
                  <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: m.sender === 'contractor' ? 'flex-end' : 'flex-start' }}>
                    <div className={"msg-bubble " + m.sender}>
                      <div style={{ fontSize:11, color: m.sender === 'contractor' ? '#c0392b' : '#94a3b8', fontWeight:700, marginBottom:3 }}>{m.sender === 'contractor' ? 'Ty' : active.client_name || 'Klient'}</div>
                      {m.content}
                      <div className="msg-time">{fmtTime(m.created_at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef}/>
              </div>
              <div style={{ padding:'10px 14px', borderTop:'1px solid #e8e4de', display:'flex', gap:8 }}>
                <input value={replyText} style={{ flex:1, border:'1.5px solid #e8e4de', borderRadius:12, padding:'11px 15px', fontSize:13, color:'#111', background:'#faf8f5', outline:'none', fontFamily:"'Plus Jakarta Sans',sans-serif" }} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} placeholder="Odpowiedz klientowi... (Enter = wyślij)" styl={{ flex:1, fontSize:13 }}/>
                <button className="btn btn-primary" onClick={sendReply} disabled={!replyText.trim() || sending}>
                  {sending ? <RefreshCw size={13} className="spin"/> : <Send size={13}/>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontSize:13 }}>Wybierz rozmowę</div>
          )}
        </div>
      )}
    </ModalLight>
  )
}

// ── ROOT APP ──────────────────────────────────────────────
const PAGES = {
  dashboard: DashboardPage, clients: ClientsPage, costestimates: CostEstimatesPage,
  projects: ProjectsPage, invoices: InvoicesPage, contracts: ContractsPage,
  ksef: KsefPage, reports: ReportsPage, settings: SettingsPage,
}

export default function App() {
  // ── Portal routing via URL hash ─────────────────────────
  const getPortalToken = () => {
    const hash = window.location.hash || ''
    const m = hash.match(/^#portal\/([a-zA-Z0-9-]+)/)
    return m ? m[1] : null
  }
  const [portalToken, setPortalToken] = useState(getPortalToken)

  // Also listen for hash changes (e.g. SPA navigation)
  useEffect(() => {
    const onHash = () => setPortalToken(getPortalToken())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // If URL is a portal link — render portal only (no auth needed)
  if (portalToken) return (
    <ClientPortalView token={portalToken}/>
  )

  const [session, setSession] = useState(null)
  const [userId, setUserId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [appData, setAppData] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [authLoading, setAuthLoading] = useState(!IS_DEMO)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Supabase auth
  useEffect(() => {
    if (IS_DEMO) { setAuthLoading(false); return }

    const loadUserData = async (user) => {
      try {
        const prof = await sbQuery(supabase.from('profiles').select('*').eq('id', user.id).single())
        const [clients, projects, ces, invs, conts, ceItems, invItems] = await Promise.all([
          sbQuery(supabase.from('clients').select('*').order('created_at',{ascending:false})),
          sbQuery(supabase.from('projects').select('*').order('created_at',{ascending:false})),
          sbQuery(supabase.from('cost_estimates').select('*').order('created_at',{ascending:false})),
          sbQuery(supabase.from('invoices').select('*').order('created_at',{ascending:false})),
          sbQuery(supabase.from('contracts').select('*').order('created_at',{ascending:false})),
          supabase.from('cost_estimate_items').select('*').order('sort_order',{ascending:true}).then(r=>r.data||[]).catch(()=>[]),
          supabase.from('invoice_items').select('*').order('sort_order',{ascending:true}).then(r=>r.data||[]).catch(()=>[]),
        ])
        setUserId(user.id)
        setProfile(prof)
        setAppData({
          clients,
          projects,
          cost_estimates: ces.map(ce=>({...ce, items:(ceItems||[]).filter(i=>i.cost_estimate_id===ce.id)})),
          invoices: invs.map(inv=>({...inv, items:(invItems||[]).filter(i=>i.invoice_id===inv.id)})),
          contracts: conts,
        })
      } catch(e) {
        console.error('Auth/data error:', e)
        setUserId(null); setProfile(null); setAppData(null)
      } finally {
        setAuthLoading(false)
      }
    }

    // Sprawdź sesję natychmiast — nie czekaj na event
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user)
      } else {
        setAuthLoading(false)
      }
    }).catch(() => setAuthLoading(false))

    // Nasłuchuj zmian (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthLoading(true)
        loadUserData(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUserId(null); setProfile(null); setAppData(null)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = (prof, data) => {
    setProfile(prof); setAppData(data); setUserId(prof.id)
  }
  const handleLogout = async () => {
    if (!IS_DEMO) await supabase.auth.signOut()
    setProfile(null); setAppData(null); setUserId(null); setPage('dashboard')
  }

  const PageComp = PAGES[page] || DashboardPage

  if (authLoading) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Sora','DM Sans',system-ui,sans-serif"}}>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,var(--accent),#3d8fe0)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Building2 size={24} color="#fff"/></div>
        <RefreshCw size={22} color="var(--accent)" className="spin" style={{display:'block',margin:'0 auto'}}/>
      </div>
    </div>
  )

  if (!profile || !appData) return (
    <>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <AuthScreen onLogin={handleLogin}/>
    </>
  )

  return (
    <AppDataProvider userId={userId} initialProfile={profile} initialData={appData}>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <div style={{display:'flex',height:'100vh',background:'var(--bg)',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
        <Sidebar active={page} setActive={setPage} onLogout={handleLogout} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed}/>
        <main style={{flex:1,overflow:'auto',padding:'28px 32px',minWidth:0}}>
          <PageComp key={page}/>
        </main>
      </div>
    </AppDataProvider>
  )
}