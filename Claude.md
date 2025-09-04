Built-in Commands:

- /clear - Clear conversation history
- /help - Get usage help
- /model - Select AI model
- /review - Request code review
- /permissions - View/update permissions

Custom Commands:
Create custom commands by adding Markdown files:

Project-level (shared with team):
mkdir -p .claude/commands
Review this code for security issues
.claude/commands/security.md

Personal-level (available everywhere):
mkdir -p ~/.claude/commands
Explain this code in detail

Using Arguments:

  <!-- .claude/commands/test.md -->

Run tests for $1 and check coverage for $2

Then use: test frontend backend

Advanced Features:

- Execute bash commands within slash commands
- Reference specific files
- Use thinking modes for complex analysis

The filename becomes the command name, so optimize.md
creates /optimize.
