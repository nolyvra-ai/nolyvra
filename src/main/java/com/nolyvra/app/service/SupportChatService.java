package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.SupportChatRequest;
import com.nolyvra.app.model.SupportChatResponse;
import com.openai.core.JsonValue;
import com.openai.models.FunctionDefinition;
import com.openai.models.FunctionParameters;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.chat.completions.ChatCompletionMessage;
import com.openai.models.chat.completions.ChatCompletionMessageFunctionToolCall;
import com.openai.models.chat.completions.ChatCompletionMessageToolCall;
import com.openai.models.chat.completions.ChatCompletionToolMessageParam;
import com.openai.client.OpenAIClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SupportChatService {

    private static final String FALLBACK_ESCALATED_MESSAGE =
            "I couldn't find a confident answer to that in our Help Center. I've flagged your question for our team — you'll hear back by email shortly.";

    // Safety net against a runaway tool-calling loop — normal flow is at most
    // 2 rounds (one tool round, then the final JSON answer).
    private static final int MAX_TOOL_ROUNDS = 4;

    // navigate_to is only allowed to target static, parameter-free routes — a
    // blind "take me to a candidate" without knowing which candidate doesn't
    // make sense from a chat message, so dynamic routes (/analysis/:id etc.)
    // are deliberately excluded. Sourced from AppRoutes.jsx.
    private static final Set<String> ALLOWED_NAV_PATHS = new LinkedHashSet<>(List.of(
            "/dashboard", "/jobs", "/jobs/new", "/candidates", "/candidates/new-modern",
            "/talent-search", "/scheduler", "/email", "/reminders", "/settings/account",
            "/coworker", "/help"));

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final ResendEmailService resendEmailService;
    private final JdbcTemplate jdbc;
    private final String model;
    private final String escalationEmail;

    public SupportChatService(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            ResendEmailService resendEmailService,
            JdbcTemplate jdbc,
            @Value("${openai.model:gpt-4o-mini}") String model,
            @Value("${support.escalation-email:sayan.b@nolyvra.com}") String escalationEmail) {
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.resendEmailService = resendEmailService;
        this.jdbc = jdbc;
        this.model = model;
        this.escalationEmail = escalationEmail;
    }

    public SupportChatResponse respond(String loginId, SupportChatRequest request) {
        var builder = ChatCompletionCreateParams.builder()
                .model(model)
                .temperature(0.2)
                .addFunctionTool(answerFromDocsTool())
                .addFunctionTool(startCoworkerActionTool())
                .addFunctionTool(navigateToTool())
                .addSystemMessage(buildSystemPrompt(request.history()))
                .addUserMessage(request.message());

        String navigateTo = null;
        SupportChatResponse.CoworkerIntent coworkerIntent = null;

        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            var completion = openAI.chat().completions().create(builder.build());
            ChatCompletionMessage message = completion.choices().getFirst().message();

            if (message.toolCalls().isPresent() && !message.toolCalls().get().isEmpty()) {
                builder.addMessage(message.toParam());

                for (ChatCompletionMessageToolCall call : message.toolCalls().get()) {
                    if (!call.isFunction()) continue;
                    ChatCompletionMessageFunctionToolCall fn = call.asFunction();
                    ToolResult result = executeTool(fn.function().name(), fn.function().arguments(), request);
                    if (result.navigateTo() != null) navigateTo = result.navigateTo();
                    if (result.coworkerIntent() != null) coworkerIntent = result.coworkerIntent();

                    builder.addMessage(ChatCompletionToolMessageParam.builder()
                            .toolCallId(fn.id())
                            .content(result.content())
                            .build());
                }
                continue;
            }

            // No further tool calls — this is the model's final reply.
            String content = message.content().orElse("{\"answer\":\"\",\"canAnswer\":false}");
            return buildFinalResponse(loginId, request.message(), content, navigateTo, coworkerIntent);
        }

        // Exceeded MAX_TOOL_ROUNDS without a final answer — fail safe, same as
        // the existing "can't answer" path.
        escalate(loginId, request.message());
        return new SupportChatResponse(FALLBACK_ESCALATED_MESSAGE, true, null, null);
    }

    // ─── Tool definitions ──────────────────────────────────────────────────────

    private static FunctionDefinition answerFromDocsTool() {
        return FunctionDefinition.builder()
                .name("answer_from_docs")
                .description("Look up the Help Center articles matched to the user's message, so you can answer "
                        + "their question about how Nolyvra works or where a feature lives. Call this whenever the "
                        + "user is asking a question rather than requesting an action or navigation.")
                .parameters(FunctionParameters.builder()
                        .putAdditionalProperty("type", JsonValue.from("object"))
                        .putAdditionalProperty("properties", JsonValue.from(Map.of(
                                "query", Map.of(
                                        "type", "string",
                                        "description", "The user's question, rephrased concisely if helpful."))))
                        .putAdditionalProperty("required", JsonValue.from(List.of("query")))
                        .build())
                .build();
    }

    private static FunctionDefinition startCoworkerActionTool() {
        return FunctionDefinition.builder()
                .name("start_coworker_action")
                .description("Call this when the user wants to DO something in the app — create a job, run an "
                        + "analysis, schedule an interview, add candidates, send an email, create a reminder, find "
                        + "candidates, etc. Also call this when the user asks about their OWN live account data — "
                        + "e.g. 'what are my open jobs', 'how many candidates are in screening', 'show me my "
                        + "pipeline for X role', 'who do I have interviews with this week' — since the Help Center "
                        + "docs are static and have no access to real jobs/candidates/pipeline data; only the "
                        + "Co-worker can look that up. This does NOT perform the action or look up the data "
                        + "itself: it hands the request off to the AI Co-worker page, which has the tools to "
                        + "actually execute it or fetch the answer after the user confirms.")
                .parameters(FunctionParameters.builder()
                        .putAdditionalProperty("type", JsonValue.from("object"))
                        .putAdditionalProperty("properties", JsonValue.from(Map.of(
                                "intent", Map.of(
                                        "type", "string",
                                        "description", "A short natural-language description of what the user wants done, "
                                                + "e.g. 'create a job for a Senior Backend Engineer role'."),
                                "params", Map.of(
                                        "type", "object",
                                        "description", "Any structured details already mentioned (job title, candidate "
                                                + "name, etc.) as key-value pairs. Empty object if none."))))
                        .putAdditionalProperty("required", JsonValue.from(List.of("intent")))
                        .build())
                .build();
    }

    private static FunctionDefinition navigateToTool() {
        return FunctionDefinition.builder()
                .name("navigate_to")
                .description("Call this when the user just wants to go to a specific page/section of the app and "
                        + "isn't asking a question or requesting an action. path must be one of: "
                        + String.join(", ", ALLOWED_NAV_PATHS))
                .parameters(FunctionParameters.builder()
                        .putAdditionalProperty("type", JsonValue.from("object"))
                        .putAdditionalProperty("properties", JsonValue.from(Map.of(
                                "path", Map.of(
                                        "type", "string",
                                        "description", "One of the allowed app routes listed above."))))
                        .putAdditionalProperty("required", JsonValue.from(List.of("path")))
                        .build())
                .build();
    }

    // ─── Tool execution ────────────────────────────────────────────────────────

    private record ToolResult(String content, String navigateTo, SupportChatResponse.CoworkerIntent coworkerIntent) {
        static ToolResult of(String content) {
            return new ToolResult(content, null, null);
        }
    }

    private ToolResult executeTool(String name, String argumentsJson, SupportChatRequest request) {
        try {
            JsonNode args = objectMapper.readTree(argumentsJson);
            return switch (name) {
                case "answer_from_docs" -> executeAnswerFromDocs(request);
                case "start_coworker_action" -> executeStartCoworkerAction(args);
                case "navigate_to" -> executeNavigateTo(args);
                default -> ToolResult.of("{\"error\":\"Unknown tool: " + name + "\"}");
            };
        } catch (Exception e) {
            return ToolResult.of("{\"error\":\"Tool execution failed: " + e.getMessage() + "\"}");
        }
    }

    private ToolResult executeAnswerFromDocs(SupportChatRequest request) {
        List<SupportChatRequest.ArticleContext> articles = request.articles();
        if (articles == null || articles.isEmpty()) {
            return ToolResult.of("{\"articles\":[],\"note\":\"No matching Help Center articles were found for this query.\"}");
        }
        try {
            return ToolResult.of(objectMapper.writeValueAsString(Map.of("articles", articles)));
        } catch (Exception e) {
            return ToolResult.of("{\"articles\":[],\"note\":\"Failed to serialize matched articles.\"}");
        }
    }

    private ToolResult executeStartCoworkerAction(JsonNode args) {
        String intent = args.path("intent").asText("");
        Map<String, Object> params = objectMapper.convertValue(
                args.path("params"), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        if (params == null) params = Map.of();
        var coworkerIntent = new SupportChatResponse.CoworkerIntent(intent, params);
        return new ToolResult("{\"handoff\":true}", null, coworkerIntent);
    }

    private ToolResult executeNavigateTo(JsonNode args) {
        String path = args.path("path").asText("");
        if (!ALLOWED_NAV_PATHS.contains(path)) {
            return ToolResult.of("{\"error\":\"'" + path + "' is not a valid app route. Valid routes: "
                    + String.join(", ", ALLOWED_NAV_PATHS) + "\"}");
        }
        return new ToolResult("{\"navigated\":true,\"path\":\"" + path + "\"}", path, null);
    }

    // ─── System prompt ─────────────────────────────────────────────────────────

    private String buildSystemPrompt(List<SupportChatRequest.ChatMessage> history) {
        String systemPrompt = """
                You are the Nolyvra Help Center assistant — a knowledgeable, confident product expert for
                recruiters using the Nolyvra app. Your job is to make human support intervention barely
                necessary by answering thoroughly and correctly, or by taking the user where they need to go.

                For every user message, first decide what they need:
                - A question about HOW something works or WHERE a feature lives in the app (general product
                  knowledge, not specific to their own data) -> call answer_from_docs.
                - A question about THEIR OWN live account data — e.g. "what are my open jobs", "how many
                  candidates do I have in screening", "who am I interviewing this week", "show me candidates for
                  X role" — call start_coworker_action. The Help Center docs are static product documentation;
                  they never contain real jobs/candidates/pipeline data, so answer_from_docs can NEVER answer
                  these and must not be used for them.
                - A request to actually DO something in the app (create a job, run analysis, schedule an
                  interview, add candidates, send an email, etc.) -> call start_coworker_action.
                - A request to simply go to a page/section, with no question attached -> call navigate_to.
                If you're unsure whether something is general product knowledge vs. the user's own data, prefer
                start_coworker_action — it's better to hand off to something that can actually look up the answer
                than to guess from documentation that was never going to contain it.

                Once you've used a tool (or the message is generic enough not to need one, e.g. a greeting),
                reply with EXACTLY ONE JSON object — no markdown, no extra keys:
                {
                  "answer": "<your reply to the user>",
                  "canAnswer": true|false
                }

                Rules for the answer:
                - When answering from Help Center articles: synthesize a complete, specific, step-by-step answer
                  from the matched articles. You may combine information across multiple matched articles. Only
                  set "canAnswer" to false (leaving "answer" empty) if the matched articles genuinely don't cover
                  what was asked — do not guess or use outside knowledge about how the app works.
                - If the matched article(s) are about posting jobs to LinkedIn, Seek, or a careers website (direct
                  job board posting), explain briefly that this requires a one-time account setup with the Nolyvra
                  team, then end your answer with exactly this sentence: "I am passing this info to our customer
                  representative who will contact you directly."
                - If the user asks generally how to transfer/migrate/upload candidates from another ATS/CRM (CSV
                  or Excel upload, column mapping, etc.), just answer normally from the matched article — no
                  special closing line needed. Only if they specifically ask for help with a complex migration, or
                  ask to be connected with someone / want migration support, end your answer with exactly this
                  sentence: "I am sending this request to our customer support who will reach out shortly."
                - When you just called navigate_to successfully: write a short confirmation (e.g. "Taking you to
                  Create Job now.") and set "canAnswer" to true.
                - When you just called start_coworker_action: write a short confirmation that you're handing this
                  to the AI Co-worker to help complete it (e.g. "I'll take you to the Co-worker so it can create
                  that job for you — heading there now.") and set "canAnswer" to true.
                - Keep answers concise but complete — a recruiter should rarely need to ask a follow-up.
                - No markdown formatting in "answer". No extra keys in the JSON object.
                """;

        if (history == null || history.isEmpty()) {
            return systemPrompt;
        }

        StringBuilder conversation = new StringBuilder();
        for (var h : history) {
            conversation.append(h.role().toUpperCase()).append(": ").append(h.content()).append("\n");
        }
        return systemPrompt + "\n\nCONVERSATION SO FAR:\n" + conversation;
    }

    // ─── Final response assembly ───────────────────────────────────────────────

    private SupportChatResponse buildFinalResponse(String loginId, String question, String content,
            String navigateTo, SupportChatResponse.CoworkerIntent coworkerIntent) {
        String clean = cleanJson(content);
        boolean canAnswer = false;
        String answer = "";

        try {
            var root = objectMapper.readTree(clean);
            answer = root.path("answer").asText("");
            canAnswer = root.path("canAnswer").asBoolean(false);
        } catch (Exception e) {
            // Fall through — treat an unparsable response as "can't answer" and escalate.
        }

        // A successful navigate/handoff is a successful outcome regardless of how
        // the model phrased canAnswer — only escalate on the pure Q&A path.
        if (navigateTo != null || coworkerIntent != null) {
            return new SupportChatResponse(answer, false, navigateTo, coworkerIntent);
        }

        if (canAnswer && !answer.isBlank()) {
            return new SupportChatResponse(answer, false, null, null);
        }

        escalate(loginId, question);
        return new SupportChatResponse(FALLBACK_ESCALATED_MESSAGE, true, null, null);
    }

    private void escalate(String loginId, String question) {
        String reporterEmail = lookupEmail(loginId);
        String subject = "Support chat escalation from " + loginId;
        String body = "Login ID: " + loginId
                + "\nReporter email: " + (reporterEmail != null ? reporterEmail : "unknown")
                + "\n\nQuestion:\n" + question;
        resendEmailService.sendText(escalationEmail, subject, body);
    }

    private String lookupEmail(String loginId) {
        try {
            return jdbc.queryForObject("select email from login where id = ?", String.class, loginId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }
}
