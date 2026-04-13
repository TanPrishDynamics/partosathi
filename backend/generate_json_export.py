import json
from WHO_PARTOGRAPH_DATASETS import WHO_PARTOGRAPH_DATASETS, export_for_database

# Export to JSON file
with open("WHO_PARTOGRAPH_DATASETS.json", "w") as f:
    f.write(export_for_database())

print("✓ WHO_PARTOGRAPH_DATASETS.json created successfully")
print(f"✓ File size: {len(export_for_database())} bytes")
