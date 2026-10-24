"""Investigation module exporting InvestigationService and prompt utilities."""

from investigation.prompts import build_investigation_prompt
from investigation.service import InvestigationService, extract_json_from_text

__all__ = [
    "InvestigationService",
    "build_investigation_prompt",
    "extract_json_from_text",
]
