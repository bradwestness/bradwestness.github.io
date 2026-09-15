---
layout: post
title: "A Coding Agent on Every Desk, Part 3: A Fast Model in a Sidecar"
description: A four-billion-parameter model in a sidecar container takes over the auto-approval classifier and autocomplete for Qwen Code and Open WebUI, so the 27B can focus on the coding.
categories: [Software, AI, Home Lab, DIY]
image: content/images/sidecar-fast-model.jpg
image_alt: A street-racing motorcycle with an integrated sidecar, in the manner of the Sidehackers from Mystery Science Theater 3000.
---

Last time in this series, I talked about [configuring my home lab to run on two GPUs](/2026/09/07/two-gpus-and-a-bigger-context-window/), which itself followed [part one](2026/08/26/running-qwen3-coder-next-on-bazzite/) of configuring the home lab. This time I didn't add a second GPU,b ut a second local model: a small, fast "classifier" model next to the main server, doing the small, fast tasks the large model is the wrong fit for.

## What the Fast Model Does

A sidecar is a pattern from container orchestration: a helper process that runs alongside the main one and handles the supporting work. Here the main process is the 27B coder on port 8080, and the sidecar is a 4B model on port 8082 with three jobs.

**The auto-mode classifier.** [Qwen Code](https://github.com/QwenLM/qwen-code) has an approval mode called AUTO, cycled into place with `Shift+Tab` alongside the default, auto-edit, plan, and yolo modes. In AUTO mode a classifier model reviews each tool call: safe actions are approved automatically, genuinely risky ones are blocked, and anything the classifier is unsure about falls back to a manual prompt. The check runs in two stages — a fast first pass with a small output budget and no extended thinking, and a deeper second pass, with optional thinking, only when the first pass flags something. Read-only tools skip the classifier entirely through an allowlist.

That classifier is the fast model. Every grep, file read, and build command that runs without a prompt is the 4B model saying "that is fine" in under a second.

**Prompt suggestions and speculative execution.** When the agent finishes a turn, Qwen Code asks the fast model to predict what I am likely to type next — two to twelve words — and shows it as a suggestion. With speculative execution enabled, it starts running the predicted input in the background, so if I accept the suggestion the response is already on its way.

**Open WebUI's background tasks.** [Open WebUI](https://open-webui.github.io/) has a set of task models that handle the small jobs around chat: conversation titles, follow-up suggestions, tags, prompt autocomplete, and query rewriting. Each can point at a different model than the one doing the conversation. In this setup they all point at the 4B model, while the 27B stays the default for actual chat.

Why not run all of this on the 27B? It is busy: an agentic session keeps the main server's single slot occupied for minutes at a time, and a classifier request queued behind a long generation is not a classifier. And it is slow: a yes/no safety verdict and a two-word prediction do not need 27 billion parameters and a "reasoning" model. Running them on the big model would spend its GPU time and context window on overhead.

## The Model

The sidecar runs [Qwen3.5-4B](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF) at the UD-Q4_K_XL quantization from unsloth's GGUF repository — the same dynamic quantization approach as the main model, at 4B scale. It loads to about 5.3 GB of video random-access memory (VRAM).

Getting there was less clean than I would like to admit. The first attempt was Llama-3.2-3B at Q8_0, and it never got off the ground: the 3090 was already nearly full with the 27B model, and llama.cpp died allocating the key-value (KV) cache. A Q4_K_M quantization loaded, but the context it left me was small enough to be annoying — classifier prompts carry real context, and I kept hitting "request exceeds the available context size."

Qwen3.5-4B is the right fit, partly because it is a Qwen and partly because it is a hybrid model with [Gated DeltaNet](https://arxiv.org/abs/2412.06464) layers, which carry a fixed-size recurrent state instead of a growing cache of past tokens, so a long context costs far less VRAM than in a conventional transformer. A 64K context fits comfortably. The first few load attempts failed on KV allocation, but it has been up since. One oddity: it is a multimodal model, and llama.cpp happily auto-loads the vision projector even though I only feed it text. I have left it alone.

## The Quadlet

Same pattern as the main server: a [quadlet](https://docs.podman.io/en/latest/markdown/quadlet.html) file in `~/.config/containers/systemd/`, picked up by systemd as a user service.

```ini
[Unit]
Description=Llama.cpp Fast Background Classifier for Qwen Code CLI
Wants=network-online.target
After=network-online.target

[Container]
Pull=newer
AutoUpdate=registry
Image=ghcr.io/ggml-org/llama.cpp:server-cuda
ContainerName=llama-classifier
Network=host
SecurityLabelDisable=true
AddDevice=nvidia.com/gpu=all
Volume=%h/.cache/llama-server:/root/.cache:z
Environment=CUDA_VISIBLE_DEVICES=0
Environment=NVIDIA_VISIBLE_DEVICES=all
Exec=--hf-repo unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL \
     --jinja \
     --reasoning off \
     --ctx-size 65536 \
     --cache-type-k q8_0 \
     --cache-type-v q8_0 \
     --parallel 1 \
     --host 0.0.0.0 \
     --port 8082 \
     --alias qwen-classifier \
     --n-gpu-layers 99 \
     --cors-origins localhost \
     --flash-attn on \
     --warmup \
     --cache-reuse 1 \
     --checkpoint-min-step 2048 \
     --batch-size 2048 \
     --ubatch-size 256 \
     --temp 0

[Service]
Restart=on-failure
TimeoutStartSec=600
CPUQuota=30%

[Install]
WantedBy=default.target
```

Most of this is the main server's quadlet with the heavy machinery removed. The differences that matter:

- **`CUDA_VISIBLE_DEVICES=0`** — the container sees both cards through the CDI device spec, as [established in Part 2](/2026/09/07/two-gpus-and-a-bigger-context-window/), so this pins the classifier to the 3090 explicitly. The classifier is latency-sensitive and the 3090 is the faster card; the 4060 Ti drives the displays, so it stays out of the model's way.
- **`--reasoning off`** — the 4B model can do extended thinking, but a classifier that thinks for ten seconds before saying yes has failed at its job.
- **`--temp 0`** — deterministic. The same action should get the same verdict every time.
- **`--ctx-size 65536`** — classifier prompts include the conversation and the tool call under review. This is where the hybrid architecture pays off: 64K of context for about 5.3 GB total.
- **`--checkpoint-min-step 2048`** — the companion flag for the Gated DeltaNet layers, controlling how often their recurrent state is checkpointed.
- **`--ubatch-size 256`** — half the main server's compute buffer size; the classifier's batches are smaller.
- **`--parallel 1`** — one slot. This is a single-user box, and the classifier takes short, sequential requests.
- **`CPUQuota=30%`** — the main server gets 70% of the CPU; the classifier mostly waits on the GPU.
- **`TimeoutStartSec=600`** — the model download and first load are the slow part, and ten minutes has been plenty.

There is no tensor-split, no speculative decoding, no context-shift — none of that makes sense for a single-card 4B model.

`Pull=newer` and `AutoUpdate=registry` are the same self-update pattern as the main server: the image refreshes on reboot without touching the quadlet. The classifier rides the same `llama.cpp:server-cuda` image, so both servers track the same upstream.

The volume mount is worth a note: it is the same `~/.cache/llama-server` directory as the main server. That is fine because they run different models — the Hugging Face cache is keyed by repository and file.

## Qwen Code Configuration

The client side is a settings file. The classifier is registered as a second OpenAI-compatible provider and named as the `fastModel`:

```json
{
  "env": {
    "QWEN_CODER_KEY": "none",
    "QWEN_CLASSIFIER_KEY": "none"
  },
  "modelProviders": {
    "openai": [
      {
        "id": "qwen-coder",
        "name": "qwen-coder",
        "baseUrl": "http://localhost:8080/v1",
        "envKey": "QWEN_CODER_KEY",
        "generationConfig": {
          "contextWindowSize": 131072,
          "maxOutputTokens": 16384,
          "reserveContextTokens": 8192
        }
      },
      {
        "id": "qwen-classifier",
        "name": "qwen-classifier",
        "baseUrl": "http://localhost:8082/v1",
        "envKey": "QWEN_CLASSIFIER_KEY",
        "generationConfig": {
          "contextWindowSize": 65536,
          "maxOutputTokens": 4096,
          "temperature": 0.0
        }
      }
    ]
  },
  "fastModel": "qwen-classifier",
  "suggestions": {
    "useCacheAwareForkedQueries": true,
    "speculativeExecution": true
  }
}
```

`fastModel` is the setting that does the routing: Qwen Code's side queries — the AUTO-mode classifier, prompt suggestions, speculative execution, session titles — all default to the fast model, and the main model is left for the actual coding work. The `envKey` values are dummies; llama.cpp does not check authentication, but the client wants a key name to look up.

With that in place, `Shift+Tab` gets to AUTO mode and the classifier takes over the approval loop. When the classifier is unreachable — the container restarting, say — Qwen Code falls back to manual approval rather than guessing, which is the right failure mode for a permission system.

## Open WebUI

Open WebUI gets a second OpenAI connection pointing at `http://localhost:8082/v1` with the model name `qwen-classifier` — matching the `--alias` from the quadlet — and its task models all point at it. The chat default stays `qwen-coder`.

Conversation titles are descriptive instead of a truncated first line. The prompt box offers completions as you type. The follow-up suggestions match what the conversation was about. None of it is the 27B's job anymore.

## Measuring It

`llama-server` logs timing after every request, same as the main server:

```bash
journalctl --user -u llama-classifier -f | grep -E 'prompt eval|eval time'
```

A real classifier task from the log — a 140-token prompt, a 29-token verdict:

```
prompt eval time = 173.41 ms / 140 tokens (  1.24 ms per token,  807.34 tokens per second)
       eval time = 612.55 ms /  29 tokens ( 21.88 ms per token,   45.71 tokens per second)
      total time = 785.96 ms / 169 tokens
```

Sub-second end to end, warm. A cold small request — 17 tokens in, 2 out — takes about 350 milliseconds. That is what makes AUTO mode feel invisible: the verdict lands before I finish reading the tool call it is approving.

The VRAM split, with both models loaded and the desktop running:

| Card | Main model | Classifier | Desktop | Free |
|---:|---:|---:|---:|---:|
| RTX 3090 (24 GB) | 16.4 GB | 5.3 GB | — | 1.8 GB |
| RTX 4060 Ti (16 GB) | 11.3 GB | — | 1.3 GB | 3.4 GB |
{: .table .table-striped }

The 3090 is the tight card, but the classifier's footprint is static, so it is a known quantity rather than a risk.

## What Comes Next

The point of the sidecar is that together the classifier and the autocomplete close the gap between "a local model that can do the work" and "a tool that feels finished." Qwen Code starts to feel like the hosted tools I have used — Claude Code, Codex — it keeps moving instead of stalling on a permission prompt, and it fails safe when the classifier is down. And every one of those requests that a hosted tool sends to a frontier API ends up on a 4B model in a container next door. The experience is the full-featured one, and the entire stack — the 27B, the 4B, the web UI — runs on a desktop in my office, on hardware I can see and touch.

Model releases are the thing this setup is waiting for, and I am not watching for them manually. A daily automation in Open WebUI — run by the 27B itself — fetches the [Artificial Analysis Intelligence Index](https://artificialanalysis.ai/leaderboards/models) and flags any open-weight model that fits the hardware, dense up to about 32B or up to about 70B at 4-bit across both cards, and scores above the current baseline of 34. It re-baselines if the index version changes, because scores are not comparable across versions, and it also searches for new Qwen releases in the last 48 hours, since those often appear on the index with a lag. Most days the report is one line: no change. When something does get flagged, the next step is the actual workflow, because a leaderboard score is not the same as agentic reliability.

The other knob is the split between the two cards. The 3090 is the tight one — 1.8 GB free with both models loaded — and a larger replacement model will change that math. The tensor split and the classifier's pin to the 3090 are each a single line in the quadlet, so whichever way the balance tips, the fix is a one-line edit and a reboot.

The pieces from the first two posts did their job again: the clients only ever knew about an alias and a port, so adding a second model was a configuration change, not a migration.
