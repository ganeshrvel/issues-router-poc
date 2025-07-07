import 'dotenv/config';
import { SimpleLabelPrediction } from './agents/simple-label-prediction.js';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
// import { Hono } from 'hono';
// import { serve } from '@hono/node-server';
// import * as console from "node:console";
//
// const app = new Hono();
//
// const PORT = 3555;
// // Start the server
// serve({ ...app, port: +(PORT) }, (info) => {
//   console.info(`Listening on http://localhost:${info.port}`);
// });
//
// // Handle termination signals for graceful shutdown
// process.on('SIGTERM', () => {
//   console.info('SIGTERM received, shutting down');
//   process.exit(0);
// });
//
// process.on('SIGINT', () => {
//   console.info('SIGINT received, shutting down');
//   process.exit(0);
// });
//
// async function testLabelPrediction() {
//   const predictor = new LabelPredictorAgent();
//
//   try {
//     await predictor.initialize();
//
// const title = "DynamicStructuredTool: Zod Error, Expected object, received string";
// const description = "Trying out Dynamic Structured Tools for the first time and running into this error. Using the exact DynamicStructuredTool provided here:\r\n\r\nhttps://js.langchain.com/docs/modules/agents/agents/action/structured_chat\r\n\r\nAny advice?";
//
//     const result = await predictor.predictLabels(title, description);
//
//     console.log('\n📊 Prediction Results:');
//     console.log('Predicted Labels:', result.predicted_labels);
//     console.log('Similar Issues Count:', result.similar_issues.length);
//
//     console.log('\n🎉 Label prediction testing completed!');
//
//   } catch (error) {
//     console.error('❌ Label prediction test failed:', error);
//     process.exit(1);
//   }
// }
//
// async function testSimpleLabelPrediction() {
//   const predictor = new SimpleLabelPrediction();
//
//   try {
//     const title = "DynamicStructuredTool: Zod Error, Expected object, received string";
//     const description = "Trying out Dynamic Structured Tools for the first time and running into this error. Using the exact DynamicStructuredTool provided here:\r\n\r\nhttps://js.langchain.com/docs/modules/agents/agents/action/structured_chat\r\n\r\nAny advice?";
//
//     const predictedLabels = await predictor.predictLabels(title, description);
//     console.log('Predicted Labels:', predictedLabels);
//
//
//   } catch (error) {
//     console.error('❌ Simple label prediction test failed:', error);
//     process.exit(1);
//   }
// }

interface IssueTriageRow {
  issue_num: string;
  issue_title: string;
  issue_description: string;
  ground_truth_labels: string[];
}

interface ExperimentResult {
  issue_num: string;
  issue_title: string;
  issue_description: string;
  ground_truth_labels: string[];
  predicted_labels: string[];
}

async function runExperiment() {
  const predictor = new SimpleLabelPrediction();
  const devsetDir = path.join(process.cwd(), 'devset');

  // Read all JSON files from devset directory
  const files = fs.readdirSync(devsetDir).filter(file => file.endsWith('.json'));
  const devDataset: IssueTriageRow[] = [];

  for (const file of files) {
    const filePath = path.join(devsetDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const issue = JSON.parse(content);
    devDataset.push(issue);
  }

  console.log(`Running experiment on ${devDataset.length} issues from devset`);

  const experimentResults: ExperimentResult[] = [];

  for (const [i, row] of devDataset.entries()) {
    const predictedLabels = await predictor.predictLabels(row.issue_title, row.issue_description);

    experimentResults.push({
      issue_num: row.issue_num,
      issue_title: row.issue_title,
      issue_description: row.issue_description,
      ground_truth_labels: row.ground_truth_labels,
      predicted_labels: predictedLabels
    });

    console.log(`Processed ${i + 1}/${devDataset.length}`);
  }

  // Save experiment results
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Save as JSON
  const jsonFilename = `experiment_results_${timestamp}.json`;
  fs.writeFileSync(path.join(resultsDir, jsonFilename), JSON.stringify(experimentResults, null, 2));

  // Clean text helper function - removes line breaks for CSV compatibility
  const cleanText = (text: string) => {
    return text
      .replace(/\\r\\n/g, ' ')  // Replace escaped Windows line endings with spaces
      .replace(/\\r/g, ' ')     // Replace escaped Mac line endings with spaces
      .replace(/\\n/g, ' ')     // Replace escaped Unix line endings with spaces
      .replace(/\r\n/g, ' ')    // Replace actual Windows line endings with spaces
      .replace(/\r/g, ' ')      // Replace actual Mac line endings with spaces
      .replace(/\n/g, ' ')      // Replace actual Unix line endings with spaces
      .replace(/\\"/g, '"')     // Replace escaped quotes with regular quotes
      .replace(/\\'/g, "'")     // Replace escaped single quotes with regular single quotes
      .replace(/\\ \\/g, ' ')   // Replace literal '\ \' sequences with single space
      .replace(/\\\\/g, ' ')    // Replace double backslashes with space
      .replace(/\s+/g, ' ')     // Normalize multiple spaces
      .trim();
  };

  // Save as CSV using proper CSV library
  const csvFilename = `experiment_results_${timestamp}.csv`;
  const csvData = experimentResults.map(result => ({
    issue_num: result.issue_num,
    issue_title: cleanText(result.issue_title),
    issue_description: cleanText(result.issue_description),
    ground_truth_labels: result.ground_truth_labels.join(';'),
    predicted_labels: result.predicted_labels.join(';')
  }));

  const csvContent = stringify(csvData, {
    header: true,
    columns: {
      issue_num: 'issue_num',
      issue_title: 'issue_title',
      issue_description: 'issue_description',
      ground_truth_labels: 'ground_truth_labels',
      predicted_labels: 'predicted_labels'
    },
    quoted: true,
    quoted_empty: true,
    quoted_string: true,
    escape: '"',
    delimiter: ',',
    record_delimiter: '\n'
  });

  fs.writeFileSync(path.join(resultsDir, csvFilename), csvContent);

  // study experiment results
  let count = 0;
  for (const result of experimentResults) {
    if (JSON.stringify(result.predicted_labels.sort()) !== JSON.stringify(result.ground_truth_labels.sort())) {
      count += 1;
    }
  }

  console.log(`Mismatches: ${count}/${experimentResults.length}`);
}


// // testSimpleLabelPrediction().catch(console.error);
runExperiment().catch(console.error);
