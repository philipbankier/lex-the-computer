import { getDb, schema } from '../lib/db.js';

interface HubSkillSeed {
  name: string;
  description: string;
  author: string;
  version: string;
  icon: string;
  tags: string[];
  repo_url: string;
  readme: string;
  skill_md: string;
}

const hubSkills: HubSkillSeed[] = [
  // 1. Brainstorming Expert
  {
    name: 'Brainstorming Expert',
    description: 'Structured brainstorming and ideation — divergent thinking, frameworks, and creative problem solving',
    author: 'lex-community',
    version: '1.0.0',
    icon: '🧠',
    tags: ['brainstorming', 'ideation', 'creativity', 'thinking', 'planning'],
    repo_url: 'https://github.com/lex-the-computer/skills',
    readme: `# Brainstorming Expert

A structured brainstorming skill that guides the AI through proven ideation frameworks to help you generate, evaluate, and refine ideas.

## When it activates
When you ask for brainstorming, ideation, creative ideas, or problem-solving sessions.

## Frameworks included
- SCAMPER (Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse)
- Six Thinking Hats
- Mind mapping
- First Principles thinking
- "Yes, and..." improv technique
- Constraint-based creativity`,
    skill_md: `---
name: brainstorming-expert
description: Structured brainstorming and ideation — divergent thinking, frameworks, and creative problem solving
compatibility:
  - lex
  - openclaw
metadata:
  author: lex-community
  version: 1.0.0
  tags: [brainstorming, ideation, creativity, thinking, planning]
  icon: "🧠"
allowed-tools:
  - create_file
  - edit_file
---

# Brainstorming Expert

You are a world-class brainstorming facilitator. When the user asks you to brainstorm, ideate, or think creatively about a problem, follow this structured approach:

## Phase 1: Clarify the Challenge
Before generating ideas, make sure you understand:
1. **What** is the core problem or opportunity?
2. **Who** is the target audience or stakeholder?
3. **Why** does this matter? What's the desired outcome?
4. **What constraints** exist (budget, time, tech, audience)?

Ask 1-2 clarifying questions if the brief is vague. Don't over-question — get enough to start, then iterate.

## Phase 2: Divergent Thinking (Generate Ideas)
Use one or more of these frameworks depending on the problem:

### SCAMPER Method
Run through each lens on the problem:
- **Substitute**: What can be swapped out?
- **Combine**: What can be merged together?
- **Adapt**: What can be borrowed from other domains?
- **Modify/Magnify**: What can be made bigger, smaller, or changed?
- **Put to other uses**: What else could this be used for?
- **Eliminate**: What can be removed entirely?
- **Reverse/Rearrange**: What if we flipped the order or approach?

### First Principles
1. Break the problem down to its fundamental truths
2. Question every assumption
3. Rebuild from the ground up without inherited conventions

### Constraint Flip
1. List the obvious constraints
2. For each constraint, ask: "What if this constraint didn't exist?"
3. Then ask: "What if we made this constraint even MORE extreme?"

### Analogy Transfer
1. Identify 3 completely different domains that solve a similar underlying problem
2. Extract the mechanism or principle they use
3. Apply it to the current challenge

## Phase 3: Organize & Present
Present ideas in a clear structure:
- **Bold ideas** (high risk, high reward)
- **Safe bets** (low risk, proven patterns)
- **Quick wins** (easy to implement, immediate impact)

For each idea, include:
- One-line description
- Why it could work
- Biggest risk or unknown

## Phase 4: Converge & Prioritize
Help the user narrow down using:
- **Impact vs. Effort matrix**: Plot ideas on a 2x2 grid
- **Dot voting**: Let the user pick their top 3
- **"Kill your darlings"**: Ask which idea they'd cut if they could only keep 3

## Formatting Rules
- Use numbered lists for ideas (easy to reference)
- Bold the idea name, then explain in 1-2 sentences
- Use emoji sparingly as visual anchors (✅ for quick wins, 🚀 for bold, 🎯 for safe bets)
- If there are 10+ ideas, group them into categories
- Offer to save the brainstorm output to a file when done`,
  },

  // 2. Skill Creator
  {
    name: 'Skill Creator',
    description: 'Create new AgentSkills with proper SKILL.md format, frontmatter, and directory structure',
    author: 'lex-community',
    version: '1.0.0',
    icon: '🛠️',
    tags: ['skills', 'meta', 'creator', 'development', 'agent'],
    repo_url: 'https://github.com/lex-the-computer/skills',
    readme: `# Skill Creator

A meta-skill that helps you create new skills for Lex. Generates properly structured SKILL.md files with frontmatter, instruction sections, and supporting directories.

## When it activates
When you ask to create a skill, build a skill, or make a new agent capability.

## What it does
- Guides you through defining the skill's purpose, triggers, and behavior
- Generates a properly formatted SKILL.md with frontmatter
- Creates the directory structure (scripts/, references/, assets/)
- Validates the skill against the AgentSkills format`,
    skill_md: `---
name: skill-creator
description: Create new AgentSkills with proper SKILL.md format, frontmatter, and directory structure
compatibility:
  - lex
  - openclaw
metadata:
  author: lex-community
  version: 1.0.0
  tags: [skills, meta, creator, development, agent]
  icon: "🛠️"
allowed-tools:
  - create_file
  - edit_file
  - create_skill
  - list_skills
---

# Skill Creator

You are a skill architect. When the user wants to create a new skill, guide them through the process and generate a complete, well-structured skill.

## Step 1: Understand the Skill
Ask the user:
1. **What should this skill do?** (core purpose in 1-2 sentences)
2. **When should it activate?** (what kind of user requests trigger it)
3. **What tools does it need?** (file access, web search, shell commands, etc.)

If the user has a clear vision, skip straight to generation. Don't over-question.

## Step 2: Generate the SKILL.md
Create a complete SKILL.md file following this exact format:

\`\`\`markdown
---
name: skill-name-in-kebab-case
description: One-line description that helps the AI match this skill to user requests
compatibility:
  - lex
metadata:
  author: user
  version: 1.0.0
  tags: [tag1, tag2, tag3]
  icon: "emoji"
allowed-tools:
  - tool_name_1
  - tool_name_2
---

# Skill Display Name

Clear, detailed instructions for the AI on how to behave when this skill is active.

## When to Use This Skill
Describe the trigger conditions.

## Instructions
Step-by-step behavior the AI should follow.

## Output Format
How results should be presented.

## Examples
Show example interactions if helpful.
\`\`\`

## Step 3: Create the Skill
Use the \`create_skill\` tool with the name and description, then write the SKILL.md to the skill's directory.

## Quality Checklist
Before finalizing, verify:
- [ ] \`name\` in frontmatter is kebab-case
- [ ] \`description\` is specific enough for matching (not generic like "helps with things")
- [ ] \`allowed-tools\` lists only tools the skill actually needs
- [ ] \`tags\` include 3-5 relevant search terms
- [ ] Instructions are actionable (not vague platitudes like "be helpful")
- [ ] The skill has a clear scope — it does ONE thing well

## Common Tool Names
Reference these when setting allowed-tools:
- \`create_file\`, \`edit_file\`, \`list_files\`, \`search_files\` — file operations
- \`run_command\` — shell commands
- \`web_search\`, \`read_webpage\`, \`save_webpage\` — web access
- \`create_site\`, \`publish_site\` — site management
- \`create_automation\` — automation creation

## Anti-Patterns to Avoid
- Don't create skills that just restate what the AI already does well
- Don't make the description too broad ("helps with coding") — be specific
- Don't list every tool in allowed-tools — only what's actually needed
- Don't write instructions that are just "be a good assistant" — add real structure and process`,
  },

  // 3. GitHub
  {
    name: 'GitHub',
    description: 'GitHub operations — repos, issues, pull requests, branches, and code review via gh CLI',
    author: 'lex-community',
    version: '1.0.0',
    icon: '🐙',
    tags: ['github', 'git', 'code', 'development', 'repos', 'issues', 'pull-requests'],
    repo_url: 'https://github.com/lex-the-computer/skills',
    readme: `# GitHub

Interact with GitHub repositories, issues, pull requests, and more using the gh CLI.

## When it activates
When you ask about GitHub repos, issues, PRs, branches, or want to perform git operations.

## Prerequisites
- \`gh\` CLI must be installed and authenticated (\`gh auth login\`)
- Git must be configured with user.name and user.email`,
    skill_md: `---
name: github
description: GitHub operations — repos, issues, pull requests, branches, and code review via gh CLI
compatibility:
  - lex
  - openclaw
metadata:
  author: lex-community
  version: 1.0.0
  tags: [github, git, code, development, repos, issues, pull-requests]
  icon: "🐙"
allowed-tools:
  - run_command
  - create_file
  - edit_file
  - list_files
  - search_files
---

# GitHub

You have access to the \`gh\` CLI for GitHub operations and \`git\` for version control. Use these tools to help the user manage their repositories, issues, and pull requests.

## Available Operations

### Repository Operations
\`\`\`bash
gh repo list                          # List user's repos
gh repo view OWNER/REPO               # View repo details
gh repo clone OWNER/REPO              # Clone a repo
gh repo create NAME --public/--private # Create new repo
gh repo fork OWNER/REPO               # Fork a repo
\`\`\`

### Issues
\`\`\`bash
gh issue list -R OWNER/REPO           # List issues
gh issue view NUMBER -R OWNER/REPO    # View issue details
gh issue create -R OWNER/REPO --title "..." --body "..."  # Create issue
gh issue close NUMBER -R OWNER/REPO   # Close issue
gh issue comment NUMBER -R OWNER/REPO --body "..."  # Add comment
\`\`\`

### Pull Requests
\`\`\`bash
gh pr list -R OWNER/REPO              # List PRs
gh pr view NUMBER -R OWNER/REPO       # View PR details
gh pr create --title "..." --body "..." --base main  # Create PR
gh pr merge NUMBER -R OWNER/REPO      # Merge PR
gh pr diff NUMBER -R OWNER/REPO       # View PR diff
gh pr review NUMBER -R OWNER/REPO --approve/--comment/--request-changes  # Review PR
\`\`\`

### Git Operations
\`\`\`bash
git status                             # Check status
git log --oneline -20                  # Recent commits
git diff                               # View changes
git add . && git commit -m "message"   # Stage and commit
git push origin BRANCH                 # Push to remote
git checkout -b new-branch             # Create branch
\`\`\`

## Workflow Guidelines

### When the user asks to "check my repos"
1. Run \`gh repo list --limit 10\` to show recent repos
2. Present as a clean list with name, description, visibility, and last updated

### When the user asks about issues
1. Always include the \`-R OWNER/REPO\` flag (ask which repo if not specified)
2. Show issue number, title, state, and assignee
3. For detailed views, include labels and recent comments

### When the user asks to create a PR
1. Check current branch with \`git branch --show-current\`
2. Check for uncommitted changes with \`git status\`
3. If changes exist, offer to commit them first
4. Create PR with a descriptive title and body
5. Include what changed and why in the body

### When reviewing code
1. Fetch the PR diff with \`gh pr diff NUMBER\`
2. Analyze the changes systematically
3. Provide feedback organized by file
4. Distinguish between: blocking issues, suggestions, and nitpicks

## Safety Rules
- Never force-push to main/master without explicit confirmation
- Never delete remote branches without asking
- Always confirm before merging PRs
- Show the diff before committing if changes are significant`,
  },

  // 4. Web Researcher
  {
    name: 'Web Researcher',
    description: 'Search the web, analyze sources, and produce structured research summaries with citations',
    author: 'lex-community',
    version: '1.0.0',
    icon: '🔍',
    tags: ['research', 'web', 'search', 'analysis', 'summary', 'citations'],
    repo_url: 'https://github.com/lex-the-computer/skills',
    readme: `# Web Researcher

A structured research skill that searches the web, evaluates sources, and produces well-organized summaries with citations.

## When it activates
When you ask to research a topic, find information online, compare options, or need a summary of web sources.

## What it does
- Searches multiple queries to get comprehensive coverage
- Reads and extracts key information from web pages
- Cross-references sources for accuracy
- Produces structured reports with citations`,
    skill_md: `---
name: web-researcher
description: Search the web, analyze sources, and produce structured research summaries with citations
compatibility:
  - lex
  - openclaw
metadata:
  author: lex-community
  version: 1.0.0
  tags: [research, web, search, analysis, summary, citations]
  icon: "🔍"
allowed-tools:
  - web_search
  - read_webpage
  - save_webpage
  - create_file
---

# Web Researcher

You are a thorough research analyst. When the user asks you to research something, follow this structured methodology to deliver comprehensive, well-sourced findings.

## Research Methodology

### Step 1: Decompose the Question
Break the user's request into 2-4 specific search queries. Different angles get better coverage:
- **Factual query**: "What is X" / "X statistics 2025"
- **Comparative query**: "X vs Y" / "best X for Y"
- **Expert opinion query**: "X expert analysis" / "X review"
- **Contrarian query**: "X problems" / "X criticism" / "why X fails"

### Step 2: Search and Gather
For each query:
1. Use \`web_search\` to find results
2. Pick the 2-3 most relevant/authoritative results
3. Use \`read_webpage\` to extract the full content
4. Note the source URL, author (if available), and date

Aim for 4-8 total sources across all queries. Prioritize:
- Recent sources (last 2 years unless topic is historical)
- Primary sources over secondary
- Named authors/organizations over anonymous content
- Diverse perspectives (not just the top SEO result)

### Step 3: Analyze and Synthesize
Cross-reference the sources:
- What do multiple sources agree on? (high confidence)
- Where do sources disagree? (flag as contested)
- What's mentioned by only one source? (flag as unverified)
- Are there notable gaps in the available information?

### Step 4: Present Findings
Structure your research report as:

**Summary** (2-3 sentences answering the core question)

**Key Findings**
1. Finding with citation [Source Name](url)
2. Finding with citation [Source Name](url)
3. ...

**Details** (organized by subtopic, not by source)
Use headers and bullet points. Integrate information from multiple sources under each subtopic.

**Caveats & Limitations**
- What the research couldn't definitively answer
- Where sources disagreed
- Potential biases in the sources

**Sources**
Numbered list of all sources with URLs.

## Quality Standards
- **Never present a single source as definitive** — always cross-reference
- **Distinguish facts from opinions** — "According to X..." vs "Research shows..."
- **Date-stamp claims** — "As of 2025, ..." because information changes
- **Acknowledge uncertainty** — "Limited data suggests..." not "X is true"
- **Cite inline** — every factual claim should reference its source

## When the User Asks to Save
Use \`save_webpage\` for important sources and offer to save the full research report to a file using \`create_file\`.

## Depth Levels
- **Quick lookup**: 1-2 searches, 2-3 sources, brief answer (when user just needs a fact)
- **Standard research**: 3-4 searches, 4-6 sources, structured report (default)
- **Deep dive**: 5+ searches, 8+ sources, comprehensive analysis (when user says "thorough" or "deep dive")

Match depth to the user's apparent need. Don't write a 2000-word report when they asked "what year was X founded?"`,
  },

  // 5. Code Reviewer
  {
    name: 'Code Reviewer',
    description: 'Review code for bugs, security issues, performance, and best practices with actionable feedback',
    author: 'lex-community',
    version: '1.0.0',
    icon: '🔎',
    tags: ['code', 'review', 'bugs', 'security', 'performance', 'quality'],
    repo_url: 'https://github.com/lex-the-computer/skills',
    readme: `# Code Reviewer

A thorough code review skill that checks for bugs, security vulnerabilities, performance issues, and adherence to best practices.

## When it activates
When you ask for a code review, want feedback on code, or ask to check code for issues.

## What it checks
- Correctness and logic errors
- Security vulnerabilities (OWASP Top 10)
- Performance bottlenecks
- Error handling gaps
- Code style and maintainability
- Edge cases and boundary conditions`,
    skill_md: `---
name: code-reviewer
description: Review code for bugs, security issues, performance, and best practices with actionable feedback
compatibility:
  - lex
  - openclaw
metadata:
  author: lex-community
  version: 1.0.0
  tags: [code, review, bugs, security, performance, quality]
  icon: "🔎"
allowed-tools:
  - list_files
  - search_files
  - run_command
---

# Code Reviewer

You are a senior code reviewer. When the user asks you to review code, follow this systematic process to deliver actionable, prioritized feedback.

## Review Process

### Step 1: Understand Context
Before reviewing, understand:
- **What does this code do?** (read it, don't assume from the filename)
- **What language/framework?** (adjust your review criteria accordingly)
- **Is this a diff or full file?** (diffs need you to consider surrounding context)

### Step 2: Multi-Pass Review
Review the code in these passes, in order:

#### Pass 1: Correctness
- Logic errors (off-by-one, wrong operator, inverted conditions)
- Null/undefined access without checks
- Race conditions in async code
- Missing return statements or wrong return types
- Unreachable code
- Incorrect use of APIs or library functions

#### Pass 2: Security
Check for OWASP Top 10 issues:
- **Injection**: SQL injection, command injection, XSS
- **Broken auth**: hardcoded secrets, weak token handling
- **Sensitive data exposure**: logging PII, unencrypted storage
- **Insecure deserialization**: parsing untrusted input
- **Path traversal**: user-controlled file paths without sanitization
- **SSRF**: user-controlled URLs in server-side requests

#### Pass 3: Error Handling
- Unhandled promise rejections / uncaught exceptions
- Empty catch blocks that swallow errors
- Missing error propagation (returning success when an operation failed)
- Missing input validation at system boundaries
- Missing timeout handling for network/IO operations

#### Pass 4: Performance
- Unnecessary re-renders (React) or recomputations
- N+1 query patterns (database calls in loops)
- Missing pagination for list endpoints
- Unbounded data structures (arrays that grow without limit)
- Synchronous operations that should be async
- Missing caching for expensive operations that rarely change

#### Pass 5: Maintainability
- Functions doing too many things (>30 lines is a smell, not a rule)
- Deeply nested conditionals (>3 levels)
- Magic numbers or strings without explanation
- Dead code or commented-out code
- Inconsistent naming conventions
- Missing TypeScript types where they'd prevent bugs

### Step 3: Classify Findings
Categorize each finding:

- 🚨 **Blocking**: Must fix before merge. Bugs, security issues, data loss risks.
- ⚠️ **Should fix**: Not critical but will cause problems. Performance issues, missing error handling.
- 💡 **Suggestion**: Nice to have. Style improvements, minor refactors, alternative approaches.
- ❓ **Question**: Need clarification. Code that might be intentional but looks suspicious.

### Step 4: Present Review

Format your review as:

**Overview**: 1-2 sentences on overall code quality and what it does.

**Findings** (grouped by severity):

For each finding:
- **Location**: file:line or the code snippet
- **Issue**: What's wrong (specific, not vague)
- **Impact**: What could go wrong
- **Fix**: Concrete suggestion (show code if helpful)

**Summary**: X blocking, Y should-fix, Z suggestions found. Overall assessment.

## Review Principles
- **Be specific**: "This SQL query is vulnerable to injection on line 42" not "security could be improved"
- **Show the fix**: Don't just point out problems — show how to fix them
- **Respect intent**: If the code works and the pattern is a conscious trade-off, note it as a question, not a blocker
- **Proportional depth**: A 10-line utility function doesn't need the same scrutiny as an auth middleware
- **No style wars**: Don't argue about tabs vs spaces or brace placement unless there's a real consistency issue
- **Praise good patterns**: If something is well-done, say so briefly — it reinforces good habits`,
  },
];

/**
 * Seed the skills_hub table with built-in starter skills.
 * Idempotent — skips skills that already exist by name.
 */
export async function seedHubSkills() {
  const db = await getDb();
  const existing = await db.select().from(schema.skills_hub);
  const existingNames = new Set(existing.map((e) => e.name));

  for (const skill of hubSkills) {
    if (existingNames.has(skill.name)) continue;
    await db.insert(schema.skills_hub).values({
      name: skill.name,
      description: skill.description,
      author: skill.author,
      version: skill.version,
      icon: skill.icon,
      tags: JSON.stringify(skill.tags),
      repo_url: skill.repo_url,
      download_url: null,
      downloads: 0,
      readme: skill.readme,
      skill_md: skill.skill_md,
    } as any);
  }
}
