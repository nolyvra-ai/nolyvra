package com.nolyvra.app.config;

import com.nolyvra.app.service.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;
import java.util.Optional;

@Component
public class SessionInterceptor implements HandlerInterceptor {

    private final SessionService sessionService;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    // Employee sessions may only reach these — everything else under /api/**
    // (RecruitIQ, tenant-admin CRM screens, etc.) is off-limits for them.
    private record AllowedRoute(String method, String pattern) {}
    private static final List<AllowedRoute> EMPLOYEE_ALLOWLIST = List.of(
            new AllowedRoute("GET",    "/api/crm/leave/types"),
            new AllowedRoute("GET",    "/api/crm/employees/*/leave-balance"),
            new AllowedRoute("GET",    "/api/crm/leave/requests"),
            new AllowedRoute("POST",   "/api/crm/employees/*/leave/requests"),
            new AllowedRoute("DELETE", "/api/crm/leave/requests/*"),
            new AllowedRoute("GET",    "/api/crm/employees/*/expenses"),
            new AllowedRoute("POST",   "/api/crm/employees/*/expenses"),
            new AllowedRoute("DELETE", "/api/crm/expenses/*"),
            new AllowedRoute("GET",    "/api/crm/employees/*/grievances"),
            new AllowedRoute("POST",   "/api/crm/employees/*/grievances"),
            new AllowedRoute("DELETE", "/api/crm/grievances/*"),
            new AllowedRoute("GET",    "/api/crm/timesheets"),
            new AllowedRoute("POST",   "/api/crm/employees/*/timesheets"),
            new AllowedRoute("DELETE", "/api/crm/timesheets/*"),
            new AllowedRoute("POST",   "/api/auth/change-password"),
            new AllowedRoute("POST",   "/api/auth/logout")
    );

    public SessionInterceptor(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        // Preflight requests must pass through — CORS handles them
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(response, "Session token required.");
            return false;
        }

        String token = authHeader.substring(7).trim();

        Optional<String> tenantLoginId = sessionService.validateSession(token);
        if (tenantLoginId.isPresent()) {
            request.setAttribute("authType", "TENANT");
            request.setAttribute("loginId", tenantLoginId.get());
            return true;
        }

        Optional<SessionService.EmployeeSessionInfo> employeeSession =
                sessionService.validateEmployeeSession(token);
        if (employeeSession.isPresent()) {
            SessionService.EmployeeSessionInfo info = employeeSession.get();
            request.setAttribute("authType", "EMPLOYEE");
            request.setAttribute("employeeId", info.employeeId());
            request.setAttribute("loginId", info.loginId());

            if (!isEmployeeRouteAllowed(request)) {
                sendForbidden(response, "This action is not available to employee accounts.");
                return false;
            }
            return true;
        }

        sendUnauthorized(response, "Session expired or invalid. Please log in again.");
        return false;
    }

    private boolean isEmployeeRouteAllowed(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        for (AllowedRoute route : EMPLOYEE_ALLOWLIST) {
            if (route.method().equalsIgnoreCase(method) && pathMatcher.match(route.pattern(), path)) {
                return true;
            }
        }
        return false;
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }

    private void sendForbidden(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
