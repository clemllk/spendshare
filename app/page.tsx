"use client";

import { useState, useMemo } from "react";

// ─── Data ───────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "food", label: "Food & Dining", icon: "🍽", color: "#FF6B6B" },
  { id: "transport", label: "Transport", icon: "🚗", color: "#4ECDC4" },
  { id: "groceries", label: "Groceries", icon: "🛒", color: "#45B7D1" },
  { id: "shopping", label: "Shopping", icon: "🛍", color: "#F7DC6F" },
  { id: "bills", label: "Bills & Utilities", icon: "💡", color: "#F0A500" },
  { id: "health", label: "Health", icon: "❤️", color: "#FF6B9D" },
  { id: "entertainment", label: "Entertainment", icon: "🎬", color: "#C44DFF" },
  { id: "travel", label: "Travel", icon: "✈️", color: "#00D2FF" },
  { id: "education", label: "Education", icon: "📚", color: "#6C63FF" },
  { id: "other", label: "Other", icon: "📦", color: "#A8A8A8" },
];
const EMOJI_OPTIONS = ["🍽","🚗","🛒","🛍","💡","❤️","🎬","✈️","📚","📦","🎮","🐾","🏋️","☕","🍺","💊","🏠","🎁","💻","🎵","🌿","🧴","👶","🐶","🍕","🛠","📱","🎯","💰","🌙"];
const COLOR_OPTIONS = ["#FF6B6B","#4ECDC4","#45B7D1","#F7DC6F","#F0A500","#FF6B9D","#C44DFF","#00D2FF","#6C63FF","#FF8C42","#06D6A0","#FFD166","#EF476F","#118AB2","#7B2FBE","#06D6A0"];
const CURRENCIES = ["MYR","USD","EUR","SGD","GBP","JPY","AUD"];
const MEMBER_COLORS = ["#6C63FF","#FF6B9D","#4ECDC4","#F0A500","#FF6B6B","#00D2FF","#C44DFF","#06D6A0"];

function today(o: number=0){ const d=new Date(); d.setDate(d.getDate()+o); return d.toISOString().split("T")[0]; }
function fmt(n: number, c: string ="MYR"){ return new Intl.NumberFormat("en-MY",{style:"currency",currency:c,minimumFractionDigits:2}).format(n); }
function rel(ds: string){ const d=new Date(ds),now=new Date(),diff=Math.floor((now-d)/86400000); if(diff===0)return"Today"; if(diff===1)return"Yesterday"; return d.toLocaleDateString("en-MY",{day:"numeric",month:"short"}); }
function weekOf(ds: string){ const d=new Date(ds); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split("T")[0]; }
function genCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function initials(name: string){ return name.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function sleep(ms: number){ return new Promise(r=>setTimeout(r,ms)); }

const THEMES = {
  dark:  { bg:"#0F0F14", surface:"#1A1A24", card:"#1E1E2E", cardBorder:"#2D2D42", rowDiv:"#252535", text:"#F0F0FF", textSec:"#9090B0", textMuted:"#55557A", pill:"#252538", pillBorder:"#3A3A55", inputBg:"#252538", inputBorder:"#3A3A55", dateHBg:"#16161F", navBg:"#141420", navBorder:"#2D2D42", sTitle:"#6060A0", shadow:"0 4px 24px rgba(0,0,0,0.4)", cardShadow:"0 2px 12px rgba(0,0,0,0.3)" },
  light: { bg:"#F0F0FA", surface:"#FFFFFF", card:"#FFFFFF", cardBorder:"#E0E0F0", rowDiv:"#EBEBF8", text:"#111128", textSec:"#5555AA", textMuted:"#9999CC", pill:"#F0F0FF", pillBorder:"#CCCCEE", inputBg:"#F5F5FF", inputBorder:"#CCCCEE", dateHBg:"#F5F5FF", navBg:"#FFFFFF", navBorder:"#E0E0F0", sTitle:"#8888CC", shadow:"0 4px 24px rgba(100,100,200,0.12)", cardShadow:"0 2px 8px rgba(100,100,200,0.08)" },
};

const gradMain = "linear-gradient(135deg,#6C63FF 0%,#9B59B6 50%,#FF6B9D 100%)";

// ─── Shared in-memory "server" (simulates Supabase) ─────
const DB = {
  users: {},      // email → { id, name, email, password, color }
  rooms: {},      // code  → { id, code, name, createdBy, members:[userId], categories, transactions }
  sessions: {},   // userId → roomCode
};

function dbRegister(name, email, password) {
  if (DB.users[email]) return { error: "Email already registered" };
  const id = "u_" + Date.now();
  const color = MEMBER_COLORS[Object.keys(DB.users).length % MEMBER_COLORS.length];
  DB.users[email] = { id, name, email, password, color };
  return { user: DB.users[email] };
}
function dbLogin(email, password) {
  const u = DB.users[email];
  if (!u) return { error: "No account found for this email" };
  if (u.password !== password) return { error: "Incorrect password" };
  return { user: u };
}
function dbCreateRoom(roomName, userId) {
  const code = genCode();
  DB.rooms[code] = {
    id: "r_" + Date.now(), code, name: roomName,
    createdBy: userId, members: [userId],
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    transactions: [],
  };
  return DB.rooms[code];
}
function dbJoinRoom(code, userId) {
  const room = DB.rooms[code.toUpperCase()];
  if (!room) return { error: "Invalid share code — double-check and try again" };
  if (!room.members.includes(userId)) room.members.push(userId);
  return { room };
}
function dbGetRoom(code) { return DB.rooms[code] || null; }
function dbGetUser(id) { return Object.values(DB.users).find(u => u.id === id) || null; }

// ─── Screens ─────────────────────────────────────────────
const SCREEN = { SPLASH:"splash", WELCOME:"welcome", SIGNIN:"signin", SIGNUP:"signup", LOBBY:"lobby", APP:"app" };

export default function App() {
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState(SCREEN.SPLASH);
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  // Auth forms
  const [signupForm, setSignupForm] = useState({ name:"", email:"", password:"", confirm:"" });
  const [signinForm, setSigninForm] = useState({ email:"", password:"" });
  const [lobbyMode, setLobbyMode] = useState("choice"); // choice | create | join
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const T = dark ? THEMES.dark : THEMES.light;

  // Auto-advance splash
  useState(() => { setTimeout(() => setScreen(SCREEN.WELCOME), 1800); });

  async function handleSignup() {
    setErr("");
    if (!signupForm.name.trim()) return setErr("Please enter your name");
    if (!signupForm.email.includes("@")) return setErr("Enter a valid email");
    if (signupForm.password.length < 6) return setErr("Password must be at least 6 characters");
    if (signupForm.password !== signupForm.confirm) return setErr("Passwords don't match");
    setLoading(true);
    await sleep(600);
    const { user: u, error } = dbRegister(signupForm.name.trim(), signupForm.email.toLowerCase(), signupForm.password);
    setLoading(false);
    if (error) return setErr(error);
    setUser(u);
    setScreen(SCREEN.LOBBY);
  }

  async function handleSignin() {
    setErr("");
    if (!signinForm.email || !signinForm.password) return setErr("Fill in both fields");
    setLoading(true);
    await sleep(600);
    const { user: u, error } = dbLogin(signinForm.email.toLowerCase(), signinForm.password);
    setLoading(false);
    if (error) return setErr(error);
    setUser(u);
    setScreen(SCREEN.LOBBY);
  }

  async function handleCreateRoom() {
    if (!roomName.trim()) return setErr("Give your room a name");
    setLoading(true);
    await sleep(700);
    const r = dbCreateRoom(roomName.trim(), user.id);
    setRoom(r);
    setLoading(false);
    setScreen(SCREEN.APP);
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return setErr("Enter the share code");
    setLoading(true);
    await sleep(700);
    const { room: r, error } = dbJoinRoom(joinCode.trim(), user.id);
    setLoading(false);
    if (error) return setErr(error);
    setRoom(r);
    setScreen(SCREEN.APP);
  }

  function handleSignOut() {
    setUser(null); setRoom(null);
    setSigninForm({ email:"", password:"" });
    setSignupForm({ name:"", email:"", password:"", confirm:"" });
    setLobbyMode("choice"); setErr("");
    setScreen(SCREEN.WELCOME);
  }

  function copyCode() {
    if (room?.code) {
      navigator.clipboard?.writeText(room.code).catch(()=>{});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const inpStyle = { width:"100%", padding:"13px 16px", border:`1.5px solid ${T.inputBorder}`, borderRadius:12, fontSize:15, background:T.inputBg, color:T.text, boxSizing:"border-box", outline:"none" };
  const btnPrimary = { width:"100%", padding:"15px", background:gradMain, color:"#fff", border:"none", borderRadius:14, fontSize:16, fontWeight:800, cursor:"pointer" };
  const btnSecondary = { width:"100%", padding:"15px", background:"transparent", color:T.text, border:`1.5px solid ${T.cardBorder}`, borderRadius:14, fontSize:16, fontWeight:600, cursor:"pointer" };

  // ── SPLASH ──
  if (screen === SCREEN.SPLASH) return (
    <div style={{ minHeight:"100vh", background:"#0F0F14", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:80, height:80, borderRadius:24, background:gradMain, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40 }}>💸</div>
      <div style={{ fontSize:28, fontWeight:800, color:"#fff", letterSpacing:"-1px" }}>SpendShare</div>
      <div style={{ fontSize:14, color:"#9090B0" }}>Shared spending for couples & families</div>
      <div style={{ marginTop:24, display:"flex", gap:6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background: i===0?"#6C63FF":"#3A3A55", animation:"pulse 1.2s infinite" }}/>)}
      </div>
    </div>
  );

  // ── WELCOME ──
  if (screen === SCREEN.WELCOME) return (
    <div style={{ minHeight:"100vh", background: dark?"#0F0F14":"#F0F0FA", display:"flex", flexDirection:"column" }}>
      {/* Hero art */}
      <div style={{ background:gradMain, flex:"0 0 55%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, position:"relative" }}>
        <div style={{ width:88, height:88, borderRadius:26, background:"#ffffff20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:48, border:"1.5px solid #ffffff30", marginBottom:20 }}>💸</div>
        <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:"-1.5px", textAlign:"center" }}>SpendShare</div>
        <div style={{ fontSize:15, color:"#ffffffCC", marginTop:8, textAlign:"center", lineHeight:1.5 }}>Track spending together.<br/>No surprises, just clarity.</div>
        {/* floating mock cards */}
        <div style={{ position:"absolute", bottom:-18, left:24, background:"#ffffff15", backdropFilter:"blur(8px)", border:"1px solid #ffffff25", borderRadius:14, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>🍽</span>
          <div><div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>Dinner at Nook</div><div style={{ fontSize:10, color:"#ffffffAA" }}>You · MYR 68.00</div></div>
        </div>
        <div style={{ position:"absolute", bottom:-18, right:24, background:"#ffffff15", backdropFilter:"blur(8px)", border:"1px solid #ffffff25", borderRadius:14, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>🛒</span>
          <div><div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>Jaya Grocer</div><div style={{ fontSize:10, color:"#ffffffAA" }}>Partner · MYR 87.30</div></div>
        </div>
      </div>

      {/* Bottom */}
      <div style={{ flex:1, padding:"48px 28px 40px", display:"flex", flexDirection:"column", gap:14 }}>
        <button onClick={()=>{ setErr(""); setScreen(SCREEN.SIGNUP); }} style={btnPrimary}>Create account</button>
        <button onClick={()=>{ setErr(""); setScreen(SCREEN.SIGNIN); }} style={btnSecondary}>Sign in</button>
        <div style={{ display:"flex", justifyContent:"center", marginTop:4 }}>
          <button onClick={()=>setDark(d=>!d)} style={{ background:"none", border:"none", cursor:"pointer", color:T.textSec, fontSize:13 }}>{dark?"Switch to light mode ☀️":"Switch to dark mode 🌙"}</button>
        </div>
      </div>
    </div>
  );

  // ── SIGN UP ──
  if (screen === SCREEN.SIGNUP) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>
      <div style={{ background:gradMain, padding:"52px 24px 36px" }}>
        <button onClick={()=>setScreen(SCREEN.WELCOME)} style={{ background:"#ffffff20", border:"none", color:"#fff", borderRadius:10, padding:"7px 14px", fontSize:13, cursor:"pointer", marginBottom:20 }}>← Back</button>
        <div style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-1px" }}>Create account</div>
        <div style={{ fontSize:14, color:"#ffffffAA", marginTop:4 }}>Join SpendShare for free</div>
      </div>
      <div style={{ padding:"28px 24px", display:"flex", flexDirection:"column", gap:14 }}>
        {[
          { label:"Your name", key:"name", type:"text", placeholder:"e.g. Clement" },
          { label:"Email", key:"email", type:"email", placeholder:"you@email.com" },
          { label:"Password", key:"password", type:"password", placeholder:"Min. 6 characters" },
          { label:"Confirm password", key:"confirm", type:"password", placeholder:"Repeat password" },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize:12, color:T.textSec, marginBottom:6, fontWeight:600 }}>{f.label}</div>
            <input type={f.type} placeholder={f.placeholder} value={signupForm[f.key]}
              onChange={e=>setSignupForm(p=>({...p,[f.key]:e.target.value}))}
              style={inpStyle}/>
          </div>
        ))}
        {err && <div style={{ background:"#FF6B6B20", border:"1px solid #FF6B6B40", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>⚠️ {err}</div>}
        <button onClick={handleSignup} disabled={loading} style={{ ...btnPrimary, opacity:loading?0.7:1, marginTop:6 }}>
          {loading ? "Creating account…" : "Create account →"}
        </button>
        <div style={{ textAlign:"center", fontSize:13, color:T.textSec }}>
          Already have an account?{" "}
          <button onClick={()=>{ setErr(""); setScreen(SCREEN.SIGNIN); }} style={{ background:"none", border:"none", color:"#6C63FF", cursor:"pointer", fontWeight:700, fontSize:13 }}>Sign in</button>
        </div>
      </div>
    </div>
  );

  // ── SIGN IN ──
  if (screen === SCREEN.SIGNIN) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>
      <div style={{ background:gradMain, padding:"52px 24px 36px" }}>
        <button onClick={()=>setScreen(SCREEN.WELCOME)} style={{ background:"#ffffff20", border:"none", color:"#fff", borderRadius:10, padding:"7px 14px", fontSize:13, cursor:"pointer", marginBottom:20 }}>← Back</button>
        <div style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-1px" }}>Welcome back</div>
        <div style={{ fontSize:14, color:"#ffffffAA", marginTop:4 }}>Sign in to your account</div>
      </div>
      <div style={{ padding:"28px 24px", display:"flex", flexDirection:"column", gap:14 }}>
        {[
          { label:"Email", key:"email", type:"email", placeholder:"you@email.com" },
          { label:"Password", key:"password", type:"password", placeholder:"Your password" },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize:12, color:T.textSec, marginBottom:6, fontWeight:600 }}>{f.label}</div>
            <input type={f.type} placeholder={f.placeholder} value={signinForm[f.key]}
              onChange={e=>setSigninForm(p=>({...p,[f.key]:e.target.value}))}
              style={inpStyle}/>
          </div>
        ))}
        {err && <div style={{ background:"#FF6B6B20", border:"1px solid #FF6B6B40", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>⚠️ {err}</div>}
        <button onClick={handleSignin} disabled={loading} style={{ ...btnPrimary, opacity:loading?0.7:1, marginTop:6 }}>
          {loading ? "Signing in…" : "Sign in →"}
        </button>
        <div style={{ textAlign:"center", fontSize:13, color:T.textSec }}>
          No account yet?{" "}
          <button onClick={()=>{ setErr(""); setScreen(SCREEN.SIGNUP); }} style={{ background:"none", border:"none", color:"#6C63FF", cursor:"pointer", fontWeight:700, fontSize:13 }}>Create one</button>
        </div>
        {/* Demo hint */}
        <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontSize:12, color:T.textSec, fontWeight:600, marginBottom:4 }}>💡 Demo tip</div>
          <div style={{ fontSize:12, color:T.textSec, lineHeight:1.5 }}>Register two accounts in different tabs to test the invite/share code flow between them.</div>
        </div>
      </div>
    </div>
  );

  // ── LOBBY (create or join room) ──
  if (screen === SCREEN.LOBBY) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>
      <div style={{ background:gradMain, padding:"52px 24px 36px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:user?.color+"44", color:user?.color||"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, border:`1.5px solid ${user?.color||"#fff"}60` }}>{initials(user?.name||"?")}</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>Hey, {user?.name?.split(" ")[0]} 👋</div>
            <div style={{ fontSize:12, color:"#ffffffAA" }}>{user?.email}</div>
          </div>
        </div>
        <div style={{ fontSize:14, color:"#ffffffCC", lineHeight:1.6 }}>Start by creating a shared room or join one your partner already set up.</div>
      </div>

      <div style={{ padding:"28px 24px", flex:1, display:"flex", flexDirection:"column", gap:14 }}>
        {lobbyMode === "choice" && <>
          <button onClick={()=>{ setLobbyMode("create"); setErr(""); }} style={{ ...btnPrimary }}>
            ✦ Create a new room
          </button>
          <button onClick={()=>{ setLobbyMode("join"); setErr(""); }} style={{ ...btnSecondary }}>
            Enter a share code
          </button>
          <button onClick={handleSignOut} style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:13, marginTop:8 }}>Sign out</button>
        </>}

        {lobbyMode === "create" && <>
          <button onClick={()=>{ setLobbyMode("choice"); setErr(""); }} style={{ background:"none", border:"none", color:T.textSec, cursor:"pointer", fontSize:13, textAlign:"left", padding:0, marginBottom:4 }}>← Back</button>
          <div style={{ fontSize:22, fontWeight:800, color:T.text, marginBottom:4 }}>Name your room</div>
          <div style={{ fontSize:14, color:T.textSec, marginBottom:16 }}>This is what your household members will see.</div>
          <input type="text" placeholder='e.g. "Clement & Nurul" or "The Lim Family"'
            value={roomName} onChange={e=>setRoomName(e.target.value)}
            style={{ ...inpStyle, fontSize:16 }} autoFocus/>
          {err && <div style={{ background:"#FF6B6B20", border:"1px solid #FF6B6B40", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>⚠️ {err}</div>}
          <button onClick={handleCreateRoom} disabled={loading} style={{ ...btnPrimary, marginTop:8 }}>
            {loading ? "Creating room…" : "Create room →"}
          </button>
        </>}

        {lobbyMode === "join" && <>
          <button onClick={()=>{ setLobbyMode("choice"); setErr(""); }} style={{ background:"none", border:"none", color:T.textSec, cursor:"pointer", fontSize:13, textAlign:"left", padding:0, marginBottom:4 }}>← Back</button>
          <div style={{ fontSize:22, fontWeight:800, color:T.text, marginBottom:4 }}>Enter share code</div>
          <div style={{ fontSize:14, color:T.textSec, marginBottom:16 }}>Ask whoever created the room to share their 6-character code.</div>
          <input type="text" placeholder="e.g. XK72AP"
            value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
            style={{ ...inpStyle, fontSize:28, fontWeight:900, letterSpacing:"8px", textAlign:"center", textTransform:"uppercase" }}
            maxLength={6} autoFocus/>
          {err && <div style={{ background:"#FF6B6B20", border:"1px solid #FF6B6B40", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>⚠️ {err}</div>}
          <button onClick={handleJoinRoom} disabled={loading || joinCode.length < 6} style={{ ...btnPrimary, marginTop:8, opacity:(loading||joinCode.length<6)?0.5:1 }}>
            {loading ? "Joining…" : "Join room →"}
          </button>
        </>}
      </div>
    </div>
  );

  // ── APP (main tracker) ──
  if (screen === SCREEN.APP && room && user) {
    return <MainApp dark={dark} setDark={setDark} user={user} room={room} setRoom={setRoom} onSignOut={handleSignOut} onCopyCode={copyCode} copied={copied} T={T} DB={DB} />;
  }

  return null;
}

// ─── Main App ────────────────────────────────────────────
function MainApp({ dark, setDark, user, room, setRoom, onSignOut, onCopyCode, copied, T, DB }) {
  const [tab, setTab] = useState("dashboard");
  const [activeUser, setActiveUser] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [drillCat, setDrillCat] = useState(null);
  const [form, setForm] = useState({ amount:"", category:"food", note:"", date:today(0), currency:"MYR", userId:user.id });
  const [newCat, setNewCat] = useState({ label:"", icon:"🎯", color:"#6C63FF" });
  const syncTime = new Date().toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"});

  // Force re-render when room mutates
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t+1);

  const members = room.members.map(uid => dbGetUser(uid)).filter(Boolean);
  const cats = room.categories;

  const filtered = useMemo(()=>[...room.transactions].filter(t=>activeUser==="all"||t.userId===activeUser).sort((a,b)=>b.date.localeCompare(a.date)),[room.transactions,activeUser,tick]);
  const total = useMemo(()=>filtered.reduce((s,t)=>s+t.amount,0),[filtered]);
  const byCat = useMemo(()=>cats.map(c=>({...c,total:filtered.filter(t=>t.category===c.id).reduce((s,t)=>s+t.amount,0),count:filtered.filter(t=>t.category===c.id).length})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total),[filtered,cats]);
  const maxCat = byCat[0]?.total||1;
  const byUser = useMemo(()=>members.map(u=>({...u,total:room.transactions.filter(t=>t.userId===u.id).reduce((s,t)=>s+t.amount,0)})),[members,room.transactions,tick]);
  const grandTotal = room.transactions.reduce((s,t)=>s+t.amount,0);
  const weeks = useMemo(()=>{
    const map={};
    filtered.forEach(t=>{const w=weekOf(t.date);map[w]=(map[w]||0)+t.amount;});
    return Object.keys(map).sort().slice(-5).map(k=>({week:k,total:map[k]}));
  },[filtered]);
  const maxWeek = Math.max(...weeks.map(w=>w.total),1);
  const byDay = useMemo(()=>{
    const map={};
    filtered.forEach(t=>{map[t.date]=(map[t.date]||0)+t.amount;});
    return Object.entries(map).sort(([,a],[,b])=>b-a).slice(0,3).map(([d,v])=>({date:d,total:v}));
  },[filtered]);
  const grouped = useMemo(()=>{
    const g={};
    filtered.forEach(t=>{if(!g[t.date])g[t.date]=[];g[t.date].push(t);});
    return g;
  },[filtered]);

  function addTxn(){
    if(!form.amount||isNaN(parseFloat(form.amount)))return;
    room.transactions.unshift({...form,id:"t"+Date.now(),amount:parseFloat(form.amount)});
    setForm({amount:"",category:cats[0]?.id||"food",note:"",date:today(0),currency:"MYR",userId:user.id});
    setShowAdd(false); refresh();
  }
  function delTxn(id){ const i=room.transactions.findIndex(t=>t.id===id); if(i>-1){room.transactions.splice(i,1); refresh();} }
  function addCat(){
    if(!newCat.label.trim())return;
    room.categories.push({...newCat,id:"c"+Date.now()});
    setNewCat({label:"",icon:"🎯",color:"#6C63FF"}); setShowAddCat(false); refresh();
  }

  const inpStyle = { width:"100%", padding:"12px 14px", border:`1.5px solid ${T.inputBorder}`, borderRadius:12, fontSize:14, background:T.inputBg, color:T.text, boxSizing:"border-box" };

  function MemberAvatar({u,sz=32}){
    return <div style={{width:sz,height:sz,borderRadius:"50%",background:(u?.color||"#888")+"30",color:u?.color||"#888",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.33,fontWeight:700,flexShrink:0,border:`1.5px solid ${(u?.color||"#888")}60`}}>{initials(u?.name||"?")}</div>;
  }
  function CatIcon({catId,sz=40}){
    const c=cats.find(x=>x.id===catId)||{color:"#888",icon:"📦"};
    return <div style={{width:sz,height:sz,borderRadius:sz*0.28,background:c.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.46,flexShrink:0,border:`1px solid ${c.color}40`}}>{c.icon}</div>;
  }
  function Section({title,children,action}){
    return(
      <div style={{margin:"0 16px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.sTitle,letterSpacing:"1px",textTransform:"uppercase"}}>{title}</div>
          {action}
        </div>
        {children}
      </div>
    );
  }
  function Card({children,style={},onClick}){
    return <div onClick={onClick} style={{background:T.card,borderRadius:16,border:`1px solid ${T.cardBorder}`,overflow:"hidden",boxShadow:T.cardShadow,...style}}>{children}</div>;
  }
  function TxnRow({t,last}){
    const u=members.find(m=>m.id===t.userId)||{name:"Unknown",color:"#888"};
    return(
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:last?"none":`1px solid ${T.rowDiv}`}}>
        <CatIcon catId={t.category}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:500,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.note||(cats.find(c=>c.id===t.category)?.label)}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
            <MemberAvatar u={u} sz={14}/>
            <span style={{fontSize:11,color:T.textSec}}>{u.name} · {rel(t.date)}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text}}>{fmt(t.amount,t.currency)}</div>
          {t.userId===user.id&&<button onClick={()=>delTxn(t.id)} style={{fontSize:10,color:"#FF6B6B",background:"none",border:"none",cursor:"pointer",padding:0}}>delete</button>}
        </div>
      </div>
    );
  }

  const drillTxns = drillCat ? filtered.filter(t=>t.category===drillCat) : [];
  const drillInfo = drillCat ? cats.find(c=>c.id===drillCat) : null;

  // Drill-down view
  if(drillCat && drillInfo){
    const dt=drillTxns.reduce((s,t)=>s+t.amount,0);
    return(
      <div style={{fontFamily:"var(--font-sans)",maxWidth:430,margin:"0 auto",paddingBottom:40,minHeight:"100vh",background:T.bg}}>
        <div style={{background:gradMain,padding:"20px 20px 48px"}}>
          <button onClick={()=>setDrillCat(null)} style={{background:"#ffffff20",border:"none",color:"#fff",borderRadius:10,padding:"7px 14px",fontSize:13,cursor:"pointer",marginBottom:18,fontWeight:500}}>← Back</button>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:56,height:56,borderRadius:16,background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,border:"1px solid #ffffff30"}}>{drillInfo.icon}</div>
            <div><div style={{fontSize:22,fontWeight:700,color:"#fff"}}>{drillInfo.label}</div><div style={{fontSize:13,color:"#ffffff99"}}>{drillTxns.length} transactions</div></div>
          </div>
          <div style={{fontSize:38,fontWeight:700,color:"#fff",marginTop:14,letterSpacing:"-1px"}}>{fmt(dt)}</div>
        </div>
        <div style={{margin:"-24px 16px 0",borderRadius:16,overflow:"hidden",border:`1px solid ${T.cardBorder}`,background:T.card,boxShadow:T.shadow}}>
          {drillTxns.length===0&&<div style={{padding:40,textAlign:"center",color:T.textSec,fontSize:14}}>No transactions here yet</div>}
          {drillTxns.map((t,i)=><TxnRow key={t.id} t={t} last={i===drillTxns.length-1}/>)}
        </div>
      </div>
    );
  }

  return(
    <div style={{fontFamily:"var(--font-sans)",maxWidth:430,margin:"0 auto",paddingBottom:90,minHeight:"100vh",background:T.bg}}>

      {/* ── DASHBOARD ── */}
      {tab==="dashboard"&&<>
        <div style={{background:gradMain,padding:"24px 20px 64px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:"#fff",letterSpacing:"-0.5px"}}>{room.name}</div>
              <div style={{fontSize:11,color:"#ffffff70",marginTop:2}}>✓ Synced {syncTime}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={()=>setShowInvite(true)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:12,cursor:"pointer",color:"#fff",fontWeight:600}}>Invite</button>
              <button onClick={()=>setDark(d=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
            </div>
          </div>
          <div style={{fontSize:13,color:"#ffffffAA",marginBottom:4}}>Total spent this month</div>
          <div style={{fontSize:44,fontWeight:800,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{fmt(total)}</div>
          <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
            {byUser.map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:7,background:"#ffffff18",borderRadius:20,padding:"5px 12px",border:"1px solid #ffffff25"}}>
                <MemberAvatar u={u} sz={20}/>
                <span style={{fontSize:12,color:"#ffffffCC",fontWeight:500}}>{u.name} <strong style={{color:"#fff"}}>{fmt(u.total)}</strong></span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginTop:14,overflowX:"auto",paddingBottom:2}}>
            {[{id:"all",name:"Everyone"},...members].map(u=>(
              <button key={u.id} onClick={()=>setActiveUser(u.id)} style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${activeUser===u.id?"#fff":"#ffffff40"}`,background:activeUser===u.id?"#ffffff25":"#ffffff12",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:activeUser===u.id?700:400,whiteSpace:"nowrap",flexShrink:0}}>
                {u.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{margin:"-30px 16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,position:"relative",zIndex:10}}>
          {[
            {label:"Biggest day",val:byDay[0]?fmt(byDay[0].total):"—",sub:byDay[0]?rel(byDay[0].date):"no data",grad:"linear-gradient(135deg,#FF6B6B,#FF8E53)"},
            {label:"Transactions",val:filtered.length,sub:"this period",grad:"linear-gradient(135deg,#4ECDC4,#45B7D1)"},
          ].map((m,i)=>(
            <div key={i} style={{borderRadius:16,padding:"16px",background:m.grad,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
              <div style={{fontSize:10,color:"#ffffff99",marginBottom:6,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>{m.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{m.val}</div>
              <div style={{fontSize:11,color:"#ffffffBB",marginTop:3}}>{m.sub}</div>
            </div>
          ))}
        </div>

        {weeks.length>0&&(
          <Section title="Weekly trend">
            <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cardBorder}`,padding:"16px 16px 12px",boxShadow:T.cardShadow}}>
              <div style={{display:"flex",alignItems:"flex-end",gap:8,height:90,justifyContent:"space-between",borderBottom:`1px solid ${T.rowDiv}`,paddingBottom:10,marginBottom:10}}>
                {weeks.map((w,i)=>{
                  const h=Math.max(8,Math.round((w.total/maxWeek)*80));
                  const isLast=i===weeks.length-1;
                  return(
                    <div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                      <div style={{fontSize:10,fontWeight:isLast?700:400,color:isLast?"#6C63FF":T.textSec}}>{fmt(w.total).replace(/[^0-9.,]/g,"").replace(/\.00$/,"")}</div>
                      <div style={{width:"100%",height:h,borderRadius:"6px 6px 4px 4px",background:isLast?"linear-gradient(180deg,#6C63FF,#9B59B6)":T.surface,border:`1px solid ${isLast?"#6C63FF60":T.cardBorder}`,transition:"height 0.4s"}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                {weeks.map((w,i)=>{
                  const start=new Date(w.week); const end=new Date(w.week); end.setDate(end.getDate()+6);
                  const f2=d=>d.toLocaleDateString("en-MY",{day:"numeric",month:"short"});
                  const isLast=i===weeks.length-1;
                  return(
                    <div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                      <div style={{fontSize:9,color:isLast?"#6C63FF":T.textSec,fontWeight:isLast?700:400,textAlign:"center",lineHeight:1.3}}>{f2(start)}</div>
                      <div style={{fontSize:8,color:T.textMuted,textAlign:"center"}}>– {f2(end)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        )}

        {byDay.length>0&&(
          <Section title="Highest spending days">
            <Card>
              {byDay.map((d,i)=>(
                <div key={d.date} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:i<byDay.length-1?`1px solid ${T.rowDiv}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:["#FF6B6B25","#F0A50025","#4ECDC425"][i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,border:`1px solid ${["#FF6B6B40","#F0A50040","#4ECDC440"][i]}`}}>{["🔥","⚡","💸"][i]}</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:T.text}}>{rel(d.date)}</div>
                      <div style={{fontSize:11,color:T.textSec,marginTop:1}}>{room.transactions.filter(t=>t.date===d.date&&(activeUser==="all"||t.userId===activeUser)).length} transactions</div>
                    </div>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:["#FF6B6B","#F0A500","#4ECDC4"][i]}}>{fmt(d.total)}</div>
                </div>
              ))}
            </Card>
          </Section>
        )}

        <Section title="Spending by category">
          <Card>
            {byCat.map((c,i)=>(
              <div key={c.id} onClick={()=>setDrillCat(c.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<byCat.length-1?`1px solid ${T.rowDiv}`:"none",cursor:"pointer"}}>
                <div style={{width:42,height:42,borderRadius:12,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,border:`1px solid ${c.color}40`,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text}}>{c.label}</div>
                    <div style={{fontSize:14,fontWeight:800,color:c.color}}>{fmt(c.total)}</div>
                  </div>
                  <div style={{height:6,background:T.rowDiv,borderRadius:3}}>
                    <div style={{width:`${Math.min(100,(c.total/maxCat)*100)}%`,height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}88)`,borderRadius:3,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{fontSize:10,color:T.textSec,marginTop:4}}>{c.count} transaction{c.count!==1?"s":""} · {total>0?Math.round((c.total/total)*100):0}%</div>
                </div>
                <div style={{color:T.textMuted,fontSize:18}}>›</div>
              </div>
            ))}
            {byCat.length===0&&<div style={{padding:40,textAlign:"center",color:T.textSec,fontSize:14}}>No spending yet — add your first expense!</div>}
          </Card>
        </Section>

        <Section title="Recent transactions" action={<button onClick={()=>setTab("transactions")} style={{fontSize:12,color:"#6C63FF",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>See all →</button>}>
          <Card>
            {filtered.slice(0,4).map((t,i)=><TxnRow key={t.id} t={t} last={i===3||i===filtered.slice(0,4).length-1}/>)}
            {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.textSec,fontSize:14}}>No transactions yet</div>}
          </Card>
        </Section>
      </>}

      {/* ── TRANSACTIONS ── */}
      {tab==="transactions"&&<>
        <div style={{background:gradMain,padding:"24px 20px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Transactions</div>
            <button onClick={()=>setDark(d=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
          </div>
          <div style={{fontSize:13,color:"#ffffffAA"}}>{filtered.length} total · {fmt(total)}</div>
        </div>
        <div style={{margin:"14px 16px"}}>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:14}}>
            {cats.filter(c=>filtered.some(t=>t.category===c.id)).map(c=>(
              <button key={c.id} onClick={()=>setDrillCat(c.id)} style={{padding:"7px 12px",borderRadius:99,border:`1.5px solid ${c.color}50`,background:c.color+"18",color:c.color,fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <Card>
            {Object.entries(grouped).sort(([a],[b])=>b.localeCompare(a)).map(([date,dayTxns])=>(
              <div key={date}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:T.dateHBg,borderBottom:`1px solid ${T.rowDiv}`}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.textSec,textTransform:"uppercase",letterSpacing:"0.5px"}}>{rel(date)}</span>
                  <span style={{fontSize:13,fontWeight:800,color:T.text}}>{fmt(dayTxns.reduce((s,t)=>s+t.amount,0))}</span>
                </div>
                {dayTxns.map((t,i)=><TxnRow key={t.id} t={t} last={i===dayTxns.length-1}/>)}
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.textSec,fontSize:14}}>No transactions yet</div>}
          </Card>
        </div>
      </>}

      {/* ── ANALYSIS ── */}
      {tab==="analysis"&&<>
        <div style={{background:gradMain,padding:"24px 20px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Analysis</div><div style={{fontSize:13,color:"#ffffffAA",marginTop:2}}>Your spending insights</div></div>
            <button onClick={()=>setDark(d=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{margin:"14px 16px"}}>
          <Section title="Household split">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {byUser.map(u=>{
                const pct=grandTotal>0?Math.round((u.total/grandTotal)*100):0;
                return(
                  <div key={u.id} style={{borderRadius:16,padding:16,background:u.color+"18",border:`1px solid ${u.color}30`}}>
                    <MemberAvatar u={u} sz={36}/>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,marginTop:10}}>{u.name}</div>
                    <div style={{fontSize:22,fontWeight:800,color:u.color,marginTop:4}}>{fmt(u.total)}</div>
                    <div style={{fontSize:11,color:T.textSec,marginTop:2}}>{pct}% of total</div>
                    <div style={{height:5,background:T.rowDiv,borderRadius:3,marginTop:10}}>
                      <div style={{width:`${pct}%`,height:"100%",background:u.color,borderRadius:3}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Category breakdown">
            <Card>
              {byCat.slice(0,7).map((c,i)=>(
                <div key={c.id} onClick={()=>setDrillCat(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 16px",borderBottom:i<Math.min(byCat.length,7)-1?`1px solid ${T.rowDiv}`:"none",cursor:"pointer"}}>
                  <div style={{width:34,height:34,borderRadius:10,background:c.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,border:`1px solid ${c.color}35`,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                      <span style={{fontWeight:600,color:T.text}}>{c.label}</span>
                      <span style={{color:T.textSec,fontSize:12}}>{total>0?Math.round((c.total/total)*100):0}%</span>
                    </div>
                    <div style={{height:7,background:T.rowDiv,borderRadius:4}}>
                      <div style={{width:`${total>0?(c.total/total)*100:0}%`,height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}77)`,borderRadius:4}}/>
                    </div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color:c.color,minWidth:68,textAlign:"right"}}>{fmt(c.total)}</div>
                </div>
              ))}
              {byCat.length===0&&<div style={{padding:32,textAlign:"center",color:T.textSec,fontSize:13}}>No data yet</div>}
            </Card>
          </Section>
          <Section title="Averages">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {label:"Daily avg",val:fmt(total/Math.max(1,Object.keys(grouped).length)),color:"#6C63FF",grad:"linear-gradient(135deg,#6C63FF22,#9B59B622)"},
                {label:"Per transaction",val:fmt(filtered.length>0?total/filtered.length:0),color:"#FF6B9D",grad:"linear-gradient(135deg,#FF6B9D22,#C44DFF22)"},
              ].map((m,i)=>(
                <div key={i} style={{borderRadius:14,padding:"14px",background:m.grad,border:`1px solid ${m.color}30`}}>
                  <div style={{fontSize:10,color:T.textSec,marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>{m.label}</div>
                  <div style={{fontSize:18,fontWeight:800,color:m.color}}>{m.val}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </>}

      {/* ── CATEGORIES ── */}
      {tab==="categories"&&<>
        <div style={{background:gradMain,padding:"24px 20px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Categories</div><div style={{fontSize:13,color:"#ffffffAA",marginTop:2}}>{cats.length} categories</div></div>
            <button onClick={()=>setDark(d=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{margin:"14px 16px"}}>
          <Card>
            {cats.map((c,i)=>{
              const ct=filtered.filter(t=>t.category===c.id).reduce((s,t)=>s+t.amount,0);
              const cc=filtered.filter(t=>t.category===c.id).length;
              return(
                <div key={c.id} onClick={()=>setDrillCat(c.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<cats.length-1?`1px solid ${T.rowDiv}`:"none",cursor:"pointer"}}>
                  <div style={{width:46,height:46,borderRadius:14,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${c.color}40`,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:T.text}}>{c.label}</div>
                    <div style={{fontSize:11,color:T.textSec,marginTop:2}}>{cc} transaction{cc!==1?"s":""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:15,fontWeight:800,color:ct>0?c.color:T.textMuted}}>{ct>0?fmt(ct):"—"}</div>
                    <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>›</div>
                  </div>
                </div>
              );
            })}
          </Card>
          <button onClick={()=>setShowAddCat(true)} style={{marginTop:14,width:"100%",padding:"14px",background:gradMain,color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer"}}>
            + Add custom category
          </button>
        </div>
      </>}

      {/* ── PROFILE ── */}
      {tab==="profile"&&<>
        <div style={{background:gradMain,padding:"24px 20px 28px"}}>
          <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Profile</div>
        </div>
        <div style={{margin:"20px 16px",display:"flex",flexDirection:"column",gap:14}}>
          {/* User card */}
          <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cardBorder}`,padding:20,display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:user.color+"30",color:user.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,border:`2px solid ${user.color}60`}}>{initials(user.name)}</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:T.text}}>{user.name}</div>
              <div style={{fontSize:13,color:T.textSec,marginTop:2}}>{user.email}</div>
            </div>
          </div>
          {/* Room card */}
          <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cardBorder}`,padding:20}}>
            <div style={{fontSize:11,fontWeight:700,color:T.sTitle,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>Current room</div>
            <div style={{fontSize:18,fontWeight:800,color:T.text,marginBottom:4}}>{room.name}</div>
            <div style={{fontSize:13,color:T.textSec,marginBottom:16}}>{members.length} member{members.length!==1?"s":""}</div>
            <div style={{display:"flex",gap:-8,marginBottom:16}}>
              {members.map((m,i)=>(
                <div key={m.id} style={{marginLeft:i>0?-8:0,border:`2px solid ${T.card}`,borderRadius:"50%"}}>
                  <MemberAvatar u={m} sz={36}/>
                </div>
              ))}
            </div>
            {/* Share code box */}
            <div style={{background:T.surface,borderRadius:12,padding:"14px 16px",border:`1px dashed ${T.cardBorder}`}}>
              <div style={{fontSize:11,color:T.textSec,marginBottom:6,fontWeight:600}}>Share code — invite others to join</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{fontSize:30,fontWeight:900,color:"#6C63FF",letterSpacing:"6px"}}>{room.code}</div>
                <button onClick={onCopyCode} style={{padding:"8px 16px",background:copied?"#06D6A020":"#6C63FF18",border:`1px solid ${copied?"#06D6A050":"#6C63FF40"}`,borderRadius:10,color:copied?"#06D6A0":"#6C63FF",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.2s"}}>
                  {copied?"✓ Copied!":"Copy code"}
                </button>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cardBorder}`,overflow:"hidden"}}>
            {[
              {label:"Dark mode",action:()=>setDark(d=>!d),right:dark?"🌙 On":"☀️ Off"},
              {label:"Invite member",action:()=>setShowInvite(true),right:"→"},
            ].map((item,i)=>(
              <div key={i} onClick={item.action} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:i===0?`1px solid ${T.rowDiv}`:"none",cursor:"pointer"}}>
                <span style={{fontSize:15,color:T.text,fontWeight:500}}>{item.label}</span>
                <span style={{fontSize:14,color:T.textSec,fontWeight:600}}>{item.right}</span>
              </div>
            ))}
          </div>
          <button onClick={onSignOut} style={{padding:"15px",background:"#FF6B6B18",border:"1px solid #FF6B6B40",borderRadius:14,color:"#FF6B6B",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            Sign out
          </button>
        </div>
      </>}

      {/* FAB */}
      <button onClick={()=>setShowAdd(true)} style={{position:"fixed",bottom:72,right:"calc(50% - 207px)",background:gradMain,color:"#fff",border:"none",borderRadius:"50%",width:56,height:56,fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:101,boxShadow:"0 6px 24px #6C63FF66"}}>+</button>

      {/* Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.navBg,borderTop:`1px solid ${T.navBorder}`,display:"flex",zIndex:100}}>
        {[{id:"dashboard",icon:"⬛",label:"Home"},{id:"transactions",icon:"☰",label:"Spending"},{id:"analysis",icon:"📊",label:"Analysis"},{id:"categories",icon:"🏷",label:"Categories"},{id:"profile",icon:"👤",label:"Profile"}].map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,padding:"11px 0 9px",border:"none",background:"none",cursor:"pointer",fontSize:10,color:tab===n.id?"#6C63FF":T.textSec,fontWeight:tab===n.id?700:400,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:18}}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>

      {/* Invite sheet */}
      {showInvite&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&setShowInvite(false)}>
          <div style={{background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"0 24px 40px",border:`1px solid ${T.cardBorder}`}}>
            <div style={{width:40,height:4,background:T.pillBorder,borderRadius:2,margin:"14px auto 22px"}}/>
            <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:6}}>Invite to {room.name}</div>
            <div style={{fontSize:14,color:T.textSec,marginBottom:24,lineHeight:1.5}}>Share this code with your partner or family. They'll enter it on the join screen after signing up.</div>
            <div style={{background:T.surface,borderRadius:14,padding:"20px",border:`1px dashed ${T.cardBorder}`,textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:11,color:T.textSec,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px"}}>Room share code</div>
              <div style={{fontSize:44,fontWeight:900,color:"#6C63FF",letterSpacing:"10px"}}>{room.code}</div>
            </div>
            <button onClick={onCopyCode} style={{width:"100%",padding:"15px",background:copied?"#06D6A020":gradMain,border:copied?"1px solid #06D6A050":"none",borderRadius:14,color:copied?"#06D6A0":"#fff",fontSize:16,fontWeight:800,cursor:"pointer",transition:"all 0.2s"}}>
              {copied?"✓ Code copied to clipboard!":"Copy invite code"}
            </button>
            <div style={{marginTop:14,padding:"12px 16px",background:"#6C63FF12",borderRadius:12,border:"1px solid #6C63FF25"}}>
              <div style={{fontSize:12,color:T.textSec,lineHeight:1.6}}>
                💡 <strong style={{color:T.text}}>How it works:</strong> Your partner signs up → taps "Enter a share code" → types <strong style={{color:"#6C63FF"}}>{room.code}</strong> → they're in. All transactions sync instantly.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add txn sheet */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"0 20px 36px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${T.cardBorder}`}}>
            <div style={{width:40,height:4,background:T.pillBorder,borderRadius:2,margin:"14px auto 22px"}}/>
            <div style={{fontSize:20,fontWeight:800,marginBottom:20,color:T.text}}>Add expense</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:6,fontWeight:600}}>Amount</div>
              <div style={{display:"flex",gap:8}}>
                <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{...inpStyle,width:90,flex:"0 0 90px"}}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select>
                <input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{...inpStyle,flex:1,fontSize:20,fontWeight:700}} autoFocus/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:6,fontWeight:600}}>Note</div>
              <input type="text" placeholder="What was this for?" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={inpStyle}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:8,fontWeight:600}}>Category</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cats.map(c=>(
                  <button key={c.id} onClick={()=>setForm(f=>({...f,category:c.id}))} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${form.category===c.id?c.color:T.pillBorder}`,background:form.category===c.id?c.color+"22":T.pill,color:form.category===c.id?c.color:T.textSec,fontSize:12,cursor:"pointer",fontWeight:form.category===c.id?700:400}}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:T.textSec,marginBottom:6,fontWeight:600}}>Date</div>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inpStyle}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:T.textSec,marginBottom:6,fontWeight:600}}>Added by</div>
                <select value={form.userId} onChange={e=>setForm(f=>({...f,userId:e.target.value}))} style={inpStyle}>
                  {members.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addTxn} style={{width:"100%",padding:"15px",background:gradMain,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer",marginTop:14}}>Add expense</button>
          </div>
        </div>
      )}

      {/* Add category sheet */}
      {showAddCat&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&setShowAddCat(false)}>
          <div style={{background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"0 20px 36px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${T.cardBorder}`}}>
            <div style={{width:40,height:4,background:T.pillBorder,borderRadius:2,margin:"14px auto 22px"}}/>
            <div style={{fontSize:20,fontWeight:800,marginBottom:20,color:T.text}}>New category</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:6,fontWeight:600}}>Name</div>
              <input type="text" placeholder="e.g. Pet care" value={newCat.label} onChange={e=>setNewCat(n=>({...n,label:e.target.value}))} style={inpStyle} autoFocus/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:8,fontWeight:600}}>Icon</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {EMOJI_OPTIONS.map(em=>(
                  <button key={em} onClick={()=>setNewCat(n=>({...n,icon:em}))} style={{width:42,height:42,borderRadius:11,border:`2px solid ${newCat.icon===em?"#6C63FF":T.pillBorder}`,background:newCat.icon===em?"#6C63FF22":T.pill,fontSize:20,cursor:"pointer"}}>{em}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:T.textSec,marginBottom:8,fontWeight:600}}>Color</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {COLOR_OPTIONS.map(col=>(
                  <button key={col} onClick={()=>setNewCat(n=>({...n,color:col}))} style={{width:34,height:34,borderRadius:"50%",background:col,border:newCat.color===col?`3px solid ${T.text}`:"3px solid transparent",cursor:"pointer"}}/>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:14,background:newCat.color+"15",borderRadius:14,marginBottom:8,border:`1px solid ${newCat.color}40`}}>
              <div style={{width:48,height:48,borderRadius:14,background:newCat.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,border:`1px solid ${newCat.color}50`}}>{newCat.icon}</div>
              <div style={{fontSize:16,fontWeight:700,color:newCat.color}}>{newCat.label||"Preview"}</div>
            </div>
            <button onClick={addCat} style={{width:"100%",padding:"15px",background:gradMain,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer"}}>Create category</button>
          </div>
        </div>
      )}
    </div>
  );
}
