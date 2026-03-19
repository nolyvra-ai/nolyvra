package com.depthhire.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

@Service
public class CvExtractService {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final String model;
    private final TokenService tokenService;

    public CvExtractService(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI       = openAI;
        this.objectMapper = objectMapper;
        this.tokenService  = tokenService; 
        this.model        = model;
    }

    public String extractText(MultipartFile file) throws IOException {
        String originalName = file.getOriginalFilename();
        if (originalName == null) {
            throw new IllegalArgumentException("File has no name");
        }

        String lower = originalName.toLowerCase();

        if (lower.endsWith(".pdf")) {
            return extractFromPdf(file.getInputStream());
        } else if (lower.endsWith(".docx")) {
            return extractFromDocx(file.getInputStream());
        } else if (lower.endsWith(".doc")) {
            throw new IllegalArgumentException(
                ".doc format is not supported. Please save as .docx or .pdf and re-upload.");
        } else {
            throw new IllegalArgumentException(
                "Unsupported file type. Please upload a PDF or .docx file.");
        }
    }

    // ── Extended extract — returns text + name/email/phone/linkedinUrl ────────
    // Used by the Add Candidate page to prefill form fields from uploaded CV.
    public Map<String, Object> extractWithFields(MultipartFile file, String loginId) throws IOException {
        String rawText = extractText(file);

        String name        = "";
        String email       = "";
        String phone       = "";
        String linkedinUrl = "";

        try {
            String snippet = rawText.length() > 3000 ? rawText.substring(0, 3000) : rawText;
            String prompt = """
                    Extract the following fields from this CV text.
                    Return EXACTLY ONE JSON object — no markdown, no extra keys:
                    {
                      "name": "Full name of the candidate or null",
                      "email": "Email address or null",
                      "phone": "Phone number or null",
                      "linkedinUrl": "LinkedIn profile URL or null"
                    }

                    CV TEXT:
                    %s
                    """.formatted(snippet);

            var params = ChatCompletionCreateParams.builder()
                    .model(model)
                    .addUserMessage(prompt)
                    .temperature(0.0)
                    .build();

            String content = openAI.chat().completions().create(params)
                    .choices().getFirst().message().content().orElse("{}");
            tokenService.deductToken(loginId);

            String clean = content.strip();
            if (clean.startsWith("```")) {
                clean = clean.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
            }

            var root = objectMapper.readTree(clean);
            name        = root.path("name").isNull()        ? "" : root.path("name").asText("");
            email       = root.path("email").isNull()       ? "" : root.path("email").asText("");
            phone       = root.path("phone").isNull()       ? "" : root.path("phone").asText("");
            linkedinUrl = root.path("linkedinUrl").isNull() ? "" : root.path("linkedinUrl").asText("");
        } catch (Exception e) {
            System.err.println("[CvExtract] Field extraction failed: " + e.getMessage());
            // Non-fatal — return text only with empty fields
        }

        return Map.of(
                "text",        rawText,
                "name",        name,
                "email",       email,
                "phone",       phone,
                "linkedinUrl", linkedinUrl);
    }

    private String extractFromPdf(InputStream inputStream) throws IOException {
        // PDFBox 3.x: Loader.loadPDF(byte[]) replaces PDDocument.load(InputStream)
        try (PDDocument doc = Loader.loadPDF(inputStream.readAllBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc).trim();
            if (text.isBlank()) {
                throw new IllegalArgumentException(
                    "Could not extract text from this PDF. It may be scanned or image-based. " +
                    "Please paste the CV text manually.");
            }
            return text;
        }
    }

    private String extractFromDocx(InputStream inputStream) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(inputStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            String text = extractor.getText().trim();
            if (text.isBlank()) {
                throw new IllegalArgumentException(
                    "Could not extract text from this Word document. " +
                    "Please paste the CV text manually.");
            }
            return text;
        }
    }
}