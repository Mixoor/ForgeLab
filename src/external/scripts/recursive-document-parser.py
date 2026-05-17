import sys
import json
import os
from pypdf import PdfReader

def recursive_split_text(text, max_size=1000, overlap=150):
    """Fallback splitter to keep massive paragraphs bounded."""
    if len(text) <= max_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += max_size - overlap
    return chunks

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        final_elements = []

        if ext == ".pdf":
            reader = PdfReader(file_path)
            for page_idx, page in enumerate(reader.pages):
                # Using pypdf's layout-preserving extraction mode 
                # to keep table spaces and headers structurally aligned
                page_text = page.extract_text(extraction_mode="layout") or ""
                
                # Split roughly by paragraphs or double newlines first (Semantic boundary)
                paragraphs = page_text.split("\n\n")
                
                for para in paragraphs:
                    para_cleaned = para.trim() if hasattr(para, 'trim') else para.strip()
                    if len(para_cleaned) < 10:
                        continue
                        
                    # Determine type contextually
                    category = "NarrativeText"
                    if para_cleaned.startswith(("#", "Step", "Section", "Chapter")):
                        category = "Title"
                    elif "|" in para_cleaned or "  " in para_cleaned: # Basic table/matrix detection
                        category = "Table"

                    # Fallback recursive chunking if the individual element is too large
                    sub_chunks = recursive_split_text(para_cleaned, max_size=1200)
                    for sub_chunk in sub_chunks:
                        final_elements.append({
                            "type": category,
                            "text": sub_chunk,
                            "pageNumber": page_idx + 1
                        })
        else:
            # Handle text/markdown natively
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Simple structural split by markdown layout blocks
            blocks = content.split("\n\n")
            for block in blocks:
                block_clean = block.strip()
                if not block_clean:
                    continue
                
                category = "NarrativeText"
                if block_clean.startswith("```"):
                    category = "CodeBlock"
                elif block_clean.startswith(("#", "- ", "* ")):
                    category = "ListItem"

                sub_chunks = recursive_split_text(block_clean, max_size=1200)
                for sub_chunk in sub_chunks:
                    final_elements.append({
                        "type": category,
                        "text": sub_chunk,
                        "pageNumber": 1
                    })

        print(json.dumps(final_elements))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()