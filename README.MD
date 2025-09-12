# FlashAnswer - Solve Quizzes with AI

<!-- Badges: Remplacer les placeholders si nécessaire -->
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python Version](https://img.shields.io/badge/Python-3.10+-brightgreen.svg)
![Framework](https://img.shields.io/badge/Framework-FastAPI-009688.svg)

An AI-powered web application that automatically answers Multiple-Choice Questions (MCQs) using your own documents as a knowledge base. Just upload your course notes, take a screenshot of a quiz, and get the answer instantly.

The application runs entirely on your local machine, ensuring your data remains private.


## ✨ Core Features

-   **🧠 Intelligent Answering**: Utilizes a RAG pipeline to find the most relevant information in your documents and generate accurate answers.
-   **📸 Screenshot & Vision API**: Simply take a screenshot of a quiz. The app uses **Google Gemini Vision** to extract the question and options automatically.
-   **✂️ Built-in Screen Capture**: No need for external tools. Capture any part of your screen directly from the web interface.
-   **📚 PDF Knowledge Base**: Easily build a custom knowledge base by dragging and dropping your PDF course materials.
-   **🏠 Local & Private**: Your documents and queries never leave your machine, except for secure calls to the Google Gemini API. No user accounts needed.
-   **🚀 Modern Web Interface**: A clean, simple, and responsive UI built with FastAPI for a smooth user experience.
-   **🔌 RESTful API**: Includes clear endpoints to integrate the solving logic into other applications.

## 🛠️ Tech Stack

-   **Backend**: FastAPI, Uvicorn
-   **AI & Machine Learning**: LangChain, Google Gemini (Vision & Pro), ChromaDB (Vector Store)
-   **Data Processing**: PyMuPDF, Pillow, Tiktoken
-   **Frontend**: Vanilla HTML, CSS, JavaScript
-   **Testing**: Pytest


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
├── tests/
│   └── ...
├── .gitignore
├── LICENSE
├── requirements.txt
└── README.md
```


## 🚀 Getting Started

Follow these steps to get the project running on your local machine.

### 1. Prerequisites

-   Python 3.10+
-   `pip` (Python's package manager)
-   **Google Gemini API Key**: Get one from [Google AI Studio](https://ai.google.dev/).
-   **Modern Web Browser**: Chrome, Firefox, or Edge.

### 2. Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/geoffreyscozzaro31/FlashAnswer.git
    cd QCM-Resolver
    ```

2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

### 3. Configuration

1.  Create a `.env` file in the project root.
2.  Add your Google Gemini API key to it:
    ```
    # .env
    GEMINI_API_KEY="YOUR_SECRET_GEMINI_API_KEY"
    ```
    > **Note**: The `.env.example` file is provided as a template.

### 4. Running the Application

Launch the server from the project's root directory:
```bash
uvicorn src.app.app:app --reload
```
The application is now accessible:
-   **Web Interface**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
-   **API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 5. Running Tests

This project uses `pytest` for unit testing. To run the tests, execute the following command from the root directory:
```bash
pytest
```

## 📱 How to Use

### Step 1: Build Your Knowledge Base
1.  **Add PDF Documents**: Drag and drop your PDF files into the sidebar.
2.  **Select Context**: Click on the uploaded documents to select them as the context for answering questions. You can select multiple documents.
3.  **Manage Documents**: Delete documents you no longer need.

### Step 2: Submit Your MCQ
You have three options:

-   **Upload an Image**: Drag and drop a screenshot file of your MCQ.
-   **Built-in Screen Capture**: Click the "Capture Screen" button, select the area with the MCQ, and confirm.
-   **Paste from Clipboard**: Copy an image to your clipboard and paste it directly.

### Step 3: Get the Answer
The AI will process the image, find relevant information in your selected documents, and display the most likely answer along with the context it used.



## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement". Don't forget to give the project a star!

1.  **Fork the Project**
2.  **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request**

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.


## 🔍 Troubleshooting

-   **API Key Errors**: Ensure your `GEMINI_API_KEY` is correctly set in the `.env` file.
-   **Screen Capture Issues**: Screen capture requires a secure context (localhost or HTTPS) and user permission. If the button is disabled, your browser may not be supported.
-   **Poor Answer Quality**: The quality of the answer depends heavily on the relevance of the information in your PDF documents. Ensure your knowledge base covers the topics of your questions.
