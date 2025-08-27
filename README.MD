# QCM Resolver - Automatic MCQ Solver

QCM Resolver is a local web application designed to automatically answer Multiple-Choice Questions (MCQs) from a knowledge base you provide. Simply upload a PDF document containing your course material, then submit screenshots of MCQs to get the correct answer instantly.

The application runs entirely on your machine, ensuring your data's privacy.

## ✨ Features

-   **Intuitive Web Interface**: A simple, two-step web page to load your knowledge and solve MCQs.
-   **PDF Knowledge Ingestion**: Build a knowledge base by dragging and dropping a single PDF file.
-   **Screenshot-based Solving**: Take a picture of your MCQ, upload it, and let the AI find the answer.
-   **AI-Powered (RAG)**: Uses a **Retrieval-Augmented Generation (RAG)** technique with Google Gemini to find the most relevant answers in your documents.
-   **Built-in OCR**: Automatically extracts text from PDFs and MCQ images using an OCR engine.
-   **Local & Private**: No data is sent to external servers, except for secure calls to the Gemini API. No user accounts are required.
-   **RESTful API**: Two clear endpoints to integrate this logic into other applications if needed.

## 🏗️ Project Architecture

```
QCM_Resolver/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py                  # Endpoints: /process-document and /solve-qcm
│   │   ├── db/
│   │   │   └── chroma/                    # Directory for the ChromaDB database
│   │   ├── service/
│   │   │   ├── document_service.py        # PDF OCR and embedding
│   │   │   ├── qcm_analysis_service.py    # Screenshot OCR and RAG logic
│   │   │   └── vector_store_service.py    # Service to interact with ChromaDB
│   │   ├── static/
│   │   │   ├── index.html                 # User interface
│   │   │   ├── script.js                  # Front-end logic
│   │   │   └── styles.css                 # UI design
│   │   ├── utils/
│   │   │   └── file_utils.py              # File utility functions
│   │   ├── .env.example                   # Environment variables template
│   │   ├── app.py                         # FastAPI application entry point
│   │   ├── config.py                      # Configuration loader
│   │   └── config.yaml                    # Static parameters (models, etc.)
│   └── __init__.py
├── requirements.txt                       # Python dependencies
└── README.md                              # This file
```

## 🚀 Getting Started

Follow these steps to install and run the project on your local machine.

### 1. Prerequisites

-   Python 3.10+
-   `pip` (Python's package manager)
-   **Tesseract OCR**: This is a **mandatory** prerequisite for the OCR to work.
    -   **Windows**: Download and install from the [official installer](https://github.com/UB-Mannheim/tesseract/wiki). Make sure to add Tesseract to your system's PATH during installation.
    -   **macOS**: `brew install tesseract`
    -   **Linux (Debian/Ubuntu)**: `sudo apt update && sudo apt install tesseract-ocr`

### 2. Installation

1.  **Clone the repository** (if the project is on Git) or unzip the files into a folder.
    ```bash
    git clone https://your-repo-url.git
    cd QCM_Resolver
    ```

2.  **Create and activate a virtual environment** (recommended).
    ```bash
    # Create the environment
    python -m venv venv

    # Activate on Windows
    .\venv\Scripts\activate

    # Activate on macOS/Linux
    source venv/bin/activate
    ```

3.  **Install the Python dependencies**.
    ```bash
    pip install -r requirements.txt
    ```

### 3. Configuration

1.  **Environment File (`.env`)**
    This file will hold your Google Gemini API key.
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your API key:
    ```
    # .env
    GEMINI_API_KEY="YOUR_SECRET_GEMINI_API_KEY"
    ```

2.  **Configuration File (`config.yaml`)** (Optional)
    You can adjust the LLM models or collection names in `src/app/config.yaml` if needed, but the default configuration is ready to use.

### 4. Running the Application

Once the installation and configuration are complete, launch the Uvicorn server from the root of the `QCM_Resolver` project.

```bash
uvicorn src.app.app:app --reload
```
The `--reload` flag is useful for development, as the server will automatically restart after any code changes.

The application is now accessible:
-   **Web Interface**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
-   **API Documentation (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## ⚙️ API Usage

You can interact directly with the API via the Swagger documentation or a tool like `curl`.

### Endpoint: `POST /api/process-document`

This endpoint processes a PDF file to create the knowledge base. **Note: each call to this endpoint will clear the previous knowledge base.**

**Example with `curl`:**
```bash
curl -X POST "http://127.0.0.1:8000/api/process-document" \
     -F "file=@/path/to/your/course.pdf"
```

**Success Response:**
```json
{
  "message": "Document processed successfully. 152 chunks added to the knowledge base."
}
```

### Endpoint: `POST /api/solve-qcm`

This endpoint analyzes an MCQ image and returns the answer found in the knowledge base.

**Example with `curl`:**
```bash
curl -X POST "http://127.0.0.1:8000/api/solve-qcm" \
     -F "file=@/path/to/your/screenshot.png"
```

**Success Response:**
```json
{
  "extracted_question": "What is the main function of FastAPI?",
  "options": [
    "Interacting with databases",
    "Creating high-performance web APIs",
    "Managing the front-end",
    "Compiling Python code"
  ],
  "answer": "Creating high-performance web APIs",
  "retrieved_context": "FastAPI is a modern, fast (high-performance) web framework for building APIs with Python 3.7+..."
}
```