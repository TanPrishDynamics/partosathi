# 🤖 Agent Startup Protocol — e-Partogram

**You are an AI agent (Claude / GPT / Gemini / Human) about to work on e-Partogram.**
**You MUST complete this startup sequence before performing any task.**

---

## ⚡ Quick Start (30 seconds)

```bash
# Step 1 — Print project context
python scripts/update_master_log.py --read

# Step 2 — Read the full master log (do this before touching any file)
cat project_reports/MASTER_PROJECT_LOG.md

# Step 3 — After your task, append your entry
python scripts/update_master_log.py
```

---

## 📋 Mandatory Pre-Task Checklist

Before writing a single line of code, answer these questions by reading the master log:

- [ ] What is the current project status?
- [ ] What was the last thing done (last Entry ID)?
- [ ] Are there open technical debt items (T-XX) relevant to my task?
- [ ] Has a similar task already been done? (Check all past entries)
- [ ] What is the next sequential Entry ID I must use?
- [ ] Are there any known bugs or issues I might affect?

---

## 🔁 Mandatory Post-Task Protocol

After completing your work:

1. **Append your entry** to `MASTER_PROJECT_LOG.md` using the automation script
2. **Never overwrite** any existing content
3. **Use the next sequential Entry ID** (script calculates this automatically)
4. **Save your raw prompt** (script does this automatically)
5. **Validate the log** after appending:
   ```bash
   python scripts/update_master_log.py --validate
   ```

---

## 🏥 Why This Matters for e-Partogram

e-Partogram is a **Software as a Medical Device (SaMD)**. Every change must be:
- Traceable (ISO 14155, IEC 62304)
- Auditable (HIPAA §164.312)
- Attributable (who changed what, when, and why)

The master log IS the audit trail. Incomplete entries create compliance gaps.

---

## 🔌 Integration per Agent Type

### Claude Code (CLI)
The `CLAUDE.md` file in the project root should include this instruction:
```
Before any task: read project_reports/MASTER_PROJECT_LOG.md
After any task: run python scripts/update_master_log.py
```

### GPT / ChatGPT
Paste the full `MASTER_PROJECT_LOG.md` content at the start of your conversation.
After your session, export the chat and run the script to append the entry.

### Gemini
Use the file upload feature to attach `MASTER_PROJECT_LOG.md` to your conversation.
After the session, append the entry via the script.

### GitHub Actions (CI/CD)
```yaml
- name: Log agent activity
  run: |
    python scripts/update_master_log.py \
      --agent "GitHub Actions" \
      --prompt "Automated CI run" \
      --understanding "CI pipeline execution" \
      --actions "Tests run: ${{ steps.test.outputs.result }}" \
      --output "Pipeline completed" \
      --impact "Low" \
      --next-steps "Review any failures" \
      --git-commit "${{ github.sha }}" \
      --type "CI"
```

---

## 📁 File Reference

| File | Purpose |
|------|---------|
| `project_reports/MASTER_PROJECT_LOG.md` | **Single source of truth — read first** |
| `project_reports/raw_prompts/entry_NNN.md` | Full user prompt for each entry |
| `project_reports/change_logs/entry_NNN_changes.md` | Structured change record per entry |
| `project_reports/agent_activity/entry_NNN_activity.json` | Machine-readable activity snapshot |
| `scripts/update_master_log.py` | Automation script — append, read, validate |

---

## ⚠️ Rules (Non-Negotiable)

1. **Never delete** any entry from the master log
2. **Never summarize away** a prompt — store the full text
3. **Never skip** an entry ID — sequential order is mandatory
4. **Never overwrite** — only append
5. **Always validate** after appending (`--validate` flag)

---

*This file is maintained by the Persistent Agent Memory & Execution Ledger System.*
*Entry 008 — 2026-04-25*
