export const WEBHOOK_URLS = {
  businessDoc: import.meta.env.VITE_BUSINESS_DOC_WEBHOOK_URL as string | undefined
    ?? "https://hook.eu2.make.com/mvoa8y6bbtii2y3qbm1lig5sgsk8x4go",
  aiService: import.meta.env.VITE_AI_SERVICE_WEBHOOK_URL as string | undefined
    ?? "https://hook.eu2.make.com/8rv96172o619qcwsf9adwu7vunl4ysip",
} as const;
