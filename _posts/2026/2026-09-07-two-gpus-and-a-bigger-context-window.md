---
layout: post
title: "A Coding Agent on Every Desk, Part 2: Two GPUs and a Bigger Context Window"
description: The second graphics card arrived. Here is the llama.cpp configuration I landed on for Qwen3.8-27B across an RTX 3090 and an RTX 4060 Ti, and what changed since the first post.
categories: [Software, AI, Home Lab, DIY]
image: content/images/two-gpus-qwen-on-bazzite.jpg
image_alt: The inside of an open desktop computer case with an MSI GeForce RTX 3090 installed above a Gigabyte GeForce RTX 4060 Ti, a yellow-lit motherboard, and Arctic case fans.
---

The second graphics card arrived, and so did a new model. This is a follow-up to [A Coding Agent on Every Desk](/2026/08/26/running-qwen3-coder-next-on-bazzite/). The Podman, Tailscale, and Open WebUI pieces from that post are unchanged. What changed is the card in the second slot, the model behind the `qwen-coder` alias, and most of the `llama-server` command line.

The machine is now a used NVIDIA GeForce RTX 3090 with 24 GB of video random-access memory (VRAM), the original RTX 4060 Ti with 16 GB, 64 GB of DDR5, and an Intel Core i9-12900KF on the same Gigabyte Z690 Aorus Master. Forty gigabytes of VRAM turned out to be enough to be interesting and not quite enough to be comfortable.

## Switching Models

When I wrote the first post, Qwen3-Coder-Next was the best coding model I could fit: an 80B mixture-of-experts (MoE) model with 3B active parameters, run with half its experts in system memory.

Since then, Alibaba released [Qwen3.8](https://huggingface.co/Qwen/Qwen3.8-27B). The 27B model in that family is dense, so every parameter participates in every token, and it is the highest-scoring open-weight model in its size class on the [Artificial Analysis Intelligence Index](https://artificialanalysis.ai/leaderboards/models) at 34. That is double anything else that fits in 40 GB, including Coder-Next and the Gemma, Mistral, and gpt-oss options I compared it against. The models above it are all much larger MoE models needing 100 to 250 GB at a 4-bit quantization.

Two architectural details matter for the tuning below. Only one in four of the model's 64 layers is conventional attention; the rest are [Gated DeltaNet](https://arxiv.org/abs/2412.06464) layers, which carry a fixed-size recurrent state instead of a growing cache of past tokens. That is a large part of why 128K context is realistic on this hardware. The model was also trained with multi-token prediction, which I will come back to. It is Apache 2.0 licensed with a native 256K context.

The 27B is a reasoning model. It thinks before it answers, and the thinking is part of the output. That is the reason the context window became the thing I cared most about.

## Installing the 3090

The Z690 Aorus Master has two full-length PCI Express slots wired to the CPU, and with two cards installed they run at eight lanes each. That is fine for layer-split inference, where each card runs its own layers and hands a small activation tensor to the other once per token. NVLink is not needed. The 3090 went into the top slot for the airflow, and the 4060 Ti moved down to the second.

Power was the thing I checked before ordering. A 3090 draws 350 W at stock and spikes above that, the 4060 Ti adds about 165 W, and the 12900KF can pull 250 W. The machine has a Corsair HX1200, a 1200 W 80 Plus Platinum supply, which covers that with room for the transients. On a 1000 W unit I would cap the 3090 with `nvidia-smi -pl 280`; inference is memory-bound enough that it costs only a few percent of speed, and it is quieter. I may still do it for the noise.

The other detail worth checking is which card CUDA calls device 0. The runtime orders devices by estimated performance, so the 3090 should be first, but `--tensor-split` below assumes that and would silently put most of the model on the slower card if it were reversed. `nvidia-smi -L` shows the order, as does the `llama-server` startup log.

The displays stayed on the 4060 Ti, so the desktop's gigabyte or two of VRAM comes out of the smaller card's share.

## Fitting the Context

The first thing I tried was the obvious one: the whole model in VRAM with a 64K context. It loaded, it was fast, and it was nearly useless for agentic coding.

A coding agent's conversation grows quickly. The system prompt and tool definitions take several thousand tokens before the first request. Every file read, shell command, and edit lands in the context, and a reasoning model adds a few thousand tokens of thinking before each answer. I was hitting 64K within a handful of tool calls, at which point [Qwen Code](https://github.com/QwenLM/qwen-code) compresses the history and the model loses the details it was just working with.

The limit was not the weights. The UD-Q5_K_M quantization is 19.8 GB, leaving 20 GB for everything else. The limit was the [key-value (KV) cache](https://huggingface.co/docs/transformers/kv_cache), which `llama.cpp` stores at 16-bit precision by default. At 64K it was taking roughly as much memory as the model.

The fix was to quantize the cache to 8-bit, which halves it at a quality cost I have not been able to notice. That took the same memory budget from 64K to 128K. It is a real improvement: the agent gets through a typical task without compressing, and when it does compress, less is lost. It is not a solution. Long sessions and large repositories still fill it.

## The Quadlet

This is the current `~/.config/containers/systemd/llama-server.container`:

```ini
[Unit]
Description=Llama.cpp Maximum Performance Server for Qwen3.8-27B (Dense)
Wants=network-online.target
After=network-online.target

[Container]
Pull=newer
AutoUpdate=registry
Image=ghcr.io/ggml-org/llama.cpp:server-cuda
ContainerName=llama-server
AddDevice=nvidia.com/gpu=all
SecurityLabelDisable=true
Network=host
Volume=%h/.cache/llama-server:/root/.cache:z
Exec=--hf-repo unsloth/Qwen3.8-27B-GGUF:UD-Q5_K_M \
     --jinja \
     --ctx-size 131072 \
     --cache-type-k q8_0 \
     --cache-type-v q8_0 \
     --parallel 1 \
     --host 0.0.0.0 \
     --port 8080 \
     --alias qwen-coder \
     --n-gpu-layers 99 \
     --split-mode layer \
     --tensor-split 26,14 \
     --cors-origins localhost \
     --flash-attn on \
     --warmup \
     --context-shift \
     --cache-reuse 1 \
     --cache-idle-slots \
     --checkpoint-min-step 2048 \
     --spec-type draft-mtp \
     --spec-draft-n-max 4 \
     --spec-draft-p-min 0.05 \
     --batch-size 2048 \
     --ubatch-size 512 \
     --temp 0.7 \
     --top-p 0.80 \
     --top-k 20 \
     --min-p 0.0

[Service]
Restart=on-failure
TimeoutStartSec=900
CPUQuota=70%

[Install]
WantedBy=default.target
```

### Keeping It Current Without Touching It

`llama.cpp` ships several releases a week. In the two weeks between these posts it fixed a normalization bug in the Gated DeltaNet layers this model uses and taught the server to detect the speculative-decoding draft type from the model file. A home server I have to remember to update is a home server running a stale build. Two Quadlet settings take that off my hands.

[`Pull=newer`](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html#pull) checks the registry for a newer image every time the service starts, and pulls it if there is one. [`AutoUpdate=registry`](https://docs.podman.io/en/latest/markdown/podman-auto-update.1.html) covers the case where the machine stays up for weeks: a daily systemd timer compares the running image to the registry and, if they differ, pulls the new one and restarts the service. The timer needs enabling once:

```bash
systemctl --user enable --now podman-auto-update.timer
```

Between them the server tracks the current release with no involvement from me. Open WebUI's Quadlet has the same `AutoUpdate=registry` line. The tradeoff is that an upstream change could break my configuration and I would find out when a request failed. Podman rolls back if the new container exits immediately, and in practice the only failure I have seen is a deprecated option producing a warning. For a single-user appliance in a closet, that is the balance I want. Anything other people depend on should pin a version.

### What Changed in the Command Line

Most of the `Exec=` line is unchanged from the first post, which covers `--hf-repo`, `--jinja`, `--host`, `--port`, `--alias`, `--n-gpu-layers`, `--split-mode layer`, and `--flash-attn`. The [`llama-server` documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#usage) has the complete list. What follows is only what is new or different.

**Gone:** `--n-cpu-moe 44`, which kept expert weights in system memory so an 80B MoE model could fit next to a 16 GB card. Qwen3.8-27B is dense and fits in VRAM outright. That is the single biggest reason generation is faster.

**Context and cache**

- **`--ctx-size 131072`** is the same 128K as before, but now the whole model is in VRAM too, and it fits because of the next two options.
- **`--cache-type-k q8_0`** and **`--cache-type-v q8_0`** store the KV cache at 8-bit instead of 16. This is the change that paid for the larger context. V-cache quantization requires FlashAttention, which is on. `q4_0` would halve it again and make 256K reachable at a more noticeable quality cost.
- **`--parallel 1`** sets one server slot. Each slot gets its own context cache, and I would rather have one large context than two smaller ones.

**Two GPUs**

- **`--tensor-split 26,14`** is the share of the model each card gets, in CUDA device order. The numbers are the two cards' VRAM sizes minus an allowance for the desktop on the 4060 Ti. Moving more onto the 3090 would speed up generation, since its memory bandwidth is roughly three times the 4060 Ti's, but every layer moved there takes VRAM the cache also wants.
- **`--cors-origins localhost`** closes the wide-open cross-origin default the server warned about last time. Open WebUI calls the server from its backend, not the browser, so it is unaffected.

**Reusing work**

- **`--warmup`** runs an empty pass at startup so the first real request does not pay for buffer allocation.
- **`--context-shift`** drops the oldest tokens instead of erroring when a conversation outgrows the context. Qwen Code compresses well before that, so it rarely triggers.
- **`--cache-reuse 1`** was 256 last time. It is the minimum chunk the server will reuse when a new prompt shares a prefix with an earlier one. Agents resend the whole conversation every turn, so nearly all of each request is a known prefix. At one, a follow-up turn in a 7K conversation processed only the 35 new tokens.
- **`--cache-idle-slots`** saves an idle slot's context to the prompt cache when a new task arrives. It does little with one slot but will matter if I raise `--parallel`.
- **`--checkpoint-min-step 2048`** controls how often the server checkpoints the recurrent state of the Gated DeltaNet layers. Unlike a KV cache, that state cannot be rewound to an arbitrary token; it can only be restored from a checkpoint. When Qwen Code compresses or edits history, the server reprocesses from the nearest checkpoint before the change. The default spacing is 8192 tokens; 2048 caps that reprocessing at 2K tokens in exchange for storing more checkpoints. On an attention-only model this option does nothing.

**Speculative decoding**

- **`--spec-type draft-mtp`** uses the model's own multi-token prediction (MTP) head to guess the next several tokens, then verifies them all in one forward pass. Qwen3.8 was trained with that head, and the Unsloth GGUF ships it as a small companion file, so no separate draft model is needed.
- **`--spec-draft-n-max 4`** caps each draft at four tokens. My acceptance rate runs 55 to 60 percent with a mean accepted length a little over three, so four is about right.
- **`--spec-draft-p-min 0.05`** stops drafting when the head's confidence drops below five percent.

This is buying less than it sounds like. Each step is one verify pass plus up to four draft passes, and on two cards each pass includes a sync between them. The result is a modest gain over plain decoding. It stays on because it is a net positive on the model's prose-heavy thinking and costs nothing when drafts are rejected.

**Batches and sampling**

- **`--batch-size 2048`** is unchanged and now the server default.
- **`--ubatch-size 512`** is down from 2048. It bounds the temporary compute buffers, which live in VRAM alongside everything else, and 512 is what left room for the cache. Prompt processing still runs at about 1,000 tokens per second.
- **`--temp 0.7`**, **`--top-p 0.80`**, **`--top-k 20`**, **`--min-p 0.0`** are the model card's instruct-mode values, replacing the Coder-Next ones. The card recommends a temperature of 1.0 for thinking mode, but I have found the tighter values produce more reliable tool calls.

**Service:** `CPUQuota=70%` is new. Nothing runs on the CPU during inference, but the server still uses threads for tokenization and cache management and will take every core if allowed. The cap keeps the desktop responsive during a long prompt.

## Qwen Code Configuration

The client had to change to match. Qwen Code uses `contextWindowSize` to decide when to compress, so leaving it at 64K would have wasted the new room:

```json
"generationConfig": {
  "contextWindowSize": 131072,
  "maxOutputTokens": 16384,
  "reserveContextTokens": 8192
}
```

`maxOutputTokens` becomes `max_tokens` on each request, and the default of 4096 is too low for a reasoning model. Thinking plus a code edit regularly exceeded it, and responses were cut off mid-edit. Sixteen thousand has been enough.

I also disabled Qwen Code's built-in `report_findings` tool and its automatic memory recall. Both send tool schemas with nested length constraints that the `llama.cpp` grammar engine rejected, which produced a confusing grammar error on every request until I found the cause.

## Measuring It

`llama-server` logs timing after every request:

```bash
journalctl --user -u llama-server -f | grep -E 'prompt eval|eval time|draft acceptance'
```

```
prompt eval time =  7311.88 ms /  8036 tokens (  0.91 ms per token, 1099.03 tokens per second)
       eval time = 159000.59 ms /  4030 tokens ( 39.46 ms per token,   25.34 tokens per second)
draft acceptance = 0.53142 ( 2740 accepted /  5156 generated), mean len =  3.13
```

Prompt processing, generation, and the speculative draft rate. Generation is the number that decides how the tool feels:

| Tokens in context | Generation speed |
|---:|---:|
| ~2K | ~31 tokens/s |
| ~7K | ~28 tokens/s |
| ~25K | ~25 tokens/s |
{: .table .table-striped }

The same model on a single 3090 would be closer to 40. The 4060 Ti holds a third of the layers with a third of the bandwidth, so it accounts for most of each pass. Twenty-five tokens per second is faster than I can read, which is the threshold I care about.

## What Comes Next

Sixty-four thousand tokens overflowed on nearly every task. One hundred twenty-eight thousand overflows on some of them, and the model behind it is the best I can fit. For everyday coding this is now a tool I reach for without wondering whether it is up to the job.

Context is also where I want to be clear about the limits. Model quality has closed most of the gap with hosted frontier models for the work I do. Context has not. Hosted models now offer a million tokens, enough to hold a mid-sized repository in view at once. Matching that at home means a cache several times the size of the model, on hardware a hobbyist does not buy used. Roughly:

| Context | 8-bit cache | Total VRAM | Hardware that fits | Rough cost | Cold prompt fill at ~1,000 tokens/s |
|---:|---:|---:|---|---:|---:|
| 128K | ~17 GB | ~40 GB | RTX 3090 + RTX 4060 Ti (this machine) | Already paid for | ~2 minutes |
| 256K | ~34 GB | ~57 GB | Two RTX 3090s with a 4-bit cache, or three at 8-bit | $800 to $1,600 more | ~4 minutes |
| 512K | ~68 GB | ~90 GB | Two 48 GB cards (RTX A6000 or 6000 Ada), or one 96 GB RTX PRO 6000 | $6,000 to $9,000 | ~9 minutes |
| 1M | ~136 GB | ~160 GB | Two 96 GB RTX PRO 6000s, or four 48 GB cards | $16,000 to $20,000 | ~17 minutes |
{: .table .table-striped }

The cache figure is about 250 KB per token at 16-bit and half that at 8-bit, derived from what fit on my cards; the `llama-server` startup log prints the exact allocation. Prices are used-market at the time of writing and will not age well. The bottom rows are worse than they look: the model's native context is 256K, and the million-token figure relies on [YaRN](https://arxiv.org/abs/2309.00071) position scaling, which stretches the training rather than extending it. And unlike MoE experts, the cache cannot live in system memory. Every generated token reads all of it, so it has to be on the GPU's memory bus.

The last row is a workstation that costs more than a decent used car, to run a 27B model a hosted service will run for a few dollars an hour with a million tokens of context. That is the honest shape of the tradeoff. The local machine wins on the routine work that fits in 128K, which is most of it, and loses on the long tail.

The next hardware step, if there is one, is a choice between two problems. Replacing the 4060 Ti with a second 3090 gives 48 GB of matched, fast VRAM: generation around 40 tokens per second, an even tensor split, and 256K at 4-bit or about 192K at 8-bit. A used 3090 costs less than half a new card, selling the 4060 Ti covers much of it, and the HX1200 can carry two. Alternatively, 128 GB of system RAM would open up the larger MoE models above this one on the leaderboard, with their experts in system memory and a noticeable step down in speed. That is a bet on quality over responsiveness, and I am not sure yet which I would rather have.

Either way, the pieces from the first post did their job. The clients kept working through a model swap and a hardware change because they only ever knew about an alias and a port. The Quadlet is still the only copy of the configuration, and it is in a file rather than a shell history. Once the next card or the next model arrives, I get to tune it all over again.