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

    // True when the authenticated session belongs to a sub-user (operating
    // within a parent tenant's loginId, but not the parent's own identity).
    public boolean isSubUser() {
        return request.getAttribute("actorLoginId") != null;
    }

    // The sub-user's own login.id — null for the owner's own sessions.
    public String actorLoginId() {
        return (String) request.getAttribute("actorLoginId");
    }
}
