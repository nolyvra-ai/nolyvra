import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Box, Typography, Grid, Paper, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { mockAnalysis } from "../data/mockAnalysis";

function riskChip(level) {
  const map = {
    High: { label: "High", color: "error" },
    Medium: { label: "Medium", color: "warning" },
    Low: { label: "Low", color: "info" },
  };
  return map[level] || { label: level, color: "default" };
}

export default function AnalysisPage() {
  const { candidateId } = useParams();
  const [data] = useState(mockAnalysis); // later: fetch by candidateId

  const totals = useMemo(() => {
    const weighted = data.capabilityMatrix.reduce((sum, r) => sum + (r.weightPercent * r.scorePercent) / 100, 0);
    return { weighted: Math.round(weighted) };
  }, [data]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Analysis Result — {candidateId}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sr. Backend Engineer · FinTech Co. · Analysed {new Date(data.analyzedAt).toLocaleString()}
        </Typography>
      </Box>

      {/* Top score strip */}
      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Consistency Score</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{data.scores.consistencyScore}%</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Capability Match</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{data.scores.capabilityScore}%</Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">Risk Level</Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip label={data.scores.riskLevel} color={riskChip(data.scores.riskLevel).color} />
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="caption" color="text.secondary">AI Confidence</Typography>
            <Box sx={{ mt: 0.5, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Chip label={data.scores.confidence} variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {data.confidenceReason}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {/* Capability matrix */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>Capability Matrix Breakdown</Typography>
              <Chip label={`Total Weighted: ${totals.weighted}%`} color="primary" variant="outlined" />
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Capability Area</TableCell>
                  <TableCell align="right">Weight</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Impact</TableCell>
                  <TableCell>Insight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.capabilityMatrix.map((r) => {
                  const impact = Math.round((r.weightPercent * r.scorePercent) / 100);
                  return (
                    <TableRow key={r.capability}>
                      <TableCell sx={{ fontWeight: 600 }}>{r.capability}</TableCell>
                      <TableCell align="right">{r.weightPercent}%</TableCell>
                      <TableCell align="right">{r.scorePercent}%</TableCell>
                      <TableCell align="right">{impact}%</TableCell>
                      <TableCell>{r.insight}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Right side: strength + execution depth */}
        <Grid item xs={12} lg={4}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Top Strength Signals</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {data.topStrengthSignals.map((s) => (
                  <li key={s}>
                    <Typography variant="body2">{s}</Typography>
                  </li>
                ))}
              </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Execution Depth Classification</Typography>
              <Chip label={data.executionDepth.tier} color="primary" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {data.executionDepth.rationale}
              </Typography>
            </Paper>
          </Box>
        </Grid>

        {/* Risk analysis */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Risk & Authenticity Analysis</Typography>
            <Grid container spacing={1}>
              {data.riskAnalysis.map((r) => (
                <Grid item xs={12} md={6} lg={4} key={r.title}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700 }}>{r.title}</Typography>
                      <Chip size="small" label={r.level} color={riskChip(r.level).color} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {r.detail}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Suggested questions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>AI-Generated Validation Questions</Typography>
            {data.suggestedQuestions.map((q, idx) => (
              <Accordion key={q.question} disableGutters sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip size="small" label={q.category} variant="outlined" />
                    <Typography sx={{ fontWeight: 600 }}>
                      {idx + 1}. {q.question}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="subtitle2">Why this question</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {q.why}
                  </Typography>
                  <Typography variant="subtitle2">Strong answer signals</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {q.strongSignals}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
