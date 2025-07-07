#!/usr/bin/env tsx

import 'dotenv/config';
import { IssueRouterIndexer } from '../src/indexing/issue-router-indexer.js';

async function main() {
  const indexer = new IssueRouterIndexer();

  try {
    console.log('🚀 Starting Issue Router indexing (LangChain.js GitHub issues)...');
    
    // Initialize the indexer
    await indexer.initialize();
    
    // Index all data sources (GitHub issues)
    await indexer.indexAll();
    
    console.log('🎉 Issue Router indexing process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Issue Router indexing failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
