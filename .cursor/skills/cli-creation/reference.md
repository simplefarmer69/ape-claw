# CLI Creation Reference

## OpenClaw skill model essentials

- Skill format: folder with `SKILL.md` (YAML frontmatter + instructions)
- Load precedence:
  1. `<workspace>/skills`
  2. `~/.openclaw/skills`
  3. bundled skills
- Validation commands:
  - `openclaw skills check`
  - `openclaw skills list --eligible`

## CLI UX baselines

- `stdout`: primary result data
- `stderr`: logs/errors
- `0` exit on success, non-zero on failure
- `--help` and examples must be present
- include `--json` for automation where useful

## Framework decision matrix

### Python
- Typer: best general default, fast authoring, type-hint driven
- Click: mature ecosystem, good for existing Click codebases
- argparse: built-in/no dependency environments

### Node
- Commander: simple and direct for most CLIs
- oclif: plugin architecture and larger multi-command products
- yargs: parse-heavy and fluent-style configuration

## Exit code template

Use stable, documented codes:
- `0`: success
- `2`: usage/validation error
- `3`: runtime dependency failure (missing API/tool)
- `4`: external service failure
- `1`: unexpected internal error

Adjust if your ecosystem has stricter conventions.

## Mutation safety template

For destructive operations:
- provide `--dry-run`
- require explicit `--yes` (or prompt in interactive mode)
- print exactly what will change before execution

## Minimal release checklist

- [ ] Command contract documented
- [ ] Help examples updated
- [ ] `--json` output stable
- [ ] Exit codes tested
- [ ] Install instructions tested on target shell/OS
- [ ] Changelog entry added

## Sources

- https://openclaw.ai/
- https://github.com/openclaw/openclaw
- https://docs.openclaw.ai/cli/skills
- https://docs.openclaw.ai/tools/skills
- https://docs.openclaw.ai/tools/skills-config
- https://docs.openclaw.ai/tools/clawhub
- https://clig.dev/
- https://bettercli.org/
- https://typer.tiangolo.com/
- https://oclif.io/docs/introduction/
