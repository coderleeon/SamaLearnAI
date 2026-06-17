"""Unit tests for Phase 3 course planning backend components."""

import unittest
from unittest.mock import MagicMock, patch

from backend.agents.course_graph import (
    course_graph,
    route_message,
    gather_requirements,
    router_edge,
)

class TestCourseGraphWorkflow(unittest.TestCase):
    def test_graph_compiles(self):
        """Verify the Course Planning LangGraph is registered and compiled correctly."""
        self.assertIsNotNone(course_graph)
        self.assertIn("load_state", course_graph.nodes)
        self.assertIn("route_message", course_graph.nodes)
        self.assertIn("gather_requirements", course_graph.nodes)
        self.assertIn("ask_clarifying_question", course_graph.nodes)
        self.assertIn("generate_plan", course_graph.nodes)
        self.assertIn("refine_plan", course_graph.nodes)
        self.assertIn("save_state", course_graph.nodes)

    def test_route_message_gather(self):
        """Should route to gather requirements if no plan exists and user is not asking to generate."""
        state = {
            "plan": {},
            "user_message": "I want to teach Python"
        }
        res = route_message(state)
        self.assertEqual(res["next_action"], "gather")

    def test_route_message_generate_keywords(self):
        """Should route to generate if user types explicit generate/build keywords."""
        state1 = {
            "plan": {},
            "user_message": "please generate the course plan now!"
        }
        res1 = route_message(state1)
        self.assertEqual(res1["next_action"], "generate")

        state2 = {
            "plan": {},
            "user_message": "create plan with standard goals"
        }
        res2 = route_message(state2)
        self.assertEqual(res2["next_action"], "generate")

    def test_route_message_refine(self):
        """Should route to refine plan if plan already exists in state."""
        state = {
            "plan": {"course_title": "Python 101", "modules": []},
            "user_message": "Add a project to module 1"
        }
        res = route_message(state)
        self.assertEqual(res["next_action"], "refine")

    def test_router_edge_conditions(self):
        """Verify conditional router mapping logic is correct."""
        self.assertEqual(router_edge({"next_action": "generate"}), "generate_plan")
        self.assertEqual(router_edge({"next_action": "refine"}), "refine_plan")
        self.assertEqual(router_edge({"next_action": "gather"}), "ask_clarifying_question")
        self.assertEqual(router_edge({}), "ask_clarifying_question")

    @patch("backend.agents.course_graph._call_llm_non_stream")
    def test_gather_requirements_extraction(self, mock_llm):
        """Check requirements parsing and merging of extracted JSON updates."""
        mock_llm.return_value = '{"subject": "Data Science", "audience": "Freshmen", "ready_to_generate": false}'
        state = {
            "user_message": "I want to teach Data Science to Freshmen.",
            "requirements": {"subject": None, "audience": None, "skill_level": "Beginner"},
            "chat_history": []
        }
        res = gather_requirements(state)
        self.assertEqual(res["requirements"]["subject"], "Data Science")
        self.assertEqual(res["requirements"]["audience"], "Freshmen")
        self.assertEqual(res["requirements"]["skill_level"], "Beginner")
        self.assertEqual(res["next_action"], "gather")


if __name__ == "__main__":
    unittest.main()
