package com.depthhire.app.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

@Service
public class CvExtractService {

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