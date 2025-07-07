#!/usr/bin/env tsx

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const REPO_OWNER = 'langchain-ai';
const REPO_NAME = 'langchainjs';
const OUTPUT_DIR = './langchainjs-gh-issues';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Issue structure interface
interface IssueData {
  issue_num: string;
  issue_title: string;
  issue_description: string;
  ground_truth_labels: string[];
}

// Utility function to sanitize filename
function sanitizeFilename(str: string): string {
  return str.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

// Utility function to make GitHub API requests
async function githubRequest(url: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Issue-Router-Fetcher'
  };
  
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Function to fetch all issues (with pagination)
async function fetchAllIssues(): Promise<any[]> {
  let allIssues: any[] = [];
  let page = 1;
  let hasMore = true;
  
  console.log('Fetching issues from GitHub...');
  
  while (hasMore) {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&page=${page}&per_page=100`;
    
    try {
      const issues = await githubRequest(url);
      
      if (issues.length === 0) {
        hasMore = false;
      } else {
        allIssues = allIssues.concat(issues);
        if (page % 5 === 0) {
          console.log(`Fetched ${allIssues.length} issues...`);
        }
        page++;
        
        // Wait 5 seconds after each API call to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`Error at page ${page} (URL: ${url}): ${errorMessage}`);
      
      // Wait 10 seconds and retry for any error
      console.log('Waiting 10 seconds before retrying...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Don't increment page, retry the same page
      continue;
    }
  }
  
  console.log(`Total issues fetched: ${allIssues.length}`);
  return allIssues;
}

// Function to process and transform issue data
function processIssueData(issue: any): IssueData {
  return {
    issue_num: issue.number.toString(),
    issue_title: issue.title,
    issue_description: issue.body || '',
    ground_truth_labels: issue.labels.map((label: any) => label.name)
  };
}

// Function to save issue data to JSON file
function saveIssueToFile(issueData: IssueData): void {
  const sanitizedTitle = sanitizeFilename(issueData.issue_title);
  // Truncate filename to prevent ENAMETOOLONG error (max 100 chars for title part)
  const truncatedTitle = sanitizedTitle.length > 100 ? sanitizedTitle.substring(0, 100) : sanitizedTitle;
  const filename = `${issueData.issue_num}-${truncatedTitle}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(issueData, null, 2), 'utf8');
    // Silent save
  } catch (error) {
    console.error(`❌ Error saving ${filename}:`, (error as Error).message);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Fetch all issues
    const issues = await fetchAllIssues();
    
    console.log('\nProcessing issues...');
    
    // Process each issue
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      
      // Skip pull requests (they appear in issues API but have pull_request property)
      if (issue.pull_request) {
        continue;
      }
      
      if (i % 50 === 0) { // Only log every 50th issue
        console.log(`Processing issue ${i + 1}/${issues.length}`);
      }
      
      // Process and transform the data
      const processedData = processIssueData(issue);
      
      // Save to file
      saveIssueToFile(processedData);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 All issues have been processed and saved!');
    console.log(`📁 Check the '${OUTPUT_DIR}' directory for the JSON files.`);
    
  } catch (error) {
    console.error('❌ Script failed:', (error as Error).message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
