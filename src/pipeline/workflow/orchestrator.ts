import { generateJSON } from '../geminiClient';
import type { ModelTier } from '../geminiClient';
import type { WorkflowAgentInput, WorkflowAgentOutput } from './types';

/**
 * Maps a model string from the workflow config to a Gemini tier.
 * Accepts 'pro', 'flash', or full model names containing those keywords.
 */
function resolveModelTier(model: string): ModelTier {
  const lower = model.toLowerCase();
  if (lower.includes('pro')) return 'pro';
  return 'flash';
}

/**
 * Builds the final prompt by replacing {{key}} placeholders in the template
 * with values from the context, resolved through the inputMapping.
 *
 * inputMapping maps template keys to context keys:
 *   { "clientName": "client.name" }
 * means {{clientName}} in the template is replaced with context["client.name"].
 */
function buildPrompt(
  template: string,
  context: Record<string, any>,
  inputMapping: Record<string, string>
): string {
  let prompt = template;

  for (const [templateKey, contextKey] of Object.entries(inputMapping)) {
    const value = context[contextKey] ?? '';
    const placeholder = `{{${templateKey}}}`;
    prompt = prompt.split(placeholder).join(String(value));
  }

  // Replace any remaining unmapped placeholders with empty string
  prompt = prompt.replace(/\{\{[^}]+\}\}/g, '');

  return prompt;
}

/**
 * Calculates a simple confidence score based on whether the output
 * contains all expected keys defined in the outputMapping.
 */
function calculateConfidence(
  output: Record<string, any>,
  outputMapping: Record<string, string>
): number {
  const expectedKeys = Object.values(outputMapping);

  if (expectedKeys.length === 0) {
    // No output mapping defined — moderate confidence
    return 0.8;
  }

  const presentKeys = expectedKeys.filter((key) => {
    const value = output[key];
    return value !== undefined && value !== null && value !== '';
  });

  const ratio = presentKeys.length / expectedKeys.length;

  if (ratio >= 1) return 0.9;
  if (ratio >= 0.7) return 0.8;
  if (ratio >= 0.5) return 0.7;
  return 0.6;
}

/**
 * Estimates token usage based on prompt and output string lengths.
 * This is a rough heuristic — actual token counts would come from the API response.
 */
function estimateTokens(prompt: string, output: Record<string, any>): { input: number; output: number } {
  const outputStr = JSON.stringify(output);
  return {
    input: Math.ceil(prompt.length / 4),
    output: Math.ceil(outputStr.length / 4),
  };
}

/**
 * Executes a workflow agent by building a prompt from the template and context,
 * calling Gemini, and returning a structured WorkflowAgentOutput.
 *
 * Retries up to input.maxRetries times on failure.
 */
export async function runWorkflowAgent(input: WorkflowAgentInput): Promise<WorkflowAgentOutput> {
  const tier = resolveModelTier(input.model);
  const prompt = buildPrompt(input.promptTemplate, input.context, input.inputMapping);
  const agentName = `workflow-${input.agentType}`;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= input.maxRetries; attempt++) {
    try {
      const result = await generateJSON<Record<string, any>>(tier, prompt, agentName, {
        temperature: 0.7,
        maxOutputTokens: 4096,
      });

      const confidence = calculateConfidence(result, input.outputMapping);
      const tokens = estimateTokens(prompt, result);

      return {
        success: true,
        output: result,
        confidenceScore: confidence,
        tokensUsed: tokens,
      };
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      console.error(
        `[${agentName}] Attempt ${attempt + 1}/${input.maxRetries + 1} failed: ${lastError}`
      );

      // Don't wait after the last attempt
      if (attempt < input.maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  return {
    success: false,
    output: {},
    confidenceScore: 0,
    tokensUsed: { input: 0, output: 0 },
    error: `All ${input.maxRetries + 1} attempts failed. Last error: ${lastError}`,
  };
}
