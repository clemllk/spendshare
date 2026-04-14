/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { deriveRoomKey, encrypt, decrypt } from "../lib/crypto";

// ─── Supabase client ────────────────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Constants ──────────────────────────────────────────────
const DEFAULT_CATS = [
  { label: "Food & Dining",    icon: "🍽", color: "#FF6B6B" },
  { label: "Transport",        icon: "🚗", color: "#4ECDC4" },
  { label: "Groceries",        icon: "🛒", color: "#45B7D1" },
  { label: "Shopping",         icon: "🛍", color: "#F7DC6F" },
  { label: "Bills & Utilities",icon: "💡", color: "#F0A500" },
  { label: "Health",           icon: "❤️", color: "#FF6B9D" },
  { label: "Entertainment",    icon: "🎬", color: "#C44DFF" },
  { label: "Travel",           icon: "✈️", color: "#00D2FF" },
  { label: "Education",        icon: "📚", color: "#6C63FF" },
  { label: "Other",            icon: "📦", color: "#A8A8A8" },
];
const EMOJIS   = ["🍽","🚗","🛒","🛍","💡","❤️","🎬","✈️","📚","📦","🎮","🐾","🏋️","☕","🍺","💊","🏠","🎁","💻","🎵","🌿","🧴","👶","🐶","🍕","🛠","📱","🎯","💰","🌙"];
const COLORS   = ["#FF6B6B","#4ECDC4","#45B7D1","#F7DC6F","#F0A500","#FF6B9D","#C44DFF","#00D2FF","#6C63FF","#FF8C42","#06D6A0","#FFD166","#EF476F","#118AB2","#7B2FBE","#06D6A0"];
const MCOLORS  = ["#6C63FF","#FF6B9D","#4ECDC4","#F0A500","#FF6B6B","#00D2FF","#C44DFF","#06D6A0"];
const CURRS    = ["MYR","USD","EUR","SGD","GBP","JPY","AUD"];
const G        = "linear-gradient(135deg,#6C63FF 0%,#9B59B6 50%,#FF6B9D 100%)";

const TH = {
  dark:  { bg:"#0F0F14",surface:"#1A1A24",card:"#1E1E2E",cb:"#2D2D42",rd:"#252535",tx:"#F0F0FF",ts:"#9090B0",tm:"#55557A",pl:"#252538",pb:"#3A3A55",ib:"#252538",ibr:"#3A3A55",dh:"#16161F",nb:"#141420",nbr:"#2D2D42",st:"#6060A0",sh:"0 4px 24px rgba(0,0,0,0.4)",cs:"0 2px 12px rgba(0,0,0,0.3)" },
  light: { bg:"#F0F0FA",surface:"#FFFFFF",card:"#FFFFFF",cb:"#E0E0F0",rd:"#EBEBF8",tx:"#111128",ts:"#5555AA",tm:"#9999CC",pl:"#F0F0FF",pb:"#CCCCEE",ib:"#F5F5FF",ibr:"#CCCCEE",dh:"#F5F5FF",nb:"#FFFFFF",nbr:"#E0E0F0",st:"#8888CC",sh:"0 4px 24px rgba(100,100,200,0.12)",cs:"0 2px 8px rgba(100,100,200,0.08)" },
};

// ─── Helpers ────────────────────────────────────────────────
function tod(o=0):string { const d=new Date(); d.setDate(d.getDate()+o); return d.toISOString().split("T")[0]; }
function fmtCur(n:number,c="MYR"):string { return new Intl.NumberFormat("en-MY",{style:"currency",currency:c,minimumFractionDigits:2}).format(n); }
function relDate(ds:string):string { const d=new Date(ds),now=new Date(),diff=Math.floor((now.getTime()-d.getTime())/86400000); if(diff===0)return"Today"; if(diff===1)return"Yesterday"; return d.toLocaleDateString("en-MY",{day:"numeric",month:"short"}); }
function wkOf(ds:string):string { const d=new Date(ds); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split("T")[0]; }
function mkCode():string { return Math.random().toString(36).slice(2,8).toUpperCase(); }
function inits(n:string):string { return n.trim().split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase(); }
function pause(ms:number):Promise<void> { return new Promise(r=>setTimeout(r,ms)); }

// ─── Screens ────────────────────────────────────────────────
const S = { SPLASH:"splash",WELCOME:"welcome",SIGNIN:"signin",SIGNUP:"signup",LOBBY:"lobby",APP:"app" };

// ════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════
export default function Root() {
  const [dark,setDark]   = useState(true);
  const [scr,setScr]     = useState(S.SPLASH);
  const [user,setUser]   = useState<any>(null);
  const [room,setRoom]   = useState<any>(null);
  const [busy,setBusy]   = useState(false);
  const [err,setErr]     = useState("");
  const [copied,setCopied] = useState(false);
  const [sf,setSf]       = useState({name:"",email:"",password:"",confirm:""});
  const [lf,setLf]       = useState({email:"",password:""});
  const [mode,setMode]   = useState("choice");
  const [rname,setRname] = useState("");
  const [jcode,setJcode] = useState("");
  const keyRef           = useRef<CryptoKey|null>(null);
  const T = dark ? TH.dark : TH.light;

  useEffect(()=>{ setTimeout(()=>setScr(S.WELCOME),1800); },[]);

  // ── auth ──
  async function doSignup() {
    setErr("");
    if(!sf.name.trim())        return setErr("Please enter your name");
    if(!sf.email.includes("@"))return setErr("Enter a valid email");
    if(sf.password.length<6)   return setErr("Password must be at least 6 characters");
    if(sf.password!==sf.confirm)return setErr("Passwords don't match");
    setBusy(true);
    const {data,error} = await sb.auth.signUp({email:sf.email.toLowerCase(),password:sf.password,options:{data:{display_name:sf.name.trim()}}});
    setBusy(false);
    if(error) return setErr(error.message);
    setUser({id:data.user!.id,name:sf.name.trim(),email:sf.email.toLowerCase(),color:MCOLORS[0]});
    setScr(S.LOBBY);
  }

  async function doSignin() {
    setErr("");
    if(!lf.email||!lf.password) return setErr("Fill in both fields");
    setBusy(true);
    const {data,error} = await sb.auth.signInWithPassword({email:lf.email.toLowerCase(),password:lf.password});
    setBusy(false);
    if(error) return setErr(error.message);
    const u = data.user!;
    setUser({id:u.id,name:u.user_metadata?.display_name||u.email,email:u.email,color:MCOLORS[0]});
    setScr(S.LOBBY);
  }

  // ── room ──
  async function doCreate() {
    if(!rname.trim()) return setErr("Give your room a name");
    setBusy(true);
    const code = mkCode();
    const {data:rm,error:re} = await sb.from("rooms").insert({name:rname.trim(),share_code:code,created_by:user.id}).select().single();
    if(re){ setBusy(false); return setErr(re.message); }
    await sb.from("room_members").insert({room_id:rm.id,user_id:user.id,display_name:user.name,color:MCOLORS[0]});
    // seed default categories
    await sb.from("categories").insert(DEFAULT_CATS.map(c=>({...c,room_id:rm.id,created_by:user.id})));
    // derive encryption key from share code
    keyRef.current = await deriveRoomKey(code);
    const cats = await sb.from("categories").select("*").eq("room_id",rm.id);
    setRoom({...rm,members:[{...user}],categories:cats.data||[],transactions:[]});
    setBusy(false);
    setScr(S.APP);
  }

  async function doJoin() {
    if(!jcode.trim()) return setErr("Enter the share code");
    setBusy(true);
    const {data:roomId,error:je} = await sb.rpc("join_room_by_code",{p_code:jcode.trim(),p_display_name:user.name,p_color:MCOLORS[1]});
    if(je){ setBusy(false); return setErr(je.message); }
    keyRef.current = await deriveRoomKey(jcode.trim().toUpperCase());
    await loadRoom(roomId);
    setBusy(false);
    setScr(S.APP);
  }

  async function loadRoom(rid:string) {
    const [rm,mems,cats,txnsRaw] = await Promise.all([
      sb.from("rooms").select("*").eq("id",rid).single(),
      sb.from("room_members").select("*").eq("room_id",rid),
      sb.from("categories").select("*").eq("room_id",rid),
      sb.from("transactions").select("*").eq("room_id",rid).order("date_bucket",{ascending:false}).limit(200),
    ]);
    // decrypt transactions
    const txns = await Promise.all((txnsRaw.data||[]).map(async(t:any)=>{
      try {
        const plain = await decrypt<any>(t.payload,t.iv,keyRef.current!);
        return {...plain,id:t.id,userId:t.user_id,categoryId:t.category_id,decrypted:true};
      } catch { return {id:t.id,userId:t.user_id,categoryId:t.category_id,decrypted:false}; }
    }));
    setRoom({...rm.data,members:mems.data||[],categories:cats.data||[],transactions:txns});
  }

  function doSignOut() {
    sb.auth.signOut();
    setUser(null); setRoom(null); keyRef.current=null;
    setLf({email:"",password:""}); setSf({name:"",email:"",password:"",confirm:""});
    setMode("choice"); setErr(""); setScr(S.WELCOME);
  }

  function copyCode() {
    if(room?.share_code){ navigator.clipboard?.writeText(room.share_code).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  }

  const inp:any = {width:"100%",padding:"13px 16px",border:`1.5px solid ${T.ibr}`,borderRadius:12,fontSize:15,background:T.ib,color:T.tx,boxSizing:"border-box",outline:"none"};
  const btnP:any = {width:"100%",padding:"15px",background:G,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer"};
  const btnS:any = {width:"100%",padding:"15px",background:"transparent",color:T.tx,border:`1.5px solid ${T.cb}`,borderRadius:14,fontSize:16,fontWeight:600,cursor:"pointer"};
  const Err = ()=> err ? <div style={{background:"#FF6B6B20",border:"1px solid #FF6B6B40",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#FF6B6B"}}>⚠️ {err}</div> : null;

  // ── SPLASH ──
  if(scr===S.SPLASH) return (
    <div style={{minHeight:"100vh",background:"#0F0F14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:80,height:80,borderRadius:24,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>💸</div>
      <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>SpendShare</div>
      <div style={{fontSize:14,color:"#9090B0"}}>Shared spending for couples &amp; families</div>
    </div>
  );

  // ── WELCOME ──
  if(scr===S.WELCOME) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{background:G,flex:"0 0 55%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,position:"relative"}}>
        <div style={{width:88,height:88,borderRadius:26,background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,border:"1.5px solid #ffffff30",marginBottom:20}}>💸</div>
        <div style={{fontSize:32,fontWeight:900,color:"#fff",textAlign:"center"}}>SpendShare</div>
        <div style={{fontSize:15,color:"#ffffffCC",marginTop:8,textAlign:"center",lineHeight:1.5}}>Track spending together.<br/>No surprises, just clarity.</div>
        <div style={{position:"absolute",bottom:-18,left:24,background:"#ffffff15",border:"1px solid #ffffff25",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🍽</span><div><div style={{fontSize:12,color:"#fff",fontWeight:600}}>Dinner at Nook</div><div style={{fontSize:10,color:"#ffffffAA"}}>You · MYR 68.00</div></div>
        </div>
        <div style={{position:"absolute",bottom:-18,right:24,background:"#ffffff15",border:"1px solid #ffffff25",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🛒</span><div><div style={{fontSize:12,color:"#fff",fontWeight:600}}>Jaya Grocer</div><div style={{fontSize:10,color:"#ffffffAA"}}>Partner · MYR 87.30</div></div>
        </div>
      </div>
      <div style={{flex:1,padding:"48px 28px 40px",display:"flex",flexDirection:"column",gap:14}}>
        <button onClick={()=>{setErr("");setScr(S.SIGNUP);}} style={btnP}>Create account</button>
        <button onClick={()=>{setErr("");setScr(S.SIGNIN);}} style={btnS}>Sign in</button>
        <div style={{display:"flex",justifyContent:"center",marginTop:4}}>
          <button onClick={()=>setDark(d=>!d)} style={{background:"none",border:"none",cursor:"pointer",color:T.ts,fontSize:13}}>{dark?"Switch to light mode ☀️":"Switch to dark mode 🌙"}</button>
        </div>
      </div>
    </div>
  );

  // ── SIGN UP ──
  if(scr===S.SIGNUP) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{background:G,padding:"52px 24px 36px"}}>
        <button onClick={()=>setScr(S.WELCOME)} style={{background:"#ffffff20",border:"none",color:"#fff",borderRadius:10,padding:"7px 14px",fontSize:13,cursor:"pointer",marginBottom:20}}>← Back</button>
        <div style={{fontSize:28,fontWeight:900,color:"#fff"}}>Create account</div>
        <div style={{fontSize:14,color:"#ffffffAA",marginTop:4}}>Join SpendShare for free</div>
      </div>
      <div style={{padding:"28px 24px",display:"flex",flexDirection:"column",gap:14}}>
        {[{label:"Your name",key:"name",type:"text",ph:"e.g. Clement"},{label:"Email",key:"email",type:"email",ph:"you@email.com"},{label:"Password",key:"password",type:"password",ph:"Min. 6 characters"},{label:"Confirm password",key:"confirm",type:"password",ph:"Repeat password"}].map(f=>(
          <div key={f.key}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>{f.label}</div>
          <input type={f.type} placeholder={f.ph} value={(sf as any)[f.key]} onChange={e=>setSf(p=>({...p,[f.key]:e.target.value}))} style={inp}/></div>
        ))}
        <Err/>
        <button onClick={doSignup} disabled={busy} style={{...btnP,opacity:busy?0.7:1}}>{busy?"Creating account…":"Create account →"}</button>
        <div style={{textAlign:"center",fontSize:13,color:T.ts}}>Already have an account?{" "}<button onClick={()=>{setErr("");setScr(S.SIGNIN);}} style={{background:"none",border:"none",color:"#6C63FF",cursor:"pointer",fontWeight:700,fontSize:13}}>Sign in</button></div>
      </div>
    </div>
  );

  // ── SIGN IN ──
  if(scr===S.SIGNIN) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{background:G,padding:"52px 24px 36px"}}>
        <button onClick={()=>setScr(S.WELCOME)} style={{background:"#ffffff20",border:"none",color:"#fff",borderRadius:10,padding:"7px 14px",fontSize:13,cursor:"pointer",marginBottom:20}}>← Back</button>
        <div style={{fontSize:28,fontWeight:900,color:"#fff"}}>Welcome back</div>
        <div style={{fontSize:14,color:"#ffffffAA",marginTop:4}}>Sign in to your account</div>
      </div>
      <div style={{padding:"28px 24px",display:"flex",flexDirection:"column",gap:14}}>
        {[{label:"Email",key:"email",type:"email",ph:"you@email.com"},{label:"Password",key:"password",type:"password",ph:"Your password"}].map(f=>(
          <div key={f.key}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>{f.label}</div>
          <input type={f.type} placeholder={f.ph} value={(lf as any)[f.key]} onChange={e=>setLf(p=>({...p,[f.key]:e.target.value}))} style={inp}/></div>
        ))}
        <Err/>
        <button onClick={doSignin} disabled={busy} style={{...btnP,opacity:busy?0.7:1}}>{busy?"Signing in…":"Sign in →"}</button>
        <div style={{textAlign:"center",fontSize:13,color:T.ts}}>No account yet?{" "}<button onClick={()=>{setErr("");setScr(S.SIGNUP);}} style={{background:"none",border:"none",color:"#6C63FF",cursor:"pointer",fontWeight:700,fontSize:13}}>Create one</button></div>
      </div>
    </div>
  );

  // ── LOBBY ──
  if(scr===S.LOBBY) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{background:G,padding:"52px 24px 36px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"#ffffff30",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800}}>{inits(user?.name||"?")}</div>
          <div><div style={{fontSize:18,fontWeight:800,color:"#fff"}}>Hey, {user?.name?.split(" ")[0]} 👋</div><div style={{fontSize:12,color:"#ffffffAA"}}>{user?.email}</div></div>
        </div>
        <div style={{fontSize:14,color:"#ffffffCC",lineHeight:1.6}}>Start by creating a shared room or join one your partner already set up.</div>
      </div>
      <div style={{padding:"28px 24px",flex:1,display:"flex",flexDirection:"column",gap:14}}>
        {mode==="choice"&&<>
          <button onClick={()=>{setMode("create");setErr("");}} style={btnP}>✦ Create a new room</button>
          <button onClick={()=>{setMode("join");setErr("");}} style={btnS}>Enter a share code</button>
          <button onClick={doSignOut} style={{background:"none",border:"none",color:T.tm,cursor:"pointer",fontSize:13,marginTop:8}}>Sign out</button>
        </>}
        {mode==="create"&&<>
          <button onClick={()=>{setMode("choice");setErr("");}} style={{background:"none",border:"none",color:T.ts,cursor:"pointer",fontSize:13,textAlign:"left",padding:0}}>← Back</button>
          <div style={{fontSize:22,fontWeight:800,color:T.tx}}>Name your room</div>
          <input type="text" placeholder='e.g. "Clement & Nurul"' value={rname} onChange={e=>setRname(e.target.value)} style={{...inp,fontSize:16}} autoFocus/>
          <Err/>
          <button onClick={doCreate} disabled={busy} style={{...btnP,opacity:busy?0.7:1}}>{busy?"Creating room…":"Create room →"}</button>
        </>}
        {mode==="join"&&<>
          <button onClick={()=>{setMode("choice");setErr("");}} style={{background:"none",border:"none",color:T.ts,cursor:"pointer",fontSize:13,textAlign:"left",padding:0}}>← Back</button>
          <div style={{fontSize:22,fontWeight:800,color:T.tx}}>Enter share code</div>
          <input type="text" placeholder="e.g. XK72AP" value={jcode} onChange={e=>setJcode(e.target.value.toUpperCase())} style={{...inp,fontSize:28,fontWeight:900,letterSpacing:"8px",textAlign:"center"}} maxLength={6} autoFocus/>
          <Err/>
          <button onClick={doJoin} disabled={busy||jcode.length<6} style={{...btnP,opacity:(busy||jcode.length<6)?0.5:1}}>{busy?"Joining…":"Join room →"}</button>
        </>}
      </div>
    </div>
  );

  if(scr===S.APP&&room&&user) return <App dark={dark} setDark={setDark} user={user} room={room} setRoom={setRoom} cryptoKey={keyRef.current} onSignOut={doSignOut} onCopyCode={copyCode} copied={copied} T={T}/>;
  return null;
}

// ════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════
function App({dark,setDark,user,room,setRoom,cryptoKey,onSignOut,onCopyCode,copied,T}:any) {
  const [tab,setTab]           = useState("dashboard");
  const [who,setWho]           = useState("all");
  const [showAdd,setShowAdd]   = useState(false);
  const [showCat,setShowCat]   = useState(false);
  const [showInv,setShowInv]   = useState(false);
  const [drill,setDrill]       = useState<string|null>(null);
  const [busy,setBusy]         = useState(false);
  const [form,setForm]         = useState({amount:"",catId:"",note:"",date:tod(0),currency:"MYR"});
  const [nc,setNc]             = useState({label:"",icon:"🎯",color:"#6C63FF"});
  const sync = new Date().toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"});

  const cats  = room.categories || [];
  const mems  = room.members    || [];
  const txns  = room.transactions || [];

  // initialise default category in form
  useEffect(()=>{ if(cats.length&&!form.catId) setForm(f=>({...f,catId:cats[0].id})); },[cats]);

  // realtime subscription
  useEffect(()=>{
    const ch = sb.channel(`room:${room.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"transactions",filter:`room_id=eq.${room.id}`},async(p:any)=>{
        if(!cryptoKey) return;
        try {
          const plain = await decrypt<any>(p.new.payload,p.new.iv,cryptoKey);
          const t = {...plain,id:p.new.id,userId:p.new.user_id,categoryId:p.new.category_id,decrypted:true};
          setRoom((r:any)=>({...r,transactions:[t,...r.transactions]}));
        } catch {}
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"transactions",filter:`room_id=eq.${room.id}`},(p:any)=>{
        setRoom((r:any)=>({...r,transactions:r.transactions.filter((t:any)=>t.id!==p.old.id)}));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"categories",filter:`room_id=eq.${room.id}`},(p:any)=>{
        setRoom((r:any)=>({...r,categories:[...r.categories,p.new]}));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"room_members",filter:`room_id=eq.${room.id}`},(p:any)=>{
        setRoom((r:any)=>({...r,members:[...r.members,{id:p.new.user_id,name:p.new.display_name,color:p.new.color}]}));
      })
      .subscribe();
    return ()=>{ sb.removeChannel(ch); };
  },[room.id,cryptoKey]);

  async function addTxn() {
    if(!form.amount||isNaN(parseFloat(form.amount))) return;
    if(!cryptoKey) return;
    setBusy(true);
    const payload = {amount:parseFloat(form.amount),currency:form.currency,note:form.note,date:form.date};
    const {payload:enc,iv} = await encrypt(payload,cryptoKey);
    await sb.from("transactions").insert({room_id:room.id,user_id:user.id,category_id:form.catId||cats[0]?.id,payload:enc,iv,date_bucket:form.date});
    setForm(f=>({...f,amount:"",note:""}));
    setShowAdd(false);
    setBusy(false);
  }

  async function delTxn(id:string) {
    await sb.from("transactions").delete().eq("id",id).eq("user_id",user.id);
  }

  async function addCat() {
    if(!nc.label.trim()) return;
    await sb.from("categories").insert({room_id:room.id,label:nc.label,icon:nc.icon,color:nc.color,created_by:user.id});
    setNc({label:"",icon:"🎯",color:"#6C63FF"});
    setShowCat(false);
  }

  // ── derived data ──
  const filtered = useMemo(()=>[...txns].filter((t:any)=>who==="all"||t.userId===user.id).sort((a:any,b:any)=>b.date?.localeCompare(a.date)),[txns,who]);
  const total    = useMemo(()=>filtered.reduce((s:number,t:any)=>s+(t.amount||0),0),[filtered]);
  const byCat    = useMemo(()=>cats.map((c:any)=>({...c,total:filtered.filter((t:any)=>t.categoryId===c.id).reduce((s:number,t:any)=>s+(t.amount||0),0),count:filtered.filter((t:any)=>t.categoryId===c.id).length})).filter((c:any)=>c.total>0).sort((a:any,b:any)=>b.total-a.total),[filtered,cats]);
  const maxCat   = byCat[0]?.total||1;
  const byUser   = useMemo(()=>mems.map((u:any)=>({...u,total:txns.filter((t:any)=>t.userId===u.id).reduce((s:number,t:any)=>s+(t.amount||0),0)})),[mems,txns]);
  const gTotal   = txns.reduce((s:number,t:any)=>s+(t.amount||0),0);
  const weeks    = useMemo(()=>{ const m:any={}; filtered.forEach((t:any)=>{ const w=wkOf(t.date); m[w]=(m[w]||0)+(t.amount||0); }); return Object.keys(m).sort().slice(-5).map(k=>({week:k,total:m[k]})); },[filtered]);
  const maxWeek  = Math.max(...weeks.map((w:any)=>w.total),1);
  const byDay    = useMemo(()=>{ const m:any={}; filtered.forEach((t:any)=>{ m[t.date]=(m[t.date]||0)+(t.amount||0); }); return Object.entries(m).sort(([,a],[,b])=>(b as number)-(a as number)).slice(0,3).map(([d,v])=>({date:d,total:v as number})); },[filtered]);
  const grouped  = useMemo(()=>{ const g:any={}; filtered.forEach((t:any)=>{ if(!g[t.date])g[t.date]=[]; g[t.date].push(t); }); return g; },[filtered]);

  // ── sub-components ──
  const inp:any = {width:"100%",padding:"12px 14px",border:`1.5px solid ${T.ibr}`,borderRadius:12,fontSize:14,background:T.ib,color:T.tx,boxSizing:"border-box"};
  function Av({u,sz=32}:any){ return <div style={{width:sz,height:sz,borderRadius:"50%",background:(u?.color||"#888")+"30",color:u?.color||"#888",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.33,fontWeight:700,flexShrink:0,border:`1.5px solid ${(u?.color||"#888")}60`}}>{inits(u?.name||"?")}</div>; }
  function CI({catId,sz=40}:any){ const c=cats.find((x:any)=>x.id===catId)||{color:"#888",icon:"📦"}; return <div style={{width:sz,height:sz,borderRadius:sz*0.28,background:c.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sz*0.46,flexShrink:0,border:`1px solid ${c.color}40`}}>{c.icon}</div>; }
  function Card({children,style={},onClick}:any){ return <div onClick={onClick} style={{background:T.card,borderRadius:16,border:`1px solid ${T.cb}`,overflow:"hidden",boxShadow:T.cs,...style}}>{children}</div>; }
  function Sec({title,children,action}:any){ return <div style={{margin:"0 16px 20px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:T.st,letterSpacing:"1px",textTransform:"uppercase"}}>{title}</div>{action}</div>{children}</div>; }
  function TR({t,last}:any){
    const u=mems.find((m:any)=>m.id===t.userId)||{name:"Unknown",color:"#888"};
    const cat=cats.find((c:any)=>c.id===t.categoryId);
    return <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:last?"none":`1px solid ${T.rd}`}}>
      <CI catId={t.categoryId}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:500,color:T.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.note||cat?.label||"Expense"}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}><Av u={u} sz={14}/><span style={{fontSize:11,color:T.ts}}>{u.name} · {relDate(t.date)}</span></div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:14,fontWeight:700,color:T.tx}}>{fmtCur(t.amount||0,t.currency)}</div>
        {t.userId===user.id&&<button onClick={()=>delTxn(t.id)} style={{fontSize:10,color:"#FF6B6B",background:"none",border:"none",cursor:"pointer",padding:0}}>delete</button>}
      </div>
    </div>;
  }
  function Sheet({show,onClose,title,children}:any){ if(!show)return null; return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:T.card,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"0 20px 36px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${T.cb}`}}><div style={{width:40,height:4,background:T.pb,borderRadius:2,margin:"14px auto 22px"}}/><div style={{fontSize:20,fontWeight:800,marginBottom:20,color:T.tx}}>{title}</div>{children}</div></div>; }

  // drill view
  const drillTxns = drill ? filtered.filter((t:any)=>t.categoryId===drill) : [];
  const drillInfo = drill ? cats.find((c:any)=>c.id===drill) : null;
  if(drill&&drillInfo) return <div style={{fontFamily:"system-ui,sans-serif",maxWidth:430,margin:"0 auto",paddingBottom:40,minHeight:"100vh",background:T.bg}}>
    <div style={{background:G,padding:"20px 20px 48px"}}>
      <button onClick={()=>setDrill(null)} style={{background:"#ffffff20",border:"none",color:"#fff",borderRadius:10,padding:"7px 14px",fontSize:13,cursor:"pointer",marginBottom:18}}>← Back</button>
      <div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:56,height:56,borderRadius:16,background:"#ffffff20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{drillInfo.icon}</div><div><div style={{fontSize:22,fontWeight:700,color:"#fff"}}>{drillInfo.label}</div><div style={{fontSize:13,color:"#ffffff99"}}>{drillTxns.length} transactions</div></div></div>
      <div style={{fontSize:38,fontWeight:700,color:"#fff",marginTop:14}}>{fmtCur(drillTxns.reduce((s:number,t:any)=>s+(t.amount||0),0))}</div>
    </div>
    <div style={{margin:"-24px 16px 0",borderRadius:16,overflow:"hidden",border:`1px solid ${T.cb}`,background:T.card}}>
      {drillTxns.length===0&&<div style={{padding:40,textAlign:"center",color:T.ts}}>No transactions here yet</div>}
      {drillTxns.map((t:any,i:number)=><TR key={t.id} t={t} last={i===drillTxns.length-1}/>)}
    </div>
  </div>;

  return <div style={{fontFamily:"system-ui,sans-serif",maxWidth:430,margin:"0 auto",paddingBottom:90,minHeight:"100vh",background:T.bg}}>

    {/* ── DASHBOARD ── */}
    {tab==="dashboard"&&<>
      <div style={{background:G,padding:"24px 20px 64px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{room.name}</div><div style={{fontSize:11,color:"#ffffff70",marginTop:2}}>✓ Synced {sync}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setShowInv(true)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:12,cursor:"pointer",color:"#fff",fontWeight:600}}>Invite</button>
            <button onClick={()=>setDark((d:boolean)=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{fontSize:13,color:"#ffffffAA",marginBottom:4}}>Total spent this month</div>
        <div style={{fontSize:44,fontWeight:800,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{fmtCur(total)}</div>
        <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
          {byUser.map((u:any)=><div key={u.id} style={{display:"flex",alignItems:"center",gap:7,background:"#ffffff18",borderRadius:20,padding:"5px 12px",border:"1px solid #ffffff25"}}><Av u={u} sz={20}/><span style={{fontSize:12,color:"#ffffffCC",fontWeight:500}}>{u.name} <strong style={{color:"#fff"}}>{fmtCur(u.total)}</strong></span></div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,overflowX:"auto"}}>
          {[{id:"all",name:"Everyone",color:"#fff"},...mems].map((u:any)=><button key={u.id} onClick={()=>setWho(u.id)} style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${who===u.id?"#fff":"#ffffff40"}`,background:who===u.id?"#ffffff25":"#ffffff12",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:who===u.id?700:400,whiteSpace:"nowrap",flexShrink:0}}>{u.name}</button>)}
        </div>
      </div>

      <div style={{margin:"-30px 16px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,position:"relative",zIndex:10}}>
        {[{label:"Biggest day",val:byDay[0]?fmtCur(byDay[0].total):"—",sub:byDay[0]?relDate(byDay[0].date):"no data",grad:"linear-gradient(135deg,#FF6B6B,#FF8E53)"},{label:"Transactions",val:filtered.length,sub:"this period",grad:"linear-gradient(135deg,#4ECDC4,#45B7D1)"}].map((m,i)=><div key={i} style={{borderRadius:16,padding:16,background:m.grad,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}><div style={{fontSize:10,color:"#ffffff99",marginBottom:6,fontWeight:700,textTransform:"uppercase"}}>{m.label}</div><div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{m.val}</div><div style={{fontSize:11,color:"#ffffffBB",marginTop:3}}>{m.sub}</div></div>)}
      </div>

      {weeks.length>0&&<Sec title="Weekly trend"><div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cb}`,padding:"16px 16px 12px",boxShadow:T.cs}}><div style={{display:"flex",alignItems:"flex-end",gap:8,height:90,justifyContent:"space-between",borderBottom:`1px solid ${T.rd}`,paddingBottom:10,marginBottom:10}}>{weeks.map((w:any,i:number)=>{ const h=Math.max(8,Math.round((w.total/maxWeek)*80)); const isL=i===weeks.length-1; return <div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}><div style={{fontSize:10,fontWeight:isL?700:400,color:isL?"#6C63FF":T.ts}}>{fmtCur(w.total).replace(/[^0-9.,]/g,"").replace(/\.00$/,"")}</div><div style={{width:"100%",height:h,borderRadius:"6px 6px 4px 4px",background:isL?"linear-gradient(180deg,#6C63FF,#9B59B6)":T.surface,border:`1px solid ${isL?"#6C63FF60":T.cb}`}}/></div>; })}</div><div style={{display:"flex",gap:8,justifyContent:"space-between"}}>{weeks.map((w:any,i:number)=>{ const s=new Date(w.week),e=new Date(w.week); e.setDate(e.getDate()+6); const f2=(d:Date)=>d.toLocaleDateString("en-MY",{day:"numeric",month:"short"}); const isL=i===weeks.length-1; return <div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><div style={{fontSize:9,color:isL?"#6C63FF":T.ts,fontWeight:isL?700:400,textAlign:"center",lineHeight:1.3}}>{f2(s)}</div><div style={{fontSize:8,color:T.tm,textAlign:"center"}}>– {f2(e)}</div></div>; })}</div></div></Sec>}

      {byDay.length>0&&<Sec title="Highest spending days"><Card>{byDay.map((d:any,i:number)=><div key={d.date} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:i<byDay.length-1?`1px solid ${T.rd}`:"none"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:10,background:["#FF6B6B25","#F0A50025","#4ECDC425"][i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{["🔥","⚡","💸"][i]}</div><div><div style={{fontSize:14,fontWeight:600,color:T.tx}}>{relDate(d.date)}</div><div style={{fontSize:11,color:T.ts}}>{txns.filter((t:any)=>t.date===d.date).length} transactions</div></div></div><div style={{fontSize:16,fontWeight:800,color:["#FF6B6B","#F0A500","#4ECDC4"][i]}}>{fmtCur(d.total)}</div></div>)}</Card></Sec>}

      <Sec title="Spending by category"><Card>{byCat.length===0?<div style={{padding:40,textAlign:"center",color:T.ts}}>No spending yet — add your first expense!</div>:byCat.map((c:any,i:number)=><div key={c.id} onClick={()=>setDrill(c.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<byCat.length-1?`1px solid ${T.rd}`:"none",cursor:"pointer"}}><div style={{width:42,height:42,borderRadius:12,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,border:`1px solid ${c.color}40`,flexShrink:0}}>{c.icon}</div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:14,fontWeight:600,color:T.tx}}>{c.label}</div><div style={{fontSize:14,fontWeight:800,color:c.color}}>{fmtCur(c.total)}</div></div><div style={{height:6,background:T.rd,borderRadius:3}}><div style={{width:`${Math.min(100,(c.total/maxCat)*100)}%`,height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}88)`,borderRadius:3}}/></div><div style={{fontSize:10,color:T.ts,marginTop:4}}>{c.count} transaction{c.count!==1?"s":""} · {total>0?Math.round((c.total/total)*100):0}%</div></div><div style={{color:T.tm,fontSize:18}}>›</div></div>)}</Card></Sec>

      <Sec title="Recent transactions" action={<button onClick={()=>setTab("transactions")} style={{fontSize:12,color:"#6C63FF",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>See all →</button>}><Card>{filtered.length===0?<div style={{padding:40,textAlign:"center",color:T.ts}}>No transactions yet</div>:filtered.slice(0,4).map((t:any,i:number)=><TR key={t.id} t={t} last={i===3||i===filtered.slice(0,4).length-1}/>)}</Card></Sec>
    </>}

    {/* ── TRANSACTIONS ── */}
    {tab==="transactions"&&<>
      <div style={{background:G,padding:"24px 20px 28px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Transactions</div><button onClick={()=>setDark((d:boolean)=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button></div><div style={{fontSize:13,color:"#ffffffAA"}}>{filtered.length} total · {fmtCur(total)}</div></div>
      <div style={{margin:"14px 16px"}}>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:14}}>{cats.filter((c:any)=>filtered.some((t:any)=>t.categoryId===c.id)).map((c:any)=><button key={c.id} onClick={()=>setDrill(c.id)} style={{padding:"7px 12px",borderRadius:99,border:`1.5px solid ${c.color}50`,background:c.color+"18",color:c.color,fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>{c.icon} {c.label}</button>)}</div>
        <Card>{Object.entries(grouped).sort(([a],[b])=>b.localeCompare(a)).map(([date,dt]:any)=><div key={date}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:T.dh,borderBottom:`1px solid ${T.rd}`}}><span style={{fontSize:12,fontWeight:700,color:T.ts,textTransform:"uppercase"}}>{relDate(date)}</span><span style={{fontSize:13,fontWeight:800,color:T.tx}}>{fmtCur(dt.reduce((s:number,t:any)=>s+(t.amount||0),0))}</span></div>{dt.map((t:any,i:number)=><TR key={t.id} t={t} last={i===dt.length-1}/>)}</div>)}{filtered.length===0&&<div style={{padding:40,textAlign:"center",color:T.ts}}>No transactions yet</div>}</Card>
      </div>
    </>}

    {/* ── ANALYSIS ── */}
    {tab==="analysis"&&<>
      <div style={{background:G,padding:"24px 20px 28px"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Analysis</div><div style={{fontSize:13,color:"#ffffffAA",marginTop:2}}>Your spending insights</div></div><button onClick={()=>setDark((d:boolean)=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button></div></div>
      <div style={{margin:"14px 16px"}}>
        <Sec title="Household split"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{byUser.map((u:any)=>{ const pct=gTotal>0?Math.round((u.total/gTotal)*100):0; return <div key={u.id} style={{borderRadius:16,padding:16,background:u.color+"18",border:`1px solid ${u.color}30`}}><Av u={u} sz={36}/><div style={{fontSize:13,fontWeight:700,color:T.tx,marginTop:10}}>{u.name}</div><div style={{fontSize:22,fontWeight:800,color:u.color,marginTop:4}}>{fmtCur(u.total)}</div><div style={{fontSize:11,color:T.ts,marginTop:2}}>{pct}% of total</div><div style={{height:5,background:T.rd,borderRadius:3,marginTop:10}}><div style={{width:`${pct}%`,height:"100%",background:u.color,borderRadius:3}}/></div></div>; })}</div></Sec>
        <Sec title="Category breakdown"><Card>{byCat.length===0?<div style={{padding:32,textAlign:"center",color:T.ts}}>No data yet</div>:byCat.slice(0,7).map((c:any,i:number)=><div key={c.id} onClick={()=>setDrill(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 16px",borderBottom:i<Math.min(byCat.length,7)-1?`1px solid ${T.rd}`:"none",cursor:"pointer"}}><div style={{width:34,height:34,borderRadius:10,background:c.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{c.icon}</div><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{fontWeight:600,color:T.tx}}>{c.label}</span><span style={{color:T.ts}}>{total>0?Math.round((c.total/total)*100):0}%</span></div><div style={{height:7,background:T.rd,borderRadius:4}}><div style={{width:`${total>0?(c.total/total)*100:0}%`,height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}77)`,borderRadius:4}}/></div></div><div style={{fontSize:13,fontWeight:800,color:c.color,minWidth:68,textAlign:"right"}}>{fmtCur(c.total)}</div></div>)}</Card></Sec>
        <Sec title="Averages"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{label:"Daily avg",val:fmtCur(total/Math.max(1,Object.keys(grouped).length)),color:"#6C63FF",grad:"linear-gradient(135deg,#6C63FF22,#9B59B622)"},{label:"Per transaction",val:fmtCur(filtered.length>0?total/filtered.length:0),color:"#FF6B9D",grad:"linear-gradient(135deg,#FF6B9D22,#C44DFF22)"}].map((m,i)=><div key={i} style={{borderRadius:14,padding:14,background:m.grad,border:`1px solid ${m.color}30`}}><div style={{fontSize:10,color:T.ts,marginBottom:6,fontWeight:700,textTransform:"uppercase"}}>{m.label}</div><div style={{fontSize:18,fontWeight:800,color:m.color}}>{m.val}</div></div>)}</div></Sec>
      </div>
    </>}

    {/* ── CATEGORIES ── */}
    {tab==="categories"&&<>
      <div style={{background:G,padding:"24px 20px 28px"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Categories</div><div style={{fontSize:13,color:"#ffffffAA",marginTop:2}}>{cats.length} categories</div></div><button onClick={()=>setDark((d:boolean)=>!d)} style={{background:"#ffffff20",border:"1px solid #ffffff30",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{dark?"☀️":"🌙"}</button></div></div>
      <div style={{margin:"14px 16px"}}>
        <Card>{cats.map((c:any,i:number)=>{ const ct=filtered.filter((t:any)=>t.categoryId===c.id).reduce((s:number,t:any)=>s+(t.amount||0),0); const cc=filtered.filter((t:any)=>t.categoryId===c.id).length; return <div key={c.id} onClick={()=>setDrill(c.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:i<cats.length-1?`1px solid ${T.rd}`:"none",cursor:"pointer"}}><div style={{width:46,height:46,borderRadius:14,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,border:`1px solid ${c.color}40`,flexShrink:0}}>{c.icon}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.tx}}>{c.label}</div><div style={{fontSize:11,color:T.ts,marginTop:2}}>{cc} transaction{cc!==1?"s":""}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:ct>0?c.color:T.tm}}>{ct>0?fmtCur(ct):"—"}</div></div></div>; })}</Card>
        <button onClick={()=>setShowCat(true)} style={{marginTop:14,width:"100%",padding:"14px",background:G,color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer"}}>+ Add custom category</button>
      </div>
    </>}

    {/* ── PROFILE ── */}
    {tab==="profile"&&<>
      <div style={{background:G,padding:"24px 20px 28px"}}><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>Profile</div></div>
      <div style={{margin:"20px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cb}`,padding:20,display:"flex",alignItems:"center",gap:16}}><div style={{width:60,height:60,borderRadius:"50%",background:"#6C63FF30",color:"#6C63FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800}}>{inits(user.name)}</div><div><div style={{fontSize:18,fontWeight:800,color:T.tx}}>{user.name}</div><div style={{fontSize:13,color:T.ts,marginTop:2}}>{user.email}</div></div></div>
        <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cb}`,padding:20}}>
          <div style={{fontSize:11,fontWeight:700,color:T.st,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>Current room</div>
          <div style={{fontSize:18,fontWeight:800,color:T.tx,marginBottom:4}}>{room.name}</div>
          <div style={{fontSize:13,color:T.ts,marginBottom:16}}>{mems.length} member{mems.length!==1?"s":""}</div>
          <div style={{background:T.surface,borderRadius:12,padding:"14px 16px",border:`1px dashed ${T.cb}`}}>
            <div style={{fontSize:11,color:T.ts,marginBottom:6,fontWeight:600}}>Share code — invite others to join</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div style={{fontSize:30,fontWeight:900,color:"#6C63FF",letterSpacing:"6px"}}>{room.share_code}</div>
              <button onClick={onCopyCode} style={{padding:"8px 16px",background:copied?"#06D6A020":"#6C63FF18",border:`1px solid ${copied?"#06D6A050":"#6C63FF40"}`,borderRadius:10,color:copied?"#06D6A0":"#6C63FF",fontSize:13,fontWeight:700,cursor:"pointer"}}>{copied?"✓ Copied!":"Copy"}</button>
            </div>
          </div>
        </div>
        <div style={{background:T.card,borderRadius:16,border:`1px solid ${T.cb}`,overflow:"hidden"}}>
          <div onClick={()=>setDark((d:boolean)=>!d)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",cursor:"pointer"}}><span style={{fontSize:15,color:T.tx,fontWeight:500}}>Dark mode</span><span style={{fontSize:14,color:T.ts,fontWeight:600}}>{dark?"🌙 On":"☀️ Off"}</span></div>
        </div>
        <button onClick={onSignOut} style={{padding:"15px",background:"#FF6B6B18",border:"1px solid #FF6B6B40",borderRadius:14,color:"#FF6B6B",fontSize:15,fontWeight:700,cursor:"pointer"}}>Sign out</button>
      </div>
    </>}

    {/* FAB */}
    <button onClick={()=>setShowAdd(true)} style={{position:"fixed",bottom:72,right:"calc(50% - 207px)",background:G,color:"#fff",border:"none",borderRadius:"50%",width:56,height:56,fontSize:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:101,boxShadow:"0 6px 24px #6C63FF66"}}>+</button>

    {/* Nav */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:T.nb,borderTop:`1px solid ${T.nbr}`,display:"flex",zIndex:100}}>
      {[{id:"dashboard",icon:"⬛",label:"Home"},{id:"transactions",icon:"☰",label:"Spending"},{id:"analysis",icon:"📊",label:"Analysis"},{id:"categories",icon:"🏷",label:"Categories"},{id:"profile",icon:"👤",label:"Profile"}].map(n=><button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,padding:"11px 0 9px",border:"none",background:"none",cursor:"pointer",fontSize:10,color:tab===n.id?"#6C63FF":T.ts,fontWeight:tab===n.id?700:400,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:18}}>{n.icon}</span>{n.label}</button>)}
    </div>

    {/* Invite sheet */}
    <Sheet show={showInv} onClose={()=>setShowInv(false)} title={`Invite to ${room.name}`}>
      <div style={{fontSize:14,color:T.ts,marginBottom:24,lineHeight:1.5}}>Share this code with your partner. They sign up → tap &quot;Enter a share code&quot; → type this code.</div>
      <div style={{background:T.surface,borderRadius:14,padding:20,border:`1px dashed ${T.cb}`,textAlign:"center",marginBottom:20}}><div style={{fontSize:11,color:T.ts,marginBottom:8,fontWeight:600,textTransform:"uppercase"}}>Room share code</div><div style={{fontSize:44,fontWeight:900,color:"#6C63FF",letterSpacing:"10px"}}>{room.share_code}</div></div>
      <button onClick={onCopyCode} style={{width:"100%",padding:"15px",background:copied?"#06D6A020":G,border:copied?"1px solid #06D6A050":"none",borderRadius:14,color:copied?"#06D6A0":"#fff",fontSize:16,fontWeight:800,cursor:"pointer"}}>{copied?"✓ Copied!":"Copy invite code"}</button>
    </Sheet>

    {/* Add txn sheet */}
    <Sheet show={showAdd} onClose={()=>setShowAdd(false)} title="Add expense">
      <div style={{marginBottom:14}}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>Amount</div><div style={{display:"flex",gap:8}}><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={{...inp,width:90,flex:"0 0 90px"}}>{CURRS.map(c=><option key={c}>{c}</option>)}</select><input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{...inp,flex:1,fontSize:20,fontWeight:700}} autoFocus/></div></div>
      <div style={{marginBottom:14}}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>Note</div><input type="text" placeholder="What was this for?" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={inp}/></div>
      <div style={{marginBottom:14}}><div style={{fontSize:12,color:T.ts,marginBottom:8,fontWeight:600}}>Category</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{cats.map((c:any)=><button key={c.id} onClick={()=>setForm(f=>({...f,catId:c.id}))} style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${form.catId===c.id?c.color:T.pb}`,background:form.catId===c.id?c.color+"22":T.pl,color:form.catId===c.id?c.color:T.ts,fontSize:12,cursor:"pointer",fontWeight:form.catId===c.id?700:400}}>{c.icon} {c.label}</button>)}</div></div>
      <div style={{display:"flex",gap:10,marginBottom:6}}><div style={{flex:1}}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>Date</div><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp}/></div></div>
      <button onClick={addTxn} disabled={busy} style={{width:"100%",padding:"15px",background:G,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer",marginTop:14,opacity:busy?0.7:1}}>{busy?"Saving…":"Add expense"}</button>
    </Sheet>

    {/* Add category sheet */}
    <Sheet show={showCat} onClose={()=>setShowCat(false)} title="New category">
      <div style={{marginBottom:14}}><div style={{fontSize:12,color:T.ts,marginBottom:6,fontWeight:600}}>Name</div><input type="text" placeholder="e.g. Pet care" value={nc.label} onChange={e=>setNc(n=>({...n,label:e.target.value}))} style={inp} autoFocus/></div>
      <div style={{marginBottom:14}}><div style={{fontSize:12,color:T.ts,marginBottom:8,fontWeight:600}}>Icon</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{EMOJIS.map(em=><button key={em} onClick={()=>setNc(n=>({...n,icon:em}))} style={{width:42,height:42,borderRadius:11,border:`2px solid ${nc.icon===em?"#6C63FF":T.pb}`,background:nc.icon===em?"#6C63FF22":T.pl,fontSize:20,cursor:"pointer"}}>{em}</button>)}</div></div>
      <div style={{marginBottom:16}}><div style={{fontSize:12,color:T.ts,marginBottom:8,fontWeight:600}}>Color</div><div style={{display:"flex",flexWrap:"wrap",gap:10}}>{COLORS.map(col=><button key={col} onClick={()=>setNc(n=>({...n,color:col}))} style={{width:34,height:34,borderRadius:"50%",background:col,border:nc.color===col?`3px solid ${T.tx}`:"3px solid transparent",cursor:"pointer"}}/>)}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:14,background:nc.color+"15",borderRadius:14,marginBottom:8,border:`1px solid ${nc.color}40`}}><div style={{width:48,height:48,borderRadius:14,background:nc.color+"25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{nc.icon}</div><div style={{fontSize:16,fontWeight:700,color:nc.color}}>{nc.label||"Preview"}</div></div>
      <button onClick={addCat} style={{width:"100%",padding:"15px",background:G,color:"#fff",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:"pointer"}}>Create category</button>
    </Sheet>
  </div>;
}
