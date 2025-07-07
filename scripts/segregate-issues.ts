#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

async function segregateIssues() {
  const issuesDir = path.join(process.cwd(), 'langchainjs-gh-issues');
  const devsetDir = path.join(process.cwd(), 'devset');
  const testsetDir = path.join(process.cwd(), 'testset');
  
  console.log('🚀 Starting issue segregation...');
  
  // Clean and create directories
  if (fs.existsSync(devsetDir)) {
    fs.rmSync(devsetDir, { recursive: true });
  }
  if (fs.existsSync(testsetDir)) {
    fs.rmSync(testsetDir, { recursive: true });
  }
  
  fs.mkdirSync(devsetDir);
  fs.mkdirSync(testsetDir);
  console.log('📁 Created devset and testset directories');
  
  // Read all JSON files
  const files = fs.readdirSync(issuesDir).filter(file => file.endsWith('.json'));
  console.log(`📄 Found ${files.length} total issue files`);
  
  const filteredIssues: any[] = [];
  const allAutoLabels = new Set<string>();
  
  // Filter issues with auto: labels
  for (const file of files) {
    const filePath = path.join(issuesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const issue = JSON.parse(content);
    
    if (issue.ground_truth_labels && Array.isArray(issue.ground_truth_labels)) {
      const autoLabels = issue.ground_truth_labels.filter((label: string) =>
        label.startsWith('auto:')
      );
      
      if (autoLabels.length > 0) {
        // Strip 'auto:' prefix and collect unique labels
        const strippedLabels = autoLabels.map((label: string) => label.replace('auto:', ''));
        strippedLabels.forEach(label => allAutoLabels.add(label));
        
        // Update the issue with stripped labels
        const updatedIssue = {
          ...issue,
          ground_truth_labels: strippedLabels
        };
        
        filteredIssues.push({
          filename: file,
          data: updatedIssue
        });
      }
    }
  }
  
  console.log(`✅ Filtered ${filteredIssues.length} issues with auto: labels`);
  
  // Divide into two halves
  const midpoint = Math.floor(filteredIssues.length / 2);
  const devsetIssues = filteredIssues.slice(0, midpoint);
  const testsetIssues = filteredIssues.slice(midpoint);
  
  // Save devset
  for (const issue of devsetIssues) {
    const targetPath = path.join(devsetDir, issue.filename);
    fs.writeFileSync(targetPath, JSON.stringify(issue.data, null, 2));
  }
  
  // Save testset
  for (const issue of testsetIssues) {
    const targetPath = path.join(testsetDir, issue.filename);
    fs.writeFileSync(targetPath, JSON.stringify(issue.data, null, 2));
  }
  
  console.log(`📊 Segregation complete:`);
  console.log(`   Devset: ${devsetIssues.length} issues`);
  console.log(`   Testset: ${testsetIssues.length} issues`);
  
  // Output all available ground truth labels
  const sortedLabels = Array.from(allAutoLabels).sort();
  console.log('\n⏺ The labels as a comma-separated string:');
  console.log(sortedLabels.join(', '));
  
  console.log('\n🎉 Issue segregation completed successfully!');
}

segregateIssues().catch(console.error);
