/**
 * 测试 LangChain 调用本地 OpenAI 兼容 API
 */

import { ChatOpenAI } from "@langchain/openai"

async function testLangChain() {
  console.log("测试 LangChain 调用本地 OpenAI API...\n")

  const llm = new ChatOpenAI({
    modelName: "gpt-5.2",
    temperature: 0.7,
    configuration: {
      baseURL: "http://localhost:3006/v1",
    },
    // 本地服务不需要 API key，但 LangChain 要求提供
    apiKey: "not-needed",
  })

  try {
    console.log("发送请求...")
    const response = await llm.invoke("说一句话")
    console.log("\n响应内容:")
    console.log(response.content)
    console.log("\n完整响应对象:")
    console.log(JSON.stringify(response, null, 2))
  } catch (error) {
    console.error("调用失败:", error)
  }
}

testLangChain()
