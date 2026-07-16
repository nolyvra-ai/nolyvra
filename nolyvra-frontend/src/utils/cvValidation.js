export const SUPPORTED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export function isSupportedCvFile(file) {
  return Boolean(file && SUPPORTED_CV_MIME_TYPES.includes(file.type));
}

export function validateCvContent(text) {
  const wordCount = (text || "").trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 80) {
    return "This file doesn't contain enough text to be a CV. Please upload a valid CV document.";
  }

  const lowerText = text.toLowerCase();

  const careerKeywords = [
    "work experience", "employment history", "professional experience",
    "career history", "work history", "previous employment",
    "job title", "job description", "responsibilities", "key responsibilities",
    "internship", "volunteer",
  ];
  const hasCareer = careerKeywords.some(k => lowerText.includes(k));

  const educationKeywords = [
    "education", "qualification", "university", "college", "degree",
    "bachelor", "master", "phd", "diploma", "certification",
    "graduated", "gcse", "a-level", "high school",
  ];
  const hasEducation = educationKeywords.some(k => lowerText.includes(k));

  const skillsKeywords = [
    "skills", "competencies", "expertise", "proficient", "summary",
    "profile", "objective", "about me", "curriculum vitae", "resume",
    "references", "achievements", "accomplishments",
  ];
  const hasSkills = skillsKeywords.some(k => lowerText.includes(k));

  const groupsMatched = [hasCareer, hasEducation, hasSkills].filter(Boolean).length;
  if (groupsMatched < 2) {
    return "This file doesn't appear to be a CV or resume. Please upload a candidate's CV document (must include employment history and education or skills).";
  }

  return null;
}
