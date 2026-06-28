package com.nolyvra.app.controller;

import com.nolyvra.app.model.DepartmentCreateRequest;
import com.nolyvra.app.model.DepartmentResponse;
import com.nolyvra.app.service.CrmEntitlementService;
import com.nolyvra.app.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/crm/departments")
public class DepartmentController {

    private final DepartmentService     departmentService;
    private final CrmEntitlementService entitlementService;

    public DepartmentController(DepartmentService departmentService,
                                CrmEntitlementService entitlementService) {
        this.departmentService  = departmentService;
        this.entitlementService = entitlementService;
    }

    @GetMapping
    public List<DepartmentResponse> list(@RequestParam String loginId) {
        entitlementService.checkEntitled(loginId);
        return departmentService.list(loginId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse create(
            @RequestParam String loginId,
            @Valid @RequestBody DepartmentCreateRequest req) {
        entitlementService.checkEntitled(loginId);
        return departmentService.create(req, loginId);
    }
}
