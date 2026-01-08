#!/usr/bin/env bash
set -euo pipefail

GEMINI_API_KEY="AIzaSyAzUOeNwzhCPXEn_MZswLjY6ekPPTIJJP4"
MODEL_ID="gemini-2.5-flash-native-audio-preview-12-2025"
API_METHOD="generateContent"

curl -sS -X POST \
  -H "Content-Type: application/json" \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:${API_METHOD}?key=${GEMINI_API_KEY}" \
  -d '{
    "contents":[{"role":"user","parts":[{"text":"Translate the following text to Filipino (Tagalog). Output ONLY the translated text.\n\nText:\nHello! How are you today?"}]}],
    "generationConfig":{"temperature":0.2,"thinkingConfig":{"thinkingBudget":0}}
  }'
