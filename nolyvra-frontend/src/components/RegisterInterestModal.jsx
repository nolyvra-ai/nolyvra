import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const INK = "#0B0A14";
const INDIGO = "#6366F1";

function flagEmoji(iso2) {
  return iso2.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}
const RAW_COUNTRIES = [
  ["Afghanistan","AF","+93"],["Albania","AL","+355"],["Algeria","DZ","+213"],["American Samoa","AS","+1"],
  ["Andorra","AD","+376"],["Angola","AO","+244"],["Anguilla","AI","+1"],["Antigua and Barbuda","AG","+1"],
  ["Argentina","AR","+54"],["Armenia","AM","+374"],["Aruba","AW","+297"],["Australia","AU","+61"],
  ["Austria","AT","+43"],["Azerbaijan","AZ","+994"],["Bahamas","BS","+1"],["Bahrain","BH","+973"],
  ["Bangladesh","BD","+880"],["Barbados","BB","+1"],["Belarus","BY","+375"],["Belgium","BE","+32"],
  ["Belize","BZ","+501"],["Benin","BJ","+229"],["Bermuda","BM","+1"],["Bhutan","BT","+975"],
  ["Bolivia","BO","+591"],["Bosnia and Herzegovina","BA","+387"],["Botswana","BW","+267"],["Brazil","BR","+55"],
  ["British Virgin Islands","VG","+1"],["Brunei","BN","+673"],["Bulgaria","BG","+359"],["Burkina Faso","BF","+226"],
  ["Burundi","BI","+257"],["Cambodia","KH","+855"],["Cameroon","CM","+237"],["Canada","CA","+1"],
  ["Cape Verde","CV","+238"],["Cayman Islands","KY","+1"],["Central African Republic","CF","+236"],["Chad","TD","+235"],
  ["Chile","CL","+56"],["China","CN","+86"],["Colombia","CO","+57"],["Comoros","KM","+269"],
  ["Congo (DRC)","CD","+243"],["Congo (Republic)","CG","+242"],["Cook Islands","CK","+682"],["Costa Rica","CR","+506"],
  ["Croatia","HR","+385"],["Cuba","CU","+53"],["Curaçao","CW","+599"],["Cyprus","CY","+357"],
  ["Czech Republic","CZ","+420"],["Denmark","DK","+45"],["Djibouti","DJ","+253"],["Dominica","DM","+1"],
  ["Dominican Republic","DO","+1"],["Ecuador","EC","+593"],["Egypt","EG","+20"],["El Salvador","SV","+503"],
  ["Equatorial Guinea","GQ","+240"],["Eritrea","ER","+291"],["Estonia","EE","+372"],["Eswatini","SZ","+268"],
  ["Ethiopia","ET","+251"],["Fiji","FJ","+679"],["Finland","FI","+358"],["France","FR","+33"],
  ["French Polynesia","PF","+689"],["Gabon","GA","+241"],["Gambia","GM","+220"],["Georgia","GE","+995"],
  ["Germany","DE","+49"],["Ghana","GH","+233"],["Gibraltar","GI","+350"],["Greece","GR","+30"],
  ["Greenland","GL","+299"],["Grenada","GD","+1"],["Guam","GU","+1"],["Guatemala","GT","+502"],
  ["Guernsey","GG","+44"],["Guinea","GN","+224"],["Guinea-Bissau","GW","+245"],["Guyana","GY","+592"],
  ["Haiti","HT","+509"],["Honduras","HN","+504"],["Hong Kong","HK","+852"],["Hungary","HU","+36"],
  ["Iceland","IS","+354"],["India","IN","+91"],["Indonesia","ID","+62"],["Iran","IR","+98"],
  ["Iraq","IQ","+964"],["Ireland","IE","+353"],["Isle of Man","IM","+44"],["Israel","IL","+972"],
  ["Italy","IT","+39"],["Ivory Coast","CI","+225"],["Jamaica","JM","+1"],["Japan","JP","+81"],
  ["Jersey","JE","+44"],["Jordan","JO","+962"],["Kazakhstan","KZ","+7"],["Kenya","KE","+254"],
  ["Kiribati","KI","+686"],["Kosovo","XK","+383"],["Kuwait","KW","+965"],["Kyrgyzstan","KG","+996"],
  ["Laos","LA","+856"],["Latvia","LV","+371"],["Lebanon","LB","+961"],["Lesotho","LS","+266"],
  ["Liberia","LR","+231"],["Libya","LY","+218"],["Liechtenstein","LI","+423"],["Lithuania","LT","+370"],
  ["Luxembourg","LU","+352"],["Macau","MO","+853"],["Madagascar","MG","+261"],["Malawi","MW","+265"],
  ["Malaysia","MY","+60"],["Maldives","MV","+960"],["Mali","ML","+223"],["Malta","MT","+356"],
  ["Marshall Islands","MH","+692"],["Mauritania","MR","+222"],["Mauritius","MU","+230"],["Mexico","MX","+52"],
  ["Micronesia","FM","+691"],["Moldova","MD","+373"],["Monaco","MC","+377"],["Mongolia","MN","+976"],
  ["Montenegro","ME","+382"],["Montserrat","MS","+1"],["Morocco","MA","+212"],["Mozambique","MZ","+258"],
  ["Myanmar","MM","+95"],["Namibia","NA","+264"],["Nauru","NR","+674"],["Nepal","NP","+977"],
  ["Netherlands","NL","+31"],["New Caledonia","NC","+687"],["New Zealand","NZ","+64"],["Nicaragua","NI","+505"],
  ["Niger","NE","+227"],["Nigeria","NG","+234"],["Niue","NU","+683"],["North Korea","KP","+850"],
  ["North Macedonia","MK","+389"],["Norway","NO","+47"],["Oman","OM","+968"],["Pakistan","PK","+92"],
  ["Palau","PW","+680"],["Palestine","PS","+970"],["Panama","PA","+507"],["Papua New Guinea","PG","+675"],
  ["Paraguay","PY","+595"],["Peru","PE","+51"],["Philippines","PH","+63"],["Poland","PL","+48"],
  ["Portugal","PT","+351"],["Puerto Rico","PR","+1"],["Qatar","QA","+974"],["Réunion","RE","+262"],
  ["Romania","RO","+40"],["Russia","RU","+7"],["Rwanda","RW","+250"],["Saint Kitts and Nevis","KN","+1"],
  ["Saint Lucia","LC","+1"],["Saint Vincent and the Grenadines","VC","+1"],["Samoa","WS","+685"],["San Marino","SM","+378"],
  ["São Tomé and Príncipe","ST","+239"],["Saudi Arabia","SA","+966"],["Senegal","SN","+221"],["Serbia","RS","+381"],
  ["Seychelles","SC","+248"],["Sierra Leone","SL","+232"],["Singapore","SG","+65"],["Sint Maarten","SX","+1"],
  ["Slovakia","SK","+421"],["Slovenia","SI","+386"],["Solomon Islands","SB","+677"],["Somalia","SO","+252"],
  ["South Africa","ZA","+27"],["South Korea","KR","+82"],["South Sudan","SS","+211"],["Spain","ES","+34"],
  ["Sri Lanka","LK","+94"],["Sudan","SD","+249"],["Suriname","SR","+597"],["Sweden","SE","+46"],
  ["Switzerland","CH","+41"],["Syria","SY","+963"],["Taiwan","TW","+886"],["Tajikistan","TJ","+992"],
  ["Tanzania","TZ","+255"],["Thailand","TH","+66"],["Timor-Leste","TL","+670"],["Togo","TG","+228"],
  ["Tonga","TO","+676"],["Trinidad and Tobago","TT","+1"],["Tunisia","TN","+216"],["Turkey","TR","+90"],
  ["Turkmenistan","TM","+993"],["Turks and Caicos Islands","TC","+1"],["Tuvalu","TV","+688"],["Uganda","UG","+256"],
  ["Ukraine","UA","+380"],["United Arab Emirates","AE","+971"],["United Kingdom","GB","+44"],["United States","US","+1"],
  ["Uruguay","UY","+598"],["Uzbekistan","UZ","+998"],["Vanuatu","VU","+678"],["Vatican City","VA","+379"],
  ["Venezuela","VE","+58"],["Vietnam","VN","+84"],["Yemen","YE","+967"],["Zambia","ZM","+260"],
  ["Zimbabwe","ZW","+263"],
];
const COUNTRIES = RAW_COUNTRIES
  .map(([name, iso2, code]) => ({ name, code, flag: flagEmoji(iso2) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function RegisterInterestModal({ open, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ firstName:"", lastName:"", company:"", email:"", phone:"" });
  const [selCountry, setSelCountry] = useState(COUNTRIES.find(c=>c.name==="Australia") || COUNTRIES[0]);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setFormError("");
      setForm({ firstName:"", lastName:"", company:"", email:"", phone:"" });
    }
  }, [open]);

  function fmtPhone(r) {
    const d=r.replace(/\D/g,"");
    if(d.length<=4)return d;
    if(d.length<=7)return `${d.slice(0,4)} ${d.slice(4)}`;
    return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,10)}`;
  }
  function setField(k,v){ setForm(p=>({...p,[k]:v})); }

  async function handleRegister() {
    if(!form.firstName.trim()||!form.email.trim()){ setFormError("First name and email are required."); return; }
    setSubmitting(true); setFormError("");
    try {
      const res=await fetch(`${API_BASE}/api/auth/register`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form, phone:form.phone?`${selCountry.code} ${form.phone}`:""}),
      });
      const data=await res.json();
      if(!res.ok){ setFormError(data.error||"Registration failed."); return; }
      setSubmitted(true);
    } catch { setFormError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (!open) return null;

  return (
    <>
      <style>{`
        .rim-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
        @keyframes rimIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .rim-box{background:#fff;border-radius:16px;padding:40px;width:100%;max-width:460px;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.3);animation:rimIn .2s ease;font-family:'DM Sans',sans-serif}
        .rim-input{width:100%;padding:10px 13px;border:1px solid #E2E6ED;border-radius:8px;font-size:13px;font-family:inherit;color:#0F1623;background:#F7F8FA;outline:none;transition:border-color .15s}
        .rim-input:focus{border-color:${INDIGO};box-shadow:0 0 0 3px rgba(99,102,241,.12)}
        @media(max-width:768px){
          .rim-box{padding:24px 20px!important;margin:16px!important;max-width:calc(100vw - 32px)!important}
          .rim-name-row{grid-template-columns:1fr!important}
        }
      `}</style>
      <div className="rim-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
        <div className="rim-box">
          <button onClick={onClose} style={{ position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",background:"#F7F8FA",border:"1px solid #E2E6ED",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#9AA3B4" }}>✕</button>
          {!submitted?(
            <>
              <div style={{ fontSize:28,marginBottom:10 }}>✦</div>
              <div style={{ fontSize:22,fontWeight:700,color:INK,letterSpacing:"-.4px",marginBottom:6 }}>Register Your Interest</div>
              <div style={{ fontSize:13,color:"#9AA3B4",marginBottom:28,lineHeight:1.5 }}>Tell us about yourself and we'll be in touch shortly with early access details.</div>
              {formError&&<div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#DC2626" }}>{formError}</div>}
              <div className="rim-name-row" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                <div>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:INK,marginBottom:5 }}>First Name *</label>
                  <input className="rim-input" type="text" placeholder="Sarah" value={form.firstName} onChange={e=>setField("firstName",e.target.value)} />
                </div>
                <div>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:INK,marginBottom:5 }}>Last Name</label>
                  <input className="rim-input" type="text" placeholder="Reynolds" value={form.lastName} onChange={e=>setField("lastName",e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:600,color:INK,marginBottom:5 }}>Company *</label>
                <input className="rim-input" type="text" placeholder="Your recruitment agency" value={form.company} onChange={e=>setField("company",e.target.value)} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:600,color:INK,marginBottom:5 }}>Email Address *</label>
                <input className="rim-input" type="email" placeholder="sarah@agency.com" value={form.email} onChange={e=>setField("email",e.target.value)} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:600,color:INK,marginBottom:5 }}>Phone Number</label>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <select value={COUNTRIES.indexOf(selCountry)} onChange={e=>setSelCountry(COUNTRIES[Number(e.target.value)])}
                    style={{ padding:"10px 8px",border:"1px solid #E2E6ED",borderRadius:8,fontSize:13,fontFamily:"inherit",color:INK,background:"#F7F8FA",cursor:"pointer",outline:"none",flexShrink:0,maxWidth:150 }}>
                    {COUNTRIES.map((c,i)=><option key={`${c.name}-${c.code}`} value={i}>{c.flag} {c.name} ({c.code})</option>)}
                  </select>
                  <input className="rim-input" type="tel" placeholder="04XX XXX XXX" value={form.phone} onChange={e=>setField("phone",fmtPhone(e.target.value))} maxLength={12} style={{ flex:1 }} />
                </div>
                <div style={{ fontSize:11,color:"#9AA3B4",marginTop:4 }}>Country: {selCountry.flag} {selCountry.name} ({selCountry.code})</div>
              </div>
              <button onClick={handleRegister} disabled={submitting} style={{ width:"100%",padding:12,borderRadius:8,fontSize:14,fontWeight:600,background:INDIGO,color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>
                {submitting?"Submitting…":"Submit →"}
              </button>
            </>
          ):(
            <div style={{ textAlign:"center",paddingTop:24 }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🎉</div>
              <div style={{ fontSize:18,fontWeight:700,color:INK,marginBottom:8 }}>Thank you for your interest!</div>
              <div style={{ fontSize:14,color:"#9AA3B4",lineHeight:1.6,marginBottom:20 }}>Check your email and verify your address to log in.</div>
              <button onClick={onClose} style={{ padding:"10px 24px",borderRadius:7,background:INDIGO,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>Close</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
