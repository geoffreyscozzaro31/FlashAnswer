# QCM Resolver - Automatic MCQ Solver

QCM Resolver is a local web application designed to automatically answer Multiple-Choice Questions (MCQs) from a knowledge base you provide. Simply upload a PDF document containing your course material, then submit screenshots of MCQs to get the correct answer instantly.

The application runs entirely on your machine, ensuring your data's privacy.

## ✨ Features

-   **Intuitive Web Interface**: A simple, two-step web page to load your knowledge and solve MCQs.
-   **PDF Knowledge Ingestion**: Build a knowledge base by dragging and dropping PDF files.
-   **Screenshot-based Solving**: Take a picture of your MCQ, upload it, and let the AI find the answer.
-   **Built-in Screen Capture**: Capture screenshots directly from the web interface with precision area selection.
-   **AI-Powered Vision & RAG**: Uses Google Gemini Vision API to extract questions from images and **Retrieval-Augmented Generation (RAG)** to find the most relevant answers in your documents.
-   **Advanced Text Extraction**: Automatically extracts text from PDFs and analyzes MCQ images using Google Gemini Vision.
-   **Local & Private**: No data is sent to external servers, except for secure calls to the Gemini API. No user accounts are required.
-   **RESTful API**: Two clear endpoints to integrate this logic into other applications if needed.

## 🏗️ Project Architecture

```
QCM_Resolver/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py                      # Endpoints: /process-document and /solve-qcm
│   │   ├── db/
│   │   │   └── chroma/                        # Directory for the ChromaDB database
│   │   ├── service/
│   │   │   ├── document_service.py            # PDF text extraction and embedding
│   │   │   ├── qcm_vision_analysis_service.py # Gemini Vision analysis and RAG logic
│   │   │   └── vector_store_service.py        # Service to interact with ChromaDB
│   │   ├── static/
│   │   │   ├── index.html                     # User interface
│   │   │   ├── script.js                      # Front-end logic
│   │   │   ├── styles.css                     # UI design
│   │   │   └── capture.js                     # Screen capture functionality
│   │   ├── utils/
│   │   │   └── file_utils.py                  # File utility functions
│   │   ├── .env.example                       # Environment variables template
│   │   ├── app.py                             # FastAPI application entry point
│   │   ├── config.py                          # Configuration loader
│   │   └── config.yaml                        # Static parameters (models, etc.)
│   └── __init__.py
├── requirements.txt                           # Python dependencies
└── README.md                                  # This file
```

## 🚀 Getting Started

Follow these steps to install and run the project on your local machine.

### 1. Prerequisites

-   Python 3.10+
-   `pip` (Python's package manager)
-   **Google Gemini API Key**: Required for vision analysis and text generation
-   **Modern Web Browser**: Chrome, Firefox, or Edge with screen capture support

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
    -   Create `.env` file at the folder root add your API key:
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

## 📱 Using the Web Interface

### Step 1: Build Your Knowledge Base
1. **Add PDF Documents**: Drag and drop PDF files into the sidebar or click to browse
2. **Select Context**: Click on uploaded documents to select them as context for answering questions
3. **Manage Documents**: Delete documents you no longer need with the × button

### Step 2: Submit Your MCQ
You have three options to submit a multiple-choice question:

#### Option A: Upload an Image File
- Drag and drop an image file (PNG, JPG, JPEG) containing your MCQ
- Or click the upload area to browse for a file

#### Option B: Built-in Screen Capture
1. **Click "Capturer l'écran" (Capture Screen)** button
2. **Grant Permission**: Your browser will ask for screen sharing permission
3. **Select Screen/Window**: Choose which screen or application window to capture
4. **Select Area**: After capture, an interface will appear showing your screenshot
5. **Draw Selection**: Click and drag to select the specific area containing your MCQ
6. **Confirm**: Click "Confirmer" to crop and submit the selected area, or "Annuler" to cancel

#### Option C: Paste from Clipboard
- Copy an image to your clipboard and paste it directly into the upload area

### Step 3: Get Your Answer
The application will:
1. Extract the question text from your image using AI vision
2. Search through your selected documents for relevant information
3. Provide the most likely answer based on your knowledge base
4. Show the context used to determine the answer

## 🔧 Screen Capture Requirements

The built-in screen capture feature requires:
- **Modern Browser**: Chrome 72+, Firefox 66+, or Edge 79+
- **HTTPS or Localhost**: Screen capture APIs only work on secure connections
- **User Permission**: Your browser will prompt for screen sharing permission
- **Active Content**: The content you want to capture must be visible on screen

**Note**: If screen capture is not supported in your browser, the capture button will be automatically disabled.

## ⚙️ API Usage

You can interact directly with the API via the Swagger documentation or a tool like `curl`.

### Endpoint: `POST /api/process-document`

This endpoint processes a PDF file to create the knowledge base.

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

This endpoint analyzes an MCQ image using Gemini Vision and returns the answer found in the knowledge base using RAG.

**Parameters:**
- `file`: Image file containing the MCQ (PNG, JPG, JPEG)
- `context_ids`: JSON array of document IDs to use as context (optional, defaults to all documents)

**Example with `curl`:**
```bash
curl -X POST "http://127.0.0.1:8000/api/solve-qcm" \
     -F "file=@/path/to/your/screenshot.png" \
     -F "context_ids=[\"doc_id_1\", \"doc_id_2\"]"
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
  "retrieved_context": "FastAPI is a modern, fast (high-performance) web framework for building APIs with Python 3.7+...",
  "timings": {
    "vision_time": 2.45,
    "rag_time": 0.32,
    "answer_time": 1.18,
    "total_time": 3.95
  }
}
```

### Additional Endpoints

#### `GET /api/documents`
List all processed documents in the knowledge base.

#### `DELETE /api/documents/{doc_id}`
Delete a specific document and its embeddings from the knowledge base.

## 🔍 Troubleshooting

### Screen Capture Issues
- **Permission Denied**: Make sure to allow screen sharing when prompted by your browser
- **Capture Button Disabled**: Your browser may not support screen capture APIs
- **Selection Too Small**: Make sure your selection rectangle is at least 10x10 pixels
- **Blurry Capture**: Ensure your display scaling is set to 100% for best results

### General Issues
- **API Key Errors**: Verify your `GEMINI_API_KEY` is correctly set in the `.env` file
- **PDF Processing Fails**: Check that your PDF is not password protected or corrupted
- **Poor Answer Quality**: Ensure your knowledge base contains relevant information for the questions
- **Slow Performance**: Large PDFs may take time to process; consider splitting them into smaller section