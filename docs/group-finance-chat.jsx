import { useState, useRef, useEffect } from "react";

// ─── Sample Data ──────────────────────────────────────────────────────────────
const MEMBERS = [
  { id:"nitin",  name:"Nitin",  role:"owner",  avatar:"N",  color:"#6366F1" },
  { id:"meena",  name:"Meena",  role:"member", avatar:"M",  color:"#10B981" },
  { id:"nimesh", name:"Nimesh", role:"member", avatar:"Ni", color:"#F97316" },
  { id:"papa",   name:"Papa",   role:"member", avatar:"P",  color:"#8B5CF6" },
];
const ME = MEMBERS[0];

const MY_DEPOSITS = [
  { id:"d1", bank:"ICICI",          type:"Fixed Deposit", deposit:1159436, maturityDate:"2028-01-19", roi:0.075,  maturityAmt:1445098 },
  { id:"d2", bank:"Canara - Meena", type:"FD 444D",       deposit:1200000, maturityDate:"2026-04-07", roi:0.0775, maturityAmt:1097894 },
  { id:"d3", bank:"YES Mama",       type:"FD - Payout",   deposit:1000000, maturityDate:"2026-07-09", roi:0.0825, maturityAmt:1268829 },
  { id:"d4", bank:"SBI - Meena",    type:"STD-SR",        deposit:500000,  maturityDate:"2026-02-26", roi:0.076,  maturityAmt:586150  },
  { id:"d5", bank:"IOB - Meena",    type:"SLRDP 444D",    deposit:1200000, maturityDate:"2026-09-26", roi:0.0745, maturityAmt:1193452 },
];

const INIT_MESSAGES = [
  { id:1, senderId:"meena",  type:"text",  text:"Nimesh, did you check the Canara FD that matured last week?",                              ts:"2026-03-07T09:12:00" },
  { id:2, senderId:"nimesh", type:"text",  text:"Yes Mama, visited the branch. They auto-renewed it for 444 days at 7.75%. I have the receipt.", ts:"2026-03-07T09:15:00" },
  { id:3, senderId:"nitin",  type:"fd",    text:"Here's the FD details I'm tracking for this one:",                                          ts:"2026-03-07T09:18:00", fd: MY_DEPOSITS[1] },
  { id:4, senderId:"papa",   type:"text",  text:"Good. Also check if the SCSS quarterly interest came in April.",                             ts:"2026-03-07T10:02:00" },
  { id:5, senderId:"nitin",  type:"alert", text:"Maturity reminder for everyone — please take action:",                                       ts:"2026-03-07T10:05:00", alert:{ title:"SBI FD Maturing Soon", date:"2026-02-26", amount:586150, bank:"SBI - Meena", daysLeft:0 } },
  { id:6, senderId:"meena",  type:"text",  text:"Thank you Nitin. Can you also share the IOB deposit details? I can't find my passbook.",     ts:"2026-03-08T08:30:00" },
  { id:7, senderId:"nitin",  type:"fd",    text:"Here you go Mama — IOB details:",                                                           ts:"2026-03-08T08:45:00", fd: MY_DEPOSITS[4] },
  { id:8, senderId:"nimesh", type:"doc",   text:"Uploading the renewed FD certificate for records:",                                          ts:"2026-03-08T09:10:00", doc:{ name:"Canara_FD_Renewed_Mar2026.pdf", size:"245 KB", type:"PDF" } },
  { id:9, senderId:"meena",  type:"text",  text:"Perfect, this is very helpful. Keep sharing updates like this 🙏",                           ts:"2026-03-09T10:00:00" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getMember = id => MEMBERS.find(m => m.id === id) || MEMBERS[0];
function fmt(n) {
  if (!n) return "—";
  const v = Number(n);
  if (v >= 10000000) return "₹" + (v/10000000).toFixed(2) + " Cr";
  if (v >= 100000)   return "₹" + (v/100000).toFixed(2) + " L";
  return "₹" + v.toLocaleString("en-IN");
}
const fmtDate = str => !str ? "—" : new Date(str).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
const fmtTime = str => new Date(str).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
function fmtDay(str) {
  const d = new Date(str), t = new Date();
  if (d.toDateString() === t.toDateString()) return "Today";
  const y = new Date(t); y.setDate(t.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short" });
}
function daysLeft(str) {
  if (!str) return null;
  return Math.round((new Date(str) - new Date()) / 86400000);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ member, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:member.color+"22", border:`2px solid ${member.color}40`, color:member.color, fontSize:size*0.36, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {member.avatar}
    </div>
  );
}

// ─── FD Card ──────────────────────────────────────────────────────────────────
function FDCard({ fd }) {
  const days = daysLeft(fd.maturityDate);
  const urg = days !== null && days <= 90 ? "#EF4444" : days <= 180 ? "#F59E0B" : "#10B981";
  return (
    <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderLeft:`3px solid #10B981`, borderRadius:10, padding:"12px 14px", marginTop:8, minWidth:240 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:"#065F46" }}>🏦 {fd.bank}</div>
          <div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>{fd.type}</div>
        </div>
        <div style={{ background:urg+"20", color:urg, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
          {days === null ? "—" : days < 0 ? "Matured" : days === 0 ? "TODAY!" : `${days}d left`}
        </div>
      </div>
      <div style={{ display:"flex", gap:14 }}>
        {[["INVESTED", fmt(fd.deposit), "#374151"],["AT MATURITY", fmt(fd.maturityAmt), "#10B981"],["ROI", (fd.roi*100).toFixed(2)+"%","#6366F1"]].map(([l,v,c])=>(
          <div key={l}>
            <div style={{ fontSize:9, color:"#9CA3AF", fontWeight:700, letterSpacing:0.5 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"monospace", marginTop:1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:"#6B7280", marginTop:8, borderTop:"1px solid #D1FAE5", paddingTop:8 }}>
        📅 Matures: <strong>{fmtDate(fd.maturityDate)}</strong>
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert }) {
  const days = alert.daysLeft ?? daysLeft(alert.date);
  const urg = days !== null && days <= 0 ? "#EF4444" : days <= 30 ? "#EF4444" : "#F59E0B";
  return (
    <div style={{ background:urg+"08", border:`1px solid ${urg}30`, borderLeft:`3px solid ${urg}`, borderRadius:10, padding:"12px 14px", marginTop:8, minWidth:220 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <span style={{ fontSize:20 }}>🔔</span>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:"#1F2937" }}>{alert.title}</div>
          <div style={{ fontSize:11, color:"#6B7280" }}>{alert.bank}</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ fontSize:16, fontWeight:800, color:urg, fontFamily:"monospace" }}>{fmt(alert.amount)}</div>
        <div style={{ background:urg+"20", color:urg, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>
          {days <= 0 ? "⚠️ Matured!" : `🔴 ${days}d`}
        </div>
      </div>
      <div style={{ fontSize:11, color:"#6B7280", marginTop:6 }}>Due: {fmtDate(alert.date)}</div>
    </div>
  );
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────
function DocCard({ doc }) {
  const cols = { PDF:"#EF4444", XLSX:"#10B981", IMG:"#3B82F6" };
  const c = cols[doc.type] || "#6B7280";
  return (
    <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:10, padding:"10px 14px", marginTop:8, display:"flex", alignItems:"center", gap:12, cursor:"pointer", maxWidth:280 }}>
      <div style={{ width:36, height:42, background:c+"15", border:`1.5px solid ${c}40`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:c, flexShrink:0 }}>{doc.type}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#1F2937" }}>{doc.name}</div>
        <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>{doc.size} · Tap to view</div>
      </div>
      <div style={{ fontSize:16, color:"#9CA3AF" }}>⬇</div>
    </div>
  );
}

// ─── Single Message ───────────────────────────────────────────────────────────
function Message({ msg, showAvatar, showDay }) {
  const sender = getMember(msg.senderId);
  const isMe = msg.senderId === ME.id;
  return (
    <>
      {showDay && (
        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"20px 0 14px" }}>
          <div style={{ flex:1, height:1, background:"#D1FAE5" }} />
          <div style={{ fontSize:11, color:"#6B7280", fontWeight:600, background:"#ECFDF5", border:"1px solid #BBF7D0", padding:"3px 14px", borderRadius:20, whiteSpace:"nowrap" }}>{fmtDay(msg.ts)}</div>
          <div style={{ flex:1, height:1, background:"#D1FAE5" }} />
        </div>
      )}

      <div style={{ display:"flex", flexDirection:isMe?"row-reverse":"row", alignItems:"flex-end", gap:8, marginBottom:showAvatar?14:3, paddingLeft:isMe?52:0, paddingRight:isMe?0:52 }}>
        {/* Avatar slot */}
        <div style={{ width:36, flexShrink:0 }}>
          {showAvatar && !isMe && <Avatar member={sender} size={34} />}
        </div>

        <div style={{ maxWidth:"75%", display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
          {/* Sender name */}
          {showAvatar && !isMe && (
            <div style={{ fontSize:11, fontWeight:700, color:sender.color, marginBottom:4, paddingLeft:2 }}>
              {sender.name}
              {sender.role==="owner" && <span style={{ marginLeft:5, fontSize:9, background:"#FEF3C7", color:"#D97706", padding:"1px 6px", borderRadius:20, fontWeight:700 }}>OWNER</span>}
            </div>
          )}

          {/* Bubble */}
          <div style={{
            background: isMe ? "linear-gradient(135deg,#0D9488,#0F766E)" : "#FFFFFF",
            color: isMe ? "#FFFFFF" : "#1F2937",
            padding:"10px 14px",
            borderRadius: isMe ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
            boxShadow:"0 1px 4px rgba(0,0,0,0.07)",
            border: isMe ? "none" : "1px solid #F0FDF4",
            fontSize:14, lineHeight:1.55
          }}>
            {msg.text && <div style={{ marginBottom: (msg.fd||msg.alert||msg.doc) ? 0 : 0 }}>{msg.text}</div>}
            {msg.type==="fd"    && <FDCard fd={msg.fd} />}
            {msg.type==="alert" && <AlertCard alert={msg.alert} />}
            {msg.type==="doc"   && <DocCard doc={msg.doc} />}
          </div>

          {/* Timestamp + read receipts */}
          {showAvatar && (
            <div style={{ fontSize:10, color:"#9CA3AF", marginTop:3, paddingLeft:2, paddingRight:2, display:"flex", alignItems:"center", gap:4 }}>
              {fmtTime(msg.ts)}
              {isMe && <span style={{ color:"#0D9488", fontWeight:700 }}>✓✓</span>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Attach Picker ────────────────────────────────────────────────────────────
function AttachPicker({ onAttach, onClose }) {
  const [tab, setTab] = useState("fd");
  const upcomingFDs = MY_DEPOSITS.filter(fd => { const d=daysLeft(fd.maturityDate); return d!==null&&d<=180; });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#FFFFFF", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:640, padding:"16px 20px 36px", boxShadow:"0 -8px 40px rgba(0,0,0,0.12)" }}>
        {/* Handle */}
        <div style={{ width:40, height:4, background:"#E5E7EB", borderRadius:2, margin:"0 auto 18px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#1F2937" }}>📎 Attach to Message</div>
          <button onClick={onClose} style={{ background:"#F3F4F6", border:"none", borderRadius:8, padding:"4px 12px", color:"#6B7280", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[["fd","🏦 Share FD"],["alert","🔔 Alert"],["doc","📄 Document"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              background:tab===id?"#0D9488":"#F3F4F6", color:tab===id?"#FFF":"#6B7280",
              border:"none", borderRadius:20, padding:"7px 18px", fontSize:13,
              fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s"
            }}>{label}</button>
          ))}
        </div>

        {/* FD list */}
        {tab==="fd" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
            {MY_DEPOSITS.map(fd => (
              <div key={fd.id} onClick={()=>onAttach("fd",fd)}
                style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:12, padding:"12px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"background 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.background="#DCFCE7"}
                onMouseLeave={e=>e.currentTarget.style.background="#F0FDF4"}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#065F46" }}>🏦 {fd.bank}</div>
                  <div style={{ fontSize:12, color:"#6B7280" }}>{fd.type} · Matures {fmtDate(fd.maturityDate)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#10B981", fontFamily:"monospace" }}>{fmt(fd.maturityAmt)}</div>
                  <div style={{ fontSize:11, color:"#9CA3AF" }}>{(fd.roi*100).toFixed(2)}% pa</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alert list */}
        {tab==="alert" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:300, overflowY:"auto" }}>
            {upcomingFDs.length===0 && <div style={{ color:"#9CA3AF", textAlign:"center", padding:32, fontSize:13 }}>No deposits maturing within 180 days</div>}
            {upcomingFDs.map(fd => {
              const days = daysLeft(fd.maturityDate);
              const urg = days<=30?"#EF4444":"#F59E0B";
              return (
                <div key={fd.id} onClick={()=>onAttach("alert",{ title:`${fd.bank} FD Maturing`, date:fd.maturityDate, amount:fd.maturityAmt, bank:fd.bank, daysLeft:days })}
                  style={{ background:urg+"08", border:`1px solid ${urg}30`, borderRadius:12, padding:"12px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                  onMouseEnter={e=>e.currentTarget.style.background=urg+"15"}
                  onMouseLeave={e=>e.currentTarget.style.background=urg+"08"}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#1F2937" }}>🔔 {fd.bank}</div>
                    <div style={{ fontSize:12, color:"#6B7280" }}>Due: {fmtDate(fd.maturityDate)} · {fmt(fd.maturityAmt)}</div>
                  </div>
                  <div style={{ background:urg+"20", color:urg, fontSize:12, fontWeight:700, padding:"3px 12px", borderRadius:20 }}>
                    {days<=0?"Matured!":days===0?"TODAY!":days+"d"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Doc upload */}
        {tab==="doc" && (
          <div style={{ border:"2px dashed #D1D5DB", borderRadius:14, padding:"36px 20px", textAlign:"center", cursor:"pointer", color:"#6B7280" }}
            onClick={()=>onAttach("doc",{ name:"Family_FD_Summary_Mar2026.pdf", size:"312 KB", type:"PDF" })}>
            <div style={{ fontSize:40, marginBottom:10 }}>📄</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#374151" }}>Tap to upload document</div>
            <div style={{ fontSize:12, marginTop:4 }}>PDF, image, Excel — any file</div>
            <div style={{ marginTop:16, background:"#0D9488", color:"#FFF", display:"inline-block", borderRadius:20, padding:"8px 28px", fontSize:13, fontWeight:700 }}>Choose File</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Members Sidebar ──────────────────────────────────────────────────────────
function MembersSidebar({ onClose }) {
  return (
    <div style={{ position:"absolute", right:0, top:0, bottom:0, width:220, background:"#FFFFFF", borderLeft:"1px solid #E5E7EB", zIndex:100, display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.08)" }}>
      <div style={{ padding:"16px", borderBottom:"1px solid #F3F4F6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:14, fontWeight:800, color:"#1F2937" }}>👥 Members ({MEMBERS.length})</div>
        <button onClick={onClose} style={{ background:"#F3F4F6", border:"none", borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:14, color:"#6B7280", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
        {MEMBERS.map(m=>(
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 8px", borderRadius:10, marginBottom:4, background:"#FAFAFA", border:"1px solid #F3F4F6" }}>
            <Avatar member={m} size={36} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1F2937" }}>
                {m.name} {m.id===ME.id && <span style={{ fontSize:10, color:"#9CA3AF", fontWeight:400 }}>(you)</span>}
              </div>
              {m.role==="owner"
                ? <span style={{ fontSize:10, background:"#FEF3C7", color:"#D97706", padding:"1px 7px", borderRadius:20, fontWeight:700 }}>👑 Owner</span>
                : <span style={{ fontSize:11, color:"#9CA3AF" }}>Member</span>}
            </div>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 0 2px #D1FAE5" }} />
          </div>
        ))}
      </div>
      <div style={{ padding:"12px", borderTop:"1px solid #F3F4F6" }}>
        <button style={{ width:"100%", background:"linear-gradient(135deg,#0D9488,#0F766E)", color:"#FFF", border:"none", borderRadius:10, padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          + Invite Member
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GroupFinanceChat() {
  const [messages, setMessages]       = useState(INIT_MESSAGES);
  const [inputText, setInputText]     = useState("");
  const [attachment, setAttachment]   = useState(null);
  const [showAttach, setShowAttach]   = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [filter, setFilter]           = useState("all");
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  function sendMessage() {
    const text = inputText.trim();
    if (!text && !attachment) return;
    const baseText = text || (attachment?.type==="fd" ? "Sharing FD details:" : attachment?.type==="alert" ? "Maturity alert for the group:" : "Sharing document:");
    const msg = {
      id: Date.now(), senderId: ME.id,
      type: attachment?.type || "text",
      text: baseText,
      ts: new Date().toISOString(),
      ...(attachment?.type==="fd"    ? { fd:    attachment.data } : {}),
      ...(attachment?.type==="alert" ? { alert: attachment.data } : {}),
      ...(attachment?.type==="doc"   ? { doc:   attachment.data } : {}),
    };
    setMessages(p=>[...p, msg]);
    setInputText(""); setAttachment(null);
  }

  const filtered = filter==="all" ? messages : messages.filter(m=>m.type===filter);
  const grouped  = filtered.map((msg,i)=>{
    const next = filtered[i+1], prev = filtered[i-1];
    const showAvatar = !next || next.senderId!==msg.senderId || (new Date(next.ts)-new Date(msg.ts))>300000;
    const showDay    = !prev || new Date(msg.ts).toDateString()!==new Date(prev.ts).toDateString();
    return { msg, showAvatar, showDay };
  });

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#F0FDFA", fontFamily:"'Segoe UI',system-ui,sans-serif", position:"relative", overflow:"hidden", maxWidth:680, margin:"0 auto", boxShadow:"0 0 60px rgba(0,0,0,0.1)" }}>

      {/* ── Header ── */}
      <div style={{ background:"#FFFFFF", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", flexShrink:0 }}>
        <button style={{ background:"#F3F4F6", border:"none", borderRadius:10, width:36, height:36, cursor:"pointer", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center", color:"#6B7280" }}>‹</button>
        <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#0D9488,#6366F1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>👨‍👩‍👧‍👦</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#1F2937" }}>Shared with Mama</div>
          <div style={{ fontSize:12, color:"#10B981", fontWeight:600 }}>
            {MEMBERS.map(m=>m.name).join(", ")} · {MEMBERS.length} members online
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setShowMembers(p=>!p)} style={{ background:showMembers?"#0D9488":"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:700, color:showMembers?"#FFF":"#0D9488", fontFamily:"inherit", transition:"all 0.2s" }}>
            👥 {MEMBERS.length}
          </button>
          <button style={{ background:"#F3F4F6", border:"none", borderRadius:10, width:36, height:36, cursor:"pointer", fontSize:18, color:"#6B7280", display:"flex", alignItems:"center", justifyContent:"center" }}>⋮</button>
        </div>
      </div>

      {/* ── Security badge + filter pills ── */}
      <div style={{ background:"#FFFFFF", borderBottom:"1px solid #E5E7EB", padding:"10px 16px", display:"flex", gap:8, alignItems:"center", overflowX:"auto", flexShrink:0 }}>
        {[["all","💬 All"],["fd","🏦 FDs"],["alert","🔔 Alerts"],["doc","📄 Docs"]].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?"#0D9488":"#F3F4F6", color:filter===id?"#FFF":"#6B7280", border:"none", borderRadius:20, padding:"5px 16px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit", transition:"all 0.2s" }}>{label}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#10B981", fontWeight:600, whiteSpace:"nowrap", background:"#F0FDF4", padding:"4px 12px", borderRadius:20, border:"1px solid #BBF7D0" }}>
          🔒 Encrypted
        </div>
      </div>

      {/* ── Messages area ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 16px" }}>
        {grouped.map(({ msg, showAvatar, showDay })=>(
          <Message key={msg.id} msg={msg} showAvatar={showAvatar} showDay={showDay} />
        ))}
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:"56px 24px", color:"#9CA3AF" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>💬</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#374151" }}>No messages here yet</div>
            <div style={{ fontSize:13, marginTop:4 }}>Share FD cards, maturity alerts, or notes with your family</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Attachment preview bar ── */}
      {attachment && (
        <div style={{ background:"#F0FDF4", borderTop:"1px solid #BBF7D0", padding:"10px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ flex:1, fontSize:13, color:"#065F46", fontWeight:600 }}>
            {attachment.type==="fd"    && `🏦 ${attachment.data.bank} — ${fmt(attachment.data.deposit)}`}
            {attachment.type==="alert" && `🔔 ${attachment.data.title}`}
            {attachment.type==="doc"   && `📄 ${attachment.data.name}`}
          </div>
          <button onClick={()=>setAttachment(null)} style={{ background:"#FEE2E2", color:"#EF4444", border:"none", borderRadius:20, padding:"4px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✕ Remove</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ background:"#FFFFFF", borderTop:"1px solid #E5E7EB", padding:"10px 16px", display:"flex", alignItems:"flex-end", gap:10, flexShrink:0, boxShadow:"0 -2px 12px rgba(0,0,0,0.05)" }}>
        <button onClick={()=>setShowAttach(true)} title="Attach FD, alert or document"
          style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:12, width:42, height:42, cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.2s" }}
          onMouseEnter={e=>e.currentTarget.style.background="#DCFCE7"}
          onMouseLeave={e=>e.currentTarget.style.background="#F0FDF4"}>
          📎
        </button>
        <textarea
          value={inputText}
          onChange={e=>setInputText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
          placeholder="Type a message, share FD details or send a reminder…"
          rows={1}
          style={{ flex:1, background:"#F9FAFB", border:"1.5px solid #E5E7EB", borderRadius:16, padding:"10px 14px", fontSize:14, fontFamily:"inherit", color:"#1F2937", resize:"none", outline:"none", lineHeight:1.5, maxHeight:100, overflowY:"auto" }}
          onFocus={e=>e.target.style.borderColor="#0D9488"}
          onBlur={e=>e.target.style.borderColor="#E5E7EB"}
        />
        <button onClick={sendMessage} disabled={!inputText.trim()&&!attachment}
          style={{ background:(inputText.trim()||attachment)?"linear-gradient(135deg,#0D9488,#0F766E)":"#E5E7EB", color:(inputText.trim()||attachment)?"#FFFFFF":"#9CA3AF", border:"none", borderRadius:12, width:42, height:42, cursor:(inputText.trim()||attachment)?"pointer":"default", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s", boxShadow:(inputText.trim()||attachment)?"0 4px 12px #0D948840":"none" }}>
          ➤
        </button>
      </div>

      {/* ── Overlays ── */}
      {showMembers && <MembersSidebar onClose={()=>setShowMembers(false)} />}
      {showAttach  && <AttachPicker onAttach={(type,data)=>{setAttachment({type,data});setShowAttach(false);}} onClose={()=>setShowAttach(false)} />}
    </div>
  );
}
