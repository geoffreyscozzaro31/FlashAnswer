# src/app/service/llm_services.py

from typing import List
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from src.app import config
from src.app.logger.logger_configuration import logger


class AnswerQCMService:
    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing")

        self.llm = ChatGoogleGenerativeAI(
            model=config.LLM_CHAT_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            temperature=config.ANSWER_TEMPERATURE
        )
        answer_prompt_template = self._load_prompt(config.ANSWER_PROMPT_FILE)
        self.answer_chain = PromptTemplate.from_template(answer_prompt_template) | self.llm

    def _load_prompt(self, filename: str) -> str:
        try:
            return (config.PROMPT_DIR / filename).read_text(encoding="utf-8")
        except Exception as e:
            raise IOError(f"Error loading prompt file '{filename}': {e}")

    def generate_answer(self, question: str, options: List[str], context: str) -> str:
        try:
            options_text = "\n".join([f"{i + 1}. {opt}" for i, opt in enumerate(options)])

            prompt_input = {
                "question": question,
                "options": options_text,
                "context": context
            }

            logger.info("[ANSWER] Generating answer via LLM...")
            response = self.answer_chain.invoke(prompt_input)
            answer = response.content.strip()

            if config.LOG_GEMINI_RESPONSES:
                logger.info(f"[ANSWER] LLM Answer: {answer}")

            return answer
        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            return "Error during answer generation."