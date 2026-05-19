import sys
import json
import os

# LangChain imports
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    ext = os.path.splitext(file_path)[1].lower()
    print(f"[Parser] Processing file: {file_path} with extension: {ext}", file=sys.stderr)

    try:
        # 1. Select the appropriate LangChain Loader
        if ext == ".pdf":
            # PyPDFLoader automatically extracts layout text and tracks page numbers in metadata
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            print(f"[Parser] PDF loaded with {len(docs)} pages.", file=sys.stderr)
        else:
            # TextLoader handles txt, md, etc.
            loader = TextLoader(file_path, encoding="utf-8")
            docs = loader.load()

        # 2. Configure the LangChain Text Splitter
        # This replaces your custom recursive_split_text function.
        # It intelligently splits on paragraphs, then sentences, then words to preserve semantic structure.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200,
            chunk_overlap=150,
            length_function=len
        )

        # 3. Split the loaded documents
        split_docs = text_splitter.split_documents(docs)

        # 4. Format into the desired JSON output schema
        final_elements = []
        for doc in split_docs:
            # LangChain tracks original source details in the metadata dictionary
            # PyPDFLoader indexes pages starting at 0, so we add 1 to match your original logic.
            page_number = doc.metadata.get("page", 0) + 1 if ext == ".pdf" else 1
            
            # Simple, heuristic fallback category assignment
            text_clean = doc.page_content.strip()
            category = "NarrativeText"
            
            if ext == ".pdf":
                if text_clean.startswith(("#", "Step", "Section", "Chapter")):
                    category = "Title"
                elif "|" in text_clean or "  " in text_clean:
                    category = "Table"
            else:
                if text_clean.startswith("```"):
                    category = "CodeBlock"
                elif text_clean.startswith(("#", "- ", "* ")):
                    category = "ListItem"

            final_elements.append({
                "type": category,
                "text": text_clean,
                "pageNumber": page_number
            })

        # Output final structural JSON to stdout
        print(json.dumps(final_elements))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()