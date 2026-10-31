import { useEffect, useRef, useState } from "react";
import "./QuantiumPage.css";

// Quantium Labs (official NZ partner) landing page — markup supplied by the
// Quantium Labs team. It is built on Tailwind + Font Awesome, which the rest of
// the app doesn't use, so both are loaded from CDN only when this page mounts.
// Tailwind's global reset (preflight) is disabled so it can't restyle the MUI
// pages once loaded; QuantiumPage.css provides a page-scoped reset instead.
const TAILWIND_SRC = "https://cdn.tailwindcss.com";
const FONT_AWESOME_HREF = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
const TAILWIND_CONFIG = {
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa",
          500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 900: "#312e81",
        },
        accent: {
          50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff",
          500: "#7c3aed", 600: "#6d28d9", 700: "#7e22ce",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "sans-serif"] },
    },
  },
};

// Loads Tailwind + Font Awesome once per session; returns true once styles are
// ready so the page isn't shown unstyled. Falls back to showing it after 4s.
function useQuantiumAssets() {
  const [ready, setReady] = useState(() => !!window.tailwind);

  useEffect(() => {
    if (!document.getElementById("qp-fontawesome")) {
      const link = document.createElement("link");
      link.id = "qp-fontawesome";
      link.rel = "stylesheet";
      link.href = FONT_AWESOME_HREF;
      document.head.appendChild(link);
    }

    if (window.tailwind) {
      window.tailwind.config = TAILWIND_CONFIG;
      return undefined;
    }

    let script = document.getElementById("qp-tailwind");
    if (!script) {
      script = document.createElement("script");
      script.id = "qp-tailwind";
      script.src = TAILWIND_SRC;
      document.head.appendChild(script);
    }
    const onLoad = () => {
      if (window.tailwind) window.tailwind.config = TAILWIND_CONFIG;
      setReady(true);
    };
    const onError = () => setReady(true);
    const fallback = window.setTimeout(() => setReady(true), 4000);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      window.clearTimeout(fallback);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  return ready;
}

export default function QuantiumPage() {
    const profileData = {
        dev: {
            avatar: 'AA',
            name: 'Arthur Allen',
            role: 'Applicant for Senior Backend Engineer',
            riskText: '5 Flags Detected / Medium Risk',
            riskClass: 'bg-amber-50 text-amber-700 border-amber-200',
            consistency: { score: 85, color: 'text-amber-600', bar: 'bg-amber-500' },
            capability: { score: 92, color: 'text-emerald-600', bar: 'bg-emerald-500' },
            timeline: { score: 80, color: 'text-amber-600', bar: 'bg-amber-500' },
            strengths: [
                'Strong hands-on experience in Go, Node.js, and Distributed Microservices',
                'Over 6 years of architecture experience in high-throughput cloud environments',
                'Consistently led technical initiatives across 2 previous enterprise roles',
            ],
            flags: [
                ['Title Mismatch', "Listed as 'Lead Architect' on CV, but LinkedIn states 'Senior Developer'"],
                ['Timeline Gap', '7-month unexplained gap between March 2022 and October 2022'],
                ['Potential Overqualification', 'Exceeds required technical scope for mid-level band'],
            ],
            questions: [
                'Can you clarify your exact responsibilities during your tenure at TechCorp vs your LinkedIn title?',
                'What projects or activities were undertaken during the gap in 2022?',
                'How do you approach managing architectural trade-offs in scalable distributed systems?',
            ],
        },
        pm: {
            avatar: 'AO',
            name: 'Aisha Okafor',
            role: 'Applicant for Lead Product Manager',
            riskText: 'Verified / Low Risk (1 Minor Flag)',
            riskClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            consistency: { score: 96, color: 'text-emerald-600', bar: 'bg-emerald-500' },
            capability: { score: 94, color: 'text-emerald-600', bar: 'bg-emerald-500' },
            timeline: { score: 98, color: 'text-emerald-600', bar: 'bg-emerald-500' },
            strengths: [
                'Proven track record scaling B2B SaaS ARR from $2M to $10M',
                'Certified Scrum Product Owner with extensive Agile roadmap leadership',
                'High alignment between LinkedIn recommendations and CV achievements',
            ],
            flags: [
                ['Minor Date Variance', 'Start date at Fintech Solutions differs by 1 month between CV and LinkedIn'],
            ],
            questions: [
                'How did you structure product discovery during your high-growth phase at Fintech Solutions?',
                'What key metrics did you prioritize to reach $10M ARR?',
            ],
        },
        bdm: {
            avatar: 'MJ',
            name: 'Marcus Jensen',
            role: 'Applicant for Business Development Manager',
            riskText: '7 Flags Detected / High Discrepancy Risk',
            riskClass: 'bg-rose-50 text-rose-700 border-rose-200',
            consistency: { score: 62, color: 'text-rose-600', bar: 'bg-rose-500' },
            capability: { score: 78, color: 'text-amber-600', bar: 'bg-amber-500' },
            timeline: { score: 65, color: 'text-rose-600', bar: 'bg-rose-500' },
            strengths: [
                'Demonstrated enterprise quota attainment claims ($1.5M+ annual target)',
                'Strong network in ANZ financial services domain',
            ],
            flags: [
                ['Employer Name Mismatch', "Listed 'Global Sales Corp' on CV; LinkedIn shows 'Contractor'"],
                ['Overlapping Employment', 'Full-time dates overlap simultaneously across 2 companies for 9 months'],
                ['Unverified Revenue Claims', 'Sales metric figures exceed typical benchmark for reported territory size'],
            ],
            questions: [
                'Could you walk us through the overlapping tenure between Company A and Company B in 2023?',
                'What was your individual closed-won quota contribution vs team quota?',
            ],
        },
    };

    const assetsReady = useQuantiumAssets();
    const [selectedProfile, setSelectedProfile] = useState('dev');
    const [menuOpen, setMenuOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [teamSize, setTeamSize] = useState(5);
    const [selectedTools, setSelectedTools] = useState([180, 150, 45, 20, 30]);
    const toastTimeout = useRef(null);
    const pricingCarousel = useRef(null);
    const profile = profileData[selectedProfile];
    const toolCost = selectedTools.reduce((total, cost) => total + cost, 0);
    const annualSavings = Math.max(0, toolCost - 39) * 12 * teamSize;
    const hoursSaved = teamSize * 45;

    function showToast(message) {
        setToastMessage(message);
        setToastVisible(true);
        window.clearTimeout(toastTimeout.current);
        toastTimeout.current = window.setTimeout(() => setToastVisible(false), 3000);
    }

    function toggleTool(cost) {
        setSelectedTools((current) => current.includes(cost)
            ? current.filter((item) => item !== cost)
            : [...current, cost]);
    }

    function scrollPricing(direction) {
        pricingCarousel.current?.scrollBy({ left: direction * 314, behavior: 'smooth' });
    }

    // Arriving from the main landing page's partner section — start at the top.
    useEffect(() => { window.scrollTo(0, 0); }, []);

    useEffect(() => () => window.clearTimeout(toastTimeout.current), []);

    // Cal.com "book a call" floating button. The loader is installed once per
    // session; the button itself is added on every visit and removed on leave
    // so it doesn't follow the visitor around the rest of the app.
    useEffect(() => {
        if (!window.Cal) {
            const calScript = document.createElement('script');
            const enqueue = (target, args) => target.q.push(args);
            window.Cal = function (...args) {
                const cal = window.Cal;
                if (!cal.loaded) {
                    cal.ns = {};
                    cal.q = cal.q || [];
                    calScript.src = 'https://app.cal.com/embed/embed.js';
                    calScript.async = true;
                    document.head.appendChild(calScript);
                    cal.loaded = true;
                }
                if (args[0] === 'init') {
                    const api = (...namespaceArgs) => enqueue(api, namespaceArgs);
                    const namespace = args[1];
                    api.q = api.q || [];
                    cal.ns[namespace] = cal.ns[namespace] || api;
                    enqueue(cal.ns[namespace], args);
                    enqueue(cal, ['initNamespace', namespace]);
                    return cal.ns[namespace];
                }
                enqueue(cal, args);
            };
            window.Cal('init', '30min', { origin: 'https://app.cal.com' });
            window.Cal.config = window.Cal.config || {};
            window.Cal.config.forwardQueryParams = true;
        }
        window.Cal.ns['30min']('floatingButton', {
            calLink: 'quantiumlabs-labs/30min',
            config: { layout: 'month_view', useSlotsViewOnSmallScreen: 'true', theme: 'light' },
        });
        window.Cal.ns['30min']('ui', { theme: 'light', hideEventTypeDetails: false, layout: 'month_view' });
        return () => {
            document.querySelectorAll('cal-floating-button, cal-modal-box').forEach((el) => el.remove());
        };
    }, []);

  return (
    <div className="qp-root" style={{ visibility: assetsReady ? 'visible' : 'hidden' }}>

          <div id="toast" className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-800 flex items-center gap-3 ${toastVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
              <i id="toast-icon" className="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
              <span id="toast-msg" className="text-sm font-medium">{toastMessage}</span>
          </div>

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

              <div className="grid grid-cols-3 md:flex md:items-center h-20">

                  <div className="flex items-center justify-start">
                      <a href="#" className="flex items-center gap-3 group">
                          <img src="/nolyvra_logo.png" alt="Nolyvra" className="w-10 h-10 rounded-xl object-cover shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform" />
                          <div className="flex flex-col">
                              <span className="font-extrabold text-2xl tracking-tight text-slate-900">Nolyvra</span>
                              <span className="text-[10px] uppercase tracking-widest font-bold text-brand-600 -mt-1">Intelligence. Evolved.</span>
                          </div>
                      </a>
                      <a href="https://quantiumlabs.co.nz/" target="_blank" rel="noopener noreferrer" className="hidden lg:flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
                          <span className="text-slate-300 text-lg font-light">×</span>
                          <img src="/quantiuamlabs_logo.png" alt="Quantium Labs" className="h-9 w-auto object-contain" />
                      </a>
                  </div>

                  <div className="flex items-center justify-center md:hidden">
                      <button id="mobile-menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation" className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none">
                          <i className="fa-solid fa-bars text-xl"></i>
                      </button>
                  </div>

                  <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600 ml-auto">
                      <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
                      <a href="#calculator" className="hover:text-brand-600 transition-colors">ROI</a>
                      <a href="#verify-simulator" className="hover:text-brand-600 transition-colors">Nolyvra Verify</a>
                      <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How It Works</a>
                      <a href="#results" className="hover:text-brand-600 transition-colors">Results</a>
                      <a href="#pricing" className="hover:text-brand-600 transition-colors">Pricing</a>
                  </nav>

                  <div className="hidden md:block"></div>

                  <div className="md:hidden flex items-center justify-end">
                      <img src="/quantiuamlabs_logo.png" alt="Quantium Labs" className="h-7 w-auto object-contain" />
                  </div>

              </div>
          </div>

          <div id="mobile-menu" className={`${menuOpen ? 'block' : 'hidden'} md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3`}>
              <a href="#features" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">Features</a>
              <a href="#calculator" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">ROI</a>
              <a href="#verify-simulator" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">Nolyvra Verify</a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">How It Works</a>
              <a href="#results" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">Results</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="block py-2 text-slate-600 font-medium hover:text-brand-600">Pricing</a>
          </div>
      </header>

          <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
              <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none"></div>
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-r from-brand-500/10 to-accent-500/10 blur-3xl rounded-full pointer-events-none"></div>

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                  <div className="text-center max-w-3xl mx-auto">

                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200/80 text-brand-700 text-xs sm:text-sm font-semibold mb-8 shadow-sm hover:border-brand-300 transition-colors cursor-pointer" onClick={() => showToast('AI Co-Worker feature tour loaded!')}>
                          <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide">NEW</span>
                          <span>AI-powered recruitment co-worker → The smartest way to match</span>
                      </div>

                      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6">
                          Stop stitching together CV parsers, ATS plugins and inbox tools.
                      </h1>

                      <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed mb-10">
                          <strong className="text-[#7000FF] font-bold">Nolyvra</strong> verifies, matches, schedules and drafts — so you can focus on people.
                      </p>

                      <div className="workflow-creative" role="img" aria-label="Separate CV parser, ATS, inbox and scheduler tools come together in one Nolyvra workspace">
                          <div className="workflow-sources">
                              <div className="workflow-eyebrow">THE PATCHWORK STACK</div>
                              <div className="workflow-tool workflow-tool-cv">
                                  <span className="workflow-tool-icon"><i className="fa-regular fa-file-lines"></i></span>
                                  <span><strong>CV Parser</strong><small>Profiles in PDFs</small></span>
                                  <i className="fa-solid fa-ellipsis workflow-tool-more"></i>
                              </div>
                              <div className="workflow-tool workflow-tool-ats">
                                  <span className="workflow-tool-icon"><i className="fa-solid fa-table-list"></i></span>
                                  <span><strong>ATS</strong><small>Pipeline in another tab</small></span>
                                  <i className="fa-solid fa-ellipsis workflow-tool-more"></i>
                              </div>
                              <div className="workflow-tool workflow-tool-inbox">
                                  <span className="workflow-tool-icon"><i className="fa-regular fa-envelope"></i></span>
                                  <span><strong>Inbox</strong><small>Threads to chase</small></span>
                                  <i className="fa-solid fa-ellipsis workflow-tool-more"></i>
                              </div>
                              <div className="workflow-tool workflow-tool-calendar">
                                  <span className="workflow-tool-icon"><i className="fa-regular fa-calendar"></i></span>
                                  <span><strong>Scheduler</strong><small>Yet another login</small></span>
                                  <i className="fa-solid fa-ellipsis workflow-tool-more"></i>
                              </div>
                          </div>

                          <div className="workflow-bridge" aria-hidden="true">
                              <span className="workflow-bridge-label">copy · paste · repeat</span>
                              <span className="workflow-bridge-line"></span>
                              <i className="fa-solid fa-arrow-right workflow-bridge-arrow"></i>
                          </div>

                          <div className="workflow-destination">
                              <div className="workflow-destination-top">
                                  <span className="workflow-brand-mark">N</span>
                                  <span className="workflow-eyebrow">ONE WORKSPACE</span>
                                  <span className="workflow-live"><i></i> LIVE</span>
                              </div>
                              <strong className="workflow-destination-name">Nolyvra</strong>
                              <span className="workflow-destination-copy">People first. Busywork, handled.</span>
                              <div className="workflow-capabilities">
                                  <span><i className="fa-solid fa-shield-halved"></i> Verify</span>
                                  <span><i className="fa-solid fa-bullseye"></i> Match</span>
                                  <span><i className="fa-regular fa-calendar-check"></i> Schedule</span>
                                  <span><i className="fa-regular fa-paper-plane"></i> Draft</span>
                              </div>
                          </div>
                      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 my-6">

          <div className="group flex items-center gap-3.5 py-2.5 px-4 bg-white/90 hover:bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              <div className="w-14 h-14 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center p-1.5 group-hover:scale-105 transition-transform">
                  <img src="/quantium/australia_map.png" alt="Australia Map" className="w-full h-full object-contain filter drop-shadow-sm" />
              </div>
              <div className="text-left">
                  <span className="text-xs font-extrabold text-slate-800">Australia</span>
              </div>
          </div>

          <div className="flex items-center justify-center w-2">
              <span className="w-3 h-3 rounded-full bg-brand-500 animate-pulse"></span>
          </div>

          <div className="group flex items-center gap-3.5 py-2.5 px-4 bg-white/90 hover:bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              <div className="w-14 h-14 rounded-xl bg-accent-50 border border-accent-100 flex items-center justify-center p-1.5 group-hover:scale-105 transition-transform" style={{ backgroundColor: '#f3e8ff' }}>
                  <img src="/quantium/nz_map.svg" alt="New Zealand Map" className="w-full h-full object-contain filter drop-shadow-sm" />
              </div>
              <div className="text-left">
                  <span className="text-xs font-extrabold text-slate-800">New Zealand</span>
              </div>
          </div>

      </div>

                      <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
                          <i className="fa-solid fa-shield-halved text-emerald-500"></i>
                          <span>Trusted by recruitment teams across Australia & New Zealand.</span>
                      </p>
                  </div>

                  <div className="mt-14 max-w-5xl mx-auto">
                      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-200/60 overflow-hidden">

                          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                  <span className="text-xs text-slate-400 font-mono ml-2">app.nolyvra.com/workspace/dashboard</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                      AI Co-Worker Active
                                  </span>
                              </div>
                          </div>

                          <div className="p-6 bg-slate-50/50">

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Roles</span>
                                      <div className="text-2xl font-bold text-slate-900 mt-1">12 Jobs</div>
                                      <span className="text-[11px] text-emerald-600 font-medium">94 candidates live</span>
                                  </div>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Match Score</span>
                                      <div className="text-2xl font-bold text-brand-600 mt-1">87.4%</div>
                                      <span className="text-[11px] text-emerald-600 font-medium">+5.2% cross-checked</span>
                                  </div>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification Flags</span>
                                      <div className="text-2xl font-bold text-amber-600 mt-1">3 Flagged</div>
                                      <span className="text-[11px] text-slate-500 font-medium">LinkedIn mismatch alerts</span>
                                  </div>
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Saved</span>
                                      <div className="text-2xl font-bold text-emerald-600 mt-1">42.5 hrs</div>
                                      <span className="text-[11px] text-slate-500 font-medium">This month / recruiter</span>
                                  </div>
                              </div>

                              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                                      <div className="flex items-center gap-2">
                                          <h3 className="font-bold text-slate-800 text-sm sm:text-base">Role: Senior Full Stack Engineer</h3>
                                          <span className="px-2 py-0.5 rounded text-xs bg-brand-100 text-brand-700 font-semibold">18 Candidates</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">Filter Risk</button>
                                          <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white shadow-sm hover:bg-brand-700">+ Add CVs</button>
                                      </div>
                                  </div>

                                  <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs sm:text-sm">
                                          <thead className="bg-slate-100/70 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                              <tr>
                                                  <th className="py-3 px-4">Candidate Name</th>
                                                  <th className="py-3 px-4">AI Match Score</th>
                                                  <th className="py-3 px-4">Nolyvra Verify Status</th>
                                                  <th className="py-3 px-4">Current Role</th>
                                                  <th className="py-3 px-4 text-right">Quick Action</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">

                                              <tr className="hover:bg-brand-50/30 transition-colors">
                                                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">TH</div>
                                                      <div>
                                                          <div>Tane Heke</div>
                                                          <span className="text-[11px] font-normal text-slate-400">tane.heke@devmail.io</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <div className="flex items-center gap-2">
                                                          <div className="w-16 bg-slate-100 rounded-full h-2">
                                                              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                                                          </div>
                                                          <span className="font-bold text-emerald-600">0.92</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                          <i className="fa-solid fa-circle-check text-[10px]"></i> Verified (0 Flags)
                                                      </span>
                                                  </td>
                                                  <td className="py-3.5 px-4 text-slate-600">Lead Tech Architect @ Canva</td>
                                                  <td className="py-3.5 px-4 text-right">
                                                      <button onClick={() => showToast('Interview invite generated for Tane Heke')} className="px-3 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 font-semibold text-xs transition-colors">
                                                          Schedule Interview
                                                      </button>
                                                  </td>
                                              </tr>

                                              <tr className="hover:bg-amber-50/30 transition-colors">
                                                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs">IM</div>
                                                      <div>
                                                          <div>Isla McGregor</div>
                                                          <span className="text-[11px] font-normal text-slate-400">isla@techhub.co</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <div className="flex items-center gap-2">
                                                          <div className="w-16 bg-slate-100 rounded-full h-2">
                                                              <div className="bg-amber-500 h-2 rounded-full" style={{ width: '68%' }}></div>
                                                          </div>
                                                          <span className="font-bold text-amber-600">0.68</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                          <i className="fa-solid fa-triangle-exclamation text-[10px]"></i> 2 CV-LinkedIn Flags
                                                      </span>
                                                  </td>
                                                  <td className="py-3.5 px-4 text-slate-600">Senior Dev @ Freelance</td>
                                                  <td className="py-3.5 px-4 text-right">
                                                      <button onClick={() => showToast('Validation questions opened for Isla McGregor')} className="px-3 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-xs transition-colors">
                                                          Review Flags
                                                      </button>
                                                  </td>
                                              </tr>

                                              <tr className="hover:bg-brand-50/30 transition-colors">
                                                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">OV</div>
                                                      <div>
                                                          <div>Oliver Vance</div>
                                                          <span className="text-[11px] font-normal text-slate-400">oli.vance@global.de</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <div className="flex items-center gap-2">
                                                          <div className="w-16 bg-slate-100 rounded-full h-2">
                                                              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '84%' }}></div>
                                                          </div>
                                                          <span className="font-bold text-emerald-600">0.84</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-3.5 px-4">
                                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                          <i className="fa-solid fa-circle-check text-[10px]"></i> Verified (0 Flags)
                                                      </span>
                                                  </td>
                                                  <td className="py-3.5 px-4 text-slate-600">Backend Lead @ Atlassian</td>
                                                  <td className="py-3.5 px-4 text-right">
                                                      <button onClick={() => showToast('Interview invite generated for Oliver Vance')} className="px-3 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 font-semibold text-xs transition-colors">
                                                          Schedule Interview
                                                      </button>
                                                  </td>
                                              </tr>
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </section>

          <section id="calculator" className="py-20 bg-white border-y border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

                      <div className="lg:col-span-5 space-y-6">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider">
                              <i className="fa-solid fa-calculator"></i> Tool Sprawl vs Real ROI
                          </div>
                          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                              Stop paying $465-$565/mo per recruiter across fragmented tools.
                          </h2>
                          <p className="text-slate-600 text-base leading-relaxed">
                              Recruitment agencies waste thousands per consultant each year paying separately for ATS systems, LinkedIn Recruiter Lite, standalone Calendly links, bulk email warmers, and ChatGPT Plus subscriptions.
                          </p>

                          <div className="space-y-3 pt-2">
                              <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                                      <i className="fa-solid fa-xmark text-xs"></i>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700">High monthly subscription overhead per seat</span>
                              </div>
                              <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                                      <i className="fa-solid fa-xmark text-xs"></i>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700">Manual data copy-pasting between ATS, emails & spreadsheets</span>
                              </div>
                              <div className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                      <i className="fa-solid fa-check text-xs"></i>
                                  </div>
                                  <span className="text-sm font-medium text-slate-900 font-semibold">Nolyvra unifies all 16 core modules into one $39/mo rate</span>
                              </div>
                          </div>
                      </div>

                      <div className="lg:col-span-7 bg-slate-50 border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-xl">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                  <i className="fa-solid fa-sliders text-brand-600"></i>
                                  Interactive ROI & Savings Calculator
                              </h3>
                              <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2.5 py-1 rounded-full">Instant Estimate</span>
                          </div>

                          <div className="space-y-6">

                              <div>
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="text-sm font-semibold text-slate-700">Number of Recruiters / Consultants:</label>
                                      <span id="team-size-val" className="text-base font-extrabold text-brand-600 bg-white px-3 py-1 rounded-lg border border-slate-200">{teamSize} Consultant{teamSize === 1 ? '' : 's'}</span>
                                  </div>
                                  <input type="range" id="team-size" min="1" max="50" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600" />
                              </div>

                              <div>
                                  <label className="text-sm font-semibold text-slate-700 block mb-3">Select tools currently in your stack:</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-brand-300">
                                          <input type="checkbox" className="tool-checkbox accent-brand-600" value="180" checked={selectedTools.includes(180)} onChange={() => toggleTool(180)} />
                                          <span className="font-medium text-slate-800">LinkedIn Recruiter Lite ($180/mo)</span>
                                      </label>
                                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-brand-300">
                                          <input type="checkbox" className="tool-checkbox accent-brand-600" value="150" checked={selectedTools.includes(150)} onChange={() => toggleTool(150)} />
                                          <span className="font-medium text-slate-800">Bullhorn / JobAdder ATS ($150/mo)</span>
                                      </label>
                                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-brand-300">
                                          <input type="checkbox" className="tool-checkbox accent-brand-600" value="45" checked={selectedTools.includes(45)} onChange={() => toggleTool(45)} />
                                          <span className="font-medium text-slate-800">Email Marketing & Outreach ($45/mo)</span>
                                      </label>
                                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-brand-300">
                                          <input type="checkbox" className="tool-checkbox accent-brand-600" value="20" checked={selectedTools.includes(20)} onChange={() => toggleTool(20)} />
                                          <span className="font-medium text-slate-800">Calendly / Scheduler ($20/mo)</span>
                                      </label>
                                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-brand-300 sm:col-span-2">
                                          <input type="checkbox" className="tool-checkbox accent-brand-600" value="30" checked={selectedTools.includes(30)} onChange={() => toggleTool(30)} />
                                          <span className="font-medium text-slate-800">ChatGPT Plus & AI CV Parsers ($30/mo)</span>
                                      </label>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Estimated Annual Cost Savings</span>
                                      <span id="annual-savings" className="text-2xl sm:text-3xl font-extrabold text-emerald-600">${annualSavings.toLocaleString('en-US')} USD</span>
                                      <span className="text-[11px] text-slate-400 block mt-1">vs traditional tool stack</span>
                                  </div>
                                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Monthly Hours Saved</span>
                                      <span id="hours-saved" className="text-2xl sm:text-3xl font-extrabold text-brand-600">{hoursSaved.toLocaleString('en-US')} Hours</span>
                                      <span className="text-[11px] text-slate-400 block mt-1">45 hrs per recruiter / month</span>
                                  </div>
                              </div>

                              <button onClick={() => showToast('ROI report generated for your team size!')} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors text-center shadow-md">
                                  Lock In Early-Customer Rate ($39/mo)
                              </button>
                          </div>
                      </div>

                  </div>
              </div>
          </section>

          <section id="features" className="py-20 bg-slate-50/50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center max-w-3xl mx-auto mb-16">
                      <h2 className="text-xs uppercase font-bold tracking-widest text-brand-600 mb-2">16 Modules in One Login</h2>
                      <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                          Engineered to replace your entire fragmented stack.
                      </h3>
                      <p className="text-slate-600 mt-4 text-base">
                          Nolyvra combines candidate verification, workflow automation, pipeline tracking, and client growth tools into a unified workspace.
                      </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl mb-6">
                              <i className="fa-solid fa-user-shield"></i>
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 mb-3">1. Candidate Intelligence</h4>
                          <p className="text-slate-600 text-sm leading-relaxed mb-6">
                              Deep AI analysis that scrutinizes candidate profiles beyond surface resume keywords.
                          </p>
                          <ul className="space-y-3 text-sm text-slate-700">
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span><strong>Nolyvra Verify:</strong> Cross-checks CV dates against LinkedIn</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Timeline gap detection & qualification validation</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Capability & Seniority match scoring</span>
                              </li>
                          </ul>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                          <div className="w-12 h-12 rounded-2xl bg-accent-50 text-accent-600 flex items-center justify-center text-xl mb-6" style={{ backgroundColor: '#f3e8ff' }}>
                              <i className="fa-solid fa-envelope-open-text"></i>
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 mb-3">2. Workflow & Comms</h4>
                          <p className="text-slate-600 text-sm leading-relaxed mb-6">
                              Automate manual outreach, interview scheduling, and candidate touchpoints seamlessly.
                          </p>
                          <ul className="space-y-3 text-sm text-slate-700">
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>AI Personalized Email drafting & sequence engine</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Email Centre: Gmail & Outlook two-way sync</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Conflict-free calendar scheduler (.ics integration)</span>
                              </li>
                          </ul>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mb-6">
                              <i className="fa-solid fa-chart-line"></i>
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 mb-3">3. Pipeline & Visibility</h4>
                          <p className="text-slate-600 text-sm leading-relaxed mb-6">
                              Real-time executive oversight into candidate progress and funnel bottlenecks.
                          </p>
                          <ul className="space-y-3 text-sm text-slate-700">
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Live pipeline boards & stage velocity tracking</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Leaky-funnel bottleneck alerts (e.g. slow client feedback)</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>24/7 AI Co-Worker automated candidate screening</span>
                              </li>
                          </ul>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-6">
                              <i className="fa-solid fa-briefcase"></i>
                          </div>
                          <h4 className="text-xl font-bold text-slate-900 mb-3">4. Growth & BD (CRMx)</h4>
                          <p className="text-slate-600 text-sm leading-relaxed mb-6">
                              Turn past candidates and client leads into high-margin repeat recruitment assignments.
                          </p>
                          <ul className="space-y-3 text-sm text-slate-700">
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>AI Talent Search across your internal database in plain English</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Client Tracker & job record creation from email in &lt;60s</span>
                              </li>
                              <li className="flex items-center gap-2">
                                  <i className="fa-solid fa-circle-check text-brand-600 text-xs"></i>
                                  <span>Post-placement relationship management alerts</span>
                              </li>
                          </ul>
                      </div>

                  </div>
              </div>
          </section>

          <section id="verify-simulator" className="py-20 bg-white border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center max-w-3xl mx-auto mb-12">
                      <span className="px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 font-bold text-xs uppercase tracking-wider">
                          Interactive Feature Demo
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                          Try the "Nolyvra Verify" Candidate Analyzer
                      </h2>
                      <p className="text-slate-600 mt-3 text-base">
                          Click on different candidate profiles below to test how our AI detects hidden CV inconsistencies, cross-references LinkedIn, and generates interview validation questions.
                      </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                      <button onClick={() => setSelectedProfile('dev')} id="tab-dev" className={`profile-tab px-5 py-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${selectedProfile === 'dev' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                          <i className="fa-solid fa-code"></i> Senior Backend Engineer
                      </button>
                      <button onClick={() => setSelectedProfile('pm')} id="tab-pm" className={`profile-tab px-5 py-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${selectedProfile === 'pm' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                          <i className="fa-solid fa-layer-group"></i> Product Manager
                      </button>
                      <button onClick={() => setSelectedProfile('bdm')} id="tab-bdm" className={`profile-tab px-5 py-3 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${selectedProfile === 'bdm' ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                          <i className="fa-solid fa-chart-pie"></i> Business Development Manager
                      </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                          <div className="flex items-center gap-4">
                              <div id="sim-avatar" className="w-14 h-14 rounded-2xl bg-brand-600 text-white font-extrabold text-xl flex items-center justify-center shadow-md">
                                  {profile.avatar}
                              </div>
                              <div>
                                  <h3 id="sim-name" className="text-xl font-bold text-slate-900">{profile.name}</h3>
                                  <p id="sim-role" className="text-sm font-medium text-slate-500">{profile.role}</p>
                              </div>
                          </div>
                          <div id="sim-risk-badge" className={`px-4 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 ${profile.riskClass}`}>
                              <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                              <span>{profile.riskText}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                              <span className="text-xs text-slate-500 font-medium">Consistency Score</span>
                              <div id="sim-score-consistency" className={`text-2xl font-extrabold mt-1 ${profile.consistency.color}`}>{profile.consistency.score}%</div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                  <div id="bar-consistency" className={`h-1.5 rounded-full ${profile.consistency.bar}`} style={{ width: `${profile.consistency.score}%` }}></div>
                              </div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                              <span className="text-xs text-slate-500 font-medium">Capability Match</span>
                              <div id="sim-score-capability" className={`text-2xl font-extrabold mt-1 ${profile.capability.color}`}>{profile.capability.score}%</div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                  <div id="bar-capability" className={`h-1.5 rounded-full ${profile.capability.bar}`} style={{ width: `${profile.capability.score}%` }}></div>
                              </div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
                              <span className="text-xs text-slate-500 font-medium">Timeline Match</span>
                              <div id="sim-score-timeline" className={`text-2xl font-extrabold mt-1 ${profile.timeline.color}`}>{profile.timeline.score}%</div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                  <div id="bar-timeline" className={`h-1.5 rounded-full ${profile.timeline.bar}`} style={{ width: `${profile.timeline.score}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                          <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl">
                              <h4 className="font-bold text-emerald-800 text-sm flex items-center gap-2 mb-3">
                                  <i className="fa-solid fa-circle-check text-emerald-600"></i> Verified Strengths
                              </h4>
                              <ul id="sim-strengths" className="space-y-2 text-xs sm:text-sm text-slate-700">
                                  {profile.strengths.map((strength) => <li key={strength} className="flex items-start gap-2"><i className="fa-solid fa-check text-emerald-600 mt-1"></i><span>{strength}</span></li>)}
                              </ul>
                          </div>

                          <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl">
                              <h4 className="font-bold text-rose-800 text-sm flex items-center gap-2 mb-3">
                                  <i className="fa-solid fa-triangle-exclamation text-rose-600"></i> Discrepancy & Risk Flags
                              </h4>
                              <ul id="sim-flags" className="space-y-2 text-xs sm:text-sm text-slate-700">
                                  {profile.flags.map(([label, detail]) => <li key={label} className="flex items-start gap-2"><i className="fa-solid fa-triangle-exclamation text-rose-500 mt-1"></i><span><strong>{label}:</strong> {detail}</span></li>)}
                              </ul>
                          </div>
                      </div>

                      <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                              <i className="fa-solid fa-clipboard-question text-brand-600"></i> Suggested Interview Validation Questions
                          </h4>
                          <ol id="sim-questions" className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-600 font-medium">
                              {profile.questions.map((question) => <li key={question} className="py-0.5">{question}</li>)}
                          </ol>
                      </div>
                  </div>
              </div>
          </section>

          <section id="how-it-works" className="py-20 bg-slate-50/50 border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center max-w-3xl mx-auto mb-16">
                      <span className="text-xs uppercase font-bold tracking-widest text-brand-600">Simple Workflow</span>
                      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-2">
                          How Nolyvra Accelerates Your Placements
                      </h2>
                      <p className="text-slate-600 mt-3 text-base">
                          5 seamless steps from job intake to post-placement client growth.
                      </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative hover:border-brand-300 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center mb-4">1</div>
                          <h4 className="font-bold text-slate-900 text-base mb-2">Create Job in &lt;60s</h4>
                          <p className="text-slate-600 text-xs leading-relaxed">
                              Paste brief or fetch direct job links from SEEK or LinkedIn in seconds.
                          </p>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative hover:border-brand-300 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center mb-4">2</div>
                          <h4 className="font-bold text-slate-900 text-base mb-2">Bring Candidates</h4>
                          <p className="text-slate-600 text-xs leading-relaxed">
                              Bulk CV upload (PDF/DOC) or search database in plain English with AI Talent Search.
                          </p>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative hover:border-brand-300 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center mb-4">3</div>
                          <h4 className="font-bold text-slate-900 text-base mb-2">AI Analyzes & Verifies</h4>
                          <p className="text-slate-600 text-xs leading-relaxed">
                              Nolyvra Verify scores consistency, capability, timeline & cross-checks LinkedIn.
                          </p>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative hover:border-brand-300 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center mb-4">4</div>
                          <h4 className="font-bold text-slate-900 text-base mb-2">Interview & Schedule</h4>
                          <p className="text-slate-600 text-xs leading-relaxed">
                              Use tailored validation questions & send conflict-free scheduler invites.
                          </p>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative hover:border-brand-300 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center mb-4">5</div>
                          <h4 className="font-bold text-slate-900 text-base mb-2">Place, Track & Grow</h4>
                          <p className="text-slate-600 text-xs leading-relaxed">
                              Monitor live pipeline bottlenecks and manage client accounts with CRMx.
                          </p>
                      </div>
                  </div>
              </div>
          </section>

          <section id="results" className="py-20 bg-slate-900 text-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-16 border-b border-slate-800 text-center">
                      <div>
                          <div className="text-4xl sm:text-5xl font-extrabold text-brand-400">4x</div>
                          <div className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Faster Candidate Screening</div>
                      </div>
                      <div>
                          <div className="text-4xl sm:text-5xl font-extrabold text-emerald-400">30-60 hrs</div>
                          <div className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Saved per recruiter / mo</div>
                      </div>
                      <div>
                          <div className="text-4xl sm:text-5xl font-extrabold text-amber-400">$465+</div>
                          <div className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Monthly tool stack replaced</div>
                      </div>
                      <div>
                          <div className="text-4xl sm:text-5xl font-extrabold text-brand-400">16 Modules</div>
                          <div className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">In one unified platform</div>
                      </div>
                  </div>

                  <div className="pt-12 pb-16 text-center">
                      <div className="inline-flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-semibold tracking-wider uppercase">
                          <span>Built in Melbourne, Australia</span>
                          <span>•</span>
                          <span>Featured in APSCo Australia</span>
                          <span>•</span>
                          <span>Exhibitor at APSCo Emerge 26</span>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="bg-slate-800/70 p-6 rounded-2xl border border-slate-700">
                          <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                              <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">
                              "Nolyvra Verify caught a title discrepancy in a Senior Architect candidate that saved our team from a bad client presentation. The candidate analyzer is indispensable."
                          </p>
                          <div className="font-bold text-white text-sm">National Director</div>
                          <div className="text-slate-400 text-xs">Tech Recruitment Agency (Sydney)</div>
                      </div>

                      <div className="bg-slate-800/70 p-6 rounded-2xl border border-slate-700">
                          <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                              <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">
                              "We cancelled our separate outreach and calendar tools immediately. Nolyvra saved us over $2,000 per month across our 5 consultants."
                          </p>
                          <div className="font-bold text-white text-sm">Managing Partner</div>
                          <div className="text-slate-400 text-xs">Executive Search Firm (Melbourne)</div>
                      </div>

                      <div className="bg-slate-800/70 p-6 rounded-2xl border border-slate-700">
                          <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                              <i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i><i className="fa-solid fa-star"></i>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">
                              "The AI Co-Worker feature screens incoming CVs in real time and automatically prepares targeted interview questions for my morning client calls."
                          </p>
                          <div className="font-bold text-white text-sm">Senior Talent Sourcer</div>
                          <div className="text-slate-400 text-xs">Global Recruitment Consultancy (Auckland)</div>
                      </div>
                  </div>
              </div>
          </section>

          <section id="integrations" className="py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div className="text-center mb-16">
          <span className="text-xs uppercase font-bold tracking-widest text-brand-600">Ecosystem</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">Seamlessly Integrated With Your Entire Workflow</h3>
          <p className="text-slate-500 text-sm mt-2 max-w-xl mx-auto">
              Connect Nolyvra directly with your existing ATS, CRM, local job boards, calendars, and email stacks.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 mt-8 max-w-5xl mx-auto text-slate-700 font-semibold text-sm">

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  SEEK
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/indeed.svg" alt="Indeed logo" className="w-4 h-4 opacity-80" /> Indeed
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                   Trade Me Jobs
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linkedin.svg" alt="LinkedIn logo" className="w-4 h-4 opacity-80" /> LinkedIn
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/zoho.svg" alt="Zoho logo" className="w-4 h-4 opacity-80" /> Zoho Mail & Calendar
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/gmail.svg" alt="Gmail logo" className="w-4 h-4 opacity-80" /> Gmail
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/microsoftoutlook.svg" alt="Outlook logo" className="w-4 h-4 opacity-80" /> Outlook
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/googlecalendar.svg" alt="Google Calendar logo" className="w-4 h-4 opacity-80" /> Google Calendar
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <i className="fa-solid fa-briefcase text-slate-800"></i> JobAdder
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <i className="fa-solid fa-bullhorn text-slate-800"></i> Bullhorn
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/hubspot.svg" alt="HubSpot logo" className="w-4 h-4 opacity-80" /> HubSpot
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/greenhouse.svg" alt="Greenhouse logo" className="w-4 h-4 opacity-80" /> Greenhouse
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/xero.svg" alt="Xero logo" className="w-4 h-4 opacity-80" /> Xero
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/myob.svg" alt="MYOB logo" className="w-4 h-4 opacity-80" /> MYOB
              </span>

              <span className="flex items-center gap-2 hover:text-brand-600 transition-colors">
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/slack.svg" alt="Slack logo" className="w-4 h-4 opacity-80" /> Slack
              </span>

          </div>
      </div>

                  <div className="max-w-4xl mx-auto bg-gradient-to-br from-brand-50 via-white to-slate-50 rounded-3xl border-2 border-brand-200 p-8 sm:p-12 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-brand-600 text-white text-[11px] uppercase tracking-widest font-extrabold px-6 py-1.5 rounded-bl-2xl">
                          Early-Customer Special
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                          <div className="md:col-span-7 space-y-4">
                              <span className="px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">1-Month Free Trial</span>
                              <h3 className="text-3xl font-extrabold text-slate-900">Get Started with Nolyvra Today</h3>
                              <p className="text-slate-600 text-sm leading-relaxed">
                                  Includes complete access to all 16 workspace modules, Nolyvra Verify AI analyzer, two-way email sync, and dedicated New Zealand onboarding support.
                              </p>
                              <ul className="space-y-2 text-xs sm:text-sm text-slate-700 font-medium">
                                  <li className="flex items-center gap-2">
                                      <i className="fa-solid fa-check text-emerald-500 font-bold"></i>
                                      Free 1-on-1 Onboarding Workshop
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <i className="fa-solid fa-check text-emerald-500 font-bold"></i>
                                      Direct New Zealand Support Line
                                  </li>
                                  <li className="flex items-center gap-2">
                                      <i className="fa-solid fa-check text-emerald-500 font-bold"></i>
                                      Cancel or modify anytime with zero lock-in contracts
                                  </li>
                              </ul>
                          </div>

                          <div className="md:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center">
                              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Early-Customer Rate</span>
                              <div className="flex items-baseline justify-center gap-1 my-3">
                                  <span className="text-4xl font-extrabold text-slate-900">$39</span>
                                  <span className="text-slate-500 text-sm font-medium">/ seat / mo USD</span>
                              </div>
                              <span className="text-xs text-emerald-600 font-bold block mb-6">Replaces $465/mo in standard tools</span>
                              <button onClick={() => showToast('Initiating free trial registration...')} className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-700 hover:to-accent-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/20 transition-all">
                                  Start 1-Month Free Trial
                              </button>
                          </div>
                      </div>
                  </div>

              </div>
          </section>

      <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-200 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                  <div>
                      <span className="px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 font-bold text-xs uppercase tracking-wider">
                          Transparent Pricing
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                          Flexible Plans for Every Stage
                      </h2>
                      <p className="text-slate-600 mt-2 text-base">
                          Scale seamlessly from free trial to enterprise-grade recruitment intelligence.
                      </p>
                  </div>

                  <div className="flex items-center gap-3">
                      <button id="price-scroll-left" onClick={() => scrollPricing(-1)} aria-label="Scroll pricing plans left" className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-chevron-left text-sm"></i>
                      </button>
                      <button id="price-scroll-right" onClick={() => scrollPricing(1)} aria-label="Scroll pricing plans right" className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center shadow-sm transition-all active:scale-95">
                          <i className="fa-solid fa-chevron-right text-sm"></i>
                      </button>
                  </div>
              </div>

              <div className="-mt-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-brand-50 border border-brand-200">
                  <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 text-brand-600 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-handshake"></i>
                  </div>
                  <p className="flex-1 text-sm text-slate-700 leading-relaxed">
                      <strong className="text-slate-900">Sign up through Quantium Labs and get more.</strong> Exclusive partner pricing, a free 1-on-1 onboarding workshop, hands-on data migration and dedicated local NZ support — all at no extra cost.
                  </p>
                  <button type="button" data-cal-namespace="30min" data-cal-link="quantiumlabs-labs/30min" data-cal-config='{"layout":"month_view","theme":"light"}'
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition-colors whitespace-nowrap">
                      Book a call →
                  </button>
              </div>

              <div id="pricing-carousel" ref={pricingCarousel} className="pricing-carousel flex items-stretch gap-6 overflow-x-auto pb-8 pt-6 px-2 scroll-smooth">

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between shrink-0 hover:shadow-lg transition-all">
                      <div className="flex flex-col flex-1">
                          <div className="mb-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                                  <i className="fa-solid fa-cube text-slate-500"></i> FREE
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Free Trial</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">Try Nolyvra free for 1 month. No credit card required.</p>

                          <div className="my-5">
                              <div className="text-3xl font-extrabold text-slate-900">$0</div>
                              <span className="text-[11px] text-slate-500 block mt-1">1 month trial - No card needed</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">100</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">1</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> AI Candidate Analysis</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> CV vs LinkedIn Scoring</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Risk Flag Detection</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Authenticity Detection</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Placement Probability</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> AI Email Generator</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Interview Scheduler</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> Advanced Analytics</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> Dedicated Support</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Starting 1-month Free Trial...')} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors">
                              Start Free Trial
                          </button>
                          <span className="text-[10px] text-transparent block mt-2 select-none">✦ Free trial offer</span>
                      </div>
                  </div>

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border border-emerald-200 p-6 shadow-sm flex flex-col justify-between shrink-0 hover:shadow-lg transition-all">
                      <div className="flex flex-col flex-1">
                          <div className="mb-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                  <i className="fa-solid fa-bolt text-emerald-500"></i> INTRODUCTORY OFFER
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Introductory Offer</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">Special introductory pricing to help you get started.</p>

                          <div className="my-5">
                              <span className="text-[10px] text-slate-400 font-semibold block">Starting from</span>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-extrabold text-slate-900">$39</span>
                                  <span className="text-xs text-slate-500">/ month · billed yearly</span>
                              </div>
                              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Save 20% vs monthly
                              </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">100</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">1</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> AI Candidate Analysis</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> CV vs LinkedIn Scoring</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Risk Flag Detection</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Authenticity Detection</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Placement Probability</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> AI Email Generator</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500"></i> Top-up credits anytime</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> AI Talent Search</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> Advanced AI Model</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Selecting Introductory Offer...')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                              Get Started
                          </button>
                          <span className="text-[10px] text-transparent block mt-2 select-none">✦ Intro launch offer</span>
                      </div>
                  </div>

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between shrink-0 hover:shadow-lg transition-all">
                      <div className="flex flex-col flex-1">
                          <div className="mb-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                                  <i className="fa-solid fa-trophy text-amber-500"></i> BRONZE
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Solopreneur</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">Perfect for independent recruiters managing their own desk.</p>

                          <div className="my-5">
                              <span className="text-[11px] text-slate-400 line-through">$149 / month</span>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-extrabold text-slate-900">$99</span>
                                  <span className="text-xs text-slate-500">/ month · billed yearly</span>
                              </div>
                              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Save $600/yr · First year pricing
                              </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">500</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits/Mo</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">1</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Everything in Free</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> AI Talent Search</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Interview Scheduler</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Client Brief Analyzer</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Limited Email Support</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> Advanced AI Model</li>
                              <li className="flex items-center gap-2 text-slate-300"><i className="fa-solid fa-circle-xmark text-slate-300"></i> Multi-user Access</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Selecting Solopreneur Plan...')} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                              Get Started
                          </button>
                          <span className="text-[10px] text-emerald-600 font-bold block mt-2">✦ First year launch pricing</span>
                      </div>
                  </div>

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border-2 border-brand-600 p-6 shadow-xl flex flex-col justify-between shrink-0 relative hover:shadow-2xl transition-all">

                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white px-4 py-1 rounded-full text-[10px] uppercase font-extrabold tracking-wider shadow-md flex items-center gap-1">
                          <i className="fa-solid fa-star text-amber-300"></i> Most Popular
                      </div>

                      <div className="flex flex-col flex-1">
                          <div className="mb-4 pt-1">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 uppercase tracking-wider">
                                  <i className="fa-solid fa-trophy text-brand-600"></i> SILVER
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Small Enterprise</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">For growing recruitment teams managing multiple clients.</p>

                          <div className="my-5">
                              <span className="text-[11px] text-slate-400 line-through">$299 / month</span>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-extrabold text-slate-900">$199</span>
                                  <span className="text-xs text-slate-500">/ month · billed yearly</span>
                              </div>
                              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Save $1,200/yr · First year pricing
                              </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">750</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits/Mo</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">5</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Users</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Everything in Bronze</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Advanced AI Model</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Email Integration</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Chat Integration</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> LinkedIn / Indeed / Seek Search</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> 5 Team Members</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-brand-600"></i> Priority Support</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Selecting Small Enterprise Plan...')} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/25 transition-colors">
                              Get Started
                          </button>
                          <span className="text-[10px] text-emerald-600 font-bold block mt-2">✦ First year launch pricing</span>
                      </div>
                  </div>

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between shrink-0 hover:shadow-lg transition-all">
                      <div className="flex flex-col flex-1">
                          <div className="mb-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                                  <i className="fa-solid fa-trophy text-amber-500"></i> GOLD
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Medium Enterprise</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">For established agencies with high-volume hiring needs.</p>

                          <div className="my-5">
                              <span className="text-[11px] text-slate-400 line-through">$449 / month</span>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-extrabold text-slate-900">$299</span>
                                  <span className="text-xs text-slate-500">/ month · billed yearly</span>
                              </div>
                              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Save $1,800/yr · First year pricing
                              </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">3,000</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits/Mo</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">15</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Users</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> Everything in Silver</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> Premium AI Engine</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> Video Interview</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> Advanced Analytics</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> 15 Team Members</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-amber-500"></i> Dedicated Support</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Selecting Medium Enterprise Plan...')} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                              Get Started
                          </button>
                          <span className="text-[10px] text-emerald-600 font-bold block mt-2">✦ First year launch pricing</span>
                      </div>
                  </div>

                  <div className="min-w-[290px] w-[290px] bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between shrink-0 hover:shadow-lg transition-all">
                      <div className="flex flex-col flex-1">
                          <div className="mb-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-accent-50 text-accent-700 border border-accent-200 uppercase tracking-wider" style={{ backgroundColor: '#f3e8ff' }}>
                                  <i className="fa-solid fa-gem text-accent-600"></i> ENTERPRISE
                              </span>
                          </div>
                          <h3 className="text-xl font-extrabold text-slate-900">Large Enterprise</h3>
                          <p className="text-xs text-slate-500 mt-1 min-h-[32px]">Custom solutions for large-scale recruitment operations.</p>

                          <div className="my-5">
                              <div className="text-2xl font-extrabold text-slate-900">Custom Pricing</div>
                              <span className="text-[11px] text-slate-500 block mt-1">Tailored to your organisation</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-6">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-xs font-bold text-slate-700 block">Custom</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Credits</span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                                  <span className="text-base font-extrabold text-slate-800 block">∞</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Users</span>
                              </div>
                          </div>

                          <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-5 flex-1">
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-accent-600"></i> Everything in Gold</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-accent-600"></i> Dedicated Account Manager</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-accent-600"></i> Custom Integrations</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-accent-600"></i> SLA & Uptime Guarantee</li>
                              <li className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-accent-600"></i> White-label Options</li>
                          </ul>
                      </div>

                      <div className="pt-6 text-center">
                          <button onClick={() => showToast('Connecting with Enterprise Sales...')} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors">
                              Contact Sales
                          </button>
                          <span className="text-[10px] text-transparent block mt-2 select-none">✦ Custom enterprise plan</span>
                      </div>
                  </div>

              </div>
          </div>
      </section>

          <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
                      <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3">
                              <img src="/nolyvra_logo.png" alt="Nolyvra" className="w-8 h-8 rounded-lg object-cover" />
                              <div>
                                  <span className="font-extrabold text-white text-lg tracking-tight">Nolyvra</span>
                                  <span className="text-xs text-slate-400 block">Intelligence. Evolved.</span>
                              </div>
                          </div>
                          <span className="text-slate-600 text-lg font-light">×</span>
                          <span className="bg-white rounded-lg px-2.5 py-1.5">
                              <img src="/quantiuamlabs_logo.png" alt="Quantium Labs" className="h-7 w-auto object-contain" />
                          </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
                          <span>Hamilton, New Zealand</span>
                          <span>•</span>
                          <a href="mailto:info@quantiumlabs.co.nz" className="hover:text-white transition-colors">info@quantiumlabs.co.nz</a>
                          <span>•</span>
                          <a href="https://quantiumlabs.co.nz/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">www.quantiumlabs.co.nz</a>
                      </div>
                  </div>

                  <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
                      <div>2026 Nolyvra. All rights reserved.</div>
                      <div className="flex gap-4">
                          <a href="#" className="hover:text-slate-400">Privacy Policy</a>
                          <a href="#" className="hover:text-slate-400">Terms of Service</a>
                          <a href="#" className="hover:text-slate-400">Security</a>
                      </div>
                  </div>
              </div>
          </footer>

    </div>
  );
}
