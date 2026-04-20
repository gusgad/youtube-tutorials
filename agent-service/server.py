import asyncio
import os
from fastapi import FastAPI, HTTPException
from runtime import run_agent
import uvicorn

app = FastAPI()
PORT = int(os.getenv('AGENT_PORT', '4000'))


@app.post('/agent/run')
async def agent_run(payload: dict):
    """Endpoint to run the agent."""
    task_id = payload.get('task_id')
    session_id = payload.get('session_id')
    prompt = payload.get('prompt')
    context = payload.get('context')
    
    if not task_id or not session_id or not prompt:
        raise HTTPException(
            status_code=400,
            detail='Missing required fields: task_id, session_id, prompt',
        )
    
    try:
        result = await run_agent(task_id, session_id, prompt, context)
        return result
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@app.get('/health')
async def health():
    """Health check endpoint."""
    mode = 'Claude (Anthropic)' if os.getenv('ANTHROPIC_API_KEY') else 'Mock'
    return {
        'status': 'ok',
        'mode': mode,
        'max_steps': int(os.getenv('AGENT_MAX_STEPS', '5')),
    }


if __name__ == '__main__':
    print(f'\nAgent Runtime (Python) listening on port {PORT}')
    mode = 'Claude (Anthropic)' if os.getenv('ANTHROPIC_API_KEY') else 'Mock'
    print(f'Mode: {mode}\n')
    uvicorn.run(app, host='localhost', port=PORT)
