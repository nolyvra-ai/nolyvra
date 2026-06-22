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
import java.math.BigDecimal;
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

        String firstNameHdr = mapping.get("first_name");
        String lastNameHdr  = mapping.get("last_name");
        String emailHdr     = mapping.get("email");
        String phoneHdr     = mapping.get("phone_number");
        String linkedinHdr  = mapping.get("linkedin_url");
        String titleHdr     = mapping.get("current_title");
        String companyHdr   = mapping.get("current_company");
        String locationHdr  = mapping.get("location");
        String yearsHdr      = mapping.get("years_experience");
        String seniorityHdr  = mapping.get("seniority_level");
        String salaryMinHdr  = mapping.get("expected_salary_min");
        String salaryMaxHdr  = mapping.get("expected_salary_max");
        String noticeHdr     = mapping.get("notice_period_weeks");
        String workRightsHdr = mapping.get("work_rights");
        String remoteHdr     = mapping.get("remote_flexible");

        // Raw headers consumed by a known field — anything else on the row is
        // preserved verbatim in other_fields so future columns aren't lost.
        Set<String> mappedHeaders = new HashSet<>(mapping.values());

        int importedCount  = 0;
        int updatedCount   = 0;
        int duplicateCount = 0;
        int invalidCount   = 0;
        int totalRows      = rows.size();

        for (Map<String, String> row : rows) {
            String firstName = firstNameHdr != null ? trimToNull(row.get(firstNameHdr)) : null;
            String lastName  = lastNameHdr  != null ? trimToNull(row.get(lastNameHdr))  : null;
            String name = trimToNull(((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim());

            String email    = emailHdr    != null ? trimToNull(row.get(emailHdr))    : null;
            String phone    = phoneHdr    != null ? trimToNull(row.get(phoneHdr))    : null;
            String linkedin = linkedinHdr != null ? trimToNull(row.get(linkedinHdr)) : null;
            String currentTitle = titleHdr   != null ? trimToNull(row.get(titleHdr))   : null;
            String currentCompany = companyHdr != null ? trimToNull(row.get(companyHdr)) : null;
            String locationRaw  = locationHdr != null ? trimToNull(row.get(locationHdr)) : null;
            LocationResolution loc = resolveLocation(locationRaw);
            String location = loc.suburb();
            String state    = loc.state();

            BigDecimal years    = yearsHdr     != null ? parseDecimal(row.get(yearsHdr))     : null;
            String seniority    = seniorityHdr != null ? trimToNull(row.get(seniorityHdr)) : null;
            BigDecimal salaryMin = salaryMinHdr != null ? parseDecimal(row.get(salaryMinHdr)) : null;
            BigDecimal salaryMax = salaryMaxHdr != null ? parseDecimal(row.get(salaryMaxHdr)) : null;
            Integer notice       = noticeHdr    != null ? parseInt(row.get(noticeHdr))        : null;
            String workRights    = workRightsHdr != null ? trimToNull(row.get(workRightsHdr)) : null;
            Boolean remoteFlexible = remoteHdr != null ? parseBool(row.get(remoteHdr)) : null;
            String otherFieldsJson = buildOtherFieldsJson(row, mappedHeaders);

            // Skip: name blank OR both email and phone blank
            if (name == null || (email == null && phone == null)) {
                invalidCount++;
                continue;
            }

            String existingId = findExistingCandidateId(loginId, name, email, phone, currentCompany, state, currentTitle);
            if (existingId != null) {
                jdbc.update("""
                        UPDATE candidates SET
                            email                = COALESCE(email, ?),
                            phone_number          = COALESCE(phone_number, ?),
                            linkedin_url           = COALESCE(linkedin_url, ?),
                            current_title          = COALESCE(current_title, ?),
                            current_company        = COALESCE(current_company, ?),
                            location               = COALESCE(location, ?),
                            state                  = COALESCE(state, ?),
                            years_experience       = COALESCE(years_experience, ?),
                            seniority_level        = COALESCE(seniority_level, ?),
                            expected_salary_min    = COALESCE(expected_salary_min, ?),
                            expected_salary_max    = COALESCE(expected_salary_max, ?),
                            notice_period_weeks    = COALESCE(notice_period_weeks, ?),
                            work_rights            = COALESCE(work_rights, ?),
                            remote_flexible        = COALESCE(remote_flexible, ?),
                            other_fields           = COALESCE(other_fields, CAST(? AS jsonb)),
                            updated_at             = now()
                        WHERE id = ?
                        """, email, phone, linkedin, currentTitle, currentCompany, location, state,
                        years, seniority, salaryMin, salaryMax, notice, workRights, remoteFlexible,
                        otherFieldsJson, existingId);
                updatedCount++;
                continue;
            }

            String id = "cand-" + UUID.randomUUID();
            // stage = 'Screening', is_active = true — same defaults as CandidateService.addCandidateUnassigned
            jdbc.update("""
                    INSERT INTO candidates
                        (id, login_id, name, email, phone_number, linkedin_url,
                         current_title, current_company, location, state, years_experience, seniority_level,
                         expected_salary_min, expected_salary_max, notice_period_weeks,
                         work_rights, remote_flexible, other_fields,
                         stage, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), 'Screening', true, now(), now())
                    """, id, loginId, name, email, phone, linkedin,
                    currentTitle, currentCompany, location, state, years, seniority,
                    salaryMin, salaryMax, notice, workRights, remoteFlexible, otherFieldsJson);
            importedCount++;
        }

        return new CandidateImportResultResponse(importedCount, updatedCount, duplicateCount, invalidCount, totalRows);
    }

    // ─── Dedup: find an existing candidate this row should merge into ─────────
    // Primary key: name + (email or phone). Fallback (only when the row has
    // neither email nor phone): name + current_company + state + current_title,
    // and only when all three of those are present on the row.

    private String findExistingCandidateId(String loginId, String name, String email, String phone,
                                            String currentCompany, String state, String currentTitle) {
        if (email != null) {
            return jdbc.query(
                    "select id from candidates where login_id = ? and lower(name) = lower(?) and lower(email) = lower(?) limit 1",
                    (rs, n) -> rs.getString("id"), loginId, name, email)
                    .stream().findFirst().orElse(null);
        }
        if (phone != null) {
            return jdbc.query(
                    "select id from candidates where login_id = ? and lower(name) = lower(?) and phone_number = ? limit 1",
                    (rs, n) -> rs.getString("id"), loginId, name, phone)
                    .stream().findFirst().orElse(null);
        }
        if (currentCompany != null && state != null && currentTitle != null) {
            return jdbc.query("""
                    select id from candidates
                    where login_id = ? and lower(name) = lower(?)
                      and lower(current_company) = lower(?) and lower(state) = lower(?) and lower(current_title) = lower(?)
                    limit 1
                    """,
                    (rs, n) -> rs.getString("id"), loginId, name, currentCompany, state, currentTitle)
                    .stream().findFirst().orElse(null);
        }
        return null;
    }

    // ─── Location resolution against the au_localities reference table ────────
    // (same GeoNames-derived table TalentSearchService.resolveLocality uses for
    // the radius-search feature — see TalentSearchService.java)

    private record LocationResolution(String suburb, String state) {}

    private LocationResolution resolveLocation(String raw) {
        String input = trimToNull(raw);
        if (input == null) return new LocationResolution(null, null);

        List<String> stateMatch = jdbc.query(
                "select distinct state_code from au_localities where lower(state_code) = lower(?) or lower(state_name) = lower(?) limit 1",
                (rs, n) -> rs.getString("state_code"), input, input);
        if (!stateMatch.isEmpty()) {
            return new LocationResolution(null, stateMatch.get(0));
        }

        List<String> suburbStates = jdbc.query(
                "select distinct state_code from au_localities where lower(suburb) = lower(?)",
                (rs, n) -> rs.getString("state_code"), input);
        if (suburbStates.size() == 1) {
            return new LocationResolution(input, suburbStates.get(0));
        }
        // 0 matches, or a conflicting suburb name shared by multiple states — keep the
        // suburb text but leave state blank since it can't be resolved unambiguously.
        return new LocationResolution(input, null);
    }

    // ─── Catch-all for spreadsheet columns with no dedicated DB field ─────────

    private String buildOtherFieldsJson(Map<String, String> row, Set<String> mappedHeaders) {
        Map<String, String> other = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : row.entrySet()) {
            if (mappedHeaders.contains(e.getKey())) continue;
            String v = trimToNull(e.getValue());
            if (v != null) other.put(e.getKey(), v);
        }
        if (other.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(other);
        } catch (Exception e) {
            return null;
        }
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
            resp.put("updatedCount",   job.result().updatedCount());
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
                Target fields: first_name, last_name, email, phone_number, linkedin_url, current_title,
                current_company, location, years_experience, seniority_level, expected_salary_min,
                expected_salary_max, notice_period_weeks, work_rights, remote_flexible
                Given a list of raw column headers from an uploaded spreadsheet, return a JSON object
                mapping each target field to the BEST matching raw header from the list, or null if no
                reasonable match exists. Consider variations like "First Name", "Given Name", "Last Name",
                "Surname", "Family Name", "Email Address", "Mobile", "Phone", "LinkedIn", "LinkedIn Profile",
                "LinkedIn URL", "Job Title", "Current Role", "Employer", "Company", "Current Company",
                "City", "Suburb", "Location", "Years of Experience", "YOE", "Seniority", "Level", "Min Salary",
                "Max Salary", "Notice Period (weeks)", "Visa Status", "Work Rights", "Remote OK", "Hybrid/Remote" etc.
                If the spreadsheet has a single combined name column (e.g. "Name", "Full Name", "Candidate Name"),
                map it to first_name and leave last_name null.
                Return ONLY valid JSON, no markdown, in this exact format:
                {"first_name": "raw_header_or_null", "last_name": "raw_header_or_null", "email": "raw_header_or_null",
                 "phone_number": "raw_header_or_null", "linkedin_url": "raw_header_or_null", "current_title": "raw_header_or_null",
                 "current_company": "raw_header_or_null", "location": "raw_header_or_null",
                 "years_experience": "raw_header_or_null", "seniority_level": "raw_header_or_null",
                 "expected_salary_min": "raw_header_or_null", "expected_salary_max": "raw_header_or_null",
                 "notice_period_weeks": "raw_header_or_null", "work_rights": "raw_header_or_null",
                 "remote_flexible": "raw_header_or_null"}
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
            fallback.put("first_name", null);
            fallback.put("last_name", null);
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

    private BigDecimal parseDecimal(String s) {
        String t = trimToNull(s);
        if (t == null) return null;
        try {
            return new BigDecimal(t.replaceAll("[^0-9.]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInt(String s) {
        String t = trimToNull(s);
        if (t == null) return null;
        try {
            return Integer.parseInt(t.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Boolean parseBool(String s) {
        String t = trimToNull(s);
        if (t == null) return null;
        return t.equalsIgnoreCase("yes") || t.equalsIgnoreCase("true")
                || t.equalsIgnoreCase("y") || t.equals("1");
    }
}
