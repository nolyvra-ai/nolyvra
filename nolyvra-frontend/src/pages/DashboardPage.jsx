import React, { useEffect, useMemo, useState } from "react";
import { useAppMode } from "../context/AppModeContext";
import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ProductWalkthroughModal from "../components/onboarding/ProductWalkthroughModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
  return res.json();
}

// ── Palette ────────────────────────────────────────────────────────────────
const SURFACE  = "#FFFFFF";
const BORDER   = "#E8ECF2";
const MUTED    = "#8A94A6";
const TEXT     = "#0F1623";
const ACCENT   = "#1D72E8";
const SUCCESS  = "#16A34A";
const WARN     = "#D97706";
const DANGER   = "#DC2626";
const PURPLE   = "#7C3AED";
const ACCENT_L  = "#EFF6FF";
const SUCCESS_L = "#F0FDF4";
const WARN_L    = "#FFFBEB";
const DANGER_L  = "#FEF2F2";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";

// ── KPI icons ──────────────────────────────────────────────────────────────
function IcoBriefcase({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}
function IcoUsers({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IcoTrend({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IcoShield({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IcoBell() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

// ── Reminder icons ─────────────────────────────────────────────────────────
function IcoClock({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IcoCalendar({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IcoPeople({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IcoDoc({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IcoSpark({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}

// ── Shared card shell ──────────────────────────────────────────────────────
const CARD_BASE = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
  overflow: "hidden",
};

function Card({ children, sx = {} }) {
  return <Paper elevation={0} sx={{ ...CARD_BASE, ...sx }}>{children}</Paper>;
}

function CardHead({ title, action, isNew = false }) {
  return (
    <Box sx={{
      px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
        {isNew && (
          <Box sx={{
            fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
            border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
          }}>NEW</Box>
        )}
      </Box>
      {action}
    </Box>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <Box onClick={onClick} sx={{
      fontSize: 12, fontWeight: 600, color: ACCENT,
      cursor: "pointer", userSelect: "none",
      "&:hover": { textDecoration: "underline" },
    }}>{children}</Box>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, iconBg, icon }) {
  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, p: 2.25, display: "flex", alignItems: "flex-start", gap: 2 }}>
      <Box sx={{
        width: 46, height: 46, borderRadius: "11px", bgcolor: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: "0.55px",
        }}>{label}</Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 800, color: TEXT, lineHeight: 1.15, mt: 0.25 }}>
          {value ?? 0}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 11, color: subColor ?? MUTED, mt: 0.2 }}>{sub}</Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, variant = "neutral" }) {
  const styles = {
    success: { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS },
    warning: { bg: WARN_L,    border: "#FDE68A", color: WARN    },
    danger:  { bg: DANGER_L,  border: "#FECACA", color: DANGER  },
    accent:  { bg: ACCENT_L,  border: "#BFDBFE", color: ACCENT  },
    neutral: { bg: "#F1F3F7", border: BORDER,    color: MUTED   },
    purple:  { bg: PURPLE_L,  border: PURPLE_BR, color: PURPLE  },
    urgent:  { bg: DANGER,    border: DANGER,    color: "#fff"  },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.25, py: "2px",
      fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap",
    }}>{label}</Box>
  );
}

// ── Table header cell style ────────────────────────────────────────────────
const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2.5, whiteSpace: "nowrap",
};

// ── Score cell ─────────────────────────────────────────────────────────────
function ScoreCell({ value }) {
  if (!value) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const color = value >= 85 ? SUCCESS : value >= 70 ? WARN : DANGER;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, minWidth: 34 }}>{value}%</Typography>
      <Box sx={{ width: 56, height: 4, bgcolor: "#F0F2F6", borderRadius: "2px", overflow: "hidden" }}>
        <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: "2px" }} />
      </Box>
    </Box>
  );
}

// ── Pipeline bar ───────────────────────────────────────────────────────────
function PipelineBar({ label, count, pct, color }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <Typography sx={{ fontSize: 11.5, color: TEXT }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{count}</Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </Box>
    </Box>
  );
}

// ── Hiring Insights card ───────────────────────────────────────────────────
const STAGE_COLORS = ["#E05A27", "#D97706", "#16A34A", "#7C3AED"];

function HiringInsightsCard({ data }) {
  if (!data) return (
    <Paper elevation={0} sx={{ ...CARD_BASE, height: "100%" }}>
      <CardHead title="Hiring Insights" />
      <Box sx={{ p: 2 }}><Typography sx={{ fontSize: 12, color: MUTED }}>Loading…</Typography></Box>
    </Paper>
  );

  const { totalCandidates, stages, thisWeekCount, lastWeekCount } = data;
  const ratio = lastWeekCount > 0
    ? Math.round((thisWeekCount - lastWeekCount) / lastWeekCount * 100)
    : thisWeekCount > 0 ? 100 : 0;

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Hiring Insights" />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.75, flex: 1 }}>
        {stages.map((s, i) => (
          <Box key={s.label}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: TEXT }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: STAGE_COLORS[i] }}>
                {totalCandidates > 0 ? `${s.pct}%` : "—"}
              </Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
              <Box sx={{ width: `${s.pct}%`, height: "100%", bgcolor: STAGE_COLORS[i], borderRadius: "3px", transition: "width .4s" }} />
            </Box>
          </Box>
        ))}

        <Box sx={{ mt: "auto", pt: 1.5, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Typography sx={{ fontSize: 12, color: MUTED }}>Applying Ratio</Typography>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: ratio >= 0 ? SUCCESS : DANGER, lineHeight: 1.1 }}>
              {ratio >= 0 ? "+" : ""}{ratio}%
            </Typography>
            <Typography sx={{ fontSize: 10, color: MUTED }}>This Week</Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// ── Skill Gap radar chart ──────────────────────────────────────────────────
function RadarChart({ skills }) {
  const cx = 105, cy = 100, r = 72, n = skills.length;

  function pt(i, val) {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    const d = (Math.max(0, Math.min(100, val)) / 100) * r;
    return [cx + d * Math.cos(a), cy + d * Math.sin(a)];
  }

  function labelPt(i) {
    const a = (i * 2 * Math.PI / n) - Math.PI / 2;
    return [cx + (r + 20) * Math.cos(a), cy + (r + 20) * Math.sin(a)];
  }

  const poly = (pts) =>
    pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + "Z";

  const rings  = [25, 50, 75, 100].map(v => poly(Array.from({ length: n }, (_, i) => pt(i, v))));
  const reqPath  = poly(skills.map((s, i) => pt(i, s.requiredPct)));
  const poolPath = poly(skills.map((s, i) => pt(i, s.poolPct)));

  return (
    <svg width="210" height="210" viewBox="0 0 210 210" style={{ display: "block", margin: "0 auto" }}>
      {rings.map((d, i) => (
        <path key={i} d={d} fill={i === 3 ? "#F8F9FB" : "none"} stroke="#E8ECF2" strokeWidth="1" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="#E8ECF2" strokeWidth="1" />;
      })}
      <path d={reqPath}  fill="rgba(29,114,232,0.12)" stroke={ACCENT}   strokeWidth="2" strokeLinejoin="round" />
      <path d={poolPath} fill="rgba(22,163,74,0.12)"  stroke={SUCCESS}  strokeWidth="2" strokeLinejoin="round" />
      {skills.map((s, i) => {
        const [lx, ly] = labelPt(i);
        return (
          <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill={MUTED} style={{ fontFamily: "inherit" }}>
            {s.skill.length > 10 ? s.skill.slice(0, 9) + "…" : s.skill}
          </text>
        );
      })}
    </svg>
  );
}

function SkillGapCard({ data }) {
  const hasData = data && data.length >= 3;
  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Skill Gap Analysis" />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        <Typography sx={{ fontSize: 11, color: MUTED }}>
          Average candidate pool vs. job requirements
        </Typography>
        {hasData ? (
          <>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RadarChart skills={data.slice(0, 6)} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2.5, mt: 0.5 }}>
              {[{ color: ACCENT, label: "Required" }, { color: SUCCESS, label: "Current Pool" }].map(({ color, label }) => (
                <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, color: MUTED }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
              Add jobs and candidates to see skill gap analysis.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ── Bottleneck Alert card ──────────────────────────────────────────────────
function BottleneckCard({ data }) {
  function dotColor(days) {
    return days >= 7 ? DANGER : days >= 4 ? WARN : SUCCESS;
  }

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Bottleneck Alert" />
      <Box sx={{ px: 2, pt: 0.5, pb: 2, flex: 1 }}>
        <Typography sx={{ fontSize: 11, color: MUTED, mb: 1.5 }}>
          Roles lagging in the hiring process
        </Typography>
        {!data || data.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: MUTED, py: 2, textAlign: "center" }}>
            No bottlenecks detected.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {data.slice(0, 4).map((item, i) => {
              const color = dotColor(item.daysInStage);
              const pct   = Math.min(100, Math.round(item.daysInStage / 14 * 100));
              return (
                <Box key={i} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", p: "11px 14px" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box sx={{ flex: 1, pr: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.jobTitle}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>Stage: {item.stage}</Typography>
                    </Box>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0, mt: "3px" }} />
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1, mb: 0.75 }}>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>Days in stage:</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.daysInStage} days</Typography>
                  </Box>
                  <Box sx={{ height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                    <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px", transition: "width .4s" }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ── Profile Source Quality card ───────────────────────────────────────────
function ProfileSourceCard({ data }) {
  const sources = [
    data?.find(d => d.source === "Direct Apply") ?? { source: "Direct Apply", count: 0, avgScore: 0, topPicksPct: 0 },
    { ...(data?.find(d => d.source === "CoreSignal") ?? { count: 0, avgScore: 0, topPicksPct: 0 }), source: "LinkedIn" },
  ];
  const total   = sources.reduce((sum, s) => sum + s.count, 0);
  const hasData = total > 0;

  function SourceBlock({ src }) {
    const isCS       = src.source === "LinkedIn";
    const barColor   = isCS ? PURPLE : ACCENT;
    const pct        = total > 0 ? Math.round(src.count / total * 100) : 0;
    const scoreColor = src.avgScore >= 80 ? SUCCESS : src.avgScore >= 60 ? WARN : DANGER;
    return (
      <Box sx={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: "10px", p: 1.75 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barColor, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{src.source}</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{src.count}</Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: "#F0F2F6", borderRadius: "2px", overflow: "hidden", mb: 1.5 }}>
          <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: barColor, borderRadius: "2px", transition: "width .4s" }} />
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box>
            <Typography sx={{ fontSize: 9.5, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Avg Score
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: src.count > 0 ? scoreColor : MUTED }}>
              {src.count > 0 ? `${src.avgScore}%` : "—"}
            </Typography>
          </Box>
          <Box sx={{ width: "1px", height: 36, bgcolor: BORDER, alignSelf: "center" }} />
          <Box>
            <Typography sx={{ fontSize: 9.5, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Top Picks
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: src.count > 0 ? SUCCESS : MUTED }}>
              {src.count > 0 ? `${src.topPicksPct}%` : "—"}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Profile Source Quality" isNew />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
        <Typography sx={{ fontSize: 11, color: MUTED }}>Candidate quality by acquisition channel</Typography>
        {!hasData ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
              Add candidates to see source quality.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              {sources.map(src => <SourceBlock key={src.source} src={src} />)}
            </Box>
            <Box sx={{ pt: 1.25, borderTop: `1px solid ${BORDER}`, textAlign: "center" }}>
              <Typography sx={{ fontSize: 11, color: MUTED }}>
                {total} total active profiles · Top Picks = capability score ≥ 80
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}

// ── Pipeline Health (Leaky Funnel) card ───────────────────────────────────
const FUNNEL_COLORS = [ACCENT, "#4B82D8", WARN, PURPLE, "#9D6AEF", SUCCESS];

function PipelineFunnelCard({ data }) {
  const stages  = data?.stages ?? [];
  const total   = data?.total ?? 0;
  const hasData = total > 0;

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Pipeline Health" isNew />
      <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography sx={{ fontSize: 11, color: MUTED, mb: 1.5 }}>
          The leaky funnel — where candidates drop off
        </Typography>
        {!hasData ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ fontSize: 12, color: MUTED, textAlign: "center" }}>
              Add candidates to see pipeline health.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {stages.map((stage, i) => {
              const barPct = total > 0 ? Math.max(3, Math.round(stage.count / total * 100)) : 0;
              const color  = FUNNEL_COLORS[i] ?? MUTED;
              return (
                <Box key={stage.name}>
                  {i > 0 && stage.dropOffPct > 0 && (
                    <Box sx={{ pl: "86px", py: "3px" }}>
                      <Box sx={{
                        display: "inline-flex", alignItems: "center",
                        bgcolor: DANGER_L, border: `1px solid #FECACA`,
                        borderRadius: "10px", px: 1, py: "1.5px",
                        fontSize: 9.5, fontWeight: 700, color: DANGER,
                      }}>
                        ↓ -{stage.dropOffPct}% drop-off
                      </Box>
                    </Box>
                  )}
                  {i > 0 && stage.dropOffPct === 0 && <Box sx={{ height: 4 }} />}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontSize: 10.5, color: MUTED, width: 78, flexShrink: 0, textAlign: "right" }}>
                      {stage.name}
                    </Typography>
                    <Box sx={{ flex: 1, height: 20, bgcolor: "#F0F2F6", borderRadius: "4px", overflow: "hidden" }}>
                      <Box sx={{
                        width: `${barPct}%`, height: "100%", bgcolor: color,
                        borderRadius: "4px", transition: "width .5s ease",
                      }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, width: 22, textAlign: "right", flexShrink: 0 }}>
                      {stage.count}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ── Monthly Target gauge ───────────────────────────────────────────────────
function GaugeArc({ fulfilled, target }) {
  const pct     = target > 0 ? Math.min(1, fulfilled / target) : 0;
  const color   = pct >= 1 ? SUCCESS : pct >= 0.6 ? PURPLE : ACCENT;
  const cx = 70, cy = 70, r = 58;

  const bgPath   = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const angle    = Math.PI * (1 - pct);
  const ex       = (cx + r * Math.cos(angle)).toFixed(1);
  const ey       = (cy - r * Math.sin(angle)).toFixed(1);
  const fillPath = pct > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}` : "";

  return (
    <svg width="140" height="82" viewBox="0 0 140 82" style={{ display: "block" }}>
      <path d={bgPath} fill="none" stroke="#E8ECF2" strokeWidth="13" strokeLinecap="round" />
      {pct > 0 && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="26" fontWeight="800" fill={TEXT}
        style={{ fontFamily: "inherit" }}>{fulfilled}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="11" fill={MUTED}
        style={{ fontFamily: "inherit" }}>of {target}</text>
    </svg>
  );
}

// Simple metric tile — label, big number, "Last 30 days" caption.
function MetricTile({ label, value }) {
  return (
    <Box sx={{
      bgcolor: "#FAFBFD", border: `1px solid ${BORDER}`, borderRadius: "10px",
      p: "14px 16px", display: "flex", flexDirection: "column", gap: 0.75, justifyContent: "center",
    }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: TEXT }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{value}</Typography>
      <Typography sx={{ fontSize: 10.5, color: MUTED }}>Last 30 days</Typography>
    </Box>
  );
}

function MonthlyTargetCard({ fulfilled, target, totalFees, newClients, newJobs }) {
  const remaining = Math.max(0, target - fulfilled);
  const pct       = target > 0 ? Math.min(100, Math.round((fulfilled / target) * 100)) : 0;
  const isComplete = fulfilled >= target;
  const monthLabel = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
  const feesLabel = `$${Math.round(totalFees ?? 0).toLocaleString("en-AU")}`;

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, display: "flex", flexDirection: "column", height: "100%" }}>
      <CardHead title="Monthly Target" />
      <Box sx={{ p: 2, flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>

        {/* Tile 1: Monthly Target gauge — unchanged */}
        <Box sx={{
          bgcolor: "#FAFBFD", border: `1px solid ${BORDER}`, borderRadius: "10px",
          p: "14px 16px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
        }}>
          <GaugeArc fulfilled={fulfilled} target={target} />
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: isComplete ? SUCCESS : TEXT }}>
              {isComplete ? "Monthly target achieved!" : `${remaining} more to reach goal`}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.25 }}>
              {pct}% complete · {monthLabel}
            </Typography>
          </Box>
        </Box>

        {/* Tile 2: Total Fees */}
        <MetricTile label="Total Fees" value={feesLabel} />

        {/* Tile 3: New Clients */}
        <MetricTile label="New Clients" value={newClients ?? 0} />

        {/* Tile 4: New Jobs */}
        <MetricTile label="New Jobs" value={newJobs ?? 0} />
      </Box>
    </Paper>
  );
}

// ── AI Prompt Card (Change 1) ──────────────────────────────────────────────
function AiPromptCard() {
  const nav = useNavigate();

  return (
    <Paper elevation={0} sx={{
      background: "linear-gradient(135deg, #EEF4FF 0%, #F0EEFF 100%)",
      border: `1px solid #D4E2FF`,
      borderRadius: "16px",
      p: 2,
      display: "flex", flexDirection: "column", gap: 1.5,
      height: "100%", boxSizing: "border-box",
    }}>
      {/* Icon */}
      <Box sx={{
        width: 44, height: 44, borderRadius: "50%",
        bgcolor: SURFACE, display: "flex", alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(29,114,232,0.12)",
      }}>
        <IcoSpark color={ACCENT} />
      </Box>

      {/* Heading */}
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
          Ready To Find Top Candidates Or Revisit Your Pipeline?
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>
          Use AI to analyze and match the best talent for your roles
        </Typography>
      </Box>

      {/* CTA button */}
      <Box
        onClick={() => nav("/coworker")}
        sx={{
          mt: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
          background: "linear-gradient(135deg, #1D72E8 0%, #7C3AED 100%)",
          borderRadius: "50px",
          px: 3, py: 1.25,
          cursor: "pointer", userSelect: "none",
          boxShadow: "0 4px 16px rgba(29,114,232,0.28)",
          transition: "opacity .15s, transform .15s, box-shadow .15s",
          "&:hover": {
            opacity: 0.92,
            transform: "translateY(-1px)",
            boxShadow: "0 6px 22px rgba(29,114,232,0.38)",
          },
          "&:active": { transform: "translateY(0)", opacity: 1 },
        }}>
        <IcoSpark color="#fff" />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.1px" }}>
          Open AI Co-worker
        </Typography>
        <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1 }}>→</Typography>
      </Box>
    </Paper>
  );
}

// ── Reminder row (Change 2) ────────────────────────────────────────────────
function ReminderRow({ reminder, isFirst }) {
  const now = new Date();
  const dueDate = new Date(reminder.dueAt);
  const nudgeTypes = ["AUTO_SCREENING_STUCK", "AUTO_ANALYSIS_PENDING"];
  const isNudge   = nudgeTypes.includes(reminder.reminderType);
  const isOverdue = !isNudge && dueDate < now;
  const isUpcoming = reminder.reminderType === "AUTO_INTERVIEW_UPCOMING";

  // Icon and color based on type
  let iconColor = ACCENT;
  let iconBg = ACCENT_L;
  let IconEl = <IcoCalendar color={iconColor} />;

  if (isOverdue) {
    iconColor = DANGER; iconBg = DANGER_L;
    IconEl = <IcoClock color={iconColor} />;
  } else if (isUpcoming) {
    iconColor = ACCENT; iconBg = ACCENT_L;
    IconEl = <IcoCalendar color={iconColor} />;
  } else if (isNudge) {
    iconColor = PURPLE; iconBg = PURPLE_L;
    IconEl = <IcoPeople color={iconColor} />;
  } else {
    iconColor = ACCENT; iconBg = ACCENT_L;
    IconEl = <IcoDoc color={iconColor} />;
  }

  // Subtitle
  let subtitle;
  if (isOverdue) {
    subtitle = "Overdue";
  } else if (isUpcoming) {
    const h = Math.round((dueDate - now) / 3600000);
    subtitle = h <= 0 ? "In less than 1 hour" : h === 1 ? "In 1 hour" : `In ${h} hours`;
  } else {
    const isToday = dueDate.toDateString() === now.toDateString();
    const isTomorrow = dueDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    if (isToday) {
      subtitle = "Today at " + dueDate.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else if (isTomorrow) {
      subtitle = "Tomorrow at " + dueDate.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else {
      const diffDays = Math.round((dueDate - now) / 86400000);
      subtitle = diffDays > 0 ? `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}` :
        dueDate.toLocaleDateString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit" });
    }
  }

  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.75,
      px: 2, py: 1.5,
      bgcolor: isOverdue ? "#FFF5F5" : SURFACE,
      borderRadius: "10px",
      border: isOverdue ? `1px solid #FECACA` : `1px solid transparent`,
      transition: "background .12s",
      "&:hover": { bgcolor: isOverdue ? "#FFF0F0" : "#F8F9FB" },
    }}>
      {/* Icon bubble */}
      <Box sx={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        bgcolor: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {IconEl}
      </Box>

      {/* Text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 13, fontWeight: 600, color: TEXT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {reminder.title}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.2 }}>
          {subtitle}
        </Typography>
      </Box>

      {/* Urgency badge */}
      {isOverdue && <Badge label="Urgent" variant="urgent" />}
    </Box>
  );
}

// ── Mode Toggle Bar ────────────────────────────────────────────────────────
function ModeToggleBar({ mode, onToggle }) {
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: "#0F1623", borderRadius: "7px", p: "3px",
      border: `1px solid ${BORDER}`,
    }}>
      <Box onClick={() => onToggle("recruit")} sx={{
        px: "10px", py: "3.5px", borderRadius: "5px",
        cursor: "pointer", userSelect: "none",
        bgcolor: mode === "recruit" ? ACCENT : "transparent",
        color: mode === "recruit" ? "#fff" : "rgba(255,255,255,0.4)",
        fontSize: 11, fontWeight: 600,
        transition: "all .2s cubic-bezier(.4,0,.2,1)",
        display: "flex", alignItems: "center", gap: "5px",
        "&:hover": mode !== "recruit" ? { color: "rgba(255,255,255,0.7)" } : {},
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        </svg>
        RecruitIQ
      </Box>
      <Box onClick={() => onToggle("crmx")} sx={{
        px: "10px", py: "3.5px", borderRadius: "5px",
        cursor: "pointer", userSelect: "none",
        background: mode === "crmx" ? "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" : "transparent",
        color: mode === "crmx" ? "#fff" : "rgba(200,180,255,0.5)",
        fontSize: 11, fontWeight: 600,
        transition: "all .2s cubic-bezier(.4,0,.2,1)",
        display: "flex", alignItems: "center", gap: "5px",
        "&:hover": mode !== "crmx" ? { color: "rgba(200,180,255,0.85)" } : {},
      }}>
        ✦ CRMx
      </Box>
    </Box>
  );
}

// ── CRMx Dashboard ────────────────────────────────────────────────────────

function CrmKpiCard({ label, value, sub, iconBg, iconEl, onClick }) {
  return (
    <Paper elevation={0} onClick={onClick}
      sx={{ ...CARD_BASE, p: 2.25, display: "flex", alignItems: "flex-start", gap: 2,
            cursor: onClick ? "pointer" : "default",
            transition: "box-shadow .15s, border-color .15s",
            "&:hover": onClick ? { boxShadow: "0 4px 14px rgba(15,22,35,0.09)", borderColor: "#C8D4E8" } : {} }}>
      <Box sx={{ width: 46, height: 46, borderRadius: "11px", bgcolor: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {iconEl}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.55px" }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 800, color: TEXT, lineHeight: 1.15, mt: 0.25 }}>
          {value ?? 0}
        </Typography>
        {sub && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.15 }}>{sub}</Typography>}
      </Box>
    </Paper>
  );
}

function WorkflowHealthCard({ title, inProgress, resolvedLabel, resolvedCount, color, colorL, to, nav }) {
  const total = inProgress + resolvedCount;
  const pct   = total > 0 ? Math.round(inProgress / total * 100) : 0;
  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{title}</Typography>
        <Box onClick={() => nav(to)} sx={{
          fontSize: 11, color: ACCENT, cursor: "pointer", userSelect: "none",
          "&:hover": { textDecoration: "underline" },
        }}>View →</Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: inProgress > 0 ? color : MUTED, lineHeight: 1 }}>
          {inProgress}
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: MUTED, pb: "3px" }}>in progress</Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px", transition: "width .4s" }} />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{
          display: "inline-flex", alignItems: "center",
          bgcolor: colorL, borderRadius: "20px", px: 1, py: "2px",
          fontSize: 10.5, fontWeight: 600, color,
        }}>
          {resolvedCount} {resolvedLabel} this month
        </Box>
      </Box>
    </Paper>
  );
}

function DeptBar({ name, count, maxCount }) {
  const pct = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontSize: 11.5, color: TEXT, fontWeight: 500 }}>{name}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: PURPLE }}>{count}</Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, #7C3AED 0%, #4F46E5 100%)",
          borderRadius: "3px", transition: "width .5s ease" }} />
      </Box>
    </Box>
  );
}

function CRMxDashboard({ loginId, nav }) {
  const [summary,     setSummary]     = useState(null);
  const [onboard,     setOnboard]     = useState([]);
  const [depts,       setDepts]       = useState([]);
  const [crmLoading,  setCrmLoading]  = useState(true);
  const [crmError,    setCrmError]    = useState(null);

  // convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting,  setConverting]  = useState(false);
  const [convertErr,  setConvertErr]  = useState(null);
  const [selCand,     setSelCand]     = useState(null);
  const [convForm,    setConvForm]    = useState({
    jobTitle: "", employmentType: "PERMANENT", startDate: "", departmentId: "",
  });

  const authH = () => ({ Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` });

  async function loadCrm() {
    setCrmLoading(true); setCrmError(null);
    try {
      const [sumRes, onbRes, deptRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/dashboard/summary?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/candidates/onboard?loginId=${loginId}`,  { headers: authH() }),
        fetch(`${API_BASE}/api/crm/departments?loginId=${loginId}`,          { headers: authH() }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      setOnboard(onbRes.ok ? await onbRes.json() : []);
      setDepts(deptRes.ok  ? await deptRes.json()  : []);
    } catch (e) {
      setCrmError(e.message);
    } finally {
      setCrmLoading(false);
    }
  }

  useEffect(() => { loadCrm(); }, []); // eslint-disable-line

  async function handleConvert() {
    if (!selCand) return;
    setConverting(true); setConvertErr(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/candidates/${selCand.id}/convert?loginId=${loginId}`,
        { method: "POST", headers: { "Content-Type": "application/json", ...authH() },
          body: JSON.stringify({ jobTitle: convForm.jobTitle || null,
            employmentType: convForm.employmentType || "PERMANENT",
            startDate: convForm.startDate || null, departmentId: convForm.departmentId || null, managerId: null }) },
      );
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || res.status); }
      setConvertOpen(false); setSelCand(null);
      setConvForm({ jobTitle: "", employmentType: "PERMANENT", startDate: "", departmentId: "" });
      loadCrm();
    } catch (e) { setConvertErr(e.message); }
    finally { setConverting(false); }
  }

  if (crmLoading) return (
    <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
      <Box sx={{ fontSize: 13, color: MUTED }}>Loading CRMx…</Box>
    </Box>
  );
  if (crmError) return (
    <Alert severity="error" sx={{ m: 2, fontSize: 12 }}>
      {crmError.includes("403") ? "CRMx module not enabled for this account." : crmError}
    </Alert>
  );

  const s = summary ?? {};
  const cf = (k) => (v) => setConvForm(p => ({ ...p, [k]: v }));

  const openCases = (s.promotionsInProgress ?? 0) + (s.salaryReviewsInProgress ?? 0)
    + (s.expensesInProgress ?? 0) + (s.grievancesInProgress ?? 0) + (s.disciplinaryInProgress ?? 0);

  const maxDeptCount = Math.max(1, ...(s.byDepartment ?? []).map(d => d.headcount));

  const monthLabel = new Date().toLocaleString("en-GB", { month: "short" });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

      {/* ── KPI row ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <CrmKpiCard
          label="Total Employees"
          value={s.totalEmployees ?? 0}
          sub={`${s.activeEmployees ?? 0} active · ${s.onboardingEmployees ?? 0} onboarding`}
          iconBg={PURPLE_L}
          iconEl={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          onClick={() => nav("/crm/employees")}
        />
        <CrmKpiCard
          label="Open HR Cases"
          value={openCases}
          sub="Promotions · Salary · Expenses · Relations"
          iconBg={WARN_L}
          iconEl={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={WARN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="11.5" x2="17" y2="6.5"/><line x1="7" y1="12.5" x2="17" y2="17.5"/></svg>}
          onClick={() => nav("/crm/workflows")}
        />
        <CrmKpiCard
          label="Leave Pending Approval"
          value={s.leavePending ?? 0}
          sub={`${s.leaveApprovedThisMonth ?? 0} approved in ${monthLabel}`}
          iconBg={ACCENT_L}
          iconEl={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          onClick={() => nav("/crm/leave")}
        />
        <CrmKpiCard
          label="On Leave Today"
          value={s.leaveActiveToday ?? 0}
          sub={`${s.inactiveEmployees ?? 0} inactive employees`}
          iconBg={DANGER_L}
          iconEl={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          onClick={() => nav("/crm/leave")}
        />
      </Box>

      {/* ── Department headcount + Onboarding snapshot ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 2, alignItems: "stretch" }}>

        {/* Department headcount */}
        <Paper elevation={0} sx={{ ...CARD_BASE }}>
          <CardHead title="Headcount by Department"
            action={<GhostBtn onClick={() => nav("/crm/departments")}>Manage →</GhostBtn>} />
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.75 }}>
            {(s.byDepartment ?? []).length === 0 ? (
              <Typography sx={{ fontSize: 12, color: MUTED, py: 1 }}>
                No active employees assigned to departments yet.
              </Typography>
            ) : (
              (s.byDepartment ?? []).map(d => (
                <DeptBar key={d.departmentName} name={d.departmentName} count={d.headcount} maxCount={maxDeptCount} />
              ))
            )}
          </Box>
        </Paper>

        {/* Workforce snapshot */}
        <Paper elevation={0} sx={{ ...CARD_BASE }}>
          <CardHead title="Workforce Snapshot" />
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[
              { label: "Active",      value: s.activeEmployees ?? 0,     color: SUCCESS, bg: SUCCESS_L },
              { label: "Onboarding",  value: s.onboardingEmployees ?? 0, color: WARN,    bg: WARN_L    },
              { label: "Inactive",    value: s.inactiveEmployees ?? 0,   color: MUTED,   bg: "#F1F3F7" },
              { label: "On Leave",    value: s.leaveActiveToday ?? 0,    color: ACCENT,  bg: ACCENT_L  },
            ].map(({ label, value, color, bg }) => (
              <Box key={label} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                p: "10px 14px", borderRadius: "10px", bgcolor: bg, border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{label}</Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* ── Workflow Health ── */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Workflow Health</Typography>
          <Box sx={{ fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
            border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px" }}>LIVE</Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
          <WorkflowHealthCard title="Onboarding"        inProgress={s.onboardingInProgress ?? 0}    resolvedLabel="completed"  resolvedCount={s.onboardingCompleted ?? 0}        color={SUCCESS} colorL={SUCCESS_L} to="/crm/onboarding"   nav={nav} />
          <WorkflowHealthCard title="Leave Requests"    inProgress={s.leavePending ?? 0}             resolvedLabel="approved"   resolvedCount={s.leaveApprovedThisMonth ?? 0}     color={ACCENT}  colorL={ACCENT_L}  to="/crm/leave"        nav={nav} />
          <WorkflowHealthCard title="Promotions"        inProgress={s.promotionsInProgress ?? 0}     resolvedLabel="approved"   resolvedCount={s.promotionsApprovedThisMonth ?? 0} color={PURPLE}  colorL={PURPLE_L}  to="/crm/workflows"    nav={nav} />
          <WorkflowHealthCard title="Salary Reviews"    inProgress={s.salaryReviewsInProgress ?? 0}  resolvedLabel="approved"   resolvedCount={s.salaryReviewsApprovedThisMonth ?? 0} color={PURPLE} colorL={PURPLE_L} to="/crm/workflows"   nav={nav} />
          <WorkflowHealthCard title="Expense Claims"    inProgress={s.expensesInProgress ?? 0}       resolvedLabel="approved"   resolvedCount={s.expensesApprovedThisMonth ?? 0}  color={WARN}    colorL={WARN_L}    to="/crm/expenses"     nav={nav} />
          <WorkflowHealthCard title="Employee Relations" inProgress={(s.grievancesInProgress ?? 0) + (s.disciplinaryInProgress ?? 0)} resolvedLabel="resolved/closed" resolvedCount={(s.grievancesResolvedThisMonth ?? 0) + (s.disciplinaryClosedThisMonth ?? 0)} color={DANGER} colorL={DANGER_L} to="/crm/grievances" nav={nav} />
        </Box>
      </Box>

      {/* ── Expense Pending Amount ── */}
      {(s.expensesInProgress ?? 0) > 0 && (
        <Paper elevation={0} sx={{
          ...CARD_BASE, p: 2, display: "flex", alignItems: "center", gap: 2,
          background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
          border: "1px solid #FDE68A",
        }}>
          <Box sx={{ width: 42, height: 42, borderRadius: "10px", bgcolor: WARN_L,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            border: "1px solid #FDE68A" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={WARN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
              Expense Claims Awaiting Finance Review
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.2 }}>
              {s.expensesInProgress} claim{s.expensesInProgress !== 1 ? "s" : ""} pending · total value:{" "}
              <strong style={{ color: WARN }}>
                ${Number(s.expensesPendingAmount ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </Typography>
          </Box>
          <Box onClick={() => nav("/crm/expenses")} sx={{
            fontSize: 12, fontWeight: 600, color: WARN, cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}>Review →</Box>
        </Paper>
      )}

      {/* ── Onboard Candidates ── */}
      <Card>
        <CardHead title="Onboard Candidates"
          action={<GhostBtn onClick={() => nav("/crm/employees")}>View All Employees →</GhostBtn>} />
        {onboard.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12.5, color: MUTED }}>
              No candidates at Selected stage. Move a candidate to Selected in the ATS to see them here.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Name</TableCell>
                <TableCell sx={thSx}>Email</TableCell>
                <TableCell sx={thSx}>Job Applied For</TableCell>
                <TableCell sx={thSx}>Stage</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {onboard.map(c => (
                <TableRow key={c.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.25, px: 2.5, fontSize: 13, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {c.name}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2.5, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {c.email}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2.5, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {c.jobTitle || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center",
                      bgcolor: SUCCESS_L, border: "1px solid #BBF7D0", borderRadius: "20px",
                      px: 1.25, py: "2px", fontSize: 11, fontWeight: 600, color: SUCCESS }}>
                      {c.stage}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2.5, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                    {c.alreadyConverted ? (
                      <Box sx={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>Already added</Box>
                    ) : (
                      <Button size="small" onClick={() => {
                        setSelCand(c);
                        setConvForm({ jobTitle: c.jobTitle || "", employmentType: "PERMANENT", startDate: "", departmentId: "" });
                        setConvertErr(null);
                        setConvertOpen(true);
                      }} sx={{ fontSize: 11, fontWeight: 600, textTransform: "none",
                        color: PURPLE, border: `1px solid ${PURPLE_BR}`, bgcolor: PURPLE_L,
                        borderRadius: "7px", px: "10px", py: "3px",
                        "&:hover": { bgcolor: "#EDE9FE" } }}>
                        Convert →
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Convert dialog */}
      <Dialog open={convertOpen} onClose={() => !converting && setConvertOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 0.5 }}>Convert to Employee</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {selCand && (
            <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 2 }}>
              Adding <strong style={{ color: TEXT }}>{selCand.name}</strong> as an employee.
            </Typography>
          )}
          {convertErr && <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>{convertErr}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            <TextField label="Job title" value={convForm.jobTitle} onChange={e => cf("jobTitle")(e.target.value)}
              fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: 13 }}>Employment type *</InputLabel>
              <Select value={convForm.employmentType} label="Employment type *"
                onChange={e => cf("employmentType")(e.target.value)} sx={{ fontSize: 13 }}>
                <MenuItem value="PERMANENT" sx={{ fontSize: 13 }}>Permanent</MenuItem>
                <MenuItem value="CONTRACT"  sx={{ fontSize: 13 }}>Contract</MenuItem>
                <MenuItem value="PLACED"    sx={{ fontSize: 13 }}>Placed</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontSize: 13 }}>Department</InputLabel>
              <Select value={convForm.departmentId} label="Department"
                onChange={e => cf("departmentId")(e.target.value)} sx={{ fontSize: 13 }}>
                <MenuItem value="" sx={{ fontSize: 13 }}>None</MenuItem>
                {depts.map(d => (
                  <MenuItem key={d.id} value={d.id} sx={{ fontSize: 13 }}>{d.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Start date" type="date" value={convForm.startDate}
              onChange={e => cf("startDate")(e.target.value)} size="small"
              InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }} InputProps={{ sx: { fontSize: 13 } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConvertOpen(false)} disabled={converting}
            sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button onClick={handleConvert} disabled={converting} variant="contained" sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "none",
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}>
            {converting ? "Converting…" : "Convert to Employee"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const nav      = useNavigate();
  const location = useLocation();
  const loginId  = localStorage.getItem("loginId") || "";
  const name     = localStorage.getItem("name") || "";

  // Iteration 1: no persistence — this only opens when LoginPage navigates
  // here with { showWalkthrough: true } right after a successful login.
  const [showWalkthrough, setShowWalkthrough] = useState(!!location.state?.showWalkthrough);

  const [recentJobs,          setRecentJobs]          = useState([]);
  const [recentAnalyses,      setRecentAnalyses]      = useState([]);
  const [reminders,           setReminders]           = useState([]);
  const [candidateCountByJob, setCandidateCountByJob] = useState({});
  const [monthlyStats,        setMonthlyStats]        = useState({
    fulfilledThisMonth: 0, monthlyTarget: 35,
    totalFeesLast30Days: 0, newClientsLast30Days: 0, newJobsLast30Days: 0,
  });
  const [upcomingInterviews,     setUpcomingInterviews]     = useState([]);
  const [insights,               setInsights]               = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState(null);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;

    async function load() {
      try {
        const [jobs, analyses, rems, stats, interviews, ins] = await Promise.all([
          apiGet("/api/jobs"),
          apiGet("/api/analyses/recent"),
          apiGet("/api/reminders?filter=today"),
          apiGet("/api/dashboard/monthly-stats").catch(() => ({
            fulfilledThisMonth: 0, monthlyTarget: 35,
            totalFeesLast30Days: 0, newClientsLast30Days: 0, newJobsLast30Days: 0,
          })),
          apiGet("/api/interviews").catch(() => []),
          apiGet("/api/dashboard/insights").catch(() => null),
        ]);
        if (cancelled) return;

        const jobList = jobs ?? [];
        const countMap = {};
        await Promise.all(
          jobList.map(async (j) => {
            try {
              const cands = await apiGet(`/api/jobs/${j.id}/candidates`);
              countMap[j.id] = (cands ?? []).length;
            } catch {
              countMap[j.id] = 0;
            }
          })
        );
        if (cancelled) return;

        setRecentJobs(jobList.slice(0, 6));
        setRecentAnalyses(analyses ?? []);
        setReminders(rems ?? []);
        setCandidateCountByJob(countMap);
        if (stats) setMonthlyStats(stats);
        if (ins)   setInsights(ins);
        const now = new Date();
        setUpcomingInterviews(
          (interviews ?? [])
            .filter(iv => iv.scheduledAt
              && iv.status === "Scheduled"
              && new Date(iv.scheduledAt) >= now)
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
            .slice(0, 5)
        );
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [loginId]);

  const todayTasks  = reminders.filter(r => !r.isCompleted);
  const jobTitleMap = useMemo(() => Object.fromEntries(recentJobs.map(j => [j.id, j.title])), [recentJobs]);
  const high   = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 80).length;
  const medium = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 60 && (a?.capabilityScore ?? 0) < 80).length;
  const low    = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) < 60).length;
  const total  = recentAnalyses.length || 1;

  const now       = new Date();
  const hour      = now.getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name.split(" ")[0] || "there";
  const dateStr   = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const { mode, setMode } = useAppMode();
  const [flipPhase, setFlipPhase] = useState(0); // 0=idle 1=out 2=snap-in

  function handleToggle(newMode) {
    if (newMode === mode || flipPhase !== 0) return;
    setFlipPhase(1);
    setTimeout(() => {
      setMode(newMode);
      setFlipPhase(2);
      requestAnimationFrame(() => requestAnimationFrame(() => setFlipPhase(0)));
    }, 220);
  }

  function handleExportPdf() {
    const styleId = "dashboard-print-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { margin: 14mm 12mm; size: A4 portrait; }
        body * { visibility: hidden; }
        #dashboard-print-root, #dashboard-print-root * { visibility: visible; }
        #dashboard-print-root { position: absolute; left: 0; top: 0; width: 100%; overflow: visible !important; background: #fff; }
        #dashboard-print-root .MuiPaper-root { box-shadow: none !important; border: 1px solid #E8ECF2 !important; break-inside: avoid; }
        #dashboard-print-root button { visibility: hidden; }
      }
    `;
    document.head.appendChild(style);
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => document.getElementById(styleId)?.remove(), 1500);
    });
  }

  const flipStyles = flipPhase === 1
    ? { transform: "perspective(1200px) rotateY(90deg)", opacity: 0, transition: "transform 0.22s ease, opacity 0.18s ease" }
    : flipPhase === 2
    ? { transform: "perspective(1200px) rotateY(-90deg)", opacity: 0, transition: "none" }
    : { transform: "perspective(1200px) rotateY(0deg)", opacity: 1, transition: "transform 0.22s ease, opacity 0.22s ease" };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

      <ProductWalkthroughModal
        open={showWalkthrough}
        onClose={() => setShowWalkthrough(false)}
      />

      {/* ── Animated Page Content ── */}
      <Box id="dashboard-print-root" sx={{ display: "flex", flexDirection: "column", gap: 2.5, transformOrigin: "center top", ...flipStyles }}>

        {/* Header — always visible so toggle shows in both modes */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            {mode === "recruit" && (
              <>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
                  {greeting}, {firstName}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.3 }}>{dateStr}</Typography>
              </>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <ModeToggleBar mode={mode} onToggle={handleToggle} />
            {mode === "recruit" && (
              <>
                <Button variant="outlined" size="small" onClick={() => nav("/reminders")}
                  sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                    borderRadius: "7px", textTransform: "none", gap: 0.5,
                    "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
                  <IcoBell />
                  Reminders
                  {todayTasks.length > 0 && (
                    <Box sx={{
                      bgcolor: DANGER, color: "#fff", borderRadius: "10px",
                      px: "5px", py: "1px", fontSize: 9, fontWeight: 700, lineHeight: 1.4,
                    }}>{todayTasks.length}</Box>
                  )}
                </Button>
                <Button variant="outlined" size="small" onClick={handleExportPdf}
                  sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                    borderRadius: "7px", textTransform: "none",
                    "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
                  Export PDF
                </Button>
                <Button variant="contained" size="small" onClick={() => nav("/jobs/new")}
                  sx={{ fontSize: 11, fontWeight: 600, bgcolor: ACCENT, borderRadius: "7px",
                    textTransform: "none", boxShadow: "none",
                    "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                  + New Job
                </Button>
              </>
            )}
          </Box>
        </Box>

        {mode === "crmx" ? <CRMxDashboard loginId={loginId} nav={nav} /> : (
          <>
            {error && <Alert severity="error" sx={{ mb: 0.5 }}>{error}</Alert>}

      {/* KPI row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <KpiCard label="Active Jobs" value={recentJobs.length} sub="Current openings"
          iconBg={ACCENT_L} icon={<IcoBriefcase color={ACCENT} />} />
        <KpiCard label="Total Candidates" value={recentAnalyses.length} sub="Across all jobs"
          iconBg={PURPLE_L} icon={<IcoUsers color={PURPLE} />} />
        <KpiCard label="Analyses Run" value={recentAnalyses.length} sub="AI-scored profiles"
          iconBg={SUCCESS_L} icon={<IcoTrend color={SUCCESS} />} />
        <KpiCard label="High-Risk Flags"
          value={recentAnalyses.filter(a => a?.riskLevel === "High").length}
          sub="Needs review" subColor={DANGER}
          iconBg={DANGER_L} icon={<IcoShield color={DANGER} />} />
      </Box>

      {/* AI Prompt + Monthly Target row */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AiPromptCard />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <MonthlyTargetCard
            fulfilled={monthlyStats.fulfilledThisMonth}
            target={monthlyStats.monthlyTarget}
            totalFees={monthlyStats.totalFeesLast30Days}
            newClients={monthlyStats.newClientsLast30Days}
            newJobs={monthlyStats.newJobsLast30Days}
          />
        </Box>
      </Box>

      {/* ── Row: Reminders | Pipeline | Schedule ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>

        {/* Reminders */}
        <Card>
          <CardHead title="Reminders"
            action={<GhostBtn onClick={() => nav("/reminders")}>View All →</GhostBtn>} />
          <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {todayTasks.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: MUTED, py: 1.5, px: 1 }}>
                All clear — no tasks due today.
              </Typography>
            ) : (
              todayTasks.slice(0, 4).map((r, i) => (
                <ReminderRow key={r.id} reminder={r} isFirst={i === 0} />
              ))
            )}
          </Box>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHead title="Pipeline" />
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
            <PipelineBar label="High Match ≥80%" count={high}   pct={Math.round(high   / total * 100)} color={SUCCESS} />
            <PipelineBar label="Moderate 60–79%"  count={medium} pct={Math.round(medium / total * 100)} color={WARN}    />
            <PipelineBar label="Low Match <60%"   count={low}    pct={Math.round(low    / total * 100)} color={DANGER}  />
          </Box>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHead title="Schedule"
            action={<GhostBtn onClick={() => nav("/scheduler")}>View All →</GhostBtn>} />
          <Box sx={{ px: 2, pt: 0.5, pb: 1.5, display: "flex", flexDirection: "column" }}>
            {upcomingInterviews.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: MUTED, py: 1.5 }}>
                No upcoming interviews scheduled.
              </Typography>
            ) : (
              upcomingInterviews.map((iv, i) => {
                const d           = new Date(iv.scheduledAt);
                const now2        = new Date();
                const timeStr     = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                const dateLabel   = d.toDateString() === now2.toDateString()
                                    ? "Today"
                                    : d.toDateString() === new Date(now2.getTime() + 86400000).toDateString()
                                    ? "Tomorrow"
                                    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                const time        = `${dateLabel} · ${timeStr}`;
                const title       = iv.candidateName ? `Interview with ${iv.candidateName}` : "Interview";
                const subtitle    = iv.interviewType || iv.location || "—";
                return (
                  <Box key={iv.id ?? i} sx={{
                    display: "flex", gap: 2, alignItems: "flex-start",
                    py: 1.5,
                    borderBottom: i < upcomingInterviews.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 500, minWidth: 36, mt: "2px", flexShrink: 0 }}>
                      {time}
                    </Typography>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
                      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{subtitle}</Typography>
                    </Box>
                  </Box>
                );
              })
            )}
            <Box onClick={() => nav("/scheduler")} sx={{
              mt: 1, fontSize: 13, fontWeight: 600, color: WARN,
              cursor: "pointer", userSelect: "none",
              "&:hover": { textDecoration: "underline" },
            }}>
              View Full Calendar →
            </Box>
          </Box>
        </Card>
      </Box>

      {/* ── AI Performance & Insights ── */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>AI Performance & Insights</Typography>
          <Box sx={{
            fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
            border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
          }}>NEW</Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, alignItems: "stretch" }}>
          <HiringInsightsCard data={insights?.hiringInsights} />
          <SkillGapCard       data={insights?.skillGap} />
          <BottleneckCard     data={insights?.bottlenecks} />
        </Box>
      </Box>

      {/* ── Profile Source Quality + Pipeline Health ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, alignItems: "stretch" }}>
        <ProfileSourceCard data={insights?.profileSource} />
        <PipelineFunnelCard data={insights?.pipelineHealth} />
      </Box>

      {/* ── Recent Jobs — full width ── */}
      <Card>
        <CardHead title="Recent Jobs"
          action={<GhostBtn onClick={() => nav("/jobs")}>View All →</GhostBtn>} />
        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
          {recentJobs.map(j => (
            <Box key={j.id} onClick={() => nav("/jobs")} sx={{
              border: `1px solid ${BORDER}`, borderRadius: "12px",
              p: 2.25, cursor: "pointer", bgcolor: SURFACE,
              transition: "box-shadow .15s, border-color .15s",
              "&:hover": { boxShadow: "0 4px 16px rgba(15,22,35,0.08)", borderColor: "#C8D4E8" },
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.75 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.3, flex: 1, pr: 1 }}>
                  {j.title}
                </Typography>
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 0.5,
                  bgcolor: "#F1F3F7", borderRadius: "20px", px: 1.25, py: 0.4, flexShrink: 0,
                }}>
                  <IcoUsers color={MUTED} />
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
                    {candidateCountByJob[j.id] ?? 0}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.25 }}>
                {j.company || "—"}&nbsp;·&nbsp;{j.jobType || "Full-time"}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
                <Badge
                  label={j.status ?? "Active"}
                  variant={j.status === "Complete" ? "neutral" : j.status === "Fulfilling" ? "warning" : "success"}
                />
                {(j.stackTags ?? []).slice(0, 2).map(tag => (
                  <Box key={tag} sx={{
                    bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`,
                    borderRadius: "6px", px: 1, py: "2px",
                    fontSize: 11, fontWeight: 500, color: MUTED,
                  }}>{tag}</Box>
                ))}
              </Box>
            </Box>
          ))}
          {!loading && recentJobs.length === 0 && (
            <Box sx={{ gridColumn: "1 / -1", py: 4, textAlign: "center" }}>
              <Typography sx={{ fontSize: 12, color: MUTED }}>
                No jobs yet — create your first job to get started.
              </Typography>
            </Box>
          )}
        </Box>
      </Card>

      {/* ── Recent Candidate Analyses — full width ── */}
      <Card>
        <CardHead title="Recent Candidate Analyses"
          action={<GhostBtn onClick={() => nav("/candidates")}>View All →</GhostBtn>} />

        <Box sx={{
          display: "flex", alignItems: "center",
          px: 2.5, py: 1.25, borderBottom: `1px solid ${BORDER}`, bgcolor: "#FAFBFD",
        }}>
          <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Name
          </Typography>
          <Typography sx={{ width: 100, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>
            All Scores
          </Typography>
          <Typography sx={{ width: 180, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>
            Applied Role
          </Typography>
        </Box>

        {(() => {
          const MAX_ROWS = 5;
          const rows = recentAnalyses.slice(0, MAX_ROWS);
          const emptyCount = MAX_ROWS - rows.length;
          return (
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              {rows.map((row) => {
                const initials   = (row.candidate_name ?? "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const score      = row?.capabilityScore ?? row?.consistencyScore ?? null;
                const scoreColor = score >= 85 ? SUCCESS : score >= 70 ? WARN : DANGER;
                const scoreBg    = score >= 85 ? SUCCESS_L : score >= 70 ? WARN_L : DANGER_L;
                return (
                  <Box key={row.id}
                    onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                    sx={{
                      display: "flex", alignItems: "center",
                      px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`,
                      cursor: "pointer", transition: "background .12s",
                      "&:hover": { bgcolor: "#F2F5FF" },
                    }}>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        bgcolor: "#E8EDF5", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#5A6480",
                      }}>
                        {initials}
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                        {row.candidate_name}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 100, display: "flex", justifyContent: "center" }}>
                      {score != null ? (
                        <Box sx={{
                          bgcolor: scoreBg, borderRadius: "20px", px: 1.5, py: "3px",
                          fontSize: 12, fontWeight: 700, color: scoreColor,
                        }}>
                          {score}%
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>
                      )}
                    </Box>
                    <Typography sx={{
                      width: 180, fontSize: 13, color: MUTED, fontWeight: 500, textAlign: "right",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {jobTitleMap[row.jobId] ?? "—"}
                    </Typography>
                  </Box>
                );
              })}
              {Array.from({ length: emptyCount }).map((_, i) => (
                <Box key={`empty-${i}`} sx={{
                  display: "flex", alignItems: "center",
                  px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, minHeight: 57,
                }}>
                  <Typography sx={{ fontSize: 12, color: "#F0F2F6" }}>—</Typography>
                </Box>
              ))}
              {!loading && recentAnalyses.length === 0 && (
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>
                    No analyses yet — run analysis on a candidate to see results here.
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })()}
      </Card>

      {/* Footer */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", pb: 0.5 }}>
        {["© nolyvra", "AI is designed to assist, not replace professional judgment."].map(label => (
          <Box key={label} sx={{
            display: "inline-flex", alignItems: "center",
            bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`, borderRadius: "5px",
            px: 1, py: "3px", fontSize: 10, fontWeight: 500, color: MUTED,
          }}>{label}</Box>
        ))}
      </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
