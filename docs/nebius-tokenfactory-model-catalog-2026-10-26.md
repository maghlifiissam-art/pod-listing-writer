# Nebius Token Factory model catalog

Use this catalog to compare public models available in Nebius Token Factory. It includes model names, model IDs, providers, regions, context windows and pricing values for inference, embeddings and reranking.

For integrations and automation, fetch `/api/public/models_info`. The JSON endpoint is the authoritative machine-readable source; this Markdown view is optimized for reading and quick comparison.

Pricing values map to these JSON fields:

- Token models: `flavors[].input_price_per_million_tokens`, optional `flavors[].input_cached_price_per_million_tokens` and `flavors[].output_price_per_million_tokens`.
- Embedding and rerank models: `flavors[].input_price_per_million_tokens`.

| Model | Vendor | Type | Parameters, B | Context window, K tokens | Regions | Pricing |
| --- | --- | --- | ---: | ---: | --- | --- |
| DeepSeek V4.1 Flash | deepseek | image2text | 0 | 1048 | us-north1 | deepseek-ai/DeepSeek-V4.1-Flash: input\_price\_per\_million\_tokens=0.3, input\_cached\_price\_per\_million\_tokens=0.01, output\_price\_per\_million\_tokens=1.2 |
| DeepSeek V4.1 Flash 1017 | deepseek | image2text | 0 | 1048 | us-north1 | deepseek-ai/DeepSeek-V4.1-Flash-1017: input\_price\_per\_million\_tokens=0.3, input\_cached\_price\_per\_million\_tokens=0.006, output\_price\_per\_million\_tokens=1.2 |
| DeepSeek-V4-Flash-0731 | deepseek | text2text | 304 | 1024 | us-central1 | deepseek-ai/DeepSeek-V4-Flash-0731: input\_price\_per\_million\_tokens=0.14, input\_cached\_price\_per\_million\_tokens=0.01, output\_price\_per\_million\_tokens=0.28 |
| DeepSeek-V4-Pro | deepseek | text2text | 862 | 1000 | uk-south1 | deepseek-ai/DeepSeek-V4-Pro: input\_price\_per\_million\_tokens=1.75, output\_price\_per\_million\_tokens=3.5 |
| DeepSeek-V4-Pro-0813 | deepseek | text2text | 0 | 979 | uk-south1 | deepseek-ai/DeepSeek-V4-Pro-0813: input\_price\_per\_million\_tokens=1.32, input\_cached\_price\_per\_million\_tokens=0.04, output\_price\_per\_million\_tokens=3.96 |
| Gemma-3-27b-it | google | text2text | 27 | 110 | eu-north1 | google/gemma-3-27b-it: input\_price\_per\_million\_tokens=0.1, output\_price\_per\_million\_tokens=0.3 |
| Muse Spark Open | meta | image2text | 0 | 1048 | us-north1 | meta-models/muse-spark-open: input\_price\_per\_million\_tokens=1.25, input\_cached\_price\_per\_million\_tokens=0.15, output\_price\_per\_million\_tokens=4.25 |
| MiniMax-M3.1-Flash | minimaxai | image2text | 0 | 1049 | us-north1 | MiniMaxAI/MiniMax-M3.1-Flash: input\_price\_per\_million\_tokens=0.15, input\_cached\_price\_per\_million\_tokens=0.015, output\_price\_per\_million\_tokens=0.6 |
| MiniMax-M3 | MiniMaxAI | text2text | 0 | 1049 | us-central1 | MiniMaxAI/MiniMax-M3: input\_price\_per\_million\_tokens=0.3, input\_cached\_price\_per\_million\_tokens=0.06, output\_price\_per\_million\_tokens=1.2 |
| Kimi-K2.6 | moonshotai | image2text | 0 | 256 | us-central1 | moonshotai/Kimi-K2.6: input\_price\_per\_million\_tokens=0.95, input\_cached\_price\_per\_million\_tokens=0.16, output\_price\_per\_million\_tokens=4 |
| Kimi-K2.7-Code | moonshotai | text2text | 0 | 256 | us-central1 | moonshotai/Kimi-K2.7-Code: input\_price\_per\_million\_tokens=0.95, input\_cached\_price\_per\_million\_tokens=0.15, output\_price\_per\_million\_tokens=4 |
| Kimi-K3 | moonshotai | image2text | 0 | 1024 | eu-west2 | moonshotai/Kimi-K3: input\_price\_per\_million\_tokens=3, input\_cached\_price\_per\_million\_tokens=0.3, output\_price\_per\_million\_tokens=15 |
| Hermes-4-405B | NousResearch | text2text | 405 | 128 | eu-north1 | NousResearch/Hermes-4-405B: input\_price\_per\_million\_tokens=1, output\_price\_per\_million\_tokens=3 |
| Nemotron 3.5 Super VL | nvidia | image2text | 0 | 1024 | us-north1 | nvidia/Nemotron-3.5-Super-VL: input\_price\_per\_million\_tokens=0.3, input\_cached\_price\_per\_million\_tokens=0.06, output\_price\_per\_million\_tokens=0.9 |
| Nemotron-3-Nano-30B-A3B | nvidia | text2text | 30 | 262 | eu-north1 | nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B: input\_price\_per\_million\_tokens=0.06, output\_price\_per\_million\_tokens=0.24 |
| Nemotron-3-Super-120b-a12b | nvidia | text2text | 0 | 256 | us-central1 | nvidia/nemotron-3-super-120b-a12b: input\_price\_per\_million\_tokens=0.3, input\_cached\_price\_per\_million\_tokens=0.06, output\_price\_per\_million\_tokens=0.9 |
| Nemotron-3-Ultra-550b-a55b | nvidia | text2text | 0 | 1024 | us-central1 | nvidia/Nemotron-3-Ultra-550b-a55b: input\_price\_per\_million\_tokens=1, input\_cached\_price\_per\_million\_tokens=0.12, output\_price\_per\_million\_tokens=3 |
| Nemotron-3.5-Lightning | nvidia | text2text | 30 | 1024 | eu-north1 | nvidia/Nemotron-3\_5-Lightning: input\_price\_per\_million\_tokens=0.06, output\_price\_per\_million\_tokens=0.24 |
| gpt-oss-120b | openai | text2text | 120 | 131 | eu-north1 | openai/gpt-oss-120b: input\_price\_per\_million\_tokens=0.15, output\_price\_per\_million\_tokens=0.6 |
| openbmb/MiniCPM-V-4\_5 | openbmb | image2text | 8 | 32 | eu-north1 | openbmb/MiniCPM-V-4\_5: input\_price\_per\_million\_tokens=0.658, output\_price\_per\_million\_tokens=1.11 |
| Qwen3-235B-A22B-Instruct-2507 | Qwen | text2text | 235 | 262 | eu-north1 | Qwen/Qwen3-235B-A22B-Instruct-2507: input\_price\_per\_million\_tokens=0.2, output\_price\_per\_million\_tokens=0.6 |
| Qwen3-30B-A3B-Instruct-2507 | Qwen | text2text | 30.5 | 262 | eu-north1 | Qwen/Qwen3-30B-A3B-Instruct-2507: input\_price\_per\_million\_tokens=0.1, output\_price\_per\_million\_tokens=0.3 |
| Qwen3-Embedding-8B | Qwen | embedding | 8 | 41 | eu-north1 | Qwen/Qwen3-Embedding-8B: input\_price\_per\_million\_tokens=0.01, output\_price\_per\_million\_tokens=0 |
| Qwen3.5-397B-A17B | Qwen | text2text | 0 | 262 | us-central1 | Qwen/Qwen3.5-397B-A17B: input\_price\_per\_million\_tokens=0.6, input\_cached\_price\_per\_million\_tokens=0.12, output\_price\_per\_million\_tokens=3.6 |
| Qwen3.8-27B | Qwen | image2text | 0 | 262 | us-central1 | Qwen/Qwen3.8-27B: input\_price\_per\_million\_tokens=0.45, input\_cached\_price\_per\_million\_tokens=0.1, output\_price\_per\_million\_tokens=3 |
| Reflection Beam 1.0 | reflection | text2text | 0 | 1048 | us-north1 | reflection/beam: input\_price\_per\_million\_tokens=0.25, input\_cached\_price\_per\_million\_tokens=0.05, output\_price\_per\_million\_tokens=1 |
| GLM-5.1 | zai-org | text2text | 750 | 200 | eu-north1 | zai-org/GLM-5.1: input\_price\_per\_million\_tokens=1.4, output\_price\_per\_million\_tokens=4.4 |
| GLM-5.2 | zai-org | text2text | 0 | 1024 | uk-south1 | zai-org/GLM-5.2: input\_price\_per\_million\_tokens=1.4, input\_cached\_price\_per\_million\_tokens=0.14, output\_price\_per\_million\_tokens=4.4 |
| GLM-5.3 | zai-org | text2text | 0 | 1024 | us-north1 | zai-org/GLM-5.3: input\_price\_per\_million\_tokens=1.4, input\_cached\_price\_per\_million\_tokens=0.26, output\_price\_per\_million\_tokens=4.4 |
| GLM-5.3-Flash | zai-org | image2text | 0 | 1024 | us-north1 | zai-org/GLM-5.3-Flash: input\_price\_per\_million\_tokens=0.15, input\_cached\_price\_per\_million\_tokens=0.03, output\_price\_per\_million\_tokens=0.5 |
