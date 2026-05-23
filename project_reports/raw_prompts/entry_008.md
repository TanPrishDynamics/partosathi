# Raw Prompt — Entry 008

**Agent:** Claude (claude-sonnet-4-6)
**Timestamp:** 2026-04-25 12:04:00 +0530

---

You are a senior AI systems architect.

Upgrade my project by implementing a "Persistent Agent Memory & Execution Ledger System".

CORE GOAL:
Ensure that ANY AI agent (Claude, GPT, Gemini, Human) can:
1. Read past project context before starting work
2. Understand what has already been done
3. Continue work without duplication or conflict
4. Log every prompt + action in a structured, sequential format
5. Maintain full traceability (critical for SaMD / healthcare compliance)

---

## 🧠 1. CREATE CENTRAL MEMORY FILE (MANDATORY)

Create a single source of truth:

/project_reports/MASTER_PROJECT_LOG.md

This file MUST:
- Be read FIRST by any agent before doing any task
- Act as the "brain" of the project
- Be continuously appended (never overwritten)

---

## 🧾 2. STRUCTURE OF MASTER LOG

Follow STRICT format:

# 🧠 PROJECT MASTER LOG

## 📌 Project Overview
- Project Name:
- Description:
- Tech Stack:
- Current Status:

---

## 🔁 AGENT EXECUTION HISTORY (SEQUENTIAL)

### Entry ID: 001
Timestamp: YYYY-MM-DD HH:MM
Agent: GPT / Claude / Gemini / Human

#### 🔹 Prompt Given:
<full prompt written EXACTLY as provided by user>

#### 🔹 Understanding:
<agent interprets the task before acting>

#### 🔹 Actions Taken:
- File created:
- File modified:
- Code added:
- Bugs fixed:

#### 🔹 Output Summary:
<what was achieved>

#### 🔹 Impact Level:
Low / Medium / High

#### 🔹 Next Suggested Steps:
<what future agent should do>

---

(Repeat entries in strict chronological order)

---

## 📂 3. AUTO-APPEND RULE (CRITICAL)

- NEVER overwrite this file
- ALWAYS append new entries at the bottom
- Maintain sequential Entry IDs (001, 002, 003...)

---

## 🤖 4. AGENT STARTUP PROTOCOL (VERY IMPORTANT)

Before performing ANY task, agent MUST:

1. Read MASTER_PROJECT_LOG.md
2. Understand:
   - What is already done
   - Pending work
   - Past prompts
3. Then proceed with execution

---

## 🧩 5. PROMPT + ACTION TRACEABILITY

For EVERY task:
- Store FULL user prompt
- Store FULL agent reasoning summary
- Store EXACT actions taken

This is mandatory for:
- Debugging
- Compliance (ISO 14155 / SaMD traceability)
- Multi-agent collaboration

---

## 🔄 6. MULTI-AGENT COMPATIBILITY

Ensure system works if:
- I switch between GPT, Claude, Gemini anytime
- Each agent can continue seamlessly

---

## 📁 7. SUPPORTING FILES

Maintain:

/project_reports/
    MASTER_PROJECT_LOG.md   ← main brain
    /raw_prompts/
    /agent_activity/
    /change_logs/

Also:
- Save each raw prompt as separate file (optional redundancy)

---

## ⚙️ 8. AUTOMATION (IMPORTANT)

Build a script:

scripts/update_master_log.py

Functionality:
- Append new entry automatically
- Format entries correctly
- Prevent duplication
- Validate structure

---

## 🛑 9. SAFETY RULES

- Do NOT delete old logs
- Do NOT summarize away important prompts
- Maintain full history (audit-grade)

---

## 🎯 OUTPUT REQUIRED

1. Folder structure
2. MASTER_PROJECT_LOG.md template
3. Python automation script
4. Example entries (3 entries minimum)
5. Instructions for integrating with dev workflow

---

IMPORTANT:
This system must behave like:
- A persistent memory layer
- A compliance audit trail
- A multi-agent collaboration engine

Design it clean, scalable, and production-ready.
