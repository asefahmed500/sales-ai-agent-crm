import { streamText, createProviderRegistry } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';
dotenv.config();

// Define custom Z.AI provider using @ai-sdk/openai
const zaiProvider = createOpenAI({
  apiKey: process.env.ZAI_API_KEY || 'your-zai-api-key-here',
  baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
});

// Create registry with '/' separator to parse 'zai/glm-5.1'
const registry = createProviderRegistry(
  {
    zai: zaiProvider,
  },
  { separator: '/' }
);

// Set it as default provider globally
globalThis.AI_SDK_DEFAULT_PROVIDER = registry as any;

async function test() {
  try {
    console.log("Testing streamText with zai/glm-5.1 (direct routing)...");
    console.log("ENV Keys available:", {
      ZAI_API_KEY: process.env.ZAI_API_KEY,
      ZAI_BASE_URL: process.env.ZAI_BASE_URL,
    });

    const result = streamText({
      model: 'zai/glm-5.1',
      prompt: 'Why is the sky blue?'
    });

    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    console.log("\nSuccess!");
  } catch (error: any) {
    console.error("\nError caught:", error.message || error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

test();
