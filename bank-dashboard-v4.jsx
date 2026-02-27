import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from "recharts";

// ─── Pre-loaded sample data from Excel ───────────────────────────────────────
const PRELOAD_DATA = {"deposits":[{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713020941","nominee":"Nitin","startDate":"2023-01-18","deposit":1159436,"roi":0.075,"maturityAmt":1445098.0,"maturityDate":"2028-01-19","duration":"60 months 1 day","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713020847","nominee":"Nitin","startDate":"2023-01-11","deposit":1160886,"roi":0.075,"maturityAmt":1445063.0,"maturityDate":"2028-01-12","duration":"60 months 1 day","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713020599","nominee":"Nitin","startDate":"2025-12-31","deposit":614908,"roi":0.071,"maturityAmt":759605.0,"maturityDate":"2029-01-01","duration":"36 months 1 day","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713020848","nominee":"Nitin","startDate":"2026-01-12","deposit":1092734,"roi":0.071,"maturityAmt":1349871.0,"maturityDate":"2029-01-13","duration":"36 months 1 day","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713020942","nominee":"Nitin","startDate":"2026-01-19","deposit":1467828,"roi":0.071,"maturityAmt":1813230.0,"maturityDate":"2029-01-20","duration":"36 months","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157710008124","nominee":"Nitin","startDate":"2025-08-28","deposit":1000000,"roi":0.069,"maturityAmt":1000000.0,"maturityDate":"2027-08-28","duration":"24 months","maturityAction":"","done":false},{"bank":"Canara - Meena","type":"CANARA 444- KDR SRCTZN","depositId":"140196435869-1","nominee":"Lt Col Nimesh Kumar(1877800005412)","startDate":"2024-11-19","deposit":1200000,"roi":0.0775,"maturityAmt":1317473.0,"maturityDate":"2026-02-06","duration":"0Y, 0M, 444D","maturityAction":"","done":false},{"bank":"Canara - Meena","type":"CANARA 444- KDR SRCTZN","depositId":"140285789441-1","nominee":"Nitin Kumar","startDate":"2026-02-07","deposit":1500000,"roi":0.0695,"maturityAmt":1631171.0,"maturityDate":"2027-04-27","duration":"0Y, 0M, 444D","maturityAction":"","done":false},{"bank":"Canara - Meena","type":"CANARA 444- KDR SRCTZN","depositId":"140207771595-1","nominee":"Lt Col Nimesh Kumar(1877800005412)","startDate":"2025-01-18","deposit":1000000,"roi":0.0775,"maturityAmt":1097894.0,"maturityDate":"2026-04-07","duration":"0Y, 0M, 444D","maturityAction":"","done":false},{"bank":"Canara - Meena","type":"CANARA 444- KDR SRCTZN","depositId":"140207771834-1","nominee":"Lt Col Nimesh Kumar(1877800005412)","startDate":"2025-01-18","deposit":500000,"roi":0.0775,"maturityAmt":548946.0,"maturityDate":"2026-04-07","duration":"0Y, 0M, 444D","maturityAction":"","done":false},{"bank":"Canara - Meena","type":"CANARA 444- KDR SRCTZN","depositId":"140259185497-1","nominee":"Nitin Kumar","startDate":"2025-10-04","deposit":500000,"roi":0.07,"maturityAmt":544050.0,"maturityDate":"2026-12-22","duration":"0Y, 0M, 444D","maturityAction":"","done":false},{"bank":"SBI - Meena","type":"STD-SR CT UNI 181D-10YRS","depositId":"43589739177","nominee":"","startDate":"2026-02-23","deposit":1400000,"roi":0.0695,"maturityAmt":1522427.0,"maturityDate":"2027-05-12","duration":"444 Days","maturityAction":"","done":false},{"bank":"SBI - Meena","type":"STD-SR CT UNI 181D-10YRS","depositId":"42535288191","nominee":"","startDate":"2023-12-19","deposit":500000,"roi":0.076,"maturityAmt":586150.0,"maturityDate":"2026-02-26","duration":"400 Days","maturityAction":"","done":false},{"bank":"YES Mama","type":"FD - Regular Payout","depositId":"8541100055902","nominee":"Nitin","startDate":"2023-08-09","deposit":1000000,"roi":0.0825,"maturityAmt":1268829.0,"maturityDate":"2026-07-09","duration":"2 yr 11 mon","maturityAction":"","done":false},{"bank":"YES Mama","type":"FD - Regular Payout","depositId":"8541100052710","nominee":"Nitin","startDate":"2023-01-18","deposit":500000,"roi":0.0825,"maturityAmt":634414.0,"maturityDate":"2025-12-18","duration":"2 yr 11 mon","maturityAction":"","done":false},{"bank":"YES Mama","type":"FD - Regular Payout","depositId":"8541000025581","nominee":"Nitin","startDate":"2025-08-28","deposit":550000,"roi":0.0775,"maturityAmt":550000.0,"maturityDate":"2028-08-28","duration":"2 years","maturityAction":"","done":false},{"bank":"YES Mama","type":"FD - Regular Payout","depositId":"8541100063253","nominee":"Nitin","startDate":"2024-12-17","deposit":700000,"roi":0.085,"maturityAmt":700000.0,"maturityDate":"2026-08-02","duration":"18 months","maturityAction":"","done":false},{"bank":"IOB - Meena","type":"SLRDP - SARAL REINVESTMENT DEPOSIT PLAN","depositId":"144504000036322","nominee":"Nitin Kumar","startDate":"2025-07-09","deposit":1200000,"roi":0.0745,"maturityAmt":1193452.0,"maturityDate":"2026-09-26","duration":"NETBANKING - 444 days","maturityAction":"","done":false},{"bank":"IOB - Meena & Ramendra","type":"FDR-Branch","depositId":"144504211500178","nominee":"Nimesh - 90488","startDate":"2025-06-03","deposit":20170,"roi":0.074,"maturityAmt":20170.0,"maturityDate":"2027-05-03","duration":"BRANCH - For Locker- HY Int Rs 806/- ","maturityAction":"","done":false},{"bank":"IOB - Meena & Nimesh","type":"SLRDP - SARAL REINVESTMENT DEPOSIT PLAN","depositId":"144504000035245","nominee":"Nitin Kumar","startDate":"2025-04-07","deposit":1000000,"roi":0.078,"maturityAmt":1098549.0,"maturityDate":"","duration":"NETBANKING - 444 days","maturityAction":"","done":false},{"bank":"SCSS Mama(ICICI)","type":"SCSS","depositId":"SCSS0029708","nominee":"Int in apr 25","startDate":"2019-05-28","deposit":300000,"roi":0.082,"maturityAmt":"","maturityDate":"2027-05-28","duration":"96 months","maturityAction":"","done":false},{"bank":"SCSS Mama(ICICI)","type":"SCSS","depositId":"SCSS0051118","nominee":"Int in apr 25","startDate":"2021-01-01","deposit":800000,"roi":0.074,"maturityAmt":"","maturityDate":"2026-01-01","duration":"60 months","maturityAction":"","done":false},{"bank":"Canara Bank","type":"KAMADHENU DEPOSIT SENIOR CITIZEN","depositId":"140022724762-1","nominee":"Nitin-154533788","startDate":"2021-09-04","deposit":500000,"roi":0.056,"maturityAmt":558821.0,"maturityDate":"2023-09-04","duration":"24 months","maturityAction":"","done":false},{"bank":"ICICI","type":"Fixed Deposit","depositId":"157713008008","nominee":"","startDate":"2023-04-25","deposit":642225,"roi":0.075,"maturityAmt":648961.0,"maturityDate":"2025-05-05","duration":"24 months 10 days","maturityAction":"","done":false},{"bank":"PO Sec 37","type":"Term Deposit","depositId":"","nominee":"","startDate":"2018-04-10","deposit":"","roi":"","maturityAmt":"","maturityDate":"2021-04-10","duration":"Int - 35,403/year","maturityAction":"","done":false},{"bank":"Canara Bank","type":"Syndicate - VCC(Vikas cash certificate)","depositId":"87784050088870-2","nominee":"","startDate":"2020-08-31","deposit":83686,"roi":0.058,"maturityAmt":111607.01,"maturityDate":"2025-08-31","duration":"5 yrs FD","maturityAction":"","done":false},{"bank":"Canara Bank","type":"Syndicate - VCC(Vikas cash certificate)","depositId":"87784050088883-2","nominee":"","startDate":"2020-08-27","deposit":83678,"roi":0.058,"maturityAmt":111597.36,"maturityDate":"2025-08-27","duration":"5 yrs FD","maturityAction":"","done":false},{"bank":"Canara Bank","type":"CANARA 444- KDR SRCTZN","depositId":"140100217065","nominee":"","startDate":"2023-06-02","deposit":500000,"roi":0.0775,"maturityAmt":548947.0,"maturityDate":"2024-08-19","duration":"444 days","maturityAction":"","done":false},{"bank":"SCSS Papa(UBI)","type":"SCSS","depositId":"A/c no - 123","nominee":"","startDate":"","deposit":"","roi":"","maturityAmt":"","maturityDate":"2020-10-15","duration":"","maturityAction":"","done":false},{"bank":"SCSS Papa(UBI)","type":"SCSS","depositId":"A/c no - 145","nominee":"","startDate":"","deposit":"","roi":"","maturityAmt":"","maturityDate":"2020-12-04","duration":"","maturityAction":"","done":false},{"bank":"Canara Bank - Papa","type":"KAMADHENU DEPOSIT SENIOR CITIZEN","depositId":"140021752541-2","nominee":"Nimesh-1000043581175","startDate":"2023-08-27","deposit":"","roi":0.074,"maturityAmt":590197.0,"maturityDate":"2024-08-27","duration":"12 months","maturityAction":"","done":false},{"bank":"Canara Bank - Papa","type":"KAMADHENU DEPOSIT SENIOR CITIZEN","depositId":"140020978300-2","nominee":"Nimesh-1000043622625","startDate":"2023-08-21","deposit":"","roi":0.074,"maturityAmt":590254.0,"maturityDate":"2024-08-21","duration":"12 months","maturityAction":"","done":false},{"bank":"SCSS Mama(UBI)","type":"SCSS","depositId":"A/c no - 127","nominee":"","startDate":"2020-10-20","deposit":"","roi":"","maturityAmt":"","maturityDate":"2023-10-20","duration":"","maturityAction":"","done":false},{"bank":"SCSS Mama(UBI)","type":"SCSS","depositId":"A/c no - 144","nominee":"","startDate":"2020-10-20","deposit":"","roi":"","maturityAmt":"","maturityDate":"2023-12-04","duration":"","maturityAction":"","done":false},{"bank":"YES Mama with Papa","type":"FD - Regular Payout","depositId":"8541000010870","nominee":"Joint with Papa","startDate":"2017-11-11","deposit":100000,"roi":0.0725,"maturityAmt":100000.0,"maturityDate":"2027-11-11","duration":"10 years","maturityAction":"","done":false},{"bank":"YES Mama with Papa","type":"FD - Regular Payout","depositId":"8541100046971","nominee":"Joint with Papa","startDate":"2021-11-02","deposit":500000,"roi":0.07,"maturityAmt":615858.0,"maturityDate":"2024-11-03","duration":"3 years & 1 day","maturityAction":"","done":false}],"accounts":[{"bank":"Canara Bank","type":"Saving","holders":"MRS MEENA KUMAR","amount":100.0,"roi":"","online":"Yes","address":"NOIDA(Morna) 18778","detail":"cust - 200047216","nextAction":"Check Mama DOB","done":false},{"bank":"Canara Bank","type":"FD","holders":"Papa, Mama","amount":2000000.0,"roi":0.0775,"online":"Yes","address":"NOIDA(Morna) 18778","detail":"A/C - 90552030000564","nextAction":"6Feb2026 - Mature","done":false},{"bank":"ICICI Bank","type":"Saving","holders":"Mama, Nimesh","amount":300.0,"roi":0.03,"online":"Yes","address":"NOIDA Sec 30","detail":"a/c - 157701001329","nextAction":"","done":false},{"bank":"ICICI Bank","type":"FD","holders":"Mama, Nimesh","amount":15000000.0,"roi":0.075,"online":"Yes","address":"NOIDA Sec 30","detail":"6 FDs","nextAction":"Aug 2025 - Mature","done":false},{"bank":"SBI","type":"Saving","holders":"Mama, Nimesh","amount":6600.0,"roi":0.027,"online":"Yes","address":"A/C - 42261006376","detail":"CIF - 9129 5683548","nextAction":"","done":false},{"bank":"SBI","type":"FD","holders":"Mama, Nimesh","amount":"","roi":0.076,"online":"No","address":"","detail":"","nextAction":"22Jan2025 - Mature","done":false},{"bank":"Yes Bank","type":"Saving","holders":"Mama, Nimesh","amount":"","roi":0.06,"online":"Yes","address":"ATTA, NOIDA","detail":"","nextAction":"","done":false},{"bank":"Yes Bank","type":"FD","holders":"Mama, Nimesh","amount":"","roi":0.08,"online":"Yes","address":"ATTA, NOIDA","detail":"3 FDs","nextAction":"Aug 2025 - Mature","done":false},{"bank":"REC Bonds","type":"FD","holders":"Mama","amount":22.0,"roi":0.05,"online":"No","address":"","detail":"","nextAction":"Aug-2027 - Mature","done":false},{"bank":"Indian Overseas Bank","type":"Saving","holders":"Mama, Nimesh","amount":333.0,"roi":0.0275,"online":"Yes","address":"Sec 29, AVCC","detail":"A/c-144501000013605","nextAction":"","done":false},{"bank":"Indian Overseas Bank","type":"FD","holders":"Mama, Nimesh","amount":220000.0,"roi":0.0745,"online":"Yes","address":"Sec 29, AVCC","detail":"4 FDs","nextAction":"","done":false},{"bank":"PO Sec 37 - Book 4B ?","type":"Saving","holders":"Mama, Papa","amount":232323.0,"roi":"","online":"No","address":"PO Sec 37","detail":"A/c no - 9440711374","nextAction":"","done":false},{"bank":"PO Sec 37 - Book 2 ?","type":"RD","holders":"Mama, Papa","amount":232323.0,"roi":"","online":"No","address":"PO Sec 37","detail":"A/c no - 9440711374","nextAction":"One FD - Nov 2022","done":false},{"bank":"PPF Mama - Book 6","type":"PPF","holders":"Mama","amount":222.0,"roi":0.071,"online":"No","address":"PO Sec 37, Noida","detail":"A/c no - 9440724475","nextAction":"Maturity - 31 Mar 26","done":false},{"bank":"SCSS Mama(ICICI) - SCSS0051118","type":"SCSS","holders":"Mama","amount":2222.0,"roi":0.074,"online":"No","address":"","detail":"SCSS0051118","nextAction":"Maturity - 01 Jan 26","done":false},{"bank":"SCSS Mama(ICICI) - SCSS0029708","type":"SCSS","holders":"Mama","amount":7777.0,"roi":0.082,"online":"No","address":"","detail":"SCSS0029708","nextAction":"Maturity - 28 May 27","done":false},{"bank":"SCSS Mama(ICICI)","type":"SCSS","holders":"Mama","amount":300000.0,"roi":0.087,"online":"No","address":"","detail":"SCSS0029708","nextAction":"Maturity - 28 May 24","done":false}],"bills":[{"name":"Airtel Internet","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"9810252747","email":"","done":false},{"name":"Jio Mobile","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"xxxxxx2037","email":"","done":false},{"name":"Airtel Mobile","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"9810252747","email":"","done":false},{"name":"AVI Membership","freq":"Yearly","amount":"","due":"","priority":"Normal","phone":"","email":"","done":false},{"name":"Car Insurance","freq":"Yearly","amount":"","due":"","priority":"Normal","phone":"","email":"","done":false},{"name":"Water","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"","email":"","done":false},{"name":"Society Ram Vihar","freq":"Yearly","amount":"","due":"","priority":"Normal","phone":"","email":"","done":false},{"name":"Gas","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"","email":"","done":false},{"name":"ICICI CC","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"xxxxxx2037","email":"","done":false},{"name":"Yes CC","freq":"Monthly","amount":"","due":"","priority":"Normal","phone":"9810252747","email":"rxxxxxxxxxgmail.com","done":false},{"name":"Elec Bill","freq":"Monthly","amount":2000.0,"due":"3rd of month","priority":"High","phone":"xxxxxx2037","email":"rxxxxxxxxxgmail.com","done":false}],"actions":[]};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0,0,0,0);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function fmt(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 10000000) return "₹" + (v/10000000).toFixed(2) + " Cr";
  if (v >= 100000)  return "₹" + (v/100000).toFixed(2) + " L";
  return "₹" + v.toLocaleString("en-IN");
}
function fmtFull(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}
function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function toISO(val) {
  if (!val) return "";
  if (val instanceof Date) return isNaN(val) ? "" : val.toISOString().split("T")[0];
  if (typeof val === "number") {
    const d = new Date(Math.round((val-25569)*86400*1000));
    return isNaN(d) ? "" : d.toISOString().split("T")[0];
  }
  const d = new Date(val);
  return isNaN(d) ? "" : d.toISOString().split("T")[0];
}
function monthsBetween(start, end) {
  return (end.getFullYear()-start.getFullYear())*12 + (end.getMonth()-start.getMonth());
}

const PALETTE = ["#F97316","#10B981","#3B82F6","#8B5CF6","#EC4899","#F59E0B","#06B6D4","#EF4444","#84CC16","#A78BFA","#FB923C","#34D399"];
const bankColorMap = {};
function getBankColor(bank) {
  if (!bank) return "#6B7280";
  if (!bankColorMap[bank]) bankColorMap[bank] = PALETTE[Object.keys(bankColorMap).length % PALETTE.length];
  return bankColorMap[bank];
}

function UrgencyBadge({ days }) {
  if (days === null) return <span style={bs("#1F2937","#6B7280")}>No Date</span>;
  if (days < 0)   return <span style={bs("#1F2937","#4B5563")}>Matured</span>;
  if (days === 0) return <span style={bs("#7F1D1D","#FCA5A5")}>TODAY!</span>;
  if (days <= 30) return <span style={bs("#7F1D1D","#FCA5A5")}>🔴 {days}d</span>;
  if (days <= 90) return <span style={bs("#78350F","#FCD34D")}>🟡 {days}d</span>;
  if (days <= 180) return <span style={bs("#064E3B","#6EE7B7")}>🟢 {days}d</span>;
  return <span style={bs("#1E3A5F","#93C5FD")}>{days}d</span>;
}
function bs(bg,color){ return { background:bg, color, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }; }

const emptyDeposit  = { bank:"", type:"Fixed Deposit", depositId:"", nominee:"", startDate:"", deposit:"", roi:"", maturityAmt:"", maturityDate:"", duration:"", maturityAction:"", done:false };
const emptyAccount  = { bank:"", type:"Saving", holders:"", amount:"", roi:"", online:"Yes", address:"", detail:"", nextAction:"", done:false };
const emptyBill     = { name:"", freq:"Monthly", amount:"", due:"", priority:"Normal", phone:"", email:"", done:false };
const emptyAction   = { title:"", bank:"", date:"", note:"", done:false };

const inputSt = { background:"#0D1117", border:"1px solid #374151", color:"#F9FAFB", borderRadius:8, padding:"8px 12px", fontSize:13, width:"100%", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const labelSt = { fontSize:11, color:"#9CA3AF", fontWeight:600, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 };

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BankDashboard() {
  const [deposits, setDeposits]   = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [bills, setBills]         = useState([]);
  const [actions, setActions]     = useState([]);
  const [tab, setTab]             = useState("overview");
  const [loading, setLoading]     = useState(true);
  const [savedMsg, setSavedMsg]   = useState(false);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({});
  const [filterBank, setFilterBank] = useState("All");
  const [search, setSearch]       = useState("");
  const [showDone, setShowDone]   = useState(false);
  const fileRef = useRef();

  // ── Storage ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("bank-records-v3");
        if (r?.value) {
          const data = JSON.parse(r.value);
          setDeposits(data.deposits||[]);
          setAccounts(data.accounts||[]);
          setBills(data.bills||[]);
          setActions(data.actions||[]);
        } else {
          // Seed with pre-loaded Excel data on first launch
          setDeposits(PRELOAD_DATA.deposits);
          setAccounts(PRELOAD_DATA.accounts);
          setBills(PRELOAD_DATA.bills);
          setActions([]);
          await window.storage.set("bank-records-v3", JSON.stringify(PRELOAD_DATA));
        }
      } catch(_) {
        // Fallback: just load preload data without storage
        setDeposits(PRELOAD_DATA.deposits);
        setAccounts(PRELOAD_DATA.accounts);
        setBills(PRELOAD_DATA.bills);
        setActions([]);
      }
      setLoading(false);
    })();
  }, []);

  async function persist(deps,accs,bls,acts) {
    try {
      await window.storage.set("bank-records-v3", JSON.stringify({ deposits:deps, accounts:accs, bills:bls, actions:acts }));
      setSavedMsg(true); setTimeout(()=>setSavedMsg(false),2000);
    } catch(_) {}
  }
  function save(deps,accs,bls,acts) {
    setDeposits(deps); setAccounts(accs); setBills(bls); setActions(acts);
    persist(deps,accs,bls,acts);
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  async function handleExcel(file) {
    const { read, utils } = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
    const buf = await file.arrayBuffer();
    const wb = read(buf, { type:"array", cellDates:true });
    let nDeps=[],nAccs=[],nBills=[];

    if (wb.SheetNames.includes("Deposits")) {
      const rows = utils.sheet_to_json(wb.Sheets["Deposits"], { header:1, defval:null });
      const hIdx = rows.findIndex(r=>r&&r.includes("Bank")&&r.includes("Type")&&(r.includes("Deposit")||r.includes("Deposit ID")));
      if (hIdx>=0) {
        const h=rows[hIdx], col=n=>h.findIndex(x=>x&&x.toString().toLowerCase().includes(n.toLowerCase()));
        const [cB,cT,cI,cN,cS,cD,cR,cM,cMD,cDu,cA]=[col("Bank"),col("Type"),col("Deposit ID"),col("Nominee"),col("Start"),col("Deposit"),col("ROI"),col("Maturity Amount"),col("Maturity Date"),col("Duration"),col("Maturity")];
        for(let i=hIdx+1;i<rows.length;i++){
          const r=rows[i]; if(!r||!r[cB]) continue;
          const bank=r[cB]?.toString().trim(); if(!bank||bank==="Row Labels") continue;
          nDeps.push({ bank, type:r[cT]||"Fixed Deposit", depositId:r[cI]?.toString()||"", nominee:r[cN]?.toString()||"", startDate:toISO(r[cS]), deposit:r[cD]||"", roi:r[cR]||"", maturityAmt:r[cM]||"", maturityDate:toISO(r[cMD]), duration:r[cDu]?.toString()||"", maturityAction:r[cA]?.toString()||"", done:false });
        }
      }
    }
    if (wb.SheetNames.includes("Banks")) {
      const rows = utils.sheet_to_json(wb.Sheets["Banks"], { header:1, defval:null });
      const hIdx = rows.findIndex(r=>r&&r.includes("Source"));
      if (hIdx>=0) {
        const h=rows[hIdx], col=n=>h.findIndex(x=>x&&x.toString().toLowerCase().includes(n.toLowerCase()));
        const [cS,cA,cT,cN1,cN2,cOl,cAc,cR,cAd,cDe,cNx]=[col("Source"),col("Amount"),col("Type"),col("1st"),col("2nd"),col("Online"),col("Next"),col("ROI"),col("Address"),col("Details"),col("Misc")];
        for(let i=hIdx+1;i<rows.length;i++){
          const r=rows[i]; if(!r||!r[cS]) continue;
          const bank=r[cS]?.toString().trim(); if(!bank) continue;
          nAccs.push({ bank, type:r[cT]?.toString()||"Saving", holders:[r[cN1],r[cN2]].filter(Boolean).join(", "), amount:r[cA]||"", roi:r[cR]||"", online:r[cOl]?.toString()||"No", address:r[cAd]?.toString()||"", detail:r[cDe]?.toString()||"", nextAction:r[cAc]?.toString()||"", done:false });
        }
      }
    }
    if (wb.SheetNames.includes("Bills")) {
      const rows = utils.sheet_to_json(wb.Sheets["Bills"], { header:1, defval:null });
      const hIdx = rows.findIndex(r=>r&&r.includes("Name")&&r.includes("Frequency"));
      if (hIdx>=0) {
        const h=rows[hIdx], col=n=>h.findIndex(x=>x&&x.toString().toLowerCase().includes(n.toLowerCase()));
        const [cN,cF,cA,cD,cP,cPh,cE]=[col("Name"),col("Freq"),col("Amount"),col("Date"),col("Priority"),col("Phone"),col("Email")];
        for(let i=hIdx+1;i<rows.length;i++){
          const r=rows[i]; if(!r||!r[cN]) continue;
          nBills.push({ name:r[cN]?.toString().trim(), freq:r[cF]?.toString()||"Monthly", amount:r[cA]||"", due:r[cD]?.toString()||"", priority:r[cP]?.toString()||"Normal", phone:r[cPh]?.toString()||"", email:r[cE]?.toString()||"", done:false });
        }
      }
    }
    save(nDeps.length?nDeps:deposits, nAccs.length?nAccs:accounts, nBills.length?nBills:bills, actions);
    alert(`✅ Loaded: ${nDeps.length} deposits, ${nAccs.length} accounts, ${nBills.length} bills`);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function openAdd(type) { setForm({...(type==="deposit"?emptyDeposit:type==="account"?emptyAccount:type==="bill"?emptyBill:emptyAction)}); setModal({type,mode:"add"}); }
  function openEdit(type,idx) {
    const arr = type==="deposit"?deposits:type==="account"?accounts:type==="bill"?bills:actions;
    setForm({...arr[idx]}); setModal({type,mode:"edit",idx});
  }
  function deleteRow(type,idx) {
    if(!confirm("Delete this record?")) return;
    if(type==="deposit") save(deposits.filter((_,i)=>i!==idx),accounts,bills,actions);
    else if(type==="account") save(deposits,accounts.filter((_,i)=>i!==idx),bills,actions);
    else if(type==="bill") save(deposits,accounts,bills.filter((_,i)=>i!==idx),actions);
    else save(deposits,accounts,bills,actions.filter((_,i)=>i!==idx));
  }
  function saveModal() {
    const {type,mode,idx}=modal;
    if(type==="deposit"){ const d=[...deposits]; mode==="add"?d.push(form):d[idx]=form; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; mode==="add"?a.push(form):a[idx]=form; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; mode==="add"?b.push(form):b[idx]=form; save(deposits,accounts,b,actions); }
    else { const ac=[...actions]; mode==="add"?ac.push(form):ac[idx]=form; save(deposits,accounts,bills,ac); }
    setModal(null);
  }
  function toggleDone(type,idx) {
    if(type==="deposit"){ const d=[...deposits]; d[idx]={...d[idx],done:!d[idx].done}; save(d,accounts,bills,actions); }
    else if(type==="account"){ const a=[...accounts]; a[idx]={...a[idx],done:!a[idx].done}; save(deposits,a,bills,actions); }
    else if(type==="bill"){ const b=[...bills]; b[idx]={...b[idx],done:!b[idx].done}; save(deposits,accounts,b,actions); }
    else { const ac=[...actions]; ac[idx]={...ac[idx],done:!ac[idx].done}; save(deposits,accounts,bills,ac); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalInvested = deposits.reduce((s,d)=>s+(Number(d.deposit)||0),0);
  const totalMaturity = deposits.reduce((s,d)=>s+(Number(d.maturityAmt)||Number(d.deposit)||0),0);
  const upcoming90    = deposits.filter(d=>{ const x=daysUntil(d.maturityDate); return x!=null&&x>=0&&x<=90&&!d.done; });
  const sortedDeps    = [...deposits].sort((a,b)=>new Date(a.maturityDate||"2099")-new Date(b.maturityDate||"2099"));

  const bankTotals = {};
  deposits.forEach(d=>{
    if(!d.bank) return;
    if(!bankTotals[d.bank]) bankTotals[d.bank]={deposited:0,maturity:0,count:0};
    bankTotals[d.bank].deposited += Number(d.deposit)||0;
    bankTotals[d.bank].maturity  += Number(d.maturityAmt)||Number(d.deposit)||0;
    bankTotals[d.bank].count++;
  });

  // Pie data
  const pieData = Object.entries(bankTotals).map(([name,v])=>({ name, value:v.deposited, color:getBankColor(name) }));

  // ROI bar data
  const roiData = Object.entries(bankTotals).map(([bank])=>{
    const bDeps = deposits.filter(d=>d.bank===bank&&d.roi);
    const avg = bDeps.length ? bDeps.reduce((s,d)=>s+(Number(d.roi)||0),0)/bDeps.length : 0;
    return { bank: bank.length>10?bank.slice(0,10)+"…":bank, roi: parseFloat((avg*100).toFixed(2)), color:getBankColor(bank) };
  }).filter(x=>x.roi>0);

  // Monthly maturity area chart data
  const matMonths = {};
  deposits.forEach(d=>{
    if(!d.maturityDate) return;
    const dt = new Date(d.maturityDate);
    if(isNaN(dt)) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
    if(!matMonths[key]) matMonths[key]={month:key,amount:0,count:0};
    matMonths[key].amount += Number(d.maturityAmt)||Number(d.deposit)||0;
    matMonths[key].count++;
  });
  const areaData = Object.entries(matMonths).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,18).map(([k,v])=>({
    month: k.slice(0,7), amount: Math.round(v.amount/100000), count: v.count
  }));

  // Type distribution
  const typeData = {};
  deposits.forEach(d=>{ const t=d.type||"Other"; typeData[t]=(typeData[t]||0)+(Number(d.deposit)||0); });
  const typePieData = Object.entries(typeData).map(([name,value],i)=>({ name, value, color:PALETTE[i%PALETTE.length] }));

  const banks = ["All",...Object.keys(bankTotals)];
  const filtered = sortedDeps.filter(d=>{
    const mb=filterBank==="All"||d.bank===filterBank;
    const ms=!search||[d.bank,d.depositId,d.nominee,d.type].join(" ").toLowerCase().includes(search.toLowerCase());
    return mb&&ms;
  });

  const allTabs = [
    {id:"overview",  label:"📊 Overview"},
    {id:"charts",    label:"📈 Charts"},
    {id:"timeline",  label:"📅 Timeline"},
    {id:"actions",   label:"⚡ Actions"},
    {id:"deposits",  label:"💰 Deposits"},
    {id:"accounts",  label:"🏦 Accounts"},
    {id:"bills",     label:"📋 Bills"},
  ];

  // ── Modal fields ──────────────────────────────────────────────────────────
  function ModalForm() {
    if(!modal) return null;
    const {type,mode}=modal;
    const fields = type==="deposit"?[
      {key:"bank",label:"Bank",ph:"e.g. ICICI"},{key:"type",label:"Type",ph:"Fixed Deposit"},
      {key:"depositId",label:"Deposit ID",ph:"FD / Account number"},{key:"nominee",label:"Nominee",ph:"Name"},
      {key:"startDate",label:"Start Date",type:"date"},{key:"deposit",label:"Deposit ₹",ph:"500000",type:"number"},
      {key:"roi",label:"ROI (decimal)",ph:"0.075",type:"number"},{key:"maturityAmt",label:"Maturity ₹",ph:"586000",type:"number"},
      {key:"maturityDate",label:"Maturity Date",type:"date"},{key:"duration",label:"Duration",ph:"24 months"},
      {key:"maturityAction",label:"On Maturity",ph:"Auto renew / Redeem"},
    ]:type==="account"?[
      {key:"bank",label:"Bank",ph:"SBI"},{key:"type",label:"Type",ph:"Saving / FD / PPF"},
      {key:"holders",label:"Holders",ph:"Names"},{key:"amount",label:"Balance ₹",ph:"10000",type:"number"},
      {key:"roi",label:"ROI",ph:"0.03",type:"number"},{key:"online",label:"Online?",ph:"Yes / No"},
      {key:"address",label:"Branch",ph:"Location"},{key:"detail",label:"Account No.",ph:"A/c details"},
      {key:"nextAction",label:"Next Action",ph:"e.g. Renew by March"},
    ]:type==="bill"?[
      {key:"name",label:"Bill Name",ph:"Electricity"},{key:"freq",label:"Frequency",ph:"Monthly / Yearly"},
      {key:"amount",label:"Amount ₹",ph:"2000",type:"number"},{key:"due",label:"Due Date",ph:"3rd of month"},
      {key:"priority",label:"Priority",ph:"High / Normal"},{key:"phone",label:"Phone",ph:"Contact"},
      {key:"email",label:"Email",ph:"Email"},
    ]:[
      {key:"title",label:"Action Title",ph:"e.g. Renew Canara FD"},{key:"bank",label:"Bank / Source",ph:"Bank name"},
      {key:"date",label:"Due Date",type:"date"},{key:"note",label:"Note",ph:"Details or instruction"},
    ];

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
        <div style={{background:"#1C1C2E",borderRadius:20,padding:28,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",border:"1px solid #374151"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
            <div style={{fontSize:17,fontWeight:800,color:"#F9FAFB"}}>{mode==="add"?"Add":"Edit"} {type.charAt(0).toUpperCase()+type.slice(1)}</div>
            <button onClick={()=>setModal(null)} style={{background:"#374151",color:"#9CA3AF",border:"none",borderRadius:8,padding:"3px 12px",cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {fields.map(f=>(
              <div key={f.key} style={{gridColumn:["bank","name","depositId","detail","nextAction","maturityAction","holders","address","title","note"].includes(f.key)?"1/-1":"auto"}}>
                <label style={labelSt}>{f.label}</label>
                <input type={f.type||"text"} placeholder={f.ph} value={form[f.key]??""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={inputSt} step={f.type==="number"?"any":undefined} />
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:12,marginTop:22,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={{background:"#374151",color:"#9CA3AF",border:"none",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Cancel</button>
            <button onClick={saveModal} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"9px 22px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:13}}>
              {mode==="add"?"Add Record":"Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && !deposits.length && !accounts.length && !bills.length) {
    return (
      <div style={{minHeight:"100vh",background:"#111827",color:"#F9FAFB",fontFamily:"'Sora','Segoe UI',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:32}}>
        <div style={{fontSize:52}}>🦁</div>
        <div style={{fontSize:24,fontWeight:800}}>Bank Records Dashboard</div>
        <div style={{color:"#6B7280",fontSize:14}}>No data yet. Load your Excel or add records manually.</div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>fileRef.current.click()} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:12,padding:"13px 26px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📂 Upload Excel</button>
          <button onClick={()=>openAdd("deposit")} style={{background:"#1C1C2E",color:"#F9FAFB",border:"1px solid #374151",borderRadius:12,padding:"13px 26px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✏️ Add First Deposit</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleExcel(e.target.files[0]);e.target.value="";}} />
        {modal && <ModalForm />}
      </div>
    );
  }

  const CustomTooltip = ({active,payload,label}) => {
    if(!active||!payload?.length) return null;
    return (
      <div style={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:10,padding:"10px 14px"}}>
        <div style={{color:"#9CA3AF",fontSize:12,marginBottom:4}}>{label}</div>
        {payload.map((p,i)=>(<div key={i} style={{color:p.color||"#F9FAFB",fontWeight:700,fontFamily:"monospace",fontSize:13}}>{p.name}: {p.value}{p.name==="roi"?"%":p.name==="amount"?" L":""}</div>))}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#0D1117",color:"#F9FAFB",fontFamily:"'Sora','Segoe UI',sans-serif",paddingBottom:48}}>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1C1C2E 0%,#16213E 55%,#0F3460 100%)",borderBottom:"1px solid #1F2937",padding:"18px 28px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontSize:26}}>🦁</span>
          <div>
            <div style={{fontSize:10,color:"#4B5563",letterSpacing:2,fontWeight:700,textTransform:"uppercase"}}>Leo Planner · Safe · Bank Records</div>
            <div style={{fontSize:19,fontWeight:800,color:"#F9FAFB",letterSpacing:"-0.5px"}}>Financial Dashboard</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            {savedMsg && <span style={{color:"#34D399",fontSize:12,fontWeight:700,animation:"fadeIn 0.3s"}}>✅ Saved</span>}
            <button onClick={()=>fileRef.current.click()} style={{background:"#1D4ED8",color:"#fff",border:"none",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📂 Excel</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleExcel(e.target.files[0]);e.target.value="";}} />
            <div style={{background:"#0F3460",border:"1px solid #1E40AF",borderRadius:8,padding:"5px 12px",fontSize:11,color:"#93C5FD"}}>🔒 {today.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:1,marginTop:14,overflowX:"auto"}}>
          {allTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:tab===t.id?"rgba(29,78,216,0.3)":"transparent",
              color:tab===t.id?"#60A5FA":"#6B7280",
              border:"none",borderBottom:tab===t.id?"2px solid #3B82F6":"2px solid transparent",
              padding:"9px 16px",borderRadius:"7px 7px 0 0",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap",transition:"all 0.15s"
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"22px 28px"}}>

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab==="overview" && (
          <div>
            {upcoming90.length>0 && (
              <div style={{background:"linear-gradient(90deg,#7F1D1D,#991B1B)",border:"1px solid #DC2626",borderRadius:12,padding:"13px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:20}}>🚨</span>
                <div>
                  <strong style={{color:"#FCA5A5"}}>{upcoming90.length} deposit{upcoming90.length>1?"s":""} maturing within 90 days!</strong>
                  <div style={{color:"#FCA5A5",fontSize:12,marginTop:2}}>{upcoming90.map(d=>`${d.bank} (${fmtDate(d.maturityDate)})`).join(" · ")}</div>
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
              {[
                {label:"Total Invested",   value:fmt(totalInvested),    full:fmtFull(totalInvested),   sub:`${deposits.length} deposits`, accent:"#3B82F6", icon:"💼"},
                {label:"At Maturity",      value:fmt(totalMaturity),    full:fmtFull(totalMaturity),   sub:"projected value",             accent:"#10B981", icon:"📈"},
                {label:"Total Gain",       value:fmt(totalMaturity-totalInvested), full:fmtFull(totalMaturity-totalInvested), sub: totalInvested?`+${(((totalMaturity-totalInvested)/totalInvested)*100).toFixed(1)}%`:"", accent:"#F59E0B", icon:"💰"},
                {label:"Due ≤90 Days",     value:upcoming90.length,     sub:upcoming90.length?"Needs attention":"All clear", accent:upcoming90.length?"#EF4444":"#10B981", icon:upcoming90.length?"⚠️":"✅"},
                {label:"Active Accounts",  value:accounts.length,       sub:`${bills.length} bills tracked`, accent:"#8B5CF6", icon:"🏦"},
              ].map(c=>(
                <div key={c.label} title={c.full||""} style={{background:"#1C1C2E",borderRadius:14,padding:"16px 20px",borderLeft:`3px solid ${c.accent}`,flex:1,minWidth:140,cursor:"default"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{color:"#6B7280",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{c.label}</div>
                    <span style={{fontSize:18}}>{c.icon}</span>
                  </div>
                  <div style={{color:"#F9FAFB",fontSize:20,fontWeight:800,fontFamily:"monospace",marginTop:6}}>{c.value}</div>
                  {c.sub&&<div style={{color:"#4B5563",fontSize:11,marginTop:4}}>{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Quick upcoming + allocation */}
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16,marginBottom:16}}>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:16}}>⏳ Next Maturities</div>
                {sortedDeps.filter(d=>daysUntil(d.maturityDate)>=0).slice(0,6).map((d,i)=>{
                  const days=daysUntil(d.maturityDate);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:7,background:days<=90?"rgba(239,68,68,0.07)":days<=180?"rgba(245,158,11,0.05)":"#0D1117",borderRadius:10,border:`1px solid ${days<=90?"#7F1D1D":days<=180?"#78350F":"#1F2937"}`}}>
                      <div style={{width:4,height:32,borderRadius:4,background:getBankColor(d.bank),flexShrink:0}} />
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#F3F4F6"}}>{d.bank}</div>
                        <div style={{fontSize:10,color:"#6B7280"}}>{fmtDate(d.maturityDate)} · {d.nominee}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,fontWeight:700,fontFamily:"monospace",color:"#10B981"}}>{fmt(d.maturityAmt||d.deposit)}</div>
                        <UrgencyBadge days={days} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mini Pie */}
              <div style={{background:"#1C1C2E",borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:8}}>🥧 Bank Allocation</div>
                {pieData.length===0 ? <div style={{color:"#4B5563",fontSize:13,marginTop:30,textAlign:"center"}}>No data</div> : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((e,i)=><Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v)=>fmt(v)} contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
                      {pieData.slice(0,6).map((e,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:e.color}} />
                          <span style={{color:"#9CA3AF"}}>{e.name.length>8?e.name.slice(0,8)+"…":e.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions needing attention */}
            {[...deposits.filter(d=>d.nextAction||d.maturityAction),...accounts.filter(a=>a.nextAction)].filter(x=>!x.done).length>0 && (
              <div style={{background:"#1C1C2E",borderRadius:14,padding:20}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:14}}>⚡ Pending Actions</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {deposits.filter(d=>(d.maturityAction||d.nextAction)&&!d.done).slice(0,6).map((d,i)=>(
                    <div key={i} style={{background:"#0D1117",border:"1px solid #374151",borderRadius:10,padding:"10px 14px",fontSize:12,flex:1,minWidth:200}}>
                      <div style={{color:getBankColor(d.bank),fontWeight:700}}>{d.bank}</div>
                      <div style={{color:"#D1D5DB",marginTop:2}}>{d.maturityAction||d.nextAction}</div>
                      <div style={{color:"#6B7280",fontSize:11,marginTop:4}}>{fmtDate(d.maturityDate)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CHARTS ════════════════════════════════════════════════════════ */}
        {tab==="charts" && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Row 1: two pies */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>🥧 Investment by Bank</div>
                <div style={{fontSize:12,color:"#4B5563",marginBottom:12}}>Donut shows share of total corpus</div>
                {pieData.length===0?<div style={{color:"#4B5563",padding:40,textAlign:"center"}}>No data</div>:(
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={({name,percent})=>`${name.slice(0,6)} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {pieData.map((e,i)=><Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip formatter={(v)=>fmtFull(v)} contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
                      {pieData.map((e,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"#0D1117",padding:"4px 10px",borderRadius:20}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:e.color}} />
                          <span style={{color:"#D1D5DB"}}>{e.name}</span>
                          <span style={{color:e.color,fontWeight:700,fontFamily:"monospace"}}>{fmt(e.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>🍕 By Deposit Type</div>
                <div style={{fontSize:12,color:"#4B5563",marginBottom:12}}>FD vs SCSS vs PPF etc.</div>
                {typePieData.length===0?<div style={{color:"#4B5563",padding:40,textAlign:"center"}}>No data</div>:(
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={typePieData} cx="50%" cy="50%" outerRadius={95} paddingAngle={3} dataKey="value" label={({name,percent})=>`${name.slice(0,8)} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {typePieData.map((e,i)=><Cell key={i} fill={e.color} stroke="#111827" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip formatter={(v)=>fmtFull(v)} contentStyle={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:8,fontSize:12}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
                      {typePieData.map((e,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"#0D1117",padding:"4px 10px",borderRadius:20}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:e.color}} />
                          <span style={{color:"#D1D5DB"}}>{e.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ROI bar */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📊 Average ROI by Bank (%)</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>Higher bar = better returns</div>
              {roiData.length===0?<div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No ROI data</div>:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={roiData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="bank" tick={{fill:"#9CA3AF",fontSize:11}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="roi" name="roi" radius={[6,6,0,0]}>
                      {roiData.map((e,i)=><Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Maturity area */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>📉 Maturity Cash Flow (Lakhs)</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>When money becomes available month by month</div>
              {areaData.length===0?<div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No maturity dates</div>:(
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="matGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="month" tick={{fill:"#6B7280",fontSize:10}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v+"L"} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="amount" name="amount" stroke="#3B82F6" fill="url(#matGrad)" strokeWidth={2} dot={{fill:"#3B82F6",r:4}} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Invested vs Maturity grouped bar */}
            <div style={{background:"#1C1C2E",borderRadius:14,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>💹 Invested vs Maturity by Bank</div>
              <div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>Gap between bars = total gain per bank</div>
              {Object.keys(bankTotals).length===0?<div style={{color:"#4B5563",padding:20,textAlign:"center"}}>No data</div>:(()=>{
                const data=Object.entries(bankTotals).map(([bank,v])=>({
                  bank:bank.length>8?bank.slice(0,8)+"…":bank,
                  invested:Math.round(v.deposited/100000),
                  maturity:Math.round(v.maturity/100000),
                  color:getBankColor(bank)
                }));
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data} barGap={4} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="bank" tick={{fill:"#9CA3AF",fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:"#6B7280",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v+"L"} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{fontSize:12,color:"#9CA3AF"}} />
                      <Bar dataKey="invested" name="Invested" fill="#3B82F6" radius={[4,4,0,0]} opacity={0.7} />
                      <Bar dataKey="maturity" name="At Maturity" fill="#10B981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══ TIMELINE ══════════════════════════════════════════════════════ */}
        {tab==="timeline" && (
          <div>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,flexWrap:"wrap"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB"}}>📅 Maturity Timeline</div>
              <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#9CA3AF"}}>
                  <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
              </div>
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
              {[["🔴","≤30 days","#7F1D1D"],["🟡","31–90 days","#78350F"],["🟢","91–180 days","#064E3B"],["🔵",">180 days","#1E3A5F"],["⬜","Matured","#1F2937"]].map(([icon,label,bg])=>(
                <div key={label} style={{background:bg,borderRadius:20,padding:"4px 12px",fontSize:11,color:"#D1D5DB",fontWeight:600}}>{icon} {label}</div>
              ))}
            </div>

            <div style={{background:"#1C1C2E",borderRadius:16,padding:24,position:"relative"}}>
              <div style={{position:"absolute",left:130,top:24,bottom:24,width:2,background:"#1F2937",zIndex:0}} />
              {sortedDeps.length===0 && <div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No deposits to show</div>}
              {sortedDeps.filter(d=>showDone||!d.done).map((d,i)=>{
                const origIdx=deposits.indexOf(d);
                const days=daysUntil(d.maturityDate);
                const isPast=days!==null&&days<0;
                const isDone=d.done;
                const color=getBankColor(d.bank);
                const dotColor=isDone?"#34D399":isPast?"#374151":color;
                const rowBg=isDone?"rgba(52,211,153,0.05)":isPast?"rgba(55,65,81,0.1)":days!=null&&days<=90?"rgba(239,68,68,0.06)":days!=null&&days<=180?"rgba(245,158,11,0.04)":"transparent";
                return (
                  <div key={i} style={{display:"flex",gap:16,marginBottom:14,opacity:isDone?0.5:isPast?0.45:1,position:"relative",zIndex:1,transition:"opacity 0.3s"}}>
                    {/* Date column */}
                    <div style={{width:116,textAlign:"right",flexShrink:0,paddingTop:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:isDone?"#34D399":isPast?"#4B5563":"#9CA3AF"}}>
                        {d.maturityDate?new Date(d.maturityDate).toLocaleDateString("en-IN",{month:"short",year:"numeric"}):"—"}
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:isDone?"#34D399":isPast?"#4B5563":"#F9FAFB"}}>
                        {d.maturityDate?new Date(d.maturityDate).getDate():""}
                      </div>
                    </div>
                    {/* Dot */}
                    <div style={{display:"flex",alignItems:"flex-start",paddingTop:12,flexShrink:0}}>
                      <div style={{width:14,height:14,borderRadius:"50%",background:dotColor,border:`2px solid ${dotColor}`,boxShadow:isDone?`0 0 10px #34D39960`:isPast?"none":`0 0 8px ${color}50`,transition:"all 0.3s"}} />
                    </div>
                    {/* Card */}
                    <div style={{flex:1,background:rowBg,border:`1px solid ${isDone?"#064E3B":isPast?"#1F2937":days!=null&&days<=90?"#7F1D1D":"#1F2937"}`,borderRadius:14,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,transition:"all 0.3s"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontWeight:800,color:isDone?"#6EE7B7":"#F3F4F6",fontSize:14,textDecoration:isDone?"line-through":"none"}}>{d.bank}</span>
                          <span style={{fontSize:11,color:"#6B7280",background:"#0D1117",padding:"2px 8px",borderRadius:20}}>{d.type}</span>
                          {isDone && <span style={{fontSize:11,color:"#34D399",fontWeight:700}}>✓ Done</span>}
                        </div>
                        <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>{d.nominee} {d.roi?`· ${(Number(d.roi)*100).toFixed(2)}% pa`:""} {d.duration?`· ${d.duration}`:""}</div>
                        {d.maturityAction&&<div style={{fontSize:11,color:"#4B5563",marginTop:3,fontStyle:"italic"}}>{d.maturityAction}</div>}
                        {d.depositId&&<div style={{fontSize:10,color:"#374151",marginTop:2,fontFamily:"monospace"}}>{d.depositId}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        <div style={{fontFamily:"monospace",fontWeight:800,fontSize:15,color:isDone?"#6B7280":isPast?"#6B7280":"#10B981"}}>{fmt(d.maturityAmt||d.deposit)}</div>
                        {!isDone&&<UrgencyBadge days={days} />}
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>toggleDone("deposit",origIdx)} title={isDone?"Mark as pending":"Mark as handled"} style={{
                            background:isDone?"#064E3B":"#1C1C2E",color:isDone?"#34D399":"#9CA3AF",
                            border:`1px solid ${isDone?"#065F46":"#374151"}`,borderRadius:7,
                            padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700,transition:"all 0.2s"
                          }}>{isDone?"↩ Undo":"✓ Done"}</button>
                          <button onClick={()=>openEdit("deposit",origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ACTIONS ═══════════════════════════════════════════════════════ */}
        {tab==="actions" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB"}}>⚡ Action Items</div>
                <div style={{fontSize:12,color:"#4B5563",marginTop:2}}>Track anything you need to do — renewals, visits, calls</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#9CA3AF"}}>
                  <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{accentColor:"#3B82F6"}} />
                  Show completed
                </label>
                <button onClick={()=>openAdd("action")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Action</button>
              </div>
            </div>

            {/* Auto-generated from deposits needing action */}
            {deposits.filter(d=>d.maturityAction&&!d.done&&daysUntil(d.maturityDate)!=null&&daysUntil(d.maturityDate)<=180).length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6B7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🤖 Auto-detected from Deposits</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                  {deposits.filter(d=>d.maturityAction&&!d.done&&daysUntil(d.maturityDate)!=null&&daysUntil(d.maturityDate)<=180).map((d,i)=>{
                    const origIdx=deposits.indexOf(d);
                    const days=daysUntil(d.maturityDate);
                    return (
                      <div key={i} style={{background:"#1C1C2E",border:`1px solid ${days<=30?"#7F1D1D":days<=90?"#78350F":"#374151"}`,borderRadius:12,padding:"14px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{width:4,height:36,borderRadius:4,background:getBankColor(d.bank),marginRight:10,flexShrink:0}} />
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,color:"#F3F4F6",fontSize:13}}>{d.bank}</div>
                            <div style={{fontSize:12,color:"#D1D5DB",marginTop:3}}>{d.maturityAction}</div>
                            <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>{fmtDate(d.maturityDate)} · {fmt(d.maturityAmt||d.deposit)}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                            <UrgencyBadge days={days} />
                            <button onClick={()=>toggleDone("deposit",origIdx)} style={{background:"#064E3B",color:"#34D399",border:"1px solid #065F46",borderRadius:7,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✓ Done</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Accounts needing action */}
            {accounts.filter(a=>a.nextAction&&!a.done).length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"#6B7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🏦 Account Actions</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                  {accounts.filter(a=>a.nextAction&&!a.done).map((a,i)=>{
                    const origIdx=accounts.indexOf(a);
                    return (
                      <div key={i} style={{background:"#1C1C2E",border:"1px solid #374151",borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:700,color:getBankColor(a.bank),fontSize:13}}>{a.bank} <span style={{color:"#6B7280",fontWeight:400,fontSize:11}}>({a.type})</span></div>
                          <div style={{fontSize:12,color:"#D1D5DB",marginTop:3}}>{a.nextAction}</div>
                        </div>
                        <button onClick={()=>toggleDone("account",origIdx)} style={{background:"#064E3B",color:"#34D399",border:"1px solid #065F46",borderRadius:7,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700,marginLeft:10}}>✓ Done</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual actions */}
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#6B7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>📝 Manual Actions</div>
              {actions.filter(a=>showDone||!a.done).length===0 ? (
                <div style={{background:"#1C1C2E",borderRadius:12,padding:32,textAlign:"center",color:"#4B5563",border:"1px dashed #374151"}}>
                  No manual actions yet — click "+ Add Action" to create one
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {actions.filter(a=>showDone||!a.done).map((a,i)=>{
                    const origIdx=actions.indexOf(a);
                    const days=daysUntil(a.date);
                    return (
                      <div key={i} style={{background:"#1C1C2E",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,border:`1px solid ${a.done?"#064E3B":days!=null&&days<=30?"#7F1D1D":"#1F2937"}`,opacity:a.done?0.6:1,transition:"opacity 0.3s"}}>
                        <button onClick={()=>toggleDone("action",origIdx)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${a.done?"#34D399":"#374151"}`,background:a.done?"#064E3B":"transparent",color:"#34D399",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13}}>
                          {a.done?"✓":""}
                        </button>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,color:a.done?"#6B7280":"#F3F4F6",textDecoration:a.done?"line-through":"none",fontSize:14}}>{a.title}</div>
                          {a.bank&&<div style={{fontSize:12,color:getBankColor(a.bank),marginTop:2}}>{a.bank}</div>}
                          {a.note&&<div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{a.note}</div>}
                        </div>
                        <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                          {a.date&&<div style={{fontSize:12,color:"#9CA3AF"}}>{fmtDate(a.date)}</div>}
                          {days!=null&&!a.done&&<UrgencyBadge days={days} />}
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>openEdit("action",origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                            <button onClick={()=>deleteRow("action",origIdx)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ DEPOSITS ══════════════════════════════════════════════════════ */}
        {tab==="deposits" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <input placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{...inputSt,width:220}} />
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {banks.map(b=>(
                  <button key={b} onClick={()=>setFilterBank(b)} style={{background:filterBank===b?getBankColor(b):"#1C1C2E",color:filterBank===b?"#FFF":"#9CA3AF",border:`1px solid ${filterBank===b?getBankColor(b):"#374151"}`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{b}</button>
                ))}
              </div>
              <button onClick={()=>openAdd("deposit")} style={{marginLeft:"auto",background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
            </div>
            <div style={{background:"#1C1C2E",borderRadius:14,overflow:"hidden"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#0D1117",borderBottom:"1px solid #374151"}}>
                    {["Bank","Type","Nominee","Invested","ROI","Maturity ₹","Matures","Days","Action",""].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",color:"#6B7280",fontWeight:700,fontSize:11,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.length===0?<tr><td colSpan={10} style={{padding:32,textAlign:"center",color:"#4B5563"}}>No records</td></tr>:
                    filtered.map((d,i)=>{
                      const origIdx=deposits.indexOf(d);
                      const days=daysUntil(d.maturityDate);
                      return (
                        <tr key={i} style={{borderBottom:"1px solid #1F2937",background:d.done?"rgba(52,211,153,0.03)":days!=null&&days<0?"rgba(55,65,81,0.15)":days!=null&&days<=90?"rgba(239,68,68,0.05)":"transparent",opacity:d.done?0.55:1}}>
                          <td style={{padding:"10px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:7,height:7,borderRadius:"50%",background:getBankColor(d.bank)}} />
                              <span style={{fontWeight:700,color:"#F3F4F6"}}>{d.bank}</span>
                            </div>
                            <div style={{fontSize:10,color:"#374151",fontFamily:"monospace",marginLeft:13}}>{d.depositId}</div>
                          </td>
                          <td style={{padding:"10px 12px",color:"#9CA3AF"}}>{d.type}</td>
                          <td style={{padding:"10px 12px",color:"#D1D5DB"}}>{d.nominee}</td>
                          <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#F9FAFB"}}>{fmt(d.deposit)}</td>
                          <td style={{padding:"10px 12px",fontFamily:"monospace"}}><span style={{color:"#34D399",fontWeight:700}}>{d.roi?(Number(d.roi)*100).toFixed(2)+"%":"—"}</span></td>
                          <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:700,color:"#10B981"}}>{fmt(d.maturityAmt||d.deposit)}</td>
                          <td style={{padding:"10px 12px",color:"#D1D5DB",whiteSpace:"nowrap"}}>{fmtDate(d.maturityDate)}</td>
                          <td style={{padding:"10px 12px"}}><UrgencyBadge days={days} /></td>
                          <td style={{padding:"10px 12px",color:"#6B7280",fontSize:11}}>{d.maturityAction}</td>
                          <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>
                            <button onClick={()=>toggleDone("deposit",origIdx)} style={{background:d.done?"#064E3B":"#1C1C2E",color:d.done?"#34D399":"#6B7280",border:`1px solid ${d.done?"#065F46":"#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",marginRight:4,fontWeight:700}}>{d.done?"↩":"✓"}</button>
                            <button onClick={()=>openEdit("deposit",origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",marginRight:4}}>✏️</button>
                            <button onClick={()=>deleteRow("deposit",origIdx)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:12}}>
              <div style={{background:"#1C1C2E",borderRadius:9,padding:"9px 16px",border:"1px solid #374151",fontSize:12}}>Invested: <strong style={{fontFamily:"monospace",color:"#F9FAFB"}}>{fmt(filtered.reduce((s,d)=>s+(Number(d.deposit)||0),0))}</strong></div>
              <div style={{background:"#1C1C2E",borderRadius:9,padding:"9px 16px",border:"1px solid #374151",fontSize:12}}>At Maturity: <strong style={{fontFamily:"monospace",color:"#10B981"}}>{fmt(filtered.reduce((s,d)=>s+(Number(d.maturityAmt)||Number(d.deposit)||0),0))}</strong></div>
            </div>
          </div>
        )}

        {/* ══ ACCOUNTS ══════════════════════════════════════════════════════ */}
        {tab==="accounts" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={()=>openAdd("account")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Account</button>
            </div>
            {accounts.length===0?<div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No accounts yet</div>:(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {accounts.map((acc,i)=>{
                  const color=getBankColor(acc.bank);
                  return (
                    <div key={i} style={{background:"#1C1C2E",borderRadius:14,padding:18,border:`1px solid ${color}30`,borderTop:`3px solid ${color}`,opacity:acc.done?0.55:1,transition:"opacity 0.3s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div><div style={{fontSize:14,fontWeight:800,color:acc.done?"#6B7280":"#F3F4F6",textDecoration:acc.done?"line-through":"none"}}>{acc.bank}</div><div style={{fontSize:11,color,fontWeight:600}}>{acc.type}</div></div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>toggleDone("account",i)} style={{background:acc.done?"#064E3B":"#1C1C2E",color:acc.done?"#34D399":"#6B7280",border:`1px solid ${acc.done?"#065F46":"#374151"}`,borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{acc.done?"↩":"✓"}</button>
                          <button onClick={()=>openEdit("account",i)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                          <button onClick={()=>deleteRow("account",i)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                        </div>
                      </div>
                      {acc.holders&&<div style={{fontSize:11,color:"#9CA3AF"}}>👤 {acc.holders}</div>}
                      {acc.amount&&<div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:"#F9FAFB",marginTop:4}}>{fmt(acc.amount)}</div>}
                      {acc.roi&&<div style={{fontSize:12,color:"#34D399",fontWeight:700}}>ROI: {(Number(acc.roi)*100).toFixed(2)}%</div>}
                      {acc.online&&<div style={{fontSize:11,color:acc.online==="Yes"?"#34D399":"#6B7280",marginTop:4}}>{acc.online==="Yes"?"🌐 Online":"📁 Manual"}</div>}
                      {acc.address&&<div style={{fontSize:11,color:"#4B5563",marginTop:2}}>📍 {acc.address}</div>}
                      {acc.detail&&<div style={{fontSize:11,color:"#374151",marginTop:1}}>ℹ️ {acc.detail}</div>}
                      {acc.nextAction&&!acc.done&&<div style={{background:"#7F1D1D22",border:"1px solid #7F1D1D",borderRadius:8,padding:"6px 10px",marginTop:8}}><span style={{color:"#FCA5A5",fontSize:12,fontWeight:600}}>⚡ {acc.nextAction}</span></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ BILLS ═════════════════════════════════════════════════════════ */}
        {tab==="bills" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <button onClick={()=>openAdd("bill")} style={{background:"linear-gradient(135deg,#065F46,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Bill</button>
            </div>
            {bills.length===0?<div style={{textAlign:"center",padding:40,color:"#4B5563"}}>No bills yet</div>:(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {["Monthly","Yearly"].map(freq=>(
                  <div key={freq} style={{background:"#1C1C2E",borderRadius:14,padding:20}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:14}}>{freq==="Monthly"?"🔄 Monthly":"📅 Yearly"} Bills</div>
                    {bills.filter(b=>b.freq===freq).length===0?<div style={{color:"#4B5563",fontSize:12}}>None added</div>:
                    bills.filter(b=>b.freq===freq).map((b,i)=>{
                      const origIdx=bills.indexOf(b);
                      return (
                        <div key={i} style={{background:"#0D1117",borderRadius:10,padding:"10px 14px",marginBottom:8,border:`1px solid ${b.priority==="High"?"#DC2626":"#1F2937"}`,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:b.done?0.45:1}}>
                          <div>
                            <div style={{fontWeight:700,color:b.done?"#6B7280":"#F3F4F6",fontSize:13,textDecoration:b.done?"line-through":"none"}}>{b.name}</div>
                            {b.due&&<div style={{color:"#9CA3AF",fontSize:11}}>Due: {b.due}</div>}
                            {b.phone&&<div style={{color:"#4B5563",fontSize:11}}>📞 {b.phone}</div>}
                          </div>
                          <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            {b.amount&&<div style={{fontFamily:"monospace",fontWeight:800,color:"#F9FAFB",fontSize:13}}>{fmt(b.amount)}</div>}
                            {b.priority==="High"&&<span style={{background:"#7F1D1D",color:"#FCA5A5",fontSize:10,padding:"1px 8px",borderRadius:20,fontWeight:700}}>HIGH</span>}
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>toggleDone("bill",origIdx)} style={{background:b.done?"#064E3B":"#1C1C2E",color:b.done?"#34D399":"#6B7280",border:`1px solid ${b.done?"#065F46":"#374151"}`,borderRadius:6,padding:"2px 6px",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{b.done?"↩":"✓"}</button>
                              <button onClick={()=>openEdit("bill",origIdx)} style={{background:"#1D4ED820",color:"#60A5FA",border:"1px solid #1D4ED840",borderRadius:6,padding:"2px 6px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                              <button onClick={()=>deleteRow("bill",origIdx)} style={{background:"#7F1D1D20",color:"#FCA5A5",border:"1px solid #7F1D1D40",borderRadius:6,padding:"2px 6px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      {modal && <ModalForm />}
    </div>
  );
}
