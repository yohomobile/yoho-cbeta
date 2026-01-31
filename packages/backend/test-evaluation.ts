/**
 * RAG 评估测试脚本
 */

import { RAGEvaluator, TEST_QUESTIONS, getQuestionsByDifficulty } from './src/langchain/evaluation/index.js'

async function main() {
  console.log('==========================================')
  console.log('     RAG 搜索质量评估测试')
  console.log('==========================================\n')

  const evaluator = new RAGEvaluator()

  // 测试配置：只测试 hard 和 expert 级别
  const hardQuestions = getQuestionsByDifficulty('hard')
  const expertQuestions = getQuestionsByDifficulty('expert')

  // 先测试5道 hard 题目
  console.log('========== Hard 级别测试 (5题) ==========\n')
  const hardSample = hardQuestions.slice(0, 5)

  for (let i = 0; i < hardSample.length; i++) {
    console.log(`\n[Hard ${i + 1}/${hardSample.length}]`)
    await evaluator.evaluateQuestion(hardSample[i])
    console.log('---')
  }

  // 再测试2道 expert 题目
  console.log('\n========== Expert 级别测试 (2题) ==========\n')
  const expertSample = expertQuestions.slice(0, 2)

  for (let i = 0; i < expertSample.length; i++) {
    console.log(`\n[Expert ${i + 1}/${expertSample.length}]`)
    await evaluator.evaluateQuestion(expertSample[i])
    console.log('---')
  }

  console.log('\n==========================================')
  console.log('  测试完成')
  console.log('==========================================\n')
}

main()
