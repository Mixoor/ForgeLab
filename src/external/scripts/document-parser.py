import sys
import json
import os
from unstructured.partition.auto import partition

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path parameter"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        # Run layout partitioning natively
        elements = partition(filename=file_path)
        
        output = []
        for el in elements:
            # Extract metadata safely
            metadata = el.metadata.to_dict() if hasattr(el, 'metadata') else {}
            page_number = metadata.get("page_number", 1)
            
            output.append({
                "type": el.category,       # "Title", "Table", "NarrativeText", etc.
                "text": str(el),
                "pageNumber": page_number
            })

        # Send clean JSON back to the Node process stdout stream
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()