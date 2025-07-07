import fs from 'fs';
import path from 'path';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { VECTOR_STORE_TABLE_NAME } from '../const.js';

export class IssueRouterIndexer {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: PGVectorStore | undefined;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 600,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  async initialize() {
    console.log('🔧 Initializing Issue Router PgVector store...');
    
    this.vectorStore = await PGVectorStore.initialize(this.embeddings, {
      postgresConnectionOptions: {
        connectionString: process.env.POSTGRES_CONNECTION_STRING!,
      },
      tableName: VECTOR_STORE_TABLE_NAME,
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'document',
        metadataColumnName: 'metadata',
      },
    });

    console.log('✅ Issue Router PgVector store initialized');
  }

  async indexGitHubIssues() {
    console.log('🚀 Starting GitHub issues indexing for Issue Router...');

    const issuesDir = path.join(process.cwd(), 'langchainjs-gh-issues');
    const documents: Document[] = [];

    try {
      const files = fs.readdirSync(issuesDir).filter((file: string) => file.endsWith('.json'));
      console.log(`📁 Found ${files.length} issue files`);

      let totalIssues = 0;
      let issuesWithLabels = 0;
      let issuesWithoutLabels = 0;

      for (const file of files) {
        const filePath = path.join(issuesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const issue = JSON.parse(content);
        
        totalIssues++;

        // Filter: Only index issues that have at least one label
        if (!issue.ground_truth_labels || issue.ground_truth_labels.length === 0) {
          issuesWithoutLabels++;
          continue;
        }

        issuesWithLabels++;

        // Create searchable text from issue
        let text = `Github issue number #${issue.issue_num}\n\n`;
        text += `Issue body: ${issue.issue_title}\n\n`;
        text += `Description: ${issue.issue_description}\n\n`;

        // Create metadata
        const metadata = {
          issue_num: issue.issue_num,
          issue_title: issue.issue_title,
          issue_ref: `Issue #${issue.issue_num}`,
          document_source: 'langchainjs-github-issues',
          source: 'langchainjs-github-issues',
          ground_truth_labels: issue.ground_truth_labels,
        };

        // Create document
        documents.push(new Document({
          pageContent: text,
          metadata,
        }));
      }

      console.log(`📊 Filtering results:`);
      console.log(`   Total issues found: ${totalIssues}`);
      console.log(`   Issues with labels (indexed): ${issuesWithLabels}`);
      console.log(`   Issues without labels (filtered out): ${issuesWithoutLabels}`);

      console.log(`📄 Created ${documents.length} documents from GitHub issues`);

      // Split documents into chunks and enhance metadata
      const allChunks: Document[] = [];
      for (const doc of documents) {
        const chunks = await this.textSplitter.splitDocuments([doc]);
        
        const enhancedChunks = chunks.map((chunk, index) => {
          return new Document({
            pageContent: chunk.pageContent,
            metadata: {
              ...chunk.metadata,
              chunk_index: index,
              chunk_size: chunk.pageContent.length,
              original_doc_length: doc.pageContent.length,
            }
          });
        });
        
        allChunks.push(...enhancedChunks);
      }
      
      console.log(`✂️ Split into ${allChunks.length} chunks`);

      // Add documents to vector store in batches
      const batchSize = 100;
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        await this.vectorStore!.addDocuments(batch);
        console.log(`✅ Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
      }

      console.log(`🎉 Successfully indexed ${allChunks.length} chunks from ${documents.length} GitHub issues!`);

    } catch (error) {
      console.error('❌ Error reading GitHub issues:', error);
      console.error(`❌ GitHub issues directory not found at: ${issuesDir}`);
      console.error('❌ Please ensure the langchainjs-gh-issues directory exists and contains JSON files');
      throw error;
    }
  }

  async indexAll() {
    console.log('🚀 Starting complete indexing process...');
    
    await this.clearIndex();
    await this.indexGitHubIssues();
    
    console.log('🎉 Complete indexing process finished!');
  }

  async clearIndex() {
    console.log('🗑️ Clearing existing index...');
    try {
      const client = await this.vectorStore!.pool.connect();
      const result = await client.query(`DELETE FROM ${VECTOR_STORE_TABLE_NAME}`);
      client.release();
      console.log(`✅ Index cleared successfully - deleted ${result.rowCount} rows`);
    } catch (error) {
      console.log('❌ Error clearing index:', error);
      throw error;
    }
  }
}
