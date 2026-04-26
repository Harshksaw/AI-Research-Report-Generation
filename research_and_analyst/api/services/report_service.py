import uuid
import json
from typing import AsyncGenerator
from research_and_analyst.utils.model_loader import ModelLoader
from research_and_analyst.workflows.report_generator_workflow import AutonomousReportGenerator
from research_and_analyst.logger import GLOBAL_LOGGER
from research_and_analyst.exception.custom_exception import ResearchAnalystException


class ReportService:
    _WRITING_NODES = frozenset({"write_report", "write_introduction", "write_conclusion"})
    _PARENT_NODES = frozenset({
        "create_analyst", "human_feedback", "conduct_interview",
        "write_report", "write_introduction", "write_conclusion", "finalize_report",
    })

    def __init__(self, checkpointer):
        self.llm = ModelLoader().load_llm()
        self.reporter = AutonomousReportGenerator(self.llm)
        self.reporter.memory = checkpointer
        self.graph = self.reporter.build_graph()
        self.logger = GLOBAL_LOGGER.bind(module="ReportService")

    @staticmethod
    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    async def astream_report_generation(self, topic: str, max_analysts: int, thread_id: str) -> AsyncGenerator[str, None]:
        thread = {"configurable": {"thread_id": thread_id}}
        self.logger.info("Streaming report pipeline", topic=topic, thread_id=thread_id)
        yield self._sse({"type": "thread_id", "thread_id": thread_id})
        try:
            async for chunk in self.graph.astream(
                {"topic": topic, "max_analysts": max_analysts},
                thread,
                stream_mode=["updates", "messages"],
            ):
                mode, data = chunk
                if mode == "updates":
                    for node_name in data:
                        if node_name in self._PARENT_NODES:
                            yield self._sse({"type": "node_complete", "node": node_name})
                elif mode == "messages":
                    msg_chunk, metadata = data
                    node_name = metadata.get("langgraph_node", "")
                    if node_name in self._WRITING_NODES:
                        content = getattr(msg_chunk, "content", "")
                        if isinstance(content, list):
                            content = "".join(
                                b.get("text", "") if isinstance(b, dict) else str(b)
                                for b in content
                            )
                        if content:
                            yield self._sse({"type": "token", "node": node_name, "content": content})

            state = await self.graph.aget_state(thread)
            if state.next and "human_feedback" in state.next:
                yield self._sse({"type": "interrupt"})
            else:
                yield self._sse({"type": "complete"})
        except Exception as e:
            self.logger.error("Error streaming report generation", error=str(e))
            yield self._sse({"type": "error", "message": str(e)})

    async def astream_feedback(self, thread_id: str, feedback: str) -> AsyncGenerator[str, None]:
        thread = {"configurable": {"thread_id": thread_id}}
        await self.graph.aupdate_state(thread, {"human_analyst_feedback": feedback}, as_node="human_feedback")
        self.logger.info("Streaming feedback processing", thread_id=thread_id)
        try:
            async for chunk in self.graph.astream(
                None,
                thread,
                stream_mode=["updates", "messages"],
            ):
                mode, data = chunk
                if mode == "updates":
                    for node_name in data:
                        if node_name in self._PARENT_NODES:
                            yield self._sse({"type": "node_complete", "node": node_name})
                elif mode == "messages":
                    msg_chunk, metadata = data
                    node_name = metadata.get("langgraph_node", "")
                    if node_name in self._WRITING_NODES:
                        content = getattr(msg_chunk, "content", "")
                        if isinstance(content, list):
                            content = "".join(
                                b.get("text", "") if isinstance(b, dict) else str(b)
                                for b in content
                            )
                        if content:
                            yield self._sse({"type": "token", "node": node_name, "content": content})

            yield self._sse({"type": "complete"})
        except Exception as e:
            self.logger.error("Error streaming feedback", error=str(e))
            yield self._sse({"type": "error", "message": str(e)})

    async def get_report_status(self, thread_id: str):
        try:
            thread = {"configurable": {"thread_id": thread_id}}
            state = await self.graph.aget_state(thread)
            final_report = state.values.get("final_report")
            topic = state.values.get("topic", "AI_Report")

            if final_report:
                file_docx = self.reporter.save_report(final_report, topic, "docx")
                file_pdf = self.reporter.save_report(final_report, topic, "pdf")
                return {
                    "status": "completed",
                    "content": final_report,
                    "docx_path": file_docx,
                    "pdf_path": file_pdf,
                }
            return {"status": "in_progress"}
        except Exception as e:
            self.logger.error("Error fetching report status", error=str(e))
            raise ResearchAnalystException("Failed to fetch report status", e)
