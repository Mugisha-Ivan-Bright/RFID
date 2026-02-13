import sys
try:
    import pypdf
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    import pypdf

def extract_text(pdf_path):
    reader = pypdf.PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"
    return full_text

if __name__ == "__main__":
    pdf_path = "Assignment_ RFID Card Top-Up System.pdf"
    try:
        text = extract_text(pdf_path)
        with open("assignment_text.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("[+] Extracted text saved to assignment_text.txt")
    except Exception as e:
        print(f"Error: {e}")
