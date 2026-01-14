import anthropic
from typing import Optional, Dict, Any
import json
import logging
from app.config import settings
from app.utils.audit import log_ai_call

logger = logging.getLogger(__name__)

class LLMClient:
    """
    Wrapper for Anthropic Claude API with error handling and audit logging.
    """

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        json_response: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Send a completion request to Claude.

        Args:
            prompt: The user prompt
            system: System prompt
            model: Model to use (defaults to settings.DEFAULT_MODEL)
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0.0-1.0)
            json_response: Whether to parse response as JSON
            metadata: Additional metadata for audit logging

        Returns:
            Dict with 'content' (parsed if JSON) and 'usage' info
        """
        model = model or settings.DEFAULT_MODEL

        messages = [{"role": "user", "content": prompt}]

        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system or "You are an AI assistant for MentorLed operations.",
                messages=messages
            )

            content = response.content[0].text

            # Parse JSON if requested
            if json_response:
                # Handle potential markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                try:
                    content = json.loads(content.strip())
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON response: {e}")
                    logger.error(f"Raw content: {content}")
                    raise ValueError(f"Invalid JSON response from LLM: {e}")

            result = {
                "content": content,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                    "model": model
                }
            }

            # Log the AI call asynchronously
            await log_ai_call(
                model=model,
                action=metadata.get("action", "completion") if metadata else "completion",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                entity_type=metadata.get("entity_type") if metadata else None,
                entity_id=metadata.get("entity_id") if metadata else None
            )

            return result

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            raise
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise

# Singleton instance
llm_client = LLMClient()
