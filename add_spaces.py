"""
Add spaces between Chinese and English characters in a file.
"""

import re
import sys

# Get the file path from the command line arguments
if len(sys.argv) < 2:
    print("Please provide a file path as an argument")
    sys.exit(1)
file_path = sys.argv[1]

# Open the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add a space between Chinese and English characters
content = re.sub(r'([\u4e00-\u9fa5])([a-zA-Z])', r'\1 \2', content)
content = re.sub(r'([a-zA-Z])([\u4e00-\u9fa5])', r'\1 \2', content)

# Write the modified content to a new file
with open('result.md', 'w', encoding='utf-8') as f:
    f.write(content)