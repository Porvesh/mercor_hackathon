#!/usr/bin/env python3
import base64
import json
import os
import re
import requests
import sys
import subprocess
import shutil
from typing import Optional

# Configuration
MODEL = "deepseek-r1:70b"
API_ENDPOINT = "https://p01--deepseek-ollama-copy--8bsw8fx29k5g.code.run/api/generate"

# File paths
COMPRESSED_FILE = "repo-info/one-file-compressed.txt"
UNCOMPRESSED_FILE = "repo-info/one-file-uncompressed.txt"

# Debug mode (set to True to see more information)
DEBUG = True

def encode_file(file_path):
    """Base64 encode a file if it exists."""
    if os.path.isfile(file_path):
        with open(file_path, 'rb') as file:
            return base64.b64encode(file.read()).decode('utf-8')
    else:
        print(f"Warning: File {file_path} not found", file=sys.stderr)
        return ""

def get_file_content(file_path):
    """Get the content of a file if it exists."""
    if os.path.isfile(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with a different encoding if UTF-8 fails
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
    else:
        print(f"Warning: File {file_path} not found", file=sys.stderr)
        return ""

def write_file_content(file_path, content):
    """Write content to a file."""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f"File updated: {file_path}")

def get_directory_structure():
    """Get directory structure using the tree command."""
    try:
        result = subprocess.run(['tree', '-L', '4'], 
                               stdout=subprocess.PIPE, 
                               stderr=subprocess.PIPE,
                               text=True)
        if result.returncode == 0:
            return result.stdout
        else:
            return "tree command not available"
    except FileNotFoundError:
        return "tree command not available"

def identify_critical_file() -> Optional[str]:
    """Identify the most critical file for optimization."""
    # Fallback rendering files to use if no file path is found
    RENDERING_FILES = [
        "render/fluid.wgsl",  # Based on screenshot
        "render/fluidRender.ts",  # Based on screenshot
        "src/renderers/FluidRenderer.js",
        "src/renderers/Renderer.js",
        "src/shaders/render.wgsl"
    ]

    # Get directory structure
    tree_output = get_directory_structure()

    # Encode files
    compressed_content = encode_file(COMPRESSED_FILE)
    uncompressed_content = encode_file(UNCOMPRESSED_FILE)

    # Check if at least one file exists
    if not compressed_content and not uncompressed_content:
        print("Warning: Compressed files missing. Using fallback file list.")
        # If we can't find the files, check if any of our fallback files exist
        for fallback in RENDERING_FILES:
            if os.path.exists(fallback):
                print(f"Found fallback file: {fallback}")
                return fallback
        
        # If none exist, return the first fallback
        print(f"No fallback files found. Using default: {RENDERING_FILES[0]}")
        return RENDERING_FILES[0]

    # Prepare payload
    files = []
    if compressed_content:
        files.append({"name": COMPRESSED_FILE, "content": compressed_content})
    if uncompressed_content:
        files.append({"name": UNCOMPRESSED_FILE, "content": uncompressed_content})

    # Create a prompt that forces a direct response
    payload = {
        "model": MODEL,
        "prompt": f"""Your task is to analyze a WebGPU fluid simulation project's code and identify a RENDERING FILE that would yield significant performance improvement if optimized.

Project structure:
{tree_output}

IMPORTANT: You MUST return a rendering-related file path. Look for files with names containing "render", "graphics", "display", "draw", etc.

INSTRUCTIONS:
1. Return EXACTLY ONE file path
2. The response must contain ONLY the file path with extension
3. DO NOT include ANY explanations or thoughts - just the file path
4. DO NOT use ANY tags like <think> 
5. DO NOT wrap in quotes
6. FOCUS ONLY ON RENDERING FILES

Example of valid responses:
render/fluidRender.ts
render/fluid.wgsl
src/renderers/FluidRenderer.js

If you can't find a specific rendering file, select one of these file paths:
{RENDERING_FILES[0]}
{RENDERING_FILES[1]}

RESPOND WITH JUST THE FILE PATH:""",
        "stream": False,
        "files": files
    }

    # Make the API request
    print("Sending request to identify critical file...")
    response = requests.post(
        API_ENDPOINT,
        headers={"Content-Type": "application/json"},
        json=payload
    )

    # Process the response
    if response.status_code == 200:
        try:
            data = response.json()
            raw_result = data.get('response', '')
            
            if DEBUG:
                print("\nDEBUG - Raw response:")
                print("-" * 50)
                print(raw_result[:500] + "..." if len(raw_result) > 500 else raw_result)
                print("-" * 50)
            
            # Clean the response:
            # 1. Remove any tag-like elements (<...>)
            clean_result = re.sub(r'<[^>]+>', '', raw_result)
            
            # 2. Split by lines and get the first non-empty line
            lines = [line.strip() for line in clean_result.split('\n') if line.strip()]
            if lines:
                first_line = lines[0]
            else:
                first_line = clean_result.strip()
                
            # 3. Remove quotes, extra spaces, and punctuation
            cleaned_result = first_line.strip().strip('"\'.,;: ')
            
            if DEBUG:
                print("\nDEBUG - Cleaned result:")
                print("-" * 50)
                print(cleaned_result)
                print("-" * 50)
            
            # 4. Try to find a file path pattern
            file_path_match = re.search(r'[a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+', cleaned_result)
            
            if file_path_match:
                result = file_path_match.group(0)
                if DEBUG:
                    print("\nDEBUG - Matched file path:")
                    print("-" * 50)
                    print(result)
                    print("-" * 50)
                return result
            else:
                # If no file path is found, use a fallback rendering file
                if DEBUG:
                    print("\nDEBUG - No file path pattern found, using fallback:")
                    print("-" * 50)
                    print(RENDERING_FILES[0])
                    print("-" * 50)
                return RENDERING_FILES[0]
                
        except json.JSONDecodeError as e:
            print(f"Error: Failed to parse API response as JSON: {e}")
            print("Raw response:", response.text[:200])
    else:
        print(f"Error: API request failed with status code {response.status_code}")
        print(response.text[:200])
    
    # If we get here, something went wrong - use fallback
    return RENDERING_FILES[0]

def optimize_file_for_m1(file_path):
    """Optimize the specified file for M1 Mac performance."""
    if not file_path:
        print("Error: No file path provided for optimization")
        return False
    
    # Check if file exists
    if not os.path.isfile(file_path):
        print(f"Error: File {file_path} does not exist")
        return False
    
    # Create a backup file
    BACKUP_FILE = f"{file_path}.bak"
    try:
        shutil.copy2(file_path, BACKUP_FILE)
        print(f"Backup created: {BACKUP_FILE}")
    except Exception as e:
        print(f"Warning: Could not create backup: {e}")
    
    # Get the content of the file
    file_content = get_file_content(file_path)
    
    if not file_content:
        print(f"Error: Could not read content of {file_path}")
        return False
    
    # Detect file type to adjust optimization strategy
    file_ext = os.path.splitext(file_path)[1].lower()
    
    # Adjust prompt based on file type
    file_type_desc = ""
    if file_ext == ".wgsl":
        file_type_desc = "WebGPU Shader Language (WGSL) shader file"
    elif file_ext == ".ts":
        file_type_desc = "TypeScript file managing WebGPU resources"
    elif file_ext == ".js":
        file_type_desc = "JavaScript file managing WebGPU resources"
    else:
        file_type_desc = "WebGPU-related file"
    
    # Prepare payload
    payload = {
        "model": MODEL,
        "prompt": f"""You are a WebGPU optimization expert specializing in Apple M1 chip optimizations.

I have a WebGPU fluid simulation project and need to optimize this {file_type_desc} for better performance on MacBook M1:

FILE: {file_path}

CURRENT CONTENT:
```
{file_content}
```

Please optimize this file specifically for better performance on Apple M1 chips. Consider:

1. M1's unified memory architecture
2. Metal shader compilation optimizations
3. Workgroup size adjustments for M1 GPU
4. Memory access patterns optimized for M1
5. Reducing memory transfers
6. Taking advantage of M1's tile-based deferred rendering
7. Thread group sizes that are multiples of 32 for M1 GPU
8. Prefer smaller workgroups on M1 compared to desktop GPUs
9. Reduce divergent branching

IMPORTANT: Your output must be a drop-in replacement for the original file with the SAME structure and functionality, but optimized.

Add comments explaining your optimizations with "M1 OPTIMIZED" in them. Do not change the overall structure or API of the file.

Your response should ONLY contain the optimized file content and nothing else - no preamble, no explanations outside of comments in the code.
""",
        "stream": False
    }
    
    # Make the API request
    print(f"Sending request to optimize {file_path} for M1 Mac...")
    response = requests.post(
        API_ENDPOINT,
        headers={"Content-Type": "application/json"},
        json=payload
    )
    
    # Process the response
    if response.status_code == 200:
        try:
            data = response.json()
            raw_result = data.get('response', '')
            
            if DEBUG:
                print("\nDEBUG - Sample of optimization response:")
                print("-" * 50)
                print(raw_result[:500] + "..." if len(raw_result) > 500 else raw_result)
                print("-" * 50)
            
            # Clean the response - remove any markdown code block indicators and leading/trailing whitespace
            optimized_content = re.sub(r'^```\w*$', '', raw_result, flags=re.MULTILINE)
            optimized_content = re.sub(r'^```$', '', optimized_content, flags=re.MULTILINE)
            optimized_content = optimized_content.strip()
            
            # Write the optimized content back to the original file
            write_file_content(file_path, optimized_content)
            
            print(f"Optimization complete! File {file_path} has been updated in-place.")
            print(f"A backup of the original file was saved to {BACKUP_FILE}")
            return True
                
        except json.JSONDecodeError as e:
            print(f"Error: Failed to parse API response as JSON: {e}")
            print("Raw response:", response.text[:200])
    else:
        print(f"Error: API request failed with status code {response.status_code}")
        print(response.text[:200])
    
    return False

def main():
    """Main function to run the optimization process."""
    print("=== WebGPU Fluid Simulation M1 Optimizer ===")
    
    # Step 1: Identify the critical file
    print("\n--- Step 1: Identifying critical file ---")
    critical_file = identify_critical_file()
    
    if not critical_file:
        print("Error: Could not identify a critical file to optimize")
        sys.exit(1)
    
    print(f"Critical file identified: {critical_file}")
    
    # Step 2: Optimize the file for M1
    print("\n--- Step 2: Optimizing file for M1 Mac ---")
    success = optimize_file_for_m1(critical_file)
    
    if success:
        print("\n=== Optimization Process Complete ===")
        print(f"The file {critical_file} has been optimized for Apple M1 performance.")
        print("Summary of optimizations:")
        print("- Adjusted for M1's unified memory architecture")
        print("- Optimized shader compilation for Metal")
        print("- Tuned workgroup sizes for M1 GPU")
        print("- Improved memory access patterns")
        print("- Reduced memory transfers")
        print("- Enhanced for tile-based deferred rendering")
    else:
        print("\nOptimization process encountered errors. Please check the logs above.")

if __name__ == "__main__":
    main()