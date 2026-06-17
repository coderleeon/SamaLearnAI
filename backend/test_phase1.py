"""Unit tests for Phase 1 backend components using unittest and mock."""

import unittest
from unittest.mock import MagicMock, patch, mock_open

# Import system under test
from backend.parsers.pdf_parser import parse_pdf
from backend.rag.chunker import chunk_pages
from backend.rag.embedder import embed_texts, embed_query
from backend.rag.retriever import retrieve_chunks, store_chunks
from backend.agents.learning_graph import learning_graph, _build_citation_label, generate_answer


class TestPDFParser(unittest.TestCase):
    @patch("fitz.open")
    def test_parse_pdf_success(self, mock_fitz_open):
        # Setup mock document and page
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_page.get_text.return_value = "  This is page 1 content.  "
        mock_doc.__len__.return_value = 1
        mock_doc.__getitem__.return_value = mock_page
        mock_fitz_open.return_value = mock_doc

        result = parse_pdf(b"dummy_bytes", "test.pdf")

        mock_fitz_open.assert_called_once_with(stream=b"dummy_bytes", filetype="pdf")
        mock_doc.close.assert_called_once()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["content"], "This is page 1 content.")
        self.assertEqual(result[0]["metadata"]["filename"], "test.pdf")
        self.assertEqual(result[0]["metadata"]["page_number"], 1)
        self.assertEqual(result[0]["metadata"]["total_pages"], 1)
        self.assertEqual(result[0]["metadata"]["source_type"], "pdf")

    @patch("fitz.open")
    def test_parse_pdf_empty_page(self, mock_fitz_open):
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_page.get_text.return_value = "   "  # Empty page
        mock_doc.__len__.return_value = 1
        mock_doc.__getitem__.return_value = mock_page
        mock_fitz_open.return_value = mock_doc

        result = parse_pdf(b"dummy_bytes", "test.pdf")
        self.assertEqual(len(result), 0)


class TestChunker(unittest.TestCase):
    def test_chunk_pages_preserves_metadata(self):
        pages = [
            {
                "content": "This is a long sentence that will be chunked. And here is another sentence to fill up space.",
                "metadata": {"filename": "test.pdf", "page_number": 1, "source_type": "pdf"}
            }
        ]
        # Set small chunk size to force splitting
        chunks = chunk_pages(pages, chunk_size=30, chunk_overlap=5)

        self.assertGreater(len(chunks), 1)
        for i, chunk in enumerate(chunks):
            self.assertIn("content", chunk)
            self.assertEqual(chunk["metadata"]["filename"], "test.pdf")
            self.assertEqual(chunk["metadata"]["page_number"], 1)
            self.assertEqual(chunk["metadata"]["source_type"], "pdf")
            self.assertEqual(chunk["metadata"]["chunk_index"], i)

    def test_chunk_pages_skips_short(self):
        pages = [
            {
                "content": "short",  # < 20 chars
                "metadata": {"filename": "test.pdf", "page_number": 1, "source_type": "pdf"}
            }
        ]
        chunks = chunk_pages(pages)
        self.assertEqual(len(chunks), 0)


class TestEmbedder(unittest.TestCase):
    @patch("backend.rag.embedder._get_client")
    @patch("backend.rag.embedder.get_settings")
    def test_embed_texts_batched(self, mock_settings, mock_get_client):
        # Setup settings and client mock
        mock_settings.return_value.GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
        mock_client = MagicMock()
        mock_response = MagicMock()
        
        # Mocking values for embedding return
        mock_emb_1 = MagicMock()
        mock_emb_1.values = [0.1, 0.2, 0.3]
        mock_emb_2 = MagicMock()
        mock_emb_2.values = [0.4, 0.5, 0.6]
        
        mock_response.embeddings = [mock_emb_1, mock_emb_2]
        mock_client.models.embed_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        texts = ["text1", "text2"]
        result = embed_texts(texts, batch_size=2)

        self.assertEqual(result, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
        mock_client.models.embed_content.assert_called_once_with(
            model="gemini-embedding-001",
            contents=texts
        )

    @patch("backend.rag.embedder.embed_texts")
    def test_embed_query(self, mock_embed_texts):
        mock_embed_texts.return_value = [[0.1, 0.2, 0.3]]
        result = embed_query("hello")
        self.assertEqual(result, [0.1, 0.2, 0.3])
        mock_embed_texts.assert_called_once_with(["hello"])


class TestRetriever(unittest.TestCase):
    @patch("backend.rag.retriever.embed_query")
    @patch("backend.rag.retriever.get_supabase_client")
    @patch("backend.rag.retriever.get_settings")
    def test_retrieve_chunks(self, mock_settings, mock_supabase, mock_embed_query):
        # Setup mocks
        mock_settings.return_value.RETRIEVAL_TOP_K = 5
        mock_settings.return_value.RETRIEVAL_THRESHOLD = 0.3
        mock_embed_query.return_value = [0.1, 0.2, 0.3]
        
        mock_client = MagicMock()
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"id": "chunk-1", "content": "hello content"}]
        mock_client.rpc.return_value = mock_rpc
        mock_supabase.return_value = mock_client

        result = retrieve_chunks("test query", "session-123")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "chunk-1")
        mock_client.rpc.assert_called_once_with(
            "match_chunks",
            {
                "query_embedding": [0.1, 0.2, 0.3],
                "filter_session_id": "session-123",
                "match_count": 5,
                "match_threshold": 0.3,
            }
        )

    @patch("backend.rag.retriever.get_supabase_client")
    def test_store_chunks(self, mock_supabase):
        mock_client = MagicMock()
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_supabase.return_value = mock_client

        chunks = [
            {"content": "c1", "metadata": {"page": 1}},
            {"content": "c2", "metadata": {"page": 2}}
        ]
        embeddings = [
            [0.1, 0.2],
            [0.3, 0.4]
        ]

        stored = store_chunks("source-123", chunks, embeddings)

        self.assertEqual(stored, 2)
        mock_client.table.assert_called_once_with("chunks")
        mock_table.insert.assert_called_once()


class TestCitationsLabel(unittest.TestCase):
    def test_pdf_label(self):
        meta = {"page_number": 5}
        label = _build_citation_label("pdf", "Lesson1.pdf", meta)
        self.assertEqual(label, "Lesson1.pdf, Page 5")

    def test_youtube_label(self):
        meta = {"timestamp": "02:35"}
        label = _build_citation_label("youtube", "Lec 1", meta)
        self.assertEqual(label, "Lec 1, at 02:35")

    def test_website_label(self):
        meta = {"section_title": "Introduction"}
        label = _build_citation_label("website", "Documentation", meta)
        self.assertEqual(label, "Documentation, Section: Introduction")


class TestGenerateAnswer(unittest.TestCase):
    @patch("backend.agents.learning_graph.get_settings")
    @patch("backend.agents.learning_graph._get_genai_client")
    def test_generate_answer_gemini(self, mock_get_genai_client, mock_get_settings):
        # Setup settings to NOT have OpenRouter key
        mock_settings = MagicMock()
        mock_settings.OPENROUTER_API_KEY = None
        mock_settings.GEMINI_CHAT_MODEL = "gemini-2.5-flash"
        mock_get_settings.return_value = mock_settings

        # Mock the Gemini client response
        mock_client = MagicMock()
        mock_chunk_1 = MagicMock()
        mock_chunk_1.text = "Hello "
        mock_chunk_2 = MagicMock()
        mock_chunk_2.text = "world!"
        mock_client.models.generate_content_stream.return_value = [mock_chunk_1, mock_chunk_2]
        mock_get_genai_client.return_value = mock_client

        # Call generate_answer
        tokens = []
        def callback(t):
            tokens.append(t)

        state = {
            "context": "Context content",
            "chat_history": [{"role": "user", "content": "hi"}],
            "user_message": "hello",
            "stream_callback": callback
        }

        result = generate_answer(state)

        # Assert result and callback
        self.assertEqual(result, {"answer": "Hello world!"})
        self.assertEqual(tokens, ["Hello ", "world!"])
        mock_client.models.generate_content_stream.assert_called_once()

    @patch("backend.agents.learning_graph.get_settings")
    @patch("httpx.Client")
    def test_generate_answer_openrouter(self, mock_httpx_client_class, mock_get_settings):
        # Setup settings to HAVE OpenRouter API Key
        mock_settings = MagicMock()
        mock_settings.OPENROUTER_API_KEY = "sk-or-test-key"
        mock_settings.OPENROUTER_CHAT_MODEL = "google/gemini-2.5-flash"
        mock_get_settings.return_value = mock_settings

        # Mock httpx stream client context manager
        mock_client_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        
        # Generator for streaming lines (SSE format)
        lines = [
            'data: {"choices": [{"delta": {"content": "Open"}}]}',
            'data: {"choices": [{"delta": {"content": "Router"}}]}',
            'data: [DONE]'
        ]
        mock_response.iter_lines.return_value = lines

        
        # Set up nested context managers for httpx:
        # client.stream("POST", ...) -> response context manager
        mock_stream_ctx = MagicMock()
        mock_stream_ctx.__enter__.return_value = mock_response
        mock_client_instance.stream.return_value = mock_stream_ctx
        
        # client context manager
        mock_httpx_client_class.return_value.__enter__.return_value = mock_client_instance

        # Call generate_answer
        tokens = []
        def callback(t):
            tokens.append(t)

        state = {
            "context": "Context content",
            "chat_history": [],
            "user_message": "hello",
            "stream_callback": callback
        }

        result = generate_answer(state)

        # Assert result and callback
        self.assertEqual(result, {"answer": "OpenRouter"})
        self.assertEqual(tokens, ["Open", "Router"])


class TestLearningGraph(unittest.TestCase):
    def test_graph_compiles(self):
        self.assertIsNotNone(learning_graph)
        # Ensure the nodes and edges structure is intact
        self.assertIn("load_history", learning_graph.nodes)
        self.assertIn("retrieve", learning_graph.nodes)
        self.assertIn("build_context", learning_graph.nodes)
        self.assertIn("generate_answer", learning_graph.nodes)
        self.assertIn("format_citations", learning_graph.nodes)
        self.assertIn("save_messages", learning_graph.nodes)


if __name__ == "__main__":
    unittest.main()
