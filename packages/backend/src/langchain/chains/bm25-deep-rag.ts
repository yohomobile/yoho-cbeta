/**
 * BM25 深度 RAG Chain
 * 使用 BM25EnsembleRetriever 替代标准 EnsembleRetriever
 */

import { DeepRAGChain } from "./deep-rag.js"
import { BM25EnsembleRetriever } from "../retrievers/bm25-ensemble-retriever.js"
import type { DeepRAGConfig } from "../types.js"

export class BM25DeepRAGChain extends DeepRAGChain {
  constructor(config?: Partial<DeepRAGConfig>) {
    super(config)

    // 替换为 BM25 版本的检索器
    const defaultConfig = {
      retriever: { topK: 10 },
      ensemble: {
        semanticWeight: 0.5,
        fulltextWeight: 0.3,
        dictionaryWeight: 0.2,
        rrfK: 60,
        finalTopK: 15,
      },
      expandContext: true,
      contextWindow: 2,
      maxChunkLength: 1500,
      maxContextLength: 20000,
    }

    const mergedConfig = { ...defaultConfig, ...config }

    // @ts-ignore - 替换父类的 retriever
    this.retriever = new BM25EnsembleRetriever(
      mergedConfig.retriever,
      mergedConfig.ensemble
    )
  }
}
