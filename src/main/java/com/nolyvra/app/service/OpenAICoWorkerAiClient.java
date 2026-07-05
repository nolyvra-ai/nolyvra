package com.nolyvra.app.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nolyvra.app.model.CoWorkerChatRequest;
import com.nolyvra.app.model.CoWorkerChatResponse;
import com.openai.client.OpenAIClient;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnProperty(name = "nolyvra.mock-ai", havingValue = "false", matchIfMissing = true)
public class OpenAICoWorkerAiClient implements CoWorkerAiClient {

    private final OpenAIClient openAI;
    private final ObjectMapper objectMapper;
    private final TokenService tokenService;
    private final String model;

    public OpenAICoWorkerAiClient(
            OpenAIClient openAI,
            ObjectMapper objectMapper,
            TokenService tokenService,
            @Value("${openai.model:gpt-4o-mini}") String model) {
        this.openAI = openAI;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.model = model;
    }

    @Override
    public CoWorkerChatResponse chat(
            String loginId,
            Long sessionId,
            String message,
            String context,
            List<CoWorkerChatRequest.ChatMessage> history) {
        if (!tokenService.deductToken(loginId)) {
            return new CoWorkerChatResponse(
                    sessionId,
                    "You have run out of tokens. Please upgrade your plan to continue.",
                    null);
        }

        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .addSystemMessage(buildSystemPrompt(context, history))
                .addUserMessage(message)
                .temperature(0.3)
                .build();

        var completion = openAI.chat().completions().create(params);
        String content = completion.choices().getFirst().message().content()
                .orElse("{\"message\":\"I'm here to help! What would you like me to do?\",\"pendingAction\":{\"type\":\"NONE\",\"description\":\"\",\"params\":{}}}");

        return parseResponse(sessionId, content);
    }

    private String buildSystemPrompt(String context, List<CoWorkerChatRequest.ChatMessage> history) {
        String systemPrompt = """
                You are nolyvra Co-worker AI — a helpful recruitment assistant that takes actions inside the app.

                You have access to the following recruitment data for this recruiter:
                %s

                When the user asks you to do something, you MUST return EXACTLY ONE JSON object:
                {
                  "message": "<friendly conversational reply, briefly confirm what you found and what you plan to do>",
                  "pendingAction": {
                    "type": "RUN_ANALYSIS|SCHEDULE_INTERVIEW|RESCHEDULE_AND_NOTIFY|MOVE_PIPELINE|EMAIL|CREATE_REMINDER|CREATE_JOB|ADD_CANDIDATES|NONE",
                    "description": "<1-sentence human-readable action description>",
                    "params": { <action-specific parameters — see below> }
                  }
                }

                Set pendingAction.type to "NONE" and params to {} if the message is just a question or greeting.

                Parameter schemas per action type:

                RUN_ANALYSIS:
                  { "candidateIds": ["cand-xxx", ...], "candidateNames": ["Name", ...], "jobTitle": "..." }

                SCHEDULE_INTERVIEW:
                  { "candidateId": "cand-xxx", "candidateName": "...", "interviewType": "Phone Screen|Video Interview|In-Person", "scheduledAt": "ISO datetime or null if not specified", "notes": "..." }

                RESCHEDULE_AND_NOTIFY:
                  { "interviewId": "int-xxx or null", "candidateId": "cand-xxx", "candidateName": "...", "interviewType": "...", "newScheduledAt": "ISO datetime or null", "notes": "..." }
                  Use this for any reschedule request, or multi-step (reschedule + notify candidate + next available slots).

                MOVE_PIPELINE:
                  { "candidateIds": ["cand-xxx", ...], "candidateNames": ["Name", ...], "toStage": "Screening|Interview|Assessment|Offer|Selected|Rejected", "jobTitle": "..." }

                EMAIL:
                  { "candidateId": "cand-xxx", "candidateName": "...", "emailType": "FOLLOW_UP|INTERVIEW_INVITE|REJECTION|OFFER", "subject": "suggested subject", "body": "suggested email body" }
                  NOTE: For email actions, the app will navigate to the email centre page with fields pre-populated. No email is sent automatically.

                CREATE_REMINDER:
                  { "title": "...", "candidateId": "cand-xxx or null", "dueAt": "ISO datetime", "priority": "High|Normal|Low" }

                CREATE_JOB:
                  { "title": "...", "company": "...", "jobType": "Full-time|Part-time|Contract|Temporary|Remote|Hybrid|Onsite", "seniority": "...", "jdText": "...", "location": "...", "stackTags": ["skill", ...], "jobStatus": "Active", "salary": number or null, "currency": "AUD|USD|GBP|EUR|NZD|SGD", "feePercentage": number or null }
                  Use this when the user asks you to create, open, add, or publish a new job/vacancy/role from a brief or JD.
                  title and jdText are required. If the user gives only a rough brief, turn it into a professional job description.
                  If company, location, seniority, salary, or fee are not mentioned, use null or "" rather than inventing them.

                ADD_CANDIDATES:
                  { "jobId": "job-xxx or null", "jobTitle": "... or null", "candidates": [{ "name": "...", "email": "...", "phone": "...", "linkedinUrl": "...", "cvText": "...", "skills": ["skill", ...], "currentTitle": "...", "location": "...", "state": "...", "yearsExperience": number or null, "seniorityLevel": "...", "expectedSalaryMin": number or null, "expectedSalaryMax": number or null, "salaryCurrency": "AUD|USD|GBP|EUR|NZD|SGD or null", "noticePeriodWeeks": number or null, "workRights": "...", "remoteFlexible": true|false|null }] }
                  Use this when the user attaches, uploads, imports, or adds one or more CVs/resumes as candidates.
                  Match the requested job to a real jobId from the JOBS context. If the user does not specify a job, use null and add the candidates as unassigned.
                  name and cvText are required. Use extracted attachment fields when present; do not invent email or phone.
                  If the user message includes an "Attached CVs:" section, preserve each attachment's cvText exactly in the matching candidate object.

                Rules:
                - Always match candidate and job names to real IDs from the context above.
                - If you cannot find a match, say so in the message and set pendingAction type to NONE.
                - For EMAIL actions, always mention in your message that you will take the user to the email page.
                - For questions about upcoming meetings or free time, answer directly from UPCOMING INTERVIEWS data above — set pendingAction to NONE.
                - For reschedule + notify + next slots requests, always use RESCHEDULE_AND_NOTIFY (not SCHEDULE_INTERVIEW).
                - Keep your message friendly, concise and specific (mention names and counts).
                - No markdown. No extra keys.
                - CRITICAL: You MUST respond with ONLY a valid JSON object. Never respond with plain text. Even for greetings or questions, wrap your reply in the JSON structure above with pendingAction type NONE.
                - CRITICAL: params must ALWAYS be a JSON object {}, never a JSON array []. If scheduling multiple candidates, pick the first one and mention you will handle others separately.
                """
                .formatted(context);

        int start = Math.max(0, history.size() - 10);
        StringBuilder contextHistory = new StringBuilder();
        for (int i = start; i < history.size(); i++) {
            var h = history.get(i);
            contextHistory.append(h.role().toUpperCase())
                    .append(": ")
                    .append(h.content())
                    .append("\n");
        }

        return systemPrompt
                + (contextHistory.length() > 0
                ? "\n\nCONVERSATION SO FAR:\n" + contextHistory
                : "");
    }

    private CoWorkerChatResponse parseResponse(Long sessionId, String content) {
        try {
            String clean = cleanJson(content);

            if (!clean.startsWith("{")) {
                return new CoWorkerChatResponse(sessionId, clean, null);
            }

            var root = objectMapper.readTree(clean);
            String message = root.path("message").asText("How can I help?");
            var pa = root.path("pendingAction");
            CoWorkerChatResponse.PendingAction pendingAction = null;
            if (pa != null && !pa.isMissingNode() && !"NONE".equals(pa.path("type").asText("NONE"))) {
                pendingAction = new CoWorkerChatResponse.PendingAction(
                        pa.path("type").asText(),
                        pa.path("description").asText(),
                        actionParams(pa.path("params")));
            }
            return new CoWorkerChatResponse(sessionId, message, pendingAction);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse Co-worker AI response", e);
        }
    }

    private Map<String, Object> actionParams(com.fasterxml.jackson.databind.JsonNode paramsNode) {
        if (paramsNode.isArray()) {
            @SuppressWarnings("unchecked")
            List<Object> list = objectMapper.convertValue(paramsNode, List.class);
            Map<String, Object> actionParams = new LinkedHashMap<>();
            actionParams.put("items", list);
            List<String> ids = new ArrayList<>();
            List<String> names = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    if (m.get("candidateId") != null) ids.add(m.get("candidateId").toString());
                    if (m.get("candidateName") != null) names.add(m.get("candidateName").toString());
                }
            }
            if (!ids.isEmpty()) actionParams.put("candidateIds", ids);
            if (!names.isEmpty()) actionParams.put("candidateNames", names);
            return actionParams;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> m = objectMapper.convertValue(paramsNode, Map.class);
        return m != null ? m : new LinkedHashMap<>();
    }

    private static String cleanJson(String s) {
        String t = s.strip();
        if (t.startsWith("```")) {
            t = t.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```$", "").strip();
        }
        return t;
    }
}
