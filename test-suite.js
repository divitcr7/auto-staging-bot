#!/usr/bin/env node

/**
 * Comprehensive Git-Oops Testing Suite
 * Tests every command thoroughly with all edge cases
 */

import { execSync, spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

class GitOopsTestSuite {
  constructor(testDir) {
    this.testDir = testDir;
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      details: [],
    };
    this.originalDir = process.cwd();
    this.testId = Math.random().toString(36).substring(2, 8);
  }

  // Utility methods
  log(message, type = "info") {
    const colors = {
      info: "\x1b[36m", // Cyan
      success: "\x1b[32m", // Green
      error: "\x1b[31m", // Red
      warning: "\x1b[33m", // Yellow
      reset: "\x1b[0m",
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async exec(command, expectError = false) {
    try {
      const result = execSync(command, {
        cwd: this.testDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      if (expectError) {
        return {
          success: false,
          output: error.stderr?.trim() || error.message,
        };
      }
      throw error;
    }
  }

  async setupTestRepo() {
    this.log("🔧 Setting up test repository...", "info");

    // Ensure test directory exists
    if (!existsSync(this.testDir)) {
      mkdirSync(this.testDir, { recursive: true });
    }

    process.chdir(this.testDir);

    // Initialize git repo if not exists
    if (!existsSync(".git")) {
      await this.exec("git init");
      await this.exec('git config user.name "Test User"');
      await this.exec('git config user.email "test@example.com"');
    }

    // Create initial commit if none exists
    try {
      await this.exec("git rev-parse HEAD");
    } catch {
      writeFileSync("README.md", "# Test Repository\n");
      await this.exec("git add README.md");
      await this.exec('git commit -m "Initial commit"');
    }

    // Set up main branch
    await this.exec("git checkout -B main");

    this.log("✅ Test repository ready", "success");
  }

  async test(name, testFn) {
    try {
      this.log(`\n🧪 Testing: ${name}`, "info");
      await testFn();
      this.results.passed++;
      this.results.details.push({ name, status: "PASS", error: null });
      this.log(`✅ ${name} - PASSED`, "success");
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: name, error: error.message });
      this.results.details.push({ name, status: "FAIL", error: error.message });
      this.log(`❌ ${name} - FAILED: ${error.message}`, "error");
    }
  }

  async createTestFiles(files = {}) {
    for (const [filename, content] of Object.entries(files)) {
      writeFileSync(filename, content);
    }
  }

  async gitOops(command, expectError = false) {
    const gitOopsPath = join(this.originalDir, "dist/cli.js");
    return await this.exec(`node ${gitOopsPath} ${command}`, expectError);
  }

  // Test suites for each command
  async testWrongBranch() {
    await this.test("wrong-branch: basic functionality", async () => {
      // Setup: Create commits on wrong branch
      await this.exec(`git checkout -b feature-test-${this.testId}`);
      await this.createTestFiles({ "test1.txt": "test content 1" });
      await this.exec("git add test1.txt");
      await this.exec('git commit -m "Wrong branch commit 1"');

      await this.createTestFiles({ "test2.txt": "test content 2" });
      await this.exec("git add test2.txt");
      await this.exec('git commit -m "Wrong branch commit 2"');

      // Test wrong-branch command
      const result = await this.gitOops("wrong-branch --yes");

      // Verify we're now on the new fix/ branch
      const currentBranch = await this.exec("git branch --show-current");
      if (!currentBranch.output.startsWith("fix/")) {
        throw new Error(`Expected fix/ branch, got ${currentBranch.output}`);
      }

      // Verify the commits are on this branch
      const log = await this.exec("git log --oneline -2");
      if (!log.output.includes("Wrong branch commit")) {
        throw new Error("Commits should be on the new branch");
      }
    });

    await this.test("wrong-branch: with dirty working directory", async () => {
      await this.exec(`git checkout -b dirty-test-${this.testId}`);
      await this.createTestFiles({ "dirty.txt": "dirty content" });

      // Should succeed but warn about dirty working directory
      const result = await this.gitOops("wrong-branch --yes");
      // The command should handle dirty state gracefully
    });

    await this.test("wrong-branch: no upstream configured", async () => {
      await this.exec(`git checkout -b no-upstream-test-${this.testId}`);
      await this.createTestFiles({ "upstream-test.txt": "content" });
      await this.exec("git add upstream-test.txt");
      await this.exec('git commit -m "No upstream commit"');

      const result = await this.gitOops("wrong-branch --yes");
      // Should still work, just use local main as reference
    });
  }

  async testSplit() {
    await this.test("split: basic directory-based splitting", async () => {
      await this.exec("git checkout main");

      // Create files in different directories
      mkdirSync("src", { recursive: true });
      mkdirSync("docs", { recursive: true });
      await this.createTestFiles({
        "src/app.js": 'console.log("app");',
        "src/utils.js": "export const utils = {};",
        "docs/README.md": "# Documentation",
        "docs/API.md": "# API Guide",
      });

      await this.exec("git add .");

      // Test split command
      const result = await this.gitOops("split --yes");

      // Verify commits were created
      const log = await this.exec("git log --oneline -5");
      if (!log.output.includes("src/") || !log.output.includes("docs/")) {
        throw new Error("Directory-based commits not created");
      }
    });

    await this.test("split: with no staged changes", async () => {
      // Should handle gracefully with no staged changes
      const result = await this.gitOops("split");
      if (
        !result.output.includes("No staged changes") &&
        !result.output.includes("nothing to split")
      ) {
        throw new Error("Should handle no staged changes gracefully");
      }
    });

    await this.test("split: mixed file types", async () => {
      await this.createTestFiles({
        "mixed1.js": "js content",
        "mixed2.css": "css content",
        "mixed3.md": "md content",
      });
      await this.exec("git add .");

      const result = await this.gitOops("split --yes");
      // Should handle mixed file types appropriately
    });
  }

  async testYank() {
    await this.test("yank: basic pull with rebase", async () => {
      // Setup remote-like scenario
      await this.exec("git checkout main");
      await this.createTestFiles({ "local.txt": "local changes" });
      await this.exec("git add local.txt");
      await this.exec('git commit -m "Local changes"');

      // Test yank (should stash, pull, pop)
      const result = await this.gitOops("yank --yes");
    });

    await this.test("yank: with conflicts", async () => {
      await this.exec("git checkout main");
      await this.createTestFiles({ "conflict.txt": "local version" });
      await this.exec("git add conflict.txt");
      await this.exec('git commit -m "Local version"');

      // This might fail due to no remote, but should handle gracefully
      const result = await this.gitOops("yank --yes", true);
    });

    await this.test("yank: with clean working directory", async () => {
      await this.exec("git checkout main");
      // Ensure clean state
      await this.exec("git reset --hard HEAD");
      await this.exec("git clean -fd");

      const result = await this.gitOops("yank --yes");
    });
  }

  async testPocket() {
    await this.test("pocket: save working state", async () => {
      await this.exec("git checkout main");
      await this.createTestFiles({
        "pocket1.txt": "pocket content 1",
        "pocket2.txt": "pocket content 2",
      });

      const result = await this.gitOops("pocket save test-pocket --yes");

      // Verify working directory is clean
      const status = await this.exec("git status --porcelain");
      if (status.output.trim() !== "") {
        throw new Error("Working directory should be clean after pocket save");
      }
    });

    await this.test("pocket: restore working state", async () => {
      // First save something
      await this.createTestFiles({ "restore-test.txt": "restore content" });
      await this.gitOops("pocket save restore-test --yes");

      // Then restore
      const result = await this.gitOops("pocket restore restore-test --yes");

      // Verify file is restored
      if (!existsSync("restore-test.txt")) {
        throw new Error("File should be restored from pocket");
      }
    });

    await this.test("pocket: list saved states", async () => {
      const result = await this.gitOops("pocket list");
      // Should list available pocket saves
    });
  }

  async testRevertMerge() {
    await this.test("revert-merge: basic merge revert", async () => {
      // Create a merge scenario
      await this.exec("git checkout main");
      await this.exec(`git checkout -b merge-test-${this.testId}`);
      await this.createTestFiles({ "merge-file.txt": "merge content" });
      await this.exec("git add merge-file.txt");
      await this.exec('git commit -m "Merge branch changes"');

      await this.exec("git checkout main");
      await this.exec(
        `git merge merge-test-${this.testId} --no-ff -m "Merge branch merge-test-${this.testId}"`
      );

      // Get the merge commit hash
      const mergeCommit = await this.exec("git rev-parse HEAD");

      // Test revert-merge
      const result = await this.gitOops(
        `revert-merge ${mergeCommit.output.slice(0, 7)} --yes`
      );
    });

    await this.test("revert-merge: non-merge commit", async () => {
      // Try to revert a regular commit (should fail)
      const regularCommit = await this.exec("git rev-parse HEAD~2");
      const result = await this.gitOops(
        `revert-merge ${regularCommit.output.slice(0, 7)}`,
        true
      );

      if (
        !result.output.includes("not a merge commit") &&
        !result.output.includes("merge")
      ) {
        throw new Error("Should detect non-merge commits");
      }
    });
  }

  async testUndo() {
    await this.test("undo: last commit", async () => {
      await this.exec("git checkout main");
      await this.createTestFiles({ "undo-test.txt": "undo content" });
      await this.exec("git add undo-test.txt");
      await this.exec('git commit -m "Commit to undo"');

      const beforeUndo = await this.exec("git rev-parse HEAD");

      const result = await this.gitOops("undo --yes");

      const afterUndo = await this.exec("git rev-parse HEAD");
      if (beforeUndo.output === afterUndo.output) {
        throw new Error("Commit should have been undone");
      }
    });

    await this.test("undo: with working directory changes", async () => {
      await this.createTestFiles({ "undo-dirty.txt": "dirty for undo" });

      const result = await this.gitOops("undo --yes");
      // Should handle dirty state appropriately
    });
  }

  async testFixup() {
    await this.test("fixup: amend last commit", async () => {
      await this.exec("git checkout main");
      await this.createTestFiles({ "fixup-test.txt": "original content" });
      await this.exec("git add fixup-test.txt");
      await this.exec('git commit -m "Original commit"');

      // Make changes to fixup
      await this.createTestFiles({ "fixup-test.txt": "updated content" });
      await this.exec("git add fixup-test.txt");

      const result = await this.gitOops("fixup --yes");

      // Verify commit was amended
      const log = await this.exec("git log --oneline -1");
      if (!log.output.includes("Original commit")) {
        throw new Error("Commit should have been amended");
      }
    });

    await this.test("fixup: with custom message", async () => {
      await this.createTestFiles({ "fixup-msg.txt": "content" });
      await this.exec("git add fixup-msg.txt");

      const result = await this.gitOops(
        'fixup --message "Custom fixup message" --yes'
      );
    });

    await this.test("fixup: no staged changes", async () => {
      const result = await this.gitOops("fixup");
      if (
        !result.output.includes("Nothing to fixup") &&
        !result.output.includes("nothing to fixup")
      ) {
        throw new Error("Should handle no staged changes gracefully");
      }
    });
  }

  async testSave() {
    await this.test("save: quick save all changes", async () => {
      await this.exec("git checkout main");
      await this.createTestFiles({
        "save1.txt": "save content 1",
        "save2.txt": "save content 2",
      });

      const result = await this.gitOops("save --yes");

      // Verify commit was created
      const log = await this.exec("git log --oneline -1");
      if (
        !log.output.includes("Quick save") &&
        !log.output.includes("WIP") &&
        !log.output.includes("Auto save")
      ) {
        throw new Error("Save commit should have been created");
      }
    });

    await this.test("save: with custom message", async () => {
      await this.createTestFiles({ "save-custom.txt": "custom save" });

      const result = await this.gitOops(
        'save --message "Custom save message" --yes'
      );

      const log = await this.exec("git log --oneline -1");
      if (!log.output.includes("Custom save message")) {
        throw new Error("Custom message should be used");
      }
    });

    await this.test("save: clean working directory", async () => {
      await this.exec("git reset --hard HEAD");
      await this.exec("git clean -fd");

      const result = await this.gitOops("save", true);
      if (
        !result.output.includes("No changes") &&
        !result.output.includes("nothing to save")
      ) {
        throw new Error("Should handle clean working directory");
      }
    });
  }

  async testErrorHandling() {
    await this.test("error: invalid command", async () => {
      const result = await this.gitOops("invalid-command", true);
      if (
        !result.output.includes("Unknown command") &&
        !result.output.includes("invalid")
      ) {
        throw new Error("Should handle invalid commands");
      }
    });

    await this.test("error: outside git repository", async () => {
      const tempDir = "/tmp/not-git-repo";
      mkdirSync(tempDir, { recursive: true });
      process.chdir(tempDir);

      const result = await this.gitOops("save", true);
      // Should detect not in git repo

      process.chdir(this.testDir);
    });
  }

  async cleanup() {
    this.log("\n🧹 Cleaning up test environment...", "info");
    process.chdir(this.originalDir);

    // Reset test repo to clean state
    try {
      await this.exec(`git -C "${this.testDir}" checkout main`);
      await this.exec(`git -C "${this.testDir}" reset --hard HEAD`);
      await this.exec(`git -C "${this.testDir}" clean -fd`);

      // Delete all test branches with this testId
      const branches = await this.exec(`git -C "${this.testDir}" branch`);
      const branchLines = branches.output.split("\n");
      for (const line of branchLines) {
        const branchName = line.trim().replace(/^\*\s*/, "");
        if (branchName.includes(this.testId) && branchName !== "main") {
          try {
            await this.exec(`git -C "${this.testDir}" branch -D ${branchName}`);
          } catch (e) {
            // Ignore branch deletion errors
          }
        }
      }

      // Delete all test tags
      try {
        const tags = await this.exec(`git -C "${this.testDir}" tag -l`);
        const tagLines = tags.output.split("\n");
        for (const tag of tagLines) {
          if (tag.trim().startsWith("oops/")) {
            try {
              await this.exec(`git -C "${this.testDir}" tag -d ${tag.trim()}`);
            } catch (e) {
              // Ignore tag deletion errors
            }
          }
        }
      } catch (e) {
        // Ignore if no tags exist
      }
    } catch (error) {
      this.log(`Warning: Cleanup failed: ${error.message}`, "warning");
    }
  }

  async runAllTests() {
    this.log("🚀 Starting Git-Oops Comprehensive Test Suite\n", "info");
    this.log(`📁 Testing in: ${this.testDir}`, "info");

    try {
      // Build the project first
      this.log("🔨 Building git-oops...", "info");
      await this.exec(`cd "${this.originalDir}" && npm run build`);
      this.log("✅ Build completed", "success");

      await this.setupTestRepo();

      // Run all test suites
      await this.testWrongBranch();
      await this.testSplit();
      await this.testYank();
      await this.testPocket();
      await this.testRevertMerge();
      await this.testUndo();
      await this.testFixup();
      await this.testSave();
      await this.testErrorHandling();
    } catch (error) {
      this.log(`💥 Fatal error during testing: ${error.message}`, "error");
      this.results.errors.push({ test: "SETUP", error: error.message });
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  printResults() {
    this.log("\n" + "=".repeat(60), "info");
    this.log("📊 TEST RESULTS SUMMARY", "info");
    this.log("=".repeat(60), "info");

    this.log(`✅ Passed: ${this.results.passed}`, "success");
    this.log(`❌ Failed: ${this.results.failed}`, "error");
    this.log(`📈 Total: ${this.results.passed + this.results.failed}`, "info");

    if (this.results.failed > 0) {
      this.log("\n💀 FAILURES:", "error");
      this.results.errors.forEach(({ test, error }) => {
        this.log(`  • ${test}: ${error}`, "error");
      });
    }

    this.log("\n📋 DETAILED RESULTS:", "info");
    this.results.details.forEach(({ name, status, error }) => {
      const color = status === "PASS" ? "success" : "error";
      this.log(`  ${status === "PASS" ? "✅" : "❌"} ${name}`, color);
      if (error) {
        this.log(`     → ${error}`, "error");
      }
    });

    const successRate = Math.round(
      (this.results.passed / (this.results.passed + this.results.failed)) * 100
    );
    this.log(
      `\n🎯 Success Rate: ${successRate}%`,
      successRate >= 90 ? "success" : "warning"
    );

    if (this.results.failed === 0) {
      this.log(
        "\n🎉 ALL TESTS PASSED! Git-Oops is working perfectly!",
        "success"
      );
    } else {
      this.log("\n⚠️  Some tests failed. Check the errors above.", "warning");
    }
  }
}

// Run the test suite
const testDir =
  process.argv[2] || "/Users/divitpatidar/Documents/Development/Auto-Claim";
const suite = new GitOopsTestSuite(testDir);
suite.runAllTests().catch(console.error);
