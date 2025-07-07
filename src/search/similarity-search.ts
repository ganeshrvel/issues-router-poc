import 'dotenv/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Document } from '@langchain/core/documents';
import { VECTOR_STORE_TABLE_NAME } from '../const.js';

export class SimilaritySearch {
  private vectorStore: PGVectorStore | undefined;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async initialize() {
    console.log('🔧 Initializing Similarity Search vector store...');
    
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

    console.log('✅ Similarity Search vector store initialized');
  }

  async searchSimilarIssues(query: string, topK: number = 5) {
    console.log(`🔍 Searching for ${topK} similar issues for query: "${query}"`);
    
    const results = await this.vectorStore!.similaritySearchWithScore(query, topK);
    
    console.log(`📊 Found ${results.length} similar documents`);
    
    return results.map(([doc, score], index) => {
      return {
        issue_num: doc.metadata?.issue_num,
        issue_title: doc.metadata?.issue_title,
        issue_ref: doc.metadata?.issue_ref,
        document_source: doc.metadata?.document_source,
        source: doc.metadata?.source,
        chunk_index: doc.metadata?.chunk_index,
        chunk_size: doc.metadata?.chunk_size,
        content: doc.pageContent,
        similarity_score: score,
        ground_truth_labels: doc.metadata?.ground_truth_labels,
      };
    });
  }

  async findSimilarIssuesForLabeling({title, description}: {title: string, description: string}, topK: number = 5) {
    // Format query to match indexed data structure
    const query = `Issue body: ${title}\n\nDescription: ${description}`;
    
    const results = await this.searchSimilarIssues(query, topK);
    
    return results.map(result => ({
      issue_num: result.issue_num,
      issue_title: result.issue_title,
      similarity_score: result.similarity_score,
      ground_truth_labels: result.ground_truth_labels,
      content: result.content
    }));
  }
}
