package com.nolyvra.app.controller;

import com.nolyvra.app.config.SessionContext;
import com.nolyvra.app.model.SubUserCreateRequest;
import com.nolyvra.app.model.SubUserResponse;
import com.nolyvra.app.service.SubUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/sub-users")
public class SubUserController {

    private final SubUserService subUserService;
    private final SessionContext sessionContext;

    public SubUserController(SubUserService subUserService, SessionContext sessionContext) {
        this.subUserService = subUserService;
        this.sessionContext = sessionContext;
    }

    // GET /api/sub-users?loginId=x
    @GetMapping
    public List<SubUserResponse> list(@RequestParam String loginId) {
        return subUserService.list(loginId);
    }

    // POST /api/sub-users?loginId=x
    @PostMapping
    public SubUserResponse invite(@RequestParam String loginId, @Valid @RequestBody SubUserCreateRequest req) {
        requireNotSubUser();
        return subUserService.invite(loginId, req);
    }

    // DELETE /api/sub-users/{subUserLoginId}?loginId=x
    @DeleteMapping("/{subUserLoginId}")
    public void remove(@RequestParam String loginId, @PathVariable String subUserLoginId) {
        requireNotSubUser();
        subUserService.remove(loginId, subUserLoginId);
    }

    // Enforced against the actual session identity (SessionContext), never the
    // client-supplied loginId param — a sub-user cannot bypass this by simply
    // passing a different loginId, since identity here comes from the
    // validated session token, not the request.
    private void requireNotSubUser() {
        if (sessionContext.isSubUser()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Sub-user accounts cannot manage team members.");
        }
    }
}
