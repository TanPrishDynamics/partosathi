#!/usr/bin/env python3
"""
update_master_log.py
────────────────────
Automation script for the e-Partogram Persistent Agent Memory & Execution Ledger.

Usage:
  # Read project context (before starting any task):
  python scripts/update_master_log.py --read

  # Append a new entry interactively:
  python scripts/update_master_log.py

  # Append a new entry programmatically (CI/CD or agent automation):
  python scripts/update_master_log.py \
    --agent "Claude claude-sonnet-4-6" \
    --prompt-file /tmp/prompt.txt \
    --understanding "Brief interpretation of the task" \
    --actions "File created: foo.py\nFile modified: bar.py" \
    --output "What was achieved" \
    --impact "High" \
    --next-steps "What the next agent should do"
"""

import os
import re
import sys
import json
import argparse
import textwrap
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT   = Path(__file__).resolve().parent.parent
REPORTS_DIR    = PROJECT_ROOT / "project_reports"
MASTER_LOG     = REPORTS_DIR / "MASTER_PROJECT_LOG.md"
RAW_PROMPTS    = REPORTS_DIR / "raw_prompts"
AGENT_ACTIVITY = REPORTS_DIR / "agent_activity"
CHANGE_LOGS    = REPORTS_DIR / "change_logs"

IMPACT_LEVELS  = {"low", "medium", "high"}
KNOWN_AGENTS   = ["Claude", "GPT", "Gemini", "Human", "GitHub Actions", "Other"]

# ── ANSI colours (graceful fallback on Windows) ───────────────────────────────
try:
    import shutil
    _W = shutil.get_terminal_size().columns
    BOLD  = "\033[1m"
    BLUE  = "\033[94m"
    GREEN = "\033[92m"
    YELLOW= "\033[93m"
    RED   = "\033[91m"
    RESET = "\033[0m"
except Exception:
    BOLD = BLUE = GREEN = YELLOW = RED = RESET = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _print_header(text: str) -> None:
    print(f"\n{BOLD}{BLUE}{'─' * 60}{RESET}")
    print(f"{BOLD}{BLUE}  {text}{RESET}")
    print(f"{BOLD}{BLUE}{'─' * 60}{RESET}\n")


def _next_entry_id() -> str:
    """Scan MASTER_PROJECT_LOG.md and return the next sequential 3-digit Entry ID."""
    if not MASTER_LOG.exists():
        return "001"
    content = MASTER_LOG.read_text(encoding="utf-8")
    ids = re.findall(r"### Entry ID:\s*(\d{3})", content)
    if not ids:
        return "001"
    last = max(int(x) for x in ids)
    return f"{last + 1:03d}"


def _validate_no_duplicate(entry_id: str) -> None:
    if not MASTER_LOG.exists():
        return
    content = MASTER_LOG.read_text(encoding="utf-8")
    if f"### Entry ID: {entry_id}" in content:
        print(f"{RED}ERROR: Entry ID {entry_id} already exists in {MASTER_LOG.name}.{RESET}")
        print("The log must never be overwritten. Use the next available ID.")
        sys.exit(1)


def _prompt_multiline(label: str, hint: str = "") -> str:
    """Read multiline input from stdin until user types END on its own line."""
    print(f"{BOLD}{label}{RESET}")
    if hint:
        print(f"  {YELLOW}(hint: {hint}){RESET}")
    print(f"  {YELLOW}Type your text. When done, type END on a new line and press Enter.{RESET}")
    lines = []
    while True:
        line = input()
        if line.strip().upper() == "END":
            break
        lines.append(line)
    return "\n".join(lines).strip()


def _prompt_single(label: str, default: str = "", choices: list = None) -> str:
    choice_str = f" [{'/'.join(choices)}]" if choices else ""
    default_str = f" (default: {default})" if default else ""
    value = input(f"{BOLD}{label}{choice_str}{default_str}: {RESET}").strip()
    if not value and default:
        return default
    if choices and value.lower() not in [c.lower() for c in choices]:
        print(f"{RED}Invalid choice. Choose from: {', '.join(choices)}{RESET}")
        return _prompt_single(label, default, choices)
    return value


def _iso_timestamp() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %z")


def _build_entry(
    entry_id: str,
    timestamp: str,
    agent: str,
    prompt_text: str,
    understanding: str,
    actions: str,
    output_summary: str,
    impact: str,
    next_steps: str,
    git_commit: str = "",
) -> str:
    """Render a single Markdown entry block."""
    commit_line = f"\n**Git Commit:** `{git_commit}`" if git_commit else ""
    return f"""
---

### Entry ID: {entry_id}
**Timestamp:** {timestamp}
**Agent:** {agent}{commit_line}

#### 🔹 Prompt Given:
```
{prompt_text}
```

#### 🔹 Understanding:
{understanding}

#### 🔹 Actions Taken:
{actions}

#### 🔹 Output Summary:
{output_summary}

#### 🔹 Impact Level:
**{impact.capitalize()}**

#### 🔹 Next Suggested Steps:
{next_steps}
"""


def _save_raw_prompt(entry_id: str, prompt_text: str, agent: str, timestamp: str) -> Path:
    RAW_PROMPTS.mkdir(parents=True, exist_ok=True)
    filename = RAW_PROMPTS / f"entry_{entry_id}.md"
    content = f"# Raw Prompt — Entry {entry_id}\n\n**Agent:** {agent}\n**Timestamp:** {timestamp}\n\n---\n\n{prompt_text}\n"
    filename.write_text(content, encoding="utf-8")
    return filename


def _save_change_log(entry_id: str, actions: str, impact: str, timestamp: str) -> Path:
    CHANGE_LOGS.mkdir(parents=True, exist_ok=True)
    filename = CHANGE_LOGS / f"entry_{entry_id}_changes.md"
    content = f"# Change Log — Entry {entry_id}\n\n**Timestamp:** {timestamp}\n**Impact:** {impact.capitalize()}\n\n---\n\n## Actions\n\n{actions}\n"
    filename.write_text(content, encoding="utf-8")
    return filename


def _save_agent_activity(
    entry_id: str,
    agent: str,
    timestamp: str,
    output_summary: str,
    next_steps: str,
) -> Path:
    AGENT_ACTIVITY.mkdir(parents=True, exist_ok=True)
    filename = AGENT_ACTIVITY / f"entry_{entry_id}_activity.json"
    data = {
        "entry_id": entry_id,
        "agent": agent,
        "timestamp": timestamp,
        "output_summary": output_summary,
        "next_steps": next_steps,
    }
    filename.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return filename


def _update_summary_table(entry_id: str, timestamp: str, agent: str, entry_type: str, impact: str) -> None:
    """Insert a new row into the Summary Dashboard table inside MASTER_PROJECT_LOG.md."""
    content = MASTER_LOG.read_text(encoding="utf-8")
    date_str = timestamp[:10]
    new_row = f"| {entry_id} | {date_str} | {agent.split()[0]} | {entry_type} | {impact.capitalize()} | ✅ Done |\n"
    # Find the last row in the table (lines containing '| ' after the header)
    table_pattern = r"(\| \d{3} \|[^\n]+\| ✅ Done \|\n)"
    matches = list(re.finditer(table_pattern, content))
    if matches:
        last_match = matches[-1]
        insert_pos = last_match.end()
        content = content[:insert_pos] + new_row + content[insert_pos:]
    # Update "Next entry ID" line
    content = re.sub(
        r"\*Next entry ID: \*\*\d{3}\*\*\*",
        f"*Next entry ID: **{int(entry_id) + 1:03d}***",
        content,
    )
    # Update "Last updated by" line
    content = re.sub(
        r"\*Last updated by Entry \d{3}[^\n]*\*",
        f"*Last updated by Entry {entry_id} — {agent} — {timestamp[:10]}*",
        content,
    )
    MASTER_LOG.write_text(content, encoding="utf-8")


# ── Read mode ─────────────────────────────────────────────────────────────────

def cmd_read() -> None:
    """Print project context summary for agent onboarding."""
    if not MASTER_LOG.exists():
        print(f"{RED}MASTER_PROJECT_LOG.md not found at {MASTER_LOG}{RESET}")
        sys.exit(1)

    content = MASTER_LOG.read_text(encoding="utf-8")

    # Extract overview table
    _print_header("e-Partogram — Project Context (Agent Startup Read)")

    # Show last 3 entries summary
    entries = re.findall(
        r"### Entry ID: (\d{3})\n\*\*Timestamp:\*\* ([^\n]+)\n\*\*Agent:\*\* ([^\n]+).*?"
        r"#### 🔹 Output Summary:\n(.*?)\n\n#### 🔹 Impact",
        content,
        re.DOTALL,
    )

    if entries:
        print(f"{BOLD}Recent Entries (last 3):{RESET}\n")
        for eid, ts, agent, summary in entries[-3:]:
            print(f"  {GREEN}Entry {eid}{RESET} | {ts[:10]} | {agent.strip()}")
            summary_short = summary.strip()[:120].replace("\n", " ")
            print(f"    → {summary_short}...")
            print()

    # Technical debt
    debt_match = re.search(r"## ⚠️ Known Issues.*?(?=\n---|\Z)", content, re.DOTALL)
    if debt_match:
        print(f"\n{BOLD}Open Technical Debt:{RESET}")
        open_items = re.findall(r"\| (T-\d+) \|([^|]+)\|[^|]+\| Open \|", debt_match.group())
        for item_id, desc in open_items:
            print(f"  {YELLOW}{item_id}{RESET} —{desc.strip()}")

    next_id = _next_entry_id()
    print(f"\n{BOLD}Next Entry ID:{RESET} {GREEN}{next_id}{RESET}")
    print(f"{BOLD}Master Log:{RESET} {MASTER_LOG}\n")


# ── Append mode ───────────────────────────────────────────────────────────────

def cmd_append(args: argparse.Namespace) -> None:
    entry_id = _next_entry_id()
    _validate_no_duplicate(entry_id)
    timestamp = _iso_timestamp()

    if args.agent:
        # Non-interactive (CI/CD / programmatic) mode
        agent          = args.agent
        prompt_text    = Path(args.prompt_file).read_text(encoding="utf-8").strip() if args.prompt_file else args.prompt or "[No prompt provided]"
        understanding  = args.understanding or "[No understanding provided]"
        actions        = args.actions or "[No actions listed]"
        output_summary = args.output or "[No output summary]"
        impact         = (args.impact or "Medium").strip()
        next_steps     = args.next_steps or "[No next steps specified]"
        git_commit     = args.git_commit or ""
        entry_type     = args.type or "Task"
    else:
        # Interactive mode
        _print_header(f"Appending Entry {entry_id} to MASTER_PROJECT_LOG")
        print(f"  Timestamp: {timestamp}\n")

        agent = _prompt_single("Agent name", choices=KNOWN_AGENTS + ["Claude", "GPT", "Gemini"])
        if agent == "Claude":
            model = _prompt_single("Model version (e.g. claude-sonnet-4-6)", default="claude-sonnet-4-6")
            agent = f"Claude ({model})"
        git_commit = _prompt_single("Git commit hash (leave blank if uncommitted)", default="")
        entry_type = _prompt_single("Entry type", default="Task", choices=["Task", "Bug Fix", "Security", "Feature", "Refactor", "Documentation"])

        prompt_text    = _prompt_multiline("Full Prompt Given:", hint="Paste the exact user prompt")
        understanding  = _prompt_multiline("Agent Understanding:", hint="How did you interpret this task?")
        actions        = _prompt_multiline("Actions Taken:", hint="List each file created/modified with details")
        output_summary = _prompt_multiline("Output Summary:", hint="What was achieved?")
        impact         = _prompt_single("Impact Level", default="Medium", choices=["Low", "Medium", "High"])
        next_steps     = _prompt_multiline("Next Suggested Steps:", hint="What should the next agent do?")

    # ── Write entry to master log ────────────────────────────────────────────
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if not MASTER_LOG.exists():
        print(f"{RED}ERROR: {MASTER_LOG} not found. Initialize it first.{RESET}")
        sys.exit(1)

    entry_md = _build_entry(
        entry_id, timestamp, agent, prompt_text, understanding,
        actions, output_summary, impact, next_steps, git_commit,
    )

    # Append before the Summary Dashboard section
    content = MASTER_LOG.read_text(encoding="utf-8")
    # Insert after the last Entry block, before "## 📊 Summary Dashboard"
    summary_marker = "## 📊 Summary Dashboard"
    if summary_marker in content:
        insert_pos = content.index(summary_marker)
        content = content[:insert_pos] + entry_md + "\n" + content[insert_pos:]
    else:
        content = content + entry_md

    MASTER_LOG.write_text(content, encoding="utf-8")

    # ── Save supporting files ────────────────────────────────────────────────
    raw_path      = _save_raw_prompt(entry_id, prompt_text, agent, timestamp)
    change_path   = _save_change_log(entry_id, actions, impact, timestamp)
    activity_path = _save_agent_activity(entry_id, agent, timestamp, output_summary, next_steps)

    # ── Update summary table + metadata lines ────────────────────────────────
    _update_summary_table(entry_id, timestamp, agent, entry_type, impact)

    # ── Confirmation ─────────────────────────────────────────────────────────
    _print_header(f"Entry {entry_id} Written Successfully")
    print(f"  {GREEN}✓{RESET} Master log:    {MASTER_LOG}")
    print(f"  {GREEN}✓{RESET} Raw prompt:    {raw_path}")
    print(f"  {GREEN}✓{RESET} Change log:    {change_path}")
    print(f"  {GREEN}✓{RESET} Agent activity:{activity_path}")
    print(f"\n  Next entry ID: {BOLD}{int(entry_id) + 1:03d}{RESET}\n")


# ── Validate mode ─────────────────────────────────────────────────────────────

def cmd_validate() -> None:
    """Check the master log for structural integrity."""
    if not MASTER_LOG.exists():
        print(f"{RED}ERROR: {MASTER_LOG} not found.{RESET}")
        sys.exit(1)

    content = MASTER_LOG.read_text(encoding="utf-8")
    ids = re.findall(r"### Entry ID:\s*(\d{3})", content)
    errors = []

    # Check sequential
    for i, eid in enumerate(ids):
        expected = f"{i + 1:03d}"
        if eid != expected:
            errors.append(f"Entry ID {eid} is out of sequence (expected {expected})")

    # Check duplicates
    if len(ids) != len(set(ids)):
        from collections import Counter
        dupes = [k for k, v in Counter(ids).items() if v > 1]
        errors.append(f"Duplicate Entry IDs found: {dupes}")

    # Check required sections in each entry
    required_sections = [
        "🔹 Prompt Given:",
        "🔹 Understanding:",
        "🔹 Actions Taken:",
        "🔹 Output Summary:",
        "🔹 Impact Level:",
        "🔹 Next Suggested Steps:",
    ]
    entry_blocks = re.split(r"### Entry ID:", content)[1:]  # skip header
    for i, block in enumerate(entry_blocks):
        eid = ids[i] if i < len(ids) else f"#{i + 1}"
        for section in required_sections:
            if section not in block:
                errors.append(f"Entry {eid} missing section: {section}")

    _print_header("Master Log Validation")
    if errors:
        print(f"{RED}Found {len(errors)} issue(s):{RESET}\n")
        for err in errors:
            print(f"  {RED}✗{RESET} {err}")
        sys.exit(1)
    else:
        print(f"{GREEN}✓ All {len(ids)} entries are valid and sequential.{RESET}")
        print(f"  Log path: {MASTER_LOG}\n")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="e-Partogram Agent Memory & Execution Ledger CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
          Examples:
            python scripts/update_master_log.py --read
            python scripts/update_master_log.py --validate
            python scripts/update_master_log.py
            python scripts/update_master_log.py \\
              --agent "Claude (claude-sonnet-4-6)" \\
              --prompt-file /tmp/my_prompt.txt \\
              --understanding "Task was to fix X" \\
              --actions "Modified backend/app.py line 42" \\
              --output "Bug fixed — endpoint returns 200" \\
              --impact High \\
              --next-steps "Add unit test for this endpoint" \\
              --git-commit abc1234 \\
              --type "Bug Fix"
        """),
    )
    parser.add_argument("--read",         action="store_true", help="Print project context summary for agent onboarding")
    parser.add_argument("--validate",     action="store_true", help="Validate log structure and sequential IDs")
    parser.add_argument("--agent",        type=str, help="Agent name (skips interactive mode)")
    parser.add_argument("--prompt",       type=str, help="Prompt text (inline)")
    parser.add_argument("--prompt-file",  type=str, help="Path to file containing the full prompt")
    parser.add_argument("--understanding",type=str, help="Agent interpretation of the task")
    parser.add_argument("--actions",      type=str, help="Newline-separated list of actions taken")
    parser.add_argument("--output",       type=str, help="Output / achievement summary")
    parser.add_argument("--impact",       type=str, choices=["Low","Medium","High"], help="Impact level")
    parser.add_argument("--next-steps",   type=str, help="Next suggested steps")
    parser.add_argument("--git-commit",   type=str, help="Git commit hash (optional)")
    parser.add_argument("--type",         type=str, default="Task", help="Entry type label")

    args = parser.parse_args()

    if args.read:
        cmd_read()
    elif args.validate:
        cmd_validate()
    else:
        cmd_append(args)


if __name__ == "__main__":
    main()
