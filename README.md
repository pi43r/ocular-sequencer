# Circular Rhythms

A webcam-based MIDI generator prototype.

This project uses the webcam feed as input and applies image modifiers to isolate specific parts. It features one or more virtual lines that trigger MIDI notes whenever a highlighted element passes through them. The rotation speed of the overall image can also be adjusted to create evolving circular rhythms.

## Tech Stack
- **p5.js**: For graphics, webcam integration, and image processing.
- **Bun**: Fast JavaScript runtime and bundler.

## Getting Started

To run the project locally using Bun:

```bash
bun install
bun run dev
```