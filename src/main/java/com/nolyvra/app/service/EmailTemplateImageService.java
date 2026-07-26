package com.nolyvra.app.service;

import com.resend.services.emails.model.Attachment;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class EmailTemplateImageService {

    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png", "image/jpeg", "image/gif");
    private static final Pattern TEMPLATE_IMAGE_REFERENCE = Pattern.compile(
            "(?i)cid:template-image-"
                    + "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})");

    private final JdbcTemplate jdbc;

    public EmailTemplateImageService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void ensureTable() {
        jdbc.execute("""
                create table if not exists email_template_images (
                    id uuid primary key,
                    file_name text not null,
                    content_type text not null,
                    image_data bytea not null,
                    uploaded_by text not null,
                    created_at timestamp with time zone not null default now()
                )
                """);
    }

    public StoredImage upload(MultipartFile file, String uploadedBy) {
        byte[] bytes = validateAndRead(file);
        UUID id = UUID.randomUUID();
        String contentType = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase();
        String fileName = Optional.ofNullable(file.getOriginalFilename())
                .map(String::trim)
                .filter(name -> !name.isBlank())
                .map(this::safeFileName)
                .orElse("template-image");

        jdbc.update("""
                insert into email_template_images
                    (id, file_name, content_type, image_data, uploaded_by)
                values (?, ?, ?, ?, ?)
                """, id, fileName, contentType, bytes, uploadedBy);

        return new StoredImage(id.toString(), fileName, contentType, bytes);
    }

    public StoredImage get(String id) {
        UUID imageId;
        try {
            imageId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Template image not found.");
        }
        List<StoredImage> images = jdbc.query("""
                select id::text, file_name, content_type, image_data
                from email_template_images
                where id = ?
                """, (rs, rowNum) -> new StoredImage(
                rs.getString("id"),
                rs.getString("file_name"),
                rs.getString("content_type"),
                rs.getBytes("image_data")), imageId);
        if (images.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Template image not found.");
        }
        return images.get(0);
    }

    public PreparedEmail inlineImages(String html) {
        String source = html == null ? "" : html;
        Matcher matcher = TEMPLATE_IMAGE_REFERENCE.matcher(source);
        StringBuffer rendered = new StringBuffer();
        Map<String, Attachment> attachments = new LinkedHashMap<>();

        while (matcher.find()) {
            String imageId = matcher.group(1).toLowerCase();
            try {
                StoredImage image = get(imageId);
                String contentId = "template-image-" + imageId;
                attachments.computeIfAbsent(imageId, ignored -> Attachment.builder()
                        .fileName(image.fileName())
                        .content(Base64.getEncoder().encodeToString(image.data()))
                        .contentType(image.contentType())
                        .contentId(contentId)
                        .build());
                matcher.appendReplacement(rendered, Matcher.quoteReplacement("cid:" + contentId));
            } catch (ResponseStatusException e) {
                matcher.appendReplacement(rendered, Matcher.quoteReplacement(matcher.group()));
            }
        }
        matcher.appendTail(rendered);
        return new PreparedEmail(rendered.toString(), List.copyOf(attachments.values()));
    }

    private byte[] validateAndRead(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose an image.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be 5 MB or smaller.");
        }
        String contentType = Optional.ofNullable(file.getContentType()).orElse("").toLowerCase();
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Only PNG, JPEG and GIF images are supported.");
        }
        try {
            byte[] bytes = file.getBytes();
            if (ImageIO.read(new ByteArrayInputStream(bytes)) == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file is not a valid image.");
            }
            return bytes;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read the image.");
        }
    }

    private String safeFileName(String fileName) {
        return fileName.replaceAll("[\\\\/\\r\\n\"]", "_");
    }

    public record StoredImage(String id, String fileName, String contentType, byte[] data) {
    }

    public record PreparedEmail(String html, List<Attachment> attachments) {
    }
}
