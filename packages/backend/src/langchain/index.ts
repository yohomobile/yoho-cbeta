/**
 * LangChain 深度问答模块
 *
 * 提供基于多路检索（语义+全文+词典）的深度 RAG 问答能力
 */

// 类型
export * from "./types.js"

// 检索器
export {
  SemanticRetriever,
  FulltextRetriever,
  BM25Retriever,
  DictionaryRetriever,
  EnsembleRetriever,
  BM25EnsembleRetriever,
} from "./retrievers/index.js"

// Chain
export { DeepRAGChain, BM25DeepRAGChain } from "./chains/index.js"

// Prompts
export { deepAnswerPrompt } from "./prompts/index.js"
