import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import { SimilaritySearch } from '../search/similarity-search.js';

// Schema for label prediction output
const LabelPredictionSchema = z.object({
  labels: z.array(z.string()).describe("Array of labels selected from the similar issues")
});

type LabelPrediction = z.infer<typeof LabelPredictionSchema>;

export class LabelPredictorAgent {
  private llm: ChatOpenAI;
  private similaritySearch: SimilaritySearch;
  private predictionChain: RunnableSequence | undefined;

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });

    this.similaritySearch = new SimilaritySearch();
  }

  async initialize() {
    await this.similaritySearch.initialize();
    
    // Create the label prediction prompt
    const predictionPrompt = PromptTemplate.fromTemplate(`
You are a GitHub issue classifier. You will be given a new issue and a list of similar issues with their ground truth labels.

Your task is to analyze the new issue and predict appropriate labels based on patterns from similar issues.

SIMILAR ISSUES WITH GROUND TRUTH LABELS:
{similar_issues_with_labels}

NEW ISSUE TO CLASSIFY:
Title: {title}
Description: {description}

LABEL ASSIGNMENT GUIDELINES:
1. **Prioritize single labels** - Most issues (83%) need only one primary label
2. **Use multiple labels only when necessary** - Only when the issue clearly spans multiple categories

LABELING PATTERNS:
- **bug**: Clear technical issues, errors, broken functionality
- **question**: Help-seeking, "how to" inquiries, configuration questions
- **improvement**: Making existing features better, performance fixes
- **enhancement**: New features, integrations, major additions
- **documentation**: Documentation gaps, unclear instructions

MULTIPLE LABEL SCENARIOS:
- **bug + question**: Bug reports where user also asks for help/clarification
- **improvement + question**: Improvement requests seeking guidance
- **bug + improvement**: Bug reports that also suggest fixes
- **enhancement + question**: Feature requests seeking input
- **documentation + question**: Documentation issues seeking clarification

DECISION PROCESS:
1. Find the most similar issue(s) based on title and description content
2. Determine if this is a clear single-category issue or a complex multi-category issue
3. For complex issues, check if they match known multiple label patterns
4. Return the exact ground truth labels from the most similar issue(s)
5. Do NOT create new labels - only return existing ground truth labels

Return a JSON object with this exact structure:
{{
  "labels": ["exact_ground_truth_label1", "exact_ground_truth_label2"]
}}
`);

    // Create the prediction chain
    this.predictionChain = RunnableSequence.from([
      predictionPrompt,
      this.llm.withStructuredOutput(LabelPredictionSchema),
    ]);
  }

  private formatSimilarIssuesWithLabels(similarIssues: any[]) {
    return similarIssues.map((issue, index) => {
      return `${index + 1}. Issue #${issue.issue_num} (Vector Similarity Score: ${issue.similarity_score.toFixed(3)})
   Title: "${issue.issue_title}"
   Ground Truth Labels: [${issue.ground_truth_labels.join(', ')}]
   Full Content: "${issue.content}"

`;
    }).join('');
  }

  async predictLabels(title: string, description: string): Promise<{
    predicted_labels: string[];
    similar_issues: any[];
  }> {
    // Get similar issues with their ground truth labels
    const similarIssues = await this.similaritySearch.findSimilarIssuesForLabeling(
      { title, description },
      5
    );

    if (similarIssues.length === 0) {
      console.log('❌ No similar issues found');
      return {
        predicted_labels: [],
        similar_issues: [],
      };
    }

    console.log(`📊 Found ${similarIssues.length} similar issues for label prediction`);

    // Format similar issues for the prompt
    const formattedSimilarIssues = this.formatSimilarIssuesWithLabels(similarIssues);

    // Run the prediction chain
    const prediction = await this.predictionChain!.invoke({
      similar_issues_with_labels: formattedSimilarIssues,
      title,
      description
    });

    console.log(`✅ Predicted labels: ${prediction.labels.join(', ')}`);

    return {
      predicted_labels: prediction.labels,
      similar_issues: similarIssues,
    };
  }
}
