import os
import asyncio
from anthropic import Anthropic
from tools import execute_tool, get_tool, tool_descriptions

MAX_STEPS = int(os.getenv('AGENT_MAX_STEPS', '5'))
USE_MOCK = not os.getenv('ANTHROPIC_API_KEY')

client = None
if not USE_MOCK:
    client = Anthropic()

sessions = {}


def anthropic_tools():
    """Format tool definitions for Anthropic API."""
    return [
        {
            'name': t['name'],
            'description': t['description'],
            'input_schema': {
                'type': 'object',
                'properties': {
                    k: {'type': 'string', 'description': v}
                    for k, v in t['parameters'].items()
                },
            },
        }
        for t in tool_descriptions()
    ]


async def mock_run(prompt):
    """Simple mock agent using keyword matching."""
    tools_called = []
    steps = []
    lower = prompt.lower()

    if 'order' in lower:
        result = await execute_tool('get_orders')
        tools_called.append('get_orders')
        steps.append({'tool': 'get_orders', 'observation': result})

    if 'user' in lower:
        result = await execute_tool('get_users')
        tools_called.append('get_users')
        steps.append({'tool': 'get_users', 'observation': result})

    if 'pay' in lower:
        result = await execute_tool('create_payment', {
            'amount': 100,
            'currency': 'USD',
            'from': 'user_1',
            'to': 'user_2',
        })
        tools_called.append('create_payment')
        steps.append({'tool': 'create_payment', 'observation': result})

    answer = '[MOCK MODE — no ANTHROPIC_API_KEY set]\n\n'
    if not steps:
        answer += f'I don\'t have a tool that matches your request: "{prompt}"'
    else:
        for s in steps:
            answer += f'Tool: {s["tool"]}\nResult: {str(s["observation"])}\n\n'
        answer += f'Summary: Called {len(tools_called)} tool(s) to fulfil the request.'

    return {
        'answer': answer,
        'steps_taken': len(steps),
        'tools_called': tools_called,
    }


async def claude_run(prompt, context=None):
    """Run agent with Claude using ReAct loop."""
    tools_called = []
    steps = []

    system_prompt = (
        'You are a helpful backend agent. You have access to the following tools to answer questions. '
        'Only use tools when needed. When you have enough information, respond with a final answer.'
    )
    if context:
        system_prompt += f'\n\nAdditional context: {context}'

    messages = [{'role': 'user', 'content': prompt}]

    for step_num in range(MAX_STEPS):
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1024,
            system=system_prompt,
            tools=anthropic_tools(),
            messages=messages,
        )

        tool_use_blocks = [b for b in response.content if b.type == 'tool_use']

        if not tool_use_blocks:
            text_block = next((b for b in response.content if b.type == 'text'), None)
            return {
                'answer': text_block.text if text_block else '(no answer)',
                'steps_taken': len(steps),
                'tools_called': tools_called,
            }

        tool_results = []
        for block in tool_use_blocks:
            tool = get_tool(block.name)
            if not tool:
                tool_results.append({
                    'type': 'tool_result',
                    'tool_use_id': block.id,
                    'content': f'Unknown tool: {block.name}',
                })
                continue

            result = await execute_tool(block.name, block.input)
            tools_called.append(block.name)
            steps.append({'tool': block.name, 'input': block.input, 'observation': result})
            tool_results.append({
                'type': 'tool_result',
                'tool_use_id': block.id,
                'content': str(result),
            })

        messages.append({'role': 'assistant', 'content': response.content})
        messages.append({'role': 'user', 'content': tool_results})

    return {
        'answer': f'Reached maximum steps ({MAX_STEPS}). Partial results collected.',
        'steps_taken': len(steps),
        'tools_called': tools_called,
    }


async def run_agent(task_id, session_id, prompt, context=None):
    """Main entry point for the agent."""
    if session_id not in sessions:
        sessions[session_id] = {'history': []}
    
    session = sessions[session_id]
    session['history'].append({'role': 'user', 'prompt': prompt})

    result = await (mock_run(prompt) if USE_MOCK else claude_run(prompt, context))
    session['history'].append({'role': 'agent', 'answer': result['answer']})

    return result
