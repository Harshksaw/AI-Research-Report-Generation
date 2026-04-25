# AI Research Report Generation

Project document:
https://docs.google.com/document/d/1VlHirN62sWE1CwXr4v2YM40sg8luskD6VY4A2gKOHK4/edit?usp=sharing

## Requirements

- Python 3.11+
- `uv` installed

## Setup

1. Create the virtual environment and install dependencies:

```bash
uv sync
```

2. Add environment variables.

Create or update `.env` in the project root. You can use `.env.example` as a template.

Required keys depend on the provider you want to use:

- `OPENAI_API_KEY` for OpenAI
- `GOOGLE_API_KEY` for Google Gemini and Google embeddings
- `GROQ_API_KEY` for Groq

Optional Astra DB settings used by the project:

- `ASTRA_DB_API_ENDPOINT`
- `ASTRA_DB_APPLICATION_TOKEN`
- `ASTRA_DB_KEYSPACE`

3. Optional: choose the LLM provider.

If not set, the code defaults to `google`.

```bash
export LLM_PROVIDER=groq
```

Supported values in the current config:

- `google`
- `groq`

Optional overrides:

- `LLM_MODEL_NAME` to override the configured model for the selected provider
- `LLM_FALLBACK_ORDER` to control provider fallback order when the primary provider is quota-limited. Default: `groq`
- `EMBEDDING_MODEL_NAME` to override the configured embedding model

If Google Gemini returns a quota error during LLM startup, the loader now attempts the providers listed in `LLM_FALLBACK_ORDER` as long as the corresponding API keys are present.

## Run Commands

Run the placeholder app entrypoint:

```bash
uv run python main.py
```

Run the model loader test module:

```bash
uv run python -m research_and_analyst.utils.model_loader
```

This command needs the corresponding API key in `.env` or your shell environment. If `LLM_PROVIDER=google`, Gemini quota exhaustion will surface during startup and can fall back to Groq when `GROQ_API_KEY` is configured.

## Notebook

Install the Jupyter kernel for this project environment:

```bash
uv run python -m ipykernel install --user --name ai-research-report-generation --display-name "Python (AI Research Report Generation)"
```

Then start Jupyter:

```bash
uv run jupyter notebook
```

Open `research_and_analyst/notebook/test.ipynb` and select the `Python (AI Research Report Generation)` kernel.

## Notes

- The embedding model in `research_and_analyst/config/configuration.yaml` uses Google embeddings, so `GOOGLE_API_KEY` is required for `research_and_analyst.utils.model_loader`.
- `main.py` currently only prints a placeholder message.
- `research_and_analyst/utils/model_loader.py` now loads `.env` automatically with `python-dotenv`.
