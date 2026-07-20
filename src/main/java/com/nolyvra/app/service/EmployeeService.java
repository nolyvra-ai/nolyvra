package com.nolyvra.app.service;

import com.nolyvra.app.model.*;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class EmployeeService {

    private final JdbcTemplate       jdbc;
    private final DepartmentService  departmentService;

    // SHA-256 of "Welcome1" — same default used for tenant onboarding
    // (see UserService.DEFAULT_PASSWORD_HASH). Set on every new employee.
    private static final String DEFAULT_PASSWORD_HASH =
            "7e19e31ae82d749034fc921f777f717ba5b57c6add9add889eb536ac6effcde0";

    public EmployeeService(JdbcTemplate jdbc, DepartmentService departmentService) {
        this.jdbc              = jdbc;
        this.departmentService = departmentService;
    }

    // ─── Employee login ───────────────────────────────────────────────────────
    // Matches on email + password_hash across all tenants — employees.email has
    // no uniqueness constraint, so the first active match is used.

    public Optional<Map<String, Object>> login(String email, String passwordHash) {
        List<Map<String, Object>> rows = jdbc.query("""
                SELECT id, login_id, first_name, last_name, email
                FROM employees
                WHERE email = ? AND password_hash = ? AND is_active = true
                ORDER BY created_at
                LIMIT 1
                """,
                (rs, r) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("employeeId", rs.getString("id"));
                    m.put("loginId",    rs.getString("login_id"));
                    m.put("firstName",  rs.getString("first_name"));
                    m.put("lastName",   rs.getString("last_name"));
                    m.put("email",      rs.getString("email"));
                    return m;
                }, email, passwordHash);
        return rows.stream().findFirst();
    }

    // ─── Employee self-service password change ────────────────────────────────

    public boolean changePassword(String employeeId, String currentPasswordHash, String newPasswordHash) {
        List<String> rows = jdbc.query("""
                SELECT id FROM employees WHERE id = ? AND password_hash = ? AND is_active = true
                """,
                (rs, r) -> rs.getString("id"), employeeId, currentPasswordHash);
        if (rows.isEmpty()) return false;

        jdbc.update("UPDATE employees SET password_hash = ?, updated_at = now() WHERE id = ?",
                newPasswordHash, employeeId);
        return true;
    }

    // ─── RowMapper ────────────────────────────────────────────────────────────

    private final RowMapper<EmployeeResponse> EMP_MAPPER = (rs, rowNum) -> {
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        OffsetDateTime updatedAt = rs.getObject("updated_at", OffsetDateTime.class);
        Date startDate = rs.getDate("start_date");
        Date endDate   = rs.getDate("end_date");
        Date salaryEffFrom  = rs.getDate("salary_effective_from");
        Date promotionEff   = rs.getDate("promotion_effective");
        return new EmployeeResponse(
                rs.getString("id"),
                rs.getString("login_id"),
                rs.getString("candidate_id"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("job_title"),
                rs.getString("employment_type"),
                rs.getString("status"),
                rs.getString("manager_id"),
                rs.getString("manager_name"),
                rs.getString("department_id"),
                rs.getString("department_name"),
                startDate    != null ? startDate.toLocalDate()    : null,
                endDate      != null ? endDate.toLocalDate()      : null,
                rs.getBigDecimal("salary"),
                salaryEffFrom != null ? salaryEffFrom.toLocalDate() : null,
                promotionEff  != null ? promotionEff.toLocalDate()  : null,
                createdAt != null ? createdAt.toInstant()   : null,
                updatedAt != null ? updatedAt.toInstant()   : null
        );
    };

    private static final String SELECT_COLS = """
            e.id, e.login_id, e.candidate_id, e.first_name, e.last_name, e.email,
            e.phone, e.job_title, e.employment_type, e.status, e.manager_id,
            CASE WHEN m.id IS NOT NULL THEN CONCAT(m.first_name, ' ', m.last_name) END AS manager_name,
            e.department_id, d.name AS department_name,
            e.start_date, e.end_date,
            e.salary, e.salary_effective_from, e.promotion_effective,
            e.created_at, e.updated_at
            """;

    private static final String BASE_FROM = """
            FROM employees e
            LEFT JOIN employees m   ON m.id = e.manager_id   AND m.is_active = true
            LEFT JOIN departments d ON d.id = e.department_id AND d.is_active = true
            """;

    // ─── Direct create ────────────────────────────────────────────────────────

    public EmployeeResponse createEmployee(EmployeeCreateRequest req, String loginId) {
        validateManagerAndDept(req.managerId(), req.departmentId(), loginId, null);
        String id     = "emp-" + UUID.randomUUID();
        String status = (req.status() != null && !req.status().isBlank())
                        ? req.status().toUpperCase()
                        : EmployeeStatus.ONBOARDING.name();
        jdbc.update("""
                INSERT INTO employees
                  (id, login_id, first_name, last_name, email, phone,
                   job_title, employment_type, status, manager_id, department_id,
                   start_date, end_date, password_hash)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                id, loginId,
                req.firstName(), req.lastName(), req.email(), req.phone(),
                req.jobTitle(), req.employmentType().name(), status,
                req.managerId(), req.departmentId(),
                req.startDate(), req.endDate(), DEFAULT_PASSWORD_HASH);
        return getById(id, loginId).orElseThrow();
    }

    // ─── Convert ATS candidate → employee ────────────────────────────────────

    public EmployeeResponse convertCandidate(
            String candidateId, ConvertCandidateRequest req, String loginId) {

        // Idempotency: one employee per candidate per tenant
        List<EmployeeResponse> existing = jdbc.query(
                "SELECT " + SELECT_COLS + BASE_FROM +
                "WHERE e.candidate_id = ? AND e.login_id = ? AND e.is_active = true",
                EMP_MAPPER, candidateId, loginId);
        if (!existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Candidate already converted — existing employee id: " + existing.get(0).id());
        }

        // Must belong to tenant and be at a hire-eligible stage
        record CandRow(String name, String email, String phone) {}
        List<CandRow> cands = jdbc.query("""
                SELECT name, email, phone_number
                FROM candidates
                WHERE id = ? AND login_id = ? AND is_active = true
                  AND stage IN ('Selected', 'Hired', 'Placed')
                """,
                (rs, n) -> new CandRow(
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("phone_number")),
                candidateId, loginId);

        if (cands.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Candidate not found, not in this account, or not at a hire-eligible stage " +
                    "(must be Selected, Hired, or Placed)");
        }

        CandRow cand  = cands.get(0);
        String[] name = splitName(cand.name());

        validateManagerAndDept(req.managerId(), req.departmentId(), loginId, null);

        String id = "emp-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO employees
                  (id, login_id, candidate_id, first_name, last_name, email, phone,
                   job_title, employment_type, status, manager_id, department_id, start_date)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                id, loginId, candidateId,
                name[0], name[1], cand.email(), cand.phone(),
                req.jobTitle(), req.employmentType().name(),
                EmployeeStatus.ONBOARDING.name(),
                req.managerId(), req.departmentId(), req.startDate());

        return getById(id, loginId).orElseThrow();
    }

    // ─── List + filters ───────────────────────────────────────────────────────

    public List<EmployeeResponse> list(
            String loginId, String status, String departmentId, String managerId) {
        StringBuilder sql = new StringBuilder("SELECT ").append(SELECT_COLS).append(BASE_FROM)
                .append("WHERE e.login_id = ? AND e.is_active = true");
        List<Object> params = new ArrayList<>();
        params.add(loginId);

        if (status       != null && !status.isBlank())       { sql.append(" AND e.status = ?");        params.add(status.toUpperCase()); }
        if (departmentId != null && !departmentId.isBlank()) { sql.append(" AND e.department_id = ?"); params.add(departmentId); }
        if (managerId    != null && !managerId.isBlank())    { sql.append(" AND e.manager_id = ?");    params.add(managerId); }

        sql.append(" ORDER BY e.last_name, e.first_name");
        return jdbc.query(sql.toString(), EMP_MAPPER, params.toArray());
    }

    // ─── Get by id ────────────────────────────────────────────────────────────

    public Optional<EmployeeResponse> getById(String id, String loginId) {
        return jdbc.query("SELECT " + SELECT_COLS + BASE_FROM +
                "WHERE e.id = ? AND e.login_id = ? AND e.is_active = true",
                EMP_MAPPER, id, loginId).stream().findFirst();
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public EmployeeResponse update(String id, EmployeeUpdateRequest req, String loginId) {
        getById(id, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Employee not found: " + id));
        validateManagerAndDept(req.managerId(), req.departmentId(), loginId, id);

        jdbc.update("""
                UPDATE employees SET
                  first_name      = COALESCE(?, first_name),
                  last_name       = COALESCE(?, last_name),
                  email           = COALESCE(?, email),
                  phone           = COALESCE(?, phone),
                  job_title       = COALESCE(?, job_title),
                  employment_type = COALESCE(?, employment_type),
                  status          = COALESCE(?, status),
                  manager_id      = ?,
                  department_id   = ?,
                  start_date      = COALESCE(?, start_date),
                  end_date        = COALESCE(?, end_date),
                  salary          = COALESCE(?, salary),
                  updated_at      = now()
                WHERE id = ? AND login_id = ? AND is_active = true
                """,
                req.firstName(), req.lastName(), req.email(), req.phone(),
                req.jobTitle(),
                req.employmentType() != null ? req.employmentType().name() : null,
                req.status() != null ? req.status().toUpperCase() : null,
                req.managerId(), req.departmentId(),
                req.startDate(), req.endDate(),
                req.salary(),
                id, loginId);

        return getById(id, loginId).orElseThrow();
    }

    // ─── Assign manager (with cycle guard) ───────────────────────────────────

    public EmployeeResponse assignManager(String employeeId, String managerId, String loginId) {
        getById(employeeId, loginId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Employee not found: " + employeeId));

        if (managerId != null && !managerId.isBlank()) {
            if (managerId.equals(employeeId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "An employee cannot be their own manager");
            }
            getById(managerId, loginId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Manager not found in this account"));
            checkNoCycle(employeeId, managerId, loginId);
        }

        jdbc.update(
                "UPDATE employees SET manager_id = ?, updated_at = now() WHERE id = ? AND login_id = ?",
                (managerId != null && !managerId.isBlank()) ? managerId : null,
                employeeId, loginId);
        return getById(employeeId, loginId).orElseThrow();
    }

    // ─── Onboard queue: Selected-stage ATS candidates ────────────────────────

    public List<Map<String, Object>> getSelectedCandidates(String loginId) {
        return jdbc.query("""
                SELECT c.id, c.name, c.email, c.stage, c.job_id,
                       j.title AS job_title,
                       (SELECT COUNT(*) FROM employees e
                        WHERE e.candidate_id = c.id
                          AND e.login_id = c.login_id
                          AND e.is_active = true) AS already_converted
                FROM candidates c
                LEFT JOIN jobs j ON j.id = c.job_id AND j.login_id = c.login_id
                WHERE c.login_id = ? AND c.is_active = true AND c.stage = 'Selected'
                ORDER BY c.updated_at DESC
                """,
                (rs, rowNum) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",               rs.getString("id"));
                    row.put("name",             rs.getString("name"));
                    row.put("email",            rs.getString("email"));
                    row.put("stage",            rs.getString("stage"));
                    row.put("jobId",            rs.getString("job_id"));
                    row.put("jobTitle",         rs.getString("job_title"));
                    row.put("alreadyConverted", rs.getLong("already_converted") > 0);
                    return row;
                }, loginId);
    }

    // ─── Bulk Excel upload ────────────────────────────────────────────────────

    public BulkUploadResult bulkUpload(MultipartFile file, String loginId) {
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase();
        if (!filename.matches(".*\\.(xlsx|xls)$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "File must be .xlsx or .xls");
        }

        List<Map<String, String>> rows;
        try (InputStream is = file.getInputStream()) {
            Workbook wb = filename.endsWith(".xlsx") ? new XSSFWorkbook(is) : new HSSFWorkbook(is);
            rows = parseWorkbook(wb);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not read file: " + e.getMessage());
        }

        int success = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            Map<String, String> row = rows.get(i);
            int rowNum = i + 2; // 1-based data row index
            try {
                String firstName = required(row, "first name",  rowNum);
                String lastName  = required(row, "last name",   rowNum);
                String email     = required(row, "email",       rowNum);

                String empTypeRaw = Optional.ofNullable(row.get("employment type"))
                        .orElse("PERMANENT").trim().toUpperCase().replace(" ", "_");
                EmploymentType empType;
                try { empType = EmploymentType.valueOf(empTypeRaw); }
                catch (IllegalArgumentException ignored) { empType = EmploymentType.PERMANENT; }

                LocalDate startDate = null;
                String startRaw = row.get("start date");
                if (startRaw != null && !startRaw.isBlank()) {
                    try { startDate = LocalDate.parse(startRaw.trim()); } catch (Exception ignored) {}
                }

                String departmentId = null;
                String deptName = row.get("department");
                if (deptName != null && !deptName.isBlank()) {
                    departmentId = resolveOrCreateDepartment(deptName.trim(), loginId);
                }

                createEmployee(new EmployeeCreateRequest(
                        firstName, lastName, email,
                        row.get("phone"), row.get("job title"),
                        empType, EmployeeStatus.ONBOARDING.name(),
                        null, departmentId, startDate, null
                ), loginId);
                success++;
            } catch (ResponseStatusException e) {
                failed++;
                errors.add("Row " + rowNum + ": " + e.getReason());
            } catch (Exception e) {
                failed++;
                errors.add("Row " + rowNum + ": " + e.getMessage());
            }
        }

        return new BulkUploadResult(success, failed, rows.size(), errors);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private void validateManagerAndDept(
            String managerId, String departmentId, String loginId, String excludeEmployeeId) {
        if (managerId != null && !managerId.isBlank()) {
            if (managerId.equals(excludeEmployeeId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "An employee cannot be their own manager");
            }
            Integer cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                    Integer.class, managerId, loginId);
            if (cnt == null || cnt == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Manager not found in this account");
            }
        }
        if (departmentId != null && !departmentId.isBlank()
                && !departmentService.ownsAndActive(departmentId, loginId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Department not found in this account");
        }
    }

    private void checkNoCycle(String employeeId, String newManagerId, String loginId) {
        Set<String> visited = new HashSet<>();
        String current = newManagerId;
        while (current != null) {
            if (!visited.add(current)) break; // already-seen node = broken chain, stop
            if (current.equals(employeeId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Assigning this manager would create a circular reporting chain");
            }
            String next = current;
            List<String> parents = jdbc.query(
                    "SELECT manager_id FROM employees WHERE id = ? AND login_id = ? AND is_active = true",
                    (rs, r) -> rs.getString("manager_id"), next, loginId);
            current = parents.isEmpty() ? null : parents.get(0);
        }
    }

    private String resolveOrCreateDepartment(String name, String loginId) {
        List<String> existing = jdbc.query(
                "SELECT id FROM departments WHERE login_id = ? AND LOWER(name) = LOWER(?) AND is_active = true",
                (rs, r) -> rs.getString("id"), loginId, name);
        if (!existing.isEmpty()) return existing.get(0);
        return departmentService.create(new DepartmentCreateRequest(name), loginId).id();
    }

    private List<Map<String, String>> parseWorkbook(Workbook wb) {
        Sheet sheet = wb.getSheetAt(0);
        DataFormatter fmt = new DataFormatter();
        List<String> headers = new ArrayList<>();
        List<Map<String, String>> rows = new ArrayList<>();

        for (Row row : sheet) {
            if (row.getRowNum() == 0) {
                for (Cell cell : row) {
                    headers.add(fmt.formatCellValue(cell).trim().toLowerCase());
                }
                continue;
            }
            if (headers.isEmpty()) break;
            Map<String, String> map = new LinkedHashMap<>();
            boolean hasData = false;
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = row.getCell(i);
                String val = cell != null ? fmt.formatCellValue(cell).trim() : "";
                map.put(headers.get(i), val);
                if (!val.isBlank()) hasData = true;
            }
            if (hasData) rows.add(map);
        }
        if (headers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File has no header row");
        }
        return rows;
    }

    private String required(Map<String, String> row, String key, int rowNum) {
        String v = row.get(key);
        if (v == null || v.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Row " + rowNum + ": missing required field '" + key + "'");
        }
        return v.trim();
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) return new String[]{"Unknown", ""};
        String[] parts = fullName.trim().split("\\s+", 2);
        return parts.length == 2 ? parts : new String[]{parts[0], ""};
    }
}
