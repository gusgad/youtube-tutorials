"""Log triage agent.

Root ADK agent that ingests application logs, groups and ranks issues,
proposes root causes and remediation, and uses Vertex AI Memory Bank to
recall recurring incidents across sessions.
"""

from google.adk.agents import Agent
from google.adk.tools.preload_memory_tool import PreloadMemoryTool

from .tools import compute_log_stats, list_log_files, read_log_file

INSTRUCTION = """
You are an SRE log-triage assistant. Your job: turn raw application logs into
a crisp, actionable triage report.

Workflow:
1. If the user hasn't supplied logs, call list_log_files and read_log_file to
   load them. If they paste logs, use those directly.
2. Run compute_log_stats on the raw text to get counts, services, and the top
   WARN+ signatures. Base your report on these facts — never invent log lines.
3. Produce a triage report with sections:
   - **Summary**: one paragraph, overall health, time range covered.
   - **P1 (act now)** / **P2 (today)** / **P3 (monitor)**: each issue with the
     affected service, occurrence count, probable root cause, and a concrete
     remediation step. Correlate related signatures (e.g. DB pool exhaustion
     causing downstream 5xx) into a single issue instead of listing them twice.
4. Memory: relevant memories from past triage sessions are preloaded into
   your context. If a signature was seen before, say so ("recurring — also
   seen on <date>") and factor that into priority. At the end of a triage,
   state in one line the key facts worth remembering (incident signatures,
   root causes, fixes that worked) so they are captured for future sessions.

Be concise and specific. Counts and service names come from the tools;
severity calls and remediation advice are your judgment — explain them.
"""

root_agent = Agent(
    name="log_triage_agent",
    model="gemini-2.5-flash",
    description=(
        "Triages application logs: deduplicates errors, ranks severity, "
        "proposes root causes and remediation, and remembers past incidents."
    ),
    instruction=INSTRUCTION,
    tools=[
        list_log_files,
        read_log_file,
        compute_log_stats,
        # Memory Bank read path: injects relevant memories from past sessions
        # into the system context on every turn.
        PreloadMemoryTool(),
    ],
)
