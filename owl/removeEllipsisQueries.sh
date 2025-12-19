#!/bin/bash

STRING_TO_REMOVE="ellipsis_queries"
FILE="./initScripts/1_owlDbDump.sql"

# Check if file exists
if [ ! -f "$FILE" ]; then
    echo "File not found: $FILE"
    exit 1
fi

# Remove lines containing the string and save to a temporary file
TEMP_FILE=$(mktemp)
grep -v "$STRING_TO_REMOVE" "$FILE" > "$TEMP_FILE"

# Overwrite the original file with the filtered content
mv "$TEMP_FILE" "$FILE"
chmod 664 "$FILE"
