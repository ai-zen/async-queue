import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    // CI 环境下输出更详细的报告
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
    // 可选：测试超时时间（毫秒）
    testTimeout: 30000,
  },
});
