/**
 * 测试 LangChain 调用 MiniMax API (含 function call)
 */

import { ChatOpenAI } from "@langchain/openai"

const MINIMAX_API_KEY = "sk-cp-cgokXAb_zATA2aXNgkHm1LBr3FrYdA1qyUQPAQ6mDNayMVSCkkNFQ7vrWL3moIQkPUBWYqrlZtOtRSwvs_nUqyB1UO504zhYIsYygOvRt2x6ssxaDuLDYTc"

async function testBasicCall() {
  console.log("=== 测试 1: 基础调用 ===\n")

  const llm = new ChatOpenAI({
    modelName: "MiniMax-M2.1",
    temperature: 0.3,
    maxTokens: 500,
    configuration: {
      baseURL: "https://api.minimax.io/v1",
    },
    apiKey: MINIMAX_API_KEY,
  })

  try {
    const response = await llm.invoke("你好，请用一句话介绍自己")
    console.log("响应内容:")
    console.log(response.content)
    console.log("\n✅ 基础调用成功!\n")
  } catch (error) {
    console.error("❌ 基础调用失败:", error)
  }
}

async function testStructuredOutput() {
  console.log("=== 测试 2: 结构化输出 (withStructuredOutput) ===\n")

  const llm = new ChatOpenAI({
    modelName: "MiniMax-M2.1",
    temperature: 0.3,
    maxTokens: 500,
    configuration: {
      baseURL: "https://api.minimax.io/v1",
    },
    apiKey: MINIMAX_API_KEY,
  })

  const schema = {
    type: "object",
    properties: {
      answer: { type: "string", description: "回答内容" },
      confidence: { type: "number", description: "置信度 0-1" },
    },
    required: ["answer", "confidence"],
  }

  try {
    const structuredLlm = llm.withStructuredOutput(schema, {
      name: "simple_answer",
    })

    const response = await structuredLlm.invoke("1+1等于几？")
    console.log("结构化响应:")
    console.log(JSON.stringify(response, null, 2))
    console.log("\n✅ 结构化输出成功!\n")
  } catch (error) {
    console.error("❌ 结构化输出失败:", error)
  }
}

async function testBindTools() {
  console.log("=== 测试 3: bindTools ===\n")

  const llm = new ChatOpenAI({
    modelName: "MiniMax-M2.1",
    temperature: 0.3,
    maxTokens: 500,
    configuration: {
      baseURL: "https://api.minimax.io/v1",
    },
    apiKey: MINIMAX_API_KEY,
  })

  const tools = [
    {
      type: "function" as const,
      function: {
        name: "get_weather",
        description: "获取天气信息",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "城市名" },
          },
          required: ["city"],
        },
      },
    },
  ]

  try {
    const llmWithTools = llm.bindTools(tools)
    const response = await llmWithTools.invoke("北京今天天气怎么样？")
    console.log("响应内容:")
    console.log(response.content)
    console.log("\nTool calls:")
    console.log(JSON.stringify(response.tool_calls, null, 2))
    console.log("\n✅ bindTools 成功!\n")
  } catch (error) {
    console.error("❌ bindTools 失败:", error)
  }
}

async function main() {
  console.log("开始测试 LangChain + MiniMax API...\n")

  await testBasicCall()
  await testStructuredOutput()
  await testBindTools()

  console.log("=== 测试完成 ===")
}

main()
