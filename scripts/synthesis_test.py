import requests
import os
from dotenv import load_dotenv

# load_dotenv()

def test_synthesis(text="Hello, Orbit is ready.", voice_id="dda33d93-9f12-4a59-806e-a98279ebf050"):
    api_key = os.getenv("CARTESIA_API_KEY")
    if not api_key:
        print("Error: CARTESIA_API_KEY not found in environment.")
        return

    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "Cartesia-Version": "2025-04-16",
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "model_id": "sonic-3-latest",
        "transcript": text,
        "voice": {
            "mode": "id",
            "id": voice_id
        },
        "output_format": {
            "container": "wav",
            "encoding": "pcm_f32le",
            "sample_rate": 44100
        }
    }

    print(f"Sending synthesis request for: '{text}'...")
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        # Save to file for verification
        with open("test_output.wav", "wb") as f:
            f.write(response.content)
        
        print(f"Success! Audio saved to test_output.wav ({len(response.content)} bytes)")
    except Exception as e:
        print(f"Synthesis failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Details: {e.response.text}")

if __name__ == "__main__":
    # Manually setting keys for local test if .env.local isn't loaded by load_dotenv standard
    # In this environment, we should read from the existing .env.local or just set it.
    # I'll assume the environment has it or provided in subsequent steps.
    test_synthesis()
