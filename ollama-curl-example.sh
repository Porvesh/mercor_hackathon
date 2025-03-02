#!/bin/bash

# API endpoint
API_ENDPOINT="https://p01--deepseek-ollama-copy--8bsw8fx29k5g.code.run/api/generate"

# Function to encode file to base64
encode_file() {
  if [ -f "$1" ]; then
    base64 -w 0 "$1"
  else
    echo "Warning: File $1 not found" >&2
    echo ""
  fi
}

# Get file paths
COMPRESSED_FILE="repo-info/one-file-compressed.txt"
UNCOMPRESSED_FILE="repo-info/one-file-uncompressed.txt"

# Encode files
COMPRESSED_CONTENT=$(encode_file "$COMPRESSED_FILE")
UNCOMPRESSED_CONTENT=$(encode_file "$UNCOMPRESSED_FILE")

# Check if we have at least one file
if [ -z "$COMPRESSED_CONTENT" ] && [ -z "$UNCOMPRESSED_CONTENT" ]; then
  echo "Error: Both files are missing. Cannot proceed."
  exit 1
fi

# Run tree command to get directory structure
TREE_OUTPUT=$(tree -L 4 2>/dev/null || echo "tree command not available")

# Create a JSON file with performance-focused prompt
cat > request.json << EOF
{
  "model": "deepseek-r1:70b",
  "prompt": "I've given you a compressed format of all the files in a WebGPU fluid simulation project. Here's the project structure from the 'tree' command:\n\n${TREE_OUTPUT}\n\nPlease return ONLY a list of file paths that could be optimized for better performance. Focus on:\n1. GPU shader code and compute pipelines\n2. Memory allocation and buffer management\n3. Particle simulation algorithms\n4. Rendering pipelines\n5. Heavy computational functions\n\nFormat: Just return a list that has full paths, one per line, without any additional explanation.",
  "stream": false,
  "files": [
    {
      "name": "${COMPRESSED_FILE}",
      "content": "${COMPRESSED_CONTENT}"
    },
    {
      "name": "${UNCOMPRESSED_FILE}",
      "content": "${UNCOMPRESSED_CONTENT}"
    }
  ]
}
EOF

echo "Sending request to Ollama API..."

# Make request using the JSON file
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @request.json

echo -e "\nRequest complete."

# Cleanup
rm request.json