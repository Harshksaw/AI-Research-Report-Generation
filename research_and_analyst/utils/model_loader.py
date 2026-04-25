import asyncio
import os
from typing import Any

from dotenv import load_dotenv
from exception.custom_exception import ResearchAnalystException
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from logger import GLOBAL_LOGGER as log
from utils.config_loader import load_config

load_dotenv()


class ApiKeyManager:
    def __init__(self):
        self.api_keys = {
            "GOOGLE_API_KEY": os.getenv("GOOGLE_API_KEY"),
            "GROQ_API_KEY": os.getenv("GROQ_API_KEY"),
            "ASTRA_DB_API_ENDPOINT": os.getenv("ASTRA_DB_API_ENDPOINT"),
            "ASTRA_DB_APPLICATION_TOKEN": os.getenv("ASTRA_DB_APPLICATION_TOKEN"),
            "ASTRA_DB_KEYSPACE": os.getenv("ASTRA_DB_KEYSPACE"),
        }

        for key, val in self.api_keys.items():
            if val:
                log.info(f"{key} loaded from environment")
            else:
                log.warning(f"{key} is missing from environment")

    def get(self, key: str):
        return self.api_keys.get(key)


class ModelLoader:
    """
    Loads embedding models and LLMs based on config and environment.
    """

    def __init__(self):
        self.api_key_mgr = ApiKeyManager()
        self.config = load_config()
        log.info("YAML config loaded", config_keys=list(self.config.keys()))

    def _require_api_key(self, env_var: str, provider: str) -> str:
        api_key = self.api_key_mgr.get(env_var)
        if not api_key:
            raise ResearchAnalystException(
                f"Missing {env_var} for provider '{provider}'. Set it in your environment or .env file."
            )
        return api_key

    def _ensure_event_loop(self) -> None:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

    def _build_google_llm(self, llm_config: dict[str, Any]):
        return ChatGoogleGenerativeAI(
            model=llm_config["model_name"],
            google_api_key=self._require_api_key("GOOGLE_API_KEY", "google"),
            temperature=llm_config.get("temperature", 0.2),
            max_output_tokens=llm_config.get("max_output_tokens", 2048),
        )

    def _build_groq_llm(self, llm_config: dict[str, Any]):
        return ChatGroq(
            model=llm_config["model_name"],
            api_key=self._require_api_key("GROQ_API_KEY", "groq"),
            temperature=llm_config.get("temperature", 0.2),
        )

    def _instantiate_llm(self, provider_key: str, llm_config: dict[str, Any]):
        provider = llm_config.get("provider")
        log.info(
            "Loading LLM",
            provider=provider,
            provider_key=provider_key,
            model=llm_config.get("model_name"),
        )

        if provider == "google":
            return self._build_google_llm(llm_config)
        if provider == "groq":
            return self._build_groq_llm(llm_config)

        log.error("Unsupported LLM provider", provider=provider, provider_key=provider_key)
        raise ValueError(f"Unsupported LLM provider: {provider}")

    def _quota_exceeded(self, error: Exception) -> bool:
        error_text = str(error).lower()
        return any(
            marker in error_text
            for marker in (
                "quota exceeded",
                "resourceexhausted",
                "resource exhausted",
                "429",
                "rate limit",
                "rate-limits",
                "404",
                "notfound",
                "not found",
                "retired",
                "not supported for generatecontent",
            )
        )

    def _resolve_provider_order(self, selected_provider: str, llm_block: dict[str, Any]) -> list[str]:
        fallback_order = os.getenv("LLM_FALLBACK_ORDER", "groq").split(",")
        ordered_providers = [selected_provider]

        for provider in fallback_order:
            normalized = provider.strip().lower()
            if normalized and normalized not in ordered_providers and normalized in llm_block:
                ordered_providers.append(normalized)

        return ordered_providers

    def load_embeddings(self):
        """
        Load and return embedding model from Google Generative AI.
        """
        try:
            model_name = os.getenv(
                "EMBEDDING_MODEL_NAME",
                self.config["embedding_model"]["model_name"],
            )
            log.info("Loading embedding model", model=model_name)

            self._ensure_event_loop()

            return GoogleGenerativeAIEmbeddings(
                model=model_name,
                google_api_key=self._require_api_key("GOOGLE_API_KEY", "google"),
            )
        except Exception as error:
            log.error("Error loading embedding model", error=str(error))
            raise ResearchAnalystException("Failed to load embedding model", error) from error

    def load_llm(self):
        """
        Load and return the configured LLM model.
        """
        llm_block = self.config["llm"]
        provider_key = os.getenv("LLM_PROVIDER", "google").strip().lower()

        if provider_key not in llm_block:
            log.error("LLM provider not found in config", provider=provider_key)
            raise ValueError(f"LLM provider '{provider_key}' not found in config")

        provider_order = self._resolve_provider_order(provider_key, llm_block)
        last_error: Exception | None = None

        for idx, candidate_provider in enumerate(provider_order):
            llm_config = dict(llm_block[candidate_provider])
            model_override = os.getenv("LLM_MODEL_NAME")
            if model_override:
                llm_config["model_name"] = model_override

            try:
                llm = self._instantiate_llm(candidate_provider, llm_config)

                # Force eager validation for Gemini so quota failures can trigger
                # fallback here instead of exploding later in the workflow.
                if llm_config.get("provider") == "google":
                    llm.invoke("Respond with the single word: ready")

                return llm
            except Exception as error:
                last_error = error
                is_last_candidate = idx == len(provider_order) - 1
                should_fallback = self._quota_exceeded(error) and not is_last_candidate

                log.warning(
                    "LLM load failed",
                    provider=candidate_provider,
                    model=llm_config.get("model_name"),
                    error=str(error),
                    will_fallback=should_fallback,
                )

                if should_fallback:
                    continue

                raise ResearchAnalystException(
                    (
                        f"Failed to load LLM provider '{candidate_provider}'. "
                        "If Gemini quota is exhausted, set `LLM_PROVIDER=groq` and a valid "
                        "`GROQ_API_KEY`, or override the model with `LLM_MODEL_NAME`."
                    ),
                    error,
                ) from error

        raise ResearchAnalystException("Failed to load any configured LLM provider", last_error)


if __name__ == "__main__":
    loader = ModelLoader()

    embeddings = loader.load_embeddings()
    print(f"Embedding Model Loaded: {embeddings}")
    result = embeddings.embed_query("Hello, how are you?")
    print(f"Embedding Result: {result}")

    llm = loader.load_llm()
    print(f"LLM Loaded: {llm}")
    result = llm.invoke("Hello, how are you?")
    print(f"LLM Result: {result.content}")
