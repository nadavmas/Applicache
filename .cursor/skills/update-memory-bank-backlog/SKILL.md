---
name: update-memory-bank-backlog
description: Appends one table row per completed task to docs/MEMORY_BANK.md Completed Tasks Backlog (ISO date, Notes with file pointers). Use when the user asks to log work in the memory bank, update MEMORY_BANK with what was done, record completed tasks since the last log, or refresh the backlog after shipping work.
---

# Update MEMORY_BANK completed backlog

1. **Gate**: Edit [`docs/MEMORY_BANK.md`](../../../docs/MEMORY_BANK.md) only when the user explicitly asked to log/update it in this turn (see **Update Policy** at file bottom).

2. **Find anchor**: Open **Completed Tasks Backlog** (markdown table). Treat **since the last log** as work not yet reflected in that table—use the conversation, recent commits, or the user’s summary.

3. **One row per task**: For **each** discrete completed task, add **one new table row** (not one row for everything). Multiple tasks ⇒ multiple new rows.

4. **Columns** (same as existing rows): **Task** (short title, bold OK if the table already uses it) | **Completed On** (ISO date `YYYY-MM-DD`, use today’s date from user context if given) | **Notes** (concise implementation detail, paths/commands as needed).

5. **Insert into the same markdown table**: Find the **last backlog row** (starts with `| ` right after the header row and separator). Append each new log as **another `| … | … | … |` line** directly after that last row.

   **Critical (Markdown)**: Do **not** put a **blank line** between the previous table row and new rows—a blank line **ends** the table in CommonMark, so orphan `|` lines below it will **not** be part of the **Completed Tasks Backlog** table. You may put a blank line **after** the final new row and **before** `## Update Policy`.

6. **Product sections**: Only change **Product Design** (or other narrative sections) if the user asked or the work materially changes documented behavior.
