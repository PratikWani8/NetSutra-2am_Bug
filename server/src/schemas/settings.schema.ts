import { z } from 'zod';

export const updateAiProviderSchema = z.object({
  provider: z.enum(['gemma-api', 'ollama'], {
    errorMap: () => ({ message: "Provider must be either 'gemma-api' or 'ollama'" })
  })
});
