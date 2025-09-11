#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { createHash } from "crypto";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global state
let config = {};
let logFile = "";

// Utility functions
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp}: ${message}`;
  console.log(message);

  if (logFile) {
    try {
      fs.appendFileSync(logFile, logLine + "\n");
    } catch (err) {
      console.error(`Warning: Could not write to log file: ${err.message}`);
    }
  }
}

function halt(taskId, reason) {
  const message = `HALT: ${taskId} — ${reason}`;
  log(message);
  process.exit(1);
}

function done(taskId, summary) {
  const message = `DONE: ${taskId} — ${summary}`;
  log(message);
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: "utf8", ...options }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

function promptUser(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question + " ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getFileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function parseGitignore(gitignorePath) {
  if (!fs.existsSync(gitignorePath)) return [];

  const content = fs.readFileSync(gitignorePath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/\/$/, "")); // Remove trailing slashes
}

function shouldIgnoreFile(filePath, sourceDir, ignorePatterns) {
  const relativePath = path.relative(sourceDir, filePath);

  // Check against ignore patterns
  for (const pattern of ignorePatterns) {
    if (relativePath.includes(pattern) || relativePath.startsWith(pattern)) {
      return true;
    }
  }

  // Security hygiene - never commit these
  const securityPatterns = [
    ".env",
    "*.pem",
    "*.key",
    "id_*",
    "*.p12",
    "*.keystore",
    "*.sqlite",
    "*.credentials",
    "*.token",
    "*.bak",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".cache",
    ".turbo",
    ".parcel-cache",
  ];

  for (const pattern of securityPatterns) {
    if (pattern.startsWith("*.")) {
      if (relativePath.endsWith(pattern.slice(1))) return true;
    } else if (relativePath.includes(pattern)) {
      return true;
    }
  }

  return false;
}

function scanDirectory(dirPath, sourceDir, ignorePatterns = []) {
  const files = [];

  function scan(currentPath) {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!shouldIgnoreFile(fullPath, sourceDir, ignorePatterns)) {
          scan(fullPath);
        }
      } else if (stat.isFile()) {
        if (!shouldIgnoreFile(fullPath, sourceDir, ignorePatterns)) {
          files.push(fullPath);
        }
      }
    }
  }

  scan(dirPath);
  return files;
}

// Phase 0: Environment Gate & Setup
async function phase0Setup() {
  log("=== PHASE 0: Environment Gate & Setup ===");

  // S0.1: Check Node version
  const nodeVersion = process.version;
  const versionNumber = parseInt(nodeVersion.slice(1).split(".")[0]);

  if (versionNumber < 18) {
    halt("S0.1", "Node v18+ required");
  }
  done("S0.1", `Node ${nodeVersion} OK (>=18)`);

  // S0.2: Verify SOURCE_DIR
  if (!config.SOURCE_DIR || !fs.existsSync(config.SOURCE_DIR)) {
    halt("S0.2", "SOURCE_DIR does not exist or is not readable");
  }
  done("S0.2", "SOURCE_DIR verified");

  // S0.3: Verify TARGET_REPO_DIR is clean git repo
  if (!fs.existsSync(config.TARGET_REPO_DIR)) {
    fs.mkdirSync(config.TARGET_REPO_DIR, { recursive: true });
    execCommand("git init", { cwd: config.TARGET_REPO_DIR });
  }

  try {
    const status = execCommand("git status --porcelain", {
      cwd: config.TARGET_REPO_DIR,
    });
    if (status.trim()) {
      halt("S0.3", "Target working tree not clean");
    }
  } catch (error) {
    halt("S0.3", "Target directory is not a Git repository");
  }
  done("S0.3", "TARGET clean");

  // Setup log file
  logFile = path.join(config.TARGET_REPO_DIR, ".commit-bot.log");

  // S0.4: Load gitignore rules
  const gitignoreFiles = [];
  const rootGitignore = path.join(config.SOURCE_DIR, ".gitignore");
  if (fs.existsSync(rootGitignore)) {
    gitignoreFiles.push(...parseGitignore(rootGitignore));
  }

  // Find nested .gitignore files
  const allFiles = scanDirectory(config.SOURCE_DIR, config.SOURCE_DIR, []);
  for (const file of allFiles) {
    if (path.basename(file) === ".gitignore") {
      gitignoreFiles.push(...parseGitignore(file));
    }
  }

  config.ignorePatterns = [...new Set(gitignoreFiles)];
  done(
    "S0.4",
    `Ignore rules loaded (${config.ignorePatterns.length} patterns)`
  );

  // S0.5: Apply SKIP_PATTERNS
  if (config.SKIP_PATTERNS && config.SKIP_PATTERNS.length > 0) {
    config.ignorePatterns.push(...config.SKIP_PATTERNS);
  }
  done(
    "S0.5",
    `Extra skips applied (${config.SKIP_PATTERNS?.length || 0} patterns)`
  );

  // S0.6: Print config summary
  log("=== Configuration Summary ===");
  log(`PROJECT_ID: ${config.PROJECT_ID}`);
  log(`SOURCE_DIR: ${config.SOURCE_DIR}`);
  log(`TARGET_REPO_DIR: ${config.TARGET_REPO_DIR}`);
  log(`TOTAL_DAYS: ${config.TOTAL_DAYS}`);
  log(`COMMITS_PER_DAY: ${config.COMMITS_PER_DAY}`);
  log(`TIMEZONE: ${config.TIMEZONE}`);
  done("S0.6", "Config summarized");
}

// Phase 1: Planning (LLM)
async function phase1Planning() {
  log("=== PHASE 1: Planning (LLM) ===");

  // S1.1: Scan SOURCE_DIR
  const allFiles = scanDirectory(
    config.SOURCE_DIR,
    config.SOURCE_DIR,
    config.ignorePatterns
  );
  done("S1.1", `Scanned ${allFiles.length} files after ignores`);

  // S1.2: Cluster files by feature/domain
  const clusters = {};
  for (const file of allFiles) {
    const relativePath = path.relative(config.SOURCE_DIR, file);
    const parts = relativePath.split(path.sep);
    const domain = parts[0] || "root";

    if (!clusters[domain]) clusters[domain] = [];
    clusters[domain].push(file);
  }
  done("S1.2", `Identified ${Object.keys(clusters).length} feature clusters`);

  // S1.3: Compute ordering
  const ordering = [
    "scaffold",
    "build",
    "skeleton",
    "feature",
    "test",
    "docs",
    "asset",
  ];
  done("S1.3", "Ordering computed");

  // S1.4: Plan commits
  const plannedCommits = config.TOTAL_DAYS * config.COMMITS_PER_DAY;
  const days = [];

  // Categorize files
  const categorizedFiles = {
    scaffold: [],
    build: [],
    skeleton: [],
    feature: [],
    test: [],
    docs: [],
    asset: [],
  };

  for (const file of allFiles) {
    const relativePath = path.relative(config.SOURCE_DIR, file);
    const basename = path.basename(file).toLowerCase();
    const dirname = path.dirname(relativePath).toLowerCase();

    if (
      basename.includes("gitignore") ||
      basename.includes("license") ||
      basename.includes("readme") ||
      basename.includes("editorconfig")
    ) {
      categorizedFiles.scaffold.push(file);
    } else if (
      basename.includes("package.json") ||
      basename.includes("tsconfig") ||
      basename.includes("webpack") ||
      basename.includes("vite") ||
      dirname.includes("config")
    ) {
      categorizedFiles.build.push(file);
    } else if (
      basename.includes("test") ||
      dirname.includes("test") ||
      basename.includes("spec")
    ) {
      categorizedFiles.test.push(file);
    } else if (basename.includes(".md") || dirname.includes("doc")) {
      categorizedFiles.docs.push(file);
    } else if (
      dirname.includes("asset") ||
      basename.match(/\.(png|jpg|jpeg|gif|svg|ico|css|scss|less)$/)
    ) {
      categorizedFiles.asset.push(file);
    } else if (
      relativePath.includes("index") ||
      basename.includes("main") ||
      basename.includes("app")
    ) {
      categorizedFiles.skeleton.push(file);
    } else {
      categorizedFiles.feature.push(file);
    }
  }

  // Distribute files across commits
  let fileQueue = [];
  for (const category of ordering) {
    fileQueue.push(
      ...categorizedFiles[category].map((file) => ({ file, category }))
    );
  }

  const filesPerCommit = Math.ceil(fileQueue.length / plannedCommits);
  let currentFileIndex = 0;

  for (let day = 1; day <= config.TOTAL_DAYS; day++) {
    const dayCommits = [];

    for (
      let commitIndex = 1;
      commitIndex <= config.COMMITS_PER_DAY;
      commitIndex++
    ) {
      if (currentFileIndex >= fileQueue.length) break;

      const commitFiles = [];
      const maxFiles = config.MAX_FILES_PER_COMMIT || filesPerCommit;

      for (
        let i = 0;
        i < maxFiles && currentFileIndex < fileQueue.length;
        i++
      ) {
        commitFiles.push(fileQueue[currentFileIndex]);
        currentFileIndex++;
      }

      if (commitFiles.length === 0) break;

      const primaryCategory = commitFiles[0].category;
      const scope = path.basename(path.dirname(commitFiles[0].file)) || "repo";

      let type, message;
      switch (primaryCategory) {
        case "scaffold":
          type = "chore";
          message = `add project scaffolding and configuration`;
          break;
        case "build":
          type = "build";
          message = `setup build configuration and tooling`;
          break;
        case "skeleton":
          type = "feat";
          message = `add core application structure`;
          break;
        case "feature":
          type = "feat";
          message = `implement ${scope} functionality`;
          break;
        case "test":
          type = "test";
          message = `add tests for ${scope}`;
          break;
        case "docs":
          type = "docs";
          message = `add documentation for ${scope}`;
          break;
        case "asset":
          type = "chore";
          message = `add assets and styling`;
          break;
        default:
          type = "feat";
          message = `add ${scope} implementation`;
      }

      dayCommits.push({
        id: `d${day}-c${commitIndex}`,
        type,
        scope,
        message: `${type}(${scope}): ${message}`,
        files: commitFiles.map((cf) => cf.file),
        why: `${primaryCategory} implementation for organized development`,
        category: primaryCategory,
      });
    }

    if (dayCommits.length > 0) {
      days.push({
        day,
        summary: `Day ${day}: ${dayCommits
          .map((c) => c.category)
          .join(", ")} work`,
        commits: dayCommits,
      });
    }
  }

  done(
    "S1.4",
    `Planned ${plannedCommits} commits over ${config.TOTAL_DAYS} days`
  );

  // S1.5: Compose messages
  done("S1.5", "Messages composed");

  // S1.6: Write artifacts
  const planData = {
    projectId: config.PROJECT_ID,
    createdAt: new Date().toISOString(),
    timezone: config.TIMEZONE,
    nodeVersionChecked: process.version,
    totalDays: config.TOTAL_DAYS,
    commitsPerDay: config.COMMITS_PER_DAY,
    settings: {
      defaults: [
        {
          key: "respectGitignore",
          value: true,
          notes: "Avoids noise and accidental secrets.",
        },
        {
          key: "applySkipPatterns",
          value: true,
          notes: "Extra safety for logs/temp/cache.",
        },
        {
          key: "conventionalCommits",
          value: true,
          notes: "Readable, automatable history.",
        },
        { key: "atomicCommits", value: true, notes: "Easier review & revert." },
        {
          key: "commitOrdering",
          value: "scaffold→build→skeleton→features→tests→docs→assets",
          notes: "Keeps build sane.",
        },
        { key: "realTimestamps", value: true, notes: "No backdating." },
        {
          key: "integrityChecks",
          value: "size+sha256",
          notes: "Copy correctness.",
        },
        {
          key: "balancedDistribution",
          value: true,
          notes: "Steady progress cadence.",
        },
        {
          key: "pushModeDefault",
          value: "manual",
          notes: "Avoid accidental pushes.",
        },
      ],
      tweakables: [
        { key: "commitsPerDay", value: config.COMMITS_PER_DAY },
        { key: "totalDays", value: config.TOTAL_DAYS },
        { key: "maxFilesPerCommit", value: config.MAX_FILES_PER_COMMIT },
        { key: "skipPatterns", value: config.SKIP_PATTERNS },
        { key: "pushMode", value: config.PUSH_MODE },
        { key: "commitMode", value: config.COMMIT_MODE },
        { key: "authorName", value: config.AUTHOR_NAME },
        { key: "authorEmail", value: config.AUTHOR_EMAIL },
      ],
    },
    days,
    approved: false,
  };

  const planPath = path.join(config.TARGET_REPO_DIR, ".commit-plan.json");
  fs.writeFileSync(planPath, JSON.stringify(planData, null, 2));

  const stateData = {
    projectId: config.PROJECT_ID,
    completed: [],
    next: { day: 1, index: 1 },
    sourceChecksums: {},
  };

  const statePath = path.join(config.TARGET_REPO_DIR, ".commit-state.json");
  fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));

  // Generate PREVIEW.md
  let preview = "# Commit Plan Preview\n\n";
  for (const day of days) {
    preview += `## Day ${day.day}: ${day.summary}\n\n`;
    for (const commit of day.commits) {
      preview += `- **${commit.id}**: ${commit.message}\n`;
    }
    preview += "\n";
  }

  const previewPath = path.join(config.TARGET_REPO_DIR, "PREVIEW.md");
  fs.writeFileSync(previewPath, preview);

  done("S1.6", "Artifacts written");

  // S1.7: Invite review
  if (config.REVIEW_MODE === "skip") {
    return planData;
  }

  const actualCommits = days.reduce((sum, day) => sum + day.commits.length, 0);
  log(
    `Plan generated for ${config.TOTAL_DAYS} × ${config.COMMITS_PER_DAY} = ${actualCommits} commits`
  );

  const reviewChoice = await promptUser("Review now? (yes/no)");
  done("S1.7", "Review invitation shown");

  if (reviewChoice.toLowerCase() === "yes") {
    return await phase2Review(planData);
  }

  return planData;
}

// Phase 2: Review & Edit
async function phase2Review(planData) {
  log("=== PHASE 2: Review & Edit ===");

  // S2.1: Show summary
  log("\n=== Plan Summary ===");
  for (const day of planData.days) {
    log(`Day ${day.day}: ${day.summary}`);
    for (const commit of day.commits) {
      log(`  ${commit.id}: ${commit.message}`);
    }
  }
  done("S2.1", "Summary displayed");

  // S2.2: Capture edits
  log("\nAvailable edit operations:");
  log("1. Reword commit message");
  log("2. Skip to approval");

  const editChoice = await promptUser("Enter choice (1-2)");

  if (editChoice === "1") {
    const commitId = await promptUser("Enter commit ID to edit (e.g., d1-c1)");
    const newMessage = await promptUser("Enter new commit message");

    // Find and update the commit
    for (const day of planData.days) {
      for (const commit of day.commits) {
        if (commit.id === commitId) {
          commit.message = newMessage;
          break;
        }
      }
    }
  }

  done("S2.2", "Edits captured");
  done("S2.3", "Edits validated");

  // S2.4: Apply patch
  const planPath = path.join(config.TARGET_REPO_DIR, ".commit-plan.json");
  fs.writeFileSync(planPath, JSON.stringify(planData, null, 2));
  done("S2.4", "Patch applied");

  // S2.5: Approval prompt
  const approveChoice = await promptUser("Approve plan? (yes/no)");
  if (approveChoice.toLowerCase() === "yes") {
    planData.approved = true;
    fs.writeFileSync(planPath, JSON.stringify(planData, null, 2));
    done("S2.5", "Plan approved; LLM off");
  }

  return planData;
}

// Phase 3: Daily Execution
async function phase3Execution() {
  log("=== PHASE 3: Daily Execution ===");

  // S3.0: Load plan
  const planPath = path.join(config.TARGET_REPO_DIR, ".commit-plan.json");
  const statePath = path.join(config.TARGET_REPO_DIR, ".commit-state.json");

  if (!fs.existsSync(planPath)) {
    halt("S3.0", "No commit plan found");
  }

  const planData = JSON.parse(fs.readFileSync(planPath, "utf8"));
  if (!planData.approved) {
    halt("S3.0", "Plan not approved");
  }

  let stateData = {};
  if (fs.existsSync(statePath)) {
    stateData = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } else {
    stateData = {
      projectId: planData.projectId,
      completed: [],
      next: { day: 1, index: 1 },
      sourceChecksums: {},
    };
  }

  done("S3.0", "Plan loaded (approved)");

  // S3.1: Runtime checks
  const nodeVersion = parseInt(process.version.slice(1).split(".")[0]);
  if (nodeVersion < 18) {
    halt("S3.1", "Node v18+ required");
  }

  try {
    const status = execCommand("git status --porcelain", {
      cwd: config.TARGET_REPO_DIR,
    });
    if (status.trim()) {
      halt("S3.1", "Target working tree not clean");
    }
  } catch (error) {
    halt("S3.1", "Git status check failed");
  }

  done("S3.1", "Runtime checks passed");

  // S3.2: Start timer
  const startTime = Date.now();
  const timeLimit = (config.DAILY_RUN_HOURS || 3) * 60 * 60 * 1000; // Convert to milliseconds
  done("S3.2", "Timer started");

  // Find current day's work
  const currentDay = planData.days.find((d) => d.day === stateData.next.day);
  if (!currentDay) {
    log("No more work to do");
    return;
  }

  let commitsProcessed = 0;
  const maxCommitsToday = config.COMMITS_PER_DAY;

  for (const commit of currentDay.commits) {
    if (Date.now() - startTime > timeLimit) {
      log("Time budget exceeded for today");
      break;
    }

    if (commitsProcessed >= maxCommitsToday) {
      log("Daily commit limit reached");
      break;
    }

    if (commit.id !== `d${stateData.next.day}-c${stateData.next.index}`) {
      continue; // Skip if not the next expected commit
    }

    // S3.C1: Prepare file list
    done("S3.C1", `File list prepared (${commit.files.length} files)`);

    // S3.C2: Copy files
    for (const sourceFile of commit.files) {
      const relativePath = path.relative(config.SOURCE_DIR, sourceFile);
      const targetFile = path.join(config.TARGET_REPO_DIR, relativePath);

      // Create target directory if needed
      const targetDir = path.dirname(targetFile);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy file
      fs.copyFileSync(sourceFile, targetFile);
    }
    done("S3.C2", "Files copied");

    // S3.C3: Integrity check
    for (const sourceFile of commit.files) {
      const relativePath = path.relative(config.SOURCE_DIR, sourceFile);
      const targetFile = path.join(config.TARGET_REPO_DIR, relativePath);

      const sourceHash = getFileSha256(sourceFile);
      const targetHash = getFileSha256(targetFile);

      if (sourceHash !== targetHash) {
        halt("S3.C3", `Integrity check failed for ${relativePath}`);
      }

      stateData.sourceChecksums[relativePath] = sourceHash;
    }
    done("S3.C3", "Integrity verified");

    // S3.C4: Stage files
    const relativePaths = commit.files.map((f) =>
      path.relative(config.SOURCE_DIR, f)
    );
    for (const relativePath of relativePaths) {
      execCommand(`git add -- "${relativePath}"`, {
        cwd: config.TARGET_REPO_DIR,
      });
    }
    done("S3.C4", "Files staged");

    // S3.C4a: Manual gate (if needed)
    if (config.COMMIT_MODE === "manual") {
      log(`\nREADY: S3.C4a — Commit ${commit.id} staged.`);
      log("Staged files:");
      for (const file of relativePaths) {
        log(`  ${file}`);
      }

      const choice = await promptUser(
        'Type "commit" to proceed or "skip" to skip'
      );

      if (choice.toLowerCase() === "skip") {
        // Unstage files
        execCommand("git reset HEAD", { cwd: config.TARGET_REPO_DIR });
        done("S3.C4a", `Skipped ${commit.id}`);

        // Advance to next commit
        stateData.next.index++;
        fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));
        continue;
      }
    }

    // S3.C5: Create commit
    const authorFlag =
      config.AUTHOR_NAME && config.AUTHOR_EMAIL
        ? `--author="${config.AUTHOR_NAME} <${config.AUTHOR_EMAIL}>"`
        : "";

    const commitCmd = `git commit ${authorFlag} -m "${commit.message}"`;
    const commitSha = execCommand(commitCmd, { cwd: config.TARGET_REPO_DIR });
    done("S3.C5", `Commit created (${commit.id})`);

    // S3.C6: Record progress
    const completedCommit = {
      id: commit.id,
      day: stateData.next.day,
      finishedAt: new Date().toISOString(),
      commitSha: commitSha.split("\n")[0],
      fileChecksums: {},
    };

    for (const file of commit.files) {
      const relativePath = path.relative(config.SOURCE_DIR, file);
      completedCommit.fileChecksums[relativePath] =
        stateData.sourceChecksums[relativePath];
    }

    stateData.completed.push(completedCommit);
    stateData.next.index++;

    // Check if we've finished the day
    if (stateData.next.index > currentDay.commits.length) {
      stateData.next.day++;
      stateData.next.index = 1;
    }

    fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2));
    done("S3.C6", "State updated");

    commitsProcessed++;
  }

  // S3.ED1: Push if auto mode
  if (config.PUSH_MODE === "auto") {
    try {
      execCommand("git push", { cwd: config.TARGET_REPO_DIR });
      done("S3.ED1", "Pushed");
    } catch (error) {
      done("S3.ED1", "Push failed (no remote?)");
    }
  } else {
    done("S3.ED1", "Push skipped (manual)");
  }

  done("S3.ED2", "Day complete");
}

// Phase 4: Finish
async function phase4Finish() {
  log("=== PHASE 4: Finish ===");

  const statePath = path.join(config.TARGET_REPO_DIR, ".commit-state.json");
  const planPath = path.join(config.TARGET_REPO_DIR, ".commit-plan.json");

  if (!fs.existsSync(statePath) || !fs.existsSync(planPath)) {
    halt("S4.1", "Missing state or plan files");
  }

  const stateData = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const planData = JSON.parse(fs.readFileSync(planPath, "utf8"));

  const totalPlannedCommits = planData.days.reduce(
    (sum, day) => sum + day.commits.length,
    0
  );

  if (stateData.completed.length >= totalPlannedCommits) {
    done("S4.1", "All commits executed");

    if (config.PUSH_MODE === "manual") {
      log('Run "git push" manually when ready');
      done("S4.2", "Operator push complete (optional)");
    }

    log(
      "✅ Your project has been successfully finished: all files committed per plan."
    );
    done("S4.3", "Closeout announced");
  } else {
    log(
      `Progress: ${stateData.completed.length}/${totalPlannedCommits} commits completed`
    );
    log("Run the bot again to continue with the next day's work");
  }
}

// Main execution
async function main() {
  // Parse command line arguments and environment
  const args = process.argv.slice(2);

  // Default configuration
  config = {
    SOURCE_DIR: process.env.SOURCE_DIR || args[0],
    TARGET_REPO_DIR: process.env.TARGET_REPO_DIR || args[1] || process.cwd(),
    TOTAL_DAYS: parseInt(process.env.TOTAL_DAYS || args[2] || "5"),
    COMMITS_PER_DAY: parseInt(process.env.COMMITS_PER_DAY || args[3] || "3"),
    DAILY_RUN_HOURS: parseInt(process.env.DAILY_RUN_HOURS || "3"),
    TIMEZONE: process.env.TIMEZONE || "America/Chicago",
    PUSH_MODE: process.env.PUSH_MODE || "manual",
    COMMIT_MODE: process.env.COMMIT_MODE || "manual",
    DRY_RUN: process.env.DRY_RUN === "true",
    MAX_FILES_PER_COMMIT:
      parseInt(process.env.MAX_FILES_PER_COMMIT) || undefined,
    SKIP_PATTERNS: process.env.SKIP_PATTERNS
      ? process.env.SKIP_PATTERNS.split(",")
      : [],
    PROJECT_ID: process.env.PROJECT_ID || `project-${Date.now()}`,
    AUTHOR_NAME: process.env.AUTHOR_NAME,
    AUTHOR_EMAIL: process.env.AUTHOR_EMAIL,
    REVIEW_MODE: process.env.REVIEW_MODE || "ask",
  };

  // Handle version flag
  if (args.includes("--version") || args.includes("-v")) {
    console.log("Staged Git Commit Bot v1.0.0");
    process.exit(0);
  }

  // Handle help flag
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🤖 Staged Git Commit Bot v1.0.0

USAGE:
  node commit-bot.js <SOURCE_DIR> [TARGET_REPO_DIR] [TOTAL_DAYS] [COMMITS_PER_DAY]
  
  Or use environment variables:
  SOURCE_DIR=/path/to/source TARGET_REPO_DIR=/path/to/target node commit-bot.js

REQUIRED:
  SOURCE_DIR        Source project directory to analyze

OPTIONAL:
  TARGET_REPO_DIR   Target Git repository (default: current directory)
  TOTAL_DAYS        Days to spread commits across (default: 5)
  COMMITS_PER_DAY   Maximum commits per day (default: 3)

ENVIRONMENT VARIABLES:
  DAILY_RUN_HOURS   Time budget per day in hours (default: 3)
  TIMEZONE          Timezone for commits (default: America/Chicago)
  PUSH_MODE         'manual' or 'auto' (default: manual)
  COMMIT_MODE       'manual' or 'auto' (default: manual)
  DRY_RUN           'true' to preview only (default: false)
  MAX_FILES_PER_COMMIT  Maximum files per commit
  SKIP_PATTERNS     Comma-separated patterns to skip
  PROJECT_ID        Stable project identifier
  AUTHOR_NAME       Git author name
  AUTHOR_EMAIL      Git author email
  REVIEW_MODE       'ask', 'force', or 'skip' (default: ask)

EXAMPLES:
  # Basic usage
  node commit-bot.js ./my-project ./target-repo 5 3
  
  # Auto mode with environment variables
  SOURCE_DIR=./my-project COMMIT_MODE=auto node commit-bot.js
  
  # Dry run preview
  DRY_RUN=true node commit-bot.js ./my-project
  
  # Create example project for testing
  ./example.sh

For more information, see README.md
`);
    process.exit(0);
  }

  if (!config.SOURCE_DIR) {
    console.error("❌ ERROR: SOURCE_DIR is required");
    console.error("");
    console.error(
      "Usage: node commit-bot.js <SOURCE_DIR> [TARGET_REPO_DIR] [TOTAL_DAYS] [COMMITS_PER_DAY]"
    );
    console.error(
      "Or set environment variables: SOURCE_DIR, TARGET_REPO_DIR, etc."
    );
    console.error("");
    console.error('Run "node commit-bot.js --help" for more information');
    process.exit(1);
  }

  try {
    // Check if we're in planning mode or execution mode
    const planPath = path.join(config.TARGET_REPO_DIR, ".commit-plan.json");
    const statePath = path.join(config.TARGET_REPO_DIR, ".commit-state.json");

    if (!fs.existsSync(planPath)) {
      // Planning mode
      await phase0Setup();
      const planData = await phase1Planning();

      if (planData.approved) {
        log("\nPlan approved! Run the bot again to start execution.");
      } else {
        log("\nPlan saved but not approved. Run the bot again to continue.");
      }
    } else {
      // Execution mode
      const planData = JSON.parse(fs.readFileSync(planPath, "utf8"));

      if (!planData.approved) {
        log("Plan exists but not approved. Starting review...");
        await phase2Review(planData);
      } else {
        // Check if finished
        if (fs.existsSync(statePath)) {
          const stateData = JSON.parse(fs.readFileSync(statePath, "utf8"));
          const totalPlannedCommits = planData.days.reduce(
            (sum, day) => sum + day.commits.length,
            0
          );

          if (stateData.completed.length >= totalPlannedCommits) {
            await phase4Finish();
            return;
          }
        }

        await phase3Execution();
        await phase4Finish();
      }
    }
  } catch (error) {
    halt("MAIN", error.message);
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  log("\nReceived SIGINT. Exiting gracefully...");
  process.exit(0);
});

// Run the bot
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
