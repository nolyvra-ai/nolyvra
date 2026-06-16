package com.nolyvra.app.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CandidateImportPreviewResponse;
import com.nolyvra.app.model.CandidateImportResultResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class CandidateImportService {

    private final JdbcTemplate    jdbc;
    private final OpenAIClient    openAI;
    private final ObjectMapper    objectMapper;
    private final String          model;
    private final ExecutorService importExecutor = Executors.newFixedThreadPool(2);

    // In-memory cache: importToken → (all rows, created-at epoch ms)
    private record CachedImport(List<Map<String, String>> rows, long createdAt) {}
    private static final ConcurrentHashMap<String, CachedImport> IMPORT_CACHE = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 30L * 60 * 1000; // 30 minutes

    // Async job status cache: jobId → status
    private record ImportJobStatus(String status, CandidateImportResultResponse result, String error, long createdAt) {}
    private static final ConcurrentHashMap<String, ImportJobStatus> JOB_CACHE = new ConcurrentHashMap<>();
    private static final long JOB_TTL_MS = 60L * 60 * 1000; // 1 hour

    public CandidateImportService(
            JdbcTemplate jdbc,
            OpenAIClient openAIClient,
            ObjectMapper objectMapper,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.jdbc         = jdbc;
        this.openAI       = openAIClient;
        this.objectMapper = objectMapper;
        this.model        = model;
    }

    // ─── Preview ─────────────────────────────────────────────────────────────

    public CandidateImportPreviewResponse previewImport(MultipartFile file, String loginId) {
        // Evict expired entries on each new preview call
        long now = System.currentTimeMillis();
        IMPORT_CACHE.entrySet().removeIf(e -> now - e.getValue().createdAt() > CACHE_TTL_MS);

        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase();

        ParsedSheet parsed;
        try {
            if (filename.endsWith(".xlsx")) {
                parsed = parseExcel(file.getInputStream(), false);
            } else if (filename.endsWith(".xls")) {
                parsed = parseExcel(file.getInputStream(), true);
            } else if (filename.endsWith(".csv")) {
                parsed = parseCsv(new String(file.getBytes(), StandardCharsets.UTF_8));
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unsupported file type. Please upload .xlsx, .xls, or .csv");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not read file — please ensure it's a valid .xlsx, .xls or .csv file: " + e.getMessage());
        }

        if (parsed.headers().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File has no header row");
        }
        if (parsed.rows().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File has no data rows");
        }

        List<Map<String, String>> previewRows = parsed.rows().stream().limit(5).toList();
        int totalRows = parsed.rows().size();

        Map<String, String> suggestedMapping = mapColumnsWithAI(parsed.headers());

        String importToken = UUID.randomUUID().toString();
        IMPORT_CACHE.put(importToken, new CachedImport(parsed.rows(), System.currentTimeMillis()));

        return new CandidateImportPreviewResponse(
                parsed.headers(), suggestedMapping, previewRows, totalRows, importToken);
    }

    // ─── Confirm ─────────────────────────────────────────────────────────────

    public CandidateImportResultResponse confirmImport(
            String importToken, Map<String, String> mapping, String loginId) {

        CachedImport cached = IMPORT_CACHE.get(importToken);
        if (cached == null || System.currentTimeMillis() - cached.createdAt() > CACHE_TTL_MS) {
            IMPORT_CACHE.remove(importToken);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Import session expired, please re-upload");
        }

        List<Map<String, String>> rows = cached.rows();
        IMPORT_CACHE.remove(importToken);

        String nameHdr    = mapping.get("name");
        String emailHdr   = mapping.get("email");
        String phoneHdr   = mapping.get("phone_number");
        String linkedinHdr = mapping.get("linkedin_url");

        int importedCount  = 0;
        int duplicateCount = 0;
        int invalidCount   = 0;
        int totalRows      = rows.size();

        for (Map<String, String> row : rows) {
            String name     = nameHdr     != null ? trimToNull(row.get(nameHdr))     : null;
            String email    = emailHdr    != null ? trimToNull(row.get(emailHdr))    : null;
            String phone    = phoneHdr    != null ? trimToNull(row.get(phoneHdr))    : null;
            String linkedin = linkedinHdr != null ? trimToNull(row.get(linkedinHdr)) : null;

            // Skip: name blank OR both email and phone blank
            if (name == null || (email == null && phone == null)) {
                invalidCount++;
                continue;
            }

            // Duplicate check by email
            if (email != null) {
                Integer count = jdbc.queryForObject(
                        "select count(*) from candidates where login_id = ? and lower(email) = lower(?)",
                        Integer.class, loginId, email);
                if (count != null && count > 0) {
                    duplicateCount++;
                    continue;
                }
            }

            String id = "cand-" + UUID.randomUUID();
            // stage = 'Screening', is_active = true — same defaults as CandidateService.addCandidateUnassigned
            jdbc.update("""
                    INSERT INTO candidates
                        (id, login_id, name, email, phone_number, linkedin_url,
                         stage, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'Screening', true, now(), now())
                    """, id, loginId, name, email, phone, linkedin);
            importedCount++;
        }

        return new CandidateImportResultResponse(importedCount, duplicateCount, invalidCount, totalRows);
    }

    // ─── Async job: start ────────────────────────────────────────────────────

    public String startImportAsync(String importToken, Map<String, String> mapping, String loginId) {
        // Validate token exists before handing off to background thread
        CachedImport cached = IMPORT_CACHE.get(importToken);
        if (cached == null || System.currentTimeMillis() - cached.createdAt() > CACHE_TTL_MS) {
            IMPORT_CACHE.remove(importToken);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Import session expired, please re-upload");
        }
        String jobId = UUID.randomUUID().toString();
        JOB_CACHE.put(jobId, new ImportJobStatus("RUNNING", null, null, System.currentTimeMillis()));
        importExecutor.submit(() -> {
            try {
                CandidateImportResultResponse result = confirmImport(importToken, mapping, loginId);
                JOB_CACHE.put(jobId, new ImportJobStatus("DONE", result, null, System.currentTimeMillis()));
            } catch (Exception e) {
                JOB_CACHE.put(jobId, new ImportJobStatus("ERROR", null, e.getMessage(), System.currentTimeMillis()));
            }
        });
        return jobId;
    }

    // ─── Async job: poll status ───────────────────────────────────────────────

    public Map<String, Object> getImportStatus(String jobId) {
        long now = System.currentTimeMillis();
        JOB_CACHE.entrySet().removeIf(e -> now - e.getValue().createdAt() > JOB_TTL_MS);

        ImportJobStatus job = JOB_CACHE.get(jobId);
        if (job == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found: " + jobId);
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", job.status());
        resp.put("error",  job.error());
        if (job.result() != null) {
            resp.put("importedCount",  job.result().importedCount());
            resp.put("duplicateCount", job.result().duplicateCount());
            resp.put("invalidCount",   job.result().invalidCount());
            resp.put("totalRows",      job.result().totalRows());
        }
        return resp;
    }

    // ─── AI column mapping ────────────────────────────────────────────────────

    private Map<String, String> mapColumnsWithAI(List<String> headers) {
        String systemPrompt = """
                You are mapping spreadsheet column headers to a fixed set of candidate database fields.
                Target fields: name, email, phone_number, linkedin_url
                Given a list of raw column headers from an uploaded spreadsheet, return a JSON object
                mapping each target field to the BEST matching raw header from the list, or null if no
                reasonable match exists. Consider variations like "Full Name", "Candidate Name", "Email Address",
                "Mobile", "Phone", "LinkedIn", "LinkedIn Profile", "LinkedIn URL" etc.
                Return ONLY valid JSON, no markdown, in this exact format:
                {"name": "raw_header_or_null", "email": "raw_header_or_null", "phone_number": "raw_header_or_null", "linkedin_url": "raw_header_or_null"}
                """;
        try {
            String userMessage = objectMapper.writeValueAsString(headers);
            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addSystemMessage(systemPrompt)
                    .addUserMessage(userMessage)
                    .temperature(0.1)
                    .build();
            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content()
                    .orElse("{}");
            String clean = content.strip()
                    .replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();

            Map<String, String> raw = objectMapper.readValue(clean, new TypeReference<Map<String, String>>() {});
            Map<String, String> result = new HashMap<>();
            raw.forEach((k, v) -> result.put(k, v != null && !"null".equalsIgnoreCase(v.trim()) ? v : null));
            return result;
        } catch (Exception e) {
            System.err.println("[CandidateImport] AI mapping failed: " + e.getMessage());
            Map<String, String> fallback = new HashMap<>();
            fallback.put("name", null);
            fallback.put("email", null);
            fallback.put("phone_number", null);
            fallback.put("linkedin_url", null);
            return fallback;
        }
    }

    // ─── File parsers ─────────────────────────────────────────────────────────

    private record ParsedSheet(List<String> headers, List<Map<String, String>> rows) {}

    private ParsedSheet parseExcel(InputStream is, boolean isHssf) throws Exception {
        try (Workbook wb = isHssf ? new HSSFWorkbook(is) : new XSSFWorkbook(is)) {
            Sheet sheet = wb.getSheetAt(0);
            DataFormatter fmt = new DataFormatter();

            List<String> headers = new ArrayList<>();
            List<Map<String, String>> rows = new ArrayList<>();
            boolean headerRead = false;

            for (Row row : sheet) {
                if (!headerRead) {
                    for (Cell cell : row) {
                        headers.add(fmt.formatCellValue(cell).trim());
                    }
                    headerRead = true;
                    continue;
                }
                Map<String, String> rowMap = new LinkedHashMap<>();
                boolean allBlank = true;
                for (int i = 0; i < headers.size(); i++) {
                    Cell cell = row.getCell(i, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    String val = cell != null ? fmt.formatCellValue(cell).trim() : "";
                    rowMap.put(headers.get(i), val);
                    if (!val.isBlank()) allBlank = false;
                }
                if (!allBlank) rows.add(rowMap);
            }
            return new ParsedSheet(headers, rows);
        }
    }

    private ParsedSheet parseCsv(String content) {
        List<String> headers = new ArrayList<>();
        List<Map<String, String>> rows = new ArrayList<>();

        String[] lines = content.split("\\r?\\n");
        if (lines.length == 0) return new ParsedSheet(headers, rows);

        for (String h : splitCsvLine(lines[0])) headers.add(h.trim());

        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isBlank()) continue;
            String[] cols = splitCsvLine(line);
            Map<String, String> rowMap = new LinkedHashMap<>();
            boolean allBlank = true;
            for (int j = 0; j < headers.size(); j++) {
                String val = j < cols.length ? cols[j].trim() : "";
                rowMap.put(headers.get(j), val);
                if (!val.isBlank()) allBlank = false;
            }
            if (!allBlank) rows.add(rowMap);
        }
        return new ParsedSheet(headers, rows);
    }

    private String[] splitCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++; // escaped double-quote inside quoted field
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                result.add(sb.toString());
                sb = new StringBuilder();
            } else {
                sb.append(c);
            }
        }
        result.add(sb.toString());
        return result.toArray(new String[0]);
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
