from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExecutionResult:
  ok: bool
  dry_run: bool
  executor: str
  action_type: str
  note: str = ""


class ActionExecutor:
  """
  Execution interface for the Pod agent loop.

  v2-alpha ships a stub executor only. This interface is here so we can later
  implement real input injection (CGEvent/cliclick) without rewriting the loop.
  """

  def name(self) -> str:
    raise NotImplementedError()

  def execute(self, action: dict, *, dry_run: bool) -> ExecutionResult:
    raise NotImplementedError()

