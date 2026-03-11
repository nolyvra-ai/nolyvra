package com.depthhire.app.controller;

import com.depthhire.app.model.LoginRequest;
import com.depthhire.app.model.LoginResponse;
import com.depthhire.app.service.LoginService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class LoginController {

    private final LoginService loginService;

    public LoginController(LoginService loginService) {
        this.loginService = loginService;
    }

    @PostMapping("/login")
    public LoginResponse login(
            @RequestParam("emailId") String emailId,
            @RequestParam("password") String password) {
        LoginRequest req = new LoginRequest(emailId, password);

        return loginService.login(req)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"));
    }
}