from __future__ import annotations

from abc import ABC, abstractmethod


class VisionBackend(ABC):
  @abstractmethod
  def name(self) -> str:
    raise NotImplementedError

  @abstractmethod
  def describe_image(self, image_path: str) -> str:
    """Return a short text description of what is visible in the screenshot."""
    raise NotImplementedError

