package com.nolyvra.app.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;

class EmailTemplateImageServiceTest {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EmailTemplateImageService service = new EmailTemplateImageService(jdbc);

    @Test
    void uploadsValidEmailTemplateImage() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.png", "image/png", ONE_PIXEL_PNG);

        EmailTemplateImageService.StoredImage image = service.upload(file, "admin@example.com");

        assertThat(image.id()).isNotBlank();
        assertThat(image.fileName()).isEqualTo("logo.png");
        assertThat(image.contentType()).isEqualTo("image/png");
        assertThat(image.data()).isEqualTo(ONE_PIXEL_PNG);
        verify(jdbc).update(anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsFilesThatOnlyClaimToBeImages() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "fake.png", "image/png", "not an image".getBytes());

        assertThatThrownBy(() -> service.upload(file, "admin@example.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(error.getReason()).contains("not a valid image");
                });
    }

    @Test
    void rejectsUnsupportedImageFormats() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "logo.svg", "image/svg+xml", "<svg/>".getBytes());

        assertThatThrownBy(() -> service.upload(file, "admin@example.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(error.getReason()).contains("PNG, JPEG and GIF");
                });
    }

    @Test
    void resolvesHumanReadableCidTemplateMarkup() {
        EmailTemplateImageService imageService = spy(service);
        String id = "14a68333-e0e8-4de5-8689-a772eee2648c";
        doReturn(new EmailTemplateImageService.StoredImage(
                id, "company-logo.png", "image/png", ONE_PIXEL_PNG))
                .when(imageService).get(id);

        EmailTemplateImageService.PreparedEmail prepared = imageService.inlineImages(
                "<!-- Template image: company-logo.png -->\n"
                        + "<img src=\"cid:template-image-" + id
                        + "\" alt=\"company-logo.png\">");

        assertThat(prepared.html()).contains("Template image: company-logo.png");
        assertThat(prepared.html()).contains("src=\"cid:template-image-" + id + "\"");
        assertThat(prepared.attachments()).singleElement()
                .satisfies(attachment -> {
                    assertThat(attachment.getFileName()).isEqualTo("company-logo.png");
                    assertThat(attachment.getContentId()).isEqualTo("template-image-" + id);
                    assertThat(attachment.getContent())
                            .isEqualTo(Base64.getEncoder().encodeToString(ONE_PIXEL_PNG));
                });
    }
}
