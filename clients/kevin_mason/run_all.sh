#!/bin/bash

# Ensure we are in the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Environment Setup
echo "--- Step 1: Setting Java Environment ---"
# Fallback for Java home if the standard command fails
export JAVA_HOME=$(/usr/libexec/java_home -v 25 2>/dev/null || /usr/libexec/java_home)
echo "Using JAVA_HOME: $JAVA_HOME"

# 2. Dependency Check - Explicitly installing to avoid 'requirements.txt' desync
echo -e "\n--- Step 2: Installing Dependencies ---"
python3 -m pip install --upgrade pip --quiet
python3 -m pip install tabula-py pandas pypdf pytest --quiet
echo "Dependencies verified."

# 3. Clean and Run
echo -e "\n--- Step 3: Executing GAAP Extraction ---"
rm -rf output
# We call the script; ensure your extract.py has the if __name__ == "__main__": block!
python3 extract.py

# 4. Final Validation
echo -e "\n--- Step 4: Running Unit Tests ---"
# Calling pytest as a module ensures it uses the same environment as Step 3
python3 -m pytest test_extract.py -q

if [ $? -ne 0 ]; then
    echo -e "\n❌ ERROR: Unit tests failed."
    exit 1
fi

echo -e "\n✅ SUCCESS: All unit tests passed."