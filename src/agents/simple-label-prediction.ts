import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';

// Allowed labels list
const ALLOWED_LABELS = ['bug', 'documentation', 'enhancement', 'improvement', 'nit', 'question', 'refactor'];

// Schema for simple label prediction
const SimpleLabelPredictionSchema = z.object({
  labels: z.array(z.enum(['bug', 'documentation', 'enhancement', 'improvement', 'nit', 'question', 'refactor']))
    .describe("Array of predicted labels from the allowed list")
});

type SimpleLabelPrediction = z.infer<typeof SimpleLabelPredictionSchema>;

export class SimpleLabelPrediction {
  private llm: ChatOpenAI;
  private predictionChain: RunnableSequence;

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });

    // Create the simple prediction prompt
    const predictionPrompt = PromptTemplate.fromTemplate(`
You are a GitHub issue classifier. You will be given an issue title and description, and you need to predict the most appropriate labels.

ALLOWED LABELS: ${ALLOWED_LABELS.join(', ')}

You can ONLY choose from these labels. Do not create or suggest any other labels.

ISSUE TO CLASSIFY:
Title: {title}
Description: {description}

INSTRUCTIONS:
1. Analyze the title and description of the issue
2. Determine what type of issue this is based on the content
3. Select the single most appropriate label from the allowed list only
4. Consider:
   - bug: Issues reporting problems, errors, or unexpected behavior
   - documentation: Issues about docs, examples, or unclear explanations  
   - enhancement: New features or significant improvements
   - improvement: Minor improvements to existing functionality
   - nit: Small style, formatting, or minor code quality issues
   - question: Questions about usage, clarification requests
   - refactor: Code restructuring without changing functionality

Return a JSON object with this exact structure (only one label):
{{
  "labels": ["label1"]
}}
`);

    // Create the prediction chain
    this.predictionChain = RunnableSequence.from([
      predictionPrompt,
      this.llm.withStructuredOutput(SimpleLabelPredictionSchema),
    ]);
  }

  async predictLabels(title: string, description: string): Promise<string[]> {

    // Run the prediction chain
    const prediction = await this.predictionChain.invoke({
      title,
      description
    });


    return prediction.labels;
  }
}