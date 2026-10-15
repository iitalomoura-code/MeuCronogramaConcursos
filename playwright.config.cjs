const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--disable-gpu", "--disable-background-networking"],
    },
  },
  webServer: {
    command: "node tests/browser/server.cjs . 4250",
    url: "http://127.0.0.1:4250/index.html",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
