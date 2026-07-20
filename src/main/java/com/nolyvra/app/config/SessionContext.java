package com.nolyvra.app.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

// Request-scoped view of the identity resolved by SessionInterceptor.
// Backed by request attributes so no thread-local bookkeeping is needed.
@Component
@RequestScope
public class SessionContext {

    private final HttpServletRequest request;

    public SessionContext(HttpServletRequest request) {
        this.request = request;
    }

    public boolean isEmployee() {
        return "EMPLOYEE".equals(request.getAttribute("authType"));
    }

    public String employeeId() {
        return (String) request.getAttribute("employeeId");
    }

    public String loginId() {
        return (String) request.getAttribute("loginId");
    }
}
